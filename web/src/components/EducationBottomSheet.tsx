/* eslint-disable @typescript-eslint/no-explicit-any, no-empty */
import { useEffect, useState } from 'react'

type Props = { topicType: string; visible: boolean; onClose: () => void }

export function EducationBottomSheet({ topicType, visible, onClose }: Props) {
  const [card, setCard] = useState<any>(null)

  useEffect(() => {
    if (!visible || !topicType) return
    ;(async () => {
      try {
        const r = await fetch(`/api/education/cards?topicType=${encodeURIComponent(topicType)}&firstTimeOnly=true`, { credentials: 'include' })
        const j = await r.json()
        if (j.success && j.data?.length > 0) setCard(j.data[0])
        else setCard(null)
      } catch { setCard(null) }
    })()
  }, [visible, topicType])

  if (!visible) return null

  async function acknowledge() {
    if (!card) return
    try {
      await fetch(`/api/education/cards/${card.topicType}/${card.topicCode}/acknowledge`, { method: 'POST', credentials: 'include' })
    } catch {}
    setCard(null); onClose()
  }

  if (!card) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) acknowledge() }}>
      <div style={{ background: 'var(--colorSurfaceElevated, #fff)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 500, padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 8px' }}>{card.title}</h3>
        {card.shortText && <p style={{ margin: '0 0 12px', color: 'var(--colorTextSecondary)' }}>{card.shortText}</p>}
        {card.whyItMatters && <div style={{ padding: 10, borderRadius: 8, background: 'var(--colorSurfaceContainer)', marginBottom: 12 }}><strong>Mengapa Penting</strong><p style={{ margin: '4px 0 0', fontSize: 14 }}>{card.whyItMatters}</p></div>}
        {card.warningMeaning && <div style={{ padding: 10, borderRadius: 8, background: 'color-mix(in srgb, var(--colorStatusCritical) 10%, transparent)', marginBottom: 12 }}><strong style={{ color: 'var(--colorStatusCritical)' }}>Tanda Peringatan</strong><p style={{ margin: '4px 0 0', fontSize: 14 }}>{card.warningMeaning}</p></div>}
        {card.actionText && <p style={{ fontStyle: 'italic', marginBottom: 16 }}>{card.actionText}</p>}
        <button className="btn-primary" onClick={acknowledge} style={{ width: '100%' }}>Saya Mengerti</button>
      </div>
    </div>
  )
}
