import { createPlaywrightRouter } from "crawlee";
import { GoogleMapContributeReviewsPage } from "./pages/index.js";
import { GoogleMapContributePlacePage } from "./pages/google-map-contribute-place-page.js";
import { GoogleMapPlacePage } from "./pages/google-map-place-page.js";

export const router = createPlaywrightRouter();

router.addHandler("contrib-place", async ({ page, log }) => {
  const googleMapContributePlacePage = new GoogleMapContributePlacePage(
    page,
    log
  );
  const googleMapPlacePage = new GoogleMapPlacePage(page, log);
  await googleMapContributePlacePage.clickPlaceDetailsAndCollectUrl();
  // await page.goto(
  //   "https://www.google.com/maps/place/%E3%82%A4%E3%82%BA%E3%83%9F%E3%83%A4+%E3%82%B7%E3%83%A7%E3%83%83%E3%83%94%E3%83%B3%E3%82%B0%E3%82%BB%E3%83%B3%E3%82%BF%E3%83%BC%E5%85%AB%E5%B0%BE/@34.5885888,135.6006032,17z/data=!3m1!4b1!4m6!3m5!1s0x6001277f7e52f34f:0xadf4ee0448ba94c1!8m2!3d34.5885888!4d135.6031781!16s%2Fg%2F1tfp2c57?entry=ttu"
  // );
  await googleMapPlacePage.clickReviewTab();
  await googleMapPlacePage.collectUrlsWithScrolling();
});

router.addDefaultHandler(async ({ page, log, addRequests }) => {
  // await addRequests([
  //   {
  //     url: "https://www.google.com/maps/contrib/103442456215724044802/place/ChIJF1y0WTDNVDURRCLB3BRYzng/@34.5382674,133.6733936,8z/data=!4m6!1m5!8m4!1e1!2s103442456215724044802!3m1!1e1?entry=ttu",
  //     label: "contrib-place",
  //   },
  // ]);
  // return;
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
  }
});
