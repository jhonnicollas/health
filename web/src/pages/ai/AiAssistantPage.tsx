import { useEffect, useState } from 'react'
import { useI18n, useMetricLabels } from '../../i18n/useI18n'
import { translateErrorCode } from '../../api/translateError'

type VitalSnapshot = {
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  measuredAt?: string
}

type AiRecommendation = {
  id: number
  sessionId?: number
  summaryText: string
  safetyStatus: string
  modelName?: string
  createdAt: string
}

type AiAssistantResponse = {
  success: boolean
  data?: {
    reply: string
    model: string
    usedFallback: boolean
    vitals: VitalSnapshot[]
    dataSufficiencyScore?: number
    scoreReason?: string
  }
  error?: { message: string; code?: string }
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  model?: string
  usedFallback?: boolean
}

function AiAssistantPage() {
  const { t, locale } = useI18n()
  const ml = useMetricLabels()
  const [question, setQuestion] = useState(t('ai.defaultQuestion'))
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: t('ai.welcomeMsg')
    }
  ])
  const [vitals, setVitals] = useState<VitalSnapshot[]>([])
  const [dataSufficiencyScore, setDataSufficiencyScore] = useState<number | null>(null)
  const [scoreReason, setScoreReason] = useState('')
  const [contextTraceOpen, setContextTraceOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>([])
  const [recsLoading, setRecsLoading] = useState(true)
  const [recsError, setRecsError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ai/recommendations?limit=10', { credentials: 'include' })
      .then(r => { if (!r.ok) { setRecsError(t('ai.recLoadFailed')); return null } return r.json() as Promise<{ success: boolean; data?: { recommendations: AiRecommendation[] }; error?: { message: string } }> })
      .then(body => { if (body && body.success && body.data?.recommendations) setRecommendations(body.data.recommendations) })
      .catch(() => { setRecsError(t('ai.connError')) })
      .finally(() => setRecsLoading(false))
  }, [t])

  async function ask() {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) return

    setLoading(true)
    setError(null)
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedQuestion
    }
    setMessages((prev) => [...prev, userMessage])
    setQuestion('')
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmedQuestion })
      })
      if (!res.ok) {
        setError(t('ai.aiFailed'))
        return
      }
      const body = (await res.json()) as AiAssistantResponse
      if (!res.ok || !body.success || !body.data) {
        setError(body.error?.code ? translateErrorCode(body.error.code, locale, body.error.message) : t('ai.aiFailed'))
        return
      }
      setVitals(body.data.vitals)
      setDataSufficiencyScore(body.data?.dataSufficiencyScore ?? null)
      setScoreReason(body.data?.scoreReason ?? '')
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: body.data?.reply ?? '',
          model: body.data?.model,
          usedFallback: body.data?.usedFallback
        }
      ])
    } catch {
      setError(t('ai.connError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="settings-panel ai-assistant-panel" aria-labelledby="ai-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t('ai.assistantEyebrow')}</p>
          <h2 id="ai-title">{t('ai.assistantTitle')}</h2>
          <p>{t('ai.assistantSubtitle')}</p>
        </div>
        <span className="status-chip">{t('ai.ruleFirst')}</span>
      </div>

      <div className="ai-context-banner">
        <div>
          <p className="eyebrow">{t('ai.currentContext')}</p>
          <h3>{vitals.length > 0 ? `${vitals.length} ${t('ai.vitalsInjected')}` : t('ai.vitalsReady')}</h3>
          <p>{t('ai.contextEduNote')}</p>
        </div>
        {vitals.length === 0 ? <span className="status-chip">{t('ai.noVitals')}</span> : (
          <div className="vital-strip" aria-label="Latest vitals">
            {vitals.map((value) => (
              <span key={`${value.metricCode}-${value.finalValue}`}>
                <span className={`badge-status badge-${value.severity}`}><span className="status-dot" />{ml[value.metricCode] || value.metricCode}</span>: {value.finalValue} {value.unit}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="ai-safety-note" role="note">
        {t('ai.safetyNote')}
      </div>

      {dataSufficiencyScore !== null && (
        <div className="settings-card" style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setContextTraceOpen(!contextTraceOpen)}>
            <h3 style={{ font: 'var(--typHeadlineSm)', margin: 0 }}>{t('ai.contextTrace')}</h3>
            <span style={{ fontSize: 12 }}>{contextTraceOpen ? '▲' : '▼'}</span>
          </div>
          {contextTraceOpen && (
            <div style={{ marginTop: 8 }}>
              <p>{t('ai.dataSufficiency')} <strong>{dataSufficiencyScore}/100</strong></p>
              {scoreReason && <p style={{ fontSize: 13, color: '#666' }}>{scoreReason}</p>}
              <p style={{ fontSize: 12, marginTop: 4 }}>{t('ai.vectorContext')} <span className="status-chip">{t('ai.vectorUnavailable')}</span></p>
            </div>
          )}
        </div>
      )}

      <div className="settings-card" style={{ marginTop: 8 }}>
        <h3 style={{ font: 'var(--typHeadlineSm)', margin: '0 0 8px' }}>{t('ai.sprint6Readiness')}</h3>
        <p style={{ fontSize: 13 }}>{t('ai.sprint6Note')}</p>
        <a href="/ai-memory" style={{ fontSize: 13, color: '#3182ce' }}>{t('ai.manageMemory')}</a>
      </div>

      {recommendations.length > 0 || !recsLoading ? (
        <div className="settings-card" style={{ marginTop: 16 }}>
          <h3 style={{ font: 'var(--typHeadlineSm)', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>history</span>
            {t('ai.recHistory')}
          </h3>
          {recsLoading ? <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextMuted)' }}>{t('ai.loading')}</p> : null}
          {!recsLoading && recommendations.length === 0 ? <p style={{ font: 'var(--typBodySm)', color: 'var(--colorTextMuted)' }}>{recsError || t('ai.noRecs')}</p> : null}
          {recommendations.map(rec => (
            <div key={rec.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--colorBorderSoft)' }}>
              <p style={{ font: 'var(--typBodySm)', margin: '0 0 4px' }}>{rec.summaryText}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className={`badge-status badge-${rec.safetyStatus === 'safe' ? 'normal' : rec.safetyStatus === 'filtered' ? 'warning' : 'info'}`}><span className="status-dot" />{rec.safetyStatus}</span>
                {rec.modelName ? <span className="meta" style={{ fontSize: '0.75em' }}>{rec.modelName}</span> : null}
                <span className="meta" style={{ fontSize: '0.75em' }}>{new Date(rec.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="ai-chat-window" aria-live="polite">
        {messages.map((message) => (
          <article className={`chat-bubble ${message.role}`} key={message.id}>
            <div className="chat-meta">
              <span>{message.role === 'user' ? t('ai.you') : t('ai.hlAi')}</span>
              {message.model ? <span>{message.usedFallback ? 'fallback' : message.model}</span> : null}
            </div>
            <p>{message.content}</p>
          </article>
        ))}
        {loading ? (
          <article className="chat-bubble assistant typing">
            <div className="chat-meta"><span>{t('ai.hlAi')}</span><span>{t('ai.typing')}</span></div>
            <p>{t('ai.preparingAnswer')}</p>
          </article>
        ) : null}
      </div>

      <div className="settings-card ai-compose-card">
        <label>
          {t('ai.question')}
          <textarea
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()
                void ask()
              }
            }}
            rows={4}
            value={question}
          />
        </label>
        <button disabled={loading || !question.trim()} onClick={() => void ask()} type="button">
          {loading ? t('ai.sending') : t('ai.send')}
        </button>
      </div>

      {error ? <p className="form-message error" role="status">{error}</p> : null}
    </section>
  )
}

export default AiAssistantPage
export { AiAssistantPage }
