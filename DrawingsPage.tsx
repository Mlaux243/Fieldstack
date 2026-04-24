import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  useDailyReports,
  type DailyReport, type FullReport,
  type ManpowerRow, type EquipmentRow, type DeliveryRow, type ReportPhoto,
  type WeatherCondition,
} from '../hooks/useDailyReports'
import {
  PageHeader, Button, Modal, FormField,
  EmptyState, Skeleton, inputStyle, selectStyle, textareaStyle,
} from '../components/ui'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function fmtShort(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function today() {
  return new Date().toISOString().split('T')[0]
}

const WEATHER_META: Record<WeatherCondition, { label: string; icon: string }> = {
  clear:        { label: 'Clear',         icon: '☀️' },
  partly_cloudy:{ label: 'Partly Cloudy', icon: '⛅' },
  overcast:     { label: 'Overcast',      icon: '☁️' },
  rain:         { label: 'Rain',          icon: '🌧️' },
  wind:         { label: 'Windy',         icon: '💨' },
  snow:         { label: 'Snow',          icon: '❄️' },
  fog:          { label: 'Fog',           icon: '🌫️' },
}

// ─── Blank form state ─────────────────────────────────────────────────────────

function blankReport(trade?: string | null): Omit<FullReport, 'id' | 'project_id' | 'submitted_by' | 'created_at' | 'updated_at' | 'submitted_by_name' | 'submitted_by_company'> {
  return {
    report_date:         today(),
    trade:               trade ?? '',
    temp_high:           null,
    temp_low:            null,
    weather_condition:   'clear',
    site_conditions:     '',
    work_performed:      '',
    safety_observations: '',
    has_safety_incident: false,
    notes:               '',
    signed_name:         '',
    signed_at:           null,
    manpower:            [{ trade: trade ?? '', foreman_name: '', worker_count: 0, hours_worked: null }],
    equipment:           [],
    deliveries:          [],
    photos:              [],
  }
}

// ─── Row editor helpers ───────────────────────────────────────────────────────

function addRow<T>(arr: T[], blank: T): T[] { return [...arr, { ...blank }] }
function removeRow<T>(arr: T[], i: number): T[] { return arr.filter((_, idx) => idx !== i) }
function updateRow<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  return arr.map((row, idx) => idx === i ? { ...row, ...patch } : row)
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count, onAdd, addLabel }: {
  title: string; count?: number; onAdd?: () => void; addLabel?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', marginTop: '28px' }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: '14px', fontWeight: 700,
        color: '#0f1923', textTransform: 'uppercase', letterSpacing: '1px',
      }}>
        {title}
        {count !== undefined && (
          <span style={{ marginLeft: '8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>
            ({count})
          </span>
        )}
      </div>
      <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
      {onAdd && (
        <button onClick={onAdd} style={{
          padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: '4px',
          background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center',
          gap: '5px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px',
          color: '#6b7280', transition: 'all 0.15s', whiteSpace: 'nowrap',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e8611a'; (e.currentTarget as HTMLElement).style.color = '#e8611a' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}
        >
          + {addLabel ?? 'Add Row'}
        </button>
      )}
    </div>
  )
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportReportPDF(report: FullReport, projectName: string) {
  const weather = report.weather_condition ? WEATHER_META[report.weather_condition] : null
  const manpowerTotal = report.manpower.reduce((sum, r) => sum + (r.worker_count ?? 0), 0)
  const manpowerHtml = report.manpower.filter(r => r.trade).map(r =>
    `<tr><td>${r.trade}</td><td>${r.foreman_name || '—'}</td><td style="text-align:center">${r.worker_count}</td><td style="text-align:center">${r.hours_worked ?? '—'}</td></tr>`
  ).join('')
  const equipHtml = report.equipment.filter(r => r.equipment_type).map(r =>
    `<tr><td>${r.equipment_type}</td><td>${r.unit_id || '—'}</td><td style="text-align:center">${r.hours_used ?? '—'}</td></tr>`
  ).join('')
  const delivHtml = report.deliveries.filter(r => r.material).map(r =>
    `<tr><td>${r.material}</td><td>${r.supplier || '—'}</td><td>${r.quantity || '—'}</td><td>${r.po_reference || '—'}</td></tr>`
  ).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;color:#222;margin:0;padding:28px;line-height:1.5}
  .header{border-bottom:3px solid #2d9e5f;padding-bottom:14px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end}
  .brand{font-size:20px;font-weight:800;color:#2d9e5f;letter-spacing:2px;text-transform:uppercase}
  .report-title{font-size:22px;font-weight:800;color:#0f1923}
  .meta-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px;background:#f5f5f5;border-radius:4px;margin-bottom:18px}
  .meta-label{font-size:8px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
  .meta-val{font-size:11px;font-weight:700}
  .section{margin-top:18px}
  .section-title{font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:10px}
  .text-box{padding:10px 12px;background:#f9f9f9;border-left:3px solid #2d9e5f;border-radius:0 3px 3px 0;line-height:1.7;white-space:pre-wrap}
  .incident-box{background:#fef2f2;border-left-color:#dc2626}
  table{width:100%;border-collapse:collapse;font-size:10px}
  th{background:#f0f0f0;padding:5px 8px;text-align:left;font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:0.5px}
  td{padding:5px 8px;border-bottom:1px solid #eee}
  .sig{margin-top:28px;border-top:2px solid #222;padding-top:8px;display:flex;justify-content:space-between}
  .footer{margin-top:24px;border-top:1px solid #ddd;padding-top:8px;color:#999;font-size:9px;display:flex;justify-content:space-between}
  .incident-flag{display:inline-block;padding:2px 8px;background:#fef2f2;color:#dc2626;border-radius:3px;font-weight:700;font-size:9px;text-transform:uppercase}
</style></head><body>
<div class="header">
  <div>
    <div class="brand">FieldStack · Daily Report</div>
    <div style="color:#666;font-size:10px;margin-top:3px">${projectName}</div>
  </div>
  <div style="text-align:right">
    <div class="report-title">${fmtDate(report.report_date)}</div>
    <div style="color:#666;font-size:10px;margin-top:3px">${report.submitted_by_name ?? ''} · ${report.trade ?? ''}</div>
    ${report.has_safety_incident ? '<div style="margin-top:4px"><span class="incident-flag">⚠ Safety Incident Reported</span></div>' : ''}
  </div>
</div>

<div class="meta-grid">
  <div><div class="meta-label">Weather</div><div class="meta-val">${weather ? `${weather.icon} ${weather.label}` : '—'}</div></div>
  <div><div class="meta-label">High °F</div><div class="meta-val">${report.temp_high ?? '—'}°</div></div>
  <div><div class="meta-label">Low °F</div><div class="meta-val">${report.temp_low ?? '—'}°</div></div>
  <div><div class="meta-label">Total Workers</div><div class="meta-val">${manpowerTotal}</div></div>
</div>

${report.site_conditions ? `<div class="section"><div class="section-title">Site Conditions</div><div class="text-box">${report.site_conditions}</div></div>` : ''}

${report.work_performed ? `<div class="section"><div class="section-title">Work Performed Today</div><div class="text-box">${report.work_performed}</div></div>` : ''}

${report.manpower.filter(r=>r.trade).length > 0 ? `
<div class="section">
  <div class="section-title">Manpower on Site</div>
  <table><thead><tr><th>Trade</th><th>Foreman</th><th>Workers</th><th>Hours</th></tr></thead>
  <tbody>${manpowerHtml}</tbody></table>
</div>` : ''}

${report.equipment.filter(r=>r.equipment_type).length > 0 ? `
<div class="section">
  <div class="section-title">Equipment on Site</div>
  <table><thead><tr><th>Equipment</th><th>Unit ID</th><th>Hours</th></tr></thead>
  <tbody>${equipHtml}</tbody></table>
</div>` : ''}

${report.deliveries.filter(r=>r.material).length > 0 ? `
<div class="section">
  <div class="section-title">Deliveries Received</div>
  <table><thead><tr><th>Material</th><th>Supplier</th><th>Quantity</th><th>PO #</th></tr></thead>
  <tbody>${delivHtml}</tbody></table>
</div>` : ''}

${report.safety_observations ? `
<div class="section">
  <div class="section-title">Safety Observations</div>
  <div class="text-box ${report.has_safety_incident ? 'incident-box' : ''}">${report.safety_observations}</div>
</div>` : ''}

${report.notes ? `<div class="section"><div class="section-title">Additional Notes</div><div class="text-box">${report.notes}</div></div>` : ''}

${report.photos.filter(p=>p.dropbox_path).length > 0 ? `
<div class="section">
  <div class="section-title">Photos (${report.photos.length})</div>
  ${report.photos.filter(p=>p.dropbox_path).map(p=>`<div style="margin-bottom:6px;font-size:10px;color:#555">📷 ${p.dropbox_path.split('/').pop()}${p.caption ? ` — ${p.caption}` : ''}</div>`).join('')}
</div>` : ''}

${report.signed_name ? `
<div class="sig">
  <div><strong>Submitted by:</strong> ${report.signed_name}</div>
  <div><strong>Date/Time:</strong> ${report.signed_at ? new Date(report.signed_at).toLocaleString() : '—'}</div>
</div>` : ''}

<div class="footer">
  <span>Generated by FieldStack · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
  <span>${projectName}</span>
</div>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html); win.document.close(); win.focus()
  setTimeout(() => win.print(), 400)
}

// ─── Report Form (shared by create + edit) ────────────────────────────────────

function ReportForm({ initial, onSave, onCancel, saving }: {
  initial: Omit<FullReport, 'id' | 'project_id' | 'submitted_by' | 'created_at' | 'updated_at' | 'submitted_by_name' | 'submitted_by_company'>
  onSave: (data: typeof initial) => void
  onCancel: () => void
  saving: boolean
}) {
  const { profile, activeProject } = useAuth()
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.report_date)         e.report_date    = 'Date is required'
    if (!form.work_performed?.trim()) e.work_performed = 'Work performed is required'
    if (!form.signed_name?.trim()) e.signed_name    = 'Digital signature is required to submit'
    setErrors(e); return Object.keys(e).length === 0
  }

  function handleSave() {
    if (validate()) onSave(form)
  }

  // Manpower total
  const manpowerTotal = form.manpower.reduce((s, r) => s + (Number(r.worker_count) || 0), 0)

  const tableHeaderStyle: React.CSSProperties = {
    fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af',
    letterSpacing: '1.5px', textTransform: 'uppercase', padding: '8px 10px',
    background: '#fafafa', borderBottom: '1px solid #e5e7eb', textAlign: 'left', fontWeight: 600,
  }
  const tdStyle: React.CSSProperties = { padding: '6px 4px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' }
  const cellInput: React.CSSProperties = { ...inputStyle, padding: '7px 8px', fontSize: '13px' }

  return (
    <div>
      {/* ── Header info ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '4px' }}>
        <FormField label="Report Date" required error={errors.report_date}>
          <input type="date" style={{ ...inputStyle, borderColor: errors.report_date ? '#fca5a5' : '#e5e7eb' }}
            value={form.report_date} onChange={e => set('report_date', e.target.value)} />
        </FormField>
        <FormField label="Trade / Company">
          <input style={inputStyle} placeholder="e.g. Framing, Electrical"
            value={form.trade ?? ''} onChange={e => set('trade', e.target.value)} />
        </FormField>
      </div>

      {/* ── Weather ── */}
      <SectionHeader title="Weather & Site Conditions" />
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
        <FormField label="Conditions">
          <select style={selectStyle} value={form.weather_condition ?? 'clear'}
            onChange={e => set('weather_condition', e.target.value as WeatherCondition)}>
            {Object.entries(WEATHER_META).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
        </FormField>
        <FormField label="High °F">
          <input type="number" style={inputStyle} placeholder="72"
            value={form.temp_high ?? ''} onChange={e => set('temp_high', e.target.value ? Number(e.target.value) : null)} />
        </FormField>
        <FormField label="Low °F">
          <input type="number" style={inputStyle} placeholder="55"
            value={form.temp_low ?? ''} onChange={e => set('temp_low', e.target.value ? Number(e.target.value) : null)} />
        </FormField>
      </div>
      <FormField label="Site Conditions / Accessibility Notes">
        <textarea style={{ ...textareaStyle, minHeight: '72px' }}
          placeholder="Describe current site access, ground conditions, laydown area status, etc."
          value={form.site_conditions ?? ''} onChange={e => set('site_conditions', e.target.value)} />
      </FormField>

      {/* ── Work Performed ── */}
      <SectionHeader title="Work Performed Today" />
      <FormField label="" required error={errors.work_performed}>
        <textarea style={{ ...textareaStyle, minHeight: '130px', borderColor: errors.work_performed ? '#fca5a5' : '#e5e7eb' }}
          placeholder="Describe all work completed today in detail. Reference locations, floor levels, and scope items."
          value={form.work_performed ?? ''} onChange={e => set('work_performed', e.target.value)} />
      </FormField>

      {/* ── Manpower ── */}
      <SectionHeader
        title={`Manpower on Site (${manpowerTotal} workers)`}
        count={form.manpower.length}
        onAdd={() => set('manpower', addRow(form.manpower, { trade: '', foreman_name: '', worker_count: 0, hours_worked: null }))}
        addLabel="Add Trade"
      />
      {form.manpower.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Trade</th>
                <th style={tableHeaderStyle}>Foreman</th>
                <th style={{ ...tableHeaderStyle, width: '90px' }}>Workers</th>
                <th style={{ ...tableHeaderStyle, width: '90px' }}>Hours</th>
                <th style={{ ...tableHeaderStyle, width: '40px' }} />
              </tr>
            </thead>
            <tbody>
              {form.manpower.map((row, i) => (
                <tr key={i}>
                  <td style={tdStyle}><input style={cellInput} placeholder="Framing" value={row.trade} onChange={e => set('manpower', updateRow(form.manpower, i, { trade: e.target.value }))} /></td>
                  <td style={tdStyle}><input style={cellInput} placeholder="J. Smith" value={row.foreman_name} onChange={e => set('manpower', updateRow(form.manpower, i, { foreman_name: e.target.value }))} /></td>
                  <td style={tdStyle}><input type="number" style={{ ...cellInput, textAlign: 'center' }} placeholder="4" value={row.worker_count || ''} onChange={e => set('manpower', updateRow(form.manpower, i, { worker_count: Number(e.target.value) }))} /></td>
                  <td style={tdStyle}><input type="number" style={{ ...cellInput, textAlign: 'center' }} placeholder="8" value={row.hours_worked ?? ''} onChange={e => set('manpower', updateRow(form.manpower, i, { hours_worked: e.target.value ? Number(e.target.value) : null }))} /></td>
                  <td style={tdStyle}>
                    <button onClick={() => set('manpower', removeRow(form.manpower, i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px', padding: '0 6px', lineHeight: 1 }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Equipment ── */}
      <SectionHeader
        title="Equipment on Site"
        count={form.equipment.length}
        onAdd={() => set('equipment', addRow(form.equipment, { equipment_type: '', unit_id: '', hours_used: null }))}
        addLabel="Add Equipment"
      />
      {form.equipment.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Equipment Type</th>
                <th style={tableHeaderStyle}>Unit ID / #</th>
                <th style={{ ...tableHeaderStyle, width: '90px' }}>Hours Used</th>
                <th style={{ ...tableHeaderStyle, width: '40px' }} />
              </tr>
            </thead>
            <tbody>
              {form.equipment.map((row, i) => (
                <tr key={i}>
                  <td style={tdStyle}><input style={cellInput} placeholder="Tower Crane" value={row.equipment_type} onChange={e => set('equipment', updateRow(form.equipment, i, { equipment_type: e.target.value }))} /></td>
                  <td style={tdStyle}><input style={cellInput} placeholder="TC-01" value={row.unit_id} onChange={e => set('equipment', updateRow(form.equipment, i, { unit_id: e.target.value }))} /></td>
                  <td style={tdStyle}><input type="number" style={{ ...cellInput, textAlign: 'center' }} placeholder="8" value={row.hours_used ?? ''} onChange={e => set('equipment', updateRow(form.equipment, i, { hours_used: e.target.value ? Number(e.target.value) : null }))} /></td>
                  <td style={tdStyle}>
                    <button onClick={() => set('equipment', removeRow(form.equipment, i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px', padding: '0 6px', lineHeight: 1 }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Deliveries ── */}
      <SectionHeader
        title="Deliveries Received"
        count={form.deliveries.length}
        onAdd={() => set('deliveries', addRow(form.deliveries, { material: '', supplier: '', quantity: '', po_reference: '' }))}
        addLabel="Add Delivery"
      />
      {form.deliveries.length > 0 && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', overflow: 'hidden', marginBottom: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Material</th>
                <th style={tableHeaderStyle}>Supplier</th>
                <th style={{ ...tableHeaderStyle, width: '100px' }}>Quantity</th>
                <th style={{ ...tableHeaderStyle, width: '110px' }}>PO Reference</th>
                <th style={{ ...tableHeaderStyle, width: '40px' }} />
              </tr>
            </thead>
            <tbody>
              {form.deliveries.map((row, i) => (
                <tr key={i}>
                  <td style={tdStyle}><input style={cellInput} placeholder="Concrete 4000 PSI" value={row.material} onChange={e => set('deliveries', updateRow(form.deliveries, i, { material: e.target.value }))} /></td>
                  <td style={tdStyle}><input style={cellInput} placeholder="Acme Ready-Mix" value={row.supplier} onChange={e => set('deliveries', updateRow(form.deliveries, i, { supplier: e.target.value }))} /></td>
                  <td style={tdStyle}><input style={cellInput} placeholder="20 CY" value={row.quantity} onChange={e => set('deliveries', updateRow(form.deliveries, i, { quantity: e.target.value }))} /></td>
                  <td style={tdStyle}><input style={cellInput} placeholder="PO-1042" value={row.po_reference} onChange={e => set('deliveries', updateRow(form.deliveries, i, { po_reference: e.target.value }))} /></td>
                  <td style={tdStyle}>
                    <button onClick={() => set('deliveries', removeRow(form.deliveries, i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px', padding: '0 6px', lineHeight: 1 }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Safety ── */}
      <SectionHeader title="Safety" />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', padding: '10px 14px', background: form.has_safety_incident ? '#fef2f2' : '#f9fafb', border: `1px solid ${form.has_safety_incident ? '#fca5a5' : '#e5e7eb'}`, borderRadius: '4px' }}>
        <input type="checkbox" id="incident-flag" checked={form.has_safety_incident}
          onChange={e => set('has_safety_incident', e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: '#dc2626' }} />
        <label htmlFor="incident-flag" style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: form.has_safety_incident ? '#dc2626' : '#374151', fontWeight: form.has_safety_incident ? 600 : 400, cursor: 'pointer', flex: 1 }}>
          ⚠ Flag as Safety Incident — this will alert the GC Project Manager
        </label>
      </div>
      <FormField label="Safety Observations">
        <textarea style={{ ...textareaStyle, minHeight: '90px', borderColor: form.has_safety_incident ? '#fca5a5' : '#e5e7eb' }}
          placeholder="Describe safety observations, toolbox talk topics, near-misses, or incidents."
          value={form.safety_observations ?? ''} onChange={e => set('safety_observations', e.target.value)} />
      </FormField>

      {/* ── Photos ── */}
      <SectionHeader
        title="Photos"
        count={form.photos.length}
        onAdd={() => set('photos', addRow(form.photos, { dropbox_path: '', caption: '', sort_order: form.photos.length }))}
        addLabel="Add Photo"
      />
      {form.photos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '4px' }}>
          {form.photos.map((photo, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'center', padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
              <input style={{ ...cellInput, background: 'white' }}
                placeholder="Dropbox path to photo file"
                value={photo.dropbox_path} onChange={e => set('photos', updateRow(form.photos, i, { dropbox_path: e.target.value }))} />
              <input style={{ ...cellInput, background: 'white' }}
                placeholder="Caption / description"
                value={photo.caption} onChange={e => set('photos', updateRow(form.photos, i, { caption: e.target.value }))} />
              <button onClick={() => set('photos', removeRow(form.photos, i))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '18px', padding: '0 6px', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Notes ── */}
      <SectionHeader title="Additional Notes" />
      <FormField label="">
        <textarea style={{ ...textareaStyle, minHeight: '90px' }}
          placeholder="Any additional observations, coordination items, visitor log, or documentation..."
          value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
      </FormField>

      {/* ── Signature ── */}
      <SectionHeader title="Digital Signature" />
      <div style={{ padding: '16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
        <FormField label="Type your full name to sign and submit this report" required error={errors.signed_name}>
          <input
            style={{ ...inputStyle, fontSize: '16px', fontFamily: 'Georgia, serif', fontStyle: 'italic', borderColor: errors.signed_name ? '#fca5a5' : '#e5e7eb' }}
            placeholder={profile?.full_name ?? 'Your full name'}
            value={form.signed_name ?? ''}
            onChange={e => set('signed_name', e.target.value)}
          />
        </FormField>
        <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', margin: 0 }}>
          By typing your name above, you certify that the information in this daily report is accurate and complete to the best of your knowledge.
        </p>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>
          {form.signed_name?.trim() ? 'Submit Report →' : 'Save Draft'}
        </Button>
      </div>
    </div>
  )
}

// ─── View Report Modal ────────────────────────────────────────────────────────

function ViewReportModal({ reportId, open, onClose, onEdit, projectName }: {
  reportId: string | null; open: boolean; onClose: () => void
  onEdit: () => void; projectName: string
}) {
  const { fetchFullReport } = useDailyReports()
  const [report, setReport] = useState<FullReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!reportId || !open) return
    setLoading(true)
    fetchFullReport(reportId).then(r => { setReport(r); setLoading(false) })
  }, [reportId, open, fetchFullReport])

  const { can, user } = useAuth()
  const canEdit = report && (report.submitted_by === user?.id || can('manage_project'))

  if (!open) return null

  const weather = report?.weather_condition ? WEATHER_META[report.weather_condition] : null

  return (
    <Modal open={open} onClose={onClose}
      title={report ? fmtDate(report.report_date) : 'Loading...'}
      subtitle={report ? `${report.submitted_by_name ?? ''}${report.trade ? ` · ${report.trade}` : ''}` : ''}
      width={700}
      footer={
        <div style={{ display: 'flex', gap: '8px' }}>
          {canEdit && <Button variant="secondary" onClick={onEdit}
            icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>}>
            Edit
          </Button>}
          {report && (
            <Button variant="secondary" onClick={() => exportReportPDF(report, projectName)}
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}>
              Export PDF
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      }
    >
      {loading || !report ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[80, 120, 200, 120].map((h, i) => <Skeleton key={i} height={h} />)}
        </div>
      ) : (
        <div>
          {report.has_safety_incident && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '4px', marginBottom: '20px', fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Safety Incident Reported — GC PM has been notified
            </div>
          )}

          {/* Weather strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '14px', background: '#f9fafb', borderRadius: '4px', marginBottom: '20px' }}>
            {[
              ['Weather',  weather ? `${weather.icon} ${weather.label}` : '—'],
              ['High',     report.temp_high != null ? `${report.temp_high}°F` : '—'],
              ['Low',      report.temp_low  != null ? `${report.temp_low}°F`  : '—'],
              ['Workers',  String(report.manpower.reduce((s,r) => s + (r.worker_count ?? 0), 0))],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px', fontWeight: 700, color: '#0f1923' }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Text sections */}
          {[
            ['Site Conditions',    report.site_conditions],
            ['Work Performed',     report.work_performed],
            ['Safety Observations',report.safety_observations],
            ['Additional Notes',   report.notes],
          ].filter(([_, v]) => v).map(([label, val]) => (
            <div key={label as string} style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>
              <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '14px', color: '#374151', lineHeight: 1.7, padding: '12px 14px', background: '#f9fafb', borderLeft: `3px solid ${label === 'Safety Observations' && report.has_safety_incident ? '#dc2626' : '#2d9e5f'}`, borderRadius: '0 4px 4px 0', whiteSpace: 'pre-wrap' }}>
                {val}
              </div>
            </div>
          ))}

          {/* Tables */}
          {report.manpower.filter(r => r.trade).length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Manpower</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead><tr>{['Trade','Foreman','Workers','Hours'].map(h => <th key={h} style={{ padding: '7px 10px', background: '#fafafa', borderBottom: '1px solid #e5e7eb', fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                <tbody>{report.manpower.filter(r => r.trade).map((r, i) => (
                  <tr key={i}><td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontFamily: "'IBM Plex Sans', sans-serif" }}>{r.trade}</td><td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontFamily: "'IBM Plex Sans', sans-serif", color: '#6b7280' }}>{r.foreman_name || '—'}</td><td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontFamily: "'IBM Plex Mono', monospace', textAlign: 'center" }}>{r.worker_count}</td><td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontFamily: "'IBM Plex Mono', monospace", textAlign: 'center' }}>{r.hours_worked ?? '—'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* Photos */}
          {report.photos.filter(p => p.dropbox_path).length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Photos ({report.photos.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {report.photos.filter(p => p.dropbox_path).map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#f9fafb', borderRadius: '4px', border: '1px solid #e5e7eb' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#2d6fd4' }}>{p.dropbox_path.split('/').pop()}</span>
                    {p.caption && <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '12px', color: '#6b7280' }}>— {p.caption}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signature */}
          {report.signed_name && (
            <div style={{ padding: '12px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px' }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Digitally Signed</div>
              <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '16px', color: '#166534' }}>{report.signed_name}</div>
              {report.signed_at && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>{new Date(report.signed_at).toLocaleString()}</div>}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

// ─── Daily Reports Page ───────────────────────────────────────────────────────

export default function DailyReportsPage() {
  const { activeProject, activeRole, profile, can } = useAuth()
  const {
    reports, allReports, allTrades, loading, saving, error,
    filters, setFilters, fetchReports, saveReport,
  } = useDailyReports()

  const [mode,         setMode]       = useState<'list' | 'create' | 'edit'>('list')
  const [viewId,       setViewId]     = useState<string | null>(null)
  const [showView,     setShowView]   = useState(false)
  const [editingId,    setEditingId]  = useState<string | null>(null)
  const [editInitial,  setEditInitial]= useState<any>(null)

  const { fetchFullReport } = useDailyReports()
  const canCreate = can('create_daily_report')
  const canViewAll = can('view_all_daily_reports')

  async function handleEdit(id: string) {
    const full = await fetchFullReport(id)
    if (!full) return
    setEditInitial(full)
    setEditingId(id)
    setShowView(false)
    setMode('edit')
  }

  async function handleSave(data: any) {
    const { error } = await saveReport(
      data, data.manpower, data.equipment, data.deliveries, data.photos,
      editingId ?? undefined
    )
    if (!error) { setMode('list'); setEditingId(null); setEditInitial(null) }
  }

  const incidentCount = allReports.filter(r => r.has_safety_incident).length
  const todayCount    = allReports.filter(r => r.report_date === today()).length
  const thisWeek      = allReports.filter(r => {
    const d = new Date(r.report_date + 'T12:00:00')
    const now = new Date()
    const monday = new Date(now); monday.setDate(now.getDate() - now.getDay() + 1)
    return d >= monday
  }).length

  if (!activeProject) {
    return <EmptyState title="No Project Selected" description="Select a project to view daily reports." />
  }

  // ── Form mode ──────────────────────────────────────────────────────────────
  if (mode === 'create' || mode === 'edit') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
          <button onClick={() => { setMode('list'); setEditingId(null); setEditInitial(null) }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', padding: 0 }}
          >
            ← Back
          </button>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '28px', fontWeight: 800, color: '#0f1923', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
            {mode === 'create' ? 'New Daily Report' : 'Edit Daily Report'}
          </h1>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '28px' }}>
          <ReportForm
            initial={editInitial ?? blankReport(activeProject.trade)}
            onSave={handleSave}
            onCancel={() => { setMode('list'); setEditingId(null); setEditInitial(null) }}
            saving={saving}
          />
        </div>
      </div>
    )
  }

  // ── List mode ──────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .report-row{cursor:pointer;transition:background 0.1s}
        .report-row:hover{background:#fafafa}
        .report-row.incident td:first-child{border-left:3px solid #dc2626}
        input:focus,select:focus,textarea:focus{border-color:#e8611a!important;outline:none}
      `}</style>

      <PageHeader
        title="Daily Reports"
        subtitle={`${allReports.length} total · ${todayCount} today · ${thisWeek} this week${incidentCount > 0 ? ` · ${incidentCount} incidents` : ''}`}
        actions={canCreate ? (
          <Button onClick={() => setMode('create')}
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}>
            New Report
          </Button>
        ) : undefined}
      />

      {/* Stats */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Today',       val: todayCount,    color: '#2d9e5f' },
          { label: 'This Week',   val: thisWeek,      color: '#2d6fd4' },
          { label: 'Total',       val: allReports.length, color: '#0f1923' },
          ...(incidentCount > 0 ? [{ label: 'Incidents', val: incidentCount, color: '#dc2626' }] : []),
        ].map(s => (
          <div key={s.label} style={{ padding: '10px 18px', borderRadius: '4px', background: 'white', border: '1.5px solid #e5e7eb' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '28px', fontWeight: 800, color: s.val > 0 ? s.color : '#d1d5db', lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9ca3af', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '3px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '260px' }}>
          <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input style={{ ...inputStyle, paddingLeft: '32px' }} placeholder="Search reports..."
            value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
        </div>

        <input type="date" style={{ ...inputStyle, width: '145px' }}
          value={filters.date_from} onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} />
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>to</span>
        <input type="date" style={{ ...inputStyle, width: '145px' }}
          value={filters.date_to} onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} />

        {allTrades.length > 1 && (
          <select style={{ ...selectStyle, width: '140px' }} value={filters.trade}
            onChange={e => setFilters(f => ({ ...f, trade: e.target.value }))}>
            <option value="all">All Trades</option>
            {allTrades.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}

        {incidentCount > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: filters.incident_only ? '#dc2626' : '#6b7280', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={filters.incident_only} onChange={e => setFilters(f => ({ ...f, incident_only: e.target.checked }))} />
            Incidents only
          </label>
        )}

        {(filters.search || filters.date_from || filters.date_to || filters.trade !== 'all' || filters.incident_only) && (
          <Button variant="ghost" size="sm" onClick={() => setFilters({ search: '', date_from: '', date_to: '', trade: 'all', incident_only: false })}>
            Clear
          </Button>
        )}

        <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#9ca3af' }}>
          {reports.length} report{reports.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '0 20px' }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
                <Skeleton width={100} height={12} />
                <Skeleton width={120} height={12} />
                <Skeleton width="40%" height={12} />
                <Skeleton width={60} height={20} borderRadius="3px" style={{ marginLeft: 'auto' }} />
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2d9e5f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            title={allReports.length === 0 ? 'No Reports Yet' : 'No Results'}
            description={allReports.length === 0 ? 'Submit the first daily report for this project.' : 'Try adjusting your date range or filters.'}
            action={allReports.length === 0 && canCreate ? <Button onClick={() => setMode('create')}>Create First Report</Button> : undefined}
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  ['Date',     '130px'],
                  ['Submitted By', '160px'],
                  ['Trade',    '130px'],
                  ['Weather',  '110px'],
                  ['Workers',  '80px'],
                  ['Work Summary', ''],
                  ['',         '80px'],
                ].map(([label, width]) => (
                  <th key={label} style={{ padding: '10px 14px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', textAlign: 'left', background: '#fafafa', borderBottom: '1px solid #e5e7eb', ...(width ? { width } : {}) }}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => {
                const weather = r.weather_condition ? WEATHER_META[r.weather_condition] : null
                return (
                  <tr key={r.id} className={`report-row ${r.has_safety_incident ? 'incident' : ''}`}
                    onClick={() => { setViewId(r.id); setShowView(true) }}>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap' }}>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#0f1923' }}>
                        {fmtShort(r.report_date)}
                      </div>
                      {r.report_date === today() && (
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#2d9e5f', marginTop: '2px' }}>Today</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#374151', fontWeight: 500 }}>{r.submitted_by_name ?? '—'}</div>
                      {r.submitted_by_company && <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#9ca3af' }}>{r.submitted_by_company}</div>}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      {r.trade ? <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8b5cf6', background: '#f5f3ff', padding: '2px 7px', borderRadius: '3px' }}>{r.trade}</span> : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
                      {weather && (
                        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px' }}>
                          {weather.icon} {weather.label}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                      {r.has_safety_incident && (
                        <span title="Safety incident" style={{ marginRight: '4px' }}>⚠️</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', maxWidth: '300px' }}>
                      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: '13px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.work_performed ? r.work_performed.slice(0, 120) + (r.work_performed.length > 120 ? '...' : '') : '—'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => exportReportPDF({ ...r, manpower: [], equipment: [], deliveries: [], photos: [] } as FullReport, activeProject.project.name)}
                          title="Export PDF"
                          style={{ width: '28px', height: '28px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2d6fd4'; (e.currentTarget as HTMLElement).style.color = '#2d6fd4' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <ViewReportModal
        reportId={viewId}
        open={showView}
        onClose={() => { setShowView(false); setViewId(null) }}
        onEdit={() => viewId && handleEdit(viewId)}
        projectName={activeProject.project.name}
      />
    </>
  )
}
