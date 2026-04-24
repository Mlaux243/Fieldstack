import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

// ─── Nav Items ────────────────────────────────────────────────────────────────

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  badge?: number
  roles?: string[] // if set, only these roles see this item
}

function IconHome() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
}
function IconRFI() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
}
function IconSubmittal() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
}
function IconDrawings() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
}
function IconPunch() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
}
function IconTasks() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
}
function IconDaily() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function IconDocs() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
}
function IconPhotos() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
}
function IconUsers() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
}
function IconBell() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
}
function IconChevron() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
}
function IconMenu() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
}
function IconX() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}

// ─── Role badge colors ────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  gc_admin:     { label: 'GC Admin',     color: '#e8611a' },
  gc_field:     { label: 'GC Field',     color: '#2d6fd4' },
  owner:        { label: 'Owner',        color: '#2d9e5f' },
  subcontractor:{ label: 'Subcontractor',color: '#8b5cf6' },
  architect:    { label: 'Architect',    color: '#0891b2' },
}

// ─── AppShell ─────────────────────────────────────────────────────────────────

interface AppShellProps {
  activePage: string
  onNavigate: (page: string) => void
  children: React.ReactNode
  unreadCount?: number
}

export default function AppShell({ activePage, onNavigate, children, unreadCount = 0 }: AppShellProps) {
  const { profile, activeProject, activeRole, projects, setActiveProject, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const roleInfo = activeRole ? ROLE_LABELS[activeRole] : null

  const navItems: NavItem[] = [
    { id: 'dashboard',    label: 'Dashboard',      icon: <IconHome /> },
    { id: 'rfis',         label: 'RFIs',            icon: <IconRFI /> },
    { id: 'submittals',   label: 'Submittals',      icon: <IconSubmittal /> },
    { id: 'drawings',     label: 'Drawings',        icon: <IconDrawings /> },
    { id: 'punch',        label: 'Punch List',      icon: <IconPunch /> },
    { id: 'tasks',        label: 'Tasks',           icon: <IconTasks />, roles: ['gc_admin', 'gc_field'] },
    { id: 'daily',        label: 'Daily Reports',   icon: <IconDaily /> },
    { id: 'documents',    label: 'Documents',       icon: <IconDocs /> },
    { id: 'photos',       label: 'Photos',          icon: <IconPhotos /> },
    { id: 'users',        label: 'Team',            icon: <IconUsers />, roles: ['gc_admin'] },
  ]

  const visibleNav = navItems.filter(item =>
    !item.roles || (activeRole && item.roles.includes(activeRole))
  )

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick() {
      setProjectDropdownOpen(false)
      setUserMenuOpen(false)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  function NavLink({ item }: { item: NavItem }) {
    const isActive = activePage === item.id
    return (
      <button
        onClick={() => { onNavigate(item.id); setSidebarOpen(false) }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          padding: '10px 20px',
          background: isActive ? 'rgba(232,97,26,0.12)' : 'transparent',
          border: 'none',
          borderLeft: isActive ? '3px solid #e8611a' : '3px solid transparent',
          borderRadius: '0 4px 4px 0',
          cursor: 'pointer',
          color: isActive ? '#f6f4f1' : 'rgba(246,244,241,0.45)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: '15px',
          fontWeight: isActive ? 600 : 400,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          transition: 'all 0.15s',
          textAlign: 'left',
        }}
        onMouseEnter={e => {
          if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(246,244,241,0.8)'
        }}
        onMouseLeave={e => {
          if (!isActive) (e.currentTarget as HTMLElement).style.color = 'rgba(246,244,241,0.45)'
        }}
      >
        <span style={{ opacity: isActive ? 1 : 0.6 }}>{item.icon}</span>
        {item.label}
        {item.badge ? (
          <span style={{
            marginLeft: 'auto',
            background: '#e8611a',
            color: 'white',
            borderRadius: '10px',
            padding: '1px 7px',
            fontSize: '11px',
            fontFamily: "'IBM Plex Mono', monospace",
          }}>{item.badge}</span>
        ) : null}
      </button>
    )
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(246,244,241,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', background: '#e8611a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            clipPath: 'polygon(0 0, 85% 0, 100% 15%, 100% 100%, 0 100%)',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px', fontWeight: 800, color: '#f6f4f1', letterSpacing: '1.5px', textTransform: 'uppercase' }}>FieldStack</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(246,244,241,0.3)', letterSpacing: '2px', textTransform: 'uppercase' }}>Construction Control</div>
          </div>
        </div>
      </div>

      {/* Project Switcher */}
      {activeProject && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(246,244,241,0.07)' }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: 'rgba(246,244,241,0.3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Active Project</div>
          <div
            style={{ position: 'relative' }}
            onClick={e => { e.stopPropagation(); setProjectDropdownOpen(o => !o) }}
          >
            <button style={{
              width: '100%', padding: '10px 12px', background: 'rgba(246,244,241,0.06)',
              border: '1px solid rgba(246,244,241,0.1)', borderRadius: '4px',
              color: '#f6f4f1', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: '8px',
              fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', textAlign: 'left',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeProject.project.name}
              </span>
              <span style={{ flexShrink: 0, opacity: 0.5, transform: projectDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <IconChevron />
              </span>
            </button>

            {projectDropdownOpen && projects.length > 1 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                background: '#1a2b3c', border: '1px solid rgba(246,244,241,0.12)',
                borderRadius: '4px', zIndex: 100, overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {projects.map(m => (
                  <button
                    key={m.project.id}
                    onClick={e => { e.stopPropagation(); setActiveProject(m.project.id); setProjectDropdownOpen(false) }}
                    style={{
                      width: '100%', padding: '10px 12px', background: m.project.id === activeProject.project.id ? 'rgba(232,97,26,0.15)' : 'transparent',
                      border: 'none', color: '#f6f4f1', cursor: 'pointer', textAlign: 'left',
                      fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px',
                      borderBottom: '1px solid rgba(246,244,241,0.06)',
                    }}
                  >
                    {m.project.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {roleInfo && (
            <div style={{ marginTop: '8px' }}>
              <span style={{
                fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                color: roleInfo.color, background: `${roleInfo.color}18`,
                padding: '2px 8px', borderRadius: '3px', letterSpacing: '1px',
              }}>
                {roleInfo.label}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {visibleNav.map(item => <NavLink key={item.id} item={item} />)}
      </nav>

      {/* User Menu */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(246,244,241,0.07)', position: 'relative' }}>
        <div
          onClick={e => { e.stopPropagation(); setUserMenuOpen(o => !o) }}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
            padding: '8px', borderRadius: '4px', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(246,244,241,0.06)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: '#e8611a', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700,
            color: 'white', flexShrink: 0,
          }}>
            {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#f6f4f1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name}
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: 'rgba(246,244,241,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.company}
            </div>
          </div>
        </div>

        {userMenuOpen && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 4px)', left: '16px', right: '16px',
            background: '#1a2b3c', border: '1px solid rgba(246,244,241,0.12)',
            borderRadius: '4px', overflow: 'hidden', boxShadow: '0 -8px 24px rgba(0,0,0,0.4)',
          }}>
            <button
              onClick={() => onNavigate('profile')}
              style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(246,244,241,0.08)', color: 'rgba(246,244,241,0.7)', cursor: 'pointer', textAlign: 'left', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px' }}
            >
              My Profile
            </button>
            <button
              onClick={signOut}
              style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', textAlign: 'left', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px' }}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { font-family: 'IBM Plex Sans', sans-serif; }

        .app-layout { display: flex; height: 100vh; overflow: hidden; }

        .sidebar {
          width: 240px;
          flex-shrink: 0;
          background: #0f1923;
          border-right: 1px solid rgba(246,244,241,0.07);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #f6f4f1;
        }

        .topbar {
          height: 56px;
          background: white;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          padding: 0 24px;
          gap: 16px;
          flex-shrink: 0;
        }

        .topbar-title {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 20px;
          font-weight: 700;
          color: #0f1923;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          flex: 1;
        }

        .notif-btn {
          position: relative;
          width: 36px;
          height: 36px;
          border: 1.5px solid #e5e7eb;
          border-radius: 4px;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #374151;
          transition: border-color 0.15s;
        }

        .notif-btn:hover { border-color: #e8611a; color: #e8611a; }

        .notif-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          width: 16px;
          height: 16px;
          background: #e8611a;
          border-radius: 50%;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 9px;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
        }

        .content-area {
          flex: 1;
          overflow-y: auto;
          padding: 28px;
        }

        /* Mobile */
        .mobile-topbar {
          display: none;
          height: 56px;
          background: #0f1923;
          border-bottom: 1px solid rgba(246,244,241,0.08);
          align-items: center;
          padding: 0 16px;
          gap: 12px;
          flex-shrink: 0;
        }

        .hamburger-btn {
          width: 36px; height: 36px; border: none;
          background: transparent; color: rgba(246,244,241,0.7);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
        }

        .mobile-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          z-index: 40;
          backdrop-filter: blur(2px);
        }

        .mobile-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 260px;
          background: #0f1923;
          z-index: 50;
          transform: translateX(-100%);
          transition: transform 0.25s ease;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .sidebar { display: none; }
          .mobile-topbar { display: flex; }
          .mobile-overlay.open { display: block; }
          .mobile-sidebar.open { transform: translateX(0); }
          .content-area { padding: 16px; }
        }
      `}</style>

      <div className="app-layout">
        {/* Desktop Sidebar */}
        <aside className="sidebar">
          <SidebarContent />
        </aside>

        {/* Mobile Overlay + Sidebar */}
        <div className={`mobile-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
        <div className={`mobile-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <SidebarContent />
        </div>

        {/* Main Area */}
        <div className="main-area">
          {/* Mobile Topbar */}
          <div className="mobile-topbar">
            <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)}>
              {sidebarOpen ? <IconX /> : <IconMenu />}
            </button>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 800, color: '#f6f4f1', letterSpacing: '1px', textTransform: 'uppercase', flex: 1 }}>
              FieldStack
            </div>
          </div>

          {/* Desktop Topbar */}
          <div className="topbar" style={{ display: 'none' }}>
            {/* This area handled per-page via page headers */}
          </div>

          {/* Content */}
          <div className="content-area">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
