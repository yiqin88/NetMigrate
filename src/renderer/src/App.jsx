import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/Layout/AppShell'
import MigratePage from './pages/MigratePage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import UpdateDialog from './components/UpdateDialog/UpdateDialog'
import { VendorProvider } from './hooks/useVendors'

export default function App() {
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
