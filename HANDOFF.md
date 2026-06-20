# HANDOFF.md — Current Resume State

This file must be updated by every agent at task start, task completion, and interruption.

## Current Status

```text
Project: HL Health Companion
Current Sprint: Sprint 1
Current Task: US-1.2.4 Client-Side Compression
Current State: In Progress
Last Completed Task: US-1.2.3 Foto atau Upload Attachment
Last Updated: 2026-06-20 12:17 UTC
```

## Current Owner

```text
Agent: Codex
Task ID: US-1.2.4
Branch: None
```

## Last Completed Work

Completed US-1.2.3 Foto atau Upload Attachment:
- Added `web/src/components/measurement/AttachmentUploader.tsx`.
- Uploader accepts JPG/PNG/WebP only, supports native camera via `capture="environment"`, and shows a local preview.
- Uploader mounts only for selected metrics where `requiresAttachment` is true.
- This task does not upload to R2 and does not persist original images.
- Updated `docs/design-system.md`.

## Required First Implementation Step

Continue Sprint 1 Measurement Input.

Recommended first task:

```text
US-1.2.4 Client-Side Compression
```

## Files Changed In Last Task

```text
docs/TASKS.md
docs/design-system.md
WORK_LOG.md
HANDOFF.md
web/src/components/measurement/DynamicMetricForm.tsx
web/src/components/measurement/AttachmentUploader.tsx
web/src/pages/measurement/SelectMetricPage.tsx
web/src/App.css
web/src/index.css
```

## Commands Run In Last Task

```text
npm --prefix web run build
npm --prefix web run lint
Mobile viewport smoke via Chrome/Playwright at 390x844
git diff --check
```

## Known Issues

```text
User/context supplied docs/PRD.docx.md and docs/PRD_UserStory.docx.md; original DOCX files currently appear deleted in git status. Do not restore them unless explicitly requested.
No known issues for US-1.1.3.
No known issues for US-1.1.4.
No known issues for US-1.2.1.
No known issues for US-1.2.2.
No known issues for US-1.2.3.
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
PRD.docx.md
PRD_UserStory.docx.md
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
