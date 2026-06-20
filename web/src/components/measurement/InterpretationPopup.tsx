import { useState } from 'react'
import './InterpretationPopup.css'

export type InterpretationValue = {
  metricCode: string
  metricName?: string
  finalValue: number
  unit: string
  status: string
  severity: 'normal' | 'info' | 'warning' | 'high' | 'critical' | 'emergency'
  popupTitle?: string | null
  popupMessage?: string | null
  recommendation?: string | null
  sourceLabel?: string
}

type InterpretationPopupProps = {
  values: InterpretationValue[]
  onClose: () => void
  onConfirm: () => void
}

const SEVERITY_RANK: Record<string, number> = {
  emergency: 0,
  critical: 1,
  high: 2,
  warning: 3,
  info: 4,
  normal: 5
}

export function InterpretationPopup({ values, onClose, onConfirm }: InterpretationPopupProps) {
  const sorted = [...values].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
  )
  const hasEmergency = sorted.some(v => v.severity === 'emergency' || v.severity === 'critical')
  const [confirmed, setConfirmed] = useState(!hasEmergency)

  return (
    <div className="popup-overlay" role="dialog" aria-modal="true">
      <div className="popup-card">
        <h2 className="popup-title">
          {hasEmergency ? '⚠️ Peringatan: Nilai Kritis Terdeteksi' : 'Hasil Pengukuran'}
        </h2>
        {hasEmergency && (
          <p className="popup-disclaimer">
            Nilai berikut memerlukan perhatian. Ini bukan diagnosis medis. Harap verifikasi ulang dan konsultasikan dengan dokter.
          </p>
        )}
        {sorted.map((v, idx) => (
          <div key={idx} className={`popup-item severity-${v.severity}`}>
            <div className="popup-item-header">
              <strong>{v.metricName || v.metricCode}</strong>
              <span className={`badge badge-${v.severity}`}>{v.severity}</span>
            </div>
            <div className="popup-item-value">
              {v.finalValue} <span className="unit">{v.unit}</span>
              <span className="status">→ {v.status}</span>
            </div>
            {v.popupTitle && <div className="popup-item-popup-title">{v.popupTitle}</div>}
            {v.popupMessage && <p className="popup-item-popup-message">{v.popupMessage}</p>}
            {v.recommendation && <p className="popup-item-recommendation">💡 {v.recommendation}</p>}
            {v.sourceLabel && <small className="popup-item-source">Sumber: {v.sourceLabel}</small>}
          </div>
        ))}
        {hasEmergency && (
          <label className="popup-confirm-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            Saya mengerti bahwa ini bukan diagnosis dan perlu verifikasi ulang.
          </label>
        )}
        <div className="popup-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
          <button
            type="button"
            className="btn-primary"
            onClick={onConfirm}
            disabled={hasEmergency && !confirmed}
          >
            {hasEmergency ? 'Saya Mengerti' : 'Konfirmasi & Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
export default InterpretationPopup
