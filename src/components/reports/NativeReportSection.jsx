import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Briefcase, Users, Car, Boxes, PoundSterling, ShieldCheck } from 'lucide-react';
import { downloadCsv } from '@/utils/csvExport';

const COLORS = ['#2E5A1A', '#8DC63F', '#0ea5e9', '#f59e0b', '#e11d48', '#8b5cf6', '#14b8a6', '#f97316'];

/**
 * Native operational reports built directly from the app's own entities
 * (Jobs, Staff, Vehicles, Assets), filtered by the Reporting Hub's date range
 * and division scope. The `hub` prop selects which chart set to render.
 */
export default function NativeReportSection({ hub, filters }) {
  const divQuery = filters.divisionId ? { division_id: filters.divisionId } : {};

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['report-jobs', filters.divisionId],
    queryFn: () => base44.entities.Job.filter(divQuery, '-created_date', 500),
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['report-staff', filters.divisionId],
    queryFn: () => base44.entities.Staff.filter(divQuery, '-created_date', 500),
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['report-vehicles', filters.divisionId],
    queryFn: () => base44.entities.Vehicle.filter(divQuery, '-created_date', 500),
  });
  const { data: assets = [] } = useQuery({
    queryKey: ['report-assets', filters.divisionId],
    queryFn: () => base44.entities.SiteAsset.filter(divQuery, '-created_date', 500),
  });

  // Apply the date-range filter to jobs (overlap with start/end date)
  const filteredJobs = useMemo(() => {
    if (!filters.dateFrom && !filters.dateTo) return jobs;
    return jobs.filter((j) => {
      const jStart = j.start_date || '';
      const jEnd = j.end_date || '';
      if (filters.dateFrom && jEnd && jEnd < filters.dateFrom) return false;
      if (filters.dateTo && jStart && jStart > filters.dateTo) return false;
      return true;
    });
  }, [jobs, filters.dateFrom, filters.dateTo]);

  const jobsByStatus = useMemo(() => tally(filteredJobs, 'status'), [filteredJobs]);
  const jobsByDivision = useMemo(() => tally(filteredJobs, 'division_id'), [filteredJobs]);
  const staffByTeam = useMemo(() => tally(staff, 'team_id'), [staff]);
  const vehiclesByStatus = useMemo(() => tally(vehicles, 'status'), [vehicles]);
  const assetsByType = useMemo(() => tally(assets, 'asset_type'), [assets]);
  const assetCompliance = useMemo(() => tally(assets, 'compliance_status'), [assets]);

  const revenueTotal = useMemo(() => filteredJobs.reduce((s, j) => s + (Number(j.client_charge) || 0), 0), [filteredJobs]);

  const charts = useMemo(() => {
    const all = [
      { id: 'jobs-status', title: 'Jobs by Status', icon: Briefcase, data: jobsByStatus, type: 'pie', rows: filteredJobs },
      { id: 'jobs-div', title: 'Jobs by Business Stream', icon: Briefcase, data: jobsByDivision, type: 'bar', rows: filteredJobs },
      { id: 'revenue', title: 'Revenue (Client Charge)', icon: PoundSterling, data: [{ name: 'Total', value: revenueTotal }], type: 'stat', rows: filteredJobs },
      { id: 'staff-team', title: 'Staff by Team', icon: Users, data: staffByTeam, type: 'bar', rows: staff },
      { id: 'fleet-status', title: 'Fleet by Status', icon: Car, data: vehiclesByStatus, type: 'pie', rows: vehicles },
      { id: 'assets-type', title: 'Assets by Type', icon: Boxes, data: assetsByType, type: 'bar', rows: assets },
      { id: 'asset-compliance', title: 'Asset Compliance', icon: ShieldCheck, data: assetCompliance, type: 'pie', rows: assets },
    ];
    const sets = {
      overview: ['jobs-status', 'jobs-div', 'revenue', 'staff-team', 'fleet-status', 'assets-type', 'asset-compliance'],
      financial: ['revenue', 'jobs-status', 'jobs-div'],
      jobs: ['jobs-status', 'jobs-div'],
      fleet: ['fleet-status'],
      staff: ['staff-team'],
      assets: ['assets-type', 'asset-compliance'],
      compliance: ['asset-compliance', 'jobs-status'],
    };
    const ids = sets[hub] || sets.overview;
    return all.filter(c => ids.includes(c.id));
  }, [hub, jobsByStatus, jobsByDivision, revenueTotal, staffByTeam, vehiclesByStatus, assetsByType, assetCompliance, filteredJobs, staff, vehicles, assets]);

  if (jobsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {charts.map(c => <ReportCard key={c.id} {...c} />)}
    </div>
  );
}

function tally(rows, field) {
  const m = {};
  for (const r of rows) {
    const k = r[field] || 'Unassigned';
    m[k] = (m[k] || 0) + 1;
  }
  return Object.entries(m).map(([name, value]) => ({ name, value }));
}

function ReportCard({ title, icon: Icon, data, type, rows }) {
  return (
    <div className="hub-glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-primary flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 truncate">{title}</h3>
        </div>
        <button onClick={() => downloadCsv(title + '.csv', rows)} className="text-xs font-semibold text-primary hover:underline flex-shrink-0">Export</button>
      </div>

      <div className="h-64">
        {type === 'stat' ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-4xl font-extrabold text-primary tabular-nums">£{Math.round(data[0]?.value || 0).toLocaleString()}</p>
          </div>
        ) : type === 'pie' ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2E5A1A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}