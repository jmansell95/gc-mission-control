import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Activity, Wrench, Clock, Loader2, Radio } from 'lucide-react';

// LiveJobProgressFeed — real-time activity stream of field work.
// Merges InvestigationLog and Timesheet creates via entity subscriptions,
// showing crews' logged work as it happens. Drop into any dashboard or
// supervisor tablet view for a live operational pulse.
export default function LiveJobProgressFeed({ limit = 25, title = 'Live Activity' }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [logs, ts] = await Promise.all([
          base44.entities.InvestigationLog.list('-created_at', limit).catch(() => []),
          base44.entities.Timesheet.filter({}, '-created_date', limit).catch(() => []),
        ]);
        if (!mounted) return;
        const merged = [
          ...logs.map((l) => ({
            id: l.id,
            type: 'log',
            title: l.description || (l.log_type || '').replace(/_/g, ' '),
            sub: [l.borehole_ref, l.staff_name].filter(Boolean).join(' · '),
            at: l.created_at || l.date,
            icon: Wrench,
            color: 'text-emerald-600 bg-emerald-50',
          })),
          ...ts.map((t) => ({
            id: t.id,
            type: 'ts',
            title: t.task_description || 'Timesheet entry',
            sub: [t.staff_name, t.job_id].filter(Boolean).join(' · '),
            at: t.created_date || t.date,
            icon: Clock,
            color: 'text-blue-600 bg-blue-50',
          })),
        ]
          .filter((i) => i.at)
          .sort((a, b) => new Date(b.at) - new Date(a.at))
          .slice(0, limit);
        setItems(merged);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const onLog = (event) => {
      if (event.type !== 'create') return;
      const d = event.data || {};
      setItems((prev) =>
        [
          {
            id: event.id,
            type: 'log',
            title: d.description || (d.log_type || '').replace(/_/g, ' '),
            sub: [d.borehole_ref, d.staff_name].filter(Boolean).join(' · '),
            at: d.created_at || new Date().toISOString(),
            icon: Wrench,
            color: 'text-emerald-600 bg-emerald-50',
          },
          ...prev,
        ].slice(0, limit)
      );
    };
    const onTs = (event) => {
      if (event.type !== 'create') return;
      const d = event.data || {};
      setItems((prev) =>
        [
          {
            id: event.id,
            type: 'ts',
            title: d.task_description || 'Timesheet entry',
            sub: [d.staff_name].filter(Boolean).join(' · '),
            at: d.created_date || new Date().toISOString(),
            icon: Clock,
            color: 'text-blue-600 bg-blue-50',
          },
          ...prev,
        ].slice(0, limit)
      );
    };

    const unsub1 = base44.entities.InvestigationLog.subscribe(onLog);
    const unsub2 = base44.entities.Timesheet.subscribe(onTs);
    return () => {
      unsub1();
      unsub2();
    };
  }, [limit]);

  const relTime = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="hub-glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-md flex-shrink-0">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold text-slate-900 truncate">{title}</h3>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <Radio className="w-3 h-3 text-emerald-500" /> Real-time
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <Activity className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-xs text-slate-400 font-medium">No activity yet</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto no-scrollbar">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={`${item.type}-${item.id}`} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 transition animate-slide-up">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 truncate">{item.title}</p>
                  {item.sub && <p className="text-[11px] text-slate-500 truncate">{item.sub}</p>}
                </div>
                <span className="text-[10px] text-slate-400 font-medium flex-shrink-0 mt-0.5">{relTime(item.at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}