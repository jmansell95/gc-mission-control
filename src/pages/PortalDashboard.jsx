import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Building2, HardHat, MapPin, Calendar, Loader2, ArrowLeft, Users, Camera,
  FileText, Target, MessageSquare, CheckCircle2, Circle, Clock, PoundSterling,
  Truck, Mountain, ChevronRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

const statusLabels = {
  planning: 'Planning', in_progress: 'In Progress', decommissioning: 'Decommissioning',
  completed: 'Completed', on_hold: 'On Hold', cancelled: 'Cancelled',
};
const statusColors = {
  planning: 'bg-slate-100 text-slate-600', in_progress: 'bg-emerald-100 text-emerald-700',
  decommissioning: 'bg-orange-100 text-orange-700', completed: 'bg-teal-100 text-teal-700',
  on_hold: 'bg-amber-100 text-amber-700', cancelled: 'bg-red-100 text-red-700',
};

function ProgressRing({ completed, total }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const r = 28, c = 2 * Math.PI * r;
  const off = c - (c * pct) / 100;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="flex-shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
      <circle cx="36" cy="36" r={r} fill="none" stroke="#2E5A1A" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 36 36)" />
      <text x="36" y="40" textAnchor="middle" className="text-sm font-bold fill-slate-800">{pct}%</text>
    </svg>
  );
}

function JobCard({ job, onClick }) {
  const statusLabel = statusLabels[job.status] || job.status;
  const statusColor = statusColors[job.status] || 'bg-slate-100 text-slate-600';
  return (
    <button onClick={onClick} className="text-left hub-glass rounded-2xl p-5 hover:shadow-lg transition w-full">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-900 truncate">{job.name}</h3>
          {job.job_reference && <p className="text-xs text-slate-500 font-mono mt-0.5">{job.job_reference}</p>}
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${statusColor}`}>{statusLabel}</span>
      </div>
      <div className="space-y-1.5 text-xs text-slate-600">
        {job.location && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {job.location}</p>}
        <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" />
          {job.start_date ? format(parseISO(job.start_date), 'dd MMM yyyy') : '—'} → {job.end_date ? format(parseISO(job.end_date), 'dd MMM yyyy') : '—'}
        </p>
      </div>
      <div className="flex items-center gap-1 mt-3 text-xs font-bold text-primary">
        View project <ChevronRight className="w-3.5 h-3.5" />
      </div>
    </button>
  );
}

function JobDetailView({ data, onBack }) {
  const { job, client, contractor, schedule, progress, team, totals, billing, documents, milestones, comments, photos, role } = data;
  const sections = job.portal_sections || {};
  const show = (key, def = true) => sections[key] !== false && (sections[key] === true || def);

  const sortedDates = Object.keys(schedule || {}).sort();
  const upcomingDates = sortedDates.filter(d => d >= new Date().toISOString().slice(0, 10)).slice(0, 7);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="hero-gradient text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium mb-4 transition">
            <ArrowLeft className="w-4 h-4" /> All projects
          </button>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              {role === 'subcontractor' ? <HardHat className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold">{job.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-white/80 flex-wrap">
                {job.job_reference && <span className="font-mono">{job.job_reference}</span>}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[job.status] || 'bg-white/20'}`}>{statusLabels[job.status] || job.status}</span>
                {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location}</span>}
              </div>
            </div>
            <ProgressRing completed={progress.completed} total={progress.total} />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="hub-glass rounded-xl p-3 text-center">
            <Users className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-900">{totals.staff}</p>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Team</p>
          </div>
          <div className="hub-glass rounded-xl p-3 text-center">
            <Clock className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-900">{totals.shifts}</p>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Shifts</p>
          </div>
          <div className="hub-glass rounded-xl p-3 text-center">
            <Truck className="w-5 h-5 text-amber-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-900">{totals.hours}h</p>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Hours</p>
          </div>
          {totals.meterage > 0 && (
            <div className="hub-glass rounded-xl p-3 text-center">
              <Mountain className="w-5 h-5 text-violet-600 mx-auto mb-1" />
              <p className="text-lg font-bold text-slate-900">{totals.meterage.toFixed(1)}m</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Drilled</p>
            </div>
          )}
        </div>

        {/* Team */}
        {show('team') && team.length > 0 && (
          <div className="hub-glass rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Team</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {team.map((m, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(m.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{m.name}</p>
                    <p className="text-[11px] text-slate-500">{m.role || '—'} · {m.shifts} shifts{m.meterage ? ` · ${m.meterage.toFixed(1)}m` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schedule */}
        {show('schedule') && upcomingDates.length > 0 && (
          <div className="hub-glass rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Upcoming Schedule</h3>
            <div className="space-y-2">
              {upcomingDates.map(d => (
                <div key={d} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50">
                  <div className="text-center flex-shrink-0 w-12">
                    <p className="text-sm font-bold text-slate-900">{format(parseISO(d), 'dd')}</p>
                    <p className="text-[10px] text-slate-500 uppercase">{format(parseISO(d), 'MMM')}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    {(schedule[d] || []).map((s, i) => (
                      <p key={i} className="text-xs text-slate-700">{s.staff_name}{s.role ? ` · ${s.role}` : ''}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Milestones */}
        {show('milestones') && milestones.length > 0 && (
          <div className="hub-glass rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Milestones</h3>
            <div className="space-y-2">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  {m.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <Circle className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${m.completed ? 'text-slate-800' : 'text-slate-600'}`}>{m.name}</p>
                    {m.target_date && <p className="text-[10px] text-slate-400">{format(parseISO(m.target_date), 'dd MMM yyyy')}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        {show('photos') && photos.length > 0 && (
          <div className="hub-glass rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><Camera className="w-4 h-4 text-primary" /> Site Photos ({photos.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.slice(0, 9).map((p, i) => (
                <a key={i} href={p.photo_url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-lg overflow-hidden bg-slate-100 group">
                  <img src={p.photo_url} alt={p.caption || ''} className="w-full h-full object-cover group-hover:opacity-90 transition" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Documents */}
        {show('documents') && documents.length > 0 && (
          <div className="hub-glass rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Documents ({documents.length})</h3>
            <div className="space-y-2">
              {documents.map((d, i) => (
                <a key={i} href={d.document_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition">
                  <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{d.document_name}</p>
                    <p className="text-[10px] text-slate-400 uppercase">{d.category}</p>
                  </div>
                  {d.client_approved && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        {show('comments') && comments.length > 0 && (
          <div className="hub-glass rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Comments ({comments.length})</h3>
            <div className="space-y-2">
              {comments.slice(0, 10).map((c, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-bold text-slate-700">{c.author_name || 'Unknown'}</p>
                    {c.is_client && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">Client</span>}
                    {c.created_date && <span className="text-[10px] text-slate-400">{format(parseISO(c.created_date), 'dd MMM HH:mm')}</span>}
                  </div>
                  <p className="text-sm text-slate-600">{c.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Billing */}
        {show('client_charge') && billing && (
          <div className="hub-glass rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2"><PoundSterling className="w-4 h-4 text-primary" /> {billing.quote_label}</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-semibold tabular-nums">£{Number(billing.subtotal || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-slate-600"><span>VAT ({billing.vat_rate}%)</span><span className="font-semibold tabular-nums">£{Number(billing.vat_amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-slate-900 font-bold pt-1.5 border-t border-slate-100"><span>Total</span><span className="tabular-nums">£{Number(billing.total || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        )}

        {/* Notes */}
        {show('notes') && job.notes && (
          <div className="hub-glass rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-2">Notes</h3>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{job.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortalDashboard() {
  const [selectedJobId, setSelectedJobId] = useState(null);

  const { data: portalRes, isLoading } = useQuery({
    queryKey: ['portal-jobs'],
    queryFn: () => base44.functions.invoke('getPortalJobs', {}),
  });

  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['portal-job-detail', selectedJobId],
    queryFn: () => base44.functions.invoke('getPortalJobDetail', { job_id: selectedJobId }),
    enabled: !!selectedJobId,
  });

  const portalData = portalRes?.data;
  const jobs = portalData?.jobs || [];
  const userName = portalData?.user_name || '';

  const { data: detail } = detailRes || {};

  if (selectedJobId && detail) {
    return <JobDetailView data={detail} onBack={() => setSelectedJobId(null)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="hero-gradient text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">Your Projects</h1>
          </div>
          <p className="text-sm text-white/80">Welcome{userName ? `, ${userName}` : ''}. Select a project to view live progress.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500">No projects yet</p>
            <p className="text-xs text-slate-400 mt-1">When you're invited to a project, it will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {jobs.map(j => <JobCard key={j.id} job={j} onClick={() => setSelectedJobId(j.id)} />)}
          </div>
        )}
      </div>
    </div>
  );
}