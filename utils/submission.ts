const RETRYABLE_STATUS = new Set([408, 425, 429]);

export const isRetryableStatus = (status: number): boolean => status >= 500 || RETRYABLE_STATUS.has(status);

export const submissionBody = <T extends { startedAt?: number; elapsedMs: number }>(
  { startedAt, ...submission }: T,
  now = Date.now(),
) => ({
  ...submission,
  elapsedMs: Number.isFinite(startedAt)
    ? Math.max(submission.elapsedMs, Math.round(now - startedAt!))
    : submission.elapsedMs,
});
