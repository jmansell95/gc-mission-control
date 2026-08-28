import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { weekStart, staffId } = await req.json();

    const staff = staffId ? await base44.entities.Staff.get(staffId) : null;
    const rotas = await base44.entities.RotaAssignment.filter({ week_start: weekStart });
    const filteredRotas = staffId ? rotas.filter(r => r.staff_id === staffId) : rotas;

    const jobIds = [...new Set(filteredRotas.map(r => r.job_id))];
    const jobs = await Promise.all(jobIds.map(id => base44.entities.Job.get(id).catch(() => null)));

    const vehicleIds = [...new Set(filteredRotas.map(r => r.vehicle_id).filter(Boolean))];
    const vehicles = await Promise.all(vehicleIds.map(id => base44.entities.Vehicle.get(id).catch(() => null)));

    const allStaffIds = [...new Set(filteredRotas.map(r => r.staff_id))];
    const allStaff = await Promise.all(allStaffIds.map(id => base44.entities.Staff.get(id).catch(() => null)));

    const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const fmtDate = (d) => {
      const date = new Date(d + 'T00:00:00');
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return days[date.getDay()] + ' ' + date.getDate() + ' ' + months[date.getMonth()];
    };
    const jobTypeLabels = {groundworks:'Groundworks',cp_drilling:'CP Drilling',rotary_drilling:'Rotary Drilling',enabling_works:'Enabling Works',depot:'Depot'};
    const roleLabels = {groundworker:'Groundworker',cp_driller:'CP Driller',rotary_driller:'Rotary Driller',enabling_crew:'Enabling Crew',depot:'Depot',supervisor:'Supervisor'};
    const formatJobType = (t) => jobTypeLabels[t] || (t||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    const formatJobRole = (r) => roleLabels[r] || (r||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

    const genDate = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    let bodyContent = '';

    if (staffId && staff) {
      const rows = filteredRotas.map(rota => {
        const job = jobs.find(j => j?.id === rota.job_id);
        const vehicle = vehicles.find(v => v?.id === rota.vehicle_id);
        if (!job) return '';
        const times = (rota.start_time || rota.end_time) ? (rota.start_time || '—') + '–' + (rota.end_time || '—') : '—';
        return `<tr><td>${fmtDate(rota.assigned_date)}</td><td class="job-name">${esc(job.name)}</td><td>${esc(job.location)}</td><td>${esc(formatJobType(job.job_type))}</td><td>${times}</td><td>${vehicle ? esc(vehicle.registration_number) : '—'}</td></tr>`;
      }).join('');

      bodyContent = `
        <div class="header">
          <div class="header-left">
            <h1>Weekly Schedule</h1>
            <p>${esc(staff.name)} · ${esc(formatJobRole(staff.job_role))} · ${esc(staff.worker_type.replace(/_/g,' '))}</p>
          </div>
          <div class="header-right">
            <p class="week-label">Week of</p>
            <p class="week-date">${fmtDate(weekStart)}</p>
          </div>
        </div>
        <div class="summary-grid">
          <div class="summary-card"><div class="summary-value">${filteredRotas.length}</div><div class="summary-label">Shifts</div></div>
          <div class="summary-card"><div class="summary-value">${jobIds.length}</div><div class="summary-label">Jobs</div></div>
          <div class="summary-card"><div class="summary-value">${vehicleIds.length}</div><div class="summary-label">Vehicles</div></div>
        </div>
        <table><thead><tr><th>Date</th><th>Job</th><th>Location</th><th>Type</th><th>Times</th><th>Vehicle</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    } else {
      const rows = filteredRotas.map(rota => {
        const job = jobs.find(j => j?.id === rota.job_id);
        const vehicle = vehicles.find(v => v?.id === rota.vehicle_id);
        const member = allStaff.find(s => s?.id === rota.staff_id);
        if (!job) return '';
        const times = (rota.start_time || rota.end_time) ? (rota.start_time || '—') + '–' + (rota.end_time || '—') : '—';
        return `<tr><td class="job-name">${esc(member?.name || 'Unknown')}</td><td>${esc(formatJobRole(member?.job_role) || '—')}</td><td>${fmtDate(rota.assigned_date)}</td><td class="job-name">${esc(job.name)}</td><td>${esc(job.location)}</td><td>${times}</td><td>${vehicle ? esc(vehicle.registration_number) : '—'}</td></tr>`;
      }).join('');

      bodyContent = `
        <div class="header">
          <div class="header-left">
            <h1>Weekly Rota</h1>
            <p>All Staff Assignments</p>
          </div>
          <div class="header-right">
            <p class="week-label">Week of</p>
            <p class="week-date">${fmtDate(weekStart)}</p>
          </div>
        </div>
        <div class="summary-grid">
          <div class="summary-card"><div class="summary-value">${filteredRotas.length}</div><div class="summary-label">Assignments</div></div>
          <div class="summary-card"><div class="summary-value">${allStaffIds.length}</div><div class="summary-label">Staff</div></div>
          <div class="summary-card"><div class="summary-value">${jobIds.length}</div><div class="summary-label">Jobs</div></div>
          <div class="summary-card"><div class="summary-value">${vehicleIds.length}</div><div class="summary-label">Vehicles</div></div>
        </div>
        <table><thead><tr><th>Staff</th><th>Role</th><th>Date</th><th>Job</th><th>Location</th><th>Times</th><th>Vehicle</th></tr></thead>
        <tbody>${rows}</tbody></table>`;
    }

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1e293b;padding:24px;max-width:900px;margin:0 auto}
      .header{background:linear-gradient(135deg,#1c4a12 0%,#2E5A1A 100%);color:white;border-radius:12px;padding:24px 28px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
      .header h1{font-size:22px;font-weight:700}
      .header p{font-size:13px;opacity:0.85;margin-top:4px}
      .header-right{text-align:right}
      .week-label{font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:0.05em}
      .week-date{font-size:16px;font-weight:600}
      .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
      .summary-card{background:#f4f9ee;border:1px solid #cfe8b8;border-radius:10px;padding:14px 16px;text-align:center}
      .summary-value{font-size:24px;font-weight:700;color:#2E5A1A}
      .summary-label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
      table{width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
      th{background:#2E5A1A;color:white;padding:10px 12px;text-align:left;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.03em}
      td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px}
      tr:nth-child(even) td{background:#f8fafb}
      tr:last-child td{border-bottom:none}
      .job-name{font-weight:600;color:#1e293b}
      .footer{margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8}
      .footer-brand{font-weight:600;color:#2E5A1A}
      @media print{body{padding:12px}.header,.summary-card,th,tr:nth-child(even) td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    ${bodyContent}
    <div class="footer"><span>Generated ${genDate}</span><span class="footer-brand">GC Mission Control</span></div>
    </body></html>`;

    return Response.json({
      html: htmlContent,
      fileName: staffId ? `${staff.name}_schedule_${weekStart}.html` : `rota_${weekStart}.html`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});