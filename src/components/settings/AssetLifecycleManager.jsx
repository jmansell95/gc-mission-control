import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Wrench, TrendingDown, Calendar, PoundSterling, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { format, differenceInYears, parseISO, differenceInDays } from 'date-fns';

// Asset Lifecycle Manager — tracks assets from acquisition to disposal
// with straight-line depreciation, current book value, replacement
// planning, and disposal recording.

export default function AssetLifecycleManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [editing, setEditing] = useState(false);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['asset-lifecycle'],
    queryFn: async () => { const r = await base44.entities.SiteAsset.list('-acquisition_date', 500); return r.data || r || []; },
  });

  const enrichedAssets = useMemo(() => {
    return assets.map(a => {
      let bookValue = a.acquisition_cost || 0;
      let annualDepreciation = 0;
      let ageYears = 0;
      let isFullyDeppreciated = false;

      if (a.acquisition_date && a.acquisition_cost && a.depreciation_years) {
        ageYears = differenceInYears(new Date(), parseISO(a.acquisition_date));
        annualDepreciation = (a.acquisition_cost - (a.salvage_value || 0)) / a.depreciation_years;
        const accumulatedDep = annualDepreciation * ageYears;
        bookValue = Math.max(a.acquisition_cost - accumulatedDep, a.salvage_value || 0);
        isFullyDeppreciated = ageYears >= a.depreciation_years;
      }

      let lifecycleStatus = a.lifecycle_status || 'active';
      if (a.disposal_date) lifecycleStatus = 'disposed';
      else if (a.replacement_date) {
        const daysToReplacement = differenceInDays(parseISO(a.replacement_date), new Date());
        if (daysToReplacement <= 90 && daysToReplacement >= 0) lifecycleStatus = 'due_for_replacement';
      }
      if (isFullyDeppreciated && lifecycleStatus === 'active') lifecycleStatus = 'aging';

      return { ...a, bookValue, annualDepreciation, ageYears, isFullyDeppreciated, lifecycleStatus };
    });
  }, [assets]);

  const stats = useMemo(() => {
    const totalValue = enrichedAssets.reduce((s, a) => s + (a.acquisition_cost || 0), 0);
    const totalBookValue = enrichedAssets.reduce((s, a) => s + a.bookValue, 0);
    const dueForReplacement = enrichedAssets.filter(a => a.lifecycleStatus === 'due_for_replacement').length;
    const disposed = enrichedAssets.filter(a => a.lifecycleStatus === 'disposed').length;
    return { totalValue, totalBookValue, dueForReplacement, disposed, count: enrichedAssets.length };
  }, [enrichedAssets]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => base44.entities.SiteAsset.update(id, data),
    onSuccess: () => {
      toast({ title: '✓ Asset lifecycle updated' });
      queryClient.invalidateQueries({ queryKey: ['asset-lifecycle'] });
      setEditing(false);
    },
    onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const statusConfig = {
    active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
    aging: { label: 'Aging', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
    due_for_replacement: { label: 'Due for Replacement', cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' },
    disposed: { label: 'Disposed', cls: 'bg-slate-100 text-slate-500 ring-slate-200', dot: 'bg-slate-400' },
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Wrench}
        title="Asset Lifecycle Management"
        description="Track assets from acquisition to disposal with depreciation, book value, and replacement planning."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="hub-glass rounded-2xl p-4">
          <p className="text-[10px] text-slate-500 uppercase font-medium">Total Assets</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{stats.count}</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <p className="text-[10px] text-slate-500 uppercase font-medium">Acquisition Value</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">£{stats.totalValue.toLocaleString()}</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <p className="text-[10px] text-slate-500 uppercase font-medium">Current Book Value</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">£{stats.totalBookValue.toLocaleString()}</p>
        </div>
        <div className="hub-glass rounded-2xl p-4">
          <p className="text-[10px] text-slate-500 uppercase font-medium">Due for Replacement</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{stats.dueForReplacement}</p>
        </div>
      </div>

      {/* Asset list */}
      <div className="hub-glass rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Asset</th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Acquired</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Cost</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Book Value</th>
                  <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Age</th>
                  <th className="text-center py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {enrichedAssets.filter(a => a.acquisition_cost).map(a => {
                  const cfg = statusConfig[a.lifecycleStatus] || statusConfig.active;
                  return (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer"
                      onClick={() => { setSelectedAsset(a); setEditing(false); }}>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">{a.name}</td>
                      <td className="py-2.5 px-3 text-slate-500 capitalize">{a.asset_type?.replace(/_/g, ' ')}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{a.acquisition_date ? format(parseISO(a.acquisition_date), 'MMM yyyy') : '—'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600 tabular-nums">£{(a.acquisition_cost || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-700 tabular-nums">£{a.bookValue.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{a.ageYears}y</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${cfg.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {enrichedAssets.filter(a => a.acquisition_cost).length === 0 && (
              <div className="text-center py-12 text-sm text-slate-400">
                No assets with acquisition cost data. Add acquisition details to assets to see lifecycle tracking.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit drawer */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center overflow-y-auto overscroll-contain p-4" onClick={() => setSelectedAsset(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-4">{selectedAsset.name}</h3>
            {editing ? (
              <AssetLifecycleForm asset={selectedAsset} onSave={(data) => updateMutation.mutate({ id: selectedAsset.id, data })} saving={updateMutation.isPending} onCancel={() => setEditing(false)} />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Acquisition Date" value={selectedAsset.acquisition_date ? format(parseISO(selectedAsset.acquisition_date), 'dd MMM yyyy') : '—'} />
                  <Field label="Acquisition Cost" value={selectedAsset.acquisition_cost ? `£${selectedAsset.acquisition_cost.toLocaleString()}` : '—'} />
                  <Field label="Depreciation Years" value={selectedAsset.depreciation_years ? `${selectedAsset.depreciation_years} years` : '—'} />
                  <Field label="Salvage Value" value={selectedAsset.salvage_value ? `£${selectedAsset.salvage_value.toLocaleString()}` : '—'} />
                  <Field label="Annual Depreciation" value={selectedAsset.annualDepreciation ? `£${selectedAsset.annualDepreciation.toLocaleString()}/yr` : '—'} />
                  <Field label="Current Book Value" value={`£${selectedAsset.bookValue.toLocaleString()}`} highlight />
                  <Field label="Replacement Date" value={selectedAsset.replacement_date ? format(parseISO(selectedAsset.replacement_date), 'dd MMM yyyy') : '—'} />
                  <Field label="Replacement Cost" value={selectedAsset.replacement_cost_estimate ? `£${selectedAsset.replacement_cost_estimate.toLocaleString()}` : '—'} />
                </div>
                <Button onClick={() => setEditing(true)} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white">Edit Lifecycle Details</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, highlight }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-[10px] text-slate-500 uppercase font-medium">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-emerald-700' : 'text-slate-700'}`}>{value}</p>
    </div>
  );
}

function AssetLifecycleForm({ asset, onSave, saving, onCancel }) {
  const [form, setForm] = useState({
    acquisition_date: asset.acquisition_date || '',
    acquisition_cost: asset.acquisition_cost || '',
    depreciation_years: asset.depreciation_years || '',
    salvage_value: asset.salvage_value || '',
    replacement_date: asset.replacement_date || '',
    replacement_cost_estimate: asset.replacement_cost_estimate || '',
    disposal_date: asset.disposal_date || '',
    disposal_value: asset.disposal_value || '',
    lifecycle_status: asset.lifecycle_status || 'active',
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Acquisition Date" type="date" value={form.acquisition_date} onChange={v => setForm({ ...form, acquisition_date: v })} />
        <Input label="Acquisition Cost (£)" type="number" value={form.acquisition_cost} onChange={v => setForm({ ...form, acquisition_cost: v })} />
        <Input label="Depreciation (years)" type="number" value={form.depreciation_years} onChange={v => setForm({ ...form, depreciation_years: v })} />
        <Input label="Salvage Value (£)" type="number" value={form.salvage_value} onChange={v => setForm({ ...form, salvage_value: v })} />
        <Input label="Replacement Date" type="date" value={form.replacement_date} onChange={v => setForm({ ...form, replacement_date: v })} />
        <Input label="Replacement Cost (£)" type="number" value={form.replacement_cost_estimate} onChange={v => setForm({ ...form, replacement_cost_estimate: v })} />
        <Input label="Disposal Date" type="date" value={form.disposal_date} onChange={v => setForm({ ...form, disposal_date: v })} />
        <Input label="Disposal Value (£)" type="number" value={form.disposal_value} onChange={v => setForm({ ...form, disposal_value: v })} />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 mb-1 block">Lifecycle Status</label>
        <select value={form.lifecycle_status} onChange={e => setForm({ ...form, lifecycle_status: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="active">Active</option>
          <option value="aging">Aging</option>
          <option value="due_for_replacement">Due for Replacement</option>
          <option value="disposed">Disposed</option>
        </select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave(form)} disabled={saving} className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
        </Button>
        <Button onClick={onCancel} variant="outline" className="flex-1">Cancel</Button>
      </div>
    </div>
  );
}

function Input({ label, type, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
    </div>
  );
}