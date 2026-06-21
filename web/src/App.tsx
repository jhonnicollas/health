import { useEffect, useState } from 'react'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/auth'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { SelectMetricPage } from './pages/measurement/SelectMetricPage'
import { OnboardingPage } from './pages/onboarding/OnboardingPage'
import { ProfileSettingsPage } from './pages/settings/ProfileSettingsPage'
import { ProfileDeletePage } from './pages/settings/ProfileDeletePage'
import { ConfigDashboardPage } from './pages/admin/ConfigDashboardPage'
import { SeniorMeasurementFlow } from './pages/measurement/SeniorMeasurementFlow'
import { TodayDashboard } from './pages/dashboard/TodayDashboard'
import { WeeklyDashboard } from './pages/dashboard/WeeklyDashboard'
import { MonthlyDashboard } from './pages/dashboard/MonthlyDashboard'
import { DailyReportPage } from './pages/reports/DailyReportPage'
import { WeeklyReportPage } from './pages/reports/WeeklyReportPage'
import { MonthlyReportPage } from './pages/reports/MonthlyReportPage'
import { DoctorReportPage } from './pages/reports/DoctorReportPage'
import { KnowledgeBasePage } from './pages/kb/KnowledgeBasePage'
import { RemindersPage } from './pages/reminders/RemindersPage'
import { MedicationsPage } from './pages/medications/MedicationsPage'
import { FamilyPage } from './pages/family/FamilyPage'
import { FastingPage } from './pages/fasting/FastingPage'
import { EmergencyContactsPage } from './pages/emergency/EmergencyContactsPage'
import { TelegramSettingsPage } from './pages/telegram/TelegramSettingsPage'
import { CaregiverDashboardPage } from './pages/caregiver/CaregiverDashboardPage'
import { AlertsPage } from './pages/alerts/AlertsPage'
import { PatternsPage } from './pages/patterns/PatternsPage'
import './App.css'

type NavLink = { path: string; label: string; adminOnly?: boolean }

const NAV: NavLink[] = [
  { path: '/dashboard', label: 'Hari Ini' },
  { path: '/dashboard/week', label: 'Mingguan' },
  { path: '/dashboard/month', label: 'Bulanan' },
  { path: '/measurements/new', label: 'Pengukuran' },
  { path: '/measurements/senior', label: 'Mode Lansia' },
  { path: '/reports/daily', label: 'Laporan Harian' },
  { path: '/reports/weekly', label: 'Laporan Mingguan' },
  { path: '/reports/monthly', label: 'Laporan Bulanan' },
  { path: '/reports/doctor', label: 'Laporan Dokter' },
  { path: '/reminders', label: 'Pengingat' },
  { path: '/medications', label: 'Obat' },
  { path: '/family', label: 'Keluarga' },
  { path: '/caregiver', label: 'Caregiver' },
  { path: '/fasting', label: 'Puasa' },
  { path: '/emergency', label: 'Kontak Darurat' },
  { path: '/telegram', label: 'Telegram' },
  { path: '/alerts', label: 'Peringatan' },
  { path: '/patterns', label: 'Pola' },
  { path: '/kb', label: 'Pengetahuan' },
  { path: '/settings/profile', label: 'Profil' },
  { path: '/settings/delete', label: 'Hapus Akun' },
  { path: '/admin/configs', label: 'Admin', adminOnly: true }
]

const ALLOWED_PATHS = new Set(NAV.map(n => n.path))

function AppRoutes() {
  const { loading, user, requiresOnboarding } = useAuth()
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  const [authView, setAuthView] = useState<'login' | 'register'>(() =>
    window.location.pathname === '/register' ? 'register' : 'login'
  )

  useEffect(() => {
    function handlePopState() { setCurrentPath(window.location.pathname) }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function showAuthView(view: 'login' | 'register') {
    const path = view === 'login' ? '/login' : '/register'
    window.history.pushState(null, '', path)
    setCurrentPath(path)
    setAuthView(view)
  }

  function navigate(path: string) {
    window.history.pushState(null, '', path)
    setCurrentPath(path)
  }

  if (loading) {
    return (
      <main className="auth-page">
        <p className="loading-text">Memeriksa sesi...</p>
      </main>
    )
  }

  if (!user) {
    if (!['/login', '/register'].includes(window.location.pathname)) {
      window.history.replaceState(null, '', '/login')
    }
    return authView === 'login' ? (
      <LoginPage onShowRegister={() => showAuthView('register')} />
    ) : (
      <RegisterPage onShowLogin={() => showAuthView('login')} />
    )
  }

  if (requiresOnboarding) {
    if (window.location.pathname !== '/onboarding') {
      window.history.replaceState(null, '', '/onboarding')
    }
    return <OnboardingPage />
  }

  const appPath = ALLOWED_PATHS.has(currentPath) ? currentPath : '/dashboard'
  if (!ALLOWED_PATHS.has(currentPath)) {
    window.history.replaceState(null, '', '/dashboard')
  }

  const isAdmin = !!user.email && ['admin@homesungai.com'].includes(user.email)

  return (
    <main className="app-page">
      <header className="app-header">
        <h1>HL Health Companion</h1>
        <p>Halo, {user.displayName}.</p>
      </header>
      <nav className="app-nav" aria-label="Navigasi utama">
        {NAV.filter(link => !link.adminOnly || isAdmin).map((link) => (
          <button
            aria-current={appPath === link.path ? 'page' : undefined}
            className={appPath === link.path ? 'nav-btn active' : 'nav-btn'}
            key={link.path}
            onClick={() => navigate(link.path)}
            type="button"
          >
            {link.label}
          </button>
        ))}
      </nav>
      <section className="app-content">
        {appPath === '/dashboard' ? <TodayDashboard /> : null}
        {appPath === '/dashboard/week' ? <WeeklyDashboard /> : null}
        {appPath === '/dashboard/month' ? <MonthlyDashboard /> : null}
        {appPath === '/measurements/new' ? <SelectMetricPage /> : null}
        {appPath === '/measurements/senior' ? <SeniorMeasurementFlow /> : null}
        {appPath === '/reports/daily' ? <DailyReportPage /> : null}
        {appPath === '/reports/weekly' ? <WeeklyReportPage /> : null}
        {appPath === '/reports/monthly' ? <MonthlyReportPage /> : null}
        {appPath === '/reports/doctor' ? <DoctorReportPage /> : null}
        {appPath === '/reminders' ? <RemindersPage /> : null}
        {appPath === '/medications' ? <MedicationsPage /> : null}
        {appPath === '/family' ? <FamilyPage /> : null}
        {appPath === '/caregiver' ? <CaregiverDashboardPage /> : null}
        {appPath === '/fasting' ? <FastingPage /> : null}
        {appPath === '/emergency' ? <EmergencyContactsPage /> : null}
        {appPath === '/telegram' ? <TelegramSettingsPage /> : null}
        {appPath === '/alerts' ? <AlertsPage /> : null}
        {appPath === '/patterns' ? <PatternsPage /> : null}
        {appPath === '/kb' ? <KnowledgeBasePage /> : null}
        {appPath === '/settings/profile' ? <ProfileSettingsPage /> : null}
        {appPath === '/settings/delete' ? <ProfileDeletePage /> : null}
        {appPath === '/admin/configs' ? <ConfigDashboardPage /> : null}
      </section>
    </main>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
