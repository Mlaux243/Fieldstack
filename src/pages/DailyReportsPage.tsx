import { useAuth } from '../contexts/AuthContext'
import { EmptyState } from '../components/ui'

export default function DailyReportsPage() {
  const { activeProject } = useAuth()
  if (!activeProject) {
    return <EmptyState title="No Project Selected" description="Select a project to view daily reports." />
  }
  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontFamily: 'sans-serif', color: '#0f1923' }}>Daily Reports</h1>
      <p style={{ fontFamily: 'sans-serif', color: '#6b7280' }}>
        Daily reports module loading — full functionality coming shortly.
      </p>
    </div>
  )
}