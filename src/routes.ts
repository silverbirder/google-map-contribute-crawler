import { createPlaywrightRouter } from "crawlee";
import {
  GoogleMapContributeReviewsPage,
  GoogleMapPlacePage,
  GoogleAuthPage,
} from "./pages/index.js";
import { saveContributorIfNotExistsOrUpdate } from "./db/contribute.js";
import { Contributor, Place } from "./types.js";
import { savePlaceIfNotExistsOrUpdate } from "./db/place.js";
import { saveReviewIfNotExistsOrUpdate } from "./db/review.js";

export const router = createPlaywrightRouter();

router.addHandler("map-place", async ({ page, log, request }) => {
  const { contributor, place } = <{ contributor: Contributor; place: Place }>(
    request.userData
  );
  const googleMapPlacePage = new GoogleMapPlacePage(
    page,
    log,
    contributor,
    place
  );
  await googleMapPlacePage.clickReviewTab();
  const crawled = await googleMapPlacePage.collectUrlsWithScrolling();
  await Promise.all(
    crawled.map(async ({ review, contributor }) => {
      await saveContributorIfNotExistsOrUpdate(contributor);
      await saveReviewIfNotExistsOrUpdate(review);
    })
  );
});

router.addDefaultHandler(async ({ page, log, addRequests }) => {
  const originalUrl = page.url();
  if (originalUrl.includes("/maps/contrib/")) {
    const googleMapContributeReviewsPage = new GoogleMapContributeReviewsPage(
      page,
      log
    );
    const { contributor, reviews } =
      await googleMapContributeReviewsPage.collectUrlsWithScrolling();
    await saveContributorIfNotExistsOrUpdate(contributor);
    await Promise.all(
      reviews.map(async (review) => {
        await savePlaceIfNotExistsOrUpdate(review.place);
      })
    );
    await Promise.all(
      reviews.map(async (review) => {
        await saveReviewIfNotExistsOrUpdate(review);
      })
    );
    const requests = reviews.map((review) => ({
      url: review.place.url,
      label: "map-place",
      userData: {
        contributor,
        place: review.place,
      },
    }));
    await addRequests(requests);
  } else if (originalUrl.includes("/maps")) {
    const googleAuthPage = new GoogleAuthPage(page);
    await googleAuthPage.signIn();
  }
});
