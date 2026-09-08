import React from 'react';
import { MapPin, Calendar, CalendarClock, Users, Clock, Ruler, PoundSterling, Layers } from 'lucide-react';
import { format } from 'date-fns';
import What3WordsPill from '@/components/jobs/What3WordsPill';
import JobWeatherChip from '@/components/jobs/JobWeatherChip';

/**
 * JobDetailHero — modern gradient hero header for the Job Detail page.
 * Displays job status, type, location, dates, and key metrics in a
 * visually rich, colour-coded banner with progress indicators.
 */
export default function JobDetailHero({
  job, colors, statusBadge, statusLabels, getJobTypeLabel, primaryType, jobTypes,
  startDate, endDate, assignedStaff, rotas, isDrillingJob, totalMeterage,
  canSeeCosts, onStatusClick,
}) {
  const dayCount = startDate && endDate
    ? Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1)
    : 0;

  // Progress bar for target metres (drilling jobs)
  const targetMetres = Number(job.meterage_target) || 0;
  const drilledMetres = totalMeterage || 0;
  const targetPct = targetMetres > 0 ? Math.min(100, Math.round((drilledMetres / targetMetres) * 100)) : 0;

  // Budget progress
  const budget = Number(job.budget_amount) || 0;
  const actualCost = Number(job.actual_cost) || 0;
  const budgetPct = budget > 0 && actualCost > 0 ? Math.min(100, Math.round((actualCost / budget) * 100)) : 0;

  return (
    <div className="rounded-2xl overflow-hidden mb-3 sm:mb-4 shadow-lg border border-slate-200">
      {/* Gradient header band */}
      <div className="hero-gradient text-white px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Status + type badges */}
            <div className="flex items-center gap-2 mb-2.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-ui-caption font-bold bg-white/15 backdrop-blur-sm border border-white/20`}>
                <span className="w-2 h-2 rounded-full bg-[#8DC63F] animate-pulse" />
                {getJobTypeLabel(primaryType, jobTypes)}
              </span>
              <button onClick={onStatusClick}
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-ui-caption font-bold ${statusBadge[job.status || 'planning']} hover:opacity-80 transition cursor-pointer`}>
                {statusLabels[job.status || 'planning']}
              </button>
              {job.job_reference && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-ui-micro font-medium bg-white/10 backdrop-blur-sm border border-white/15">
                  Ref: {job.job_reference}
                </span>
              )}
            </div>
            {/* Job name */}
            <h1 className="text-xl md:text-3xl font-extrabold tracking-tight leading-tight text-white drop-shadow-sm">
              {job.name}
            </h1>
            {/* Location */}
            <div className="flex items-center gap-2 mt-2 text-white/80 text-ui-body flex-wrap">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{job.location}</span>
              {job.what3words && (
                <span className="inline-flex items-center rounded-full font-mono font-semibold bg-white/15 text-white border border-white/20 text-ui-micro px-2.5 py-1 gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <MapPin className="w-3 h-3" />
                  <a href={`https://what3words.com/${String(job.what3words).trim().toLowerCase()}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{job.what3words}</a>
                </span>
              )}
            </div>
          </div>
          {/* Date + duration chip + weather chip */}
          <div className="flex flex-col gap-2 md:items-end flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap md:justify-end">
              {startDate && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/15">
                  <Calendar className="w-4 h-4 text-white/70" />
                  <span className="text-ui-caption font-medium text-white/90">
                    {format(startDate, 'dd MMM')} → {endDate ? format(endDate, 'dd MMM') : 'TBC'}
                  </span>
                </div>
              )}
              <JobWeatherChip job={job} isDrillingJob={isDrillingJob} />
            </div>
            {dayCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/15">
                <CalendarClock className="w-4 h-4 text-[#8DC63F]" />
                <span className="font-bold text-white text-ui-body">{dayCount}</span>
                <span className="text-white/60 text-ui-caption">{dayCount === 1 ? 'day' : 'days'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Metric strip — modern glass cards */}
      <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-white border-t border-slate-100">
        <div className="flex items-center gap-3 md:gap-5 flex-wrap">
          <MetricChip icon={Users} value={assignedStaff.length} label={assignedStaff.length === 1 ? 'crew' : 'crew'} color="text-[#2E5A1A]" bg="bg-[#2E5A1A]/8" />
          <Divider />
          <MetricChip icon={Clock} value={rotas.length} label={rotas.length === 1 ? 'shift' : 'shifts'} color="text-blue-600" bg="bg-blue-50" />
          {isDrillingJob && totalMeterage > 0 && (
            <>
              <Divider />
              <MetricChip icon={Ruler} value={`${totalMeterage.toFixed(1)}m`} label="drilled" color="text-amber-600" bg="bg-amber-50" />
            </>
          )}
          {canSeeCosts && budget > 0 && (
            <>
              <Divider />
              <MetricChip icon={PoundSterling} value={`£${budget.toLocaleString()}`} label="budget" color="text-violet-600" bg="bg-violet-50" />
            </>
          )}
        </div>

        {/* Progress bars */}
        {((isDrillingJob && targetMetres > 0) || (canSeeCosts && budget > 0 && actualCost > 0)) && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isDrillingJob && targetMetres > 0 && (
              <ProgressBar
                label="Drilling Progress"
                value={drilledMetres.toFixed(1)}
                total={`${targetMetres}m`}
                pct={targetPct}
                gradient="from-[#2E5A1A] to-[#8DC63F]"
              />
            )}
            {canSeeCosts && budget > 0 && actualCost > 0 && (
              <ProgressBar
                label="Budget Used"
                value={`£${actualCost.toLocaleString()}`}
                total={`£${budget.toLocaleString()}`}
                pct={budgetPct}
                gradient={budgetPct > 90 ? 'from-red-500 to-rose-600' : 'from-blue-500 to-indigo-600'}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricChip({ icon: Icon, value, label, color, bg }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-bold text-slate-900 text-ui-body tabular-nums">{value}</span>
        <span className="text-slate-400 text-ui-micro">{label}</span>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-5 w-px bg-slate-200" />;
}

function ProgressBar({ label, value, total, pct, gradient }) {
  return (
    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
      <div className="flex items-center justify-between text-ui-micro mb-1.5">
        <span className="text-slate-500 font-semibold">{label}</span>
        <span className="text-slate-600 font-bold tabular-nums">{value} / {total}</span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full bg-gradient-to-r ${gradient} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-ui-caption text-slate-400 mt-1 text-right font-medium">{pct}%</p>
    </div>
  );
}