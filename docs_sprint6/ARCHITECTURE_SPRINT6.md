# iSehat Sprint 6 Architecture

## 4-Worker Topology

```text
#1 isehat-api-worker    (worker/apps)   — Auth, consent, entitlement, quota, rate limit,
                                          proxy to AI worker, admin APIs.
#2 isehat-ai-worker     (worker/ai)     — Clinical orchestrator, Safety Runtime v2,
                                          Vectorize memory, ModelRouter, emergency engine.
#3 isehat-jobs-worker   (worker/cron)   — Cron triggers, queue consumers, data retention,
                                          WhatsApp outbound, eval jobs.
#4 isehat-webhooks-worker (worker/webhook) — External webhook gateway (WhatsApp Baileys,
                                              Telegram, Xendit), signature validation, dedup.
```

## Data Flow

```text
User Request
  → #1 Auth + Consent + Entitlement + Quota + Rate Limit
  → #1 routes-ai proxy → Service Binding → #2
  → #2 Intent Classifier
  → Deterministic Red Flag Precheck
  → Clinical Context Package Build (D1 + Vectorize)
  → Prompt Assembly
  → ModelRouter (AI Gateway → Workers AI → safe template)
  → Medical Safety Runtime v2 (13 detectors)
  → Response Formatter (disclaimer injection)
  → Store + Log
  → #2 returns to #1, #1 returns to user
```

## Safety Runtime Position

The Safety Runtime runs **after** the LLM generates output. It is the final gate before the user sees any AI-generated medical text. It enforces the rule-first boundary from PRD §0.1 and AI_SAFETY_RUNTIME_SPEC.md §3.

## Key Components

| Component | Worker | Responsibility |
|---|---|---|
| `MedicalSafetyRuntime` | #2 | 13 detectors, SafetyDecision enum, blocked templates |
| `ClinicalContextPackageBuilder` | #2 | D1 summary + Vectorize + context trace |
| `VectorizeService` | #2 | Per-user namespace isolation, embedding, rebuild/delete |
| `ModelRouter` | #2 | 3-tier fallback chain, model run logging |
| `ClinicalOrchestrator` | #2 | Full message flow from intent to formatted reply |
| `WhatsAppSessionDO` | #2 | Per-link Durable Object ordering + idempotency |
| `Data Retention Cron` | #3 | expire, nullify, delete, archive old data |
| `Webhook Gateway` | #4 | Validate, dedup, forward to #1/#2/#3 |

## Storage

- **D1**: Users, profiles, measurements, symptoms, medications, sessions, messages, model runs, safety flags, audit logs, vector document metadata.
- **Vectorize**: Per-user semantic memory (`user:{userId}` namespace).
- **R2**: Archived model runs/safety flags, media ingest.
- **KV**: Prompt versions, routing config, system config cache.
