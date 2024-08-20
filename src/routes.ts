import { createPlaywrightRouter } from "crawlee";
import {
  GoogleMapContributeReviewsPage,
  GoogleMapContributePlacePage,
  GoogleMapPlacePage,
  GoogleAuthPage,
} from "./pages/index.js";

export const router = createPlaywrightRouter();

router.addHandler("contrib-place", async ({ page, log }) => {
  const googleMapContributePlacePage = new GoogleMapContributePlacePage(
    page,
    log
  );
  const googleMapPlacePage = new GoogleMapPlacePage(page, log);
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
      async (url: string) => {
        await addRequests([{ url, label: "contrib-place" }]);
      }
    );
    await googleMapContributeReviewsPage.collectUrlsWithScrolling();
  } else if (originalUrl.includes("/maps/")) {
    const googleAuthPage = new GoogleAuthPage(page);
    await googleAuthPage.signIn();
  }
});
