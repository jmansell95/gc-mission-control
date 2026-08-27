import React from 'react';
import { Layers, HardHat, Clock, Users, BedDouble, Package, Truck, MapPin } from 'lucide-react';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

const SHEET_META = [
  { key: 'rotary_drilling', label: 'Rotary Drilling', icon: HardHat },
  { key: 'cp_drilling', label: 'CP Drilling', icon: HardHat },
  { key: 'rotary_dayworks', label: 'Rotary Dayworks', icon: Clock },
  { key: 'cp_dayworks', label: 'CP Dayworks', icon: Clock },
  { key: 'enabling_crew', label: 'Enabling Crew', icon: Users },
  { key: 'accommodation', label: 'Accommodation', icon: BedDouble },
  { key: 'misc', label: 'Misc', icon: Package },
  { key: 'hires', label: 'Hires', icon: Truck },
  { key: 'mileage', label: 'Mileage', icon: MapPin },
];

export default function EWRPreview({ preview }) {
  const cd = preview.contract_details || {};
  const sheets = preview.ewr_sheets || {};
  const periods = preview.afp_periods || [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="Date" value={cd.date || '—'} />
        <Tile label="Payment Due" value={cd.payment_due_date || '—'} />
        <Tile label="Client" value={cd.client || '—'} />
        <Tile label="GC Job Number" value={cd.gc_job_number || '—'} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SHEET_META.map(({ key, label, icon: Icon }) => (
          <div key={key} className="bg-white rounded-xl border border-slate-200 p-2.5 text-center">
            <Icon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
            <p className="text-lg font-bold text-slate-900 tabular-nums">{(sheets[key] || []).length}</p>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>
      {periods.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 overflow-hidden">
          <div className="px-4 py-2 bg-blue-100/60 border-b border-blue-200 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <p className="text-xs font-bold text-blue-700">{periods.length} AFP{periods.length > 1 ? 's' : ''} will be created</p>
          </div>
          <div className="divide-y divide-blue-100">
            {periods.map((p) => (
              <div key={p.afp_number} className="px-4 py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">AFP {p.afp_number}</span>
                  <span className="text-slate-600 font-medium">
                    {p.period_start ? new Date(p.period_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'} → {p.period_end ? new Date(p.period_end).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                  </span>
                </div>
                <span className="text-slate-900 font-bold tabular-nums">{fmt(p.total_claimed)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
      <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">{value}</p>
    </div>
  );
}