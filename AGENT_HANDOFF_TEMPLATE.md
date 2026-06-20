# AGENT_HANDOFF_TEMPLATE.md

Copy this template into `HANDOFF.md` when pausing, completing, or handing off a task.

---

## Current Status

```text
Project: HL Health Companion
Current Sprint: Sprint {number}
Current Task: {taskId} — {taskName}
Current State: Not Started | In Progress | Blocked | Needs Review | Ready for Next Task
Last Completed Task: {taskId or None}
Last Updated: YYYY-MM-DD HH:mm UTC
```

## Current Owner

```text
Agent: {agentName}
Task ID: {taskId}
Branch: {branchName}
```

## Files Read

```text
AGENTS.md
TASKS.md
WORK_LOG.md
HANDOFF.md
{other files}
```

## Files Changed

```text
path/to/file1
path/to/file2
```

## Commands Run

```bash
npm run typecheck
npm run test
npm run build
wrangler d1 execute multi_Ai_db --file=./schema.sql
```

## Validation Result

```text
Passed:
- item

Failed:
- item

Not run:
- item and reason
```

## Current Implementation Notes

```text
What was implemented:
- item

Important decisions:
- item
```

## Known Issues

```text
Issue:
Impact:
Suggested fix:
```

## Resume Instructions for Next Agent

```text
Start here:
1. Open file ...
2. Continue from function/component ...
3. Run command ...
```

## Required Next Documentation Updates

```text
[ ] TASKS.md
[ ] WORK_LOG.md
[ ] api-contract.md
[ ] ARCHITECTURE.md
[ ] design-system.md
[ ] schema.sql
[ ] seed.sql
```
