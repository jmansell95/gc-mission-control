import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Ruler, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * RigMeterageModal — quick-action modal for the Rigs on Site widget.
 * Lets the admin pick a rig with a rota assignment today and log metres
 * drilled against that assignment. Saves to RotaAssignment.meterage.
 */
export default function RigMeterageModal({ rigs = [], onClose }) {
  const { toast } = useToast();
  const eligibleRigs = rigs.filter(r => r.firstAssignment);
  const [selectedRigId, setSelectedRigId] = useState(eligibleRigs[0]?.rigId || '');
  const [metres, setMetres] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const rig = eligibleRigs.find(r => r.rigId === selectedRigId);
    if (!rig?.firstAssignment) {
      toast({ title: 'No assignment found for this rig', variant: 'destructive' });
      return;
    }
    const m = parseFloat(metres);
    if (isNaN(m) || m < 0) {
      toast({ title: 'Enter a valid metreage', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.RotaAssignment.update(rig.firstAssignment.id, { meterage: m });
      toast({ title: `Logged ${m}m on ${rig.rig?.name || 'rig'}` });
      onClose();
    } catch (err) {
      toast({ title: 'Failed to save meterage', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(8,23,48,0.96)', backdropFilter: 'blur(8px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 animate-pop-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#2E5A1A] flex items-center justify-center">
              <Ruler className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Log Meterage</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        {eligibleRigs.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No rig assignments available to log meterage against today.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Rig</label>
              <select value={selectedRigId} onChange={e => setSelectedRigId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30">
                {eligibleRigs.map(r => (
                  <option key={r.rigId} value={r.rigId}>{r.rig?.name || 'Unknown'} — {r.job?.name || 'No job'}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Metres drilled</label>
              <input type="number" step="0.1" value={metres} onChange={e => setMetres(e.target.value)} placeholder="e.g. 12.5"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30" />
            </div>
            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#244715] disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ruler className="w-4 h-4" />}
              Save Meterage
            </button>
          </div>
        )}
      </div>
    </div>
  );
}