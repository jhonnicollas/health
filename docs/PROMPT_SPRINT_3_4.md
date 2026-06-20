# Prompt Utama Eksekusi Sprint 3 & Sprint 4 (Copy-Paste ke Agent)

Gunakan prompt di bawah ini untuk menginstruksikan agent AI agar lebih berhati-hati, meminimalisir *bug*, dan menjaga kepatuhan penuh terhadap aturan *multi-agent*:

---

**Prompt untuk AI Agent:**

```text
You are working on the HL Health Companion project. Your objective is to complete the tasks for **Sprint 3 (Family & Alert System)** and **Sprint 4 (Advanced Health Companion)**. 

Before making ANY code changes, you MUST read the following files in this exact order:
1. AGENTS.md (CRITICAL: Pay special attention to Section 12 "Forbidden Actions" and all Product Rules).
2. TASKS.md (Your absolute single source of truth for what to build).
3. HANDOFF.md (To understand where the previous agent left off).
4. WORK_LOG.md (To understand the latest context and prevent overwriting logs).
5. TEST_PLAN.md (To understand the testing requirements for these sprints).
6. schema.sql & api-contract.md (To ensure DB and API alignment).

### STRICT EXECUTION RULES:
1. **Zero-Bug & Zero-Leak Tolerance:** 
   - ALWAYS use `c.env.DB.batch()` when performing multiple insert/update operations in a single endpoint to ensure atomic transactions. Do not leave partial data.
   - Pay strict attention to timezone handling. Always fetch and use the user's local timezone from `HL_userProfiles` when querying date boundaries, NEVER rely on UTC `new Date().toISOString()`.
   - Pay extreme attention to variable bindings in SQL statements. Ensure `bind()` parameters perfectly match the columns.
2. **One Task At A Time:** You must operate in Auto-Sequential mode. Pick exactly ONE unchecked task from TASKS.md. Mark it `[-] In Progress`. Complete the implementation, validation, and documentation updates for that single task BEFORE moving to the next.
3. **Mandatory Logging:** After completing EVERY SINGLE TASK, you must append a structured entry to `WORK_LOG.md` detailing the exact files changed and validation performed. You must also update `HANDOFF.md` to reflect your current position.
4. **End-of-Sprint Full Testing:** When all tasks in a sprint (e.g., Sprint 3) are marked as `[x] Done`, you MUST STOP coding and execute a full testing cycle for that sprint based on `TEST_PLAN.md`. You may only proceed to the next sprint (e.g., Sprint 4) if all tests for the current sprint pass perfectly without errors.
5. **Database Safety:** Do NOT create new tables carelessly. If a new table is strictly required by the task, it MUST start with `HL_` and use `camelCase` for columns. Add it to `schema.sql` and `seed.sql`.

Now, review `HANDOFF.md` and `TASKS.md`, find the next available task in Sprint 3, mark it as `[-] In Progress` in `TASKS.md`, write a "Started" log in `WORK_LOG.md`, and begin your analysis.
```
