const textEncoder = new TextEncoder()
const PASSWORD_HASH_ITERATIONS = 100000

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const byteArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of byteArray) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

export const CryptoService = {
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PASSWORD_HASH_ITERATIONS }, key, 256)
    return `pbkdf2-sha256:${PASSWORD_HASH_ITERATIONS}:${base64Url(salt)}:${base64Url(bits)}`
  },

  async verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
    if (!storedHash) return false
    const [algorithm, iterationsText, saltText, expectedHash] = storedHash.split(':')
    const iterations = Number(iterationsText)
    if (algorithm !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations <= 0 || !saltText || !expectedHash) return false
    try {
      const salt = base64UrlDecode(saltText)
      const key = await crypto.subtle.importKey('raw', textEncoder.encode(password), 'PBKDF2', false, ['deriveBits'])
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
      return timingSafeEqual(base64Url(bits), expectedHash)
    } catch {
      return false
    }
  },

  async sha256Hex(val: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', textEncoder.encode(val))
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  },

  async sha256Token(val: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', textEncoder.encode(val))
    return `sha256:${base64Url(buf)}`
  },

  async hmacSha256(key: string, message: string): Promise<string> {
    const cryptoKey = await crypto.subtle.importKey('raw', textEncoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, textEncoder.encode(message))
    return base64Url(sig)
  },

  timingSafeEqual
}
