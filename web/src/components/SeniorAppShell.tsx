import { useEffect, useRef, useState } from 'react'
import { TodayDashboard } from '../pages/dashboard/TodayDashboard'
import { SeniorMeasurementFlow } from '../pages/measurement/SeniorMeasurementFlow'
import { EmergencyContactsPage } from '../pages/emergency/EmergencyContactsPage'
import { useAuth } from '../context/auth'
import { useToast } from './Toast'

export function SeniorAppShell({
  activePath,
  navigate
}: {
  activePath: string
  navigate: (path: string) => void
}) {
  const seniorPath = ['/dashboard', '/measurements/new', '/emergency'].includes(activePath)
    ? activePath
    : '/dashboard'
  const [sosPressed, setSosPressed] = useState(false)
  const [switchingBack, setSwitchingBack] = useState(false)
  const sosTimerRef = useRef<number | null>(null)
  const { profile, refresh } = useAuth()
  const { show: showToast } = useToast()

  async function handleSwitchToNormal() {
    if (switchingBack) return
    setSwitchingBack(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: profile?.theme ?? 'light',
          timezone: profile?.timezone ?? 'Asia/Jakarta',
          heightCm: profile?.heightCm ?? 170,
          accessibilityMode: 'normal'
        })
      })
      if (res.ok) {
        document.documentElement.dataset.accessibility = 'normal'
        await refresh()
        showToast('Kembali ke tampilan normal.', 'success')
      } else {
        showToast('Gagal mengembalikan tampilan. Coba lagi.', 'error')
      }
    } catch {
      showToast('Tidak bisa terhubung ke server.', 'error')
    } finally {
      setSwitchingBack(false)
    }
  }

  function clearSosTimer() {
    if (sosTimerRef.current !== null) {
      window.clearTimeout(sosTimerRef.current)
      sosTimerRef.current = null
    }
  }

  function longPressStart() {
    clearSosTimer()
    sosTimerRef.current = window.setTimeout(() => {
      sosTimerRef.current = null
      setSosPressed(true)
    }, 900)
  }

  function longPressEnd() {
    clearSosTimer()
  }

  useEffect(() => () => clearSosTimer(), [])

  return (
    <main className="senior-shell">
      <nav className="senior-tabs" aria-label="Senior navigation">
        <button className={seniorPath === '/dashboard' ? 'active' : ''} onClick={() => navigate('/dashboard')} type="button">
          Home
        </button>
        <button className={seniorPath === '/measurements/new' ? 'active' : ''} onClick={() => navigate('/measurements/new')} type="button">
          Add Data
        </button>
        <button className={seniorPath === '/emergency' ? 'active' : ''} onClick={() => navigate('/emergency')} type="button">
          Emergency
        </button>
        <button
          className="senior-exit-btn"
          onClick={() => void handleSwitchToNormal()}
          disabled={switchingBack}
          type="button"
          title="Kembali ke tampilan normal"
          aria-label="Kembali ke tampilan normal"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22, verticalAlign: 'middle', marginRight: 6 }}>undo</span>
          {switchingBack ? 'Mengembalikan...' : 'Tampilan Normal'}
        </button>
      </nav>

      <section className="senior-content">
        {seniorPath === '/dashboard' ? <TodayDashboard /> : null}
        {seniorPath === '/measurements/new' ? <SeniorMeasurementFlow /> : null}
        {seniorPath === '/emergency' ? (
          <div className="senior-emergency">
            <button
              className={sosPressed ? 'sos-button confirmed' : 'sos-button'}
              onMouseDown={longPressStart}
              onMouseUp={longPressEnd}
              onMouseLeave={longPressEnd}
              onTouchStart={longPressStart}
              onTouchEnd={longPressEnd}
              onTouchCancel={longPressEnd}
              type="button"
            >
              SOS BUTTON
            </button>
            {sosPressed ? <p className="form-message success">SOS long-press detected. Contact emergency services or local medical assistance.</p> : null}
            <button onClick={() => setSosPressed(false)} type="button" className="btn-secondary" style={{ marginTop: 8 }}>Reset SOS</button>
            <EmergencyContactsPage />
          </div>
        ) : null}
      </section>
    </main>
  )
}
