const WORKER_URL = 'https://hl-health-companion-api.indiehomesungairaya.workers.dev'

export async function onRequest(context) {
  const { request } = context
  const url = new URL(request.url)
  const target = new URL(url.pathname + url.search, WORKER_URL)

  const init = {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
    redirect: 'follow',
  }

  const response = await fetch(target.toString(), init)

  const respHeaders = new Headers(response.headers)
  respHeaders.set('access-control-allow-origin', url.origin)
  respHeaders.set('access-control-allow-credentials', 'true')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders,
  })
}
