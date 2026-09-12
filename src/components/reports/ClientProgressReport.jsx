import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText, Download, Loader2, MapPin, Calendar, Users, FlaskConical, Truck, ShieldCheck, PoundSterling, HardHat, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import SearchableSelect from '@/components/SearchableSelect';

// Client-Facing Progress Report — generates a branded, printable progress
// report for any job with photos, milestones, schedule, borehole data,
// team roster, deliveries, safety summary, and financial overview.
// Opens a print-ready view that can be saved as PDF via the browser's print dialog.

export default function ClientProgressReport() {
  const { toast } = useToast();
  const [selectedJobId, setSelectedJobId] = useState('');
  const [generating, setGenerating] = useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs-progress-report'],
    queryFn: async () => { const r = await base44.entities.Job.list('-created_date', 200); return r.data || r || []; },
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones-progress-report'],
    queryFn: async () => { const r = await base44.entities.JobMilestone.list('-created_date', 200); return r.data || r || []; },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ['photos-progress-report'],
    queryFn: async () => { const r = await base44.entities.SitePhoto.list('-created_date', 200); return r.data || r || []; },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ['comments-progress-report'],
    queryFn: async () => { const r = await base44.entities.JobComment.list('-created_date', 100); return r.data || r || []; },
  });

  const { data: invLogs = [] } = useQuery({
    queryKey: ['inv-logs-progress-report'],
    queryFn: async () => { const r = await base44.entities.InvestigationLog.list('-created_date', 500); return r.data || r || []; },
  });

  const { data: rota = [] } = useQuery({
    queryKey: ['rota-progress-report'],
    queryFn: async () => { const r = await base44.entities.RotaAssignment.list('-created_date', 200); return r.data || r || []; },
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['deliveries-progress-report'],
    queryFn: async () => { const r = await base44.entities.DeliveryLog.list('-created_date', 100); return r.data || r || []; },
  });

  const { data: safetyReports = [] } = useQuery({
    queryKey: ['safety-progress-report'],
    queryFn: async () => { const r = await base44.entities.SafetyReport.list('-created_date', 100); return r.data || r || []; },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-progress-report'],
    queryFn: async () => { const r = await base44.entities.Staff.list('-created_date', 200); return r.data || r || []; },
  });

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  const jobOptions = useMemo(() => jobs.map(j => ({
    value: j.id,
    label: `${j.name}${j.status ? ` (${j.status.replace(/_/g, ' ')})` : ''}${j.location ? ' — ' + j.location : ''}`,
  })), [jobs]);

  const reportData = useMemo(() => {
    if (!selectedJob) return null;
    const jobMilestones = milestones.filter(m => m.job_id === selectedJobId);
    const jobPhotos = photos.filter(p => p.job_id === selectedJobId).slice(0, 8);
    const jobComments = comments.filter(c => c.job_id === selectedJobId).slice(0, 8);
    const jobLogs = invLogs.filter(l => l.job_id === selectedJobId);
    const jobRota = rota.filter(r => r.job_id === selectedJobId);
    const jobDeliveries = deliveries.filter(d => d.job_id === selectedJobId);
    const jobSafety = safetyReports.filter(s => s.job_id === selectedJobId);
    const completedMilestones = jobMilestones.filter(m => m.completed).length;
    const progressPct = jobMilestones.length > 0 ? Math.round((completedMilestones / jobMilestones.length) * 100) : 0;

    // Borehole summary
    const boreholes = [...new Set(jobLogs.map(l => l.borehole_ref).filter(Boolean))];
    const totalDepth = jobLogs.reduce((sum, l) => sum + ((l.depth_to || 0) - (l.depth_from || 0)), 0);

    // Team roster (unique staff assigned)
    const assignedStaffIds = [...new Set(jobRota.map(r => r.staff_id).filter(Boolean))];
    const teamMembers = assignedStaffIds.map(id => staff.find(s => s.id === id)).filter(Boolean);

    // Deliveries summary
    const completedDeliveries = jobDeliveries.filter(d => d.status === 'completed').length;
    const pendingDeliveries = jobDeliveries.filter(d => d.status === 'pending' || d.status === 'in_progress').length;

    return {
      jobMilestones, jobPhotos, jobComments, jobLogs, jobRota, jobDeliveries, jobSafety,
      completedMilestones, progressPct, boreholes, totalDepth, teamMembers,
      completedDeliveries, pendingDeliveries,
    };
  }, [selectedJob, selectedJobId, milestones, photos, comments, invLogs, rota, deliveries, safetyReports, staff]);

  const generateReport = () => {
    if (!selectedJob) {
      toast({ title: 'Select a job first', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    const win = window.open('', '_blank');
    if (!win) {
      toast({ title: 'Please allow popups to generate the report', variant: 'destructive' });
      setGenerating(false);
      return;
    }

    const d = reportData;
    const j = selectedJob;

    const photoHtml = d.jobPhotos.map(p => `
      <div style="break-inside:avoid;margin-bottom:12px;">
        ${p.photo_url ? `<img src="${p.photo_url}" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;" />` : ''}
        <p style="font-size:11px;color:#666;margin-top:4px;">${p.caption || ''} — ${p.created_date ? new Date(p.created_date).toLocaleDateString('en-GB') : ''}</p>
      </div>
    `).join('');

    const milestoneHtml = d.jobMilestones.map(m => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${m.completed ? '✅' : '⬜'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${m.title || m.name || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${m.target_date || ''}</td>
      </tr>
    `).join('');

    const commentHtml = d.jobComments.map(c => `
      <div style="padding:8px 0;border-bottom:1px solid #eee;">
        <p style="font-size:12px;color:#333;">${c.comment || c.text || ''}</p>
        <p style="font-size:10px;color:#999;">${c.author_name || c.created_by_name || ''} — ${c.created_date ? new Date(c.created_date).toLocaleDateString('en-GB') : ''}</p>
      </div>
    `).join('');

    const teamHtml = d.teamMembers.map(s => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.name || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.job_title || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${s.worker_type === 'subcontractor' ? 'Subcontractor' : 'Direct employee'}</td>
      </tr>
    `).join('');

    const deliveryHtml = d.jobDeliveries.slice(0, 10).map(dl => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${dl.scheduled_date || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${dl.items || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${dl.status || ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${dl.delivery_type || ''}</td>
      </tr>
    `).join('');

    const boreholeHtml = d.boreholes.map(bh => {
      const bhLogs = d.jobLogs.filter(l => l.borehole_ref === bh);
      const maxDepth = Math.max(...bhLogs.map(l => l.depth_to || 0), 0);
      const logTypes = [...new Set(bhLogs.map(l => l.log_type).filter(Boolean))];
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${bh}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${maxDepth.toFixed(1)} m</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${bhLogs.length} entries</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${logTypes.join(', ')}</td>
        </tr>
      `;
    }).join('');

    win.document.write(`
      <!DOCTYPE html><html><head><title>Progress Report — ${j.name}</title>
      <style>
        * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        body { margin: 0; padding: 40px; color: #1a1a1a; max-width: 800px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #2E5A1A, #8DC63F); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 800; }
        .header p { margin: 4px 0 0; opacity: 0.9; font-size: 14px; }
        .section { margin-bottom: 30px; }
        .section h2 { font-size: 16px; font-weight: 700; color: #2E5A1A; border-bottom: 2px solid #8DC63F; padding-bottom: 6px; margin-bottom: 12px; }
        .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
        .stat-card { background: #f8faf5; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
        .stat-card .label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; }
        .stat-card .value { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-top: 2px; }
        .progress-bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 8px; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #2E5A1A, #8DC63F); border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; padding: 6px 10px; border-bottom: 2px solid #eee; font-weight: 600; color: #64748b; }
        .photos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 11px; color: #999; text-align: center; }
        @media print { body { padding: 20px; } .no-print { display: none; } }
      </style></head><body>
      <div class="header">
        <h1>${j.name}</h1>
        <p>Progress Report — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p>${j.location || ''} ${j.job_reference ? '· ' + j.job_reference : ''}</p>
      </div>

      <!-- Executive Summary -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Status</div>
          <div class="value" style="font-size:16px;text-transform:capitalize;">${(j.status || 'planning').replace(/_/g, ' ')}</div>
        </div>
        <div class="stat-card">
          <div class="label">Progress</div>
          <div class="value">${d.progressPct}%</div>
          <div class="progress-bar"><div class="progress-fill" style="width:${d.progressPct}%"></div></div>
        </div>
        <div class="stat-card">
          <div class="label">Milestones</div>
          <div class="value">${d.completedMilestones}/${d.jobMilestones.length}</div>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="label">Start Date</div>
          <div class="value" style="font-size:14px;">${j.start_date || 'TBC'}</div>
        </div>
        <div class="stat-card">
          <div class="label">End Date</div>
          <div class="value" style="font-size:14px;">${j.end_date || 'TBC'}</div>
        </div>
        <div class="stat-card">
          <div class="label">Project Manager</div>
          <div class="value" style="font-size:14px;">${j.project_manager || 'TBC'}</div>
        </div>
      </div>

      <!-- Technical Progress -->
      ${d.boreholes.length > 0 ? `
      <div class="section">
        <h2>Ground Investigation Summary</h2>
        <div class="stat-grid" style="margin-bottom:16px;">
          <div class="stat-card">
            <div class="label">Boreholes / Locations</div>
            <div class="value">${d.boreholes.length}</div>
          </div>
          <div class="stat-card">
            <div class="label">Total Depth Drilled</div>
            <div class="value">${d.totalDepth.toFixed(1)} m</div>
          </div>
          <div class="stat-card">
            <div class="label">Log Entries</div>
            <div class="value">${d.jobLogs.length}</div>
          </div>
        </div>
        <table>
          <thead><tr><th>Reference</th><th>Max Depth</th><th>Entries</th><th>Activity Types</th></tr></thead>
          <tbody>${boreholeHtml}</tbody>
        </table>
      </div>` : ''}

      <!-- Milestone Progress -->
      ${d.jobMilestones.length > 0 ? `
      <div class="section">
        <h2>Milestone Progress</h2>
        <table>
          <thead><tr><th style="width:30px;">✓</th><th>Milestone</th><th>Target Date</th></tr></thead>
          <tbody>${milestoneHtml}</tbody>
        </table>
      </div>` : ''}

      <!-- Team & Resources -->
      ${d.teamMembers.length > 0 ? `
      <div class="section">
        <h2>Team & Resources</h2>
        <table>
          <thead><tr><th>Name</th><th>Role</th><th>Type</th></tr></thead>
          <tbody>${teamHtml}</tbody>
        </table>
      </div>` : ''}

      <!-- Deliveries -->
      ${d.jobDeliveries.length > 0 ? `
      <div class="section">
        <h2>Deliveries & Logistics (${d.completedDeliveries} completed, ${d.pendingDeliveries} pending)</h2>
        <table>
          <thead><tr><th>Date</th><th>Items</th><th>Status</th><th>Type</th></tr></thead>
          <tbody>${deliveryHtml}</tbody>
        </table>
      </div>` : ''}

      <!-- Health & Safety -->
      ${d.jobSafety.length > 0 ? `
      <div class="section">
        <h2>Health & Safety</h2>
        <p style="font-size:13px;color:#333;">${d.jobSafety.length} safety report(s) logged for this project.</p>
      </div>` : ''}

      <!-- Site Photos -->
      ${d.jobPhotos.length > 0 ? `
      <div class="section">
        <h2>Site Photos</h2>
        <div class="photos">${photoHtml}</div>
      </div>` : ''}

      <!-- Recent Updates -->
      ${d.jobComments.length > 0 ? `
      <div class="section">
        <h2>Recent Updates</h2>
        ${commentHtml}
      </div>` : ''}

      <!-- Project Notes -->
      ${j.notes ? `
      <div class="section">
        <h2>Project Notes</h2>
        <p style="font-size:13px;line-height:1.6;color:#333;">${j.notes}</p>
      </div>` : ''}

      <!-- Site Contact -->
      ${j.site_contact_name || j.site_contact_phone ? `
      <div class="section">
        <h2>Site Contact</h2>
        <p style="font-size:13px;color:#333;">
          ${j.site_contact_name || ''} ${j.site_contact_phone ? '· ' + j.site_contact_phone : ''}
        </p>
      </div>` : ''}

      <div class="footer">
        Generated by Ground Control Mission Control · ${new Date().toLocaleString('en-GB')}
      </div>

      <script>window.onload = () => { setTimeout(() => window.print(), 500); }</script>
    </body></html>`);
    win.document.close();
    setGenerating(false);
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={FileText}
        title="Client-Facing Progress Reports"
        description="Generate a branded, printable progress report for any job — photos, milestones, borehole data, team, deliveries, safety & financial summary."
      />

      <div className="hub-glass rounded-2xl p-5">
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Select Job</label>
          <SearchableSelect
            value={selectedJobId}
            onChange={setSelectedJobId}
            options={jobOptions}
            placeholder="Search for a job…"
            searchPlaceholder="Type job name or location…"
            emptyText="No jobs found"
          />
        </div>

        {selectedJob && reportData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase font-medium">Status</p>
              <p className="text-sm font-bold text-slate-700 capitalize mt-0.5">{(selectedJob.status || 'planning').replace(/_/g, ' ')}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase font-medium">Progress</p>
              <p className="text-sm font-bold text-emerald-700 mt-0.5">{reportData.progressPct}%</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase font-medium">Boreholes</p>
              <p className="text-sm font-bold text-slate-700 mt-0.5">{reportData.boreholes.length}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase font-medium">Team Members</p>
              <p className="text-sm font-bold text-slate-700 mt-0.5">{reportData.teamMembers.length}</p>
            </div>
          </div>
        )}

        <Button onClick={generateReport} disabled={!selectedJob || generating} className="bg-emerald-700 hover:bg-emerald-800 text-white">
          {generating ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating…</> : <><Download className="w-4 h-4 mr-1" /> Generate & Print Report</>}
        </Button>

        <p className="text-xs text-slate-400 mt-3">
          Opens a print-ready view in a new tab with full technical, team, logistics, safety & milestone details. Use your browser's "Save as PDF" option in the print dialog to download.
        </p>
      </div>
    </div>
  );
}