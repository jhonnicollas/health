import { FastingPage } from '../fasting/FastingPage'
import { MedicationsPage } from '../medications/MedicationsPage'

function TrackerPage() {
  return (
    <div className="tracker-grid">
      <FastingPage />
      <MedicationsPage />
    </div>
  )
}

export default TrackerPage
export { TrackerPage }
