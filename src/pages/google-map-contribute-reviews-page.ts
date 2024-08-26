import { Log } from "crawlee";
import { type Page, Locator } from "playwright";
import { Contributor, Review } from "../types.js";

export class GoogleMapContributeReviewsPage {
  readonly page: Page;
  readonly log: Log;
  contributor: Contributor = null;
  private readonly maxRetries = 10;

  constructor(page: Page, log: Log) {
    this.page = page;
    this.log = log;
  }

  async collectUrlsWithScrolling(): Promise<{
    contributor: Contributor;
    reviews: Review[];
  }> {
    const crawledReviews: Review[] = [];
    const checkedReviews: string[] = [];
    let scrollAttempts = 0;
    const name = await this.extractUserName();
    const profileImageUrl = await this.extractProfileImage();
    const url = this.page.url();
    const contributorIdMatch = url.match(/contrib\/(\d+)\/reviews/);
    const contributorId = contributorIdMatch ? contributorIdMatch[1] : "";
    this.contributor = {
      name,
      profileImageUrl,
      url,
      contributorId,
    };

    while (scrollAttempts <= 10) {
      this.log.info(`Starting scroll attempt`, { scrollAttempts });

      if (checkedReviews.length % 10 === 0) {
        this.log.info("Scrolling page to load more reviews.");
        await this.scrollPage();
      }

      const reviews = await this.page
        .locator("[data-review-id][tabindex]")
        .all();
      this.log.info(`Found reviews on the page`, {
        reviewCount: reviews.length,
      });

      if (checkedReviews.length !== reviews.length) {
        this.log.info("Processing next review.", {
          checkedReviewsCount: checkedReviews.length,
        });
        const success = await this.processReview(
          checkedReviews,
          crawledReviews
        );
        if (success) {
          scrollAttempts = 0;
          this.log.info("Review processed successfully.");
        } else {
          scrollAttempts++;
          this.log.warning(
            "Failed to process review. Incrementing scroll attempt.",
            { scrollAttempts }
          );
        }
      } else {
        scrollAttempts++;
        this.log.warning("No new reviews found. Incrementing scroll attempt.", {
          scrollAttempts,
        });
      }
    }

    this.log.info(`Finished processing.`);
    return { contributor: this.contributor, reviews: crawledReviews };
  }

  private async scrollPage(): Promise<void> {
    const tabPanel = await this.page.locator('[role="tabpanel"]');
    const boundingBox = await tabPanel.boundingBox();
    if (boundingBox) {
      this.log.info("Moving mouse to center of tab panel.", { boundingBox });
      await this.page.mouse.move(
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y + boundingBox.height / 2
      );
    }
    for (let i = 0; i < 4; i++) {
      this.log.info(`Scrolling down the page`, { scrollAttempt: i + 1 });
      await this.page.mouse.wheel(0, 10000);
      await this.page.waitForTimeout(1000);
    }
  }

  private async processReview(
    checkedReviews: string[],
    crawledReviews: Review[]
  ): Promise<boolean> {
    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      try {
        const reviews = await this.page
          .locator("[data-review-id][tabindex]")
          .all();
        const nextReview = reviews[checkedReviews.length];
        this.log.info(`Processing review`, { index: checkedReviews.length });
        await nextReview.scrollIntoViewIfNeeded();
        const placeName = (await nextReview.getAttribute("aria-label")) ?? "";
        const placeImg =
          (await nextReview
            .locator(`img[alt="写真: ${placeName}"]`)
            .getAttribute("src")) ?? "";
        this.log.info(`Place Info`, { placeName, placeImg });
        const reviewId =
          (await nextReview.getAttribute("data-review-id")) ?? "";
        this.log.info(`Review Id`, { reviewId });

        this.log.info("Clicking on review.");
        await nextReview.click({ position: { x: 10, y: 10 } });

        this.log.info("Waiting for place URL to load.");

        await this.page.waitForURL((url) => url.pathname.includes("/place/"));

        const currentUrl = this.page.url();
        this.log.info("Current URL", { currentUrl });
        // /maps/place/ or /place/ に遷移するらしい
        // https://www.google.com/maps/place/%E7%A5%88%E3%82%8A%E3%81%AE%E6%BB%9D/@34.4415646,135.6774549,15z/data=!3m1!4b1!4m10!1m3!8m2!1e1!2s103442456215724044802!3m5!1s0x6006d34faef0edf1:0xa5f8a93bbbccbead!8m2!3d34.4415655!4d135.6877546!16s%2Fg%2F11fylvb86p?entry=ttu
        if (currentUrl.includes("/maps/place/")) {
          const placeUrl = this.page.url();
          const address =
            (await this.page
              .locator('[data-item-id="address"]')
              .getAttribute("aria-label")) ?? "";
          const crawledReview: Review = {
            contributorId: this.contributor?.contributorId ?? "",
            reviewId: reviewId,
            place: {
              name: placeName,
              url: placeUrl,
              address: address.slice(4).trim(),
              profileImageUrl: placeImg,
            },
            url: "",
          };
          crawledReviews.push(crawledReview);
          checkedReviews.push(placeName);
          this.log.info(`Collected Review`, { crawledReview });
        } else {
          const reviewUrl = this.page.url();
          await this.page.click('button:has-text("場所の詳細")');
          await this.page.waitForURL((url) =>
            url.pathname.includes("/maps/place/")
          );
          const placeUrl = this.page.url();
          const address =
            (await this.page
              .locator('[data-item-id="address"]')
              .getAttribute("aria-label")) ?? "";
          const crawledReview: Review = {
            contributorId: this.contributor?.contributorId ?? "",
            reviewId: reviewId,
            place: {
              name: placeName,
              url: placeUrl,
              profileImageUrl: placeImg,
              address: address.slice(4).trim(),
            },
            url: reviewUrl,
          };
          crawledReviews.push(crawledReview);
          checkedReviews.push(placeName);
          this.log.info(`Collected Review`, { crawledReview });
        }

        this.log.info("Returning to reviews page.");
        await this.page.click('[aria-label="前に戻ります"]');
        await this.page.waitForURL((url) => url.pathname.includes("/reviews/"));

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

  private async extractUserName(): Promise<string> {
    const userNameElement = await this.page.locator('h1[role="button"]');
    const userName = await userNameElement.textContent();
    return userName?.trim() ?? "Unknown User";
  }

  private async extractProfileImage(): Promise<string> {
    const profileImageElement = await this.page.locator(
      'div[aria-label="プロフィール写真"] img'
    );
    const profileImageUrl = await profileImageElement.getAttribute("src");
    return profileImageUrl ?? "No image URL found";
  }
}
