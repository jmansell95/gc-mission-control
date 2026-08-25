import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { ClipboardCheck, Plus, Trash2, GripVertical, Save, Loader2, Info } from 'lucide-react';

/**
 * DailyChecklistManager — Settings page for managing daily pre-work
 * checklist templates per crew type.
 *
 * Stores checklist items in a ConfigList (key: 'daily_checklists') where each
 * option represents a crew type with a nested 'items' array of checklist items.
 */
export default function DailyChecklistManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(null);

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['config-list', 'daily_checklists'],
    queryFn: () => base44.entities.ConfigList.filter({ key: 'daily_checklists' }),
  });

  const existing = configs[0];

  // Local editable state
  const [crewTypes, setCrewTypes] = useState([]);
  const [initialized, setInitialized] = useState(false);

  React.useEffect(() => {
    if (existing && !initialized) {
      setCrewTypes(existing.options || []);
      setInitialized(true);
    }
  }, [existing, initialized]);

  const handleAddCrewType = () => {
    setCrewTypes(prev => [...prev, {
      value: `crew_${Date.now()}`,
      label: 'New Crew Type',
      items: [
        { id: 'vehicle_walkround', label: 'Vehicle walk-round check', required: true, photo_required: false },
        { id: 'plant_power', label: 'Plant / power equipment check', required: true, photo_required: false },
        { id: 'ppe', label: 'PPE inspected and worn', required: true, photo_required: false },
        { id: 'mitti_completed', label: 'All checks completed in Mitti', required: true, photo_required: false },
      ],
    }]);
  };

  const handleAddItem = (crewIndex) => {
    setCrewTypes(prev => prev.map((ct, i) => {
      if (i !== crewIndex) return ct;
      return {
        ...ct,
        items: [...(ct.items || []), { id: `item_${Date.now()}`, label: 'New check item', required: true, photo_required: false }],
      };
    }));
  };

  const handleRemoveItem = (crewIndex, itemIndex) => {
    setCrewTypes(prev => prev.map((ct, i) => {
      if (i !== crewIndex) return ct;
      return { ...ct, items: ct.items.filter((_, j) => j !== itemIndex) };
    }));
  };

  const handleRemoveCrewType = (crewIndex) => {
    setCrewTypes(prev => prev.filter((_, i) => i !== crewIndex));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        key: 'daily_checklists',
        label: 'Daily Pre-Work Checklists',
        category: 'Compliance',
        options: crewTypes.map(ct => ({
          value: ct.value,
          label: ct.label,
          items: ct.items || [],
        })),
        is_system: true,
      };

      if (existing?.id) {
        await base44.entities.ConfigList.update(existing.id, payload);
      } else {
        await base44.entities.ConfigList.create(payload);
      }

      queryClient.invalidateQueries({ queryKey: ['config-list', 'daily_checklists'] });
      toast({ title: 'Daily checklists saved', description: 'Crew will see these checks before starting their shift.' });
      setEditing(false);
    } catch (err) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <SettingsSectionHeader
        icon={ClipboardCheck}
        title="Daily Pre-Work Checklists"
        description="Configure the checklist crew complete before starting each shift — managed per crew type"
        actions={
          !editing ? (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold transition active:scale-95 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Edit Checklists
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold transition active:scale-95 shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          )
        }
      />

      {/* Mitti info banner */}
      <div className="insight-card rounded-2xl p-4 mb-4 bg-indigo-50/60 border-indigo-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">How it works with Mitti</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Crew complete their actual vehicle, plant and safety checks in the Mitti app.
              They then come back to this app and tick each item to confirm completion.
              The shift is blocked until all required items are confirmed.
            </p>
          </div>
        </div>
      </div>

      {/* Crew type checklists */}
      <div className="space-y-4">
        {crewTypes.length === 0 && !editing && (
          <div className="insight-card rounded-2xl p-8 text-center">
            <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500">No checklists configured</p>
            <p className="text-xs text-slate-400 mt-1">Click "Edit Checklists" to create your first template.</p>
          </div>
        )}

        {crewTypes.map((ct, crewIndex) => (
          <div key={crewIndex} className="insight-card rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-100/80 flex items-center justify-between gap-2">
              {editing ? (
                <input
                  type="text"
                  value={ct.label}
                  onChange={e => setCrewTypes(prev => prev.map((c, i) => i === crewIndex ? { ...c, label: e.target.value } : c))}
                  className="flex-1 px-3 py-1.5 text-sm font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E5A1A]"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-[#2E5A1A]" />
                  <h3 className="text-sm font-bold text-slate-700">{ct.label}</h3>
                  <span className="text-[10px] text-slate-400">({ct.items?.length || 0} items)</span>
                </div>
              )}
              {editing && (
                <button
                  onClick={() => handleRemoveCrewType(crewIndex)}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="divide-y divide-slate-50">
              {(ct.items || []).map((item, itemIndex) => (
                <div key={itemIndex} className="px-4 py-2.5 flex items-center gap-2.5">
                  {editing && <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                  {editing ? (
                    <>
                      <input
                        type="text"
                        value={item.label}
                        onChange={e => setCrewTypes(prev => prev.map((c, i) => {
                          if (i !== crewIndex) return c;
                          return { ...c, items: c.items.map((it, j) => j === itemIndex ? { ...it, label: e.target.value } : it) };
                        }))}
                        className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E5A1A]"
                      />
                      <label className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={item.required !== false}
                          onChange={e => setCrewTypes(prev => prev.map((c, i) => {
                            if (i !== crewIndex) return c;
                            return { ...c, items: c.items.map((it, j) => j === itemIndex ? { ...it, required: e.target.checked } : it) };
                          }))}
                        />
                        Required
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-500 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={!!item.photo_required}
                          onChange={e => setCrewTypes(prev => prev.map((c, i) => {
                            if (i !== crewIndex) return c;
                            return { ...c, items: c.items.map((it, j) => j === itemIndex ? { ...it, photo_required: e.target.checked } : it) };
                          }))}
                        />
                        Photo
                      </label>
                      <button
                        onClick={() => handleRemoveItem(crewIndex, itemIndex)}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded transition flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className={`w-5 h-5 rounded ${item.required !== false ? 'bg-rose-50 border border-rose-200' : 'bg-slate-100 border border-slate-200'} flex-shrink-0`} />
                      <span className="text-sm text-slate-700 flex-1">{item.label}</span>
                      {item.required !== false && <span className="text-[9px] font-bold text-rose-500 px-1.5 py-0.5 rounded-full bg-rose-50">REQUIRED</span>}
                      {item.photo_required && <span className="text-[9px] font-bold text-blue-500 px-1.5 py-0.5 rounded-full bg-blue-50">PHOTO</span>}
                    </>
                  )}
                </div>
              ))}
              {editing && (
                <button
                  onClick={() => handleAddItem(crewIndex)}
                  className="w-full px-4 py-2 text-xs font-semibold text-[#2E5A1A] hover:bg-[#2E5A1A]/5 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add check item
                </button>
              )}
            </div>
          </div>
        ))}

        {editing && (
          <button
            onClick={handleAddCrewType}
            className="w-full insight-card rounded-2xl p-4 text-sm font-semibold text-slate-500 hover:text-[#2E5A1A] hover:border-[#2E5A1A]/20 transition flex items-center justify-center gap-2 border-dashed"
          >
            <Plus className="w-4 h-4" /> Add Crew Type Template
          </button>
        )}
      </div>
    </div>
  );
}