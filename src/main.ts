import cookies from "./auth/cookie.json" assert { type: "json" };
import "dotenv/config";

// For more information, see https://crawlee.dev/
import { Configuration, PlaywrightCrawler } from "crawlee";

import { router } from "./routes.js";
import { conn } from "./db/index.js";
import {
  getLatestBatchStatusByContributorId,
  insertBatchStatus,
} from "./db/batch-status.js";

const startUrls = process.env.START_URLS?.split(",") ?? [];
const config = new Configuration({
  persistStorage: false,
});

const crawler = new PlaywrightCrawler(
  {
    // proxyConfiguration: new ProxyConfiguration({ proxyUrls: ['...'] }),
    requestHandler: router,
    // Comment this option to scrape the full website.
    maxRequestsPerCrawl: 20,
    maxRequestRetries: 2,
    requestHandlerTimeoutSecs: 43200, // 12 hours
    // Comment this option to scrape the full website.
    launchContext: {
      // Here you can set options that are passed to the playwright .launch() function.
      launchOptions: {
        headless: true,
        args: [
          "--deny-permission-prompts",
          `--lang=${process.env.LANG ?? "ja"}`,
        ],
      },
    },
    preNavigationHooks: [
      async (crawlingContext) => {
        crawlingContext.page.context().addCookies(cookies as any);
        await crawlingContext.page.route("**/*", (route) => {
          const request = route.request();
          if (
            request.resourceType() === "image" ||
            request.resourceType() === "media"
          ) {
            const url = new URL(request.url());
            if (url.hostname !== "lh3.googleusercontent.com") {
              route.abort();
            } else {
              route.continue();
            }
          } else {
            route.continue();
          }
        });
      },
    ],
  },
  config
);

const main = async (startUrls: string[]): Promise<boolean> => {
  if (startUrls.length === 0) return false;
  const contributorIdMatch = startUrls[0].match(/contrib\/(\d+)\/reviews/);
  const contributorId = contributorIdMatch ? contributorIdMatch[1] : "";
  try {
    const currentStatus = await getLatestBatchStatusByContributorId(
      contributorId
    );
    if (currentStatus && ["in_progress"].includes(currentStatus.status)) {
      console.log(
        `Batch for contributor ${contributorId} is already in progress.`
      );
      return false;
    }
    await insertBatchStatus(contributorId, "in_progress");
    await crawler.run(startUrls);
    await insertBatchStatus(contributorId, "completed");
  } catch (e) {
    console.error("An error occurred:", e);
    await insertBatchStatus(contributorId, "error");
  } finally {
    conn.end();
  }
  return true;
};

main(startUrls);
