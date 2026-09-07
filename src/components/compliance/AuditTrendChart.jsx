import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import HubCard from '@/components/hubs/HubCard';
import { TrendingUp } from 'lucide-react';

export default function AuditTrendChart() {
  const { data: reports = [] } = useQuery({ queryKey: ['safety-reports-trend'], queryFn: () => base44.entities.SafetyReport.list('-created_date', 200) });
  const chartData = useMemo(() => {
    const scored = reports.filter(r => r.pass_fail === 'pass' || r.pass_fail === 'fail');
    const byWeek = {};
    scored.forEach(r => {
      const d = r.conducted_at || r.created_date;
      if (!d) return;
      const dt = new Date(d);
      const weekStart = new Date(dt); weekStart.setDate(dt.getDate() - dt.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      if (!byWeek[key]) byWeek[key] = { week: key, total: 0, passed: 0 };
      byWeek[key].total++;
      if (r.pass_fail === 'pass') byWeek[key].passed++;
    });
    return Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week)).slice(-12).map(w => ({
      week: new Date(w.week).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      passRate: w.total > 0 ? Math.round((w.passed / w.total) * 100) : 0,
      total: w.total,
    }));
  }, [reports]);
  return (
    <HubCard icon={TrendingUp} title="Audit Pass Rate Trend" subtitle="Weekly pass/fail trend across all Mitti audits" tone="brand">
      {chartData.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">No scored audits yet — sync from Mitti to see trends.</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#94a3b8" unit="%" />
            <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            <Line type="monotone" dataKey="passRate" stroke="#2E5A1A" strokeWidth={2.5} dot={{ fill: '#8DC63F', r: 4 }} name="Pass Rate %" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </HubCard>
  );
}