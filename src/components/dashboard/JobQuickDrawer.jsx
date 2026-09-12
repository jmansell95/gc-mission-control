import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, MapPin, Calendar, ArrowRight, FileBarChart, HardHat, Users,
  PoundSterling, TrendingUp, Wrench, Clock, Loader2, Briefcase,
  ShieldCheck, ShieldAlert, Activity, ChevronRight, Cog, Package, Anchor
} from 'lucide-react';
import { format } from 'date-fns';
import StatCard from '@/components/dashboard/StatCard';
import { useIsMobile } from '@/hooks/use-mobile';

const fmtGBP = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const titleCase = (s) => s ? s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : s;

const statusColors = {
  planning: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-emerald-100 text-emerald-700',
  decommissioning: 'bg-orange-100 text-orange-700',
  completed: 'bg-teal-100 text-teal-700',
  on_hold: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
};

const assetTypeIcon = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Package, lifting: Anchor };

const complianceMeta = {
  compliant: { label: 'Compliant', icon: ShieldCheck, cls: 'text-emerald-700 bg-emerald-50' },
  expiring: { label: 'Expiring', icon: ShieldAlert, cls: 'text-amber-700 bg-amber-50' },
  expired: { label: 'Expired', icon: ShieldAlert, cls: 'text-rose-700 bg-rose-50' },
  unknown: { label: 'Unknown', icon: ShieldCheck, cls: 'text-slate-500 bg-slate-100' },
};

export default function JobQuickDrawer({ job, onClose, onOpenFullDetails }) {
  const [generatingReport, setGeneratingReport] = useState(false);
  const isMobile = useIsMobile();

  const { data: costItems = [] } = useQuery({
    queryKey: ['drawer-cost-items', job?.id], queryFn: () => base44.entities.JobCostItem.filter({ job_id: job.id }),
    enabled: !!job?.id
  });
  const { data: assignments = [] } = useQuery({
    queryKey: ['drawer-asset-assignments', job?.id], queryFn: () => base44.entities.JobAssetAssignment.filter({ job_id: job.id }),
    enabled: !!job?.id
  });
  const { data: rotas = [] } = useQuery({
    queryKey: ['drawer-rotas', job?.id], queryFn: () => base44.entities.RotaAssignment.filter({ job_id: job.id }),
    enabled: !!job?.id
  });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['site-assets'], queryFn: () => base44.entities.SiteAsset.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list() });
  const { data: invLogs = [] } = useQuery({
    queryKey: ['drawer-inv-logs', job?.id], queryFn: () => base44.entities.InvestigationLog.filter({ job_id: job.id }),
    enabled: !!job?.id
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Calculate financials
  const equipCost = costItems.filter(c => c.category !== 'labour').reduce((s, c) => s + (c.unit_cost || 0) * (c.quantity || 1), 0);
  const labourCost = costItems.filter(c => c.category === 'labour').reduce((s, c) => s + (c.unit_cost || 0) * (c.quantity || 1), 0);
  const totalCost = equipCost + labourCost;
  const markupPct = job?.markup_percentage || 0;
  const markupAmt = totalCost * (markupPct / 100);
  const subtotal = totalCost + markupAmt;
  const vatRate = job?.vat_rate ?? 20;
  const vatAmt = subtotal * (vatRate / 100);
  const clientPrice = subtotal + vatAmt;
  const profit = clientPrice - totalCost;
  const margin = clientPrice > 0 ? (profit / clientPrice) * 100 : 0;

  // Meterage
  const boreholeLogs = invLogs.filter(l => l.log_type === 'borehole_progress' || l.log_type === 'sample_collection');
  const loggedMeterage = boreholeLogs.reduce((sum, l) => {
    if (l.depth_from != null && l.depth_to != null) return sum + (l.depth_to - l.depth_from);
    return sum;
  }, 0);
  const totalMeters = (job?.meterage != null && job?.meterage !== '') ? Number(job.meterage) : loggedMeterage;

  // Crew today — deduplicate by staff_id (multiple rota rows = one person)
  const todaysRotas = rotas.filter(r => r.assigned_date === todayStr);
  const _crewSeen = new Set();
  const crewToday = todaysRotas.filter(r => {
    if (!r.staff_id || _crewSeen.has(r.staff_id)) return false;
    _crewSeen.add(r.staff_id);
    return true;
  }).map(r => staff.find(s => s.id === r.staff_id)).filter(Boolean);

  // Assets on job
  const jobAssets = assignments.map(a => ({ ...a, asset: assets.find(as => as.id === a.asset_id) }));

  // Recent activity (last 5 logs)
  const recentLogs = [...invLogs].sort((a, b) => (b.created_date || '').localeCompare(a.created_date || '')).slice(0, 5);

  const client = clients.find(c => c.id === job?.client_id);
  const contractor = contractors.find(c => c.id === job?.contractor_id);

  const handleDownloadReport = async () => {
    setGeneratingReport(true);
    try {
      const res = await base44.functions.invoke('generateJobReport', { jobId: job.id });
      const win = window.open('', '_blank');
      win.document.write(res.data.html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    } catch (err) {
      console.error('Report error:', err);
    }
    setGeneratingReport(false);
  };

  return (
    <AnimatePresence>
      {job && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50"
          />
          <motion.div
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:bottom-0 w-full sm:w-[480px] md:w-[540px] bg-slate-50 z-50 shadow-2xl overflow-y-auto h-[100dvh] sm:h-auto"
          >
            {/* Header */}
            <div className="mesh-bg relative px-4 py-4 sm:px-6 sm:py-5">
              <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-start gap-3 pr-10">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                  <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-white tracking-tight truncate">{job.name}</h2>
                  {job.status && (
                    <span className={`inline-block mt-1 text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${statusColors[job.status] || 'bg-white/20 text-white'}`}>
                      {titleCase(job.status.replace(/_/g, ' '))}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-emerald-50 text-xs">
                {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
                {job.start_date && job.end_date && (
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(new Date(job.start_date), 'dd MMM')} – {format(new Date(job.end_date), 'dd MMM yyyy')}</span>
                )}
                {job.project_manager && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{job.project_manager}</span>}
              </div>
            </div>

            {/* Key Details strip */}
            {(client || contractor || job?.job_reference || job?.project_manager) && (
              <div className="px-3.5 sm:px-5 pt-3 sm:pt-4">
                <div className="flex flex-wrap gap-1.5">
                  {client && (
                    <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-xs">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">{(client.name || '?').charAt(0)}</span>
                      <span className="font-medium text-slate-700 max-w-[140px] truncate">{client.name}</span>
                    </span>
                  )}
                  {contractor && (
                    <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full pl-1.5 pr-3 py-1 text-xs">
                      <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-[10px]">{(contractor.name || '?').charAt(0)}</span>
                      <span className="font-medium text-slate-700 max-w-[140px] truncate">{contractor.name}</span>
                    </span>
                  )}
                  {job?.job_reference && (
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 rounded-full px-2.5 py-1 text-xs font-medium">
                      <span className="text-slate-400">Ref</span> {job.job_reference}
                    </span>
                  )}
                  {job?.project_manager && (
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 text-xs font-medium">
                      <Users className="w-3 h-3" /> {job.project_manager}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="p-3.5 sm:p-5 space-y-4 sm:space-y-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <StatCard icon={PoundSterling} value={fmtGBP(clientPrice)} label="Client Price" sub={`incl. VAT (${vatRate}%)`} gradient="stat-gradient-emerald" />
                <StatCard icon={Wrench} value={fmtGBP(totalCost)} label="Internal Cost" sub={`Equip ${fmtGBP(equipCost)}`} gradient="stat-gradient-amber" />
                <StatCard icon={profit >= 0 ? TrendingUp : Activity} value={fmtGBP(profit)} label="Gross Profit" sub={`Markup ${markupPct}%`} gradient={profit >= 0 ? 'stat-gradient-blue' : 'stat-gradient-rose'} />
                <StatCard icon={TrendingUp} value={`${margin.toFixed(0)}%`} label="Margin" sub={margin >= 20 ? 'Healthy' : margin >= 10 ? 'Moderate' : 'Low'} gradient={margin >= 20 ? 'stat-gradient-emerald' : margin >= 10 ? 'stat-gradient-amber' : 'stat-gradient-rose'} />
              </div>

              {/* Meterage (drilling jobs) */}
              {totalMeters > 0 && (
                <div className="hub-glass rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">Drilling Progress</h3>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{totalMeters.toFixed(1)}m</span>
                    <span className="text-xs text-slate-500">drilled</span>
                    {job.meterage_target > 0 && (
                      <span className="text-xs text-slate-400 ml-auto">of {job.meterage_target}m target</span>
                    )}
                  </div>
                  {job.meterage_target > 0 && (
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all" style={{ width: `${Math.min(100, (totalMeters / job.meterage_target) * 100)}%` }} />
                    </div>
                  )}
                </div>
              )}

              {/* Rigs & Equipment */}
              {jobAssets.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <HardHat className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Rigs & Equipment</h3>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{jobAssets.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {jobAssets.map(a => {
                      const AIcon = assetTypeIcon[a.asset_type] || Wrench;
                      const comp = a.asset ? complianceMeta[a.asset.compliance_status] || complianceMeta.unknown : complianceMeta.unknown;
                      const CompIcon = comp.icon;
                      return (
                        <div key={a.id} className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 px-3 py-2.5">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${a.asset_type === 'rig' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
                            <AIcon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-800 truncate">{a.asset_name}</p>
                            <p className="text-[10px] text-slate-400">{titleCase((a.role || '').replace(/_/g, ' '))} · {titleCase((a.status || '').replace(/_/g, ' '))}</p>
                          </div>
                          <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${comp.cls}`}>
                            <CompIcon className="w-2.5 h-2.5" />{comp.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Crew on site today */}
              {crewToday.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Crew On Site Today</h3>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{crewToday.length}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {crewToday.map(m => (
                      <div key={m.id} className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 px-3 py-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-bold text-xs">{m.name?.charAt(0) || '?'}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 truncate flex-1">{m.name}</p>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent activity */}
              {recentLogs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Recent Activity</h3>
                  </div>
                  <div className="space-y-1.5">
                    {recentLogs.map(l => (
                      <div key={l.id} className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-200 px-3 py-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-slate-700 truncate">{titleCase((l.log_type || '').replace(/_/g, ' '))}{l.borehole_ref ? ` · ${l.borehole_ref}` : ''}</p>
                          <p className="text-[10px] text-slate-400">{l.date ? format(new Date(l.date), 'dd MMM') : '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button onClick={() => { onOpenFullDetails(job); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-700 to-teal-700 text-white rounded-xl font-semibold text-sm hover:from-emerald-800 hover:to-teal-800 transition shadow-sm">
                  <ArrowRight className="w-4 h-4" /> Open Full Job Details
                </button>
                <button onClick={handleDownloadReport} disabled={generatingReport}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-50 transition border border-slate-200 disabled:opacity-50">
                  {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileBarChart className="w-4 h-4" />}
                  {generatingReport ? 'Generating report…' : 'Download Full Report'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}