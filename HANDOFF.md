# HANDOFF.md — Current Resume State

## Current Status

```text
Project: HL Health Companion
Current Sprint: Sprint 2 (Production UAT complete)
Current Task: None (audit complete)
Current State: US-1.2.4 to US-2.5.4 fully audited and fixed
Last Completed Task: AUDIT-FIX-US1.2.4-2.5.4
Last Updated: 2026-06-20 22:10 UTC
```

## Production Deployment

```text
URL: https://hl-health-companion.indiehomesungairaya.workers.dev
Worker: hl-health-companion
D1 Database: multi_Ai_db (b80ca989-6771-427f-a656-c7ab6ffc17ce)
R2 Bucket: multi-apps-ai-bucket
Latest Deployment: 15df0b61-2caf-42e5-9802-2b887ba0c8b5
Schema: 121 HL_ tables applied
Rules: 85 metric rules seeded
E2E Tests: 35/35 PASS
```

## Audit Summary (US-1.2.4 to US-2.5.4)

All PRD compliance gaps identified and fixed:
- US-1.2.4: Client-side compression (webp 50%, max 1280px)
- US-1.2.5: Watermark with all required fields per PRD
- US-1.3.1-1.3.4: AI extract with timeout + selectedMetricCodes restriction
- US-1.4.1: Manual override flag
- US-1.4.2: Physical range validation + BP pair check
- US-1.4.3: BMI auto-calc + HeightMissingError
- US-1.5.1-1.5.3: Submit endpoint with rule engine + audit + R2 upload
- US-1.6.1: Telegram push after submit
- US-1.6.2: Dashboard today
- US-2.1.1-2.1.3: Metric rules engine with safe fallback
- US-2.2.1-2.2.3: Popups with severity sort + emergency confirmation
- US-2.3.1-2.3.4: AI recommendation with safety guardrail
- US-2.4.1-2.4.3: Weekly/monthly dashboards with trend indicator
- US-2.5.1-2.5.4: Reports + KB with 5 device articles

## Known Constraints

```text
Do not create a new D1 database.
Use D1 binding DB.
Do not create a new R2 bucket.
Use R2 binding LOGS.
Do not store original image.
Only store final compressed watermarked attachment.
AI Vision timeout: read from HL_systemConfigs (default 5000ms).
Manual override is mandatory.
Medical severity comes from HL_metricRules only.
PBKDF2 max iterations: 100000 (Cloudflare Workers limit).
HL_auditLogs uses: action, entityType, entityId, metadataJson.
HL_emergencyContacts uses: contactName, contactPhone, contactRelation.
HL_reminderSettings uses: reminderType, scheduleTime, payloadJson.
HL_familyInvites uses: inviteEmail, role, inviteTokenHash.
HL_familyLinks (not HL_familyMembers) for member relations.
HL_patternInsights uses: insightType, rangeStart, rangeEnd, summaryText, dataJson.
HL_measurementDrafts status: 'active' | 'submitted' | 'cancelled' | 'expired' (no 'pending').
HL_knowledgeArticles uses: contentMarkdown (not body).
```

## Files Agents Must Read Before Continuing

```text
AGENTS.md
TASKS.md
WORK_LOG.md
HANDOFF.md
PRD.docx.md
PRD_UserStory.docx.md
ARCHITECTURE.md
api-contract.md
schema.sql
seed.sql
design-system.md
docs/PROMPT_SPRINT_3_4.md (Prompt for executing Sprint 3 & 4)
```

## Regression Testing

```bash
API=https://hl-health-companion.indiehomesungairaya.workers.dev bash worker/scripts/e2e-uat.sh
```

Expected: 35/35 passed, 0 failed.

## Next Agent Checklist

```text
[ ] Read AGENTS.md
[ ] Read TASKS.md
[ ] Pick one task only
[ ] Mark task as [-] In Progress
[ ] Append Started log in WORK_LOG.md
[ ] Update Current Owner section in HANDOFF.md
[ ] Implement only the selected task
[ ] Run validation (typecheck, build, deploy, UAT)
[ ] Update relevant documentation
[ ] Mark task as [x] Done or [!] Blocked
[ ] Append final log in WORK_LOG.md
[ ] Update HANDOFF.md for next agent
```


**Audit Fixes Completed**: All critical bugs and anomalies identified in US-1.2.4 to US-2.5.4 have been fixed and committed.