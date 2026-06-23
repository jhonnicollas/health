import { useState } from 'react'

type VitalSnapshot = {
  metricCode: string
  finalValue: number
  unit: string
  status: string
  severity: string
  measuredAt?: string
}

type AiAssistantResponse = {
  success: boolean
  data?: {
    reply: string
    model: string
    usedFallback: boolean
    vitals: VitalSnapshot[]
  }
  error?: { message: string }
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  model?: string
  usedFallback?: boolean
}

function AiAssistantPage() {
  const [question, setQuestion] = useState('Saran makan malam untuk hipertensi')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Halo. Saya bisa membantu merangkum data vital terbaru dan memberi edukasi gaya hidup umum yang aman.'
    }
  ])
  const [vitals, setVitals] = useState<VitalSnapshot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const body = (await res.json()) as AiAssistantResponse
      if (!res.ok || !body.success || !body.data) {
        setError(body.error?.message ?? 'AI assistant failed to respond.')
        return
      }
      setVitals(body.data.vitals)
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
      setError('Could not connect to server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="settings-panel ai-assistant-panel" aria-labelledby="ai-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">AI Assistant</p>
          <h2 id="ai-title">Safe Health Chat</h2>
          <p>LLM uses latest vital context, but does not provide diagnosis or medication dosage.</p>
        </div>
        <span className="status-chip">Rule-first</span>
      </div>

      <div className="ai-context-banner">
        <div>
          <p className="eyebrow">Current Health Context</p>
          <h3>{vitals.length > 0 ? `${vitals.length} latest vitals injected` : 'Vitals context ready'}</h3>
          <p>Responses use this context only for education. Medical status still follows the rule engine.</p>
        </div>
        {vitals.length === 0 ? <span className="status-chip">No vitals yet</span> : (
          <div className="vital-strip" aria-label="Latest vitals">
            {vitals.map((value) => (
              <span key={`${value.metricCode}-${value.finalValue}`}>
                <span className={`badge-status badge-${value.severity}`}><span className="status-dot" />{value.metricCode}</span>: {value.finalValue} {value.unit}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="ai-safety-note" role="note">
        AI hanya memberi edukasi umum. AI tidak membuat diagnosis, tidak menentukan tingkat keparahan, dan tidak mengubah dosis obat.
      </div>

      <div className="ai-chat-window" aria-live="polite">
        {messages.map((message) => (
          <article className={`chat-bubble ${message.role}`} key={message.id}>
            <div className="chat-meta">
              <span>{message.role === 'user' ? 'You' : 'HL AI'}</span>
              {message.model ? <span>{message.usedFallback ? 'fallback' : message.model}</span> : null}
            </div>
            <p>{message.content}</p>
          </article>
        ))}
        {loading ? (
          <article className="chat-bubble assistant typing">
            <div className="chat-meta"><span>HL AI</span><span>typing</span></div>
            <p>Menyiapkan jawaban aman...</p>
          </article>
        ) : null}
      </div>

      <div className="settings-card ai-compose-card">
        <label>
          Question
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
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>

      {error ? <p className="form-message error" role="status">{error}</p> : null}
    </section>
  )
}

export default AiAssistantPage
export { AiAssistantPage }
