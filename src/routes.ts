import { createPlaywrightRouter } from "crawlee";

export const router = createPlaywrightRouter();

router.addDefaultHandler(async ({ enqueueLinks, log, page }) => {
  // log.info(`enqueueing new URLs`);
  await page.waitForSelector('div[tabindex="-1"][role="tabpanel"]');
  const reviewPanel = await page.$('div[tabindex="-1"][role="tabpanel"]');
  if (!reviewPanel) return;
  const boundingBox = await reviewPanel.boundingBox();
  if (!boundingBox) return;
  await page.mouse.move(
    boundingBox.x + boundingBox.width / 2,
    boundingBox.y + boundingBox.height / 2
  );
  await page.mouse.wheel(0, 10000);
  await page.mouse.wheel(0, 10000);
  await sleep(5000);
  await page.mouse.wheel(0, 10000);
  await page.mouse.wheel(0, 10000);
  await sleep(5000);
  const currentReviews = await page.$$eval(
    'div[data-review-id][role="button"][tabindex="0"]',
    (elements) => {
      return elements.map((element) => ({
        reviewId: element.getAttribute("data-review-id"),
        text: element.textContent,
      }));
    }
  );
  //   await enqueueLinks({
  //     globs: ["https://crawlee.dev/**"],
  //     label: "detail",
  //   });
});

// router.addHandler("detail", async ({ request, page, log, pushData }) => {
//   const title = await page.title();
//   log.info(`${title}`, { url: request.loadedUrl });

//   await pushData({
//     url: request.loadedUrl,
//     title,
//   });
// });

const sleep = (msec: number) =>
  new Promise((resolve) => setTimeout(resolve, msec));
