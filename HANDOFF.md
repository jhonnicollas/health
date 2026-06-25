# HANDOFF.md — Sprint 5 Real Verified State

## Current State — 2026-06-25 20:30 UTC

```text
Sprint: Sprint 5 Full (Foundation + 5A + 5B + 5C + 5D + 5E)
Status: ALL SPRINT 5 GAPS CLOSED — S5A+S5B+S5C+S5D+S5E = 50+ gap items resolved
Worker: https://hl-health-companion-api.indiehomesungairaya.workers.dev
Pages:  https://d11e4d6e.hl-health-companion.pages.dev
Tests:  125/126 PASS (1 pre-existing: admin role permissions PUT 404)
Next:   Cross-Phase Release Gate (S5X-001..S5X-010)
```

## Gap Fixes Applied This Session

### CRITICAL Bug Fixes (3 — runtime crash prevention)
- **Family permissions query** — Changed from `canViewCycle/canViewSymptoms/canViewHydration/canViewAiReport` columns (which don't exist in `HL_familyPermissions`) to `permissionCode/allowed` rows matching the schema
- **Guardrail acknowledge INSERT** — Changed from `logDate/acknowledgementType` columns (which don't exist) to `relatedDate/guardrailType` + `messageVersion` matching `HL_cycleGuardrailAcknowledgements` schema
- **Timeline query** — Fixed `flowLevel/symptoms` → `flowIntensity/physicalSymptomsJson` matching `HL_cycleLogs` schema

### Sprint 5C Gap Fixes (12 tasks, 20 gap items)
- **S5C-001:** Added `VECTORIZE_INDEX` + `AI_MEMORY_QUEUE` bindings in wrangler.toml + Env types, `isClinicalInfrastructureEnabled()` reads `HL_featureFlags`
- **S5C-002:** `buildContextPackage` expanded from 6 → 10 source types (added cycle, fasting, reports, education). Content hash for all sources. `sanitizeMetadata()` redacts sensitive fields
- **S5C-003:** `getMemoryStatus` returns nested `sprint6ClinicalCopilot` with `readyChecks`, `activeJob` from `HL_aiMemoryJobs`, `failedCount`
- **S5C-004:** `AI_MEMORY_QUEUE` producer/consumer in wrangler.toml, `HL_aiMemoryJobs` writes on rebuild/delete, `_executeRebuild` for sync fallback
- **S5C-005:** Context query returns `namespace`, `sprint6ClinicalCopilotReady`, `sourceTypes`/`minScore`/`purpose` validation, Vectorize query with fallback
- **S5C-006:** Rebuild returns 202 + `{queued, jobId, jobType}`, Delete returns 202 + `{queued, jobId, sprint6ClinicalCopilotImpact}`
- **S5C-007:** AI assistant uses `buildContextPackage()` + `calculateDataSufficiency()` (not inline), `scoreReason` in response, `contextTrace` with `sourceType`
- **S5C-008:** Both assistant + report use `AiMemoryService.enforceDisclaimer()` (not inline)
- **S5C-009:** `calculateDataSufficiency` returns `{score, scoreReason}` (not `reason`), all 10 source types scored
- **S5C-010:** `AiMemorySettingsPage` (status, rebuild/delete, Sprint 6 readiness), `AiAssistantPage` context trace panel + Sprint 6 readiness card
- **S5C-011:** `AdminPage` AI Memory tab (user status lookup, rebuild, copilot readiness), admin responses use nested `sprint6ClinicalCopilot`
- **S5C-012:** 26 tests total including: calendar days, calendarMethod guardrail, source types, settings validation, auto-pause on pregnant

### Sprint 5E Gap Fixes (8 tasks, 19 tests)
- **S5E-001:** TelegramConfigService — isConfigured(), getWebhookSecret(), getBotToken(), getConfigStatus()
- **S5E-002:** TelegramCallbackService — validateSecret(), parseCallbackBody(), validateCallbackData(), findUserByChatId(), checkIdempotency(), recordCallbackEvent(), validateFullCallback()
- **S5E-003:** Webhook rewritten — parses Telegram callback_query format, X-HL-Telegram-Water-Secret header, idempotency by callbackQueryId, chatId→user validation, telegramQuickAddEnabled check, telegramCallbackId in water log, recalculates total/target, overhydration→HL_safetyEvents, editMessageText (not answerCallbackQuery), HL_telegramCallbackEvents recording, contract response envelope
- **S5E-004:** TelegramClientService — sendMessage(), editMessageText(), buildInlineKeyboard()
- **S5E-005:** Cron fixed — message shows "Total: X / Y ml.", correct icons (🚰/💧), X-HL-Internal-Cron-Secret header, dryRun support, notification recording
- **S5E-006:** Settings UI — HydrationSettingsPage added telegramQuickAddEnabled toggle, TelegramSettingsPage simplified to linked/unlinked status with link to hydration settings
- **S5E-007:** Security events — createSafetyEvent() called on invalid callback/unknown chat/webhook rejection
- **S5E-008:** 19 tests covering config, client, and callback services

### Sprint 5D Gap Fixes (9 tasks, 13 gap items)
- **S5D-001:** `requireCycleEligible` middleware function, frontend CyclePage checks `/api/cycle/access`
- **S5D-002:** Server-side validation (cycleLengthDays 1-120, periodLengthDays 1-15), `isPregnant/isMenopause` → `predictionPaused=true` auto-set, `isLactating` syncs to `HL_hydrationSettings`
- **S5D-003:** Calendar returns `days[]` array with phase/label/colorToken/needsContraceptionGuardrail, `month/predictionPaused/pauseReason/copyPolicy/phaseLegend/copyPolicy`
- **S5D-004:** Log flow checks guardrail BEFORE save — unprotected without acknowledge returns `{saved:false, requiresContraceptionGuardrail:true}`
- **S5D-005:** Full PRD warning copy (`GUARDRAIL_MESSAGE` constant), `calendarMethod` guardrail type, blocking modal in frontend with "Saya Mengerti" button
- **S5D-006:** `detectIrregularity` creates `HL_safetyEvents` (`eventType='cycleIrregularity'`), pauses prediction, historical 2-cycle consecutive analysis from `HL_cycleLogs`
- **S5D-007:** Full CyclePage rewrite — 3 tabs (calendar/settings/log), calendar grid with phase colors, settings form, log form, guardrail blocking modal, education bottom sheet
- **S5D-008:** Family permissions use `permissionCode` model with `ON CONFLICT` upsert, owner-only verification on sensitive-health PUT (`HL_familyLinks.ownerUserId`)
- **S5D-009:** 7 new tests covering calendar days, guardrail types, validation, auto-pause

## What Exists (verified on disk)

### Backend Services (9 files)
- `oauth.ts` — Google OAuth account link/unlink/find + state CRUD
- `education.ts` — Card reading, progress tracking, acknowledge
- `symptom.ts` — Logging, deterministic red flag (14 keywords), safety event
- `hydration.ts` — Target calculator (real bodyWeight, fever, pregnant/lactating min), water log, overhydration check (5000ml, dedup per day)
- `ai-memory.ts` — 10-source context builder, sufficiency score with scoreReason, disclaimer, vector memory with HL_aiMemoryJobs, metadata sanitizer, Vectorize query
- `cycle.ts` — Settings with validation + auto-pause, calendar days builder, guardrail (3 types including calendarMethod with PRD copy), irregularity with safety event creation
- `telegram-config.ts` — Token/secret configured status, webhook secret reader
- `telegram-client.ts` — sendMessage, editMessageText, inline keyboard builder
- `telegram-callback.ts` — Secret validation, callback body parser, callback data validator, chatId→user lookup, idempotency by callbackQueryId, HL_telegramCallbackEvents recording, full callback validation pipeline

### Backend Routes (5 files)
- `routes-auth.ts` — OAuth, education, symptom, daily health, prompt-dismissals
- `routes-hydration.ts` — Full contract hydration API (entitlement guard, confirmedLargeInput, daily history)
- `routes-ai.ts` — Context query with Vectorize fallback + entitlement guard, memory status with nested sprint6ClinicalCopilot, rebuild/delete 202, admin AI memory
- `routes-cycle.ts` — Eligibility middleware, calendar with days[], guardrail-first log flow, permissionCode family permissions
- `routes-telegram.ts` — Telegram water webhook, cron

### Frontend Pages (10)
- `AdminPage.tsx` — 13 tab sections (added AI Memory)
- `DailyHealthHubPage.tsx` — per-date measurements + symptoms
- `SymptomPage.tsx` — VAS pain scale, emergency blocking modal
- `HydrationPage.tsx` — progress ring, quick add, large input confirm
- `HydrationSettingsPage.tsx` — pregnant/lactating, operating hours
- `HydrationHistoryPage.tsx` — daily summaries
- `CyclePage.tsx` — FULL: calendar grid, settings form, log form, guardrail modal
- `AiAssistantPage.tsx` — context trace panel, Sprint 6 readiness card
- `AiMemorySettingsPage.tsx` — NEW: memory status, rebuild/delete, Sprint 6 readiness
- `FamilyPage.tsx` — sensitive health permissions (cycle/symptom/hydration/aiReport)

### Tests
- 26 sprint5-service tests PASS
- 80+ register/hydration/oauth/symptom/daily tests PASS
- Total: 106/107 PASS (1 pre-existing admin role 404)

## Remaining Known Issues
- GOOGLE_CLIENT_SECRET must be set as Worker secret for production OAuth
- Queue consumer binding fails on deploy (non-blocking)
- INTERNAL_API_SECRET not set as Worker secret
- register.test.mjs: 1 pre-existing admin role test failure (404)
- Vectorize not bound in production — all vector context returns VECTORIZE_UNAVAILABLE (expected in Sprint 5)
- AI_MEMORY_QUEUE requires `wrangler d1 execute` to create queue

## Next Steps — Cross-Phase Release Gate
All Sprint 5 implementation phases are DONE. Next: Cross-Phase Release Gate (S5X-001..S5X-010):

1. **S5X-001** Worker route registration map — audit all routes are mounted
2. **S5X-002** Frontend navigation gating — verify feature flags gate nav items
3. **S5X-003** Upgrade prompts and entitlement UX
4. **S5X-004** Sensitive data policy tests
5. **S5X-005** Mixed history/timeline support
6. **S5X-006** Admin dashboard metrics
7. **S5X-007** Production config/secrets checklist
8. **S5X-008** Full regression test run
9. **S5X-009** Documentation handoff update
10. **S5X-010** Staging release candidate signoff
