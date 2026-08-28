import React, { useMemo, useState } from 'react';
import { Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { categoryConfig } from './equipment/shared';
import HiredEquipmentFields from './equipment/HiredEquipmentFields';
import PurchasedEquipmentFields from './equipment/PurchasedEquipmentFields';
import OwnedEquipmentFields from './equipment/OwnedEquipmentFields';
import LabourFields from './equipment/LabourFields';
import NoCostFields from './equipment/NoCostFields';
import ReviewStep from './equipment/ReviewStep';

export default function EquipmentForm({ form, setForm, onSubmit, onCancel, saving = false, editing = false, suppliers = [], contractors = [], clients = [], defaultDates = null, catalogueItems = [], rateCardItems = [], ownedAssets = [], staff = [] }) {
  const [step, setStep] = useState(editing ? 2 : 1);

  const isContractorSupplied = form.category === 'contractor_supplied';
  const isClientSupplied = form.category === 'client_supplied';
  const isPurchased = form.category === 'purchased_equipment';
  const isInternal = form.category === 'internal_equipment';
  const isHired = form.category === 'hired_equipment';
  const isLabour = form.category === 'labour';
  const isNoCost = isContractorSupplied || isClientSupplied;

  const totalSteps = 3;

  const stepValid = useMemo(() => {
    if (step === 1) return true;
    if (step === 2) {
      if (!form.description?.trim()) return false;
      if (isContractorSupplied && !form.contractor_id) return false;
      if (isClientSupplied && !form.client_id) return false;
      // POA rate-card items can be saved with no unit cost — price confirmed later
      const isPOA = !!form.rate_card_item_id && !form.unit_cost;
      if (isHired && (!form.supplier_id || (!form.unit_cost && !isPOA))) return false;
      if (isPurchased && (!form.po_number?.trim() || (!form.unit_cost && !isPOA) || !form.order_slip_url)) return false;
      if (isInternal && !form.unit_cost && !isPOA) return false;
      if (isLabour && (!form.staff_id || (!form.unit_cost && !isPOA))) return false;
      return true;
    }
    // Step 3 (review) — if "already on site" is checked, a signature is required
    if (step === 3 && form.already_on_site && !form.on_site_signature) return false;
    return true;
  }, [step, form]);

  const submit = () => {
    if (!form.description?.trim()) return;
    if (form.already_on_site && !form.on_site_signature) return;
    let payload = { ...form };
    if (isNoCost) {
      payload = { ...payload, unit_cost: 0, supplier_id: '', contractor_id: isContractorSupplied ? form.contractor_id : '', client_id: isClientSupplied ? form.client_id : '', vat_exempt: false, order_slip_url: '', order_slip_name: '' };
    } else {
      payload = { ...payload, contractor_id: '', client_id: '' };
    }
    if (isPurchased) {
      payload = { ...payload, start_date: '', end_date: '' };
    }
    // For day-rate hired/owned/labour items, store effective quantity = items × days.
    // Rigs are excluded — they are unique serial-numbered assets with quantity
    // always 1; their billing is driven by the on-site date range downstream
    // (day_rate × working days), not by a multiplied quantity field. Without
    // this guard, every edit re-multiplies the quantity by the day count,
    // compounding exponentially (1 → 204 → 41616 → ...).
    const linkedAsset = form.site_asset_id ? (ownedAssets || []).find(a => a.id === form.site_asset_id) : null;
    const isRigAsset = linkedAsset?.asset_type === 'rig';
    if (!isRigAsset && (isHired || isInternal || isLabour) && form.unit_label === 'day' && form.start_date && form.end_date) {
      const d = differenceInCalendarDays(new Date(form.end_date + 'T00:00:00'), new Date(form.start_date + 'T00:00:00')) + 1;
      if (d > 0) {
        payload.quantity = String((Number(form.quantity) || 1) * d);
      }
    }
    onSubmit(payload);
  };

  const changeCategory = (v) => {
    setForm({
      ...form,
      category: v,
      unit_label: v === 'hired_equipment' || v === 'internal_equipment' || v === 'labour' ? 'day' : 'each',
      supplier_id: (v === 'internal_equipment' || v === 'labour' || v === 'contractor_supplied' || v === 'client_supplied') ? '' : form.supplier_id,
      contractor_id: v === 'contractor_supplied' ? form.contractor_id : '',
      client_id: v === 'client_supplied' ? form.client_id : '',
      unit_cost: (v === 'contractor_supplied' || v === 'client_supplied') ? 0 : form.unit_cost,
      rate_card_item_id: (v === 'contractor_supplied' || v === 'client_supplied') ? '' : form.rate_card_item_id,
      po_number: v === 'purchased_equipment' ? form.po_number : '',
      start_date: v === 'purchased_equipment' ? '' : form.start_date,
      end_date: v === 'purchased_equipment' ? '' : form.end_date,
      site_asset_id: v === 'internal_equipment' ? form.site_asset_id : '',
      staff_id: v === 'labour' ? form.staff_id : '',
    });
    // Auto-advance to the details step once a category is chosen
    setStep(2);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); e.stopPropagation(); }
  };

  const isLastStep = step >= totalSteps;

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">How is this item sourced? *</label>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(categoryConfig).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const active = form.category === key;
              const colorClasses = {
                amber: 'border-amber-400 bg-amber-50 text-amber-800',
                purple: 'border-purple-400 bg-purple-50 text-purple-800',
                blue: 'border-blue-400 bg-blue-50 text-blue-800',
                emerald: 'border-emerald-400 bg-emerald-50 text-emerald-800',
                indigo: 'border-indigo-400 bg-indigo-50 text-indigo-800',
                slate: 'border-slate-400 bg-slate-50 text-slate-800',
              };
              return (
                <button key={key} type="button" onClick={() => changeCategory(key)}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition ${active ? colorClasses[cfg.color] : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{cfg.label}</p>
                    <p className="text-xs text-slate-500">{cfg.desc}</p>
                  </div>
                  {active && <Check className="w-4 h-4 ml-auto flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    if (step === 2) {
      if (isHired) return <HiredEquipmentFields form={form} setForm={setForm} suppliers={suppliers} rateCardItems={rateCardItems} defaultDates={defaultDates} />;
      if (isPurchased) return <PurchasedEquipmentFields form={form} setForm={setForm} suppliers={suppliers} />;
      if (isInternal) return <OwnedEquipmentFields form={form} setForm={setForm} ownedAssets={ownedAssets} defaultDates={defaultDates} rateCardItems={rateCardItems} />;
      if (isLabour) return <LabourFields form={form} setForm={setForm} rateCardItems={rateCardItems} staff={staff} defaultDates={defaultDates} />;
      if (isNoCost) return <NoCostFields form={form} setForm={setForm} contractors={contractors} clients={clients} isContractor={isContractorSupplied} />;
    }
    if (step === 3) return <ReviewStep form={form} setForm={setForm} suppliers={suppliers} contractors={contractors} clients={clients} />;
    return null;
  };

  return (
    <div onKeyDown={handleKeyDown} className="space-y-4">
      <div className="flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const s = i + 1;
          const active = s === step;
          const done = s < step;
          return (
            <React.Fragment key={s}>
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition ${active ? 'bg-emerald-700 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              {i < totalSteps - 1 && <div className={`flex-1 h-0.5 rounded ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {renderStepContent()}

      <div className="flex gap-2 pt-1">
        {step > 1 && (
          <button type="button" onClick={() => setStep(step - 1)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition flex items-center gap-1.5">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        )}
        {!isLastStep ? (
          <button type="button" onClick={() => stepValid && setStep(step + 1)} disabled={!stepValid} className="flex-1 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition disabled:opacity-40 flex items-center justify-center gap-1.5">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={saving || !form.description?.trim() || (form.already_on_site && !form.on_site_signature)} className="flex-1 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition disabled:opacity-50 flex items-center justify-center">
            {saving ? 'Saving...' : editing ? 'Update item' : 'Add item'}
          </button>
        )}
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition">Cancel</button>
      </div>
    </div>
  );
}