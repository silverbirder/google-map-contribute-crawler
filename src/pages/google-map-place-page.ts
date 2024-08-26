import { Log } from "crawlee";
import { type Page } from "playwright";
import { Contributor, Place, Review } from "../types.js";

export class GoogleMapPlacePage {
  readonly page: Page;
  readonly log: Log;
  readonly contributor: Contributor;
  readonly place: Place;
  private readonly maxRetries = 3;

  constructor(page: Page, log: Log, contributor: Contributor, place: Place) {
    this.page = page;
    this.log = log;
    this.contributor = contributor;
    this.place = place;
  }

  async clickReviewTab() {
    this.log.info("Clicking the review tab...");

    const reviewTabButton = await this.page.locator(
      'button[role="tab"][aria-label*="クチコミ"]'
    );
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
    const checkedReviews: string[] = [];
    let scrollAttempts = 0;
    while (scrollAttempts <= 10) {
      this.log.info(`Starting scroll attempt`, { scrollAttempts });

      if (checkedReviews.length % 10 === 0) {
        this.log.info("Scrolling page to load more reviews.");
        await this.scrollPage();
      }

      const reviews = await this.page
        .locator(
          `[aria-label$="クチコミへのアクション"]:not([aria-label*="${this.contributor?.name} さんのクチコミへのアクション"])`
        )
        .all();
      this.log.info(`Found reviews on the page`, {
        reviewCount: reviews.length,
      });
      if (checkedReviews.length !== reviews.length) {
        this.log.info("Processing next review.", {
          checkedReviewsCount: checkedReviews.length,
        });
        const success = await this.processReview(checkedReviews, crawled);
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
      urlCount: crawled.length,
    });
    return crawled;
  }

  private async scrollPage(): Promise<void> {
    const reviewTabButton = await this.page.locator(
      'button[role="tab"][aria-label*="クチコミ"]'
    );
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
    checkedReviews: string[],
    crawled: { review: Review; contributor: Contributor }[]
  ): Promise<boolean> {
    let retryCount = 0;
    const ctx = this.page.context();
    ctx.grantPermissions(["clipboard-read"]);

    while (retryCount < this.maxRetries) {
      try {
        const reviews = await this.page
          .locator(
            `[aria-label$="クチコミへのアクション"]:not([aria-label*="${this.contributor?.name} さんのクチコミへのアクション"])`
          )
          .all();
        const nextReview = reviews[checkedReviews.length];
        this.log.info(`Processing review`, { index: checkedReviews.length });
        await nextReview.scrollIntoViewIfNeeded();
        const contributorName =
          (await nextReview.getAttribute("aria-label"))?.replace(
            " さんのクチコミへのアクション",
            ""
          ) ?? "";
        const reviewId =
          (await nextReview.getAttribute("data-review-id")) ?? "";
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
            .getAttribute("src")) ?? "";

        await nextReview.click();

        this.log.info("Waiting for the action menu to appear.");
        await this.page.waitForSelector("#action-menu");

        const shareOption = await this.page.locator(
          'div[role="menuitemradio"]:has-text("クチコミを共有")'
        );
        await shareOption.click();

        this.log.info(
          "Clicked on 'クチコミを共有'. Waiting for 'リンクをコピー'."
        );
        await this.page.waitForSelector('button:has-text("リンクをコピー")');
        const copyLinkButton = await this.page.locator(
          'button:has-text("リンクをコピー")'
        );
        await copyLinkButton.click();
        const clipboardText = await this.page.evaluate(async () => {
          return await navigator.clipboard.readText();
        });

        // クリップボードの内容をログに出力
        this.log.info("Link copied to clipboard.", { clipboardText });
        // // 短縮URLを元のURLに展開
        // const expandedUrl = await this.expandShortUrl(clipboardText);
        crawled.push({
          review: {
            contributorId: contributorId,
            reviewId: reviewId,
            place: this.place,
            url: clipboardText,
          },
          contributor: {
            name: contributorName,
            url: `https://www.google.com/maps/contrib/${contributorId}/reviews`,
            profileImageUrl: contributorImg,
            contributorId: contributorId,
          },
        });
        checkedReviews.push(contributorName);
        this.log.info("crawled", { crawled });
        this.log.info("Link copied. Pressing ESC to close the dialog.");
        await this.page.keyboard.press("Escape");
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

  private async expandShortUrl(shortUrl: string): Promise<string> {
    this.log.info("Navigating to short URL to expand it.", { shortUrl });
    const newPage = await this.page.context().newPage();
    await newPage.goto(shortUrl);
    await newPage.waitForURL((url) => url.pathname.includes("/reviews/"));
    const expandedUrl = newPage.url();
    await newPage.close();
    return expandedUrl;
  }
}
