# current-task.md — iSehat Content Engine CE-1

```text
Sprint: CE1.3 Safety, Approval, Export & Dashboard
Phase: 8 — Safety Check and Source Trace
Status: IN_PROGRESS
Current Task: CE1-T082 — Source Reference API
Next Task: CE1-T090 — Approval Queue endpoint
Updated: 2026-07-02
```

## CE1.2 Core Content & AI — DONE

All CE1.2 tasks are complete:

- CE1-T040 — Brand Memory API ✓
- CE1-T041 — Content Pillars API ✓
- CE1-T042 — Campaign API ✓
- CE1-T050 — AI Config API ✓
- CE1-T051 — Prompt Version API ✓
- CE1-T052 — PromptContextBuilder ✓
- CE1-T053 — AI Provider abstraction + MockProvider ✓
- CE1-T054 — AI Job, Idempotency, Usage, and Quota services ✓
- CE1-T060 — Idea Generator endpoint ✓
- CE1-T061 — Idea list/detail/approve/reject ✓
- CE1-T070 — Draft Generator endpoint ✓
- CE1-T071 — Draft list/detail/update/revisions ✓
- CE1-T080 — Deterministic forbidden-claim pre-scan ✓
- CE1-T081 — SafetyCheckService with internal classifier ✓

Validation:

```text
worker/content/migrations/0001_content_engine_ce1_v1_1.sql → runs cleanly on multi_Ai_db
PRAGMA foreign_key_check → no violations
npm run typecheck → 0 errors
npm test → 207/207 pass
```

## Current Task — CE1-T080 — Deterministic forbidden-claim pre-scan

- **Priority:** P0
- **Dependencies:** CE1-T020
- **Goal:** Implement the deterministic `prescanIdea`/`prescanDraft` forbidden-claim substring scanner and ensure generation endpoints drop blocked outputs.

## Endpoints / utilities

```text
src/utils/safety-prescan.ts (already present)
IdeaService.generate → drop ideas where prescanIdea returns blocked
DraftService.generate → mark draft safetyStatus=blocked when prescanDraft returns blocked
```

## Tasks

1. Confirm the regex rule set covers doctor replacement, final diagnosis, prescription, dosage, guaranteed outcome, and cure/prevention claims.
2. Add unit tests for `prescanIdea` and `prescanDraft` covering blocked and safe cases.
3. Verify generation services skip/flag blocked outputs instead of persisting them.
4. Update service tests to assert blocked items are not returned.

## Validation Commands

```bash
cd worker/content
npm run typecheck
node --test test/safety-prescan.test.mjs
npm test
```

## Done Criteria

```text
[ ] Regex rules block forbidden medical claims deterministically.
[ ] Safe content passes the scanner.
[ ] Idea generator skips blocked ideas.
[ ] Draft generator marks blocked drafts as safetyStatus=blocked.
[ ] Unit tests cover positive, negative, and edge cases.
[ ] Typecheck passes and full test suite passes.
```

## Notes

- The pre-scan is deterministic only; the full safety classifier lives in CE1-T081.
- Do not implement CE-2+ AI judge or external moderation here.
- Keep rules aligned with `PROMPTS_CE1_v1.2_REVISED.md` and `SRS_ISEHAT_CONTENT_ENGINE.md` §safety.
