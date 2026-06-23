export function UnitInfoModal({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="evidence-modal" role="dialog" aria-modal="true" aria-label="Unit glossary">
      <div className="evidence-lightbox">
        <div className="page-heading compact">
          <h3>Satuan yang Digunakan</h3>
          <button onClick={onClose} type="button">Tutup</button>
        </div>
        <table className="report-table" style={{ marginTop: 0 }}>
          <thead>
            <tr><th>Satuan</th><th>Untuk Metrik</th></tr>
          </thead>
          <tbody>
            <tr><td><code>%</code></td><td>SpO2 (Saturasi Oksigen)</td></tr>
            <tr><td><code>bpm</code></td><td>Denyut Jantung, Pulse Tensimeter</td></tr>
            <tr><td><code>mmHg</code></td><td>Sistolik, Diastolik</td></tr>
            <tr><td><code>mg/dL</code></td><td>Gula Darah, Kolesterol, Asam Urat</td></tr>
            <tr><td><code>kg</code></td><td>Berat Badan</td></tr>
            <tr><td><code>cm</code></td><td>Lingkar Perut</td></tr>
            <tr><td><code>°C</code></td><td>Suhu Tubuh</td></tr>
            <tr><td><code>index</code></td><td>BMI (Body Mass Index)</td></tr>
            <tr><td><code>hour</code></td><td>Durasi Tidur</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
