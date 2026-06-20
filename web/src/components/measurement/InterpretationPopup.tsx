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

export function InterpretationPopup({ values, onClose, onConfirm }: InterpretationPopupProps) {
  const hasEmergency = values.some(v => v.severity === 'emergency')
  return (
    <div className="popup-overlay" role="dialog" aria-modal="true">
      <div className="popup-card">
        <h2 className="popup-title">Hasil Pengukuran</h2>
        {values.map((v, idx) => (
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
        <div className="popup-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            {hasEmergency ? 'Saya Mengerti' : 'Konfirmasi & Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
export default InterpretationPopup
