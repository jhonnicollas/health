const WORKER_URL = 'https://isehat-api.indiehomesungairaya.workers.dev'

export async function onRequest(context) {
  const { request } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': new URL(request.url).origin,
        'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': 'Content-Type,Accept',
        'access-control-allow-credentials': 'true',
        'access-control-max-age': '86400',
      },
    })
  }

  const url = new URL(request.url)
  const target = new URL(url.pathname + url.search, WORKER_URL)

  const headers = new Headers(request.headers)
  headers.set('Host', target.host)

  const init = {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
    redirect: 'follow',
  }

  const response = await fetch(target.toString(), init)

  const respHeaders = new Headers(response.headers)
  const origin = url.origin
  respHeaders.set('access-control-allow-origin', origin)
  respHeaders.set('access-control-allow-credentials', 'true')
  respHeaders.delete('content-encoding')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders,
  })
}
