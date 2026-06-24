import { useState } from 'react'
import './EmergencyModal.css'

export type EmergencyModalProps = {
  open: boolean
  title: string
  message: string
  recommendation?: string | null
  onAcknowledge: () => void
}

export function EmergencyModal({ open, title, message, recommendation, onAcknowledge }: EmergencyModalProps) {
  const [checked, setChecked] = useState(false)
  if (!open) return null
  return (
    <div className="emergency-modal-overlay" role="alertdialog" aria-modal="true">
      <div className="emergency-modal-card">
        <div className="emergency-modal-icon">⚠️</div>
        <h2 className="emergency-modal-title">{title}</h2>
        <p className="emergency-modal-message">{message}</p>
        {recommendation && (
          <p className="emergency-modal-recommendation">💡 {recommendation}</p>
        )}
        <label className="emergency-modal-checkbox">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>Saya mengerti bahwa ini bukan diagnosis dan perlu verifikasi ulang.</span>
        </label>
        <button type="button" className="emergency-modal-button" disabled={!checked} onClick={() => { setChecked(false); onAcknowledge() }}>
          Saya Mengerti
        </button>
      </div>
    </div>
  )
}
export default EmergencyModal
