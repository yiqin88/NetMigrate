import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/Layout/AppShell'
import MigratePage from './pages/MigratePage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import UpdateDialog from './components/UpdateDialog/UpdateDialog'
import SetupWizard from './components/SetupWizard/SetupWizard'
import { VendorProvider } from './hooks/useVendors'

export default function App() {
  const [loading, setLoading] = useState(true)
  const [setupDone, setSetupDone] = useState(false)

  useEffect(() => {
    async function checkSetup() {
      try {
        const complete = await window.electronAPI?.settings.get('setup_complete')
        setSetupDone(!!complete)
      } catch {
        setSetupDone(false)
      } finally {
        setLoading(false)
      }
    }
    checkSetup()
  }, [])

  if (loading) {
    return <div className="h-screen bg-surface" />
  }

  if (!setupDone) {
    return <SetupWizard onComplete={() => setSetupDone(true)} />
  }

  return (
    <VendorProvider>
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/migrate" replace />} />
          <Route path="/migrate" element={<MigratePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
      <UpdateDialog />
    </HashRouter>
    </VendorProvider>
  )
}
