import { createPlaywrightRouter } from "crawlee";
import {
  GoogleMapPage,
  GoogleMapContributeReviewsPage,
} from "./pages/index.js";

export const router = createPlaywrightRouter();

router.addDefaultHandler(async ({ page }) => {
  const googleMapPage = new GoogleMapPage(page);
  const googleMapContributeReviewsPage = new GoogleMapContributeReviewsPage(
    page
  );
  const originalUrl = page.url();

  // 初期化
  await googleMapPage.started();
  await googleMapPage.continueUsingWebVersion();

  // コントリビュータ
  if (originalUrl.includes("/maps/contrib")) {
    await googleMapContributeReviewsPage.started(originalUrl);
    await googleMapContributeReviewsPage.scrollToLoadReviews(1);
    const urls = await googleMapContributeReviewsPage.clickAndCollectUrls(1);
    console.log("Collected URLs:", urls);
  }

  // 場所
  if (originalUrl.includes("/maps/place/")) {
    console.log("Processing /maps/place/ URL...");
  }
});
