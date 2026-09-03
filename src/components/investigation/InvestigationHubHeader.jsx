import React from 'react';
import { FlaskConical, Clock, CheckCircle2, AlertCircle, Mountain, Users, FileText, Loader2 } from 'lucide-react';

/**
 * InvestigationHubHeader — modern command-centre summary header for the
 * Investigation Hub. Shows pending review, approved, queried, jobs covered,
 * boreholes covered, and total records in a hero-gradient banner with
 * glass KPI tiles.
 */
export default function InvestigationHubHeader({ totalLogs, pendingCount, queriedCount, approvedCount, jobsCovered, boreholesCovered, inProgressCount, completedBoreholeCount }) {
  return (
    <div className="hero-gradient rounded-2xl p-5 text-white shadow-lg">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Investigation Hub</h2>
          <p className="text-xs text-white/70">Master board for every site log and borehole record</p>
        </div>
        <span className="ml-auto text-xs bg-white/20 px-2.5 py-1 rounded-full font-medium">{totalLogs} total records</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiTile icon={Loader2} label="In Progress" value={inProgressCount} tone="amber" />
        <KpiTile icon={CheckCircle2} label="Completed" value={completedBoreholeCount} tone="emerald" />
        <KpiTile icon={Mountain} label="Boreholes" value={boreholesCovered} tone="violet" />
        <KpiTile icon={Clock} label="Pending" value={pendingCount} tone="amber" />
        <KpiTile icon={CheckCircle2} label="Approved" value={approvedCount} tone="emerald" />
        <KpiTile icon={AlertCircle} label="Queried" value={queriedCount} tone="rose" />
        <KpiTile icon={FileText} label="Total Logs" value={totalLogs} tone="slate" />
        <KpiTile icon={Users} label="Jobs" value={jobsCovered} tone="blue" />
      </div>
    </div>
  );
}

const TONES = {
  amber: 'bg-amber-400/20 text-amber-100 border-amber-300/30',
  emerald: 'bg-emerald-400/20 text-emerald-100 border-emerald-300/30',
  rose: 'bg-rose-400/20 text-rose-100 border-rose-300/30',
  slate: 'bg-white/10 text-white border-white/20',
  blue: 'bg-blue-400/20 text-blue-100 border-blue-300/30',
  violet: 'bg-violet-400/20 text-violet-100 border-violet-300/30',
};

function KpiTile({ icon: Icon, label, value, tone }) {
  return (
    <div className={`rounded-xl px-3 py-3 border backdrop-blur-sm ${TONES[tone] || TONES.slate}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 opacity-80" />
        <p className="text-[10px] uppercase font-medium opacity-80 tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}