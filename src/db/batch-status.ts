import { eq, desc } from "drizzle-orm";
import { db } from "./index.js";
import { batchStatus } from "./schema.js";
export const getLatestBatchStatusByContributorId = async (
  contributorId: string
) => {
  const [latestStatus] = await db
    .select()
    .from(batchStatus)
    .where(eq(batchStatus.contributorId, contributorId))
    .orderBy(desc(batchStatus.createdAt))
    .limit(1);

  if (!latestStatus) {
    console.error("No batch status found for contributorId:", contributorId);
    return null;
  }

  return latestStatus;
};

export const insertBatchStatus = async (
  contributorId: string,
  status: "waiting" | "in_progress" | "completed" | "error"
) => {
  await db.insert(batchStatus).values({
    contributorId,
    status,
    createdAt: new Date(),
  });

  console.log("Batch status inserted:", contributorId, status);
};
