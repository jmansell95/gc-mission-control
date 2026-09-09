import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Leaf, Building2, TrendingDown, Truck, ChevronRight } from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import { format, subMonths } from 'date-fns';

const FUEL_EMISSIONS = {
  diesel: 168, petrol: 170, hybrid: 110, electric: 0, lpg: 150, cng: 140, unknown: 170,
};
const AVG_DAILY_MILES = 40; // per vehicle per working day

/**
 * CarbonFootprintByProject — shows estimated CO₂ emissions allocated
 * per active project, with a 6-month trend chart. Emissions are
 * estimated from vehicles assigned to each job via RotaAssignment
 * (working days × daily mileage × vehicle emissions factor).
 */
export default function CarbonFootprintByProject() {
  const [selectedJobId, setSelectedJobId] = useState(null);

  const { data: jobs = [], isLoading: isLoadingJobs } = useQuery({
    queryKey: ['active-jobs-carbon'],
    queryFn: () => base44.entities.Job.filter({ status: { $nin: ['completed', 'cancelled', 'on_hold'] } }, '-created_date', 50),
  });

  const { data: rotas = [], isLoading: isLoadingRotas } = useQuery({
    queryKey: ['rotas-carbon'],
    queryFn: () => base44.entities.RotaAssignment.filter({ assignment_type: 'job' }, '-assigned_date', 500),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles-carbon-proj'],
    queryFn: () => base44.entities.Vehicle.list(),
  });

  const vehicleMap = useMemo(() => Object.fromEntries(vehicles.map(v => [v.id, v])), [vehicles]);

  // Calculate per-project monthly emissions for the last 6 months
  const projectData = useMemo(() => {
    if (!jobs.length || !rotas.length) return [];

    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      months.push(subMonths(now, i));
    }

    return jobs.map(job => {
      const jobRotas = rotas.filter(r => r.job_id === job.id);
      const monthlyEmissions = months.map(monthDate => {
        const monthStr = format(monthDate, 'yyyy-MM');
        const monthRotas = jobRotas.filter(r => r.assigned_date?.startsWith(monthStr));
        const workingDays = monthRotas.length;
        const vehicleIds = [...new Set(monthRotas.map(r => r.vehicle_id).filter(Boolean))];
        let totalKg = 0;
        for (const vid of vehicleIds) {
          const v = vehicleMap[vid];
          if (!v) continue;
          const fuel = v.fuel_type || 'unknown';
          const emissionsPerKm = v.co2_emissions_g_km || FUEL_EMISSIONS[fuel] || FUEL_EMISSIONS.unknown;
          totalKg += (workingDays * AVG_DAILY_MILES * 1.609 * emissionsPerKm) / 1000;
        }
        return { month: format(monthDate, 'MMM'), kg: Math.round(totalKg) };
      });

      const totalKg = monthlyEmissions.reduce((s, m) => s + m.kg, 0);
      const avgMonthly = totalKg / months.length;
      const vehicleCount = new Set(jobRotas.map(r => r.vehicle_id).filter(Boolean)).size;

      return {
        job,
        monthlyEmissions,
        totalKg: Math.round(totalKg),
        avgMonthly: Math.round(avgMonthly),
        vehicleCount,
        workingDays: jobRotas.length,
      };
    }).filter(p => p.totalKg > 0).sort((a, b) => b.totalKg - a.totalKg);
  }, [jobs, rotas, vehicleMap]);

  const selectedProject = projectData.find(p => p.job.id === selectedJobId) || projectData[0];

  if (isLoadingJobs || isLoadingRotas) {
    return (
      <HubCard icon={Leaf} title="Carbon Footprint by Project" subtitle="Per-project emissions with 6-month trend" tone="brand">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
        </div>
      </HubCard>
    );
  }

  if (projectData.length === 0) {
    return (
      <HubCard icon={Leaf} title="Carbon Footprint by Project" subtitle="Per-project emissions with 6-month trend" tone="brand">
        <div className="text-center py-8">
          <Leaf className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-500">No project emissions data yet</p>
          <p className="text-xs text-slate-400 mt-1">Emissions appear when vehicles are assigned to active projects</p>
        </div>
      </HubCard>
    );
  }

  return (
    <HubCard icon={Leaf} title="Carbon Footprint by Project" subtitle="Per-project emissions with 6-month trend" tone="brand">
      <div className="space-y-4">
        {/* Project list */}
        <div className="space-y-1.5">
          {projectData.slice(0, 5).map(p => (
            <button
              key={p.job.id}
              onClick={() => setSelectedJobId(p.job.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition ${
                selectedProject?.job.id === p.job.id ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50/60 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{p.job.name}</p>
                <p className="text-[10px] text-slate-500">
                  {p.vehicleCount} vehicle{p.vehicleCount !== 1 ? 's' : ''} · {p.workingDays} working days · avg {p.avgMonthly} kg/mo
                </p>
              </div>
              <span className="text-sm font-bold text-slate-700 tabular-nums">{p.totalKg}<span className="text-xs font-normal text-slate-400 ml-0.5">kg</span></span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          ))}
        </div>

        {/* Trend chart for selected project */}
        {selectedProject && (
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-700">{selectedProject.job.name} — 6-month trend</p>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                Total: {selectedProject.totalKg} kg CO₂
              </span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={selectedProject.monthlyEmissions} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v) => [`${v} kg CO₂`, 'Emissions']}
                />
                <Line
                  type="monotone"
                  dataKey="kg"
                  stroke="#2E5A1A"
                  strokeWidth={2.5}
                  dot={{ fill: '#2E5A1A', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-[10px] text-slate-400 italic">
          Estimates based on assigned vehicles × working days × {AVG_DAILY_MILES} mi/day. Actual mileage may vary.
        </p>
      </div>
    </HubCard>
  );
}