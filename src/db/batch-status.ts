import { eq, desc, and } from "drizzle-orm";
import { db } from "./index.js";
import { batchStatus } from "./schema.js";
export const getLatestBatchStatusByContributorId = async (
  contributorId: string,
  type: "contrib" | "contrib-place" | "place" | "place-contrib"
) => {
  const [latestStatus] = await db
    .select()
    .from(batchStatus)
    .where(
      and(
        eq(batchStatus.contributorId, contributorId),
        eq(batchStatus.type, type)
      )
    )
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
  status: "waiting" | "in_progress" | "completed" | "error",
  type: "contrib" | "contrib-place" | "place" | "place-contrib"
) => {
  await db.insert(batchStatus).values({
    contributorId,
    status,
    type,
    createdAt: new Date(),
  });

  console.log("Batch status inserted:", contributorId, status);
};
