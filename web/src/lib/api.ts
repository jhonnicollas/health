export async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    if (res.status === 204) return null
    return await res.json() as T
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function apiError(body: any, fallback = 'Gagal. Coba lagi.'): string {
  return body?.error?.message || fallback
}
