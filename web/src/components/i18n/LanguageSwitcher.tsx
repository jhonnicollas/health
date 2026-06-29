import { useState, useRef, useEffect } from 'react'
import { useI18n, SUPPORTED_LOCALES, type SupportedLocale } from '../../i18n'

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  'id-ID': '🇮🇩 ID',
  'en-US': '🇬🇧 EN',
}

const LOCALE_FULL: Record<SupportedLocale, string> = {
  'id-ID': 'Bahasa Indonesia',
  'en-US': 'English',
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: compact ? '4px 10px' : '8px 14px',
          borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer',
          fontSize: 13, fontWeight: 700, color: '#111827',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>language</span>
        {compact ? LOCALE_LABELS[locale] : LOCALE_FULL[locale]}
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>expand_more</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 160,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
          boxShadow: '0 8px 28px -6px rgba(0,0,0,0.18)', zIndex: 200, padding: 4, overflow: 'hidden',
        }}>
          {SUPPORTED_LOCALES.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => { setLocale(l); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px',
                border: 'none', background: locale === l ? '#f3f4f6' : 'transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: locale === l ? 800 : 600,
                color: locale === l ? '#111827' : '#6b7280', textAlign: 'left', borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 18 }}>{LOCALE_LABELS[l]}</span>
              {LOCALE_FULL[l]}
              {locale === l && <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: 18 }}>check</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
