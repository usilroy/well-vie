export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 30_000;
export const UPLOAD_TIMEOUT_MS = 15 * 60_000;

/** Bound stalled requests without retrying a possibly committed mutation. */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const url = input instanceof Request ? input.url : String(input);
  const isUpload = new URL(url).pathname.includes("/storage/v1/object/upload/");
  const controller = new AbortController();
  const upstream =
    init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort(upstream?.reason);
  if (upstream?.aborted) abort();
  else upstream?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        new Error(
          "The request timed out. Refresh to check whether the change was saved before retrying.",
        ),
      ),
    isUpload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
    // Supabase consumes JSON after fetch resolves. Buffer these small responses
    // inside the timeout so a stalled body cannot leave the workspace spinning.
    const bytes = await response.arrayBuffer();
    return new Response(
      response.status === 204 ||
      response.status === 205 ||
      response.status === 304
        ? null
        : bytes,
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      },
    );
  } finally {
    clearTimeout(timer);
    upstream?.removeEventListener("abort", abort);
  }
}
