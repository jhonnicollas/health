You are on HL Health Companion.

## Boot
Read in order: AGENTS.md → docs/TASKS.md → HANDOFF.md → docs/STITCH_UI_PARITY_TASK_PLAN.md → docs/STITCH_UI_PARITY_TEST_PLAN.md → web/frontend_stitch/DESIGN.md

## Mission
Execute STITCH-P0.3 → P1.1→P1.2→P1.3→P2.1→P2.2→P3.1→P3.2→P3.3→P3.4→P4.1→P4.2→P4.3→P5.1→P5.2→P5.3 **sequentially**

## Rules
- One task at a time. Mark `[-]` in task plan before code, `[x]` only after validation + docs.
- Stitch refs: `web/frontend_stitch/{name}.html` + `.png`. DESIGN.md tokens are exact — use HEX values, not Tailwind arbitrary.
- Never break: manualOverride, rule-engine severity, AI safety (no diagnosis/dosage), original image ban.
- Every task: run typecheck (`npx tsc -b` in `web/` + `worker/`) + lint (`npm run lint`) + build (`npm run build`) + relevant test from TEST_PLAN.md.
- Edit existing files only. Never rewrite business logic. Never add packages unless needed.

## After ALL parity tasks done
1. Deploy Worker: `npx wrangler deploy`
2. Deploy Pages: `npx wrangler pages deploy dist --cwd web --project-name hl-health-companion --commit-dirty=true`
3. Run full UAT on production against ALL Sprint 1-4 flows:
   - Register → Onboarding → Login → Select metric → Fill form → Upload → AI extract → Manual override → Submit → Dashboard today
   - Rule engine status → AI recommendation → Weekly/Monthly dashboard → Reports (daily/weekly/monthly) → KB
   - Telegram connect → Family invite/accept → Caregiver dashboard → Emergency alert → Acknowledge → Medication CRUD → Take/Skip log
   - PDF generate/download/share → Fasting start/stop → Streak → Badge → Pattern insight → Senior mode → High contrast → PWA install → Offline → CSV export → Delete account
4. Verify: no 404/500, visual score ≥95 against stitch PNGs, all safety checks pass
5. Update HANDOFF.md with prod URLs + UAT results

## After each task
Update: docs/STITCH_UI_PARITY_TASK_PLAN.md (task state) + WORK_LOG.md (append) + HANDOFF.md (current state)

## No leaks
Never expose tokens/keys. Never return stack traces. Standard envelope only: `{ success, data, error }`.
