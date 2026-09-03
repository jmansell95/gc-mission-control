import React, { useState, useMemo } from 'react';
import { FlaskConical, Plus, Send, CheckCircle2, Clock, AlertTriangle, Trash2, Edit2, Truck, Package, ClipboardCheck, User } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import SampleFormModal from '@/components/geotech/SampleFormModal';

const SAMPLE_TYPES = [
  { value: 'disturbed', label: 'Disturbed (Bag)' },
  { value: 'undisturbed_u100', label: 'U100 Tube' },
  { value: 'undisturbed_ut100', label: 'UT100 Tube' },
  { value: 'spt_split_spoon', label: 'SPT Split Spoon' },
  { value: 'rotary_core', label: 'Rotary Core' },
  { value: 'window_sample', label: 'Window Sample' },
  { value: 'bulk_sample', label: 'Bulk Sample' },
  { value: 'water_sample', label: 'Water Sample' },
  { value: 'gas_sample', label: 'Gas Sample' },
  { value: 'hand_excavated', label: 'Hand Excavated' },
];

const STATUS_DARK = {
  collected: { label: 'Collected', ring: '#00D4FF', icon: Package },
  dispatched: { label: 'Dispatched', ring: '#3B82F6', icon: Send },
  received_at_lab: { label: 'At Lab', ring: '#6366F1', icon: CheckCircle2 },
  testing: { label: 'Testing', ring: '#FFC300', icon: Clock },
  results_returned: { label: 'Results Back', ring: '#2EFF7D', icon: CheckCircle2 },
  retained: { label: 'Retained', ring: '#A78BFA', icon: Package },
  disposed: { label: 'Disposed', ring: '#94A3B8', icon: Trash2 },
};

function StatusPill({ status }) {
  const meta = STATUS_DARK[status] || STATUS_DARK.collected;
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
      style={{ backgroundColor: `${meta.ring}1a`, color: meta.ring, border: `1px solid ${meta.ring}40` }}
    >
      <Icon className="w-2.5 h-2.5" /> {meta.label}
    </span>
  );
}

export default function BoreholeSampleDrawer({
  boreholeRef,
  samples,
  allStaff,
  suppliers,
  job,
  scheduledSampleIds,
  sampleDeliveryStatus,
  onAdvanceStatus,
  onEdit,
  onDelete,
  onRegister,
  onScheduleCollection,
  onClose,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingSample, setEditingSample] = useState(null);

  // Sort by depth_from ascending (null depths at the end)
  const sorted = [...samples].sort((a, b) => {
    if (a.depth_from == null && b.depth_from == null) return 0;
    if (a.depth_from == null) return 1;
    if (b.depth_from == null) return -1;
    return a.depth_from - b.depth_from;
  });

  // Group samples by driller within this borehole. Each sample may have
  // collected_by_crew_names (full crew array) or collected_by_name (single).
  // We attribute the sample to each crew member listed, so a sample
  // collected by a 2-man crew appears under both drillers. Samples with no
  // collector attribution are grouped under "Unattributed".
  const drillerGroups = useMemo(() => {
    const groups = new Map();
    for (const s of sorted) {
      const names = Array.isArray(s.collected_by_crew_names) && s.collected_by_crew_names.length > 0
        ? s.collected_by_crew_names
        : (s.collected_by_name ? [s.collected_by_name] : []);
      const keys = names.length > 0 ? names : ['__unattributed__'];
      for (const key of keys) {
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(s);
      }
    }
    // Sort: unattributed last, otherwise alphabetical
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === '__unattributed__') return 1;
      if (b === '__unattributed__') return -1;
      return a.localeCompare(b);
    });
  }, [sorted]);

  const labs = suppliers?.filter(s => s.name?.match(/lab|geol|soil|test|analy/i)) || [];

  const eligibleCount = samples.filter(s => s.status === 'collected' && !scheduledSampleIds.has(s.sample_id)).length;

  const handleSave = async (formData) => {
    await onRegister(formData);
    setShowForm(false);
    setEditingSample(null);
  };

  return (
    <>
      <Sheet open onOpenChange={onClose}>
        <SheetContent side="right" className="bg-[#121411] border-[#2a3a2a] text-[#E0E0E0] max-w-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2.5 text-[#E0E0E0]">
              <div className="w-8 h-8 rounded-lg bg-[#1C201C] border border-[#2a3a2a] flex items-center justify-center">
                <FlaskConical className="w-4 h-4 text-[#2EFF7D]" />
              </div>
              <span className="font-mono">{boreholeRef}</span>
              <span className="text-sm font-normal text-[#A0A0A0]">{samples.length} sample{samples.length !== 1 ? 's' : ''}</span>
            </SheetTitle>
            <SheetDescription className="text-[#A0A0A0]">
              Sample chain of custody for this borehole, sorted by depth.
            </SheetDescription>
          </SheetHeader>

          <div className="flex items-center gap-2 mt-4 mb-4">
            {eligibleCount > 0 && (
              <button
                onClick={() => onScheduleCollection(samples)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#FF9F1C] text-[#1a1a1a] rounded-lg text-xs font-semibold hover:brightness-110 transition"
              >
                <Truck className="w-3.5 h-3.5" /> Schedule Collection ({eligibleCount})
              </button>
            )}
            <button
              onClick={() => { setEditingSample(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1C201C] border border-[#2a3a2a] text-[#E0E0E0] rounded-lg text-xs font-semibold hover:border-[#FF9F1C]/50 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Sample
            </button>
          </div>

          <div className="space-y-4">
            {sorted.length === 0 ? (
              <div className="text-center py-8">
                <FlaskConical className="w-8 h-8 text-[#2a3a2a] mx-auto mb-2" />
                <p className="text-sm text-[#A0A0A0]">No samples for this borehole yet.</p>
              </div>
            ) : (
              drillerGroups.map(([drillerKey, groupSamples]) => {
                const isUnattributed = drillerKey === '__unattributed__';
                return (
                  <div key={drillerKey}>
                    {/* Driller sub-header */}
                    <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-[#2a3a2a]/60">
                      <div className="w-6 h-6 rounded-full bg-[#1C201C] border border-[#2a3a2a] flex items-center justify-center">
                        <User className="w-3 h-3 text-[#2EFF7D]" />
                      </div>
                      <span className="text-xs font-semibold text-[#E0E0E0]">
                        {isUnattributed ? 'Unattributed' : drillerKey}
                      </span>
                      <span className="text-[10px] text-[#5a6a5a]">{groupSamples.length} sample{groupSamples.length !== 1 ? 's' : ''}</span>
                    </div>
                    {/* Samples for this driller */}
                    <div className="space-y-2 ml-2">
                      {groupSamples.map(s => {
                        const collector = allStaff.find(st => st.id === s.collected_by_staff_id);
                        const lab = suppliers.find(sup => sup.id === s.lab_id);
                        const dStatus = sampleDeliveryStatus.get(s.sample_id);
                        const collectionDone = dStatus?.collection === 'completed';
                        const deliveryDone = dStatus?.delivery === 'completed';
                        const inTransit = dStatus?.collection === 'in_progress' || dStatus?.delivery === 'in_progress';
                        return (
                          <div key={`${drillerKey}-${s.id}`} className="bg-[#1C201C] border border-[#2a3a2a] rounded-xl p-3 hover:border-[#3a4a3a] transition">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm font-semibold text-[#E0E0E0]">{s.sample_id}</span>
                                  <StatusPill status={s.status} />
                                  {s.status === 'collected' && !scheduledSampleIds.has(s.sample_id) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                      style={{ backgroundColor: '#FFC3001a', color: '#FFC300', border: '1px solid #FFC30040' }}>
                                      <Clock className="w-2.5 h-2.5" /> Needs Collection
                                    </span>
                                  )}
                                  {scheduledSampleIds.has(s.sample_id) && (() => {
                                    const cls = deliveryDone ? { ring: '#2EFF7D' } : collectionDone ? { ring: '#00D4FF' } : inTransit ? { ring: '#3B82F6' } : { ring: '#14B8A6' };
                                    const Icon = deliveryDone ? CheckCircle2 : collectionDone ? CheckCircle2 : inTransit ? Clock : ClipboardCheck;
                                    const label = [dStatus?.collection && `Collect ${dStatus.collection}`, dStatus?.delivery && `Lab ${dStatus.delivery}`].filter(Boolean).join(' · ');
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                        style={{ backgroundColor: `${cls.ring}1a`, color: cls.ring, border: `1px solid ${cls.ring}40` }}>
                                        <Icon className="w-2.5 h-2.5" /> {label || 'Scheduled'}
                                      </span>
                                    );
                                  })()}
                                  {s.lab_receipt_condition && ['compromised', 'leaked', 'broken'].includes(s.lab_receipt_condition) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                                      style={{ backgroundColor: '#F43F5E1a', color: '#F43F5E', border: '1px solid #F43F5E40' }}>
                                      <AlertTriangle className="w-2.5 h-2.5" /> {s.lab_receipt_condition}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-[#A0A0A0] mt-1">
                                  {s.depth_from != null && <span>{s.depth_from}–{s.depth_to}m · </span>}
                                  {SAMPLE_TYPES.find(t => t.value === s.sample_type)?.label || s.sample_type}
                                  {lab && <span> · {lab.name}</span>}
                                  {collector && <span> · {collector.name}</span>}
                                </div>
                                {s.test_schedule?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {s.test_schedule.map(t => (
                                      <span key={t} className="px-1.5 py-0.5 bg-[#0B1A0B] text-[#8a9a8a] rounded text-[10px] font-mono">{t.replace(/_/g, ' ')}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {s.status === 'collected' && (
                                  <button onClick={() => onAdvanceStatus(s, 'dispatched')}
                                    className="px-2 py-1 rounded text-[10px] font-medium transition"
                                    style={{ backgroundColor: '#3B82F61a', color: '#3B82F6', border: '1px solid #3B82F640' }}>Dispatch</button>
                                )}
                                {s.status === 'dispatched' && (
                                  <button onClick={() => onAdvanceStatus(s, 'received_at_lab')}
                                    className="px-2 py-1 rounded text-[10px] font-medium transition"
                                    style={{ backgroundColor: '#6366F11a', color: '#6366F1', border: '1px solid #6366F140' }}>Received</button>
                                )}
                                {s.status === 'received_at_lab' && (
                                  <button onClick={() => onAdvanceStatus(s, 'testing')}
                                    className="px-2 py-1 rounded text-[10px] font-medium transition"
                                    style={{ backgroundColor: '#FFC3001a', color: '#FFC300', border: '1px solid #FFC30040' }}>Testing</button>
                                )}
                                {s.status === 'testing' && (
                                  <button onClick={() => onAdvanceStatus(s, 'results_returned')}
                                    className="px-2 py-1 rounded text-[10px] font-medium transition"
                                    style={{ backgroundColor: '#2EFF7D1a', color: '#2EFF7D', border: '1px solid #2EFF7D40' }}>Results</button>
                                )}
                                <button onClick={() => { setEditingSample(s); setShowForm(true); }}
                                  className="p-1 text-[#5a6a5a] hover:text-[#E0E0E0] transition"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => onDelete(s)}
                                  className="p-1 text-[#5a6a5a] hover:text-[#F43F5E] transition"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {showForm && (
        <SampleFormModal
          sample={editingSample}
          job={job}
          allStaff={allStaff}
          labs={labs}
          suppliers={suppliers}
          saving={false}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingSample(null); }}
          defaultBoreholeRef={boreholeRef}
        />
      )}
    </>
  );
}