import { useState, useEffect, useRef } from 'react'
import { useNotifications, type Notification } from '../hooks/useNotifications'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Module colors + icons ────────────────────────────────────────────────────

const MODULE_META: Record<string, { color: string; bg: string; icon: string }> = {
  rfi:          { color: '#e8611a', bg: '#fef3ec', icon: 'ℹ' },
  submittal:    { color: '#2d6fd4', bg: '#eff6ff', icon: '📦' },
  punch_item:   { color: '#dc2626', bg: '#fef2f2', icon: '✅' },
  task:         { color: '#8b5cf6', bg: '#f5f3ff', icon: '☑' },
  daily_report: { color: '#2d9e5f', bg: '#f0fdf4', icon: '📝' },
  drawing:      { color: '#0891b2', bg: '#ecfeff', icon: '📐' },
  document:     { color: '#6b7280', bg: '#f3f4f6', icon: '🗂' },
  photo:        { color: '#ca8a04', bg: '#fefce8', icon: '📸' },
}

function getModuleMeta(module: string | null) {
  return MODULE_META[module ?? ''] ?? { color: '#6b7280', bg: '#f3f4f6', icon: '🔔' }
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({ notif, onRead, onNavigate }: {
  notif: Notification
  onRead: (id: string) => void
  onNavigate: (module: string | null, recordId: string | null) => void
}) {
  const meta = getModuleMeta(notif.module)

  function handleClick() {
    if (!notif.is_read) onRead(notif.id)
    if (notif.module && notif.record_id) onNavigate(notif.module, notif.record_id)
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex', gap: '12px', padding: '12px 16px',
        borderBottom: '1px solid #f3f4f6',
        background: notif.is_read ? 'white' : '#fffdf9',
        cursor: notif.module ? 'pointer' : 'default',
        transition: 'background 0.1s',
        position: 'relative',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fafafa' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = notif.is_read ? 'white' : '#fffdf9' }}
    >
      {/* Unread dot */}
      {!notif.is_read && (
        <div style={{
          position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)',
          width: '6px', height: '6px', borderRadius: '50%', background: '#e8611a',
        }} />
      )}

      {/* Module icon */}
      <div style={{
        width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
        background: meta.bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '14px', marginLeft: '8px',
      }}>
        {meta.icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px',
          color: '#0f1923', fontWeight: notif.is_read ? 400 : 600,
          lineHeight: 1.4, marginBottom: '3px',
        }}>
          {notif.title}
        </div>
        <div style={{
          fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px',
          color: '#6b7280', lineHeight: 1.5,
          overflow: 'hidden', textOverflow: 'ellipsis',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {notif.body}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '5px', flexWrap: 'wrap' }}>
          {notif.record_label && (
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
              color: meta.color, background: meta.bg,
              padding: '1px 6px', borderRadius: '3px',
            }}>
              {notif.record_label}
            </span>
          )}
          {notif.project_name && (
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af' }}>
              {notif.project_name}
            </span>
          )}
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#d1d5db', marginLeft: 'auto' }}>
            {timeAgo(notif.sent_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Notification Center ──────────────────────────────────────────────────────

interface NotificationCenterProps {
  onNavigate?: (page: string) => void
}

export default function NotificationCenter({ onNavigate }: NotificationCenterProps) {
  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotifications()
  const [open,   setOpen]   = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef   = useRef<HTMLButtonElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Mark as read when panel opens
  useEffect(() => {
    if (open && unreadCount > 0) {
      // Auto-mark after 2s of panel being open
      const timer = setTimeout(() => markAllRead(), 2000)
      return () => clearTimeout(timer)
    }
  }, [open, unreadCount, markAllRead])

  function handleNavigate(module: string | null, recordId: string | null) {
    setOpen(false)
    if (!module || !onNavigate) return
    const pageMap: Record<string, string> = {
      rfi:          'rfis',
      submittal:    'submittals',
      punch_item:   'punch',
      task:         'tasks',
      daily_report: 'daily',
      drawing:      'drawings',
      document:     'documents',
      photo:        'photos',
    }
    const page = pageMap[module]
    if (page) onNavigate(page)
  }

  const displayed = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications

  return (
    <>
      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)  scale(1);    }
        }
        @keyframes bell-shake {
          0%,100% { transform: rotate(0); }
          20%     { transform: rotate(12deg); }
          40%     { transform: rotate(-10deg); }
          60%     { transform: rotate(8deg); }
          80%     { transform: rotate(-6deg); }
        }
        .bell-has-unread { animation: bell-shake 0.5s ease; }
        .notif-row-hover:hover { background: #fafafa !important; }
      `}</style>

      {/* Bell button */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          ref={btnRef}
          onClick={() => setOpen(o => !o)}
          className={unreadCount > 0 ? 'bell-has-unread' : ''}
          style={{
            width: '36px', height: '36px',
            border: `1.5px solid ${open ? '#e8611a' : '#e5e7eb'}`,
            borderRadius: '6px', background: open ? '#fef3ec' : 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: open ? '#e8611a' : '#374151',
            transition: 'all 0.15s', position: 'relative',
          }}
          onMouseEnter={e => {
            if (!open) {
              ;(e.currentTarget as HTMLElement).style.borderColor = '#e8611a'
              ;(e.currentTarget as HTMLElement).style.color = '#e8611a'
            }
          }}
          onMouseLeave={e => {
            if (!open) {
              ;(e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'
              ;(e.currentTarget as HTMLElement).style.color = '#374151'
            }
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>

          {/* Unread badge */}
          {unreadCount > 0 && (
            <div style={{
              position: 'absolute', top: '-5px', right: '-5px',
              minWidth: '16px', height: '16px', padding: '0 4px',
              background: '#e8611a', borderRadius: '8px',
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px',
              fontWeight: 700, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid white', lineHeight: 1,
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </button>

        {/* Dropdown panel */}
        {open && (
          <div
            ref={panelRef}
            style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: '380px', maxHeight: '520px',
              background: 'white', border: '1px solid #e5e7eb',
              borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              animation: 'slide-in 0.2s ease',
              display: 'flex', flexDirection: 'column',
              zIndex: 500,
              overflow: 'hidden',
            }}
          >
            {/* Panel header */}
            <div style={{
              padding: '14px 16px 10px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex', alignItems: 'center', gap: '10px',
              flexShrink: 0,
            }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: '18px', fontWeight: 800, color: '#0f1923',
                textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1,
              }}>
                Notifications
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{
                    border: 'none', background: 'none', cursor: 'pointer',
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                    color: '#2d6fd4', letterSpacing: '0.5px', padding: '3px 8px',
                    borderRadius: '3px', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#eff6ff'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Filter tabs */}
            <div style={{
              display: 'flex', padding: '6px 12px',
              borderBottom: '1px solid #f3f4f6', gap: '4px', flexShrink: 0,
            }}>
              {(['all', 'unread'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '4px 12px', border: 'none', borderRadius: '20px', cursor: 'pointer',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                  background: filter === f ? '#0f1923' : 'transparent',
                  color: filter === f ? 'white' : '#6b7280',
                  transition: 'all 0.15s', letterSpacing: '0.5px',
                }}>
                  {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
                </button>
              ))}
            </div>

            {/* Notification list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <div style={{ width: '24px', height: '24px', border: '2px solid #e5e7eb', borderTopColor: '#e8611a', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              ) : displayed.length === 0 ? (
                <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔔</div>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '16px',
                    fontWeight: 700, color: '#0f1923', textTransform: 'uppercase',
                    letterSpacing: '0.5px', marginBottom: '6px',
                  }}>
                    {filter === 'unread' ? 'All caught up' : 'No notifications'}
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#9ca3af' }}>
                    {filter === 'unread'
                      ? 'No unread notifications right now.'
                      : 'Notifications will appear here as project activity occurs.'
                    }
                  </div>
                </div>
              ) : (
                displayed.map(n => (
                  <NotifRow
                    key={n.id}
                    notif={n}
                    onRead={markRead}
                    onNavigate={handleNavigate}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid #f3f4f6',
                textAlign: 'center', flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
                  color: '#d1d5db', letterSpacing: '0.5px',
                }}>
                  Showing last {Math.min(notifications.length, 60)} notifications
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
