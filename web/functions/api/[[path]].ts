const WORKER_ORIGIN = 'https://hl-health-companion.indiehomesungairaya.workers.dev'

export async function onRequest(context) {
  const req = context.request
  const url = new URL(req.url)
  const targetUrl = WORKER_ORIGIN + url.pathname + url.search

  const headers = new Headers(req.headers)
  headers.set('Host', new URL(WORKER_ORIGIN).host)

  const init = {
    method: req.method,
    headers,
    redirect: 'follow' as RequestRedirect,
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body
    // @ts-ignore
    init.duplex = 'half'
  }

  const upstream = await fetch(targetUrl, init)

  const respHeaders = new Headers(upstream.headers)
  respHeaders.delete('content-encoding')
  respHeaders.delete('content-length')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  })
}
