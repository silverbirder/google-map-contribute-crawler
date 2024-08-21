import { Log } from "crawlee";
import { type Page, Locator } from "playwright";

export type Contributor = {
  userName: string;
  profileImageUrl: string;
} | null;

type UserData = {
  contributor: Contributor;
};

export class GoogleMapContributeReviewsPage {
  readonly page: Page;
  readonly log: Log;
  readonly handleRequest: (url: string, userData: UserData) => void;
  contributor: Contributor = null;
  private readonly maxRetries = 3;

  constructor(
    page: Page,
    log: Log,
    handleRequest: (url: string, userData: UserData) => Promise<void>
  ) {
    this.page = page;
    this.log = log;
    this.handleRequest = handleRequest;
  }

  async collectUrlsWithScrolling(): Promise<string[]> {
    const urls: string[] = [];
    const checkedReviews: string[] = [];
    let scrollAttempts = 0;
    const userName = await this.extractUserName();
    const profileImageUrl = await this.extractProfileImage();
    this.contributor = {
      userName,
      profileImageUrl,
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
        const success = await this.processReview(reviews, checkedReviews, urls);
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

    this.log.info(`Finished processing. Collected URLs.`, {
      urlCount: urls.length,
    });
    return urls;
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
    reviews: Locator[],
    checkedReviews: string[],
    urls: string[]
  ): Promise<boolean> {
    let retryCount = 0;

    while (retryCount < this.maxRetries) {
      try {
        const nextReview = reviews[checkedReviews.length];
        this.log.info(`Processing review`, { index: checkedReviews.length });
        await nextReview.scrollIntoViewIfNeeded();
        const name = (await nextReview.getAttribute("aria-label")) ?? "";
        this.log.info(`Review name`, { name });

        this.log.info("Clicking on review.");
        await nextReview.click({ position: { x: 10, y: 10 } });

        this.log.info("Waiting for place URL to load.");
        await this.page.waitForURL((url) => url.pathname.includes("/place/"));

        const url = this.page.url();
        urls.push(url);
        await this.handleRequest(url, { contributor: this.contributor });
        checkedReviews.push(name);
        this.log.info(`Collected URL`, { url });

        this.log.info("Returning to reviews page.");
        await this.page.click('[aria-label="前に戻ります"]');
        await this.page.waitForURL((url) => url.pathname.includes("/reviews/"));

        return true;
      } catch (error) {
        retryCount++;
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
