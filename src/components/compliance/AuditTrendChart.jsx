import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import HubCard from '@/components/hubs/HubCard';
import { TrendingUp } from 'lucide-react';

const CATEGORY_COLORS = {
  vehicle_check: '#3b82f6',
  powra: '#f59e0b',
  equipment: '#8b5cf6',
  general: '#64748b',
};

const CATEGORY_LABELS = {
  vehicle_check: 'Vehicle',
  powra: 'POWRA',
  equipment: 'Equipment',
  general: 'General',
};

export default function AuditTrendChart() {
  const { data: reports = [] } = useQuery({ queryKey: ['safety-reports-trend'], queryFn: () => base44.entities.SafetyReport.list('-created_date', 300) });

  const chartData = useMemo(() => {
    const scored = reports.filter(r => r.auditor_staff_id && (r.pass_fail === 'pass' || r.pass_fail === 'fail'));
    const byWeek = {};
    scored.forEach(r => {
      const d = r.conducted_at || r.created_date;
      if (!d) return;
      const dt = new Date(d);
      const weekStart = new Date(dt); weekStart.setDate(dt.getDate() - dt.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      if (!byWeek[key]) byWeek[key] = { week: key, total: 0, passed: 0, categories: {} };
      byWeek[key].total++;
      if (r.pass_fail === 'pass') byWeek[key].passed++;
      const cat = r.audit_category || 'general';
      if (!byWeek[key].categories[cat]) byWeek[key].categories[cat] = { total: 0, passed: 0 };
      byWeek[key].categories[cat].total++;
      if (r.pass_fail === 'pass') byWeek[key].categories[cat].passed++;
    });
    return Object.values(byWeek).sort((a, b) => a.week.localeCompare(b.week)).slice(-12).map(w => {
      const entry = {
        week: new Date(w.week).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        overall: w.total > 0 ? Math.round((w.passed / w.total) * 100) : null,
      };
      for (const cat of Object.keys(CATEGORY_LABELS)) {
        const c = w.categories[cat];
        entry[cat] = c && c.total > 0 ? Math.round((c.passed / c.total) * 100) : null;
      }
      return entry;
    });
  }, [reports]);

  // Determine which categories actually have data
  const activeCategories = useMemo(() => {
    const cats = new Set();
    for (const w of chartData) {
      for (const cat of Object.keys(CATEGORY_LABELS)) {
        if (w[cat] != null) cats.add(cat);
      }
    }
    return Array.from(cats);
  }, [chartData]);

  return (
    <HubCard icon={TrendingUp} title="Audit Pass Rate Trend" subtitle="Weekly pass rate by category (Vehicle / POWRA / Equipment)" tone="brand">
      {chartData.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-400">No scored audits yet — sync from Mitti to see trends.</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="#94a3b8" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#94a3b8" unit="%" />
            <Tooltip
              contentStyle={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', fontSize: '12px' }}
              formatter={(value, name) => {
                if (value == null) return ['—', name];
                return [`${value}%`, CATEGORY_LABELS[name] || name];
              }}
            />
            <Legend formatter={(value) => CATEGORY_LABELS[value] || value} wrapperStyle={{ fontSize: '11px' }} />
            <Line type="monotone" dataKey="overall" stroke="#2E5A1A" strokeWidth={3} dot={{ fill: '#8DC63F', r: 4 }} name="overall" />
            {activeCategories.map(cat => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={CATEGORY_COLORS[cat]}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={{ r: 2 }}
                connectNulls
                name={cat}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </HubCard>
  );
}