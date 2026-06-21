// Cloudflare Pages Function: Proxy all /api/* requests to the Worker
// This allows the frontend at *.pages.dev to call /api/* and have it
// proxied to the actual Worker at *.workers.dev

const WORKER_ORIGIN = 'https://hl-health-companion.indiehomesungairaya.workers.dev'

export const onRequest: PagesFunction = async (context) => {
  const { request } = context
  const url = new URL(request.url)

  // Build the target URL on the Worker
  const targetUrl = `${WORKER_ORIGIN}${url.pathname}${url.search}`

  // Forward headers, adjusting Host
  const forwardHeaders = new Headers(request.headers)
  forwardHeaders.set('Host', new URL(WORKER_ORIGIN).host)
  // Remove Pages-specific headers that might cause issues
  forwardHeaders.delete('cf-connecting-ip')
  forwardHeaders.delete('cf-ipcountry')
  forwardHeaders.delete('cf-ray')
  forwardHeaders.delete('cf-visitor')

  // Forward the request body for non-GET/HEAD methods
  let body: BodyInit | null = null
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = request.body
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body,
      redirect: 'manual',
    })

    // Build response headers, forwarding everything from the Worker
    const responseHeaders = new Headers(response.headers)

    // Fix Set-Cookie headers: remove Domain attribute so cookies bind to pages.dev
    const setCookies = response.headers.getSetCookie?.() || []
    if (setCookies.length === 0) {
      // Fallback: try getting individual Set-Cookie
      const rawCookie = response.headers.get('Set-Cookie')
      if (rawCookie) {
        responseHeaders.delete('Set-Cookie')
        // Remove Domain= and adjust for pages.dev
        const fixed = rawCookie
          .replace(/;\s*[Dd]omain=[^;]*/g, '')
          .replace(/;\s*[Ss]ecure/gi, '')
        responseHeaders.append('Set-Cookie', fixed)
      }
    } else {
      responseHeaders.delete('Set-Cookie')
      for (const cookie of setCookies) {
        const fixed = cookie
          .replace(/;\s*[Dd]omain=[^;]*/g, '')
          .replace(/;\s*[Ss]ecure/gi, '')
        responseHeaders.append('Set-Cookie', fixed)
      }
    }

    // Add CORS headers for the pages.dev origin
    responseHeaders.set('Access-Control-Allow-Origin', url.origin)
    responseHeaders.set('Access-Control-Allow-Credentials', 'true')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'PROXY_ERROR',
          message: 'Cannot reach API server.',
          details: [error instanceof Error ? error.message : 'unknown'],
        },
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
