import { useEffect } from 'react'

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  // RFI
  draft:                { bg: '#f3f4f6', color: '#6b7280',  label: 'Draft' },
  open:                 { bg: '#fef3ec', color: '#e8611a',  label: 'Open' },
  answered:             { bg: '#eff6ff', color: '#2d6fd4',  label: 'Answered' },
  closed:               { bg: '#f0fdf4', color: '#2d9e5f',  label: 'Closed' },
  void:                 { bg: '#f9fafb', color: '#9ca3af',  label: 'Void' },
  // Submittal
  submitted:            { bg: '#eff6ff', color: '#2d6fd4',  label: 'Submitted' },
  under_review:         { bg: '#fefce8', color: '#ca8a04',  label: 'Under Review' },
  approved:             { bg: '#f0fdf4', color: '#2d9e5f',  label: 'Approved' },
  approved_as_noted:    { bg: '#f0fdf4', color: '#15803d',  label: 'Approved as Noted' },
  revise_and_resubmit:  { bg: '#fff7ed', color: '#c2410c',  label: 'Revise & Resubmit' },
  rejected:             { bg: '#fef2f2', color: '#dc2626',  label: 'Rejected' },
  // Punch
  in_progress:          { bg: '#eff6ff', color: '#2d6fd4',  label: 'In Progress' },
  ready_for_inspection: { bg: '#fefce8', color: '#ca8a04',  label: 'Ready for Inspection' },
  // Task
  todo:                 { bg: '#f3f4f6', color: '#6b7280',  label: 'To Do' },
  complete:             { bg: '#f0fdf4', color: '#2d9e5f',  label: 'Complete' },
  // Priority
  low:                  { bg: '#f0fdf4', color: '#2d9e5f',  label: 'Low' },
  medium:               { bg: '#eff6ff', color: '#2d6fd4',  label: 'Medium' },
  high:                 { bg: '#fff7ed', color: '#c2410c',  label: 'High' },
  critical:             { bg: '#fef2f2', color: '#dc2626',  label: 'Critical' },
}

interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? { bg: '#f3f4f6', color: '#6b7280', label: status }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: size === 'sm' ? '2px 8px' : '3px 10px',
      borderRadius: '3px',
      background: style.bg,
      color: style.color,
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: size === 'sm' ? '10px' : '11px',
      fontWeight: 500,
      letterSpacing: '0.5px',
      whiteSpace: 'nowrap',
    }}>
      {style.label}
    </span>
  )
}

// ─── Priority Dot ─────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  low: '#2d9e5f', medium: '#2d6fd4', high: '#e8a020', critical: '#dc2626',
}

export function PriorityDot({ priority }: { priority: string }) {
  return (
    <span style={{
      display: 'inline-block',
      width: '8px', height: '8px', borderRadius: '50%',
      background: PRIORITY_COLORS[priority] ?? '#9ca3af',
      flexShrink: 0,
    }} title={priority} />
  )
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = 16, borderRadius = '4px', style }: SkeletonProps) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  )
}

export function SkeletonCard() {
  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb',
      borderRadius: '6px', padding: '20px',
    }}>
      <Skeleton height={10} width="60%" style={{ marginBottom: '12px' }} />
      <Skeleton height={36} width="40%" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
      <Skeleton width={60} height={12} />
      <Skeleton width="40%" height={12} />
      <Skeleton width={70} height={20} borderRadius="3px" style={{ marginLeft: 'auto' }} />
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
    }}>
      {icon && (
        <div style={{
          width: '52px', height: '52px', background: '#fef3ec', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '16px',
        }}>
          {icon}
        </div>
      )}
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px',
        fontWeight: 700, color: '#0f1923', textTransform: 'uppercase',
        letterSpacing: '0.5px', marginBottom: '8px',
      }}>
        {title}
      </div>
      {description && (
        <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#6b7280', maxWidth: '320px', lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '20px' }}>{action}</div>}
    </div>
  )
}

// ─── Page Header ──────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  breadcrumb?: string
}

export function PageHeader({ title, subtitle, actions, breadcrumb }: PageHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      gap: '16px', marginBottom: '28px', flexWrap: 'wrap',
    }}>
      <div>
        {breadcrumb && (
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
            color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            {breadcrumb}
          </div>
        )}
        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '32px',
          fontWeight: 800, color: '#0f1923', textTransform: 'uppercase',
          letterSpacing: '0.5px', lineHeight: 1.1, margin: 0,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: '#6b7280', marginTop: '6px' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
}

export function Button({
  variant = 'primary', size = 'md', loading, icon, children, disabled, style, ...rest
}: ButtonProps) {
  const variants = {
    primary:   { bg: '#e8611a', color: 'white',    border: '#e8611a',  hover: '#c95214' },
    secondary: { bg: 'white',   color: '#374151',  border: '#d1d5db',  hover: '#f9fafb' },
    danger:    { bg: '#dc2626', color: 'white',    border: '#dc2626',  hover: '#b91c1c' },
    ghost:     { bg: 'transparent', color: '#374151', border: 'transparent', hover: '#f3f4f6' },
  }
  const sizes = {
    sm: { padding: '6px 12px', fontSize: '13px' },
    md: { padding: '9px 18px', fontSize: '14px' },
    lg: { padding: '13px 24px', fontSize: '16px' },
  }
  const v = variants[variant]
  const s = sizes[size]

  return (
    <button
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: s.padding,
        background: v.bg, color: v.color,
        border: `1.5px solid ${v.border}`,
        borderRadius: '4px', cursor: 'pointer',
        fontFamily: variant === 'primary'
          ? "'Barlow Condensed', sans-serif"
          : "'IBM Plex Sans', sans-serif",
        fontSize: variant === 'primary' ? `calc(${s.fontSize} + 2px)` : s.fontSize,
        fontWeight: variant === 'primary' ? 700 : 500,
        letterSpacing: variant === 'primary' ? '1px' : 'normal',
        textTransform: variant === 'primary' ? 'uppercase' : 'none',
        transition: 'all 0.15s',
        opacity: (disabled || loading) ? 0.6 : 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
      onMouseEnter={e => {
        if (!disabled && !loading) (e.currentTarget as HTMLElement).style.background = v.hover
      }}
      onMouseLeave={e => {
        if (!disabled && !loading) (e.currentTarget as HTMLElement).style.background = v.bg
      }}
      {...rest}
    >
      {loading ? (
        <span style={{
          width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)',
          borderTopColor: 'currentColor', borderRadius: '50%',
          animation: 'spin 0.7s linear infinite', display: 'inline-block',
        }} />
      ) : icon}
      {children}
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
}

export function Modal({ open, onClose, title, subtitle, children, footer, width = 560 }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <>
      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(11,19,32,0.6)',
          backdropFilter: 'blur(3px)', zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: `${width}px`,
            background: 'white', borderRadius: '8px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
            animation: 'modal-in 0.2s ease',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div>
              <h2 style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '22px',
                fontWeight: 700, color: '#0f1923', textTransform: 'uppercase',
                letterSpacing: '0.5px', margin: 0,
              }}>
                {title}
              </h2>
              {subtitle && (
                <p style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                width: '32px', height: '32px', border: '1px solid #e5e7eb',
                borderRadius: '4px', background: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6b7280', flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'flex-end', gap: '10px',
              flexShrink: 0,
            }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Form Field ───────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}

export function FormField({ label, required, error, hint, children }: FormFieldProps) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <label style={{
        display: 'block',
        fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
        fontWeight: 500, color: '#374151', letterSpacing: '1.5px',
        textTransform: 'uppercase', marginBottom: '6px',
      }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: '3px' }}>*</span>}
      </label>
      {children}
      {error && (
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#dc2626', marginTop: '5px' }}>
          {error}
        </div>
      )}
      {hint && !error && (
        <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#9ca3af', marginTop: '5px' }}>
          {hint}
        </div>
      )}
    </div>
  )
}

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  background: 'white', border: '1.5px solid #e5e7eb',
  borderRadius: '4px', fontFamily: "'IBM Plex Sans', sans-serif",
  fontSize: '14px', color: '#0f1923', outline: 'none',
  transition: 'border-color 0.15s',
}

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: '36px',
}

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: '100px',
  lineHeight: 1.6,
}
