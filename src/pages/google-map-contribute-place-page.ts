import { Log } from "crawlee";
import { type Page } from "playwright";
import { Contributor } from "../types.js";

export class GoogleMapContributePlacePage {
  readonly page: Page;
  readonly log: Log;

  constructor(page: Page, log: Log) {
    this.page = page;
    this.log = log;
  }

  async getContributor(): Promise<{ contributor: Contributor }> {
    const name = await this.extractUserName();
    const profileImageUrl = await this.extractProfileImage();
    const url = this.page.url();
    const contributorIdMatch = url.match(/contrib\/(\d+)\/place/);
    const contributorId = contributorIdMatch ? contributorIdMatch[1] : "";
    return {
      contributor: {
        name,
        profileImageUrl,
        url,
        contributorId,
      },
    };
  }

  async clickPlaceDetailsAndCollectUrl(): Promise<string> {
    try {
      this.log.info('Clicking the "場所の詳細" button.');
      const placeDetailsButton = await this.page
        .locator('button:has-text("場所の詳細")')
        .first();
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

  private async extractUserName(): Promise<string> {
    const imgElement = await this.page.locator('img[alt*="写真:"]').first();
    const altText = await imgElement.getAttribute("alt");
    if (altText) {
      const match = altText.match(/写真:\s*(.*)/);
      const userName = match ? match[1].trim() : "Unknown User";
      return userName;
    }
    return "Unknown User";
  }

  private async extractProfileImage(): Promise<string> {
    const imgElement = await this.page.locator('img[alt*="写真:"]').first();
    const profileImageUrl = await imgElement.getAttribute("src");
    return profileImageUrl ?? "No image URL found";
  }
}
