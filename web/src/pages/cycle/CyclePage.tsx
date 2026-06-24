/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/auth'

export function CyclePage() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<any>(null); const [prediction, setPrediction] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/cycle/settings', { credentials: 'include', headers: { Accept: 'application/json' } }).then(r => r.json()).then(r => {
      setLoading(false)
      if (r.success) { setSettings(r.data.settings); setPrediction(r.data.prediction) }
    }).catch(() => setLoading(false))
  }, [])

  if (!user) return <section className="settings-panel"><h2>Silakan login</h2></section>
  return (
    <section className="settings-panel">
      <div className="page-heading"><h2>Siklus</h2></div>
      {loading ? <p>Memuat...</p> : !settings ? <p>Atur siklus di pengaturan untuk mulai melacak.</p> : (
        <div>
          <p>Siklus: {settings.cycleLengthDays} hari | Periode: {settings.periodLengthDays} hari</p>
          {prediction && <div><p>Prediksi ovulasi: {prediction.ovulationDay}</p><p>Masa subur: {prediction.fertileStart} - {prediction.fertileEnd}</p><p>Periode berikutnya: {prediction.nextPeriod}</p></div>}
        </div>
      )}
    </section>
  )
}
