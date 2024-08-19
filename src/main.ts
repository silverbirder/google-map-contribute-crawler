import "dotenv/config";

// For more information, see https://crawlee.dev/
import { Configuration, PlaywrightCrawler } from "crawlee";

import { router } from "./routes.js";
import { conn } from "./db/index.js";

const startUrls = process.env.START_URLS?.split(",") ?? [];
const config = new Configuration({ persistStorage: false });

const crawler = new PlaywrightCrawler(
  {
    // proxyConfiguration: new ProxyConfiguration({ proxyUrls: ['...'] }),
    requestHandler: router,
    // Comment this option to scrape the full website.
    maxRequestsPerCrawl: 20,
    maxRequestRetries: 2,
    requestHandlerTimeoutSecs: 1800,
    // Comment this option to scrape the full website.
    launchContext: {
      // Here you can set options that are passed to the playwright .launch() function.
      launchOptions: {
        headless: false,
        args: [
          "--deny-permission-prompts",
          `--lang=${process.env.LANG ?? "ja"}`,
        ],
      },
    },
    // browserPoolOptions: {
    //   useFingerprints: true,
    //   fingerprintOptions: {
    //     fingerprintGeneratorOptions: {
    //       browsers: [
    //         {
    //           name: BrowserName.chrome,
    //         },
    //       ],
    //       devices: [DeviceCategory.mobile],
    //       operatingSystems: [OperatingSystemsName.android],
    //     },
    //   },
    // },
  },
  config
);

try {
  await crawler.run(startUrls);
} finally {
  conn.end();
}
