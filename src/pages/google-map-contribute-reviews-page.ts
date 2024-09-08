import { Log } from "crawlee";
import { type Page } from "playwright";
import { Contributor, Review } from "../types.js";

export class GoogleMapContributeReviewsPage {
  page: Page;
  readonly log: Log;
  contributor: Contributor = null;
  private readonly maxRetries = 3;

  constructor(page: Page, log: Log) {
    this.page = page;
    this.log = log;
  }

  async getContributor(): Promise<{ contributor: Contributor }> {
    const name = await this.extractUserName();
    const profileImageUrl = await this.extractProfileImage();
    const url = this.page.url();
    const contributorIdMatch = url.match(/contrib\/(\d+)\/reviews/);
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
  async collectUrlsWithScrolling(): Promise<{
    reviews: Review[];
  }> {
    const crawledReviews: Review[] = [];
    const checkedReviews: string[] = [];
    let scrollAttempts = 0;
    let retryCount = 0;
    const url = this.page.url();
    this.contributor = (await this.getContributor()).contributor;

    while (scrollAttempts <= 10 && retryCount < this.maxRetries) {
      try {
        if (checkedReviews.length !== 0 && checkedReviews.length % 40 === 0) {
          const res = await this.page.reload();
          this.log.info(`this.page.reload()`);
          await res?.finished();
          await this.page.waitForTimeout(5000);
          const lastReviewId = checkedReviews[checkedReviews.length - 1];
          this.log.info(`lastReviewId: ${lastReviewId}`);
          while (true) {
            await this.scrollPage();
            const reviewCount = await this.page
              .locator(`[data-review-id="${lastReviewId}"]`)
              .count();
            if (reviewCount > 0) {
              this.log.info(`Found lastReviewId`);
              break;
            }
          }
        }
        this.log.info(`Starting scroll attempt`, { scrollAttempts });
        const reviewCount = await this.page
          .locator("[data-review-id][tabindex]")
          .count();
        this.log.info(`Found reviews on the page`, {
          reviewCount,
        });

        console.log(
          "checkedReviews.length < reviewCount",
          `${checkedReviews.length} < ${reviewCount}`
        );
        if (checkedReviews.length < reviewCount) {
          this.log.info("Processing next review.", {
            checkedReviewsCount: checkedReviews.length,
          });
          const success = await this.processReview(
            checkedReviews,
            crawledReviews
          );
          if (success) {
            scrollAttempts = 0;
            retryCount = 0;
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
          await this.scrollPage();
          this.log.warning(
            "No new reviews found. Incrementing scroll attempt.",
            {
              scrollAttempts,
            }
          );
        }
      } catch (error) {
        retryCount++;
        this.log.error(`collectUrlsWithScrolling Attempt failed`, {
          retryCount,
          error,
        });
        this.page = await this.page.context().newPage();
        await this.page.goto(url);
        this.log.info(`this.page.goto(${url})`);
        await this.page.waitForURL((url) => url.pathname.includes("/reviews/"));
        const lastReviewId = checkedReviews[checkedReviews.length - 1];
        this.log.info(`lastReviewId: ${lastReviewId}`);
        while (true) {
          await this.scrollPage();
          const reviewCount = await this.page
            .locator(`[data-review-id="${lastReviewId}"]`)
            .count();
          if (reviewCount > 0) {
            this.log.info(`Found lastReviewId`);
            break;
          }
        }
      }
    }

    this.log.info(`Finished processing.`);
    return { reviews: crawledReviews };
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
        const nextReview = await this.page
          .locator("[data-review-id][tabindex]")
          .nth(checkedReviews.length);
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
          checkedReviews.push(reviewId);
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
          checkedReviews.push(reviewId);
          this.log.info(`Collected Review`, { crawledReview });
        }

        this.log.info("Returning to reviews page.");
        await this.page.click('[aria-label="前に戻ります"]');
        await this.page.waitForURL((url) => url.pathname.includes("/reviews/"));
        await this.page.waitForSelector("[data-review-id][tabindex]");

        return true;
      } catch (error) {
        retryCount++;
        await this.page.waitForTimeout(retryCount * 1000);
        this.log.error(`processReview Attempt failed`, { retryCount, error });
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
