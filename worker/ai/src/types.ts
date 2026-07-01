export type Bindings = {
  DB: D1Database
  LOGS: R2Bucket
  VECTORIZE_INDEX: VectorizeIndex
  AI_KV: KVNamespace
  AI_CHAT_SESSION_DO: DurableObjectNamespace
  WHATSAPP_SESSION_DO: DurableObjectNamespace
  USER_AI_LOCK_DO: DurableObjectNamespace
  MODEL_STREAMING_DO: DurableObjectNamespace
  JOB_PROGRESS_DO: DurableObjectNamespace
  AI_MEMORY_QUEUE?: Queue
  WHATSAPP_OUTBOUND_QUEUE?: Queue
  AI: Ai
  WHATSAPP_MAX_REPLY_CHARS?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_API_TOKEN?: string
  '9ROUTER_API_KEY'?: string
  AI_GATEWAY_ENABLED?: string
  VECTORIZE_MAX_VECTORS_PER_USER?: string
  VECTORIZE_ALERT_THRESHOLD_PERCENT?: string
  CLINICAL_COPILOT_ENABLED?: string
  MEDICAL_SAFETY_RUNTIME_ENABLED?: string
  MEDICAL_SAFETY_RUNTIME_STRICT_MODE?: string
}
