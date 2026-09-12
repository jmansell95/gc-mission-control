import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Settings2, Plus, Trash2, Loader2, Check, Edit3, X, TrendingDown,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { METHOD_META } from '../../../base44/shared/depreciation';

const ASSET_TYPES = [
  { id: 'rig', label: 'Rigs' },
  { id: 'machinery', label: 'Machinery' },
  { id: 'trailer', label: 'Trailers' },
  { id: 'vehicle', label: 'Vehicles' },
  { id: 'lifting', label: 'Lifting Gear' },
  { id: 'portable_appliance', label: 'PAT Equipment' },
];

const METHODS = [
  { id: 'straight_line', label: 'Straight-Line' },
  { id: 'reducing_balance', label: 'Reducing Balance' },
  { id: 'units_of_production', label: 'Units of Production' },
];

export default function DepreciationProfileManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | profile object
  const [form, setForm] = useState(blankForm());

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['depreciation-profiles'],
    queryFn: async () => {
      const r = await base44.entities.DepreciationProfile.list('-created_date', 100);
      return r.data || r || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (id) await base44.entities.DepreciationProfile.update(id, data);
      else await base44.entities.DepreciationProfile.create(data);
    },
    onSuccess: () => {
      toast({ title: '✓ Profile saved' });
      queryClient.invalidateQueries({ queryKey: ['depreciation-profiles'] });
      setEditing(null);
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => base44.entities.DepreciationProfile.delete(id),
    onSuccess: () => {
      toast({ title: 'Profile deleted' });
      queryClient.invalidateQueries({ queryKey: ['depreciation-profiles'] });
    },
  });

  const recalcMutation = useMutation({
    mutationFn: async () => base44.functions.invoke('recalculateDepreciation', {}),
    onSuccess: (res) => {
      const d = res.data || res;
      toast({ title: `✓ Recalculated ${d.assets_processed || 0} assets` });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-lifecycle'] });
    },
  });

  const startEdit = (profile) => {
    setEditing(profile);
    setForm(profile ? { ...blankForm(), ...profile } : blankForm());
  };

  const handleSave = () => {
    if (!form.name || !form.asset_type || !form.method) {
      toast({ title: 'Name, asset type and method are required', variant: 'destructive' });
      return;
    }
    const payload = {
      name: form.name,
      asset_type: form.asset_type,
      method: form.method,
      useful_life_years: Number(form.useful_life_years) || null,
      salvage_percentage: Number(form.salvage_percentage) || 0,
      depreciation_rate: form.method === 'reducing_balance' ? Number(form.depreciation_rate) || null : null,
      units_label: form.method === 'units_of_production' ? form.units_label || 'hours' : null,
      is_default: !!form.is_default,
      description: form.description || '',
    };
    saveMutation.mutate({ id: editing?.id, data: payload });
  };

  const byType = (type) => profiles.filter(p => p.asset_type === type);

  return (
    <div>
      <SettingsSectionHeader
        icon={Settings2}
        title="Depreciation Profiles"
        description="Configure default depreciation rules per asset type. New assets auto-inherit the matching profile — override per-asset on the detail page."
      />

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <p className="text-xs text-slate-500">
          {profiles.length} profile{profiles.length !== 1 ? 's' : ''} configured
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => recalcMutation.mutate()}
            disabled={recalcMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
          >
            {recalcMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingDown className="w-4 h-4" />}
            Recalculate All
          </button>
          <button
            onClick={() => startEdit('new')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#244715] transition"
          >
            <Plus className="w-4 h-4" /> New Profile
          </button>
        </div>
      </div>

      {/* Profile cards by asset type */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ASSET_TYPES.map(at => {
            const typeProfiles = byType(at.id);
            return (
              <div key={at.id} className="hub-glass rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-800">{at.label}</h4>
                  <span className="text-[10px] text-slate-400">{typeProfiles.length} profile{typeProfiles.length !== 1 ? 's' : ''}</span>
                </div>
                {typeProfiles.length === 0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">No profile — assets use straight-line defaults.</p>
                ) : (
                  <div className="space-y-2">
                    {typeProfiles.map(p => {
                      const meta = METHOD_META[p.method];
                      return (
                        <div key={p.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50/50">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                                {p.is_default && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                    <Check className="w-2.5 h-2.5" /> DEFAULT
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">{meta.label}</p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => startEdit(p)} className="p-1 rounded hover:bg-white transition">
                                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                              </button>
                              <button onClick={() => deleteMutation.mutate(p.id)} className="p-1 rounded hover:bg-white transition">
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500">
                            {p.useful_life_years && <span>{p.useful_life_years}yr life</span>}
                            <span>{p.salvage_percentage || 0}% salvage</span>
                            {p.method === 'reducing_balance' && p.depreciation_rate && <span>{p.depreciation_rate}% rate</span>}
                            {p.method === 'units_of_production' && <span>per {p.units_label || 'unit'}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit/Create modal */}
      {editing && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">
                {editing === 'new' ? 'New Depreciation Profile' : 'Edit Profile'}
              </h3>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <FieldInput label="Profile Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Rig Default" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Asset Type</label>
                  <select value={form.asset_type} onChange={e => setForm({ ...form, asset_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="">Select…</option>
                    {ASSET_TYPES.map(at => <option key={at.id} value={at.id}>{at.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Method</label>
                  <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldInput label="Useful Life (years)" type="number" value={form.useful_life_years} onChange={v => setForm({ ...form, useful_life_years: v })} />
                <FieldInput label="Salvage (% of cost)" type="number" value={form.salvage_percentage} onChange={v => setForm({ ...form, salvage_percentage: v })} />
              </div>
              {form.method === 'reducing_balance' && (
                <FieldInput label="Depreciation Rate (% per year)" type="number" value={form.depreciation_rate} onChange={v => setForm({ ...form, depreciation_rate: v })} placeholder="e.g. 25" />
              )}
              {form.method === 'units_of_production' && (
                <FieldInput label="Unit Label" value={form.units_label} onChange={v => setForm({ ...form, units_label: v })} placeholder="e.g. hours, metres, cycles" />
              )}
              <FieldInput label="Description (optional)" value={form.description} onChange={v => setForm({ ...form, description: v })} />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!form.is_default} onChange={e => setForm({ ...form, is_default: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
                <span className="text-sm text-slate-700">Set as default for this asset type</span>
              </label>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saveMutation.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#244715] transition disabled:opacity-50">
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
                </button>
                <button onClick={() => setEditing(null)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function blankForm() {
  return {
    name: '', asset_type: '', method: 'straight_line',
    useful_life_years: '', salvage_percentage: 0, depreciation_rate: '',
    units_label: 'hours', is_default: false, description: '',
  };
}

function FieldInput({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
    </div>
  );
}