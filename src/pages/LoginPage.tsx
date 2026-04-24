import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { signIn, session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
    }
    // On success, AuthContext updates session → App redirects
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          background: #0b1320;
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: 'IBM Plex Sans', sans-serif;
        }

        /* ── LEFT PANEL ── */
        .login-left {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          overflow: hidden;
          background: #0f1923;
        }

        .login-left::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 39px,
              rgba(232,97,26,0.06) 39px,
              rgba(232,97,26,0.06) 40px
            ),
            repeating-linear-gradient(
              90deg,
              transparent,
              transparent 39px,
              rgba(232,97,26,0.04) 39px,
              rgba(232,97,26,0.04) 40px
            );
          pointer-events: none;
        }

        .login-left::after {
          content: '';
          position: absolute;
          bottom: -120px;
          left: -80px;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(232,97,26,0.12) 0%, transparent 65%);
          pointer-events: none;
        }

        .brand {
          position: relative;
          z-index: 1;
        }

        .brand-mark {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .brand-icon {
          width: 44px;
          height: 44px;
          background: #e8611a;
          display: flex;
          align-items: center;
          justify-content: center;
          clip-path: polygon(0 0, 85% 0, 100% 15%, 100% 100%, 0 100%);
        }

        .brand-icon svg {
          width: 22px;
          height: 22px;
          color: white;
          fill: none;
          stroke: currentColor;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .brand-name {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 28px;
          font-weight: 800;
          color: #f6f4f1;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .brand-tagline {
          font-size: 12px;
          color: rgba(246,244,241,0.4);
          letter-spacing: 3px;
          text-transform: uppercase;
          font-family: 'IBM Plex Mono', monospace;
        }

        .left-hero {
          position: relative;
          z-index: 1;
        }

        .left-hero-label {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: #e8611a;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-bottom: 20px;
        }

        .left-hero h1 {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: clamp(42px, 5vw, 64px);
          font-weight: 800;
          color: #f6f4f1;
          line-height: 1.0;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 24px;
        }

        .left-hero h1 span {
          color: #e8611a;
        }

        .left-hero p {
          font-size: 14px;
          color: rgba(246,244,241,0.5);
          line-height: 1.7;
          max-width: 340px;
        }

        .left-modules {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .module-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(246,244,241,0.04);
          border: 1px solid rgba(246,244,241,0.07);
          border-radius: 4px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          color: rgba(246,244,241,0.5);
          letter-spacing: 1px;
        }

        .module-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #e8611a;
          flex-shrink: 0;
        }

        /* ── RIGHT PANEL ── */
        .login-right {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px;
          background: #f6f4f1;
        }

        .login-card {
          width: 100%;
          max-width: 400px;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }

        .login-card.mounted {
          opacity: 1;
          transform: translateY(0);
        }

        .login-card-header {
          margin-bottom: 40px;
        }

        .login-card-header h2 {
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 36px;
          font-weight: 700;
          color: #0f1923;
          text-transform: uppercase;
          letter-spacing: 1px;
          line-height: 1.1;
          margin-bottom: 8px;
        }

        .login-card-header p {
          font-size: 14px;
          color: #6b7280;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          color: #374151;
          letter-spacing: 2px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .form-input {
          width: 100%;
          padding: 14px 16px;
          background: white;
          border: 1.5px solid #e5e7eb;
          border-radius: 4px;
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 15px;
          color: #0f1923;
          outline: none;
          transition: border-color 0.2s;
        }

        .form-input:focus {
          border-color: #e8611a;
        }

        .form-input::placeholder {
          color: #9ca3af;
        }

        .error-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 4px;
          margin-bottom: 20px;
          font-size: 13px;
          color: #dc2626;
        }

        .submit-btn {
          width: 100%;
          padding: 16px;
          background: #e8611a;
          color: white;
          border: none;
          border-radius: 4px;
          font-family: 'Barlow Condensed', sans-serif;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s, transform 0.1s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 8px;
        }

        .submit-btn:hover:not(:disabled) {
          background: #c95214;
        }

        .submit-btn:active:not(:disabled) {
          transform: scale(0.99);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .login-footer {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #9ca3af;
          text-align: center;
          font-family: 'IBM Plex Mono', monospace;
        }

        @media (max-width: 768px) {
          .login-root { grid-template-columns: 1fr; }
          .login-left { display: none; }
          .login-right { background: #0f1923; }
          .login-card { background: #f6f4f1; padding: 32px; border-radius: 8px; }
        }
      `}</style>

      <div className="login-root">
        {/* ── LEFT PANEL ── */}
        <div className="login-left">
          <div className="brand">
            <div className="brand-mark">
              <div className="brand-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <div>
                <div className="brand-name">FieldStack</div>
                <div className="brand-tagline">Construction Control</div>
              </div>
            </div>
          </div>

          <div className="left-hero">
            <div className="left-hero-label">// Project Command Center</div>
            <h1>
              Built for the<br />
              <span>Field.</span><br />
              Runs the<br />
              Office.
            </h1>
            <p>
              Document control, RFIs, submittals, punch lists, and daily reports —
              all in one platform. No bloat. No consultants. Just the tools you need.
            </p>
          </div>

          <div className="left-modules">
            {['Submittals & RFIs', 'Drawings + Annotations', 'Punch Lists & Tasks', 'Daily Field Reports', 'Document Storage'].map(m => (
              <div className="module-pill" key={m}>
                <div className="module-dot" />
                {m}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="login-right">
          <div className={`login-card ${mounted ? 'mounted' : ''}`}>
            <div className="login-card-header">
              <h2>Sign In to<br />FieldStack</h2>
              <p>Use your company credentials to access your projects.</p>
            </div>

            <form onSubmit={handleSubmit}>
              {error && (
                <div className="error-box">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <><div className="spinner" /> Signing In...</>
                ) : (
                  <>Sign In →</>
                )}
              </button>
            </form>

            <div className="login-footer">
              Access is by invitation only.<br />
              Contact your GC Administrator to request access.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
