import { Log } from "crawlee";
import { Locator, type Page } from "playwright";
import { Contributor, Place, Review } from "../types.js";

export class GoogleMapPlacePage {
  readonly page: Page;
  readonly log: Log;
  readonly contributor: Contributor;
  place: Place;
  private readonly maxRetries = 3;

  constructor(page: Page, log: Log, contributor: Contributor, place: Place) {
    this.page = page;
    this.log = log;
    this.contributor = contributor;
    this.place = place;
  }

  async clickReviewTab() {
    this.log.info("Clicking the review tab...");

    const reviewTabButton = await this.page
      .locator('button[role="tab"][aria-label*="クチコミ"]')
      .first();
    await reviewTabButton.click();
    this.log.info("Review tab clicked.");
    await this.page.waitForSelector(
      'button[role="tab"][aria-label*="クチコミ"][aria-selected="true"]'
    );
  }

  async collectUrlsWithScrolling(): Promise<
    { review: Review; contributor: Contributor }[]
  > {
    const crawled: {
      review: Review;
      contributor: Contributor;
    }[] = [];
    this.log.info("Starting to scroll the page until the end.");
    let scrollAttempts = 0;
    let lastReviewCount = 0;
    while (scrollAttempts <= 1) {
      this.log.info(`Scrolling page`, { scrollAttempts });
      await this.scrollPage();
      const reviewCount = await this.page
        .locator(
          `[aria-label$="クチコミへのアクション"]:not([aria-label*="${this.contributor?.name} さんのクチコミへのアクション"])`
        )
        .count();
      if (lastReviewCount === reviewCount) {
        scrollAttempts++;
      }
      lastReviewCount = reviewCount;
    }

    this.log.info("Finished scrolling. Now collecting all reviews.");

    const reviews = await this.page
      .locator(
        `[aria-label$="クチコミへのアクション"]:not([aria-label*="${this.contributor?.name} さんのクチコミへのアクション"])`
      )
      .all();
    this.log.info(`Found reviews on the page`, { reviewCount: reviews.length });

    for (const [index, review] of reviews.entries()) {
      this.log.info(`Processing review`, { index });
      const success = await this.processReview(review, crawled);
      if (success) {
        this.log.info("Review processed successfully.");
      } else {
        this.log.warning("Failed to process review.");
      }
    }

    this.log.info(`Finished processing. Collected URLs.`, {
      urlCount: crawled.length,
    });
    return crawled;
  }

  private async scrollPage(): Promise<void> {
    const reviewTabButton = await this.page
      .locator('button[role="tab"][aria-label*="クチコミ"]')
      .first();
    const boundingBox = await reviewTabButton.boundingBox();
    if (boundingBox) {
      this.log.info(
        "Moving mouse to center of the last review action element.",
        { boundingBox }
      );
      await this.page.mouse.move(
        boundingBox.x,
        boundingBox.y + boundingBox.height + 100
      );
    }
    for (let i = 0; i < 4; i++) {
      this.log.info(`Scrolling down the page`, { scrollAttempt: i + 1 });
      await this.page.mouse.wheel(0, 10000);
      await this.page.waitForTimeout(1000);
    }
  }

  private async processReview(
    review: Locator,
    crawled: { review: Review; contributor: Contributor }[]
  ): Promise<boolean> {
    let retryCount = 0;
    const ctx = this.page.context();
    ctx.grantPermissions(["clipboard-read"]);

    while (retryCount < this.maxRetries) {
      try {
        const contributorName =
          (await review.getAttribute("aria-label"))?.replace(
            " さんのクチコミへのアクション",
            ""
          ) ?? "";
        const reviewId = (await review.getAttribute("data-review-id")) ?? "";
        this.log.info(`Contributor name`, { contributorName });
        const contributorUrl =
          (await this.page
            .locator(`[data-review-id='${reviewId}'][data-href]`)
            .first()
            .getAttribute("data-href")) ?? "";
        const contributorIdMatch = contributorUrl.match(
          /contrib\/(\d+)\/reviews/
        );
        const contributorId = contributorIdMatch ? contributorIdMatch[1] : "";
        const contributorImg =
          (await this.page
            .locator(`button[aria-label="写真: ${contributorName}"] img`)
            .first()
            .getAttribute("src")) ?? "";
        crawled.push({
          review: {
            contributorId: contributorId,
            reviewId: reviewId,
            place: this.place,
            url: "",
          },
          contributor: {
            name: contributorName,
            url: `https://www.google.com/maps/contrib/${contributorId}/reviews`,
            profileImageUrl: contributorImg,
            contributorId: contributorId,
          },
        });
        this.log.info("crawled", { crawled });
        return true;
      } catch (error) {
        retryCount++;
        await this.page.waitForTimeout(retryCount * 1000);
        this.log.error(`Attempt failed`, { retryCount, error });
      }
    }

    this.log.error("Max retries reached, skipping to the next review.");
    return false;
  }

  async getPlace(): Promise<{ place: Place }> {
    const name =
      (await this.page.locator("h1").first().textContent())?.trim() ?? "";
    const address =
      (
        await this.page
          .locator('[data-item-id="address"]')
          .first()
          .getAttribute("aria-label")
      )?.trim() ?? "";
    const url = this.page.url();
    const profileImageElement = await this.page
      .locator(`button[aria-label="写真: ${name}"] img`)
      .first();
    let profileImageUrl = (await profileImageElement.getAttribute("src")) ?? "";
    profileImageUrl = profileImageUrl.replace(
      /=w\d+-h\d+-.*$/,
      "=w72-h72-p-k-no-rp-br100"
    );

    return {
      place: {
        name,
        address,
        url,
        profileImageUrl,
      },
    };
  }
}
