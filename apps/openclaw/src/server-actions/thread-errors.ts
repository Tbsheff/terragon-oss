"use server";

import { db } from "@/db";
import { threadChat } from "@/db/schema";
import { eq, isNotNull, and, desc } from "drizzle-orm";

export type ThreadError = {
  id: string;
  errorMessage: string;
  pipelineStage: string | null;
  updatedAt: string;
};

export async function getThreadErrors(
  threadId: string,
): Promise<ThreadError[]> {
  const rows = await db
    .select({
      id: threadChat.id,
      errorMessage: threadChat.errorMessage,
      pipelineStage: threadChat.pipelineStage,
      updatedAt: threadChat.updatedAt,
    })
    .from(threadChat)
    .where(
      and(
        eq(threadChat.threadId, threadId),
        isNotNull(threadChat.errorMessage),
      ),
    )
    .orderBy(desc(threadChat.updatedAt));

  return rows.filter((r): r is ThreadError => r.errorMessage !== null);
}
