import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  AlertTriangle, Activity, TrendingDown, FileWarning, Loader2,
  ShieldAlert, Calendar, Users, ExternalLink,
} from 'lucide-react';

/**
 * RIDDORStatsPanel — Health & Safety statistics from SafetyReport records.
 * Shows RIDDOR-reportable counts, incident types, severity breakdown,
 * and near-miss trends for the selected period.
 */
export default function RIDDORStatsPanel() {
  const [period, setPeriod] = useState('30'); // 30, 90, 365 days

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
    const closedActions = incidents.filter(r => r.status === 'closed').length;
    const failedAudits = audits.filter(r => r.pass_fail === 'fail').length;
    return { riddorReportable, riddorSubmitted, byType, bySeverity, openActions, closedActions, failedAudits };
  }, [incidents, audits]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  // No data synced — show info message instead of zero-value stats
  if (reports.length === 0) {
    return (
      <div className="insight-card rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7 text-amber-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1.5">No Safety Data Available</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Health & Safety statistics are pulled from SafetyCulture audits and incident reports.
          Once the integration is configured, RIDDOR counts, incident breakdowns and audit performance will appear here.
        </p>
      </div>
    );
  }

  const TYPE_LABELS = { near_miss: 'Near Miss', incident: 'Incident', accident: 'Accident', dangerous_occurrence: 'Dangerous Occurrence', environmental: 'Environmental' };
  const SEVERITY_COLORS = { low: 'bg-sky-500', medium: 'bg-amber-500', high: 'bg-orange-500', critical: 'bg-rose-600' };

  return (
    <div className="space-y-4">
      {/* SafetyCulture link */}
      <div className="insight-card rounded-2xl p-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <ShieldAlert className="w-4 h-4 text-white" />
        </div>
        <p className="text-xs text-slate-500 flex-1 min-w-0">
          All stats are pulled from <strong className="text-slate-700">SafetyCulture</strong> audits & incident reports.
        </p>
        <a href="https://app.safetyculture.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#2E5A1A] hover:underline flex-shrink-0">
          Open <ExternalLink className="w-3 h-3" />
        </a>
      </div>

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            <p className="text-[10px] font-bold text-rose-600 uppercase">RIDDOR Reportable</p>
          </div>
          <p className="text-2xl font-bold text-rose-700 tabular-nums">{stats.riddorReportable}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <FileWarning className="w-3.5 h-3.5 text-emerald-600" />
            <p className="text-[10px] font-bold text-emerald-600 uppercase">Submitted to HSE</p>
          </div>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums">{stats.riddorSubmitted}</p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <p className="text-[10px] font-bold text-amber-600 uppercase">Open Actions</p>
          </div>
          <p className="text-2xl font-bold text-amber-700 tabular-nums">{stats.openActions}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-slate-600" />
            <p className="text-[10px] font-bold text-slate-600 uppercase">Total Incidents</p>
          </div>
          <p className="text-2xl font-bold text-slate-700 tabular-nums">{incidents.length}</p>
        </div>
      </div>

      {/* Incident type breakdown */}
      <div>
        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">By Type</h4>
        <div className="space-y-1.5">
          {Object.entries(TYPE_LABELS).map(([key, label]) => {
            const count = stats.byType[key] || 0;
            const pct = incidents.length > 0 ? (count / incidents.length) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <p className="text-xs font-medium text-slate-600 w-32 flex-shrink-0">{label}</p>
                <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 rounded-full flex items-center justify-end pr-2 text-[9px] text-white font-bold" style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}>
                    {count > 0 && count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Severity breakdown */}
      <div>
        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">By Severity</h4>
        <div className="flex gap-2">
          {['low', 'medium', 'high', 'critical'].map(sev => {
            const count = stats.bySeverity[sev] || 0;
            return (
              <div key={sev} className="flex-1 rounded-lg border border-slate-200 p-2 text-center">
                <div className={`w-8 h-8 rounded-full ${SEVERITY_COLORS[sev]} mx-auto mb-1 flex items-center justify-center text-white text-xs font-bold`}>
                  {count}
                </div>
                <p className="text-[10px] font-medium text-slate-500 capitalize">{sev}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit stats */}
      {audits.length > 0 && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-slate-500" />
              <p className="text-xs font-medium text-slate-600">SafetyCulture Audits</p>
            </div>
            <p className="text-sm font-bold text-slate-700 tabular-nums">{audits.length} total · {stats.failedAudits} failed</p>
          </div>
        </div>
      )}

      {incidents.length === 0 && audits.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ShieldAlert className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No safety reports in this period</p>
        </div>
      )}
    </div>
  );
}