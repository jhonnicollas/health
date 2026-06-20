# HANDOFF.md — Current Resume State

## Current Status

```text
Project: HL Health Companion
Current Sprint: Sprint 2
Current Task: US-2.1.1 Seed Metric Rules dari CSV
Current State: Sprint 1 Done, deployed to production, UAT passed
Last Completed Task: US-1.6.2 Dashboard Hari Ini
Last Updated: 2026-06-20 20:55 UTC
```

## Current Owner

```text
Agent: Caveman
Task ID: US-2.1.1
Branch: None
```

## Production Deployment

```text
URL: https://hl-health-companion.indiehomesungairaya.workers.dev
Worker: hl-health-companion
D1 Database: multi_Ai_db (b80ca989-6771-427f-a656-c7ab6ffc17ce)
R2 Bucket: multi-apps-ai-bucket
Schema: Applied (121 HL_ tables)
Seed: Applied (114 changes, 84 metric rules)
```

## Sprint 1 UAT Results

```text
✓ POST /api/auth/register (200, user created)
✓ POST /api/auth/login (200, session set)
✓ GET /api/auth/me (200, user info)
✓ POST /api/profile/onboarding (200, profileId returned)
✓ POST /api/measurements/validate valid BP (200, valid:true)
✓ POST /api/measurements/validate invalid BP (200, valid:false, INVALID_PAIR)
✓ POST /api/measurements/submit (201, rule engine applied, 3 values saved)
✓ GET /api/dashboard/today (200, 3 metrics, 1 session)
```

## Required Next Step

Start Sprint 2 - Metric Rules Engine and AI Recommendations.

```text
US-2.1.1 Seed Metric Rules dari CSV
```

## Known Constraints

```text
Do not create a new D1 database.
Use D1 binding DB.
Do not create a new R2 bucket.
Use R2 binding LOGS.
Do not store original image.
Only store final compressed watermarked attachment.
AI Vision timeout must be 5000 ms (or read from HL_systemConfigs).
Manual override is mandatory.
Medical severity comes from HL_metricRules only.
PBKDF2 max iterations: 100000 (Cloudflare Workers limit).
HL_auditLogs uses: action, entityType, entityId, metadataJson (not targetType/targetId/metadata).
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
seed-rules.generated.sql
design-system.md
```

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
