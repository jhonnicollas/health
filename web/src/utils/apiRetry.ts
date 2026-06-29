/**
 * Global fetch retry wrapper for /api/* requests.
 * Patches window.fetch to automatically retry failed API calls caused by
 * Cloudflare Pages Function cold-start (ERR_ABORTED, stale 401 cache).
 *
 * Install once in main.tsx: import './utils/apiRetry';
 *
 * Only intercepts /api/* requests. All other fetches pass through untouched.
 */

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 800;
const API_PATH_RE = /^\/api\//;

// Statuses/conditions worth retrying (Pages Function cold-start symptoms)
function isRetryableError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    return msg.includes('failed') || msg.includes('abort') || msg.includes('network') || msg.includes('fetch');
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  return false;
}

function isRetryableResponse(response: Response): boolean {
  // 401 can be stale CDN-cached response from cold start — retry with cache-buster
  // 502/503 = Pages Function isolate not ready
  return response.status === 401 || response.status === 502 || response.status === 503;
}

// Body streams can only be consumed once — skip retry for those
function isRetryableBody(init?: RequestInit): boolean {
  if (!init?.body) return true; // no body = safe to retry
  if (typeof init.body === 'string') return true; // JSON string = safe
  if (init.body instanceof ArrayBuffer || ArrayBuffer.isView(init.body)) return true;
  if (init.body instanceof URLSearchParams) return true;
  // ReadableStream, FormData, Blob — can't re-consume
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Add cache-busting query param to force CDN to fetch fresh from origin
function addCacheBuster(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_retry=${Date.now()}`;
}

const originalFetch = window.fetch;

// Override global fetch
window.fetch = async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // Only intercept /api/* requests
  const originalUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!API_PATH_RE.test(originalUrl)) {
    return originalFetch.call(window, input, init);
  }

  // Can't retry stream bodies — pass through directly
  if (!isRetryableBody(init)) {
    return originalFetch.call(window, input, init);
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const currentInput = attempt > 0
      ? (typeof input === 'string' ? addCacheBuster(input) : input instanceof URL ? new URL(addCacheBuster(input.href), input.origin) : input)
      : input;

    try {
      const response = await originalFetch.call(window, currentInput, init);

      if (isRetryableResponse(response) && attempt < MAX_RETRIES) {
        await delay(BASE_DELAY_MS * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        await delay(BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      throw error;
    }
  }

  // Unreachable — loop always returns or throws
  throw new Error('apiRetry: unexpected end of retry loop');
};
