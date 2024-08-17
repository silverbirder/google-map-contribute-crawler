import { createPlaywrightRouter } from "crawlee";
import { GoogleMapContributeReviewsPage } from "./pages/index.js";

export const router = createPlaywrightRouter();

router.addDefaultHandler(async ({ page, log }) => {
  const googleMapContributeReviewsPage = new GoogleMapContributeReviewsPage(
    page,
    log
  );
  const originalUrl = page.url();

  // コントリビュータ
  if (originalUrl.includes("/maps/contrib")) {
    const urls =
      await googleMapContributeReviewsPage.collectUrlsWithScrolling();
    log.info("Collected URLs:", { urls });
  }

  // 場所
  if (originalUrl.includes("/maps/place/")) {
  }
});
