import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  X, Weight, Search, Save, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Boxes, Database,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Bulk weight entry modal — groups assets by their Asset Panda group label
 * (falling back to asset type, then "Ungrouped") so managers can quickly fill
 * in weight_kg values across the whole inventory. Changes are tracked locally
 * and committed in a single bulk update.
 *
 * Props: assets (array), onClose
 */
export default function BulkWeightModal({ assets, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [weights, setWeights] = useState(() => {
    // Pre-fill with current weight values
    const map = {};
    assets.forEach(a => { if (a.weight_kg != null) map[a.id] = String(a.weight_kg); });
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [collapsed, setCollapsed] = useState({});

  // Group assets by panda_group_label, falling back to asset_type, then "Ungrouped"
  const groups = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = q
      ? assets.filter(a => (a.name || '').toLowerCase().includes(q) || (a.serial_number || '').toLowerCase().includes(q) || (a.fleet_number || '').toLowerCase().includes(q))
      : assets;

    const grouped = {};
    filtered.forEach(a => {
      const key = a.panda_group_label || (a.asset_type ? `Type: ${a.asset_type}` : 'Ungrouped');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a);
    });

    // Sort groups: named groups first (alpha), then Ungrouped last
    return Object.entries(grouped)
      .sort(([a], [b]) => {
        if (a === 'Ungrouped') return 1;
        if (b === 'Ungrouped') return -1;
        return a.localeCompare(b);
      })
      .map(([key, items]) => ({ key, items }));
  }, [assets, search]);

  // Count how many have weights vs missing
  const stats = useMemo(() => {
    let withWeight = 0, missing = 0, changed = 0;
    assets.forEach(a => {
      const val = weights[a.id];
      if (val != null && val !== '' && !isNaN(Number(val))) {
        withWeight++;
        if (Number(val) !== (a.weight_kg || 0)) changed++;
      } else {
        missing++;
      }
    });
    return { withWeight, missing, changed };
  }, [assets, weights]);

  const handleWeightChange = (id, value) => {
    setWeights(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    // Collect only changed weights
    const updates = [];
    assets.forEach(a => {
      const val = weights[a.id];
      if (val == null || val === '') return;
      const numVal = Number(val);
      if (isNaN(numVal) || numVal < 0) return;
      if (numVal === (a.weight_kg || 0)) return; // no change
      updates.push({ id: a.id, weight_kg: numVal });
    });

    if (updates.length === 0) {
      toast({ title: 'No changes to save' });
      return;
    }

    setSaving(true);
    try {
      // Bulk update — up to 500 per call
      await base44.entities.SiteAsset.bulkUpdate(
        updates.map(u => ({ id: u.id, weight_kg: u.weight_kg }))
      );
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      toast({
        title: 'Weights saved',
        description: `${updates.length} asset${updates.length !== 1 ? 's' : ''} updated.`,
      });
      onClose();
    } catch (e) {
      toast({ title: 'Save failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const toggleGroup = (key) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 pt-8 sm:pt-4">
      <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-2xl z-10 border-b border-slate-200 px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
              <Weight className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate">Bulk Weight Entry</h3>
              <p className="text-[11px] text-slate-400 truncate">
                {stats.withWeight} with weight · {stats.missing} missing · {stats.changed} changed
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition flex-shrink-0">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Stats banner */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> {stats.withWeight} weighted
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <AlertTriangle className="w-4 h-4" /> {stats.missing} missing
          </div>
          {stats.changed > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
              <Save className="w-3.5 h-3.5" /> {stats.changed} to save
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, serial, or fleet number..."
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Grouped list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
          {groups.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-400">No assets match your search.</div>
          ) : (
            <div className="space-y-3">
              {groups.map(group => {
                const isCollapsed = collapsed[group.key];
                const groupHasWeight = group.items.filter(a => {
                  const v = weights[a.id];
                  return v != null && v !== '' && !isNaN(Number(v));
                }).length;
                const groupMissing = group.items.length - groupHasWeight;
                const isPandaGroup = !group.key.startsWith('Type:') && group.key !== 'Ungrouped';
                return (
                  <div key={group.key} className="border border-slate-200 rounded-xl overflow-hidden">
                    {/* Group header */}
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {isPandaGroup ? (
                          <Database className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        ) : (
                          <Boxes className="w-4 h-4 text-slate-500 flex-shrink-0" />
                        )}
                        <span className="text-sm font-bold text-slate-800 truncate">{group.key}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">({group.items.length})</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {groupMissing > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            {groupMissing} missing
                          </span>
                        )}
                        {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>
                    {/* Items */}
                    {!isCollapsed && (
                      <div className="divide-y divide-slate-100">
                        {group.items.map(a => {
                          const val = weights[a.id] ?? '';
                          const hasWeight = val !== '' && !isNaN(Number(val));
                          return (
                            <div key={a.id} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50/50">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">{a.name}</p>
                                <p className="text-[11px] text-slate-400 font-mono truncate">
                                  {a.fleet_number ? `FAA ${a.fleet_number}` : a.serial_number || ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <Weight className="w-3.5 h-3.5 text-slate-400" />
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={val}
                                  onChange={e => handleWeightChange(a.id, e.target.value)}
                                  placeholder="—"
                                  className={`w-20 px-2 py-1.5 border rounded-lg text-sm text-right tabular-nums focus:outline-none focus:ring-1 ${
                                    hasWeight
                                      ? 'border-slate-200 focus:border-emerald-500 text-slate-700'
                                      : 'border-amber-300 bg-amber-50/50 focus:border-amber-500 text-amber-700'
                                  }`}
                                />
                                <span className="text-xs text-slate-400 font-medium w-6">kg</span>
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
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between gap-3 bg-white rounded-b-2xl">
          <p className="text-xs text-slate-500">
            Weights are used for vehicle payload checks during sign-out.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-semibold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || stats.changed === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#244715] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : `Save ${stats.changed > 0 ? `(${stats.changed})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}