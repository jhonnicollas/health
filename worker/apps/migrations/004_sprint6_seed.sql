-- Migration 004 — Sprint 6 — Seed data for AI Clinical Copilot
-- Source of truth: docs_sprint6/01.PRD_S6_AI_CLINICAL_COPILOT.md §13 + §7 + §12
-- Idempotent: uses INSERT OR IGNORE everywhere.
-- Apply after: 003_sprint6_schema.sql

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- 0. Ensure prerequisite roles/plans exist (idempotent)
-- ---------------------------------------------------------
INSERT OR IGNORE INTO HL_roles (roleCode, roleName, description, systemRole, active)
VALUES
  ('admin', 'Admin', 'General administrator', 1, 1),
  ('superAdmin', 'Super Admin', 'Full system administrator', 1, 1),
  ('billingAdmin', 'Billing Admin', 'Billing and subscription administrator', 1, 1),
  ('aiConfigAdmin', 'AI Config Admin', 'AI configuration administrator', 1, 1),
  ('medicalReviewer', 'Medical Reviewer', 'Medical reviewer for AI outputs', 1, 1);

INSERT OR IGNORE INTO HL_plans (planCode, planName, billingInterval, durationDays, priceAmount, currency, active, sortOrder)
VALUES
  ('free', 'Free', 'free', NULL, 0, 'IDR', 1, 10),
  ('premiumMonthly', 'Premium Monthly', 'monthly', 30, 99000, 'IDR', 1, 20),
  ('premiumQuarterly', 'Premium Quarterly', 'quarterly', 90, 269000, 'IDR', 1, 30),
  ('premiumYearly', 'Premium Yearly', 'yearly', 365, 949000, 'IDR', 1, 40),
  ('familyPremium', 'Family Premium', 'yearly', 365, 1499000, 'IDR', 1, 50);

-- ---------------------------------------------------------
-- 1. RBAC Permissions (S6A-T-06)
-- ---------------------------------------------------------
INSERT OR IGNORE INTO HL_permissions (permissionCode, permissionName, category, description, active)
VALUES
  ('admin.aiModelRun.read', 'Read AI model run logs', 'admin', 'View AI model run metadata and logs', 1),
  ('admin.aiSafety.read', 'Read AI safety flags', 'admin', 'View AI output safety flags and violations', 1),
  ('admin.aiEvaluation.read', 'Read AI evaluation queue', 'admin', 'View AI evaluation cases and results', 1),
  ('admin.aiEvaluation.review', 'Review AI evaluation cases', 'admin', 'Submit medical/security review for AI outputs', 1),
  ('admin.aiConfig.read', 'Read AI configuration', 'admin', 'View AI prompt versions, configs, and routing', 1),
  ('admin.aiConfig.update', 'Update AI configuration', 'admin', 'Activate prompts and update AI configs', 1),
  ('admin.whatsapp.read', 'Read WhatsApp AI sessions', 'admin', 'View WhatsApp linking and session metadata', 1);

-- Assign to roles
INSERT OR IGNORE INTO HL_rolePermissions (roleCode, permissionCode)
VALUES
  -- admin gets read-only AI governance
  ('admin', 'admin.aiModelRun.read'),
  ('admin', 'admin.aiSafety.read'),
  ('admin', 'admin.aiEvaluation.read'),
  ('admin', 'admin.aiConfig.read'),
  ('admin', 'admin.whatsapp.read'),
  -- superAdmin gets everything
  ('superAdmin', 'admin.aiModelRun.read'),
  ('superAdmin', 'admin.aiSafety.read'),
  ('superAdmin', 'admin.aiEvaluation.read'),
  ('superAdmin', 'admin.aiEvaluation.review'),
  ('superAdmin', 'admin.aiConfig.read'),
  ('superAdmin', 'admin.aiConfig.update'),
  ('superAdmin', 'admin.whatsapp.read'),
  -- aiConfigAdmin manages configs and prompts
  ('aiConfigAdmin', 'admin.aiConfig.read'),
  ('aiConfigAdmin', 'admin.aiConfig.update'),
  ('aiConfigAdmin', 'admin.aiModelRun.read'),
  ('aiConfigAdmin', 'admin.aiSafety.read'),
  -- medicalReviewer reviews eval cases
  ('medicalReviewer', 'admin.aiEvaluation.read'),
  ('medicalReviewer', 'admin.aiEvaluation.review'),
  ('medicalReviewer', 'admin.aiSafety.read');

-- ---------------------------------------------------------
-- 2. Feature Flags (S6A-T-04)
-- ---------------------------------------------------------
INSERT OR IGNORE INTO HL_featureFlags (flagCode, flagName, description, enabled)
VALUES
  ('feature.aiClinicalCopilot.use', 'AI Clinical Copilot', 'Enable AI Clinical Copilot chat feature', 0),
  ('feature.aiClinicalCopilot.whatsapp', 'AI WhatsApp', 'Enable WhatsApp AI integration', 0),
  ('feature.aiClinicalCopilot.streaming', 'AI Streaming', 'Enable streaming AI responses', 0),
  ('feature.aiClinicalCopilot.vectorMemory', 'AI Vector Memory', 'Enable personal Vectorize memory for AI', 0),
  ('feature.aiClinicalCopilot.firstAid', 'AI First Aid', 'Enable AI first-aid guidance', 0),
  ('feature.aiClinicalCopilot.emergencyGuidance', 'AI Emergency Guidance', 'Enable deterministic emergency guidance', 1),
  ('feature.aiClinicalCopilot.doctorHandoff', 'AI Doctor Handoff', 'Enable doctor handoff report generation', 0),
  ('feature.aiClinicalCopilot.caregiverSummary', 'AI Caregiver Summary', 'Enable caregiver-safe AI summary', 0),
  ('feature.aiClinicalCopilot.evalMode', 'AI Eval Mode', 'Enable evaluation mode for admins', 0),
  ('feature.aiClinicalCopilot.medicalReviewerQueue', 'AI Medical Reviewer Queue', 'Enable medical reviewer queue', 0);

-- ---------------------------------------------------------
-- 3. System Configs (S6A-T-05)
-- ---------------------------------------------------------
INSERT OR IGNORE INTO HL_systemConfigs (configKey, configValue, dataType, description)
VALUES
  -- AI Gateway
  ('aiGateway.enabled', 'true', 'boolean', 'Enable Cloudflare AI Gateway routing'),
  ('aiGateway.gatewayId', 'isehat-ai-gateway', 'string', 'Cloudflare AI Gateway ID'),
  ('aiGateway.primaryProvider', '9router', 'string', 'Primary AI Gateway provider slug'),
  ('aiGateway.customProvider.9router.enabled', 'true', 'boolean', 'Enable 9router custom provider'),
  ('aiGateway.customProvider.9router.slug', '9router', 'string', '9router provider slug in AI Gateway'),
  ('aiGateway.directFallback.enabled', 'false', 'boolean', 'Allow direct 9router fallback bypassing AI Gateway'),
  ('aiGateway.retry.maxRetries', '2', 'number', 'Max retries per provider'),
  ('aiGateway.retry.timeoutMs', '10000', 'number', 'Timeout per provider call in ms'),
  ('aiGateway.fallback.enabled', 'true', 'boolean', 'Enable Workers AI fallback chain'),
  -- Workers AI
  ('workersAi.embeddingModel', '@cf/baai/bge-base-en-v1.5', 'string', 'Workers AI embedding model for Vectorize'),
  ('workersAi.safetyClassifierModel', '@cf/huggingface/distilbert-sst-2-int8', 'string', 'Workers AI safety classifier fallback model'),
  ('workersAi.visionModel', '@cf/meta/llama-3.2-11b-vision-instruct', 'string', 'Workers AI vision model'),
  -- Vectorize
  ('vectorize.indexName', 'hl-health-memory', 'string', 'Cloudflare Vectorize index name'),
  ('vectorize.defaultTopK', '5', 'number', 'Default top-K vector results'),
  ('vectorize.rerank.enabled', 'true', 'boolean', 'Enable vector result reranking'),
  ('vectorize.maxVectorsPerUser', '500', 'number', 'Max vectors per user (LRU eviction)'),
  ('vectorize.alertThresholdPercent', '80', 'number', 'Total index capacity alert threshold percent'),
  -- AI Search
  ('aiSearch.enabled', 'false', 'boolean', 'Enable Cloudflare AI Search knowledge base'),
  ('aiSearch.instanceId', '[TBD]', 'string', 'Cloudflare AI Search instance ID'),
  -- KV
  ('kv.cache.enabled', 'true', 'boolean', 'Enable KV cache for prompts/configs/search'),
  ('kv.promptTtlSeconds', '300', 'number', 'KV TTL for active prompt cache'),
  -- Clinical Copilot
  ('clinicalCopilot.enabled', 'false', 'string', 'AI Clinical Copilot rollout state: false/beta/true'),
  ('clinicalCopilot.maxTurns', '20', 'number', 'Max assistant turns per session'),
  ('clinicalCopilot.maxContextItems', '10', 'number', 'Max context trace items in response'),
  ('clinicalCopilot.temperature', '0.3', 'number', 'LLM temperature'),
  ('clinicalCopilot.maxTokens', '2048', 'number', 'Max output tokens per response'),
  ('clinicalCopilot.maxConcurrentSessionsPerUser', '2', 'number', 'Max concurrent AI sessions per user'),
  ('clinicalCopilot.maxSessionStartsPerHour', '10', 'number', 'Rate limit: session starts per hour'),
  ('clinicalCopilot.maxMessagesPerMinute', '30', 'number', 'Rate limit: messages per minute'),
  ('clinicalCopilot.maxFollowUpsPerHour', '10', 'number', 'Rate limit: follow-up requests per hour'),
  ('clinicalCopilot.maxHandoffsPerHour', '5', 'number', 'Rate limit: doctor handoff requests per hour'),
  -- First Aid
  ('firstAid.enabled', 'true', 'boolean', 'Enable first-aid guidance engine'),
  ('firstAid.requireApprovedProtocol', 'true', 'boolean', 'Only return reviewerStatus=approved protocols'),
  ('firstAid.maxRequestsPerHour', '10', 'number', 'Rate limit: first-aid requests per hour'),
  -- Vectorize rebuild
  ('vectorize.maxRebuildsPerDay', '2', 'number', 'Max memory rebuilds per user per day'),
  -- WhatsApp AI
  ('whatsappAi.enabled', 'false', 'boolean', 'Enable WhatsApp AI integration'),
  ('whatsappAi.maxReplyChars', '400', 'number', 'Max characters for WhatsApp AI reply'),
  ('whatsappAi.maxInboundPerMinute', '100', 'number', 'Rate limit: inbound WA messages per minute per number'),
  ('whatsappAi.gatewaySecretRef', 'WA_GATEWAY_SECRET', 'string', 'Env var reference for Baileys gateway secret'),
  ('whatsappAi.healthCheckIntervalSeconds', '300', 'number', 'WhatsApp gateway health check interval'),
  -- Medical Safety Runtime
  ('medicalSafetyRuntime.enabled', 'true', 'boolean', 'Enable Medical Safety Runtime v2'),
  ('medicalSafetyRuntime.strictMode', 'true', 'boolean', 'Strict mode: critical detectors always block');

-- ---------------------------------------------------------
-- 4. Plan Quota Matrix (S6A-T-07)
-- ---------------------------------------------------------
-- feature.aiClinicalCopilot.use
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow)
VALUES
  ('free', 'feature.aiClinicalCopilot.use', 1, 5, 'month'),
  ('premiumMonthly', 'feature.aiClinicalCopilot.use', 1, 200, 'month'),
  ('premiumQuarterly', 'feature.aiClinicalCopilot.use', 1, 200, 'month'),
  ('premiumYearly', 'feature.aiClinicalCopilot.use', 1, 200, 'month'),
  ('familyPremium', 'feature.aiClinicalCopilot.use', 1, 300, 'month');

-- feature.aiClinicalCopilot.whatsapp
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow)
VALUES
  ('free', 'feature.aiClinicalCopilot.whatsapp', 0, NULL, NULL),
  ('premiumMonthly', 'feature.aiClinicalCopilot.whatsapp', 1, 100, 'month'),
  ('premiumQuarterly', 'feature.aiClinicalCopilot.whatsapp', 1, 100, 'month'),
  ('premiumYearly', 'feature.aiClinicalCopilot.whatsapp', 1, 100, 'month'),
  ('familyPremium', 'feature.aiClinicalCopilot.whatsapp', 1, 150, 'month');

-- feature.aiClinicalCopilot.streaming
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow)
VALUES
  ('free', 'feature.aiClinicalCopilot.streaming', 0, NULL, NULL),
  ('premiumMonthly', 'feature.aiClinicalCopilot.streaming', 1, NULL, NULL),
  ('premiumQuarterly', 'feature.aiClinicalCopilot.streaming', 1, NULL, NULL),
  ('premiumYearly', 'feature.aiClinicalCopilot.streaming', 1, NULL, NULL),
  ('familyPremium', 'feature.aiClinicalCopilot.streaming', 1, NULL, NULL);

-- feature.aiClinicalCopilot.vectorMemory
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow)
VALUES
  ('free', 'feature.aiClinicalCopilot.vectorMemory', 0, NULL, NULL),
  ('premiumMonthly', 'feature.aiClinicalCopilot.vectorMemory', 1, 500, 'lifetime'),
  ('premiumQuarterly', 'feature.aiClinicalCopilot.vectorMemory', 1, 500, 'lifetime'),
  ('premiumYearly', 'feature.aiClinicalCopilot.vectorMemory', 1, 500, 'lifetime'),
  ('familyPremium', 'feature.aiClinicalCopilot.vectorMemory', 1, 500, 'lifetime');

-- feature.aiClinicalCopilot.firstAid
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow)
VALUES
  ('free', 'feature.aiClinicalCopilot.firstAid', 1, 3, 'month'),
  ('premiumMonthly', 'feature.aiClinicalCopilot.firstAid', 1, NULL, NULL),
  ('premiumQuarterly', 'feature.aiClinicalCopilot.firstAid', 1, NULL, NULL),
  ('premiumYearly', 'feature.aiClinicalCopilot.firstAid', 1, NULL, NULL),
  ('familyPremium', 'feature.aiClinicalCopilot.firstAid', 1, NULL, NULL);

-- feature.aiClinicalCopilot.emergencyGuidance (unlimited for all)
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow)
VALUES
  ('free', 'feature.aiClinicalCopilot.emergencyGuidance', 1, NULL, NULL),
  ('premiumMonthly', 'feature.aiClinicalCopilot.emergencyGuidance', 1, NULL, NULL),
  ('premiumQuarterly', 'feature.aiClinicalCopilot.emergencyGuidance', 1, NULL, NULL),
  ('premiumYearly', 'feature.aiClinicalCopilot.emergencyGuidance', 1, NULL, NULL),
  ('familyPremium', 'feature.aiClinicalCopilot.emergencyGuidance', 1, NULL, NULL);

-- feature.aiClinicalCopilot.doctorHandoff
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow)
VALUES
  ('free', 'feature.aiClinicalCopilot.doctorHandoff', 0, NULL, NULL),
  ('premiumMonthly', 'feature.aiClinicalCopilot.doctorHandoff', 1, 10, 'month'),
  ('premiumQuarterly', 'feature.aiClinicalCopilot.doctorHandoff', 1, 10, 'month'),
  ('premiumYearly', 'feature.aiClinicalCopilot.doctorHandoff', 1, 10, 'month'),
  ('familyPremium', 'feature.aiClinicalCopilot.doctorHandoff', 1, 20, 'month');

-- feature.aiClinicalCopilot.caregiverSummary
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow)
VALUES
  ('free', 'feature.aiClinicalCopilot.caregiverSummary', 0, NULL, NULL),
  ('premiumMonthly', 'feature.aiClinicalCopilot.caregiverSummary', 0, NULL, NULL),
  ('premiumQuarterly', 'feature.aiClinicalCopilot.caregiverSummary', 0, NULL, NULL),
  ('premiumYearly', 'feature.aiClinicalCopilot.caregiverSummary', 0, NULL, NULL),
  ('familyPremium', 'feature.aiClinicalCopilot.caregiverSummary', 1, NULL, NULL);

-- feature.aiClinicalCopilot.evalMode (admin only)
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow)
VALUES
  ('free', 'feature.aiClinicalCopilot.evalMode', 0, NULL, NULL),
  ('premiumMonthly', 'feature.aiClinicalCopilot.evalMode', 0, NULL, NULL),
  ('premiumQuarterly', 'feature.aiClinicalCopilot.evalMode', 0, NULL, NULL),
  ('premiumYearly', 'feature.aiClinicalCopilot.evalMode', 0, NULL, NULL),
  ('familyPremium', 'feature.aiClinicalCopilot.evalMode', 0, NULL, NULL);

-- feature.aiClinicalCopilot.medicalReviewerQueue (admin only)
INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow)
VALUES
  ('free', 'feature.aiClinicalCopilot.medicalReviewerQueue', 0, NULL, NULL),
  ('premiumMonthly', 'feature.aiClinicalCopilot.medicalReviewerQueue', 0, NULL, NULL),
  ('premiumQuarterly', 'feature.aiClinicalCopilot.medicalReviewerQueue', 0, NULL, NULL),
  ('premiumYearly', 'feature.aiClinicalCopilot.medicalReviewerQueue', 0, NULL, NULL),
  ('familyPremium', 'feature.aiClinicalCopilot.medicalReviewerQueue', 0, NULL, NULL);

-- ---------------------------------------------------------
-- 5. Prompt Versions (S6A-T-11)
-- ---------------------------------------------------------
INSERT OR IGNORE INTO HL_promptVersions (promptCode, version, status, contentHash, contentText)
VALUES
  ('clinical_copilot', 'v1.0.0', 'active', 'sha256-clinical-copilot-v1', 'You are iSehat AI Clinical Copilot...'),
  ('symptom_interview', 'v1.0.0', 'active', 'sha256-symptom-interview-v1', 'You are iSehat AI Clinical Copilot conducting a symptom interview...'),
  ('first_aid', 'v1.0.0', 'active', 'sha256-first-aid-v1', 'You are iSehat AI First Aid Guidance Engine...'),
  ('emergency_guidance', 'v1.0.0', 'active', 'sha256-emergency-guidance-v1', 'You are iSehat AI Emergency Guidance Engine...'),
  ('doctor_handoff', 'v1.0.0', 'active', 'sha256-doctor-handoff-v1', 'You are iSehat AI Doctor Handoff Generator...'),
  ('caregiver_summary', 'v1.0.0', 'active', 'sha256-caregiver-summary-v1', 'You are iSehat AI Caregiver Summary Generator...');

-- ---------------------------------------------------------
-- 6. First Aid Protocols (S6F-T-05) — 10 protocols × 2 locales
-- ---------------------------------------------------------
INSERT OR IGNORE INTO HL_firstAidProtocols
  (protocolCode, locale, title, triggerKeywordsJson, redFlagsJson, doStepsJson, dontStepsJson, seekHelpNowJson, reviewerStatus, contentVersion)
VALUES
  -- ID protocols
  ('wound_minor', 'id', 'Luka Ringan & Perdarahan Ringan',
    '["luka","berdarah","tergores","lecet"]',
    '["perdarahan tidak berhenti > 10 menit","luka dalam/lebar","tanda infeksi"]',
    '["Cuci tangan","Bersihkan luka dengan air mengalir","Tutup dengan perban steril"]',
    '["Jangan gunakan kapas langsung pada luka","Jangan tiup luka"]',
    '["Perdarahan tidak berhenti > 10 menit","Luka sangat dalam","Tanda infeksi"]',
    'approved', '1.0.0'),
  ('nosebleed', 'id', 'Mimisan Umum',
    '["mimisan","hidung berdarah"]',
    '["mimisan tidak berhenti > 20 menit","mimisan setelah cedera kepala","pusing berat"]',
    '["Duduk tegak","Condongkan kepala sedikit ke depan","Pinch hidung bagian lunak selama 10 menit"]',
    '["Jangan condongkan kepala ke belakang","Jangan masukkan tisu/serat ke dalam hidung"]',
    '["Mimisan tidak berhenti > 20 menit","Mimisan setelah cedera kepala","Sesak napas"]',
    'approved', '1.0.0'),
  ('burn_minor', 'id', 'Luka Bakar Ringan',
    '["luka bakar","melepuh","terbakar"]',
    '["luka bakar luas","luka di wajah/leher","melepuh besar"]',
    '["Dinginkan dengan air mengalir 10-20 menit","Tutup dengan kain bersih non-lengket"]',
    '["Jangan oles mentega/minyak","Jangan pecahkan lepuh","Jgunakan es langsung"]',
    '["Luka bakar luas","Luka di wajah/leher/tangan kelamin","Luka dalam atau melepuh besar"]',
    'approved', '1.0.0'),
  ('choking', 'id', 'Tersedak',
    '["tersedak","makanan tersangkut","tidak bisa bernapas"]',
    '["tidak bisa batuk/bicara","kulit kebiruan","pingsan"]',
    '["Bertanya: apakah Anda tersedak?","Lakukan heimlich jika tidak bisa batuk","Hubungi 119/112 jika tidak membaik"]',
    '["Jangan tepuk punggung jika batuk kuat","Jangan lakukan heimlich jika batuk efektif"]',
    '["Tidak bisa batuk/bicara","Kulit kebiruan","Pingsan","Sesak tidak membaik"]',
    'approved', '1.0.0'),
  ('fainting', 'id', 'Pingsan / Hampir Pingsan',
    '["pingsan","hilang kesadaran","pusing mau pingsan"]',
    '["pingsan > 1 menit","cedera kepala","nyeri dada sebelum pingsan"]',
    '["Berbaring telentang","Angkat kaki","Longgarkan pakaian ketat","Berikan udara segar"]',
    '["Jangan berikan minum jika sadar penuh belum pulih","Jangan biarkan berdiri sendiri"]',
    '["Pingsan > 1 menit","Cedera kepala","Nyeri dada","Sesak napas"]',
    'approved', '1.0.0'),
  ('fever', 'id', 'Demam Umum',
    '["demam","panas","suhu tinggi"]',
    '["demam > 39.5°C","kejang","sesak napas","ruam merah luas"]',
    '["Minum banyak cairan","Istirahat","Kompres hangat jika merasa kedinginan"]',
    '["Jangan mandi air dingin berlebihan","Jangan berikan antibiotik tanpa resep"]',
    '["Demam > 39.5°C","Kejang","Sesak napas","Ruam merah luas"]',
    'approved', '1.0.0'),
  ('diarrhea', 'id', 'Diare Ringan',
    '["diare","mencret","buang air cair"]',
    '["diare berdarah","dehidrasi berat","demam tinggi > 3 hari"]',
    '["Minum oralit/airsaas","Makan makanan lunak","Istirahat"]',
    '["Jangan minum susu/alkohol/kafein","Jangan minum obat antidiare tanpa konsultasi"]',
    '["Diare berdarah","Dehidrasi berat","Demam tinggi > 3 hari"]',
    'approved', '1.0.0'),
  ('hypoglycemia', 'id', 'Hipoglikemia',
    '["gula darah rendah","hipoglikemia","pusing berkeringat"]',
    '["tidak sadar","kejang","tidak membaik setelah makan"]',
    '["Makan 15g karbohidrat cepat","Ukur ulang gula darah setelah 15 menit"]',
    '["Jangan berikan makanan/minum jika tidak sadar penuh","Jangan tunggu tanpa tindakan"]',
    '["Tidak sadar","Kejang","Tidak membaik setelah makan 15g karbohidrat"]',
    'approved', '1.0.0'),
  ('hypertension', 'id', 'Tekanan Darah Tinggi',
    '["tekanan darah tinggi","hipertensi","bp tinggi"]',
    '["BP > 180/120","nyeri dada","sesak napas","sakit kepala berat"]',
    '["Duduk tenang","Minum air","Ukur ulang setelah 5 menit istirahat"]',
    '["Jangan panik","Jangan ubah dosis obat sendiri"]',
    '["BP > 180/120","Nyeri dada","Sesak napas","Sakit kepala berat","Kebingungan"]',
    'approved', '1.0.0'),
  ('breathing_difficulty', 'id', 'Sesak Napas / Nyeri Dada',
    '["sesak napas","nyeri dada","sulit bernapas"]',
    '["nyeri dada hebat","sesak napas parah","bibir kebiruan","batuk darah"]',
    '["Duduk tegak","Longgarkan pakaian","Hubungi 119/112 segera"]',
    '["Jangan ditunda","Jangan mengemudi sendiri"]',
    '["Nyeri dada hebat","Sesak napas parah","Bibir kebiruan","Batuk darah"]',
    'approved', '1.0.0'),
  -- EN protocols
  ('wound_minor', 'en', 'Minor Wound & Bleeding',
    '["wound","bleeding","cut","scrape"]',
    '["bleeding does not stop > 10 min","deep/wide wound","infection signs"]',
    '["Wash hands","Clean wound with running water","Cover with sterile bandage"]',
    '["Do not put cotton directly on wound","Do not blow on wound"]',
    '["Bleeding does not stop > 10 min","Very deep wound","Signs of infection"]',
    'approved', '1.0.0'),
  ('nosebleed', 'en', 'Nosebleed',
    '["nosebleed","bloody nose"]',
    '["nosebleed > 20 min","nosebleed after head injury","severe dizziness"]',
    '["Sit upright","Lean head slightly forward","Pinch soft part of nose for 10 min"]',
    '["Do not tilt head back","Do not insert tissue/fiber into nose"]',
    '["Nosebleed > 20 min","After head injury","Difficulty breathing"]',
    'approved', '1.0.0'),
  ('burn_minor', 'en', 'Minor Burn',
    '["burn","blister","scalded"]',
    '["large burn area","burn on face/neck","large blister"]',
    '["Cool with running water 10-20 min","Cover with clean non-stick cloth"]',
    '["Do not apply butter/oil","Do not pop blisters","Do not apply ice directly"]',
    '["Large burn area","Burn on face/neck/genitals/hands","Deep burn or large blisters"]',
    'approved', '1.0.0'),
  ('choking', 'en', 'Choking',
    '["choking","food stuck","cannot breathe"]',
    '["cannot cough/speak","blue skin","unconscious"]',
    '["Ask: are you choking?","Perform heimlich if unable to cough","Call emergency if not improving"]',
    '["Do not pat back if cough is strong","Do not perform heimlich if cough is effective"]',
    '["Cannot cough/speak","Blue skin","Unconscious","Breathing not improving"]',
    'approved', '1.0.0'),
  ('fainting', 'en', 'Fainting / Near-Fainting',
    '["fainted","loss of consciousness","dizzy about to faint"]',
    '["unconscious > 1 min","head injury","chest pain before fainting"]',
    '["Lie flat on back","Raise legs","Loosen tight clothing","Provide fresh air"]',
    '["Do not give drink if full consciousness not recovered","Do not let stand alone"]',
    '["Unconscious > 1 min","Head injury","Chest pain","Difficulty breathing"]',
    'approved', '1.0.0'),
  ('fever', 'en', 'Common Fever',
    '["fever","high temperature","hot"]',
    '["fever > 39.5°C","seizure","difficulty breathing","widespread red rash"]',
    '["Drink plenty of fluids","Rest","Use warm compress if feeling cold"]',
    '["Do not bathe in very cold water","Do not give antibiotics without prescription"]',
    '["Fever > 39.5°C","Seizure","Difficulty breathing","Widespread red rash"]',
    'approved', '1.0.0'),
  ('diarrhea', 'en', 'Mild Diarrhea',
    '["diarrhea","loose stool","watery stool"]',
    '["bloody diarrhea","severe dehydration","high fever > 3 days"]',
    '["Drink oral rehydration solution","Eat soft foods","Rest"]',
    '["Avoid milk/alcohol/caffeine","Do not take antidiarrheal without consultation"]',
    '["Bloody diarrhea","Severe dehydration","High fever > 3 days"]',
    'approved', '1.0.0'),
  ('hypoglycemia', 'en', 'Hypoglycemia',
    '["low blood sugar","hypoglycemia","sweaty dizzy"]',
    '["unconscious","seizure","not improving after eating"]',
    '["Eat 15g fast-acting carbohydrate","Recheck blood sugar after 15 min"]',
    '["Do not give food/drink if not fully conscious","Do not wait without action"]',
    '["Unconscious","Seizure","Not improving after 15g fast carbohydrate"]',
    'approved', '1.0.0'),
  ('hypertension', 'en', 'High Blood Pressure',
    '["high blood pressure","hypertension","bp high"]',
    '["BP > 180/120","chest pain","shortness of breath","severe headache"]',
    '["Sit calmly","Drink water","Recheck after 5 min rest"]',
    '["Do not panic","Do not change medication dose yourself"]',
    '["BP > 180/120","Chest pain","Shortness of breath","Severe headache","Confusion"]',
    'approved', '1.0.0'),
  ('breathing_difficulty', 'en', 'Shortness of Breath / Chest Pain',
    '["shortness of breath","chest pain","difficulty breathing"]',
    '["severe chest pain","severe shortness of breath","blue lips","coughing blood"]',
    '["Sit upright","Loosen clothing","Call emergency services immediately"]',
    '["Do not delay","Do not drive yourself"]',
    '["Severe chest pain","Severe shortness of breath","Blue lips","Coughing blood"]',
    'approved', '1.0.0');

-- ---------------------------------------------------------
-- Migration metadata
-- ---------------------------------------------------------
INSERT OR IGNORE INTO HL_schemaMigrations (migrationName, appliedAt)
  VALUES ('004_sprint6_seed', datetime('now'));

-- Post-seed validation:
-- SELECT COUNT(*) FROM HL_featureFlags WHERE flagCode LIKE 'feature.aiClinicalCopilot.%';  -- expected 10
-- SELECT COUNT(*) FROM HL_systemConfigs WHERE configKey LIKE 'aiGateway.%' OR configKey LIKE 'vectorize.%' OR configKey LIKE 'clinicalCopilot.%' OR configKey LIKE 'whatsappAi.%' OR configKey LIKE 'medicalSafetyRuntime.%' OR configKey LIKE 'workersAi.%' OR configKey LIKE 'aiSearch.%' OR configKey LIKE 'kv.%' OR configKey LIKE 'firstAid.%';  -- expected 38
-- SELECT COUNT(*) FROM HL_permissions WHERE permissionCode LIKE 'admin.ai%';  -- expected 7
-- SELECT COUNT(*) FROM HL_planFeatures WHERE featureCode LIKE 'feature.aiClinicalCopilot.%';  -- expected 50
-- SELECT COUNT(*) FROM HL_promptVersions WHERE status='active';  -- expected 6
-- SELECT COUNT(*) FROM HL_firstAidProtocols WHERE reviewerStatus='approved';  -- expected 20
