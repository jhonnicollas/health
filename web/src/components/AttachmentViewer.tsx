import { useMetricLabels } from '../i18n/useI18n'

export type HistoryAttachment = {
  id: number
  metricCode: string
  fileName: string
}

export function AttachmentViewer({
  attachment,
  onClose
}: {
  attachment: HistoryAttachment | null
  onClose: () => void
}) {
  const ml = useMetricLabels()
  if (!attachment) return null
  return (
    <div className="evidence-modal" role="dialog" aria-modal="true" aria-label="Bukti pengukuran">
      <div className="evidence-lightbox">
        <div className="page-heading compact">
          <h3>{ml[attachment.metricCode] || attachment.metricCode} bukti</h3>
          <button onClick={onClose} type="button">Tutup</button>
        </div>
        <img alt="Bukti pengukuran berwatermark" src={`/api/measurements/attachments/${attachment.id}`} />
      </div>
    </div>
  )
}
