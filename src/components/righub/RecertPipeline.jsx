import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldX, ShieldAlert, CalendarClock, AlertTriangle, HelpCircle, Cog, Wrench,
  Package, Truck, Anchor, Plug, ChevronRight, Link2, RefreshCw, Filter, Upload, ClipboardList,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { safeFormat } from '@/utils/format';
import { COMPLIANCE_META, ASSET_TYPE_META, findParentRig, daysUntil } from '@/utils/rigRollup';

const TYPE_ICON = { rig: Cog, machinery: Wrench, trailer: Package, vehicle: Truck, lifting: Anchor, portable_appliance: Plug };

/**
 * Re-certification Pipeline — the operational dashboard for staying ahead
 * of statutory expiry. Surfaces every asset that is expired, expiring soon,
 * or missing dates, sorted by urgency, with a one-tap path to log the new
 * inspection and clear it from the queue.
 */
export default function RecertPipeline({ assets = [], onRecert, onOpenAsset }) {
  const [group, setGroup] = useState('all'); // all | overdue | due_soon | no_date | unknown
  const { data: recertLog } = useQuery({
    queryKey: ['recert-pipeline'],
    queryFn: () => base44.entities.ServiceRecord.list('-date', 200),
  });
  const { data: openTasks = [] } = useQuery({
    queryKey: ['open-recert-tasks'],
    queryFn: () => base44.entities.ComplianceTask.filter({ status: 'open' }),
  });
  const openTaskCount = (openTasks || []).length;

  const rigs = useMemo(() => assets.filter(a => a.asset_type === 'rig'), [assets]);

  const items = useMemo(() => {
    return assets.map(a => {
      const d = daysUntil(a.compliance_expiry_date);
      const sd = daysUntil(a.next_service_date);
      let bucket;
      if ((a.compliance_status === 'expired') || (d !== null && d < 0) || (sd !== null && sd < 0)) bucket = 'overdue';
      else if ((a.compliance_status === 'expiring') || (d !== null && d <= 30) || (sd !== null && sd <= 30)) bucket = 'due_soon';
      else if (d === null && sd === null && a.compliance_status !== 'compliant') bucket = 'no_date';
      else if (a.compliance_status === 'unknown') bucket = 'unknown';
      else bucket = 'ok';
      const urgency = bucket === 'overdue' ? (d !== null ? -d : 999) : bucket === 'due_soon' ? (d ?? sd) : 9999;
      return { asset: a, bucket, urgency, days: d, parentRig: findParentRig(a.id, rigs) };
    }).filter(x => x.bucket !== 'ok')
      .sort((a, b) => a.urgency - b.urgency);
  }, [assets, rigs]);

  const counts = useMemo(() => ({
    overdue: items.filter(i => i.bucket === 'overdue').length,
    due_soon: items.filter(i => i.bucket === 'due_soon').length,
    no_date: items.filter(i => i.bucket === 'no_date').length,
    unknown: items.filter(i => i.bucket === 'unknown').length,
  }), [items]);

  const filtered = group === 'all' ? items : items.filter(i => i.bucket === group);

  const bucketMeta = {
    overdue: { label: 'Overdue', tone: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500', Icon: ShieldX },
    due_soon: { label: 'Due Soon (30d)', tone: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500', Icon: ShieldAlert },
    no_date: { label: 'No Date Set', tone: 'text-blue-700 bg-blue-50 border-blue-200', dot: 'bg-blue-500', Icon: CalendarClock },
    unknown: { label: 'Unknown Status', tone: 'text-slate-600 bg-slate-50 border-slate-200', dot: 'bg-slate-400', Icon: HelpCircle },
  };

  return (
    <div className="space-y-4">
      {/* Bucket tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'overdue', label: 'Overdue', grad: 'stat-gradient-rose', Icon: ShieldX },
          { key: 'due_soon', label: 'Due in 30 days', grad: 'stat-gradient-amber', Icon: ShieldAlert },
          { key: 'no_date', label: 'No Date Set', grad: 'stat-gradient-blue', Icon: CalendarClock },
          { key: 'unknown', label: 'Unknown', grad: 'stat-gradient-slate', Icon: HelpCircle },
        ].map(s => {
          const SIcon = s.Icon;
          const active = group === s.key;
          return (
            <button key={s.key} onClick={() => setGroup(active ? 'all' : s.key)}
              className={`hub-glass rounded-xl p-3.5 text-left transition ${active ? 'ring-2 ring-emerald-500' : ''}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.grad} flex items-center justify-center shadow-md`}>
                  <SIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{counts[s.key]}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">{s.label}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-slate-800">Re-certification Queue</p>
            <span className="text-xs text-slate-400">{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
            {openTaskCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200" title="Auto-created recert tasks assigned to the compliance team">
                <ClipboardList className="w-3 h-3" /> {openTaskCount} open task{openTaskCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {group !== 'all' && (
            <button onClick={() => setGroup('all')} className="text-xs text-emerald-700 font-medium hover:underline flex items-center gap-1">
              <Filter className="w-3 h-3" /> Clear filter
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldAlert className="w-10 h-10 text-emerald-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">{group === 'all' ? 'All assets are compliant — nothing due for re-certification. 🎉' : 'No items in this bucket.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(({ asset, bucket, days, parentRig }) => {
              const bm = bucketMeta[bucket];
              const BIcon = bm.Icon;
              const Icon = TYPE_ICON[asset.asset_type] || Wrench;
              return (
                <div key={asset.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border flex-shrink-0 ${bm.tone}`}>
                    <BIcon className="w-4 h-4" />
                  </div>
                  <button onClick={() => onOpenAsset?.(asset)} className="flex items-center gap-2.5 min-w-0 flex-1 text-left">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{asset.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {ASSET_TYPE_META[asset.asset_type]?.label || asset.asset_type}
                        {parentRig ? <span className="text-emerald-700"> · <Link2 className="w-2.5 h-2.5 inline" /> {parentRig.name}</span> : ''}
                        {asset.compliance_expiry_date ? ` · expires ${safeFormat(asset.compliance_expiry_date, 'dd MMM yyyy')}` : ' · no expiry date'}
                      </p>
                    </div>
                  </button>
                  <div className="text-right flex-shrink-0">
                    {days !== null ? (
                      <p className={`text-sm font-bold tabular-nums ${days < 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 font-medium">No date</p>
                    )}
                  </div>
                  <button onClick={() => onRecert?.(asset)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-xs font-semibold hover:brightness-110 transition flex-shrink-0">
                    <Upload className="w-3.5 h-3.5" /> Upload Cert
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}