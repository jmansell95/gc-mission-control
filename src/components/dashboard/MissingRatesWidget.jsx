import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { PoundSterling, AlertTriangle, Loader2, ArrowRight, UserX, Check, X } from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

// Normalise text for matching: lowercase, strip punctuation, collapse spaces.
function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Light stemmer to collapse "driller"↔"drilling", "groundworker"↔"groundworks".
function stem(t) {
  let s = t;
  for (const suf of ['ing', 'ed', 'er', 'es', 's']) {
    if (s.length > suf.length + 2 && s.endsWith(suf)) {
      const st = s.slice(0, -suf.length);
      if (st.length >= 3) return st;
    }
  }
  return s;
}

function tokens(s) {
  return norm(s).split(' ').filter(t => t.length >= 3).map(stem).filter(t => t.length >= 3);
}

// Check if a staff member's job title matches a labour rate card description.
// Returns true if a reasonable match is found.
function matchesRateCard(jobTitle, rateDescriptions) {
  if (!jobTitle) return false;
  const titleTokens = new Set(tokens(jobTitle));
  if (titleTokens.size === 0) return false;
  for (const desc of rateDescriptions) {
    const descTokens = new Set(tokens(desc));
    if (descTokens.size === 0) continue;
    let hits = 0;
    for (const t of titleTokens) {
      if (descTokens.has(t)) hits++;
    }
    // If most of the title's words appear in the rate description, it's a match.
    if (hits >= 1 && hits / titleTokens.size >= 0.5) return true;
  }
  return false;
}

export default function MissingRatesWidget() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [missing, setMissing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState(null); // staff id being added
  const [rateForm, setRateForm] = useState({ price: '', cost_price: '', unit: 'day' });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const [staff, rateItems] = await Promise.all([
        base44.entities.Staff.list('-created_date', 500),
        base44.entities.RateCardItem.filter({ category: 'labour', is_active: true }, '-sort_order', 500),
      ]);

      // Build a set of staff IDs that have a personal rate card entry.
      const staffWithPersonalRate = new Set(
        rateItems.filter(r => r.staff_id).map(r => r.staff_id)
      );

      // Build a list of labour rate card descriptions for job-title matching.
      const labourDescriptions = rateItems
        .filter(r => !r.staff_id && r.price != null)
        .map(r => r.description);

      // Find active staff with no personal rate and no job-title match.
      const missingStaff = staff
        .filter(s => s.is_active !== false)
        .filter(s => {
          if (staffWithPersonalRate.has(s.id)) return false;
          if (matchesRateCard(s.job_title, labourDescriptions)) return false;
          return true;
        })
        .map(s => ({
          id: s.id,
          name: s.name,
          job_title: s.job_title || 'No job title set',
          team_id: s.team_id,
        }));

      setMissing(missingStaff);
    } catch (e) {
      console.error('MissingRatesWidget error:', e);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const count = missing.length;

  const handleQuickAdd = async (staffMember) => {
    setSaving(true);
    try {
      const price = parseFloat(rateForm.price);
      if (!price || isNaN(price)) {
        toast({ title: 'Enter a day rate', description: 'The charge-out day rate is required.', variant: 'destructive' });
        setSaving(false);
        return;
      }
      await base44.entities.RateCardItem.create({
        category: 'labour',
        subcategory: 'Personal Day Rates',
        description: staffMember.job_title !== 'No job title set'
          ? `${staffMember.job_title} — ${staffMember.name}`
          : staffMember.name,
        price: price,
        cost_price: rateForm.cost_price ? parseFloat(rateForm.cost_price) : null,
        unit: rateForm.unit || 'day',
        men: 1,
        rate_card_source: 'our_company',
        staff_id: staffMember.id,
        is_active: true,
      });
      toast({ title: 'Day rate added', description: `${staffMember.name} now has a personal day rate of £${price.toFixed(2)}/day.` });
      setAddingId(null);
      setRateForm({ price: '', cost_price: '', unit: 'day' });
      await loadData();
    } catch (e) {
      toast({ title: 'Failed to add rate', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <WidgetShell
      icon={PoundSterling}
      title="Missing Day Rates"
      subtitle={count === 0 ? 'All crew have rate card entries' : `${count} crew member${count === 1 ? '' : 's'} with no day rate`}
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
        </div>
      ) : count === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
            <PoundSterling className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-sm font-semibold text-slate-700">All crew priced</p>
          <p className="text-xs text-slate-400 mt-0.5">Every active staff member matches a labour rate card entry.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              These crew members have no matching labour rate card entry. Their labour costs show as £0 in job financials. Click "Add Rate" to create a personal day rate.
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {missing.map(s => (
              <div key={s.id} className="rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2.5 px-2.5 py-2">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <UserX className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-700 truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{s.job_title}</p>
                  </div>
                  <button
                    onClick={() => setAddingId(addingId === s.id ? null : s.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-semibold hover:bg-emerald-700 transition flex-shrink-0"
                  >
                    {addingId === s.id ? <X className="w-3 h-3" /> : <PoundSterling className="w-3 h-3" />}
                    {addingId === s.id ? 'Cancel' : 'Add Rate'}
                  </button>
                </div>
                {addingId === s.id && (
                  <div className="px-2.5 pb-2.5 pt-1 border-t border-slate-100 mt-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Day Rate (£) <span className="text-rose-500">*</span></label>
                        <input
                          type="number"
                          step="0.01"
                          value={rateForm.price}
                          onChange={e => setRateForm({ ...rateForm, price: e.target.value })}
                          placeholder="250.00"
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-0.5">Cost Price (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={rateForm.cost_price}
                          onChange={e => setRateForm({ ...rateForm, cost_price: e.target.value })}
                          placeholder="180.00"
                          className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleQuickAdd(s)}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Save Personal Day Rate
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/admin?tab=settings&section=rate-cards')}
            className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition"
          >
            <PoundSterling className="w-4 h-4" /> Manage All Rate Cards <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </WidgetShell>
  );
}