import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell,
} from 'recharts';
import {
  ShieldCheck, Users, TrendingUp, CheckCircle2, XCircle,
  Download, FileText, Calendar, Building2,
} from 'lucide-react';
import { downloadStructuredCsv } from '@/utils/csvExport';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/StateViews';

const CHECK_LABELS = {
  vehicle_check: 'Vehicle',
  powra: 'POWRA',
  equipment: 'Equipment',
  general: 'General',
};

const REPORT_TYPES = [
  { id: 'completion', label: 'Daily Completion Rate', icon: TrendingUp },
  { id: 'outstanding', label: 'Outstanding by Person', icon: Users },
  { id: 'comparison', label: 'Division Comparison', icon: Building2 },
];

export default function ComplianceChecksReport({ filters }) {
  const [reportType, setReportType] = useState('completion');
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      {/* Report type selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {REPORT_TYPES.map(rt => {
          const Icon = rt.icon;
          const active = reportType === rt.id;
          return (
            <button
              key={rt.id}
              onClick={() => setReportType(rt.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition ${
                active ? 'command-gradient text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {rt.label}
            </button>
          );
        })}
      </div>

      {reportType === 'completion' && <CompletionRateReport filters={filters} toast={toast} />}
      {reportType === 'outstanding' && <OutstandingByPersonReport filters={filters} toast={toast} />}
      {reportType === 'comparison' && <DivisionComparisonReport filters={filters} toast={toast} />}
    </div>
  );
}

// ── Daily Completion Rate ──
function CompletionRateReport({ filters, toast }) {
  const { activeDivisionId } = useDivision();
  const dateFrom = filters.dateFrom;
  const dateTo = filters.dateTo;

  const { data: checkConfigs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['all-division-check-configs'],
    queryFn: () => base44.entities.DivisionCheckConfig.list('-created_date', 50),
  });

  const divisionId = filters.divisionId || activeDivisionId;

  const { data: config } = useQuery({
    queryKey: ['division-check-config', divisionId],
    queryFn: async () => {
      if (!divisionId) return null;
      const list = await base44.entities.DivisionCheckConfig.filter({ division_id: divisionId });
      return list[0] || null;
    },
    enabled: !!divisionId,
  });

  const enabledCategories = useMemo(() => {
    if (!config?.check_configs) return [];
    return config.check_configs.filter(c => c.enabled);
  }, [config]);

  // Fetch assignments for the date range
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['completion-assignments', dateFrom, dateTo, divisionId],
    queryFn: async () => {
      let list = await base44.entities.RotaAssignment.list('-assigned_date', 500);
      list = list.filter(a => (!a.assignment_type || a.assignment_type === 'job'));
      if (divisionId) list = list.filter(a => !a.division_id || a.division_id === divisionId);
      if (dateFrom) list = list.filter(a => a.assigned_date >= dateFrom);
      if (dateTo) list = list.filter(a => a.assigned_date <= dateTo);
      return list;
    },
  });

  const chartData = useMemo(() => {
    if (!dateFrom || !dateTo) return [];
    const days = eachDayOfInterval({ start: parseISO(dateFrom), end: parseISO(dateTo) });

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayAssignments = assignments.filter(a => a.assigned_date === dateStr);
      const total = dayAssignments.length;
      const entry = { date: format(day, 'dd MMM'), total };

      enabledCategories.forEach(cat => {
        const done = dayAssignments.filter(a => {
          if (cat.category === 'vehicle_check') return !!a.mitti_vehicle_check_at;
          if (cat.category === 'powra') return !!a.mitti_powra_at;
          if (cat.category === 'equipment') return !!a.mitti_equipment_check_at;
          return false;
        }).length;
        entry[CHECK_LABELS[cat.category] || cat.category] = total > 0 ? Math.round((done / total) * 100) : 0;
      });

      return entry;
    });
  }, [assignments, dateFrom, dateTo, enabledCategories]);

  const handleExport = () => {
    const columns = [
      { key: 'date', label: 'Date' },
      { key: 'total', label: 'Crew on Rota' },
      ...enabledCategories.map(c => ({ key: CHECK_LABELS[c.category] || c.category, label: `${CHECK_LABELS[c.category] || c.category} %` })),
    ];
    downloadStructuredCsv('compliance-completion-rate.csv', columns, chartData);
    toast({ title: 'Exported', description: `${chartData.length} days exported to CSV.` });
  };

  if (isLoading || configsLoading) {
    return (
      <div className="insight-card rounded-2xl p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (enabledCategories.length === 0) {
    return <NoConfigState />;
  }

  return (
    <div className="insight-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Daily Check Completion Rate</h3>
          <p className="text-xs text-slate-500 mt-0.5">% of crew who completed each check type per day</p>
        </div>
        <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" unit="%" />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }}
            formatter={(v) => [`${v}%`, '']}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {enabledCategories.map((cat, i) => (
            <Line
              key={cat.category}
              type="monotone"
              dataKey={CHECK_LABELS[cat.category] || cat.category}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Outstanding by Person ──
function OutstandingByPersonReport({ filters, toast }) {
  const { activeDivisionId, divisions } = useDivision();
  const divisionId = filters.divisionId || activeDivisionId;

  const { data: config } = useQuery({
    queryKey: ['division-check-config', divisionId],
    queryFn: async () => {
      if (!divisionId) return null;
      const list = await base44.entities.DivisionCheckConfig.filter({ division_id: divisionId });
      return list[0] || null;
    },
    enabled: !!divisionId,
  });

  const enabledCategories = useMemo(() => {
    if (!config?.check_configs) return [];
    return config.check_configs.filter(c => c.enabled);
  }, [config]);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['outstanding-assignments', filters.dateFrom, filters.dateTo, divisionId],
    queryFn: async () => {
      let list = await base44.entities.RotaAssignment.list('-assigned_date', 500);
      list = list.filter(a => (!a.assignment_type || a.assignment_type === 'job'));
      if (divisionId) list = list.filter(a => !a.division_id || a.division_id === divisionId);
      if (filters.dateFrom) list = list.filter(a => a.assigned_date >= filters.dateFrom);
      if (filters.dateTo) list = list.filter(a => a.assigned_date <= filters.dateTo);
      return list;
    },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-outstanding-report'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }, 'name', 500),
  });

  const rows = useMemo(() => {
    const byStaff = {};
    assignments.forEach(a => {
      const member = staff.find(s => s.id === a.staff_id);
      const name = member?.name || 'Unknown';
      if (!byStaff[a.staff_id]) {
        byStaff[a.staff_id] = { staffId: a.staff_id, staffName: name, totalShifts: 0, checks: {} };
        enabledCategories.forEach(c => { byStaff[a.staff_id].checks[c.category] = { done: 0, total: 0 }; });
      }
      byStaff[a.staff_id].totalShifts++;
      enabledCategories.forEach(cat => {
        byStaff[a.staff_id].checks[cat.category].total++;
        let done = false;
        if (cat.category === 'vehicle_check') done = !!a.mitti_vehicle_check_at;
        else if (cat.category === 'powra') done = !!a.mitti_powra_at;
        else if (cat.category === 'equipment') done = !!a.mitti_equipment_check_at;
        if (done) byStaff[a.staff_id].checks[cat.category].done++;
      });
    });

    return Object.values(byStaff).sort((a, b) => a.staffName.localeCompare(b.staffName));
  }, [assignments, staff, enabledCategories]);

  const handleExport = () => {
    const columns = [
      { key: 'staffName', label: 'Staff Member' },
      { key: 'totalShifts', label: 'Total Shifts' },
      ...enabledCategories.map(c => ({
        key: `${CHECK_LABELS[c.category]}_done`,
        label: `${CHECK_LABELS[c.category]} Done`,
      })),
      ...enabledCategories.map(c => ({
        key: `${CHECK_LABELS[c.category]}_total`,
        label: `${CHECK_LABELS[c.category]} Total`,
      })),
    ];
    const exportRows = rows.map(r => {
      const out = { staffName: r.staffName, totalShifts: r.totalShifts };
      enabledCategories.forEach(c => {
        out[`${CHECK_LABELS[c.category]}_done`] = r.checks[c.category]?.done || 0;
        out[`${CHECK_LABELS[c.category]}_total`] = r.checks[c.category]?.total || 0;
      });
      return out;
    });
    downloadStructuredCsv('compliance-outstanding-by-person.csv', columns, exportRows);
    toast({ title: 'Exported', description: `${exportRows.length} staff records exported to CSV.` });
  };

  if (isLoading) {
    return <div className="insight-card rounded-2xl p-6"><Skeleton className="h-64 w-full" /></div>;
  }

  if (enabledCategories.length === 0) return <NoConfigState />;

  return (
    <div className="insight-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Outstanding Checks by Person</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {filters.dateFrom || 'All time'} → {filters.dateTo || 'Today'} · {rows.length} staff
          </p>
        </div>
        <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-2.5 text-left text-xs font-bold text-slate-600">Staff Member</th>
              <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-600">Shifts</th>
              {enabledCategories.map(cat => (
                <th key={cat.category} className="px-4 py-2.5 text-center text-xs font-bold text-slate-600">
                  {cat.label || CHECK_LABELS[cat.category]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.staffId} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.staffName}</td>
                <td className="px-4 py-2.5 text-center text-slate-600 tabular-nums">{r.totalShifts}</td>
                {enabledCategories.map(cat => {
                  const c = r.checks[cat.category];
                  const rate = c && c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
                  return (
                    <td key={cat.category} className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold ${
                        rate === 100 ? 'bg-emerald-50 text-emerald-600' :
                        rate > 0 ? 'bg-amber-50 text-amber-600' :
                        'bg-rose-50 text-rose-600'
                      }`}>
                        {rate === 100 ? <CheckCircle2 className="w-3 h-3" /> : rate === 0 ? <XCircle className="w-3 h-3" /> : null}
                        {c?.done || 0}/{c?.total || 0}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={enabledCategories.length + 2} className="px-4 py-8 text-center text-sm text-slate-400">No data for this date range</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Division Comparison ──
function DivisionComparisonReport({ filters, toast }) {
  const { divisions } = useDivision();

  const { data: allConfigs = [] } = useQuery({
    queryKey: ['all-division-check-configs-comparison'],
    queryFn: () => base44.entities.DivisionCheckConfig.list('-created_date', 50),
  });

  const { data: allAssignments = [], isLoading } = useQuery({
    queryKey: ['comparison-assignments', filters.dateFrom, filters.dateTo],
    queryFn: async () => {
      let list = await base44.entities.RotaAssignment.list('-assigned_date', 500);
      list = list.filter(a => (!a.assignment_type || a.assignment_type === 'job'));
      if (filters.dateFrom) list = list.filter(a => a.assigned_date >= filters.dateFrom);
      if (filters.dateTo) list = list.filter(a => a.assigned_date <= filters.dateTo);
      return list;
    },
  });

  const chartData = useMemo(() => {
    return divisions.filter(d => d.is_active !== false).map(div => {
      const config = allConfigs.find(c => c.division_id === div.id);
      const enabledCats = (config?.check_configs || []).filter(c => c.enabled);
      const divAssignments = allAssignments.filter(a => !a.division_id || a.division_id === div.id);
      const total = divAssignments.length;

      const entry = { name: div.name, total };

      // Calculate overall completion across all enabled categories
      let totalChecks = 0;
      let doneChecks = 0;
      enabledCats.forEach(cat => {
        divAssignments.forEach(a => {
          totalChecks++;
          if (cat.category === 'vehicle_check' && a.mitti_vehicle_check_at) doneChecks++;
          else if (cat.category === 'powra' && a.mitti_powra_at) doneChecks++;
          else if (cat.category === 'equipment' && a.mitti_equipment_check_at) doneChecks++;
        });
      });

      entry.completion = totalChecks > 0 ? Math.round((doneChecks / totalChecks) * 100) : 0;
      entry.configured = enabledCats.length > 0;
      return entry;
    });
  }, [divisions, allConfigs, allAssignments]);

  const handleExport = () => {
    const columns = [
      { key: 'name', label: 'Division' },
      { key: 'total', label: 'Total Shifts' },
      { key: 'completion', label: 'Completion %' },
      { key: 'configured', label: 'Has Check Config' },
    ];
    downloadStructuredCsv('compliance-division-comparison.csv', columns, chartData);
    toast({ title: 'Exported', description: `${chartData.length} divisions exported to CSV.` });
  };

  if (isLoading) {
    return <div className="insight-card rounded-2xl p-6"><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="insight-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Division Comparison</h3>
          <p className="text-xs text-slate-500 mt-0.5">Check completion rates across all configured divisions</p>
        </div>
        <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
          <Download className="w-3.5 h-3.5" /> CSV
        </button>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" unit="%" />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e2e8f0' }}
            formatter={(v, name) => [name === 'completion' ? `${v}%` : v, name]}
          />
          <Bar dataKey="completion" name="Completion %" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.configured ? (entry.completion >= 75 ? '#10b981' : entry.completion >= 40 ? '#f59e0b' : '#ef4444') : '#cbd5e1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Division list */}
      <div className="mt-4 space-y-2">
        {chartData.map(d => (
          <div key={d.name} className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg">
            <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-700 flex-1">{d.name}</span>
            {d.configured ? (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                d.completion >= 75 ? 'bg-emerald-50 text-emerald-600' :
                d.completion >= 40 ? 'bg-amber-50 text-amber-600' :
                'bg-rose-50 text-rose-600'
              }`}>
                {d.completion}%
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-400">Not configured</span>
            )}
            <span className="text-xs text-slate-400 tabular-nums">{d.total} shifts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── No config state ──
function NoConfigState() {
  return (
    <div className="insight-card rounded-2xl p-8">
      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
          <ShieldCheck className="w-6 h-6 text-amber-500" />
        </div>
        <h3 className="text-sm font-bold text-slate-900 mb-1">No check configuration found</h3>
        <p className="text-xs text-slate-500">
          Go to Settings → Compliance Check Config to set up which Mitti checks this division requires.
        </p>
      </div>
    </div>
  );
}

const LINE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];