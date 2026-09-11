import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Camera, Loader2, CheckCircle2, PoundSterling, Fuel, Coffee, Package, Wrench, Car, Receipt, Send } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';
import ConcurReminderBanner from '@/components/staff/ConcurReminderBanner';

const CATEGORY_META = {
  fuel: { label: 'Fuel', icon: Fuel, bg: 'bg-amber-50 border-amber-300', text: 'text-amber-700' },
  subsistence: { label: 'Subsistence', icon: Coffee, bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700' },
  materials: { label: 'Materials', icon: Package, bg: 'bg-blue-50 border-blue-300', text: 'text-blue-700' },
  equipment_hire: { label: 'Equipment Hire', icon: Wrench, bg: 'bg-violet-50 border-violet-300', text: 'text-violet-700' },
  tolls_parking: { label: 'Tolls & Parking', icon: Car, bg: 'bg-rose-50 border-rose-300', text: 'text-rose-700' },
  travel: { label: 'Travel', icon: Car, bg: 'bg-cyan-50 border-cyan-300', text: 'text-cyan-700' },
  misc: { label: 'Other', icon: Receipt, bg: 'bg-slate-50 border-slate-300', text: 'text-slate-700' },
};

/**
 * ReceiptCaptureModal — standalone receipt capture (photo + category + amount)
 * launched from the field dashboard quick action. Saves a DailyCost record
 * auto-linked to today's timesheet by staff_id + date.
 */
export default function ReceiptCaptureModal({ open, onClose, staff, assignment, job }) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState('misc');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      setReceiptUrl(file_url);
    } catch (e) {
      console.error('Receipt upload failed:', e);
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!staff?.id || !amount || parseFloat(amount) <= 0) return;
    setSaving(true);
    const amt = parseFloat(amount);
    const vatRate = 20;
    const vat = Math.round(amt * (vatRate / 100) * 100) / 100;
    try {
      await base44.entities.DailyCost.create({
        job_id: job?.id || assignment?.job_id || '',
        assignment_id: assignment?.id || '',
        staff_id: staff.id,
        staff_name: staff.name || '',
        date: todayStr,
        week_start: weekStart,
        category,
        description: description || CATEGORY_META[category]?.label || 'Expense',
        amount_net: Math.round(amt * 100) / 100,
        amount_vat: vat,
        amount_gross: Math.round((amt + vat) * 100) / 100,
        vat_rate: vatRate,
        receipt_url: receiptUrl || '',
        status: 'submitted',
      });
      queryClient.invalidateQueries({ queryKey: ['my-week-costs'] });
      queryClient.invalidateQueries({ queryKey: ['daily-costs'] });
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setCategory('misc'); setAmount(''); setDescription(''); setReceiptUrl('');
        onClose();
      }, 1200);
    } catch (e) {
      console.error('Expense save failed:', e);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slide-up"
      >
        {/* Header */}
        <div className="hero-gradient px-5 py-4 text-white sticky top-0 z-10 sm:rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 ring-1 ring-white/20 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">Upload Receipt</h2>
                <p className="text-white/70 text-xs">Auto-linked to today's timesheet</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {done ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-slate-900">Receipt saved!</p>
              <p className="text-sm text-slate-500 mt-1">Your expense is linked to today's timesheet.</p>
            </div>
          ) : (
            <>
              {/* Receipt photo */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Receipt Photo</label>
                {receiptUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-300">
                    <img src={receiptUrl} alt="Receipt" className="w-full max-h-48 object-cover" />
                    <button onClick={() => setReceiptUrl('')} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white">
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-emerald-500 text-white px-2.5 py-1 rounded-full text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Captured
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:border-[#2E5A1A] hover:bg-[#2E5A1A]/5 transition">
                    {uploading ? (
                      <Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-7 h-7 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-500">Tap to photograph receipt</span>
                      </>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }} />
                  </label>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Category</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(CATEGORY_META).map(([key, m]) => (
                    <button key={key} type="button" onClick={() => setCategory(key)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition active:scale-95 ${category === key ? `${m.bg} border-2` : 'bg-white border-slate-200 text-slate-500'}`}>
                      <m.icon className={`w-4 h-4 ${category === key ? m.text : 'text-slate-400'}`} />
                      <span className="text-[9px] font-bold text-center leading-tight">{m.label.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Amount (£)</label>
                <div className="relative">
                  <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="0.00" autoFocus
                    className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Description (optional)</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What was it for?"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10" />
              </div>

              <ConcurReminderBanner compact />

              <button onClick={handleSave} disabled={!amount || parseFloat(amount) <= 0 || saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 command-gradient text-white rounded-2xl text-sm font-bold active:scale-95 transition disabled:opacity-50 touch-manipulation">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Receipt'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}