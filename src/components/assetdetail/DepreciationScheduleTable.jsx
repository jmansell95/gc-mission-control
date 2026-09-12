import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingDown, Edit3, Save, X, Loader2, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { calculateDepreciation, METHOD_META } from '../../../base44/shared/depreciation';

const METHODS = [
  { id: 'straight_line', label: 'Straight-Line' },
  { id: 'reducing_balance', label: 'Reducing Balance' },
  { id: 'units_of_production', label: 'Units of Production' },
];

const gbp = (n) => n != null ? '£' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—';

/**
 * Year-by-year depreciation schedule table with inline parameter editing
 * and a method selector that live-previews the recalculation.
 */
export default function DepreciationScheduleTable({ asset }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    depreciation_method: asset.depreciation_method || 'straight_line',
    acquisition_cost: asset.acquisition_cost || '',
    acquisition_date: asset.acquisition_date || '',
    depreciation_years: asset.depreciation_years || '',
    salvage_value: asset.salvage_value || '',
    depreciation_rate: asset.depreciation_rate || '',
    units_estimated_total: asset.units_estimated_total || '',
  });

  // Live preview from the form (or from the stored asset when not editing)
  const preview = useMemo(() => {
    const input = editing ? {
      method: form.depreciation_method,
      acquisition_cost: Number(form.acquisition_cost) || 0,
      acquisition_date: form.acquisition_date,
      salvage_value: Number(form.salvage_value) || 0,
      useful_life_years: Number(form.depreciation_years) || 0,
      depreciation_rate: Number(form.depreciation_rate) || 0,
      units_estimated_total: Number(form.units_estimated_total) || 0,
      units_produced_to_date: asset.units_produced_to_date || asset.operating_hours || 0,
    } : {
      method: asset.depreciation_method || 'straight_line',
      acquisition_cost: asset.acquisition_cost,
      acquisition_date: asset.acquisition_date,
      salvage_value: asset.salvage_value || 0,
      useful_life_years: asset.depreciation_years,
      depreciation_rate: asset.depreciation_rate,
      units_estimated_total: asset.units_estimated_total,
      units_produced_to_date: asset.units_produced_to_date || asset.operating_hours || 0,
    };
    return calculateDepreciation(input);
  }, [editing, form, asset]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.SiteAsset.update(asset.id, {
        depreciation_method: form.depreciation_method,
        acquisition_cost: Number(form.acquisition_cost) || null,
        acquisition_date: form.acquisition_date || null,
        depreciation_years: Number(form.depreciation_years) || null,
        salvage_value: Number(form.salvage_value) || 0,
        depreciation_rate: form.depreciation_method === 'reducing_balance' ? Number(form.depreciation_rate) || null : null,
        units_estimated_total: form.depreciation_method === 'units_of_production' ? Number(form.units_estimated_total) || null : null,
        annual_depreciation: preview.annual_depreciation,
        accumulated_depreciation: preview.accumulated_depreciation,
        current_book_value: preview.current_book_value,
        cost_per_unit: preview.cost_per_unit,
      });
      await queryClient.invalidateQueries({ queryKey: ['asset-detail'] });
      await queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      toast({ title: '✓ Depreciation settings saved' });
      setEditing(false);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!asset.acquisition_cost || !asset.acquisition_date) {
    return (
      <div className="hub-glass rounded-2xl p-6 text-center">
        <TrendingDown className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No depreciation data — set acquisition cost and date to begin.</p>
        <button onClick={() => setEditing(true)} className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold">
          <Edit3 className="w-3.5 h-3.5" /> Configure Depreciation
        </button>
      </div>
    );
  }

  const meta = METHOD_META[preview.method];

  return (
    <div className="hub-glass rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-extrabold text-slate-900">Depreciation Schedule</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{meta.label}</span>
        </div>
        {editing ? (
          <div className="flex gap-1">
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-semibold disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
            </button>
            <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition">
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      {/* Method description */}
      <p className="text-[11px] text-slate-500 mb-3">{meta.description}</p>

      {/* Inline editor */}
      {editing && (
        <div className="rounded-xl border border-slate-200 p-3 mb-3 bg-slate-50/50 space-y-3">
          {/* Method pills */}
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1.5 block">Method</label>
            <div className="flex gap-1.5 flex-wrap">
              {METHODS.map(m => (
                <button key={m.id} onClick={() => setForm({ ...form, depreciation_method: m.id })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${form.depreciation_method === m.id ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <EditField label="Acquisition Cost (£)" type="number" value={form.acquisition_cost} onChange={v => setForm({ ...form, acquisition_cost: v })} />
            <EditField label="Acquisition Date" type="date" value={form.acquisition_date} onChange={v => setForm({ ...form, acquisition_date: v })} />
            <EditField label="Useful Life (years)" type="number" value={form.depreciation_years} onChange={v => setForm({ ...form, depreciation_years: v })} />
            <EditField label="Salvage Value (£)" type="number" value={form.salvage_value} onChange={v => setForm({ ...form, salvage_value: v })} />
            {form.depreciation_method === 'reducing_balance' && (
              <EditField label="Rate (% per year)" type="number" value={form.depreciation_rate} onChange={v => setForm({ ...form, depreciation_rate: v })} />
            )}
            {form.depreciation_method === 'units_of_production' && (
              <EditField label="Est. Total Units (hrs)" type="number" value={form.units_estimated_total} onChange={v => setForm({ ...form, units_estimated_total: v })} />
            )}
          </div>
        </div>
      )}

      {/* Summary stats */}
      {preview.configured && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <SummaryTile label="Annual Dep." value={gbp(preview.annual_depreciation)} tone="text-slate-700" />
          <SummaryTile label="Accumulated" value={gbp(preview.accumulated_depreciation)} tone="text-amber-600" />
          <SummaryTile label="Book Value" value={gbp(preview.current_book_value)} tone="text-emerald-700" />
          <SummaryTile label="Remaining" value={`${preview.remaining_years}y`} tone="text-slate-600" />
        </div>
      )}

      {/* Year-by-year table */}
      {preview.configured && preview.schedule.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/80">
              <tr className="text-slate-500 uppercase text-[10px]">
                <th className="text-left px-3 py-2 font-semibold">Year</th>
                <th className="text-right px-3 py-2 font-semibold">Opening</th>
                <th className="text-right px-3 py-2 font-semibold">Charge</th>
                <th className="text-right px-3 py-2 font-semibold">Accumulated</th>
                <th className="text-right px-3 py-2 font-semibold">Closing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {preview.schedule.map((row, i) => {
                const isCurrent = i === preview.current_year_index;
                return (
                  <tr key={row.year} className={isCurrent ? 'bg-emerald-50/60 font-semibold' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                    <td className="px-3 py-2 text-slate-700">
                      <span className="flex items-center gap-1.5">
                        {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        {row.year_label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{gbp(row.opening_value)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-600">{gbp(row.annual_charge)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{gbp(row.accumulated_depreciation)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-800">{gbp(row.closing_value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-400 text-center py-4">
          {preview.method === 'reducing_balance' ? 'Set a depreciation rate to calculate.' : 'Set useful life years to calculate.'}
        </p>
      )}
    </div>
  );
}

function SummaryTile({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
      <p className="text-[10px] text-slate-500 uppercase font-medium">{label}</p>
      <p className={`text-sm font-bold tabular-nums mt-0.5 ${tone}`}>{value}</p>
    </div>
  );
}

function EditField({ label, type, value, onChange }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
    </div>
  );
}