import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  AlertTriangle, Activity, TrendingDown, FileWarning,
  ShieldAlert, ExternalLink,
} from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';
import HubLoadingState from '@/components/hubs/HubLoadingState';
import HubEmptyState from '@/components/hubs/HubEmptyState';

const TYPE_LABELS = { near_miss: 'Near Miss', incident: 'Incident', accident: 'Accident', dangerous_occurrence: 'Dangerous Occurrence', environmental: 'Environmental' };
const SEVERITY_COLORS = { low: 'from-sky-400 to-sky-600', medium: 'from-amber-400 to-amber-600', high: 'from-orange-400 to-orange-600', critical: 'from-rose-500 to-rose-700' };

export default function RIDDORStatsPanel() {
  const [period, setPeriod] = useState('30');

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['safety-reports-riddor'],
    queryFn: () => base44.entities.SafetyReport.list('-created_date', 500),
  });

  const filtered = useMemo(() => {
    const days = parseInt(period);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return reports.filter(r => {
      const d = r.conducted_at || r.created_date;
      return d && new Date(d) >= cutoff;
    });
  }, [reports, period]);

  const incidents = filtered.filter(r => r.report_type === 'incident');
  const audits = filtered.filter(r => r.report_type === 'safetyculture_audit');

  const stats = useMemo(() => {
    const riddorReportable = incidents.filter(r => r.riddor_reportable).length;
    const riddorSubmitted = incidents.filter(r => r.riddor_submitted_at).length;
    const byType = {
      near_miss: incidents.filter(r => r.incident_type === 'near_miss').length,
      incident: incidents.filter(r => r.incident_type === 'incident').length,
      accident: incidents.filter(r => r.incident_type === 'accident').length,
      dangerous_occurrence: incidents.filter(r => r.incident_type === 'dangerous_occurrence').length,
      environmental: incidents.filter(r => r.incident_type === 'environmental').length,
    };
    const bySeverity = {
      low: incidents.filter(r => r.severity === 'low').length,
      medium: incidents.filter(r => r.severity === 'medium').length,
      high: incidents.filter(r => r.severity === 'high').length,
      critical: incidents.filter(r => r.severity === 'critical').length,
    };
    const openActions = incidents.filter(r => r.status === 'open').length;
    const failedAudits = audits.filter(r => r.pass_fail === 'fail').length;
    return { riddorReportable, riddorSubmitted, byType, bySeverity, openActions, failedAudits };
  }, [incidents, audits]);

  if (isLoading) return <HubLoadingState variant="stats" count={4} />;

  if (reports.length === 0) {
    return (
      <HubEmptyState
        icon={ShieldAlert}
        title="No Safety Data Available"
        description="Health & Safety statistics are pulled from SafetyCulture audits and incident reports. Once the integration is configured, RIDDOR counts, incident breakdowns and audit performance will appear here."
      />
    );
  }

  const pendingRiddor = stats.riddorReportable - stats.riddorSubmitted;

  const statTiles = [
    { icon: ShieldAlert, label: 'RIDDOR Reportable', value: stats.riddorReportable, gradient: 'stat-gradient-rose' },
    { icon: FileWarning, label: 'Submitted to HSE', value: stats.riddorSubmitted, gradient: 'stat-gradient-emerald' },
    { icon: AlertTriangle, label: 'Pending Submission', value: pendingRiddor, gradient: pendingRiddor > 0 ? 'stat-gradient-amber' : 'stat-gradient-slate' },
    { icon: Activity, label: 'Total Incidents', value: incidents.length, gradient: 'stat-gradient-slate' },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Period:</span>
        {['30', '90', '365'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`text-xs font-medium px-2.5 py-1 rounded-full transition ${period === p ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {p === '365' ? '12 months' : `${p} days`}
          </button>
        ))}
      </div>

      {/* RIDDOR headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {statTiles.map(tile => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className="hub-glass rounded-2xl p-3 animate-slide-up">
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-7 h-7 rounded-lg ${tile.gradient} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </span>
                <p className="text-[10px] font-bold text-slate-500 uppercase leading-tight">{tile.label}</p>
              </div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{tile.value}</p>
            </div>
          );
        })}
      </div>

      {/* Incident type breakdown */}
      <HubCard icon={Activity} title="Incidents by Type" subtitle="Distribution across incident categories" tone="rose">
        <div className="space-y-2">
          {Object.entries(TYPE_LABELS).map(([key, label]) => {
            const count = stats.byType[key] || 0;
            const pct = incidents.length > 0 ? (count / incidents.length) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <p className="text-xs font-medium text-slate-600 w-36 flex-shrink-0">{label}</p>
                <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 rounded-full flex items-center justify-end pr-2 text-[10px] text-white font-bold transition-all" style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}>
                    {count > 0 && count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </HubCard>

      {/* Severity breakdown */}
      <HubCard icon={AlertTriangle} title="By Severity" subtitle="Incident severity distribution" tone="amber">
        <div className="grid grid-cols-4 gap-2.5">
          {['low', 'medium', 'high', 'critical'].map(sev => {
            const count = stats.bySeverity[sev] || 0;
            return (
              <div key={sev} className="text-center">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${SEVERITY_COLORS[sev]} mx-auto mb-1.5 flex items-center justify-center text-white text-lg font-bold shadow-sm`}>
                  {count}
                </div>
                <p className="text-[10px] font-medium text-slate-500 capitalize">{sev}</p>
              </div>
            );
          })}
        </div>
      </HubCard>

      {/* RIDDOR pending submission alert */}
      {pendingRiddor > 0 && (
        <div className="hub-glass rounded-2xl p-4 border-l-4 border-l-amber-400">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <FileWarning className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900">{pendingRiddor} RIDDOR reportable incident{pendingRiddor !== 1 ? 's' : ''} pending submission</p>
              <p className="text-xs text-slate-500 mt-0.5">These incidents are flagged as RIDDOR-reportable but have not yet been submitted to the HSE.</p>
              <a
                href="https://www.hse.gov.uk/forms/incident/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Submit to HSE
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Audit stats */}
      {audits.length > 0 && (
        <HubCard icon={TrendingDown} title="SafetyCulture Audits" subtitle={`${audits.length} total · ${stats.failedAudits} failed`} tone="slate">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">Audit performance in this period</p>
            <a href="https://app.safetyculture.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
              Open <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </HubCard>
      )}

      {incidents.length === 0 && audits.length === 0 && (
        <HubEmptyState icon={ShieldAlert} title="No safety reports in this period" description="Try selecting a wider date range." compact />
      )}
    </div>
  );
}