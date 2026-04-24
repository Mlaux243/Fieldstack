import { useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
<<<<<<< HEAD
import LoginPage      from './pages/LoginPage'
import AppShell       from './components/AppShell'
import DashboardPage  from './pages/DashboardPage'
import RFIsPage       from './pages/RFIsPage'
import SubmittalsPage from './pages/SubmittalsPage'
import DrawingsPage   from './pages/DrawingsPage'
import PunchListPage  from './pages/PunchListPage'
import TasksPage      from './pages/TasksPage'
import DailyReportsPage from './pages/DailyReportsPage'
import DocumentsPage  from './pages/DocumentsPage'
import PhotosPage     from './pages/PhotosPage'
import TeamPage       from './pages/TeamPage'
=======
import LoginPage from './pages/LoginPage'
import AppShell from './components/AppShell'
import DashboardPage from './pages/DashboardPage'
import RFIsPage from './pages/RFIsPage'
import SubmittalsPage from './pages/SubmittalsPage'
import DrawingsPage from './pages/DrawingsPage'
import PunchListPage from './pages/PunchListPage'
import TasksPage from './pages/TasksPage'
import DailyReportsPage from './pages/DailyReportsPage'
import DocumentsPage from './pages/DocumentsPage'
import PhotosPage from './pages/PhotosPage'
import TeamPage from './pages/TeamPage'
>>>>>>> 99c2973af3b48ab7cc6e700c2f7fe3579880245f

function PageRouter({ page }: { page: string }) {
  switch (page) {
    case 'dashboard':  return <DashboardPage />
    case 'rfis':       return <RFIsPage />
    case 'submittals': return <SubmittalsPage />
    case 'drawings':   return <DrawingsPage />
    case 'punch':      return <PunchListPage />
    case 'tasks':      return <TasksPage />
    case 'daily':      return <DailyReportsPage />
    case 'documents':  return <DocumentsPage />
    case 'photos':     return <PhotosPage />
    case 'users':      return <TeamPage />
    default:           return <DashboardPage />
  }
}

function ProtectedApp() {
  const { session, loading } = useAuth()
  const [activePage, setActivePage] = useState('dashboard')

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1923', flexDirection: 'column', gap: '16px' }}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
<<<<<<< HEAD
        <div style={{ width: '40px', height: '40px', background: '#e8611a', clipPath: 'polygon(0 0, 85% 0, 100% 15%, 100% 100%, 0 100%)', animation: 'pulse 1.2s ease-in-out infinite' }} />
        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(246,244,241,0.3)', letterSpacing: '3px', textTransform: 'uppercase' }}>Loading...</div>
=======
        <div style={{ width: '40px', height: '40px', background: '#e8611a', animation: 'pulse 1.2s ease-in-out infinite' }} />
        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(246,244,241,0.3)', letterSpacing: '3px' }}>LOADING...</div>
>>>>>>> 99c2973af3b48ab7cc6e700c2f7fe3579880245f
      </div>
    )
  }
  if (!session) return <LoginPage />
  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
<<<<<<< HEAD
      <PageRouter page={activePage} />
    </AppShell>
  )
}

export default function App() {
  return <AuthProvider><ProtectedApp /></AuthProvider>
}
=======
>>>>>>> 99c2973af3b48ab7cc6e700c2f7fe3579880245f
