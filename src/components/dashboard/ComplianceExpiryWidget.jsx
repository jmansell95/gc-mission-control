import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, Clock, XCircle, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';

const CATEGORY_LABELS = {
  staff: 'Staff Certifications',
  vehicle: 'Vehicles',
  equipment: 'Equipment & Plant',
  company: 'Company / Insurance',
  job: 'Job-Specific',
};

function parseDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}$/.test(str)) return new Date(str + '-01T00:00:00');
  return new Date(str + 'T00:00:00');
}

function daysUntil(str) {
  const d = parseDate(str);
  if (!d || isNaN(d.getTime())) return null;
  return Math.floor((d - new Date()) / 86400000);
}

export default function ComplianceExpiryWidget({ onNavigate }) {
  const [filter, setFilter] = useState('all'); // all | expired | expiring

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['compliance-items-expiry-widget'],
    queryFn: () => base44.entities.ComplianceItem.list('-created_date', 500),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  const today = new Date();
  const flagged = items
    .filter(c => c.status_override !== 'not_required' && c.status_override !== 'missing' && c.expiry_date)
    .map(c => {
      const days = daysUntil(c.expiry_date);
      const status = days < 0 ? 'expired' : days <= 30 ? 'expiring' : 'ok';
      return { ...c, days, status };
    })
    .filter(c => c.status !== 'ok');

  const expiredCount = flagged.filter(c => c.status === 'expired').length;
  const expiringCount = flagged.filter(c => c.status === 'expiring').length;

  // Group by category
  const byCategory = {};
  for (const c of flagged) {
    const cat = c.category || 'company';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(c);
  }

  const shown = filter === 'all' ? flagged : flagged.filter(c => c.status === filter);

  return (
    <div className="space-y-3">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
          <div className="flex items-center gap-1.5">
            <XCircle className="w-4 h-4 text-rose-600" />
            <p className="text-[11px] font-medium text-rose-600 uppercase tracking-wide">Expired</p>
          </div>
          <p className="text-2xl font-bold text-rose-700 tabular-nums mt-0.5">{expiredCount}</p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" />
            <p className="text-[11px] font-medium text-amber-600 uppercase tracking-wide">Expiring ≤30d</p>
          </div>
          <p className="text-2xl font-bold text-amber-700 tabular-nums mt-0.5">{expiringCount}</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5">
        {[
          { val: 'all', label: 'All', count: flagged.length },
          { val: 'expired', label: 'Expired', count: expiredCount },
          { val: 'expiring', label: 'Expiring', count: expiringCount },
        ].map(f => (
          <button
            key={f.val}
            onClick={() => setFilter(f.val)}
            className={`text-xs font-medium px-2.5 py-1 rounded-full transition ${
              filter === f.val
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Items list */}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-slate-600">All compliant</p>
          <p className="text-xs text-slate-400 mt-0.5">No expiring or expired items</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[320px] overflow-y-auto">
          {Object.entries(byCategory).map(([cat, catItems]) => {
            const filtered = catItems.filter(c => filter === 'all' || c.status === filter);
            if (filtered.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
                  {CATEGORY_LABELS[cat] || cat}
                </p>
                <div className="space-y-1.5">
                  {filtered
                    .sort((a, b) => a.days - b.days)
                    .map(c => (
                      <div
                        key={c.id}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 border ${
                          c.status === 'expired'
                            ? 'bg-rose-50/60 border-rose-200/60'
                            : 'bg-amber-50/60 border-amber-200/60'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            c.status === 'expired' ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">{c.reference_name || '—'}</p>
                          <p className="text-[11px] text-slate-500 truncate">{c.title}</p>
                        </div>
                        <span
                          className={`text-[11px] font-bold flex-shrink-0 ${
                            c.status === 'expired' ? 'text-rose-600' : 'text-amber-600'
                          }`}
                        >
                          {c.status === 'expired'
                            ? `${Math.abs(c.days)}d ago`
                            : `${c.days}d`}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onNavigate && flagged.length > 0 && (
        <button
          onClick={() => onNavigate('compliance')}
          className="w-full flex items-center justify-center gap-1 text-xs font-semibold text-primary hover:underline pt-1"
        >
          Open Compliance Manager <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}