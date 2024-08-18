import { Log } from "crawlee";
import { type Page } from "playwright";

export class GoogleMapContributePlacePage {
  readonly page: Page;
  readonly log: Log;

  constructor(page: Page, log: Log) {
    this.page = page;
    this.log = log;
  }

  async clickPlaceDetailsAndCollectUrl(): Promise<string> {
    try {
      this.log.info('Clicking the "場所の詳細" button.');
      const placeDetailsButton = await this.page.locator(
        'button:has-text("場所の詳細")'
      );
      await placeDetailsButton.click();

      this.log.info("Waiting for the place URL to load.");
      await this.page.waitForURL((url) =>
        url.pathname.includes("/maps/place/")
      );

      const url = this.page.url();
      this.log.info("Collected place URL.", { url });

      return url;
    } catch (error) {
      this.log.error(
        'Failed to click the "場所の詳細" button or retrieve the URL.',
        { error }
      );
      throw error;
    }
  }
}
