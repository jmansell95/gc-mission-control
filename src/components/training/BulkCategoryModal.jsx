import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Check, Loader2, Tag, Search, Users, Plus, Minus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * BulkCategoryModal — multi-staff category assignment modal.
 *
 * Two modes:
 *  - preselectedStaffIds provided: shows category toggles only, with
 *    "Assign" and "Remove" buttons that add/remove categories from all
 *    pre-selected staff (used from the checkbox bulk action bar).
 *  - no preselectedStaffIds: shows a staff multi-select list on the left
 *    AND category toggles on the right, with "Assign" and "Remove" buttons
 *    (used from the "Manage Categories" button next to the team dropdown).
 */
export default function BulkCategoryModal({ preselectedStaffIds, staff, categories, onClose }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [selectedCatIds, setSelectedCatIds] = useState([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState(preselectedStaffIds || []);
  const [staffSearch, setStaffSearch] = useState('');

  const hasPreselected = !!(preselectedStaffIds && preselectedStaffIds.length > 0);

  const filteredStaff = useMemo(() => {
    if (hasPreselected) return [];
    const q = staffSearch.trim().toLowerCase();
    return staff
      .filter(s => s.is_active !== false)
      .filter(s => !q || (s.name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [staff, staffSearch, hasPreselected]);

  const toggleCat = (id) => {
    setSelectedCatIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleStaff = (id) => {
    setSelectedStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const targetIds = hasPreselected ? preselectedStaffIds : selectedStaffIds;

  const apply = async (mode) => {
    if (targetIds.length === 0) {
      toast({ title: 'No staff selected', variant: 'destructive' });
      return;
    }
    if (selectedCatIds.length === 0) {
      toast({ title: 'No categories selected', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Build per-staff updates: for each target staff, compute the new
      // training_category_ids array (union for assign, diff for remove).
      const updates = [];
      for (const sid of targetIds) {
        const s = staff.find(x => x.id === sid);
        if (!s) continue;
        const current = s.training_category_ids || [];
        let next;
        if (mode === 'assign') {
          next = [...new Set([...current, ...selectedCatIds])];
        } else {
          next = current.filter(id => !selectedCatIds.includes(id));
        }
        // Only update if something actually changed
        if (next.length !== current.length || next.some(id => !current.includes(id))) {
          updates.push({ id: sid, training_category_ids: next });
        }
      }

      if (updates.length === 0) {
        toast({ title: 'No changes needed', description: 'Selected staff already have these categories.' });
        onClose();
        return;
      }

      await base44.entities.Staff.bulkUpdate(updates);
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['staff-page-hub'] });
      toast({
        title: mode === 'assign' ? 'Categories assigned' : 'Categories removed',
        description: `${updates.length} staff member${updates.length !== 1 ? 's' : ''} updated.`,
      });
      onClose();
    } catch (e) {
      toast({ title: 'Could not update', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Manage Training Categories</h3>
              <p className="text-xs text-slate-500">
                {hasPreselected
                  ? `${targetIds.length} staff selected`
                  : `${selectedStaffIds.length} staff selected · ${selectedCatIds.length} categories`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Staff selection — only when no preselected IDs */}
          {!hasPreselected && (
            <div>
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Select Staff
              </h4>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={staffSearch}
                  onChange={e => setStaffSearch(e.target.value)}
                  placeholder="Search staff…"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <div className="border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
                {filteredStaff.map(s => {
                  const selected = selectedStaffIds.includes(s.id);
                  const assignedCount = (s.training_category_ids || []).length;
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleStaff(s.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left border-b border-slate-50 transition last:border-b-0 ${
                        selected ? 'bg-primary/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                        selected ? 'bg-primary border-primary' : 'border-slate-300'
                      }`}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">{s.name}</p>
                        <p className="text-[10px] text-slate-400">{assignedCount} categor{assignedCount === 1 ? 'y' : 'ies'}</p>
                      </div>
                    </button>
                  );
                })}
                {filteredStaff.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">No staff found.</p>
                )}
              </div>
            </div>
          )}

          {/* Category toggles */}
          <div className={hasPreselected ? 'sm:col-span-2' : ''}>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Categories</h4>
            <div className="flex flex-wrap gap-2 border border-slate-200 rounded-xl p-3 max-h-64 overflow-y-auto">
              {categories.map(cat => {
                const active = selectedCatIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleCat(cat.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    {cat.short_code}
                    <span className="font-normal opacity-70">{cat.label}</span>
                  </button>
                );
              })}
              {categories.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4 w-full">No training categories defined.</p>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={() => apply('assign')}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Assign to {targetIds.length || 'Selected'}
          </button>
          <button
            onClick={() => apply('remove')}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-sm font-semibold hover:bg-rose-100 disabled:opacity-50 transition border border-rose-200"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
            Remove from {targetIds.length || 'Selected'}
          </button>
        </div>
      </div>
    </div>
  );
}