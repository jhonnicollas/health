// Minimal in-memory D1 fake. Each prepare() returns a fresh statement so
// concurrent/parallel awaits do not race on a shared stmt object.
// Exposes { db, calls, rows, reset() }.

export function makeFakeDb({ initial = {} } = {}) {
  const brands = new Map(initial.brands ?? []);
  const pillars = new Map(initial.pillars ?? []);
  const campaigns = new Map(initial.campaigns ?? []);
  const aiConfigs = new Map(initial.aiConfigs ?? []);
  const aiPromptVersions = new Map(initial.aiPromptVersions ?? []);
  const aiJobs = new Map(initial.aiJobs ?? []);
  const aiQuotas = new Map(initial.aiQuotas ?? []);
  const aiUsage = new Map(initial.aiUsage ?? []);
  const ideas = new Map(initial.ideas ?? []);
  const drafts = new Map(initial.drafts ?? []);
  const revisions = new Map(initial.revisions ?? []);
  const safetyReports = new Map(initial.safetyReports ?? []);
  const sourceReferences = new Map(initial.sourceReferences ?? []);
  const approvals = new Map(initial.approvals ?? []);
  const rateLimitCounters = new Map();
  const calls = [];

  function makeStmt() {
    const stmt = {
      sql: '',
      boundArgs: [],
      bind(...args) {
        stmt.boundArgs = args;
        return stmt;
      },
      async run() {
        const { sql, boundArgs: args } = stmt;
        calls.push({ kind: kindOf(sql), sql, args });
        return runSql(sql, args);
      },
      async first() {
        const { sql, boundArgs: args } = stmt;
        calls.push({ kind: kindOf(sql), sql, args });
        return firstSql(sql, args);
      },
      async all() {
        const { sql, boundArgs: args } = stmt;
        calls.push({ kind: kindOf(sql), sql, args });
        return allSql(sql, args);
      },
    };
    return stmt;
  }

  function normalizeSql(sql) {
    return sql.replace(/\s+/g, ' ').trim();
  }

  async function runSql(sql, args) {
    const n = normalizeSql(sql);
    if (/^INSERT INTO conPillars\b/i.test(n)) {
      const [id, brandId, name, slug, description, targetAudience, priority, isActive, createdAt, updatedAt] = args;
      pillars.set(id, { id, brandId, name, slug, description, targetAudience, priority, isActive, createdAt, updatedAt });
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conCampaigns\b/i.test(n)) {
      const [id, brandId, name, objective, tpj, pij, ta, lang, sd, ed, status, createdAt, updatedAt] = args;
      campaigns.set(id, { id, brandId, name, objective, targetPlatformsJson: tpj, pillarIdsJson: pij, targetAudience: ta, language: lang, startDate: sd, endDate: ed, status, createdAt, updatedAt });
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conAiConfigs\b/i.test(n)) {
      const [id, brandId, provider, model, purpose, temperature, maxTokens, timeoutMs, fallbackOrder, isActive, secretRef, createdAt, updatedAt] = args;
      aiConfigs.set(id, { id, brandId, provider, model, purpose, temperature, maxTokens, timeoutMs, fallbackOrder, isActive, secretRef, createdAt, updatedAt });
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conAiPromptVersions\b/i.test(n)) {
      const [id, promptKey, version, promptText, modelRole, isActive, createdBy, createdAt] = args;
      aiPromptVersions.set(id, { id, promptKey, version, promptText, modelRole, isActive, createdBy, createdAt });
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conAiGenerationJobs\b/i.test(n)) {
      const [id, brandId, jobType, status, idempotencyKey, inputJson, outputJson, errorCode, errorMessage, modelUsed, promptVersionId, tokenUsageJson, attemptCount, maxAttempts, startedAt, finishedAt, createdAt] = args;
      aiJobs.set(id, { id, brandId, jobType, status, idempotencyKey, inputJson, outputJson, errorCode, errorMessage, modelUsed, promptVersionId, tokenUsageJson, attemptCount, maxAttempts, startedAt, finishedAt, createdAt });
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conAiUsageLogs\b/i.test(n)) {
      const [id, brandId, jobId, provider, model, inputTokens, outputTokens, estimatedCostUsd, createdAt] = args;
      aiUsage.set(id, { id, brandId, jobId, provider, model, inputTokens, outputTokens, estimatedCostUsd, createdAt });
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conAiQuotas\b/i.test(n)) {
      const [id, brandId, period, maxJobs, maxTokens, maxCostUsd, usedJobs, usedTokens, usedCostUsd, resetsAt, createdAt, updatedAt] = args;
      aiQuotas.set(id, { id, brandId, period, maxJobs, maxTokens, maxCostUsd, usedJobs, usedTokens, usedCostUsd, resetsAt, createdAt, updatedAt });
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conIdeas\b/i.test(n)) {
      const cols = ['id','brandId','campaignId','pillarId','title','angle','targetPlatform','contentFormat','targetAudience','painPoint','score','contentHash','sourceType','confidence','status','createdAt','updatedAt'];
      const row = {};
      cols.forEach((c, i) => { row[c] = args[i]; });
      ideas.set(row.id, row);
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conDrafts\b/i.test(n)) {
      const cols = ['id','ideaId','brandId','campaignId','platform','contentFormat','language','currentRevision','primaryHook','hookAlternativesJson','mainContent','carouselSlidesJson','scriptJson','caption','cta','hashtagsJson','visualBriefJson','thumbnailText','altText','disclaimer','healthContentStatus','safetyStatus','approvalStatus','status','publishReadinessScore','createdAt','updatedAt'];
      const row = {};
      cols.forEach((c, i) => { row[c] = args[i]; });
      drafts.set(row.id, row);
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conDraftRevisions\b/i.test(n)) {
      const cols = ['id','draftId','revisionNumber','snapshotJson','contentHash','changeReason','changedBy','createdAt'];
      const row = {};
      cols.forEach((c, i) => { row[c] = args[i]; });
      revisions.set(row.id, row);
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conSafetyReports\b/i.test(n)) {
      const cols = ['id','draftId','revisionNumber','healthContentStatus','safetyStatus','blockedReasonsJson','warningsJson','rewrittenSuggestion','requiredDisclaimer','sourceTraceRequired','checkerNote','checkedBy','modelUsed','promptVersionId','checkedAt'];
      const row = {};
      cols.forEach((c, i) => { row[c] = args[i]; });
      safetyReports.set(row.id, row);
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conSourceReferences\b/i.test(n)) {
      const cols = ['id','draftId','revisionNumber','title','url','sourceType','sourceReliability','confidence','note','fetchedAt','createdAt'];
      const row = {};
      cols.forEach((c, i) => { row[c] = args[i]; });
      sourceReferences.set(row.id, row);
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conApprovals\b/i.test(n)) {
      const cols = ['id','draftId','revisionNumber','status','reviewerId','reviewerRole','reviewerNote','warningOverrideReason','approvedAt','createdAt'];
      const row = {};
      cols.forEach((c, i) => { row[c] = args[i]; });
      approvals.set(row.id, row);
      return { success: true, meta: {} };
    }
    if (/^INSERT INTO conRateLimitCounters\b/i.test(n)) {
      const [id, brandId, actorId, action, windowStart, windowEnd, count, createdAt, updatedAt] = args;
      const key = `${brandId}|${actorId}|${action}|${windowStart}`;
      const prev = rateLimitCounters.get(key);
      rateLimitCounters.set(key, {
        id: prev?.id ?? id,
        count,
        windowEnd,
        createdAt: prev?.createdAt ?? createdAt,
        updatedAt,
      });
      return { success: true, meta: {} };
    }
    const mUpdPillar = /^UPDATE conPillars SET (.+) WHERE id = \?$/i.exec(n);
    if (mUpdPillar) { applyUpdate(pillars, mUpdPillar[1], args); return { success: true, meta: {} }; }
    const mUpdCamp = /^UPDATE conCampaigns SET (.+) WHERE id = \?$/i.exec(n);
    if (mUpdCamp) { applyUpdate(campaigns, mUpdCamp[1], args); return { success: true, meta: {} }; }
    const mUpdBrand = /^UPDATE conBrands SET (.+) WHERE id = \?$/i.exec(n);
    if (mUpdBrand) { applyUpdate(brands, mUpdBrand[1], args); return { success: true, meta: {} }; }
    const mUpdDraftCurrent = /^UPDATE conDrafts SET currentRevision = \?, status = \?, safetyStatus = \?, approvalStatus = \?, healthContentStatus = \?, updatedAt = \? WHERE id = \?$/i.exec(n);
    if (mUpdDraftCurrent) {
      const [currentRevision, status, safetyStatus, approvalStatus, healthContentStatus, updatedAt, id] = args;
      const row = drafts.get(id);
      if (row) {
        row.currentRevision = currentRevision;
        row.status = status;
        row.safetyStatus = safetyStatus;
        row.approvalStatus = approvalStatus;
        row.healthContentStatus = healthContentStatus;
        row.updatedAt = updatedAt;
      }
      return { success: true, meta: {} };
    }
    const mUpdAi = /^UPDATE conAiConfigs SET (.+) WHERE id = \?$/i.exec(n);
    if (mUpdAi) { applyUpdate(aiConfigs, mUpdAi[1], args); return { success: true, meta: {} }; }
    const mUpdIdea = /^UPDATE conIdeas SET (.+) WHERE id = \?$/i.exec(n);
    if (mUpdIdea) { applyUpdate(ideas, mUpdIdea[1], args); return { success: true, meta: {} }; }
    const mUpdDraft = /^UPDATE conDrafts SET (.+) WHERE id = \?$/i.exec(n);
    if (mUpdDraft) { applyUpdate(drafts, mUpdDraft[1], args); return { success: true, meta: {} }; }
    const mUpdDraftApproval = /^UPDATE conDrafts SET approvalStatus = \?, status = \?, updatedAt = \? WHERE id = \?$/i.exec(n);
    if (mUpdDraftApproval) {
      const [approvalStatus, status, updatedAt, id] = args;
      const row = drafts.get(id);
      if (row) {
        row.approvalStatus = approvalStatus;
        row.status = status;
        row.updatedAt = updatedAt;
      }
      return { success: true, meta: {} };
    }
    const mDeactPrompts = /^UPDATE conAiPromptVersions SET isActive = 0 WHERE promptKey = \?$/i.exec(n);
    if (mDeactPrompts) {
      const [promptKey] = args;
      for (const row of aiPromptVersions.values()) {
        if (row.promptKey === promptKey) row.isActive = 0;
      }
      return { success: true, meta: {} };
    }
    const mActivatePrompt = /^UPDATE conAiPromptVersions SET isActive = 1 WHERE id = \?$/i.exec(n);
    if (mActivatePrompt) {
      const [id] = args;
      const row = aiPromptVersions.get(id);
      if (row) row.isActive = 1;
      return { success: true, meta: {} };
    }
    const mUpdJobStatus = /^UPDATE conAiGenerationJobs SET\s+([\s\S]+?)\s+WHERE id = \?$/i.exec(n);
    if (mUpdJobStatus) {
      applyUpdate(aiJobs, mUpdJobStatus[1], args);
      return { success: true, meta: {} };
    }
    const mIncAttempt = /^UPDATE conAiGenerationJobs SET attemptCount = attemptCount \+ 1 WHERE id = \?$/i.exec(n);
    if (mIncAttempt) {
      const [id] = args;
      const row = aiJobs.get(id);
      if (row) row.attemptCount = (row.attemptCount ?? 0) + 1;
      return { success: true, meta: {} };
    }
    const mUpdQuota = /^UPDATE conAiQuotas SET\s+([\s\S]+?)\s+WHERE id = \?$/i.exec(n);
    if (mUpdQuota) {
      applyQuotaArithmetic(aiQuotas, mUpdQuota[1], args);
      return { success: true, meta: {} };
    }
    return { success: true, meta: {} };
  }

  async function firstSql(sql, args) {
    const n = normalizeSql(sql);
    if (/SELECT 1 AS one FROM conBrands/i.test(n)) {
      return brands.has(args[0]) ? { one: 1 } : null;
    }
    if (/SELECT 1 AS one FROM conPillars/i.test(n)) {
      const [id, brandId] = args;
      const row = pillars.get(id);
      return row && row.brandId === brandId && row.isActive === 1 ? { one: 1 } : null;
    }
    if (/FROM conPillars WHERE brandId = \? AND slug = \?/i.test(n)) {
      for (const row of pillars.values()) {
        if (row.brandId === args[0] && row.slug === args[1]) return { ...row };
      }
      return null;
    }
    if (/FROM conPillars WHERE id = \?/i.test(n)) {
      const row = pillars.get(args[0]);
      return row ? { ...row } : null;
    }
    if (/FROM conCampaigns WHERE id = \?/i.test(n)) {
      const row = campaigns.get(args[0]);
      return row ? { ...row } : null;
    }
    if (/FROM conBrands WHERE id = \?/i.test(n)) {
      const row = brands.get(args[0]);
      return row ? { ...row } : null;
    }
    if (/FROM conAiConfigs WHERE id = \?/i.test(n)) {
      const row = aiConfigs.get(args[0]);
      return row ? { ...row } : null;
    }
    if (/FROM conAiPromptVersions WHERE id = \?/i.test(n)) {
      const row = aiPromptVersions.get(args[0]);
      return row ? { ...row } : null;
    }
    if (/FROM conAiPromptVersions WHERE promptKey = \? AND version = \?/i.test(n)) {
      for (const row of aiPromptVersions.values()) {
        if (row.promptKey === args[0] && row.version === args[1]) return { ...row };
      }
      return null;
    }
    if (/FROM conAiPromptVersions WHERE promptKey = \? AND isActive = 1/i.test(n)) {
      for (const row of aiPromptVersions.values()) {
        if (row.promptKey === args[0] && row.isActive === 1) return { ...row };
      }
      return null;
    }
    if (/FROM conAiGenerationJobs WHERE id = \?/i.test(n)) {
      const row = aiJobs.get(args[0]);
      return row ? { ...row } : null;
    }
    if (/FROM conAiGenerationJobs WHERE idempotencyKey = \?/i.test(n)) {
      for (const row of aiJobs.values()) {
        if (row.idempotencyKey === args[0]) return { ...row };
      }
      return null;
    }
    if (/FROM conIdeas WHERE id = \?/i.test(n)) {
      const row = ideas.get(args[0]);
      return row ? { ...row } : null;
    }
    if (/FROM conDrafts WHERE id = \?/i.test(n)) {
      const row = drafts.get(args[0]);
      return row ? { ...row } : null;
    }
    if (/FROM conDraftRevisions WHERE draftId = \? AND revisionNumber = \?/i.test(n)) {
      for (const row of revisions.values()) {
        if (row.draftId === args[0] && row.revisionNumber === args[1]) return { ...row };
      }
      return null;
    }
    if (/FROM conSafetyReports WHERE draftId = \? AND revisionNumber = \?/i.test(n)) {
      for (const row of safetyReports.values()) {
        if (row.draftId === args[0] && row.revisionNumber === args[1]) return { ...row };
      }
      return null;
    }
    if (/FROM conSafetyReports WHERE draftId = \? ORDER BY revisionNumber DESC LIMIT 1/i.test(n)) {
      let latest = null;
      for (const row of safetyReports.values()) {
        if (row.draftId !== args[0]) continue;
        if (!latest || row.revisionNumber > latest.revisionNumber) latest = row;
      }
      return latest ? { ...latest } : null;
    }
    if (/FROM conApprovals WHERE draftId = \? ORDER BY createdAt DESC LIMIT 1/i.test(n)) {
      const [draftId] = args;
      let latest = null;
      for (const row of approvals.values()) {
        if (row.draftId !== draftId) continue;
        if (!latest || row.createdAt > latest.createdAt) latest = row;
      }
      return latest ? { ...latest } : null;
    }
    if (/FROM conRateLimitCounters WHERE/i.test(n)) {
      const [brandId, actorId, action, windowStart] = args;
      const key = `${brandId}|${actorId}|${action}|${windowStart}`;
      const row = rateLimitCounters.get(key);
      return row ? { count: row.count, windowEnd: row.windowEnd } : null;
    }
    if (/FROM conAiQuotas WHERE brandId = \? AND period = \? AND resetsAt > \?/i.test(n)) {
      const [brandId, period, start] = args;
      let best = null;
      for (const row of aiQuotas.values()) {
        if (row.brandId === brandId && row.period === period && row.resetsAt > start) {
          if (!best || row.resetsAt > best.resetsAt) best = row;
        }
      }
      return best ? { ...best } : null;
    }
    if (/SELECT COUNT\(\*\) AS n FROM conPillars/i.test(n)) {
      return { n: countRows(pillars, args, ['brandId', 'isActive']) };
    }
    if (/SELECT COUNT\(\*\) AS n FROM conCampaigns/i.test(n)) {
      return { n: countRows(campaigns, args, ['brandId', 'status', 'language']) };
    }
    if (/SELECT COUNT\(\*\) AS n FROM conAiConfigs/i.test(n)) {
      return { n: countRows(aiConfigs, args, ['brandId', 'purpose', 'isActive']) };
    }
    if (/SELECT COUNT\(\*\) AS n FROM conAiPromptVersions/i.test(n)) {
      return { n: countRows(aiPromptVersions, args, ['promptKey']) };
    }
    if (/SELECT COUNT\(\*\) AS n FROM conIdeas/i.test(n)) {
      return { n: countRows(ideas, args, ['brandId','campaignId','pillarId','status','targetPlatform','contentFormat']) };
    }
    if (/SELECT COUNT\(\*\) AS n FROM conDrafts/i.test(n)) {
      return { n: countRows(drafts, args, ['brandId','campaignId','ideaId','platform','contentFormat','status','safetyStatus','approvalStatus','healthContentStatus']) };
    }
    if (/SELECT COUNT\(\*\) AS n FROM conSourceReferences/i.test(n)) {
      return { n: countRows(sourceReferences, args, ['draftId', 'revisionNumber']) };
    }
    if (/SELECT COUNT\(\*\) AS n FROM conAiGenerationJobs/i.test(n)) {
      return { n: countRows(aiJobs, args.slice(0, countWhereFilters(sql)), ['brandId', 'status', 'jobType']) };
    }
    return null;
  }

  async function allSql(sql, args) {
    const n = normalizeSql(sql);
    if (/FROM conPillars WHERE brandId = \?/i.test(n) && /ORDER BY/i.test(n)) {
      const filterArgs = args.slice(0, -2);
      const rows = filterRows(pillars, filterArgs, ['brandId', 'isActive']);
      rows.sort((a, b) => b.priority - a.priority || a.createdAt.localeCompare(b.createdAt));
      const limit = args[args.length - 2];
      const offset = args[args.length - 1];
      return { results: rows.slice(offset, offset + limit), success: true, meta: {} };
    }
    if (/FROM conCampaigns WHERE/i.test(n) && /ORDER BY/i.test(n)) {
      const filterArgs = args.slice(0, -2);
      const rows = filterRows(campaigns, filterArgs, ['brandId', 'status', 'language']);
      rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const limit = args[args.length - 2];
      const offset = args[args.length - 1];
      return { results: rows.slice(offset, offset + limit), success: true, meta: {} };
    }
    // findActiveByPurpose — specific (brandId + purpose + isActive=1) BEFORE the generic aiConfigs branch.
    if (/FROM conAiConfigs WHERE brandId = \? AND purpose = \? AND isActive = 1/i.test(n)) {
      const [brandId, purpose] = args;
      const rows = [];
      for (const row of aiConfigs.values()) {
        if (row.brandId === brandId && row.purpose === purpose && row.isActive === 1) {
          rows.push({ ...row });
        }
      }
      rows.sort((a, b) => a.fallbackOrder - b.fallbackOrder || a.createdAt.localeCompare(b.createdAt));
      return { results: rows, success: true, meta: {} };
    }
    if (/FROM conAiConfigs WHERE brandId = \?/i.test(n) && /ORDER BY/i.test(n)) {
      const filterArgs = args.slice(0, -2);
      const rows = filterRows(aiConfigs, filterArgs, ['brandId', 'purpose', 'isActive']);
      rows.sort((a, b) => a.fallbackOrder - b.fallbackOrder || a.createdAt.localeCompare(b.createdAt));
      const limit = args[args.length - 2];
      const offset = args[args.length - 1];
      return { results: rows.slice(offset, offset + limit), success: true, meta: {} };
    }
    if (/FROM conAiPromptVersions WHERE promptKey = \?/i.test(n)) {
      const [promptKey] = args;
      const rows = [];
      for (const row of aiPromptVersions.values()) {
        if (row.promptKey === promptKey) rows.push({ ...row });
      }
      rows.sort((a, b) => b.version - a.version);
      return { results: rows, success: true, meta: {} };
    }
    if (/FROM conAiGenerationJobs WHERE/i.test(n) && /ORDER BY/i.test(n)) {
      const filterArgs = args.slice(0, -2);
      const rows = filterRows(aiJobs, filterArgs, ['brandId', 'status', 'jobType']);
      rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const limit = args[args.length - 2];
      const offset = args[args.length - 1];
      return { results: rows.slice(offset, offset + limit), success: true, meta: {} };
    }
    if (/FROM conIdeas WHERE/i.test(n) && /ORDER BY/i.test(n)) {
      const filterArgs = args.slice(0, -2);
      const rows = filterRows(ideas, filterArgs, ['brandId','campaignId','pillarId','status','targetPlatform','contentFormat']);
      rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const limit = args[args.length - 2];
      const offset = args[args.length - 1];
      return { results: rows.slice(offset, offset + limit), success: true, meta: {} };
    }
    if (/FROM conDrafts WHERE/i.test(n) && /ORDER BY/i.test(n)) {
      const filterArgs = args.slice(0, -2);
      const rows = filterRows(drafts, filterArgs, ['brandId','campaignId','ideaId','platform','contentFormat','status','safetyStatus','approvalStatus','healthContentStatus']);
      rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const limit = args[args.length - 2];
      const offset = args[args.length - 1];
      return { results: rows.slice(offset, offset + limit), success: true, meta: {} };
    }
    if (/FROM conDraftRevisions WHERE draftId = \?/i.test(n)) {
      const [draftId] = args;
      const rows = [];
      for (const row of revisions.values()) {
        if (row.draftId === draftId) rows.push({ ...row });
      }
      rows.sort((a, b) => a.revisionNumber - b.revisionNumber);
      return { results: rows, success: true, meta: {} };
    }
    if (/FROM conSafetyReports WHERE draftId = \? ORDER BY revisionNumber DESC/i.test(n)) {
      const [draftId] = args;
      const rows = [];
      for (const row of safetyReports.values()) {
        if (row.draftId === draftId) rows.push({ ...row });
      }
      rows.sort((a, b) => b.revisionNumber - a.revisionNumber);
      return { results: rows, success: true, meta: {} };
    }
    if (/FROM conSourceReferences WHERE draftId = \? AND revisionNumber = \?/i.test(n)) {
      const [draftId, revisionNumber] = args;
      const rows = [];
      for (const row of sourceReferences.values()) {
        if (row.draftId === draftId && row.revisionNumber === revisionNumber) rows.push({ ...row });
      }
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { results: rows, success: true, meta: {} };
    }
    if (/FROM conApprovals WHERE draftId = \? AND revisionNumber = \?/i.test(n)) {
      const [draftId, revisionNumber] = args;
      const rows = [];
      for (const row of approvals.values()) {
        if (row.draftId === draftId && row.revisionNumber === revisionNumber) rows.push({ ...row });
      }
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { results: rows, success: true, meta: {} };
    }
    return { results: [], success: true, meta: {} };
  }

  const db = {
    prepare(sql) {
      const s = makeStmt();
      s.sql = sql;
      return s;
    },
  };

  function reset() {
    brands.clear();
    pillars.clear();
    campaigns.clear();
    aiConfigs.clear();
    aiPromptVersions.clear();
    aiJobs.clear();
    aiQuotas.clear();
    aiUsage.clear();
    ideas.clear();
    drafts.clear();
    revisions.clear();
    safetyReports.clear();
    sourceReferences.clear();
    approvals.clear();
    rateLimitCounters.clear();
    calls.length = 0;
  }

  return { db, calls, rows: { brands, pillars, campaigns, aiConfigs, aiPromptVersions, aiJobs, aiQuotas, aiUsage, ideas, drafts, revisions, safetyReports, sourceReferences, approvals }, reset };
}

function kindOf(sql) {
  if (/^INSERT INTO conAuditLogs/i.test(sql)) return 'audit';
  if (/^INSERT INTO conAiGenerationJobs/i.test(sql)) return 'aiJobInsert';
  if (/^INSERT INTO conAiUsageLogs/i.test(sql)) return 'aiUsageInsert';
  if (/^INSERT INTO conAiQuotas/i.test(sql)) return 'aiQuotaInsert';
  if (/^INSERT INTO conAiConfigs/i.test(sql)) return 'insert_ai_config';
  if (/^INSERT INTO conAiPromptVersions/i.test(sql)) return 'insert_prompt_version';
  if (/^INSERT INTO conIdeas/i.test(sql)) return 'ideaInsert';
  if (/^INSERT INTO conDrafts/i.test(sql)) return 'draftInsert';
  if (/^INSERT INTO conDraftRevisions/i.test(sql)) return 'revisionInsert';
  if (/^INSERT INTO conSafetyReports/i.test(sql)) return 'safetyReportInsert';
  if (/^INSERT INTO conSourceReferences/i.test(sql)) return 'sourceReferenceInsert';
  if (/^INSERT INTO conApprovals/i.test(sql)) return 'approvalInsert';
  if (/^INSERT INTO/i.test(sql)) return 'insert';
  if (/^UPDATE conAiGenerationJobs/i.test(sql)) return 'aiJobUpdate';
  if (/^UPDATE conAiQuotas/i.test(sql)) return 'aiQuotaUpdate';
  if (/^UPDATE conIdeas/i.test(sql)) return 'ideaUpdate';
  if (/^UPDATE conDrafts/i.test(sql)) return 'draftUpdate';
  if (/^UPDATE/i.test(sql)) return 'update';
  if (/^SELECT COUNT/i.test(sql)) return 'count';
  return 'other';
}

function applyUpdate(map, setPairs, args) {
  const id = args[args.length - 1];
  const row = map.get(id);
  if (!row) return;
  const pairs = setPairs.split(',').map((s) => s.trim());
  const setArgs = args.slice(0, -1);
  let argIdx = 0;
  for (const pair of pairs) {
    const [k] = pair.split(/\s*=\s*/);
    if (row[k] !== undefined) {
      row[k] = setArgs[argIdx];
      argIdx++;
    }
  }
}

function applyQuotaArithmetic(map, setPairs, args) {
  // SET clauses may use `col = col + ?` or plain `col = ?`. Last arg is id.
  const id = args[args.length - 1];
  const row = map.get(id);
  if (!row) return;
  const pairs = setPairs.split(',').map((s) => s.trim());
  let argIdx = 0;
  for (const pair of pairs) {
    const m = /^(\w+)\s*=\s*(\w+)\s*\+\s*\?$/i.exec(pair);
    if (m) {
      const col = m[1];
      row[col] = (row[col] ?? 0) + Number(args[argIdx]);
      argIdx++;
    } else {
      const m2 = /^(\w+)\s*=\s*\?$/i.exec(pair);
      if (m2) {
        row[m2[1]] = args[argIdx];
        argIdx++;
      }
    }
  }
}

function countWhereFilters(sql) {
  const m = /WHERE\s+([\s\S]+?)(?:\s+ORDER BY|$)/i.exec(sql);
  if (!m) return 0;
  return m[1].split(/\s+AND\s+/i).length;
}

function filterRows(map, args, fieldOrder) {
  const out = [];
  for (const row of map.values()) {
    let ok = true;
    for (let i = 0; i < fieldOrder.length; i++) {
      const v = args[i];
      if (v === undefined) break;
      if (row[fieldOrder[i]] !== v) { ok = false; break; }
    }
    if (ok) out.push(row);
  }
  return out;
}

function countRows(map, args, fieldOrder) {
  return filterRows(map, args, fieldOrder).length;
}
