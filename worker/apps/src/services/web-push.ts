// Web Push Protocol implementation for Cloudflare Workers
// Implements VAPID (RFC 8292) + Message Encryption (RFC 8291)
// No external dependencies — uses Web Crypto API

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const b of arr) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(str: string): Uint8Array {
  const normalized = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function importVapidPrivateKey(privateKeyB64Url: string): Promise<CryptoKey> {
  // Import via JWK — avoids fragile manual PKCS8 DER construction
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: privateKeyB64Url, ext: true } as JsonWebKey,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

async function createVapidJwt(vapidPrivateKey: CryptoKey, origin: string, subject: string): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = {
    aud: new URL(origin).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject
  }

  const headerB64 = base64UrlEncode(textEncoder.encode(JSON.stringify(header)))
  const payloadB64 = base64UrlEncode(textEncoder.encode(JSON.stringify(payload)))
  const unsigned = `${headerB64}.${payloadB64}`

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    vapidPrivateKey,
    textEncoder.encode(unsigned)
  )

  // Convert DER signature to raw r||s for JWT
  const rawSig = derToRawSignature(new Uint8Array(signature))
  const sigB64 = base64UrlEncode(rawSig)

  return `${unsigned}.${sigB64}`
}

function derToRawSignature(der: Uint8Array): Uint8Array {
  // DER ECDSA signature → raw r||s (64 bytes for P-256)
  const result = new Uint8Array(64)
  let offset = 2 // skip 0x30, total length
  if (der[offset] === 0x02) offset++
  const rLen = der[offset++]
  const rData = der.slice(offset, offset + rLen)
  offset += rLen
  if (der[offset] === 0x02) offset++
  const sLen = der[offset++]
  const sData = der.slice(offset, offset + sLen)

  // Copy r (strip leading zero if present)
  const rStart = rData.length === 33 ? 1 : 0
  result.set(rData.slice(rStart), 32 - (rData.length - rStart))
  // Copy s (strip leading zero if present)
  const sStart = sData.length === 33 ? 1 : 0
  result.set(sData.slice(sStart), 64 - (sData.length - sStart))

  return result
}

async function hkdf(secret: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    keyMaterial,
    length * 8
  )
  return new Uint8Array(bits)
}

async function encryptPayload(
  payload: string,
  p256dhB64Url: string,
  authB64Url: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; dhPublicKey: Uint8Array }> {
  const userPublicKey = base64UrlDecode(p256dhB64Url)
  const authSecret = base64UrlDecode(authB64Url)

  // Import user's ECDH public key
  const userEcdhKey = await crypto.subtle.importKey(
    'raw',
    userPublicKey as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // Generate server ephemeral key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  ) as CryptoKeyPair

  // Export server public key (uncompressed, 65 bytes)
  const serverPubKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  const serverPubKeyBytes = new Uint8Array(serverPubKeyRaw as ArrayBuffer)

  // Derive shared secret
  // Workers type defs lack ECDH deriveBits params — cast to compatible shape
  const ecdhParams = { name: 'ECDH', public: userEcdhKey } as { name: string; public: CryptoKey }
  const sharedSecret = await crypto.subtle.deriveBits(
    ecdhParams,
    serverKeyPair.privateKey,
    256
  )
  const sharedSecretBytes = new Uint8Array(sharedSecret)

  // Generate random salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // IKM = HKDF(authSecret, sharedSecret, "WebPush: info\0" + userPubKey + serverPubKey, 32)
  const authInfo = new Uint8Array([
    ...textEncoder.encode('WebPush: info'),
    0,
    ...userPublicKey,
    ...serverPubKeyBytes
  ])
  const ikm = await hkdf(
    new Uint8Array([...sharedSecretBytes, ...authSecret]),
    salt,
    authInfo,
    32
  )

  // Content encryption key + nonce
  const cekInfo = textEncoder.encode('Content-Encoding: aes128gcm\0')
  const cek = await hkdf(ikm, new Uint8Array(0), cekInfo, 16)

  const nonceInfo = textEncoder.encode('Content-Encoding: nonce\0')
  const nonce = await hkdf(ikm, new Uint8Array(0), nonceInfo, 12)

  // Encrypt with AES-128-GCM
  const cekKey = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt'])

  // RFC 8291: plaintext || delimiter(0x02) || padding zeros, encrypted to fill record size
  const payloadBytes = textEncoder.encode(payload)
  const recordSize = 4096
  const paddingLength = Math.max(0, recordSize - payloadBytes.length - 1 - 16) // 1=delimiter, 16=auth tag
  const finalPayload = new Uint8Array([...payloadBytes, 0x02, ...new Uint8Array(paddingLength).fill(0)])

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource },
    cekKey,
    finalPayload as BufferSource
  )

  return {
    ciphertext: new Uint8Array(encrypted),
    salt,
    dhPublicKey: serverPubKeyBytes
  }
}

function buildAes128GcmHeader(salt: Uint8Array, dhPublicKey: Uint8Array, recordSize: number): Uint8Array {
  const header = new Uint8Array(21 + dhPublicKey.length)
  header.set(salt, 0) // 16 bytes salt
  // Record size as 4-byte big-endian
  header[16] = (recordSize >> 24) & 0xff
  header[17] = (recordSize >> 16) & 0xff
  header[18] = (recordSize >> 8) & 0xff
  header[19] = recordSize & 0xff
  // Key ID length (1 byte) + key ID
  header[20] = dhPublicKey.length
  header.set(dhPublicKey, 21)
  return header
}

export type PushSubscription = {
  endpoint: string
  p256dh: string
  auth: string
}

export const WebPushService = {
  async sendNotification(
    subscription: PushSubscription,
    payload: { title: string; body: string; url?: string },
    vapidPrivateKey: string,
    vapidSubject = 'mailto:admin@isehat.biz.id'
  ): Promise<{ sent: boolean; error?: string }> {
    try {
      const vapidKey = await importVapidPrivateKey(vapidPrivateKey)
      const jwt = await createVapidJwt(vapidKey, subscription.endpoint, vapidSubject)

      const payloadStr = JSON.stringify(payload)
      const { ciphertext, salt, dhPublicKey } = await encryptPayload(
        payloadStr,
        subscription.p256dh,
        subscription.auth
      )

      const header = buildAes128GcmHeader(salt, dhPublicKey, 4096)
      const body = new Uint8Array([...header, ...ciphertext])

      const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'TTL': '2419200',
          'Authorization': `vapid t=${jwt}, k=${vapidSubject}`
        },
        body: body as BufferSource
      })

      if (!response.ok) {
        const errorText = await response.text()
        return { sent: false, error: `Push ${response.status}: ${errorText.slice(0, 200)}` }
      }

      return { sent: true }
    } catch (error) {
      return { sent: false, error: error instanceof Error ? error.message : 'unknown push error' }
    }
  },

  async sendToUser(
    db: D1Database,
    userId: number,
    payload: { title: string; body: string; url?: string },
    vapidPrivateKey: string
  ): Promise<{ sent: number; failed: number }> {
    const subs = await db.prepare(
      'SELECT endpoint, p256dh, auth FROM HL_pushSubscriptions WHERE userId = ? AND enabled = 1'
    ).bind(userId).all<{ endpoint: string; p256dh: string; auth: string }>()

    let sent = 0
    let failed = 0

    for (const sub of subs.results || []) {
      const result = await this.sendNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload,
        vapidPrivateKey
      )
      if (result.sent) {
        sent++
      } else {
        failed++
        // If endpoint returns 410 (gone) or 404, mark subscription as inactive
        if (result.error?.includes('Push 410') || result.error?.includes('Push 404')) {
          await db.prepare('UPDATE HL_pushSubscriptions SET enabled = 0 WHERE endpoint = ?').bind(sub.endpoint).run()
        }
      }
    }

    return { sent, failed }
  }
}
