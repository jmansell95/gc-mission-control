import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, CheckCircle2, Square, Camera, Info, ExternalLink, Loader2, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import MittiSafetyPrompt from '@/components/staff/MittiSafetyPrompt';
import { useMittiCheckLinks } from '@/hooks/useMittiCheckLinks';

/**
 * DailyChecksStep — the pre-work checklist step of the ShiftWizard.
 *
 * Shows a configurable checklist (managed via ConfigList key 'daily_checklists')
 * with tick-boxes and optional photo evidence. Includes a prominent Mitti
 * hand-off banner telling crew to complete checks in Mitti first, then come
 * back here to confirm.
 *
 * The Continue button stays disabled until all required items are ticked.
 * On completion, the checklist state is saved to the RotaAssignment.
 */
export default function DailyChecksStep({ assignment, job, staff, onConfirm, saving }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [checkedItems, setCheckedItems] = useState({});
  const [photos, setPhotos] = useState({});
  const { vehicleCheckUrl } = useMittiCheckLinks();

  // Fetch the daily checklist config
  const { data: checklistConfig, isLoading } = useQuery({
    queryKey: ['config-list', 'daily_checklists'],
    queryFn: () => base44.entities.ConfigList.filter({ key: 'daily_checklists' }),
  });

  // Determine which checklist applies — based on the staff member's team/crew type
  const checklistItems = useMemo(() => {
    if (!checklistConfig || checklistConfig.length === 0) return [];
    const config = checklistConfig[0];
    const options = config.options || [];

    // Try to match by crew type / team
    const crewType = staff?.team_id || staff?.worker_type || 'default';
    const matched = options.find(o => o.value === crewType || o.value === 'default');
    if (matched?.items?.length) return matched.items;

    // Fall back to a flat list of all options as checklist items
    return options.map(o => ({
      id: o.value,
      label: o.label,
      required: o.critical !== false,
      photo_required: false,
    }));
  }, [checklistConfig, staff]);

  // Default checklist if no config exists
  const defaultItems = [
    { id: 'vehicle_walkround', label: 'Vehicle walk-round check (oil, tyres, lights, damage)', required: true, photo_required: false },
    { id: 'plant_power', label: 'Plant / power equipment check', required: true, photo_required: false },
    { id: 'ppe', label: 'PPE inspected and worn (hard hat, boots, hi-vis, gloves)', required: true, photo_required: false },
    { id: 'mitti_completed', label: 'All checks completed in Mitti', required: true, photo_required: false },
  ];

  const items = checklistItems.length > 0 ? checklistItems : defaultItems;
  const requiredItems = items.filter(i => i.required !== false);
  const allRequiredChecked = requiredItems.every(i => checkedItems[i.id]);

  const toggleItem = (id) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePhoto = (id, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotos(prev => ({ ...prev, [id]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const progress = requiredItems.length > 0 ? Math.round((requiredItems.filter(i => checkedItems[i.id]).length / requiredItems.length) * 100) : 0;

  if (isLoading) {
    return (
      <div className="px-5 py-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 px-5 py-2">
      {/* Vehicle check — the first and most important Mitti prompt.
          Framed as "before you leave for site" so crew do it at the yard,
          not after they arrive. */}
      <MittiSafetyPrompt type="vehicle" url={vehicleCheckUrl} />

      {/* Generic Mitti hand-off note for plant / PPE checks */}
      <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
        <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 leading-relaxed">
          Complete your plant, PPE and any remaining safety checks in Mitti too. Once you have finished there, come back here and tick each item below to confirm.
        </p>
      </div>

      {/* Progress bar */}
      <div className="insight-card rounded-2xl p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-[#2E5A1A]" />
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Daily Pre-Work Checks</p>
          </div>
          <span className="text-xs font-bold text-slate-600 tabular-nums">{progress}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#2E5A1A] to-[#8DC63F] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5">
          {checkedCount} of {items.length} confirmed · {requiredItems.length} required
        </p>
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {items.map(item => {
          const isChecked = !!checkedItems[item.id];
          const isRequired = item.required !== false;
          return (
            <div
              key={item.id}
              className={`insight-card rounded-2xl p-3.5 transition ${isChecked ? 'bg-emerald-50/40 border-emerald-200' : ''}`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleItem(item.id)}
                  className="flex-shrink-0 mt-0.5 active:scale-90 transition"
                >
                  {isChecked ? (
                    <CheckCircle2 className="w-6 h-6 text-[#2E5A1A]" />
                  ) : (
                    <Square className="w-6 h-6 text-slate-300 hover:text-slate-400" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${isChecked ? 'text-[#2E5A1A]' : 'text-slate-800'}`}>
                      {item.label}
                    </p>
                    {isRequired && (
                      <span className="text-[9px] font-bold text-rose-500 px-1.5 py-0.5 rounded-full bg-rose-50 flex-shrink-0">
                        REQUIRED
                      </span>
                    )}
                  </div>
                  {item.photo_required && (
                    <div className="mt-2">
                      {photos[item.id] ? (
                        <div className="relative inline-block">
                          <img src={photos[item.id]} alt="Evidence" className="w-20 h-20 rounded-lg object-cover border border-slate-200" />
                          <button
                            onClick={() => setPhotos(prev => { const n = { ...prev }; delete n[item.id]; return n; })}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-bold"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer hover:bg-slate-200 transition">
                          <Camera className="w-3.5 h-3.5" />
                          Add photo
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={e => handlePhoto(item.id, e.target.files?.[0])}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hidden confirm signal for the wizard footer */}
      <input type="hidden" id="daily-checks-complete" value={allRequiredChecked ? '1' : '0'} />
    </div>
  );
}