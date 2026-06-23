import { useEffect, useRef, useState } from 'react'
import { TodayDashboard } from '../pages/dashboard/TodayDashboard'
import { SeniorMeasurementFlow } from '../pages/measurement/SeniorMeasurementFlow'
import { EmergencyContactsPage } from '../pages/emergency/EmergencyContactsPage'

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
  const sosTimerRef = useRef<number | null>(null)

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
            <EmergencyContactsPage />
          </div>
        ) : null}
      </section>
    </main>
  )
}
