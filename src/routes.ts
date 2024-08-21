import { createPlaywrightRouter } from "crawlee";
import {
  GoogleMapContributeReviewsPage,
  GoogleMapContributePlacePage,
  GoogleMapPlacePage,
  GoogleAuthPage,
  Contributor,
} from "./pages/index.js";

export const router = createPlaywrightRouter();

router.addHandler("contrib-place", async ({ page, log, request }) => {
  const { contributor } = <{ contributor: Contributor }>request.userData;
  const googleMapContributePlacePage = new GoogleMapContributePlacePage(
    page,
    log
  );
  const googleMapPlacePage = new GoogleMapPlacePage(
    page,
    log,
    contributor?.userName ?? ""
  );
  await googleMapContributePlacePage.clickPlaceDetailsAndCollectUrl();
  await googleMapPlacePage.clickReviewTab();
  await googleMapPlacePage.collectUrlsWithScrolling();
});

router.addDefaultHandler(async ({ page, log, addRequests }) => {
  const originalUrl = page.url();
  if (originalUrl.includes("/maps/contrib/")) {
    const googleMapContributeReviewsPage = new GoogleMapContributeReviewsPage(
      page,
      log,
      async (url: string, userData: { contributor: Contributor }) => {
        await addRequests([{ url, label: "contrib-place", userData }]);
      }
    );
    await googleMapContributeReviewsPage.collectUrlsWithScrolling();
  } else if (originalUrl.includes("/maps/")) {
    const googleAuthPage = new GoogleAuthPage(page);
    await googleAuthPage.signIn();
  }
});
