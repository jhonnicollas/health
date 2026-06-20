# HANDOFF.md — Current Resume State

This file must be updated by every agent at task start, task completion, and interruption.

## Current Status

```text
Project: HL Health Companion
Current Sprint: Sprint 1
Current Task: None assigned
Current State: Ready for implementation
Last Completed Task: DOC-README (Created root README.md)
Last Updated: 2026-06-20 09:30 UTC
```

## Current Owner

```text
Agent: None
Task ID: None
Branch: None
```

## Last Completed Work

Completed document audit, DB configuration updates, and workspace configuration:
- Added root `README.md` containing tech stack, structure, configurations, and protocols.
- Added missing `profileId` to API validate endpoint, and maxFileSize to AI extract endpoint limit.
- Added `/api/measurements/sync` for PWA offline drafts and R2 orphan cleanup cron job.
- Cleaned schema.sql to be DDL-only and added missing metric rules to seed.sql.
- Configured monorepo with `web` and `worker` workspaces.

## Required First Implementation Step

Start Sprint 1 Auth and User Profile.

Recommended first task:

```text
US-1.1.1 Register User
```


## Known Constraints

```text
Do not create a new D1 database.
Use D1 binding DB.
Do not create a new R2 bucket.
Use R2 binding LOGS.
Do not store original image.
Only store final compressed watermarked attachment.
AI Vision timeout must be 5000 ms.
Manual override is mandatory.
Medical severity comes from HL_metricRules only.
```

## Files Agents Must Read Before Continuing

```text
AGENTS.md
agent.ai
TASKS.md
WORK_LOG.md
HANDOFF.md
PRD.docx
PRD_UserStory.docx
ARCHITECTURE.md
api-contract.md
schema.sql
seed.sql
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
[ ] Run validation
[ ] Update relevant documentation
[ ] Mark task as [x] Done or [!] Blocked
[ ] Append final log in WORK_LOG.md
[ ] Update HANDOFF.md for next agent
```
