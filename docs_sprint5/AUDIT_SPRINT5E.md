# Audit Sprint 5E — Gap & Bug Report

Berdasarkan perbandingan task plan S5E-001 sampai S5E-008, SQL schema, API contract, PRD, dan source code actual.

---

## Kesimpulan Utama

**3 dari 8 task memiliki kode (S5E-003, S5E-005, S5E-006) — kelimanya tidak sesuai API contract.**
**5 dari 8 task (S5E-001, S5E-002, S5E-004, S5E-007, S5E-008) tidak memiliki file service/test sama sekali.**

---

## 🔴 S5E-001 — Telegram Hydration Config Reader

**Lokasi:** `worker/src/services/config.ts` (inline, bukan file terpisah)

| Deliverable | Realita |
|-------------|---------|
| File `services/telegram-config.ts` | ❌ **Tidak ada** |
| Config reader method | ⚠️ Ada di `ConfigService` — `defaultSecretEnvVarName()` mapping `telegramBotToken` ke `TELEGRAM_BOT_TOKEN` |
| Return configured/masked status | ❌ **Tidak ada method** untuk return status configured/masked |
| No Telegram secret in D1 plaintext | ✅ |
| No token in logs | ✅ (tidak ada logging token) |
| Unit test config secret masking | ❌ **0 test** |

### Issues

- Tidak ada service file terpisah seperti yang ditentukan task plan (`worker/services/telegram-config.ts`)
- Tidak ada method untuk mengecek apakah Telegram bot terkonfigurasi (`isConfigured()`, `getStatus()`)
- Tidak ada masking helper untuk admin status API

---

## 🔴 S5E-002 — Telegram Callback Validation & Idempotency Service

**Lokasi:** ❌ **TIDAK ADA**

| Deliverable | Realita |
|-------------|---------|
| File `services/telegram-callback.ts` | ❌ **Tidak ada** |
| Validate secret | ❌ Tidak ada |
| Validate callback_data ADD_WATER_200/600 | ❌ Tidak ada |
| Validate chatId linked active user | ❌ Tidak ada |
| Idempotency by callback_query.id | ❌ Tidak ada |
| Callback event status recorded | ❌ Tidak ada |
| Unit tests invalid/unknown/duplicate | ❌ **0 test** |

### Dampak

Seluruh logic callback validation dan idempotency tidak diimplementasi. Webhook (S5E-003) tidak punya lapisan validasi yang benar — bisa disalahgunakan.

---

## 🔴 S5E-003 — Telegram Water Webhook — **HALLUCINATION**

**Lokasi:** `worker/src/routes-telegram.ts`

### API Contract Request:

```json
{
  "callback_query": {
    "id": "cbq_123456",
    "from": { "id": 999888777 },
    "message": { "message_id": 123, "chat": { "id": 999888777 } },
    "data": "ADD_WATER_200"
  }
}
```

### Code Expects:

```typescript
const body = await c.req.json() as { userId?: number; amountMl?: number; loggedAt?: string; notes?: string; callbackQueryId?: string }
```

### GAP Table

| API Contract Requirement | Code Reality |
|-------------------------|--------------|
| Header `X-HL-Telegram-Water-Secret` | ❌ Pakai `x-webhook-signature` — beda header |
| Parse `callback_query.id` for idempotency | ❌ Tidak parsing callback_query sama sekali |
| Duplicate check by callback ID | ❌ Tidak ada |
| Validate chatId → active HL_telegramLinks | ❌ Tidak ada |
| Validate hydration enabled + telegramQuickAddEnabled | ❌ Tidak ada |
| Insert source=telegram with telegramCallbackId | ❌ Insert tanpa telegramCallbackId |
| Recalculate total/target | ❌ Tidak ada |
| Create HL_safetyEvents if >5000ml | ❌ Tidak ada |
| Call Telegram editMessageText | ❌ Panggil answerCallbackQuery (salah) |
| Record status in HL_telegramCallbackEvents | ❌ Tidak ada |
| Response `{ success, data: { callbackQueryId, addedMl, totalMl, targetMl, ... }, meta }` | ❌ Return `{ ok: true, data: { logId } }` — envelope beda |

### Security Issues

- Webhook menerima `userId` langsung dari body — siapa pun dengan secret bisa log water untuk **user mana pun**
- `answerCallbackQuery` dipanggil TANPA validasi chatId — bisa spam callback reply ke chat sembarang
- Header secret `x-webhook-signature` — tidak ada di API contract (contract pakai `X-HL-Telegram-Water-Secret`)
- `TELEGRAM_WATER_WEBHOOK_SECRET` tidak ada di `Env` interface index.ts

---

## 🔴 S5E-004 — Telegram Message Send/Edit Service

**Lokasi:** ❌ **TIDAK ADA**

| Deliverable | Realita |
|-------------|---------|
| File `services/telegram-client.ts` | ❌ **Tidak ada** |
| `sendMessage()` helper | ❌ Tidak ada — fetch inline di route |
| `editMessageText()` helper | ❌ Tidak ada — tidak dipanggil sama sekali |
| Inline keyboard builder | ❌ Tidak ada — hardcoded di route |
| Token never logged | ⚠️ OK (tidak ada logging) |
| Timeout/retry safe | ❌ Tidak ada (`try {} catch {}` swallow) |
| Mocked client tests | ❌ **0 test** |

---

## 🟡 S5E-005 — Hydration Reminder Cron Route

**Lokasi:** `worker/src/routes-telegram.ts`

| API Contract Requirement | Code Reality |
|-------------------------|--------------|
| Header `X-HL-Internal-Cron-Secret` | ❌ Pakai `x-cron-secret` atau `authorization` |
| Body `{ runAt, dryRun }` | ❌ Tidak parsing body |
| Find users with reminderEnabled=1 | ✅ |
| Respect operating hours | ✅ |
| Require active Telegram link + telegramQuickAddEnabled | ✅ |
| Calculate today's total/target | ❌ Tidak ada — message hardcoded |
| Send inline keyboard | ✅ Tapi icon beda (`💧`/`🥤`, contract pakai `🚰`/`💧`) |
| Message with total/progress | ❌ **"Waktunya minum air!"** — tidak ada total/target |
| Record notification status | ❌ Tidak ada |
| Rate limiting | ❌ Tidak ada |
| Timezone-aware | ❌ Pakai UTC hardcode |

### Contract Message:

```
Sudahkah Anda minum air yang cukup hari ini?
Total: 1200 / 2400 ml.
```

### Code Message:

```
💧 Waktunya minum air! Catat asupan Anda.
```

---

## 🟡 S5E-006 — Telegram Hydration Settings UI Integration

**Lokasi:** `web/src/pages/telegram/TelegramSettingsPage.tsx`

| Deliverable | Realita |
|-------------|---------|
| Toggle `telegramQuickAddEnabled` | ❌ **Tidak ada** — settings pakai `telegramSubmitSummary` + `telegramEmergencyAlert` |
| Reminder settings visible when linked | ❌ Tidak ada |
| App button URL config | ❌ Tidak ada |
| User sees Telegram linked/not linked | ⚠️ Ada status chip "Code active" / "Not verified" |
| No token/secret exposed | ✅ |
| Web smoke test | ❌ **0 test** |

### Issues

- Settings page menggunakan field `telegramSubmitSummary` dan `telegramEmergencyAlert` — tidak ada di API contract Sprint 5E
- Tidak ada toggle `telegramQuickAddEnabled` yang diminta task
- Tidak ada integrasi dengan hydration settings (operating hours, reminder)
- Tidak ada indikasi di HydrationPage tentang status Telegram link

---

## 🔴 S5E-007 — Telegram Security Safety Events

**Lokasi:** ❌ **TIDAK ADA**

| Deliverable | Realita |
|-------------|---------|
| Record suspicious invalid callback | ❌ Tidak ada |
| Unknown chat security event | ❌ Tidak ada |
| No sensitive token in event metadata | ✅ (tidak ada event) |
| Rate-limited security events | ❌ Tidak ada |
| Security event tests | ❌ **0 test** |

---

## 🔴 S5E-008 — 5E Tests and Exit Gate

**Lokasi:** ❌ **TIDAK ADA**

| Test Area | Status |
|-----------|--------|
| Config secret masking | ❌ **0 test** |
| Callback validation (invalid secret, unknown chat, invalid data, duplicate) | ❌ **0 test** |
| Webhook processed/duplicate/forbidden | ❌ **0 test** |
| Telegram client (mocked) | ❌ **0 test** |
| Cron dry run, internal secret, eligible filtering | ❌ **0 test** |
| Security events | ❌ **0 test** |

**Total Telegram-related tests di sprint5-service.test.mjs: 0**

---

## 🔴 CRITICAL — Webhook Security Hole

**Lokasi:** `worker/src/routes-telegram.ts` `POST /api/webhook/telegram/water`

### Masalah

Webhook menerima `userId` langsung dari body request tanpa validasi bahwa user tersebut memiliki Telegram chat yang terdaftar:

```typescript
const body = await c.req.json() as { userId?: number; amountMl?: number; ... }
if (!body.userId || !body.amountMl) return c.json({ ok: false, error: 'userId and amountMl required' })
const logId = await HydrationService.logWater(c.env.DB, body.userId, body.amountMl, 'telegram', ...)
```

Siapa pun yang memiliki webhook secret bisa:
1. Log water untuk **user mana pun** tanpa consent
2. Tidak ada validasi chatId → user
3. Tidak ada validasi callback_query.id → replay attack bisa duplicate log

---

## Ringkasan — 1 CRITICAL + 8 Gap

```
CRITICAL 🔴  S5E-003  Webhook security hole — userId dari body tanpa validasi
                     + webhook tidak parse callback_query format Telegram
                     + envelope response beda (ok vs success)
                     + tidak ada idempotency, chat validation, overhydration check

P0 🔴  S5E-001  Config reader tidak ada file terpisah — hanya env mapping di config.ts
P0 🔴  S5E-002  Callback validation + idempotency service TIDAK ADA
P0 🔴  S5E-003  Webhook implementasi palsu — format request beda total dengan API contract
P0 🔴  S5E-004  Telegram client service TIDAK ADA — sendMessage/editMessageText inline
P0 🔴  S5E-005  Cron route tidak kirim total/target — message hardcoded
P0 🔴  S5E-006  Settings UI pakai field salah (telegramSubmitSummary) — tidak ada telegramQuickAddEnabled
P0 🔴  S5E-007  Safety events untuk Telegram TIDAK ADA
P0 🔴  S5E-008  0 test untuk seluruh Sprint 5E
```

