export async function apiGet(url: string) {
  const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })
  if (res.status === 401 || res.status === 403) return { success: false, error: { message: 'Access denied' } }
  return res.json()
}

export async function apiMut(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}
