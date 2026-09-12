import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, Check, Loader2, Tag } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * StaffCategoryPopup — compact popup that shows all training categories
 * as toggle chips for a single staff member. Toggling a chip immediately
 * adds/removes the category from the staff member's training_category_ids.
 */
export default function StaffCategoryPopup({ staff, categories, onClose }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [localIds, setLocalIds] = useState(staff.training_category_ids || []);

  const toggle = (reqId) => {
    setLocalIds(prev => prev.includes(reqId) ? prev.filter(id => id !== reqId) : [...prev, reqId]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Staff.update(staff.id, { training_category_ids: localIds });
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['staff-page-hub'] });
      toast({ title: 'Training categories updated', description: staff.name });
      onClose();
    } catch (e) {
      toast({ title: 'Could not update', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Tag className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Training Categories</h3>
              <p className="text-[11px] text-slate-500 truncate max-w-[200px]">{staff.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map(cat => {
            const active = localIds.includes(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => toggle(cat.id)}
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
            <p className="text-xs text-slate-400 text-center py-4 w-full">No training categories defined yet.</p>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-3">
          <span>{localIds.length} categor{localIds.length === 1 ? 'y' : 'ies'} assigned</span>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Categories
        </button>
      </div>
    </div>
  );
}