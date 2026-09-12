import React, { useMemo } from 'react';
import { ShieldCheck, AlertTriangle, Database, Activity, CheckCircle2, XCircle, FileCheck, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { format, formatDistanceToNow } from 'date-fns';

/**
 * System Health & Integrity Widget — the "Mission Control" audit view.
 * Shows audit-chain integrity, entity counts, compliance health, and recent
 * system activity so managers can see at a glance whether the platform is
 * solid and flawless.
 */
export default function SystemHealthWidget({ onNavigate }) {
  const { data: auditLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['system-audit-logs-recent'],
    queryFn: () => base44.entities.SystemAuditLog.list('-created_date', 20)
  });

  const { data: jobs = [] } = useQuery({ queryKey: ['jobs-health'], queryFn: () => base44.entities.Job.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff-health'], queryFn: () => base44.entities.Staff.list() });
  const { data: assets = [] } = useQuery({ queryKey: ['assets-health'], queryFn: () => base44.entities.SiteAsset.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles-health'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: complianceItems = [] } = useQuery({ queryKey: ['compliance-health'], queryFn: () => base44.entities.ComplianceItem.list() });

  const stats = useMemo(() => {
    const brokenChain = auditLogs.filter(l => l.integrity_status === 'broken_chain').length;
    const hashMismatch = auditLogs.filter(l => l.integrity_status === 'hash_mismatch').length;
    const validChain = auditLogs.filter(l => l.integrity_status === 'valid').length;
    const chainIntegrity = auditLogs.length > 0 ? Math.round((validChain / auditLogs.length) * 100) : 100;

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

    const expiredCompliance = complianceItems.filter(c => {
      if (!c.expiry_date) return false;
      return new Date(c.expiry_date) < now;
    }).length;
    const expiringCompliance = complianceItems.filter(c => {
      if (!c.expiry_date) return false;
      const d = new Date(c.expiry_date);
      return d >= now && d < in30Days;
    }).length;

    const activeJobs = jobs.filter(j => j.status === 'in_progress').length;
    const activeStaff = staff.filter(s => s.is_active !== false).length;
    const compliantAssets = assets.filter(a => a.compliance_status === 'compliant').length;
    const assetCompliancePct = assets.length > 0 ? Math.round((compliantAssets / assets.length) * 100) : 100;

    return {
      brokenChain, hashMismatch, chainIntegrity,
      expiredCompliance, expiringCompliance,
      activeJobs, activeStaff, assetCompliancePct,
      totalJobs: jobs.length, totalAssets: assets.length, totalVehicles: vehicles.length
    };
  }, [auditLogs, jobs, staff, assets, vehicles, complianceItems]);

  const integrityOk = stats.brokenChain === 0 && stats.hashMismatch === 0;
  const complianceOk = stats.expiredCompliance === 0;

  const entityRows = [
    { label: 'Jobs', value: stats.totalJobs, sub: `${stats.activeJobs} active`, tone: 'emerald' },
    { label: 'Staff', value: stats.activeStaff, sub: 'active', tone: 'blue' },
    { label: 'Assets', value: stats.totalAssets, sub: `${stats.assetCompliancePct}% compliant`, tone: stats.assetCompliancePct >= 90 ? 'emerald' : 'amber' },
    { label: 'Vehicles', value: stats.totalVehicles, sub: 'fleet', tone: 'slate' },
  ];

  const toneClasses = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <WidgetShell
      icon={ShieldCheck}
      title="System Health & Integrity"
      subtitle="Audit chain, compliance status, and data integrity"
      action={
        <button
          onClick={() => onNavigate?.('compliance')}
          className="text-xs font-semibold text-primary hover:text-primary/90 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition"
        >
          View Audit Trail →
        </button>
      }
    >
      {/* Integrity Status Banner */}
      <div className={`rounded-xl border p-3 mb-4 flex items-center gap-3 ${integrityOk ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
        {integrityOk ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {integrityOk ? 'Audit Chain Intact' : 'Chain Integrity Alert'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {integrityOk
              ? `${stats.chainIntegrity}% integrity · ${auditLogs.length} entries verified`
              : `${stats.brokenChain} broken links, ${stats.hashMismatch} hash mismatches detected`}
          </p>
        </div>
        <div className="ml-auto text-right flex-shrink-0">
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.chainIntegrity}%</p>
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Integrity</p>
        </div>
      </div>

      {/* Entity Count Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {entityRows.map((row, i) => (
          <div key={i} className={`rounded-xl border p-3 ${toneClasses[row.tone]}`}>
            <p className="text-2xl font-bold tabular-nums leading-none">{row.value}</p>
            <p className="text-xs font-semibold mt-1">{row.label}</p>
            <p className="text-[10px] opacity-70 mt-0.5">{row.sub}</p>
          </div>
        ))}
      </div>

      {/* Compliance Health */}
      <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
        <div className="flex items-center gap-2.5">
          <FileCheck className={`w-5 h-5 ${complianceOk ? 'text-emerald-600' : 'text-amber-600'}`} />
          <div>
            <p className="text-sm font-semibold text-slate-900">Compliance Health</p>
            <p className="text-xs text-slate-500">
              {stats.expiredCompliance > 0
                ? `${stats.expiredCompliance} expired, ${stats.expiringCompliance} expiring soon`
                : `${stats.expiringCompliance} expiring soon · no expired items`}
            </p>
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${complianceOk ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {complianceOk ? 'OK' : 'ACTION'}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-slate-400" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recent Activity</p>
        </div>
        {logsLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-8 rounded-lg bg-slate-100 animate-pulse" />)}
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-center justify-center">
            <Lock className="w-4 h-4 text-slate-300" />
            <p className="text-xs text-slate-400">No audit entries yet</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {auditLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-slate-50 transition">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  log.action === 'create' ? 'bg-emerald-400' :
                  log.action === 'update' ? 'bg-blue-400' : 'bg-rose-400'
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 truncate">
                    <span className="font-semibold">{log.entity_name}</span>
                    {log.record_summary ? ` · ${log.record_summary}` : ''}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {log.actor_name || 'system'} · {log.action}
                    {log.created_date && ` · ${formatDistanceToNow(new Date(log.created_date), { addSuffix: true })}`}
                  </p>
                </div>
                {log.integrity_status !== 'valid' && log.integrity_status && (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}