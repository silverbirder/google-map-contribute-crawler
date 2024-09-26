import { createPlaywrightRouter } from "crawlee";
import {
  GoogleMapContributeReviewsPage,
  GoogleMapPlacePage,
  GoogleAuthPage,
  GoogleMapContributePlacePage,
} from "./pages/index.js";
import {
  getContributorIdByContributorId,
  saveContributorIfNotExistsOrUpdate,
} from "./db/contribute.js";
import { Contributor, Place } from "./types.js";
import {
  getPlaceByNameAndAddress,
  getPlacesByContributorId,
  savePlaceIfNotExistsOrUpdate,
} from "./db/place.js";
import { saveReviewIfNotExistsOrUpdate } from "./db/review.js";
import { v2 } from "@google-cloud/run";
const { JobsClient } = v2;
const runClient = new JobsClient();

export const router = createPlaywrightRouter();

router.addDefaultHandler(async ({ page, log, addRequests }) => {
  const googleMapContributeReviewsPage = new GoogleMapContributeReviewsPage(
    page,
    log
  );
  const googleMapContributePlacePage = new GoogleMapContributePlacePage(
    page,
    log
  );

  const type = process.env.TYPE;
  if (type === "contrib") {
    // https://www.google.com/maps/contrib/103442456215724044802/reviews
    const { contributor } =
      await googleMapContributeReviewsPage.getContributor();
    await saveContributorIfNotExistsOrUpdate(contributor);
    const { reviews } =
      await googleMapContributeReviewsPage.collectUrlsWithScrolling();
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
    if (process.env.NODE_ENV === "production") {
      await runClient.runJob({
        name: process.env.GOOGLE_CLOUD_RUN_JOB_NAME,
        overrides: {
          containerOverrides: [
            {
              env: [
                {
                  name: "START_URLS",
                  value: `https://www.google.com/maps/contrib/${contributor?.contributorId}/reviews`,
                },
                {
                  name: "TYPE",
                  value: "contrib-place",
                },
              ],
            },
          ],
        },
      });
    }
  } else if (type === "contrib-place") {
    // https://www.google.com/maps/contrib/103442456215724044802/reviews OR
    // https://www.google.com/maps/contrib/101722346324226588907/place
    const url = page.url();
    if (url.includes("/reviews")) {
      log.info("This is a review page");
      const { contributor } =
        await googleMapContributeReviewsPage.getContributor();
      const contributorId = await getContributorIdByContributorId(
        contributor?.contributorId ?? ""
      );
      if (!contributorId) {
        log.info("Not found contributor", { contributor });
        return;
      }
      const places = await getPlacesByContributorId(contributorId);
      const requests = places
        .filter((place) => place.url !== "")
        .map((place) => ({
          url: place.url,
          label: "contrib-place",
          userData: {
            contributor,
            place,
          },
        }));
      await addRequests(requests);
    } else if (url.includes("/place")) {
      log.info("This is a place page");
      const { contributor } =
        await googleMapContributePlacePage.getContributor();
      const contributorId = await getContributorIdByContributorId(
        contributor?.contributorId ?? ""
      );
      if (!contributorId) {
        await saveContributorIfNotExistsOrUpdate(contributor);
      }
      const url =
        await googleMapContributePlacePage.clickPlaceDetailsAndCollectUrl();
      await addRequests([
        {
          url,
          label: "contrib-place",
          userData: { contributor, place: null },
        },
      ]);
    }
  } else if (type === "place") {
  } else if (type === "place-contrib") {
  } else if (type === "auth") {
    const googleAuthPage = new GoogleAuthPage(page);
    await googleAuthPage.signIn();
  }
});

router.addHandler("contrib-place", async ({ page, log, request }) => {
  const { contributor, place } = <{ contributor: Contributor; place: Place }>(
    request.userData
  );
  const googleMapPlacePage = new GoogleMapPlacePage(
    page,
    log,
    contributor,
    place
  );
  if (place === null) {
    const { place: _place } = await googleMapPlacePage.getPlace();
    const dbPlace = await getPlaceByNameAndAddress(_place.name, _place.address);
    if (!dbPlace) {
      await savePlaceIfNotExistsOrUpdate(_place);
      const dbPlace2 = await getPlaceByNameAndAddress(
        _place.name,
        _place.address
      );
      if (dbPlace2 !== null) {
        googleMapPlacePage.place = dbPlace2;
      }
    } else {
      googleMapPlacePage.place = dbPlace;
    }
  }
  await googleMapPlacePage.clickReviewTab();
  const crawled = await googleMapPlacePage.collectUrlsWithScrolling();
  await Promise.all(
    crawled.map(async ({ contributor }) => {
      await saveContributorIfNotExistsOrUpdate(contributor);
    })
  );
  await Promise.all(
    crawled.map(async ({ review }) => {
      await saveReviewIfNotExistsOrUpdate(review);
    })
  );
});
