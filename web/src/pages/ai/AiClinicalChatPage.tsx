import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { translateErrorCode } from '../../api/translateError'
import { SafetyDisclaimerBox } from '../../components/ai/SafetyDisclaimerBox'
import { DataSufficiencyBadge } from '../../components/ai/DataSufficiencyBadge'
import { ContextTraceDrawer, type ContextTraceItem } from '../../components/ai/ContextTraceDrawer'
import { EmergencyGuidanceCard } from '../../components/ai/EmergencyGuidanceCard'
import { FirstAidProtocolCard } from '../../components/ai/FirstAidProtocolCard'



type ClinicalResponse = {
  success: boolean
  data?: {
    sessionId?: number
    sessionUuid?: string
    status?: string
    messageId?: number
    reply?: string
    answerType?: string
    disclaimer?: string
    contextTrace?: ContextTraceItem[]
    dataSufficiencyScore?: number
    dataSufficiencyLabel?: string
    followUpQuestions?: string[]
    modelName?: string
    usedFallback?: boolean
    protocolCode?: string | null
    protocolTitle?: string
    redFlagStatus?: string
    safetyDecision?: string
  }
  error?: { code: string; message?: string }
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  answerType?: string
  protocol?: {
    title: string
    redFlags: string[]
    doSteps: string[]
    dontSteps: string[]
    seekHelp: string[]
    reviewerStatus: string
  }
}

function parseFirstAidProtocol(text: string, fallbackTitle?: string) {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  const title = lines[0] || fallbackTitle || 'Panduan P3K'
  const redFlags: string[] = []
  const doSteps: string[] = []
  const dontSteps: string[] = []
  const seekHelp: string[] = []
  let current: string[] | null = null
  let reviewerStatus = 'approved'

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (/status reviewer|reviewer status/i.test(line)) {
      const m = line.match(/:\s*(.+)/)
      if (m) reviewerStatus = m[1].trim()
      continue
    }
    if (/^🔴\s*(TANDA BAHAYA|RED FLAGS)/i.test(line)) { current = redFlags; continue }
    if (/^🟢\s*(LAKUKAN|DO)/i.test(line)) { current = doSteps; continue }
    if (/^🔴\s*(JANGAN DILAKUKAN|DON'T)/i.test(line)) { current = dontSteps; continue }
    if (/^🟠\s*(SEGERA CARI BANTUAN|SEEK HELP)/i.test(line)) { current = seekHelp; continue }
    if (current && (line.startsWith('-') || /^\d+\./.test(line))) {
      current.push(line.replace(/^[-\d.\s]+/, '').trim())
    }
  }

  return { title, redFlags, doSteps, dontSteps, seekHelp, reviewerStatus }
}

export function AiClinicalChatPage() {
  const { t, locale } = useI18n()
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sufficiency, setSufficiency] = useState<{ score?: number; label?: string }>({})
  const [trace, setTrace] = useState<ContextTraceItem[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    // Deliberate one-time session initialization on mount; locale/t are stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStarting(true)
    setError(null)
    fetch('/api/ai/clinical/session/start', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionType: 'general' })
    })
      .then(async (r) => {
        const body = (await r.json()) as ClinicalResponse
        if (!r.ok || !body.success || !body.data?.sessionId) {
          throw new Error(body.error?.code ? translateErrorCode(body.error.code, locale, body.error.message) : t('ai.clinicalSessionClosed'))
        }
        setSessionId(body.data.sessionId)
      })
      .catch((e) => setError(e instanceof Error ? e.message : t('ai.aiFailed')))
      .finally(() => setStarting(false))
  }, [locale, t])

  async function sendMessage() {
    const text = input.trim()
    if (!text || !sessionId) return
    setLoading(true)
    setError(null)
    setInput('')
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    try {
      const res = await fetch('/api/ai/clinical/message', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: text, locale })
      })
      const body = (await res.json()) as ClinicalResponse
      if (!res.ok || !body.success || !body.data) {
        setError(body.error?.code ? translateErrorCode(body.error.code, locale, body.error.message) : t('ai.aiFailed'))
        return
      }
      const data = body.data
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply ?? '',
        answerType: data.answerType,
        protocol: data.answerType === 'first_aid_guidance' ? parseFirstAidProtocol(data.reply ?? '', data.protocolTitle) : undefined,
      }
      setMessages((prev) => [...prev, assistantMsg])
      setSufficiency({ score: data.dataSufficiencyScore, label: data.dataSufficiencyLabel })
      setTrace(data.contextTrace ?? [])
    } catch {
      setError(t('ai.connError'))
    } finally {
      setLoading(false)
    }
  }

  async function closeSession() {
    if (!sessionId) return
    setLoading(true)
    try {
      await fetch(`/api/ai/clinical/sessions/${sessionId}/close`, {
        method: 'POST',
        credentials: 'include'
      })
      setSessionId(null)
      setMessages((prev) => [...prev, { id: `sys-${Date.now()}`, role: 'assistant', content: t('ai.clinicalSessionClosed') }])
    } catch {
      setError(t('ai.connError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="settings-panel ai-clinical-panel" aria-labelledby="clinical-title">
      <div className="page-heading">
        <div>
          <h2 id="clinical-title">{t('ai.clinicalTitle')}</h2>
          <p>{t('ai.clinicalSubtitle')}</p>
        </div>
      </div>

      <SafetyDisclaimerBox />

      <div className="ai-clinical-toolbar">
        <DataSufficiencyBadge score={sufficiency.score} label={sufficiency.label} />
        <button className="btn-secondary" onClick={() => setDrawerOpen(true)} type="button" disabled={trace.length === 0}>
          {t('ai.clinicalContextTrace')}
        </button>
        <button className="btn-secondary" onClick={() => void closeSession()} type="button" disabled={!sessionId || loading}>
          {t('ai.clinicalCloseSession')}
        </button>
      </div>

      <div className="ai-chat-window clinical-chat" aria-live="polite">
        {starting ? (
          <p className="loading-text">{t('ai.clinicalLoading')}</p>
        ) : (
          <>
            {messages.map((msg) => {
              if (msg.role === 'assistant' && msg.answerType === 'emergency_guidance') {
                return <EmergencyGuidanceCard key={msg.id} text={msg.content} />
              }
              if (msg.role === 'assistant' && msg.answerType === 'first_aid_guidance' && msg.protocol) {
                return (
                  <FirstAidProtocolCard
                    key={msg.id}
                    title={msg.protocol.title}
                    redFlags={msg.protocol.redFlags}
                    doSteps={msg.protocol.doSteps}
                    dontSteps={msg.protocol.dontSteps}
                    seekHelp={msg.protocol.seekHelp}
                    reviewerStatus={msg.protocol.reviewerStatus}
                  />
                )
              }
              return (
                <article className={`chat-bubble ${msg.role}`} key={msg.id}>
                  <div className="chat-meta">
                    <span>{msg.role === 'user' ? t('ai.you') : t('ai.hlAi')}</span>
                  </div>
                  <p>{msg.content}</p>
                </article>
              )
            })}
            {loading && (
              <article className="chat-bubble assistant typing">
                <div className="chat-meta"><span>{t('ai.hlAi')}</span><span>{t('ai.typing')}</span></div>
                <p>{t('ai.preparingAnswer')}</p>
              </article>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="settings-card ai-compose-card">
        <label className="sr-only" htmlFor="clinical-input">{t('ai.clinicalInputPlaceholder')}</label>
        <textarea
          id="clinical-input"
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void sendMessage()
            }
          }}
          placeholder={t('ai.clinicalInputPlaceholder')}
          disabled={!sessionId || loading}
        />
        <button type="button" onClick={() => void sendMessage()} disabled={!input.trim() || !sessionId || loading}>
          {loading ? t('ai.sending') : t('ai.clinicalSend')}
        </button>
      </div>

      {error ? <p className="form-message error" role="status">{error}</p> : null}

      <ContextTraceDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} trace={trace} />
    </section>
  )
}

export default AiClinicalChatPage
