# WHATSAPP_BAILEYS_ARCHITECTURE.md — iSehat / iSehat Sprint 6
## WhatsApp AI via Baileys — Architecture Specification

```text
Document Type      : Architecture Specification
Version            : 1.0
Date               : 2026-06-30
Source of Truth    : docs_sprint6/01.PRD_S6_AI_CLINICAL_COPILOT.md §8.8, §6.1 (Worker #4)
Phase              : Sprint 6G
Workers Involved   : #1 (isehat-api-worker), #2 (isehat-ai-worker), #3 (isehat-jobs-worker), #4 (isehat-webhooks-worker)
External Runtime   : VPS running Node.js 22+ with Baileys library via Docker + PM2
```

---

# 1. Architecture Overview

```
┌──────────────────┐
│  WhatsApp User   │
│  (Phone App)     │
└────────┬─────────┘
         │ WhatsApp Cloud API
         ▼
┌──────────────────────────────────────┐
│  VPS (Docker + PM2, Node.js 22+)     │
│  Baileys Gateway                     │
│  ┌─────────────────────────────┐     │
│  │ baileys-wa-socket           │     │
│  │ (WhatsApp Web protocol)     │     │
│  ├─────────────────────────────┤     │
│  │ Inbound Handler             │     │
│  │ → POST /api/whatsapp/webhook│     │
│  ├─────────────────────────────┤     │
│  │ Outbound Consumer           │     │
│  │ ← Cloudflare Queue          │     │
│  │ → baileys.sendMessage       │     │
│  ├─────────────────────────────┤     │
│  │ Health Check Endpoint       │     │
│  │ GET / (every 60s)           │     │
│  └─────────────────────────────┘     │
└────────┬─────────────────────────────┘
         │ HTTPS via Cloudflare Tunnel
         │ Auth: WA_GATEWAY_SECRET header
         ▼
┌──────────────────────────────────────┐
│  isehat-webhooks-worker (#4)         │
│  ┌─────────────────────────────┐     │
│  │ Signature Validation        │     │
│  │ (WA_GATEWAY_SECRET)         │     │
│  ├─────────────────────────────┤     │
│  │ Idempotency Check           │     │
│  │ (providerMessageId UNIQUE)  │     │
│  ├─────────────────────────────┤     │
│  │ User Lookup                 │     │
│  │ (whatsappNumberHash)        │     │
│  ├─────────────────────────────┤     │
│  │ Linked → Forward to #2      │     │
│  │ Unlinked → Link instruction │     │
│  ├─────────────────────────────┤     │
│  │ Media → R2 (after validate) │     │
│  └─────────────────────────────┘     │
└────────┬─────────────────────────────┘
         │ Service Binding (AI_SERVICE)
         ▼
┌──────────────────────────────────────┐
│  isehat-ai-worker (#2)               │
│  ┌─────────────────────────────┐     │
│  │ WhatsAppSessionDO           │     │
│  │ wa-session:{whatsappLinkId} │     │
│  │ (message ordering + dedup)  │     │
│  ├─────────────────────────────┤     │
│  │ Clinical Orchestrator       │     │
│  │ (same as web: intent →      │     │
│  │  red flag → context →       │     │
│  │  prompt → ModelRouter →     │     │
│  │  Safety Runtime → format)   │     │
│  ├─────────────────────────────┤     │
│  │ Response → Queue            │     │
│  │ (whatsapp-outbound)         │     │
│  └─────────────────────────────┘     │
└────────┬─────────────────────────────┘
         │ Cloudflare Queue (whatsapp-outbound)
         ▼
┌──────────────────────────────────────┐
│  isehat-jobs-worker (#3)             │
│  ┌─────────────────────────────┐     │
│  │ Queue Consumer               │     │
│  │ (whatsapp-outbound)          │     │
│  │ → POST to VPS Baileys        │     │
│  │   /api/whatsapp/outbound/send│     │
│  └─────────────────────────────┘     │
└────────┬─────────────────────────────┘
         │ HTTPS
         ▼
┌──────────────────────────────────────┐
│  VPS Baileys Gateway                 │
│  → baileys.sendMessage()             │
│  → WhatsApp Cloud API                │
│  → User receives reply               │
└──────────────────────────────────────┘
```

---

# 2. VPS Deployment Specification

## 2.1 Runtime Stack

```text
OS              : Ubuntu 22.04 LTS (or Debian 12)
Node.js         : 22.x LTS
Process Manager : PM2 (auto-restart, log rotation)
Containerization: Docker Compose
Reverse Proxy   : Cloudflare Tunnel (no open ports)
```

## 2.2 Docker Compose Configuration

```yaml
version: '3.8'
services:
  baileys-gateway:
    build: .
    container_name: isehat-baileys
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - WEBHOOK_URL=https://webhooks.isehat.biz.id/api/whatsapp/webhook
      - WEBHOOK_SECRET=${WA_GATEWAY_SECRET}
      - OUTBOUND_LISTEN_PORT=3001
      - HEALTH_CHECK_PORT=3002
      - QR_DISPLAY_MODE=file
      - QR_FILE_PATH=/app/qr/latest.png
    volumes:
      - ./auth:/app/auth          # Baileys auth session persistence
      - ./qr:/app/qr              # QR code for initial pairing
      - ./logs:/app/logs          # PM2 + app logs
    ports:
      - "127.0.0.1:3001:3001"     # Outbound listener (local only)
      - "127.0.0.1:3002:3002"     # Health check (local only)
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/health"]
      interval: 60s
      timeout: 10s
      retries: 3
```

## 2.3 PM2 Configuration

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'isehat-baileys',
    script: 'dist/index.js',
    instances: 1,           // Single instance — Baileys is stateful
    exec_mode: 'fork',
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000
  }]
};
```

## 2.4 Baileys Library

```text
Library      : @whiskeysockets/baileys (or @adiwajshing/baileys)
Version      : latest stable (6.x+)
Protocol     : WhatsApp Web multi-device
Auth Method  : QR code pairing (initial) → session persistence (subsequent)
Session Store: file-based (./auth/) — persisted across restarts
```

## 2.5 Directory Structure (VPS)

```
/opt/isehat-baileys/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── ecosystem.config.cjs
├── src/
│   ├── index.ts          # Main entry: Baileys socket + handlers
│   ├── inbound.ts        # Inbound message handler → POST to #4
│   ├── outbound.ts       # HTTP server for outbound messages from #3
│   ├── health.ts         # Health check endpoint
│   └── qr.ts             # QR code display/refresh
├── auth/                 # Baileys session credentials (persisted)
├── qr/                   # Latest QR code image
├── logs/                 # PM2 + app logs
└── .env                  # WA_GATEWAY_SECRET + URLs
```

---

# 3. Inbound Flow (WhatsApp → Worker)

## 3.1 Baileys Inbound Handler

```typescript
// src/inbound.ts (pseudocode)
import makeWASocket from '@whiskeysockets/baileys';
import { useMultiFileAuthState } from '@whiskeysockets/baileys';

async function startBaileys() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    qrTimeout: 60000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue; // Skip own messages

      const payload = normalizeMessage(msg);

      // Forward to Worker #4 via HTTPS
      await fetch(process.env.WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Secret': process.env.WEBHOOK_SECRET,
        },
        body: JSON.stringify(payload),
      });
    }
  });

  sock.ev.on('connection.update', ({ connection, qr }) => {
    if (qr) saveQRImage(qr);     // Save QR for admin to scan
    if (connection === 'close') reconnect(); // Auto-reconnect
  });
}
```

## 3.2 Normalized Inbound Payload

```json
{
  "providerMessageId": "wamid.XYZ123...",
  "whatsappNumber": "+628123456789",
  "messageType": "text",
  "textContent": "saya pusing sejak pagi",
  "mediaUrl": null,
  "mediaMimeType": null,
  "timestamp": "2026-07-01T08:00:00Z",
  "isGroupMessage": false
}
```

For media messages:
```json
{
  "providerMessageId": "wamid.ABC456...",
  "whatsappNumber": "+628123456789",
  "messageType": "image",
  "textContent": null,
  "mediaUrl": "https://mmg.whatsapp.net/...",
  "mediaMimeType": "image/jpeg",
  "timestamp": "2026-07-01T08:01:00Z",
  "isGroupMessage": false
}
```

---

# 4. Outbound Flow (Worker → WhatsApp)

## 4.1 Outbound HTTP Server (VPS)

```typescript
// src/outbound.ts (pseudocode)
import express from 'express';
import { getSocket } from './index';

const app = express();
app.use(express.json());

// Auth: verify WA_GATEWAY_SECRET from #3
app.use((req, res, next) => {
  if (req.headers['x-gateway-secret'] !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// POST /api/whatsapp/outbound/send
app.post('/api/whatsapp/outbound/send', async (req, res) => {
  const { whatsappNumber, textContent, providerMessageId } = req.body;

  try {
    const sock = getSocket();
    const jid = whatsappNumber.replace(/\D/g, '') + '@s.whatsapp.net';

    await sock.sendMessage(jid, { text: textContent });

    res.json({ success: true, providerMessageId });
  } catch (err) {
    console.error('Outbound send failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(process.env.OUTBOUND_LISTEN_PORT || 3001);
```

## 4.2 Outbound Queue Consumer (#3)

```text
1. #2 produces message to Cloudflare Queue "whatsapp-outbound"
2. #3 consumer receives batch (max 10, timeout 5s)
3. For each message:
   a. POST to VPS: https://baileys-vps.internal/api/whatsapp/outbound/send
   b. Headers: X-Gateway-Secret: {WA_GATEWAY_SECRET}
   c. Body: { whatsappNumber, textContent, providerMessageId }
4. If VPS returns 200 → mark HL_whatsappMessages.processedStatus='completed'
5. If VPS returns error → retry (max 3, exponential backoff)
6. If all retries fail → mark processedStatus='failed', log to HL_auditLogs
```

---

# 5. Worker #4 — isehat-webhooks-worker

## 5.1 Wrangler Configuration

```toml
name = "isehat-webhooks-worker"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "DB"
database_name = "isehat_db"
database_id = "d777e991..."

[[r2_buckets]]
binding = "LOGS"
bucket_name = "multi-apps-ai-bucket"

[[services]]
binding = "API_SERVICE"
service = "isehat-api-worker"

[[services]]
binding = "AI_SERVICE"
service = "isehat-ai-worker"

[[services]]
binding = "JOBS_SERVICE"
service = "isehat-jobs-worker"

[vars]
# WA_GATEWAY_SECRET set via: wrangler secret put WA_GATEWAY_SECRET
```

## 5.2 Webhook Endpoints

| Method | Path | Auth | Forward To | Purpose |
|---|---|---|---|---|
| POST | /api/whatsapp/webhook | X-Gateway-Secret header | #2 (AI_SERVICE) | Inbound WA message |
| POST | /api/whatsapp/media/ingest | X-Gateway-Secret header | R2 + #2 | WA media upload |
| GET | /api/whatsapp/health | CRON_SECRET | — | Gateway health check |
| POST | /api/telegram/webhook | Bot token validation | #1 (API_SERVICE) | Telegram update |
| POST | /api/billing/webhook/xendit | Xendit signature | #1 (API_SERVICE) | Payment webhook |

## 5.3 Signature Validation

```typescript
// Worker #4 pseudocode
function validateGatewaySecret(request: Request): boolean {
  const secret = request.headers.get('X-Gateway-Secret');
  if (!secret) return false;
  // Timing-safe comparison
  return timingSafeEqual(secret, env.WA_GATEWAY_SECRET);
}

app.post('/api/whatsapp/webhook', async (c) => {
  if (!validateGatewaySecret(c.req.raw)) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED' } }, 401);
  }
  // ... process webhook
});
```

## 5.4 User Lookup (whatsappNumberHash)

```text
1. Extract whatsappNumber from inbound payload
2. Compute SHA-256 hash: whatsappNumberHash = sha256(whatsappNumber)
3. Query: SELECT * FROM HL_whatsappLinks WHERE whatsappNumberHash = ? AND verified = 1
4. If found + aiEnabled = 1 → forward to #2 (linked user)
5. If found + aiEnabled = 0 → respond "AI dinonaktifkan. Kirim START AI untuk mengaktifkan."
6. If found + verified = 0 → respond "Akun belum diverifikasi. Buka aplikasi iSehat untuk verifikasi."
7. If not found → respond linking instruction (unlinked flow)
```

## 5.5 Idempotency

```text
1. Extract providerMessageId from inbound payload
2. Query: SELECT id FROM HL_whatsappMessages WHERE providerMessageId = ?
3. If exists → return 200 OK (no processing) — duplicate delivery
4. If not exists → INSERT row, continue processing
5. providerMessageId has UNIQUE constraint in D1
6. Race condition: INSERT OR IGNORE handles concurrent duplicates
```

---

# 6. WhatsAppSessionDO — Message Ordering

## 6.1 Purpose

```text
Ensure messages from the same WhatsApp number are processed sequentially.
Prevent out-of-order AI responses and duplicate clinical sessions.
```

## 6.2 DO Class

```typescript
// isehat-ai-worker (pseudocode)
export class WhatsAppSessionDO {
  constructor(private state: DurableObjectState) {
    this.state.blockConcurrencyWhile(async () => {
      // Restore state on restart
    });
  }

  // Called by Clinical Orchestrator for each inbound message
  async processMessage(message: InboundMessage): Promise<OutboundResponse> {
    // Serialize processing — one message at a time per whatsappLinkId
    return this.processSequentially(message);
  }

  private async processSequentially(message: InboundMessage): Promise<OutboundResponse> {
    // 1. Check if previous message still processing (queue)
    // 2. Wait for queue to clear
    // 3. Process this message through Clinical Orchestrator
    // 4. Return response
    // 5. Release queue for next message
  }
}
```

## 6.3 DO ID Pattern

```text
wa-session:{whatsappLinkId}
```

Each linked WhatsApp number gets its own DO instance. Messages from different numbers are processed in parallel (different DOs). Messages from the same number are serialized (same DO).

---

# 7. Media Handling

## 7.1 Inbound Media Flow

```text
1. Baileys receives image/document from WhatsApp
2. Baileys downloads media to VPS temp storage
3. Baileys POSTs to #4 /api/whatsapp/media/ingest with:
   - mediaUrl (Baileys local URL or base64)
   - mediaMimeType
   - whatsappNumber
   - providerMessageId
4. #4 validates:
   - Signature (WA_GATEWAY_SECRET)
   - File size < 10MB
   - MimeType in allowed list (image/jpeg, image/png, application/pdf)
5. #4 stores to R2: wa-media/{whatsappLinkId}/{providerMessageId}.{ext}
6. #4 records mediaR2Key in HL_whatsappMessages
7. #4 forwards to #2 for AI processing (if vision needed)
```

## 7.2 No Public Media URL

```text
- R2 objects are private by default
- No public read URL generated
- Media only accessible via Worker permission check
- Original photo NOT stored unless specific future consent + legal review
```

---

# 8. WhatsApp Linking Flow

## 8.1 Link Start

```text
1. User opens: Settings > WhatsApp AI > Hubungkan
2. Frontend: POST /api/whatsapp/link/start
   Body: { whatsappNumber: "+628123456789" }
3. #1 validates:
   - User has entitlement feature.aiClinicalCopilot.whatsapp
   - Number format valid (E.164)
   - Number not already linked to another user
4. #1 sends OTP to WhatsApp number (via Baileys gateway)
5. #1 creates HL_whatsappLinks row:
   - whatsappNumberEncrypted (AES-256)
   - whatsappNumberHash (SHA-256)
   - verified = 0
   - aiEnabled = 0
6. Response: { linkId, otpSent: true }
```

## 8.2 Link Verify

```text
1. Frontend: POST /api/whatsapp/link/verify
   Body: { linkId, otpCode: "123456" }
2. #1 verifies OTP (6-digit, rate limited)
3. If valid:
   - HL_whatsappLinks.verified = 1
   - HL_whatsappLinks.aiEnabled = 1
   - HL_whatsappLinks.consentAcceptedAt = now()
4. Response: { success: true, linked: true }
5. User can now send messages via WhatsApp to get AI responses
```

## 8.3 Unlink

```text
1. Frontend: DELETE /api/whatsapp/link
2. #1 deletes HL_whatsappLinks row (or sets verified=0, aiEnabled=0)
3. Any existing WhatsAppSessionDO for this linkId is destroyed
4. Subsequent messages from this number → unlinked flow
```

---

# 9. STOP AI / START AI Commands

## 9.1 STOP AI

```text
1. User sends: "STOP AI" or "STOP"
2. #4 forwards to #2
3. #2 detects command (case-insensitive, trimmed)
4. #2 sets: HL_whatsappLinks.aiEnabled = 0
5. #2 responds: "AI iSehat dinonaktifkan. Kirim START AI untuk mengaktifkan kembali."
6. Subsequent messages: "AI dinonaktifkan. Kirim START AI untuk mengaktifkan."
```

## 9.2 START AI

```text
1. User sends: "START AI" or "START"
2. #4 forwards to #2
3. #2 detects command
4. #2 checks: link verified = 1? If not → linking instruction
5. If verified: HL_whatsappLinks.aiEnabled = 1
6. #2 responds: "AI iSehat diaktifkan. Anda dapat bertanya tentang kesehatan Anda."
7. Subsequent messages: normal AI flow
```

---

# 10. Unlinked Number Flow

```text
1. Unknown number sends message to WhatsApp bot
2. #4 looks up whatsappNumberHash → no match in HL_whatsappLinks
3. #4 inserts HL_whatsappMessages:
   - userId = NULL
   - whatsappLinkId = NULL
   - processedStatus = 'ignored_unlinked'
4. #4 responds (via outbound queue):
   "Selamat datang di iSehat. Untuk menghubungkan akun WhatsApp Anda,
    buka aplikasi iSehat > Settings > WhatsApp AI > Hubungkan."
5. NO clinical data, NO diagnosis, NO P3K returned.
```

---

# 11. WhatsApp Response Format

## 11.1 Normal Response

```text
[length: max whatsappAi.maxReplyChars (default 400 chars)]

Berdasarkan data Anda, tekanan darah 145/95 termasuk tinggi.
Kemungkinan penyebab: stres, kurang olahraga, atau pola makan.
Pertanyaan: Apakah Anda mengalami sakit kepala?
Buka aplikasi untuk detail lengkap.

⚕️ AI bisa salah. Keputusan = tanggung jawab Anda.
```

## 11.2 Emergency Response

```text
[length: < 400 chars]

⚠️ PERINGATAN DARURAT
Nyeri dada + tekanan darah tinggi = tanda bahaya.
JANGAN menunda. Segera hubungi:
- Layanan Darurat: 119 / 112
- Faskes terdekat

⚕️ AI bisa salah. Keputusan = tanggung jawab Anda.
```

## 11.3 First Aid Response

```text
[length: < 400 chars]

P3K Luka Ringan:
1. Cuci tangan
2. Bersihkan luka dengan air mengalir
3. Tutup dengan perban steril
⚠️ Cari bantuan jika: perdarahan > 10 menit, luka dalam

⚕️ AI bisa salah. Keputusan = tanggung jawab Anda.
```

---

# 12. Failover & Monitoring

## 12.1 Health Check

```text
- Worker #4 polls VPS GET /api/whatsapp/health every 5 minutes
- If VPS unreachable for 3 consecutive checks → admin alert
- VPS auto-restart via PM2 on crash (max 10 restarts, 5s delay)
- Docker auto-restart: unless-stopped policy
```

## 12.2 Reconnection Strategy

```text
- Baileys auto-reconnects on connection.close event
- If QR expires → new QR generated, admin notified
- If auth session corrupted → full re-pair required (admin scans new QR)
- Max reconnect attempts: unlimited (with 5s delay between)
```

## 12.3 Queue Failure Handling

```text
- If outbound queue consumer (#3) cannot reach VPS:
  - Retry 3 times with exponential backoff (1s, 4s, 16s)
  - If all fail → mark HL_whatsappMessages.processedStatus='failed'
  - Log to HL_auditLogs
  - Admin can manually retry from dashboard
```

---

# 13. Security Checklist

```text
[ ] WA_GATEWAY_SECRET stored in Cloudflare Secrets (not in D1, code, or .env committed to git)
[ ] VPS .env file is gitignored
[ ] Cloudflare Tunnel used (no open ports on VPS)
[ ] All webhook endpoints validate signature before processing
[ ] Idempotency enforced via providerMessageId UNIQUE constraint
[ ] Media validated (size, mimeType) before R2 storage
[ ] No public R2 URL for media
[ ] whatsappNumber stored encrypted (AES-256) + hashed (SHA-256) for lookup
[ ] Unlinked numbers receive NO clinical data
[ ] STOP AI command immediately disables AI for that number
[ ] Rate limit: 100 inbound/minute per number
[ ] VPS health monitored by Worker #4 every 5 minutes
```
