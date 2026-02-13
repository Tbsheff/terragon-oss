"use server";

export type ThreadError = {
  id: string;
  errorMessage: string;
  pipelineStage: string | null;
  updatedAt: string;
};

/**
 * Get errors for a thread.
 * Errors are now event-driven via chat events from the gateway.
 * This returns an empty array — the UI receives errors in real-time
 * through the WebSocket broadcast.
 */
export async function getThreadErrors(
  _threadId: string,
): Promise<ThreadError[]> {
  return [];
}
