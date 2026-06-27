import { useRef, type KeyboardEvent, type ClipboardEvent } from 'react'

type Props = {
  length?: number
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
}

export function OtpInput({ length = 6, value, onChange, disabled, autoFocus }: Props) {
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  function focusIndex(idx: number) {
    const el = inputs.current[idx]
    if (el) { el.focus(); el.select() }
  }

  function handleChange(idx: number, char: string) {
    if (!/^\d*$/.test(char)) return
    const digits = value.split('')
    digits[idx] = char.slice(-1)
    const next = digits.join('').padEnd(length, ' ').slice(0, length).trimEnd()
    onChange(next.length <= length ? next : next.slice(0, length))
    if (char && idx < length - 1) focusIndex(idx + 1)
  }

  function handleKeyDown(idx: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      focusIndex(idx - 1)
    }
  }

  function handlePaste(e: ClipboardEvent) {
    e.preventDefault()
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, length)
    onChange(text)
    focusIndex(Math.min(text.length, length - 1))
  }

  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          style={{
            width: 48, height: 56, textAlign: 'center', fontSize: 24, fontWeight: 700,
            border: '1px solid #d1d5db', borderRadius: 8, outline: 'none',
            background: disabled ? '#f3f4f6' : '#fff'
          }}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  )
}
