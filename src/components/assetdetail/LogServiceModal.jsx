import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { X, Wrench, ShieldCheck, ClipboardCheck, Plug, Loader2, Save, FileText, Package, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ConsumableUsageModal from '@/components/assetcommand/ConsumableUsageModal';

const RECORD_TYPES = [
  { value: 'loler_inspection', label: 'LOLER Inspection', icon: ShieldCheck },
  { value: 'puwer_inspection', label: 'PUWER Inspection', icon: ClipboardCheck },
  { value: 'pat_inspection', label: 'PAT Test', icon: Plug },
  { value: 'service', label: 'Service', icon: Wrench },
  { value: 'repair', label: 'Repair', icon: Wrench },
  { value: 'calibration', label: 'Calibration', icon: ClipboardCheck },
  { value: 'pre_use_check', label: 'Pre-use Check', icon: ClipboardCheck },
  { value: 'other', label: 'Other', icon: FileText },
];

const RESULTS = [
  { value: 'pass', label: 'Pass' },
  { value: 'fail', label: 'Fail' },
  { value: 'advisory', label: 'Advisory' },
  { value: 'n/a', label: 'N/A' },
];

/**
 * Quick Log Service modal — creates a ServiceRecord from the asset detail
 * page's quick-action bar. For full service logging with certificate upload,
 * use the Service tab's built-in form.
 */
export default function LogServiceModal({ asset, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    record_type: 'service',
    date: format(new Date(), 'yyyy-MM-dd'),
    result: 'pass',
    tested_by: '',
    notes: '',
    hours_reading: '',
  });
  const [saving, setSaving] = useState(false);
  const [savedRecordId, setSavedRecordId] = useState(null);
  const [showConsumable, setShowConsumable] = useState(false);

  const showHours = asset?.asset_type === 'rig' || asset?.asset_type === 'machinery';

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload = {
        site_asset_id: asset.id,
        record_type: form.record_type,
        date: form.date,
        result: form.result,
        tested_by: form.tested_by || 'Manager',
        notes: form.notes,
      };

      if (form.hours_reading) {
        payload.hours_reading = Number(form.hours_reading);
      }

      const created = await base44.entities.ServiceRecord.create(payload);
      setSavedRecordId(created.id);

      // Recalculate usage/maintenance if hours were logged
      if (form.hours_reading) {
        try {
          await base44.functions.invoke('recalculateUsageMaintenance', { asset_id: asset.id });
        } catch (e) { console.error('Usage recalc error:', e); }
      }

      queryClient.invalidateQueries({ queryKey: ['service-records', asset.id] });
      queryClient.invalidateQueries({ queryKey: ['asset-detail', asset.id] });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });

      toast({ title: 'Service logged', description: `${RECORD_TYPES.find(t => t.value === form.record_type)?.label} recorded for ${asset.name}.` });
    } catch (err) {
      console.error('Log service error:', err);
      toast({ title: 'Error', description: 'Could not log service. Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-blue-950/60 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto animate-pop-in">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" /> Log Service
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-2 block">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {RECORD_TYPES.map(t => {
                const Icon = t.icon;
                const active = form.record_type === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => setForm(f => ({ ...f, record_type: t.value }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition ${
                      active ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date + Result */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Result</label>
              <select
                value={form.result}
                onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary bg-white"
              >
                {RESULTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          {/* Tested by */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tested / Performed By</label>
            <input
              type="text"
              value={form.tested_by}
              onChange={e => setForm(f => ({ ...f, tested_by: e.target.value }))}
              placeholder="Name or company"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </div>

          {/* Hours reading (rigs/machinery only) */}
          {showHours && (
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Hours Reading (engine hours)</label>
              <input
                type="number"
                value={form.hours_reading}
                onChange={e => setForm(f => ({ ...f, hours_reading: e.target.value }))}
                placeholder="e.g. 1250"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Service details, findings, recommendations..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
          {savedRecordId ? (
            <>
              <button
                onClick={() => setShowConsumable(true)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold hover:bg-emerald-100 transition flex items-center justify-center gap-2"
              >
                <Package className="w-4 h-4" /> Add Consumables
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-[#244715] transition flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Done
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-[#244715] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Log Service'}
              </button>
            </>
          )}
        </div>
      </div>
      {showConsumable && savedRecordId && (
        <ConsumableUsageModal
          presetServiceRecordId={savedRecordId}
          onClose={() => setShowConsumable(false)}
          onUsed={() => queryClient.invalidateQueries({ queryKey: ['service-records', asset.id] })}
        />
      )}
    </div>
  );
}