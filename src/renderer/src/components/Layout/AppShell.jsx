import TitleBar from './TitleBar'
import Sidebar from './Sidebar'

export default function AppShell({ children }) {
  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-surface">
          {children}
        </main>
      </div>
    </div>
  )
}
