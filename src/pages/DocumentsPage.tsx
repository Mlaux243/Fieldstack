import { useAuth } from '../contexts/AuthContext'
import { EmptyState } from '../components/ui'

export default function DocumentsPage() {
  const { activeProject } = useAuth()
  if (!activeProject) {
    return <EmptyState title="No Project Selected" description="Select a project to view documents." />
  }
  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontFamily: 'sans-serif', color: '#0f1923' }}>Documents</h1>
      <p style={{ fontFamily: 'sans-serif', color: '#6b7280' }}>
        Document storage module — coming online shortly.
      </p>
    </div>
  )
}