import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, LayoutDashboard, TrendingUp, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PerformanceOverviewTab from '@/components/performance/PerformanceOverviewTab';
import RigProfitabilityView from '@/components/performance/RigProfitabilityView';
import CrewEarningsView from '@/components/performance/CrewEarningsView';

/**
 * PerformanceTab — embedded inside the Financial Hub for geotechnical
 * business streams. Replaces the standalone Performance Hub page.
 * Holds the date-range picker and a sub-tab pill nav (Overview, Rig
 * Profitability, Crew Earnings), preserving the original PerformanceHub UX.
 */
export default function PerformanceTab() {
  const navigate = useNavigate();
  const [subTab, setSubTab] = useState('overview');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Default to current year if empty
  const dateRange = useMemo(() => {
    const today = new Date();
    const from = dateFrom || `${today.getFullYear()}-01-01`;
    const to = dateTo || today.toISOString().slice(0, 10);
    return { date_from: from, date_to: to };
  }, [dateFrom, dateTo]);

  const subTabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'rig-profitability', label: 'Rig Profitability', icon: TrendingUp },
    { id: 'crew-earnings', label: 'Crew Earnings', icon: Users },
  ];

  // Navigate to a job's detail in the admin dashboard
  const handleSelectJob = async (jobId) => {
    try {
      const jobs = await base44.entities.Job.filter({ id: jobId });
      if (jobs[0]) navigate('/admin', { state: { section: 'job-detail', job: jobs[0] } });
    } catch (e) { /* ignore */ }
  };

  return (
    <div className="space-y-3">
      {/* Date range picker */}
      <div className="hub-glass rounded-2xl p-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Calendar className="w-4 h-4" /> Period:
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#2E5A1A]"
          />
          <span className="text-slate-400 text-xs">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#2E5A1A]"
          />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
          >
            This Year
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setMonth(d.getMonth() - 1);
              setDateFrom(d.toISOString().slice(0, 10));
              setDateTo(new Date().toISOString().slice(0, 10));
            }}
            className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Sub-tab pill nav */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {subTabs.map(t => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                active
                  ? 'command-gradient text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Sub-view body */}
      {subTab === 'overview' && (
        <PerformanceOverviewTab
          dateRange={dateRange}
          onSelectJob={handleSelectJob}
          onGoToTab={setSubTab}
        />
      )}
      {subTab === 'rig-profitability' && (
        <RigProfitabilityView dateRange={dateRange} onSelectJob={handleSelectJob} />
      )}
      {subTab === 'crew-earnings' && (
        <CrewEarningsView dateRange={dateRange} onSelectJob={handleSelectJob} />
      )}
    </div>
  );
}