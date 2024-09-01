import cookies from "./auth/cookie.json" assert { type: "json" };
import "dotenv/config";

// For more information, see https://crawlee.dev/
import { Configuration, PlaywrightCrawler } from "crawlee";

import { router } from "./routes.js";
import { conn } from "./db/index.js";

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
    requestHandlerTimeoutSecs: 3600,
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

try {
  await crawler.run(startUrls);
} finally {
  conn.end();
}
