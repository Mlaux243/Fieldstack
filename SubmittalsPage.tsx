import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useTeam, type TeamMember } from '../hooks/useTeam'
import type { UserRole } from '../contexts/AuthContext'
import {
  PageHeader, Button, Modal, FormField,
  inputStyle, selectStyle, EmptyState, Skeleton,
} from '../components/ui'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string; description: string }> = {
  gc_admin:     { label: 'GC Admin',      color: '#e8611a', bg: '#fef3ec', description: 'Full project access. Can manage users, close punch items, and approve all records.' },
  gc_field:     { label: 'GC Field',      color: '#2d6fd4', bg: '#eff6ff', description: 'Field superintendent access. Can create/edit most records and close punch items.' },
  owner:        { label: 'Owner',         color: '#2d9e5f', bg: '#f0fdf4', description: 'View-only access to all modules. Can submit RFIs.' },
  subcontractor:{ label: 'Subcontractor', color: '#8b5cf6', bg: '#f5f3ff', description: 'Limited access. Sees only assigned punch items, own daily reports, and relevant submittals.' },
  architect:    { label: 'Architect',     color: '#0891b2', bg: '#ecfeff', description: 'Design review access. Can respond to RFIs, approve submittals, and annotate drawings.' },
}

const TRADES = [
  'General Contractor', 'Concrete', 'Masonry', 'Steel / Structural',
  'Carpentry / Framing', 'Roofing', 'Waterproofing', 'Insulation',
  'Drywall', 'Flooring', 'Painting', 'Doors / Frames / Hardware',
  'Glazing / Curtain Wall', 'Mechanical (HVAC)', 'Plumbing',
  'Electrical', 'Fire Protection', 'Elevators', 'Landscaping',
  'Civil / Sitework', 'Architecture', 'Structural Engineering',
  'MEP Engineering', 'Owner / Developer', 'Other',
]

// ─── Role Badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const meta = ROLE_META[role]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: '3px',
      background: meta.bg, color: meta.color,
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '11px', fontWeight: 500, letterSpacing: '0.5px',
      whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, role, size = 36 }: { name: string; role: UserRole; size?: number }) {
  const meta = ROLE_META[role]
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: meta.bg, border: `2px solid ${meta.color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontSize: size * 0.38, fontWeight: 700, color: meta.color,
    }}>
      {initials}
    </div>
  )
}

// ─── Edit Member Modal ────────────────────────────────────────────────────────

function EditMemberModal({
  member, open, onClose, onSaved,
}: {
  member: TeamMember | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const { updateMemberRole, saving } = useTeam()
  const [role,    setRole]    = useState<UserRole>('subcontractor')
  const [trade,   setTrade]   = useState('')
  const [company, setCompany] = useState('')
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (member) {
      setRole(member.role)
      setTrade(member.trade ?? '')
      setCompany(member.company ?? '')
      setError(null)
    }
  }, [member])

  async function handleSave() {
    if (!member) return
    setError(null)
    const { error } = await updateMemberRole(member.id, role, trade, company)
    if (error) { setError(error); return }
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title="Edit Team Member"
      subtitle={member?.full_name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save Changes</Button>
        </>
      }
    >
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}

      <FormField label="Role" required>
        <select style={selectStyle} value={role} onChange={e => setRole(e.target.value as UserRole)}>
          {Object.entries(ROLE_META).map(([key, meta]) => (
            <option key={key} value={key}>{meta.label}</option>
          ))}
        </select>
      </FormField>

      {/* Role description */}
      <div style={{
        padding: '10px 12px', background: ROLE_META[role].bg,
        borderRadius: '4px', marginBottom: '18px',
        fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px',
        color: ROLE_META[role].color, lineHeight: 1.5,
      }}>
        {ROLE_META[role].description}
      </div>

      <FormField label="Company">
        <input
          style={inputStyle}
          placeholder="e.g. Smith Framing Inc."
          value={company}
          onChange={e => setCompany(e.target.value)}
        />
      </FormField>

      <FormField label="Trade / Specialty">
        <select style={selectStyle} value={trade} onChange={e => setTrade(e.target.value)}>
          <option value="">Select trade...</option>
          {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </FormField>
    </Modal>
  )
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────

function AddMemberModal({
  open, onClose, onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const { addMemberById, searchUsers, saving } = useTeam()
  const [tab, setTab] = useState<'search' | 'invite'>('search')

  // Search tab state
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState<{ id: string; full_name: string; company: string | null }[]>([])
  const [selected,     setSelected]     = useState<{ id: string; full_name: string } | null>(null)
  const [role,         setRole]         = useState<UserRole>('subcontractor')
  const [company,      setCompany]      = useState('')
  const [trade,        setTrade]        = useState('')
  const [searching,    setSearching]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Invite tab state
  const [inviteEmail,  setInviteEmail]  = useState('')
  const [inviteName,   setInviteName]   = useState('')
  const [inviteRole,   setInviteRole]   = useState<UserRole>('subcontractor')
  const [inviteCompany,setInviteCompany]= useState('')
  const [inviteTrade,  setInviteTrade]  = useState('')
  const [invitePhone,  setInvitePhone]  = useState('')
  const [inviteCopied, setInviteCopied] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function reset() {
    setQuery(''); setResults([]); setSelected(null)
    setRole('subcontractor'); setCompany(''); setTrade('')
    setError(null); setSearching(false)
    setInviteEmail(''); setInviteName(''); setInviteRole('subcontractor')
    setInviteCompany(''); setInviteTrade(''); setInvitePhone('')
    setInviteCopied(false)
  }

  function handleClose() { reset(); onClose() }

  // Live search with debounce
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!query.trim() || query.length < 2) { setResults([]); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      const users = await searchUsers(query)
      setResults(users)
      setSearching(false)
    }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query, searchUsers])

  async function handleAdd() {
    if (!selected) { setError('Select a user from the search results.'); return }
    setError(null)
    const { error } = await addMemberById(selected.id, role, company, trade)
    if (error) { setError(error); return }
    reset()
    onAdded()
    onClose()
  }

  function handleCopyInviteLink() {
    const url = `${window.location.origin}/signup`
    navigator.clipboard.writeText(url)
    setInviteCopied(true)
    setTimeout(() => setInviteCopied(false), 2000)
  }

  const TabBtn = ({ id, label }: { id: 'search' | 'invite'; label: string }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '8px 20px', border: 'none', cursor: 'pointer',
        background: tab === id ? 'white' : 'transparent',
        color: tab === id ? '#0f1923' : '#6b7280',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: '15px', fontWeight: tab === id ? 700 : 400,
        textTransform: 'uppercase', letterSpacing: '0.5px',
        borderRadius: '4px',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )

  return (
    <Modal
      open={open} onClose={handleClose}
      title="Add Team Member"
      footer={tab === 'search' ? (
        <>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAdd} loading={saving} disabled={!selected}>
            Add to Project
          </Button>
        </>
      ) : (
        <Button variant="secondary" onClick={handleClose}>Done</Button>
      )}
    >
      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px', padding: '4px',
        background: '#f3f4f6', borderRadius: '6px', marginBottom: '20px',
      }}>
        <TabBtn id="search"  label="Find Existing User" />
        <TabBtn id="invite"  label="Invite New User" />
      </div>

      {/* ── Search Tab ── */}
      {tab === 'search' && (
        <>
          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
              {error}
            </div>
          )}

          <FormField label="Search by Name">
            <input
              style={inputStyle}
              placeholder="Start typing a name..."
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null) }}
              autoFocus
            />
          </FormField>

          {/* Search results */}
          {(searching || results.length > 0 || (query.length >= 2 && !searching)) && (
            <div style={{
              border: '1.5px solid #e5e7eb', borderRadius: '4px',
              marginBottom: '18px', overflow: 'hidden',
            }}>
              {searching ? (
                <div style={{ padding: '12px 14px' }}>
                  <Skeleton height={12} width="60%" />
                </div>
              ) : results.length === 0 ? (
                <div style={{ padding: '14px', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#9ca3af', textAlign: 'center' }}>
                  No users found matching "{query}"
                </div>
              ) : (
                results.map(u => (
                  <div
                    key={u.id}
                    onClick={() => { setSelected(u); setCompany(u.company ?? '') }}
                    style={{
                      padding: '12px 14px', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', gap: '10px',
                      background: selected?.id === u.id ? '#fef3ec' : 'white',
                      borderBottom: '1px solid #f3f4f6',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: selected?.id === u.id ? '#e8611a' : '#f3f4f6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                      fontWeight: 700, color: selected?.id === u.id ? 'white' : '#6b7280',
                      flexShrink: 0,
                    }}>
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: '#0f1923', fontWeight: 500 }}>
                        {u.full_name}
                      </div>
                      {u.company && (
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
                          {u.company}
                        </div>
                      )}
                    </div>
                    {selected?.id === u.id && (
                      <svg style={{ marginLeft: 'auto' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e8611a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {selected && (
            <>
              <div style={{ padding: '10px 12px', background: '#fef3ec', borderRadius: '4px', marginBottom: '18px', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#92400e' }}>
                Adding <strong>{selected.full_name}</strong> to this project.
              </div>

              <FormField label="Role" required>
                <select style={selectStyle} value={role} onChange={e => setRole(e.target.value as UserRole)}>
                  {Object.entries(ROLE_META).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                </select>
              </FormField>

              <div style={{ padding: '10px 12px', background: ROLE_META[role].bg, borderRadius: '4px', marginBottom: '18px', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: ROLE_META[role].color }}>
                {ROLE_META[role].description}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FormField label="Company">
                  <input style={inputStyle} placeholder="Company name" value={company} onChange={e => setCompany(e.target.value)} />
                </FormField>
                <FormField label="Trade">
                  <select style={selectStyle} value={trade} onChange={e => setTrade(e.target.value)}>
                    <option value="">Select...</option>
                    {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FormField>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Invite Tab ── */}
      {tab === 'invite' && (
        <div>
          <div style={{
            padding: '14px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0',
            borderRadius: '6px', marginBottom: '24px',
          }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '15px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
              How Invitations Work
            </div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#166534', lineHeight: 1.6, margin: 0 }}>
              Share the signup link below with the person you want to add. Once they create their account, search for their name in the "Find Existing User" tab and add them to this project with the appropriate role.
            </p>
          </div>

          <FormField label="Signup Link to Share">
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ ...inputStyle, flex: 1, color: '#6b7280', background: '#f9fafb' }}
                value={`${window.location.origin}/signup`}
                readOnly
              />
              <Button
                variant="secondary" size="sm"
                onClick={handleCopyInviteLink}
                icon={
                  inviteCopied
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                }
              >
                {inviteCopied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </FormField>

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '20px', marginTop: '8px' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Template Email
            </div>
            <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
              Copy this to send a quick invite.
            </p>
            <div style={{
              padding: '14px 16px', background: '#f9fafb', border: '1px solid #e5e7eb',
              borderRadius: '4px', fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '12px', color: '#374151', lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
            }}>
{`Subject: You've been invited to FieldStack

Hi [Name],

You've been invited to collaborate on our construction project via FieldStack.

To get started, create your account here:
${window.location.origin}/signup

Once you've signed up, let me know and I'll add you to the project.

Thanks`}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ─── Remove Confirm Modal ─────────────────────────────────────────────────────

function RemoveConfirmModal({
  member, open, onClose, onRemoved,
}: {
  member: TeamMember | null
  open: boolean
  onClose: () => void
  onRemoved: () => void
}) {
  const { removeMember, saving } = useTeam()
  const [error, setError] = useState<string | null>(null)

  async function handleRemove() {
    if (!member) return
    setError(null)
    const { error } = await removeMember(member.id, member.user_id)
    if (error) { setError(error); return }
    onRemoved()
    onClose()
  }

  return (
    <Modal
      open={open} onClose={onClose}
      title="Remove Team Member"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleRemove} loading={saving}>
            Remove from Project
          </Button>
        </>
      }
    >
      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}
      <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: '#374151', lineHeight: 1.6 }}>
        Are you sure you want to remove <strong>{member?.full_name}</strong> from this project?
        They will lose access to all project records immediately.
        Their records (RFIs, reports, etc.) will remain in the system.
      </p>
    </Modal>
  )
}

// ─── Team Page ────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { activeProject, can } = useAuth()
  const { members, loading, error, fetchMembers } = useTeam()

  const [showAdd,    setShowAdd]    = useState(false)
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [removeMem,  setRemoveMem]  = useState<TeamMember | null>(null)
  const [filter,     setFilter]     = useState<UserRole | 'all'>('all')
  const [search,     setSearch]     = useState('')

  const isAdmin = can('manage_users')

  const filtered = members.filter(m => {
    const matchRole = filter === 'all' || m.role === filter
    const matchSearch = !search || m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (m.company ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (m.trade ?? '').toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  // Group by role for display
  const roleOrder: UserRole[] = ['gc_admin', 'gc_field', 'architect', 'owner', 'subcontractor']
  const grouped = roleOrder.reduce((acc, role) => {
    const group = filtered.filter(m => m.role === role)
    if (group.length > 0) acc[role] = group
    return acc
  }, {} as Record<UserRole, TeamMember[]>)

  if (!activeProject) {
    return <EmptyState title="No Project Selected" description="Select a project to view its team." />
  }

  return (
    <>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .member-row { transition: background 0.1s; }
        .member-row:hover { background: #fafafa; }
      `}</style>

      <PageHeader
        title="Team"
        subtitle={`${members.length} member${members.length !== 1 ? 's' : ''} on ${activeProject.project.name}`}
        actions={
          isAdmin ? (
            <Button
              onClick={() => setShowAdd(true)}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
            >
              Add Member
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '200px', maxWidth: '320px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            style={{ ...inputStyle, paddingLeft: '32px' }}
            placeholder="Search members..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Role filter pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {(['all', ...roleOrder] as const).map(r => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              style={{
                padding: '5px 12px', borderRadius: '20px', cursor: 'pointer',
                border: filter === r
                  ? `1.5px solid ${r === 'all' ? '#0f1923' : ROLE_META[r].color}`
                  : '1.5px solid #e5e7eb',
                background: filter === r
                  ? (r === 'all' ? '#0f1923' : ROLE_META[r].bg)
                  : 'white',
                color: filter === r
                  ? (r === 'all' ? 'white' : ROLE_META[r].color)
                  : '#6b7280',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px', letterSpacing: '0.5px',
                transition: 'all 0.15s',
              }}
            >
              {r === 'all' ? 'All' : ROLE_META[r].label}
              <span style={{ marginLeft: '5px', opacity: 0.7 }}>
                {r === 'all' ? members.length : members.filter(m => m.role === r).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}

      {/* Members */}
      {loading ? (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Skeleton width={40} height={40} borderRadius="50%" />
              <div style={{ flex: 1 }}>
                <Skeleton height={13} width="30%" style={{ marginBottom: '8px' }} />
                <Skeleton height={11} width="20%" />
              </div>
              <Skeleton width={90} height={22} borderRadius="3px" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e8611a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
          title={search || filter !== 'all' ? 'No Members Found' : 'No Team Members Yet'}
          description={search || filter !== 'all' ? 'Try adjusting your search or filter.' : 'Add team members to give them access to this project.'}
          action={isAdmin && !search && filter === 'all' ? (
            <Button onClick={() => setShowAdd(true)}>Add First Member</Button>
          ) : undefined}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {roleOrder.filter(r => grouped[r]).map(role => (
            <div key={role}>
              {/* Role group header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                marginBottom: '10px',
              }}>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '13px',
                  fontWeight: 700, color: ROLE_META[role].color,
                  textTransform: 'uppercase', letterSpacing: '1px',
                }}>
                  {ROLE_META[role].label}
                </div>
                <div style={{ flex: 1, height: '1px', background: `${ROLE_META[role].color}30` }} />
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                  color: '#9ca3af',
                }}>
                  {grouped[role].length}
                </span>
              </div>

              {/* Member cards */}
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                {grouped[role].map((member, idx) => (
                  <div
                    key={member.id}
                    className="member-row"
                    style={{
                      padding: '14px 20px',
                      borderBottom: idx < grouped[role].length - 1 ? '1px solid #f3f4f6' : 'none',
                      display: 'flex', alignItems: 'center', gap: '14px',
                    }}
                  >
                    <Avatar name={member.full_name} role={member.role} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: '#0f1923', fontWeight: 500 }}>
                          {member.full_name}
                        </span>
                        {!member.accepted_at && (
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', background: '#f3f4f6', padding: '2px 7px', borderRadius: '3px' }}>
                            Pending
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '3px', flexWrap: 'wrap' }}>
                        {member.company && (
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#6b7280' }}>
                            {member.company}
                          </span>
                        )}
                        {member.trade && (
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
                            {member.trade}
                          </span>
                        )}
                        {member.phone && (
                          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
                            {member.phone}
                          </span>
                        )}
                      </div>
                    </div>

                    <RoleBadge role={member.role} />

                    {/* Actions (GC Admin only) */}
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => setEditMember(member)}
                          title="Edit role"
                          style={{
                            width: '30px', height: '30px', border: '1px solid #e5e7eb',
                            borderRadius: '4px', background: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#6b7280', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e8611a'; (e.currentTarget as HTMLElement).style.color = '#e8611a' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => setRemoveMem(member)}
                          title="Remove from project"
                          style={{
                            width: '30px', height: '30px', border: '1px solid #e5e7eb',
                            borderRadius: '4px', background: 'white', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#6b7280', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#dc2626'; (e.currentTarget as HTMLElement).style.color = '#dc2626' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role Legend */}
      <div style={{ marginTop: '32px', padding: '20px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
          Role Permissions Reference
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
          {Object.entries(ROLE_META).map(([key, meta]) => (
            <div key={key} style={{ padding: '10px 12px', background: meta.bg, borderRadius: '4px', borderLeft: `3px solid ${meta.color}` }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', fontWeight: 600, color: meta.color, marginBottom: '4px' }}>
                {meta.label}
              </div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#374151', lineHeight: 1.5 }}>
                {meta.description}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <AddMemberModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdded={fetchMembers}
      />
      <EditMemberModal
        member={editMember}
        open={!!editMember}
        onClose={() => setEditMember(null)}
        onSaved={fetchMembers}
      />
      <RemoveConfirmModal
        member={removeMem}
        open={!!removeMem}
        onClose={() => setRemoveMem(null)}
        onRemoved={fetchMembers}
      />
    </>
  )
}
