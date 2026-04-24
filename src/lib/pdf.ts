// src/lib/pdf.ts
// FieldStack PDF Export Engine
// Generates print-ready HTML, opens in new tab, triggers browser print dialog.
// All exports share a unified brand template with consistent headers/footers.

// ─── Shared styles ────────────────────────────────────────────────────────────

const BASE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: letter;
    margin: 0.6in 0.65in;
  }

  body {
    font-family: 'IBM Plex Sans', Helvetica, Arial, sans-serif;
    font-size: 11px;
    color: #1a1a2e;
    background: white;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Header ── */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-bottom: 14px;
    margin-bottom: 20px;
    border-bottom: 3px solid #e8611a;
  }

  .brand-block { display: flex; align-items: center; gap: 10px; }
  .brand-icon  {
    width: 36px; height: 36px; background: #e8611a;
    display: flex; align-items: center; justify-content: center;
    clip-path: polygon(0 0, 85% 0, 100% 15%, 100% 100%, 0 100%);
    font-size: 16px; color: white;
  }
  .brand-name  { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #0f1923; }
  .brand-sub   { font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: #9ca3af; letter-spacing: 2px; text-transform: uppercase; }

  .doc-title-block { text-align: right; }
  .doc-number { font-family: 'Barlow Condensed', sans-serif; font-size: 28px; font-weight: 800; color: #0f1923; line-height: 1; }
  .doc-type   { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #9ca3af; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 3px; }

  /* ── Title ── */
  .doc-main-title {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 20px; font-weight: 700; color: #0f1923;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 16px;
  }

  /* ── Meta grid ── */
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    padding: 12px 14px;
    background: #f6f4f1;
    border-radius: 4px;
    margin-bottom: 20px;
    border-left: 3px solid #e8611a;
  }
  .meta-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .meta-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }

  .meta-item-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 8px; color: #9ca3af;
    letter-spacing: 1.5px; text-transform: uppercase;
    margin-bottom: 3px;
  }
  .meta-item-value {
    font-size: 11px; font-weight: 600; color: #0f1923;
    font-family: 'IBM Plex Mono', monospace;
  }

  /* ── Status badge ── */
  .status-badge {
    display: inline-block;
    padding: 3px 10px; border-radius: 3px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .status-open               { background: #fef3ec; color: #e8611a; }
  .status-answered           { background: #eff6ff; color: #2d6fd4; }
  .status-closed             { background: #f0fdf4; color: #2d9e5f; }
  .status-draft              { background: #f3f4f6; color: #6b7280; }
  .status-void               { background: #f9fafb; color: #9ca3af; }
  .status-submitted          { background: #eff6ff; color: #2d6fd4; }
  .status-under_review       { background: #fefce8; color: #ca8a04; }
  .status-approved           { background: #f0fdf4; color: #2d9e5f; }
  .status-approved_as_noted  { background: #f0fdf4; color: #15803d; }
  .status-revise_and_resubmit{ background: #fff7ed; color: #c2410c; }
  .status-rejected           { background: #fef2f2; color: #dc2626; }
  .status-in_progress        { background: #eff6ff; color: #2d6fd4; }
  .status-ready_for_inspection{background: #fefce8; color: #ca8a04; }
  .priority-low              { background: #f0fdf4; color: #2d9e5f; }
  .priority-medium           { background: #eff6ff; color: #2d6fd4; }
  .priority-high             { background: #fff7ed; color: #e8a020; }
  .priority-critical         { background: #fef2f2; color: #dc2626; }

  /* ── Content sections ── */
  .section { margin-bottom: 20px; }
  .section-label {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px; font-weight: 700;
    color: #9ca3af; letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #e5e7eb;
  }
  .text-box {
    padding: 12px 14px;
    background: #f9fafb;
    border-left: 3px solid #e8611a;
    border-radius: 0 4px 4px 0;
    line-height: 1.7;
    white-space: pre-wrap;
    font-size: 11px;
    color: #374151;
  }
  .text-box.green  { border-left-color: #2d9e5f; background: #f0fdf4; }
  .text-box.blue   { border-left-color: #2d6fd4; background: #eff6ff; }
  .text-box.red    { border-left-color: #dc2626; background: #fef2f2; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  th {
    background: #0f1923; color: #f6f4f1;
    padding: 7px 10px; text-align: left;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px; letter-spacing: 1px; text-transform: uppercase; font-weight: 600;
  }
  th.light { background: #f6f4f1; color: #6b7280; }
  td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  tr.overdue td { background: #fef2f2; }

  /* ── Signature ── */
  .signature-block {
    margin-top: 24px;
    padding: 12px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .signature-line { border-bottom: 1.5px solid #0f1923; min-width: 200px; padding-bottom: 4px; margin-bottom: 4px; font-style: italic; font-size: 14px; }
  .signature-label { font-family: 'IBM Plex Mono', monospace; font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; }

  /* ── Footer ── */
  .page-footer {
    margin-top: 32px;
    padding-top: 10px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9px;
    color: #9ca3af;
  }
  .footer-right { text-align: right; }

  /* ── Print media ── */
  @media print {
    body { font-size: 10px; }
    .no-print { display: none !important; }
  }

  /* ── Divider ── */
  .divider { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }

  /* ── Incident flag ── */
  .incident-flag {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 12px; border-radius: 4px;
    background: #fef2f2; color: #dc2626;
    font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 12px;
  }
`

// ─── HTML wrapper ──────────────────────────────────────────────────────────────

function wrapHTML(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>FieldStack — ${title}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>${body}</body>
</html>`
}

// ─── Header component ─────────────────────────────────────────────────────────

function pageHeader(docNumber: string, docType: string, projectName: string): string {
  return `
<div class="page-header">
  <div class="brand-block">
    <div class="brand-icon">🏗</div>
    <div>
      <div class="brand-name">FieldStack</div>
      <div class="brand-sub">${projectName}</div>
    </div>
  </div>
  <div class="doc-title-block">
    <div class="doc-number">${docNumber}</div>
    <div class="doc-type">${docType}</div>
  </div>
</div>`
}

// ─── Footer component ─────────────────────────────────────────────────────────

function pageFooter(docNumber: string, projectName: string): string {
  const now = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return `
<div class="page-footer">
  <span>Generated by FieldStack · ${now}</span>
  <div class="footer-right">
    <div>${docNumber}</div>
    <div>${projectName}</div>
  </div>
</div>`
}

// ─── Meta item helper ────────────────────────────────────────────────────────

function metaItem(label: string, value: string): string {
  return `<div><div class="meta-item-label">${label}</div><div class="meta-item-value">${value}</div></div>`
}

// ─── Open print window ────────────────────────────────────────────────────────

export function openPrintWindow(html: string): void {
  const win = window.open('', '_blank')
  if (!win) { alert('Pop-up blocked. Please allow pop-ups for this site.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 600)
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE EXPORTERS
// ─────────────────────────────────────────────────────────────────────────────

// ─── RFI PDF ──────────────────────────────────────────────────────────────────

export interface RFIExportData {
  rfi_number: string; subject: string; status: string; priority: string
  ball_in_court_name: string | null; due_date: string | null
  question: string; response: string | null; response_date: string | null
  response_by_name: string | null; linked_sheet: string | null
  linked_spec: string | null; created_by_name: string | null
  created_at: string; is_overdue: boolean
}

export function exportRFI(rfi: RFIExportData, projectName: string): void {
  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const body = `
${pageHeader(rfi.rfi_number, 'Request for Information', projectName)}

<h1 class="doc-main-title">${escHtml(rfi.subject)}</h1>

${rfi.is_overdue ? '<div class="incident-flag">⚠ Overdue</div>' : ''}

<div class="meta-grid">
  ${metaItem('Status',       `<span class="status-badge status-${rfi.status}">${rfi.status.toUpperCase()}</span>`)}
  ${metaItem('Priority',     `<span class="status-badge priority-${rfi.priority}">${rfi.priority.toUpperCase()}</span>`)}
  ${metaItem('Due Date',     fmtDate(rfi.due_date))}
  ${metaItem('Ball in Court',rfi.ball_in_court_name ?? '—')}
  ${metaItem('Created By',   rfi.created_by_name ?? '—')}
  ${metaItem('Date Created', fmtDate(rfi.created_at))}
  ${metaItem('Drawing / Sheet', rfi.linked_sheet ?? '—')}
  ${metaItem('Spec Section', rfi.linked_spec ?? '—')}
</div>

<div class="section">
  <div class="section-label">Question</div>
  <div class="text-box">${escHtml(rfi.question)}</div>
</div>

${rfi.response ? `
<div class="section">
  <div class="section-label">Response — ${fmtDate(rfi.response_date)} · ${rfi.response_by_name ?? '—'}</div>
  <div class="text-box green">${escHtml(rfi.response)}</div>
</div>` : `
<div class="section">
  <div class="section-label">Response</div>
  <div class="text-box" style="color:#9ca3af;font-style:italic">No response recorded.</div>
</div>`}

${pageFooter(rfi.rfi_number, projectName)}`

  openPrintWindow(wrapHTML(`${rfi.rfi_number} — ${rfi.subject}`, body))
}

// ─── Submittal PDF ────────────────────────────────────────────────────────────

export interface SubmittalExportData {
  submittal_number: string; spec_section: string; spec_title: string | null
  description: string; status: string; current_revision: number
  subcontractor_name: string | null; reviewer_name: string | null
  submitted_date: string | null; required_return_date: string | null
  returned_date: string | null; created_by_name: string | null
  revisions?: Array<{
    revision_number: number; status: string; notes: string | null
    submitted_by_name: string | null; returned_by_name: string | null
    submitted_at: string | null; returned_at: string | null
  }>
}

export function exportSubmittal(sub: SubmittalExportData, projectName: string): void {
  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const revRows = (sub.revisions ?? []).map(r => `
<tr>
  <td style="font-family:'IBM Plex Mono',monospace;font-weight:700">Rev ${r.revision_number}</td>
  <td><span class="status-badge status-${r.status}">${r.status.replace(/_/g,' ')}</span></td>
  <td>${r.submitted_by_name ?? '—'}</td>
  <td>${fmtDate(r.submitted_at?.split('T')[0] ?? null)}</td>
  <td>${r.returned_by_name ?? '—'}</td>
  <td>${fmtDate(r.returned_at?.split('T')[0] ?? null)}</td>
  <td style="font-style:italic;color:#6b7280">${escHtml(r.notes ?? '')}</td>
</tr>`).join('')

  const body = `
${pageHeader(sub.submittal_number, 'Submittal', projectName)}

<h1 class="doc-main-title">${escHtml(sub.description)}</h1>
<div style="margin-bottom:16px">
  <span class="status-badge status-${sub.status}">${sub.status.replace(/_/g,' ')}</span>
  <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#6b7280;margin-left:10px">Rev ${sub.current_revision}</span>
</div>

<div class="meta-grid cols-3">
  ${metaItem('Spec Section',  sub.spec_section)}
  ${metaItem('Spec Title',    sub.spec_title ?? '—')}
  ${metaItem('Revision',      `Rev ${sub.current_revision}`)}
  ${metaItem('Subcontractor', sub.subcontractor_name ?? '—')}
  ${metaItem('Reviewer',      sub.reviewer_name ?? '—')}
  ${metaItem('Date Submitted',fmtDate(sub.submitted_date))}
  ${metaItem('Required Return',fmtDate(sub.required_return_date))}
  ${metaItem('Returned',      fmtDate(sub.returned_date))}
</div>

${revRows ? `
<div class="section">
  <div class="section-label">Revision History</div>
  <table>
    <thead>
      <tr>
        <th>Rev</th><th>Status</th><th>Submitted By</th>
        <th>Date Submitted</th><th>Returned By</th><th>Date Returned</th><th>Notes</th>
      </tr>
    </thead>
    <tbody>${revRows}</tbody>
  </table>
</div>` : ''}

${pageFooter(sub.submittal_number, projectName)}`

  openPrintWindow(wrapHTML(`${sub.submittal_number} — ${sub.description}`, body))
}

// ─── Punch List PDF ───────────────────────────────────────────────────────────

export interface PunchExportItem {
  punch_number: string; location: string; trade: string; description: string
  status: string; assigned_to_name: string | null; due_date: string | null
  is_overdue: boolean; closed_by_name: string | null; closed_at: string | null
  created_by_name: string | null
}

export function exportPunchList(
  items: PunchExportItem[],
  projectName: string,
  filters?: string
): void {
  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const open     = items.filter(i => i.status !== 'closed').length
  const closed   = items.filter(i => i.status === 'closed').length
  const overdue  = items.filter(i => i.is_overdue).length

  const rows = items.map(i => `
<tr class="${i.is_overdue ? 'overdue' : ''}">
  <td style="font-family:'IBM Plex Mono',monospace;font-weight:700;color:#e8611a">${i.punch_number}</td>
  <td>${escHtml(i.location)}</td>
  <td><span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#8b5cf6;background:#f5f3ff;padding:2px 6px;border-radius:3px">${escHtml(i.trade)}</span></td>
  <td style="max-width:220px">${escHtml(i.description)}</td>
  <td><span class="status-badge status-${i.status}">${i.status.replace(/_/g,' ')}</span></td>
  <td>${i.assigned_to_name ?? '—'}</td>
  <td style="${i.is_overdue ? 'color:#dc2626;font-weight:700' : ''}">${i.is_overdue ? '⚠ OVERDUE' : fmtDate(i.due_date)}</td>
</tr>`).join('')

  const body = `
${pageHeader('Punch List', 'Deficiency Register', projectName)}

<div class="meta-grid cols-3">
  ${metaItem('Total Items',   String(items.length))}
  ${metaItem('Open',          String(open))}
  ${metaItem('Closed',        String(closed))}
  ${metaItem('Overdue',       String(overdue))}
  ${metaItem('Generated',     new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))}
  ${metaItem('Filter',        filters ?? 'All items')}
</div>

<table>
  <thead>
    <tr>
      <th>Item #</th><th>Location</th><th>Trade</th><th>Description</th>
      <th>Status</th><th>Assigned To</th><th>Due Date</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

${pageFooter('Punch List', projectName)}`

  openPrintWindow(wrapHTML('Punch List', body))
}

// ─── Daily Report PDF ─────────────────────────────────────────────────────────

export interface DailyReportExportData {
  report_date: string; submitted_by_name: string | null
  trade: string | null; weather_condition: string | null
  temp_high: number | null; temp_low: number | null
  site_conditions: string | null; work_performed: string | null
  safety_observations: string | null; has_safety_incident: boolean
  notes: string | null; signed_name: string | null; signed_at: string | null
  manpower:   Array<{ trade: string; foreman_name: string | null; worker_count: number; hours_worked: number | null }>
  equipment:  Array<{ equipment_type: string; unit_id: string | null; hours_used: number | null }>
  deliveries: Array<{ material: string; supplier: string | null; quantity: string | null; po_reference: string | null }>
  photos:     Array<{ dropbox_path: string; caption: string | null }>
}

export function exportDailyReport(report: DailyReportExportData, projectName: string): void {
  const fmtDateTime = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—'

  const WEATHER_LABELS: Record<string, string> = {
    clear: '☀️ Clear', partly_cloudy: '⛅ Partly Cloudy', overcast: '☁️ Overcast',
    rain: '🌧️ Rain', wind: '💨 Wind', snow: '❄️ Snow', fog: '🌫️ Fog',
  }

  const manpowerTotal = report.manpower.reduce((s, r) => s + (r.worker_count ?? 0), 0)

  const manpowerRows = report.manpower.filter(r => r.trade).map(r => `
<tr>
  <td>${escHtml(r.trade)}</td>
  <td>${escHtml(r.foreman_name ?? '—')}</td>
  <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:700">${r.worker_count}</td>
  <td style="text-align:center;font-family:'IBM Plex Mono',monospace">${r.hours_worked ?? '—'}</td>
</tr>`).join('')

  const equipRows = report.equipment.filter(r => r.equipment_type).map(r => `
<tr>
  <td>${escHtml(r.equipment_type)}</td>
  <td>${escHtml(r.unit_id ?? '—')}</td>
  <td style="text-align:center;font-family:'IBM Plex Mono',monospace">${r.hours_used ?? '—'}</td>
</tr>`).join('')

  const delivRows = report.deliveries.filter(r => r.material).map(r => `
<tr>
  <td>${escHtml(r.material)}</td>
  <td>${escHtml(r.supplier ?? '—')}</td>
  <td>${escHtml(r.quantity ?? '—')}</td>
  <td style="font-family:'IBM Plex Mono',monospace">${escHtml(r.po_reference ?? '—')}</td>
</tr>`).join('')

  const photoList = report.photos.filter(p => p.dropbox_path).map(p => `
<div style="margin-bottom:6px;font-family:'IBM Plex Mono',monospace;font-size:10px;color:#374151">
  📷 ${escHtml(p.dropbox_path.split('/').pop() ?? '')}
  ${p.caption ? `<span style="color:#6b7280"> — ${escHtml(p.caption)}</span>` : ''}
</div>`).join('')

  const longDate = new Date(report.report_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const body = `
${pageHeader(longDate, 'Daily Field Report', projectName)}

${report.has_safety_incident ? '<div class="incident-flag">⚠ Safety Incident Reported — GC PM Notified</div>' : ''}

<div class="meta-grid">
  ${metaItem('Date',          longDate)}
  ${metaItem('Submitted By',  report.submitted_by_name ?? '—')}
  ${metaItem('Trade / Company', report.trade ?? '—')}
  ${metaItem('Total Workers', String(manpowerTotal))}
  ${metaItem('Weather',       WEATHER_LABELS[report.weather_condition ?? ''] ?? '—')}
  ${metaItem('High Temp',     report.temp_high != null ? `${report.temp_high}°F` : '—')}
  ${metaItem('Low Temp',      report.temp_low  != null ? `${report.temp_low}°F`  : '—')}
</div>

${report.site_conditions ? `
<div class="section">
  <div class="section-label">Site Conditions</div>
  <div class="text-box">${escHtml(report.site_conditions)}</div>
</div>` : ''}

${report.work_performed ? `
<div class="section">
  <div class="section-label">Work Performed Today</div>
  <div class="text-box">${escHtml(report.work_performed)}</div>
</div>` : ''}

${manpowerRows ? `
<div class="section">
  <div class="section-label">Manpower on Site (${manpowerTotal} workers)</div>
  <table>
    <thead><tr><th>Trade</th><th>Foreman</th><th class="light" style="text-align:center">Workers</th><th class="light" style="text-align:center">Hours</th></tr></thead>
    <tbody>${manpowerRows}</tbody>
  </table>
</div>` : ''}

${equipRows ? `
<div class="section">
  <div class="section-label">Equipment on Site</div>
  <table>
    <thead><tr><th>Equipment</th><th>Unit ID</th><th class="light" style="text-align:center">Hours</th></tr></thead>
    <tbody>${equipRows}</tbody>
  </table>
</div>` : ''}

${delivRows ? `
<div class="section">
  <div class="section-label">Deliveries Received</div>
  <table>
    <thead><tr><th>Material</th><th>Supplier</th><th>Quantity</th><th>PO Reference</th></tr></thead>
    <tbody>${delivRows}</tbody>
  </table>
</div>` : ''}

${report.safety_observations ? `
<div class="section">
  <div class="section-label">Safety Observations</div>
  <div class="text-box ${report.has_safety_incident ? 'red' : ''}">${escHtml(report.safety_observations)}</div>
</div>` : ''}

${report.notes ? `
<div class="section">
  <div class="section-label">Additional Notes</div>
  <div class="text-box blue">${escHtml(report.notes)}</div>
</div>` : ''}

${photoList ? `
<div class="section">
  <div class="section-label">Photos (${report.photos.length})</div>
  ${photoList}
</div>` : ''}

${report.signed_name ? `
<div class="signature-block">
  <div>
    <div class="signature-line">${escHtml(report.signed_name)}</div>
    <div class="signature-label">Digital Signature</div>
  </div>
  <div style="text-align:right">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:#374151">${fmtDateTime(report.signed_at)}</div>
    <div class="signature-label">Date / Time Signed</div>
  </div>
</div>` : ''}

${pageFooter(longDate, projectName)}`

  openPrintWindow(wrapHTML(`Daily Report ${report.report_date}`, body))
}

// ─── Drawing Register PDF ─────────────────────────────────────────────────────

export interface DrawingRegisterItem {
  sheet_number: string; sheet_name: string; discipline: string
  current_version: number; latest_revision_label: string | null
  latest_issue_type: string | null; latest_issued_date: string | null
}

export function exportDrawingRegister(
  drawings: DrawingRegisterItem[],
  projectName: string
): void {
  const fmtDate = (d: string | null) => d
    ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  const DISC_ABBR: Record<string, string> = {
    architectural:'A', structural:'S', civil:'C', mechanical:'M',
    electrical:'E', plumbing:'P', landscape:'L', other:'O',
  }
  const DISC_COLORS: Record<string, string> = {
    architectural:'#e8611a', structural:'#2d6fd4', civil:'#166534',
    mechanical:'#ca8a04', electrical:'#7c3aed', plumbing:'#0891b2',
    landscape:'#15803d', other:'#6b7280',
  }

  const rows = drawings.map(d => `
<tr>
  <td style="font-family:'IBM Plex Mono',monospace;font-weight:700;color:${DISC_COLORS[d.discipline] ?? '#374151'}">${d.sheet_number}</td>
  <td>${escHtml(d.sheet_name)}</td>
  <td><span style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;color:${DISC_COLORS[d.discipline] ?? '#374151'}">${DISC_ABBR[d.discipline] ?? '?'}</span></td>
  <td style="font-family:'IBM Plex Mono',monospace">${d.latest_revision_label ?? `Rev ${d.current_version}`}</td>
  <td>${d.latest_issue_type?.replace(/_/g,' ') ?? '—'}</td>
  <td style="font-family:'IBM Plex Mono',monospace">${fmtDate(d.latest_issued_date)}</td>
  <td style="text-align:center;font-family:'IBM Plex Mono',monospace;font-weight:${d.current_version > 1 ? '700' : '400'};color:${d.current_version > 1 ? '#e8611a' : '#374151'}">${d.current_version}</td>
</tr>`).join('')

  const body = `
${pageHeader('Drawing Register', `${drawings.length} Sheets`, projectName)}

<div class="meta-grid cols-3">
  ${metaItem('Total Sheets',  String(drawings.length))}
  ${metaItem('Generated',     new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}
  ${metaItem('Project',       projectName)}
</div>

<table>
  <thead>
    <tr>
      <th>Sheet No.</th><th>Sheet Name</th><th>Disc.</th>
      <th>Current Rev</th><th>Issue Type</th><th>Issue Date</th><th style="text-align:center">Versions</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

${pageFooter('Drawing Register', projectName)}`

  openPrintWindow(wrapHTML('Drawing Register', body))
}

// ─── HTML escape ──────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
