import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import Modal from '@/components/ui/modal';
import { PoundSterling, Loader2, Check, Info, TrendingUp, Database } from 'lucide-react';

/**
 * Redesigned Set Rates popup — uses the shared Modal component.
 *
 * Shows each crew member with avatar, name, job title, a large rate input,
 * and a live cost-price preview (70% of day rate). An info panel explains
 * that the data is saved to the Master Price List as a 'Personal Day Rate'
 * RateCardItem linked to the staff member, which drives labour costs across
 * jobs and financials.
 *
 * Also checks for existing rates so re-opening shows current values for
 * editing rather than creating duplicates.
 */
export default function BulkRateEntryModal({ staff, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rates, setRates] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(0);

  // Fetch existing personal day rates so we can pre-fill and update rather than duplicate
  const staffIds = staff.map(s => s.id);
  const { data: existingRates = [] } = useQuery({
    queryKey: ['rate-cards-personal-bulk', staffIds.sort().join(',')],
    queryFn: () => base44.entities.RateCardItem.filter({ category: 'labour', subcategory: 'Personal Day Rate' }, null, 500),
    enabled: staffIds.length > 0,
  });

  const existingRateMap = {};
  existingRates.forEach(r => {
    if (r.staff_id && staffIds.includes(r.staff_id)) {
      existingRateMap[r.staff_id] = r;
    }
  });

  // Pre-fill rates from existing records (or empty)
  useEffect(() => {
    const obj = {};
    staff.forEach(s => {
      obj[s.id] = existingRateMap[s.id]?.price || '';
    });
    setRates(obj);
  }, [staff, existingRates.length]);

  const handleSave = async () => {
    const toUpsert = staff
      .filter(s => rates[s.id] && !isNaN(parseFloat(rates[s.id])))
      .map(s => {
        const price = parseFloat(rates[s.id]);
        const existing = existingRateMap[s.id];
        return {
          id: existing?.id, // include ID for update, omit for create
          category: 'labour',
          subcategory: 'Personal Day Rate',
          description: `${s.name} — Day Rate`,
          price,
          cost_price: price * 0.7,
          unit: 'day',
          men: 1,
          staff_id: s.id,
          is_active: true,
        };
      });

    if (toUpsert.length === 0) {
      toast({ title: 'No rates entered', variant: 'destructive' });
      return;
    }

    setSaving(true);
    setDone(0);
    try {
      const toCreate = toUpsert.filter(r => !r.id);
      const toUpdate = toUpsert.filter(r => r.id);

      // Create new ones in batches of 20
      for (let i = 0; i < toCreate.length; i += 20) {
        const batch = toCreate.slice(i, i + 20);
        await base44.entities.RateCardItem.bulkCreate(batch);
        setDone(Math.min(i + 20, toCreate.length));
      }

      // Update existing ones
      for (const r of toUpdate) {
        const { id, ...data } = r;
        await base44.entities.RateCardItem.update(id, data);
        setDone(prev => prev + 1);
      }

      queryClient.invalidateQueries({ queryKey: ['rate-cards-personal'] });
      queryClient.invalidateQueries({ queryKey: ['rate-cards-personal-bulk'] });

      toast({
        title: `${toUpsert.length} day rates saved`,
        description: 'Labour costs will now calculate correctly across jobs and financials.',
      });
      onClose();
    } catch (err) {
      toast({ title: 'Failed to save rates', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filledCount = Object.values(rates).filter(v => v && !isNaN(parseFloat(v))).length;
  const totalCostPreview = staff.reduce((sum, s) => {
    const r = parseFloat(rates[s.id]);
    return sum + (isNaN(r) ? 0 : r * 0.7);
  }, 0);
  const totalRatePreview = staff.reduce((sum, s) => {
    const r = parseFloat(rates[s.id]);
    return sum + (isNaN(r) ? 0 : r);
  }, 0);

  return (
    <Modal
      open
      onClose={onClose}
      title="Set Personal Day Rates"
      description={`${staff.length} crew ${staff.length === 1 ? 'member' : 'members'} ${Object.keys(existingRateMap).length > 0 ? 'to review' : 'need a rate'}`}
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {filledCount} of {staff.length} filled
            {done > 0 && <span className="text-emerald-600 ml-1.5">· {done} saved</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || filledCount === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-sm font-bold transition active:scale-95 shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Rates'}
            </button>
          </div>
        </div>
      }
    >
      {/* Info panel — explains where the data goes */}
      <div className="hub-glass rounded-2xl p-4 mb-4 bg-blue-50/60 border-blue-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">Where does this data go?</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Each rate is saved to the <span className="font-semibold">Master Price List</span> as a
              <span className="font-semibold"> Personal Day Rate</span> RateCardItem linked to the crew member.
              This drives <span className="font-semibold">labour cost calculations</span> across all jobs
              and financial reports. The cost price is auto-set to 70% of the day rate.
            </p>
          </div>
        </div>
      </div>

      {/* Live totals preview */}
      {filledCount > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="hub-glass rounded-2xl p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-[#2E5A1A]" />
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Total Day Rate</p>
            </div>
            <p className="text-xl font-extrabold text-slate-900 tabular-nums">
              £{totalRatePreview.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="hub-glass rounded-2xl p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <PoundSterling className="w-4 h-4 text-blue-600" />
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Total Cost Price (70%)</p>
            </div>
            <p className="text-xl font-extrabold text-blue-700 tabular-nums">
              £{totalCostPreview.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      )}

      {/* Staff rate inputs */}
      <div className="space-y-2.5">
        {staff.map(s => {
          const rate = parseFloat(rates[s.id]);
          const costPrice = isNaN(rate) ? 0 : rate * 0.7;
          const hasExisting = !!existingRateMap[s.id];
          const initials = (s.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

          return (
            <div key={s.id} className="hub-glass rounded-2xl p-3.5 flex items-center gap-3">
              {/* Avatar */}
              <div className="flex-shrink-0 w-11 h-11 rounded-full bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center text-white font-bold text-sm shadow-sm overflow-hidden">
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt={s.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  initials
                )}
              </div>

              {/* Name + title */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900 truncate">{s.name}</p>
                  {hasExisting && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-bold flex-shrink-0">
                      <Check className="w-2.5 h-2.5" /> EXISTS
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate">{s.job_title || s.worker_type || 'Staff'}</p>
                {!isNaN(rate) && rate > 0 && (
                  <p className="text-[10px] text-blue-600 font-medium mt-0.5">
                    Cost: £{costPrice.toLocaleString('en-GB', { maximumFractionDigits: 2 })}/day
                  </p>
                )}
              </div>

              {/* Rate input */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">£</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={rates[s.id] || ''}
                    onChange={e => setRates(prev => ({ ...prev, [s.id]: e.target.value }))}
                    className="w-28 pl-7 pr-3 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 bg-white"
                  />
                </div>
                <span className="text-xs text-slate-400 font-medium w-8">/day</span>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}