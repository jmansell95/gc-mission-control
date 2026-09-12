import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Clock, Mail, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Schedule modal — set cadence (weekly/monthly/quarterly), recipients, and
 * optional message for a saved report template. Persists to ReportTemplate
 * and the scheduled automation picks it up.
 */
export default function ReportScheduleModal({ template, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cadence, setCadence] = useState(template?.schedule_cadence || 'weekly');
  const [recipients, setRecipients] = useState(template?.schedule_recipients || '');
  const [message, setMessage] = useState(template?.schedule_message || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!recipients.trim()) {
      toast({ title: 'Recipients required', description: 'Enter at least one email address.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.ReportTemplate.update(template.id, {
        schedule_cadence: cadence,
        schedule_recipients: recipients,
        schedule_message: message,
      });
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      toast({ title: 'Schedule saved', description: `"${template.name}" will be emailed ${cadence}.` });
      onClose();
    } catch (e) {
      toast({ title: 'Error', description: 'Could not save schedule.', variant: 'destructive' });
    }
    setSaving(false);
  };

  if (!template) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-pop-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Schedule Report</h2>
              <p className="text-xs text-slate-500">{template.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Cadence</label>
            <div className="flex bg-slate-100 rounded-xl p-0.5">
              {['weekly', 'monthly', 'quarterly'].map(c => (
                <button key={c} onClick={() => setCadence(c)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold capitalize transition ${cadence === c ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Recipients (comma-separated)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={recipients} onChange={e => setRecipients(e.target.value)}
                placeholder="reports@groundcontrol.co.uk, manager@…"
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-emerald-100 outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1.5">Message (optional)</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              placeholder="A note included in the scheduled email…"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-emerald-100 outline-none resize-none" />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />} Save Schedule
          </button>
        </div>
      </div>
    </div>
  );
}