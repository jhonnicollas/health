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
  if (!attachment) return null
  return (
    <div className="evidence-modal" role="dialog" aria-modal="true" aria-label="Measurement evidence">
      <div className="evidence-lightbox">
        <div className="page-heading compact">
          <h3>{attachment.metricCode} evidence</h3>
          <button onClick={onClose} type="button">Close</button>
        </div>
        <img alt="Watermarked measurement evidence" src={`/api/measurements/attachments/${attachment.id}`} />
      </div>
    </div>
  )
}
