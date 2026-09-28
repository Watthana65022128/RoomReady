type ReadResult = {
  status: number;
  error: { code?: string; message: string } | null;
};

const RETRY_DELAYS_MS = [500, 1000, 2000];

// Auth and PostgREST can briefly disagree about the issuance time of a new JWT.
// Retry reads with the same session; expired/invalid tokens still fail normally.
export async function readWithJwtRetry<T extends ReadResult>(
  read: () => PromiseLike<T>,
  operation: string,
  wait: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const result = await read();
    const delayMs = RETRY_DELAYS_MS[attempt];
    if (
      delayMs === undefined ||
      result.status !== 401 ||
      result.error?.code !== "PGRST303" ||
      result.error.message !== "JWT issued at future"
    ) {
      return result;
    }
    console.warn("[supabase.read] Retrying JWT clock skew", {
      operation,
      retry: attempt + 1,
      delayMs,
    });
    await wait(delayMs);
  }
}
