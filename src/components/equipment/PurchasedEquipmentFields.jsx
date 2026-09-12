import React, { useMemo, useState } from 'react';
import { Upload, FileText, X, Package, Loader2, Receipt, Tag, AlertCircle, Sparkles, Wand2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { inputCls, fmt } from './shared';
import { extractDocumentData, ORDER_SLIP_SCHEMA, matchSupplierByName } from '@/utils/documentExtraction';

export default function PurchasedEquipmentFields({ form, setForm, suppliers = [], rateCardItems = [] }) {
  const [orderSlipFile, setOrderSlipFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedFields, setExtractedFields] = useState(null);
  const [uploadError, setUploadError] = useState(false);

  // Materials from our company rate card — useful for purchased consumables
  const materialRateItems = (rateCardItems || []).filter(
    (i) => i.is_active !== false && i.rate_card_source === 'our_company' && i.category === 'materials'
  );

  // Group by subcategory
  const rateCardGroups = useMemo(() => {
    const groups = {};
    materialRateItems.forEach((item) => {
      const key = item.subcategory || 'Materials';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, items]) => ({ label, items: items.sort((a, b) => (a.description || '').localeCompare(b.description || '')) }));
  }, [materialRateItems]);

  const pickFromRateCard = (id) => {
    if (!id) return;
    const item = (rateCardItems || []).find((r) => r.id === id);
    if (!item) return;
    setForm({
      ...form,
      description: item.description || form.description,
      unit_cost: String(item.price ?? ''),
      unit_label: item.unit || 'each',
      rate_card_item_id: item.id,
      is_poa: item.price == null,
      notes: item.notes || form.notes,
    });
  };

  const applyExtracted = (data) => {
    const updates = {};
    const found = [];
    if (data?.po_number && !form.po_number?.trim()) { updates.po_number = data.po_number; found.push('PO number'); }
    if (data?.description && !form.description?.trim()) { updates.description = data.description; found.push('description'); }
    if (data?.unit_cost != null && (!form.unit_cost || Number(form.unit_cost) === 0)) { updates.unit_cost = String(data.unit_cost); found.push('unit cost'); }
    if (data?.quantity != null && (!form.quantity || Number(form.quantity) <= 1)) { updates.quantity = String(data.quantity); found.push('quantity'); }
    if (data?.reference_number && !form.reference_number?.trim()) { updates.reference_number = data.reference_number; found.push('reference'); }
    if (data?.supplier_name && !form.supplier_id) {
      const matchedId = matchSupplierByName(data.supplier_name, suppliers);
      if (matchedId) { updates.supplier_id = matchedId; found.push('supplier'); }
    }
    if (Object.keys(updates).length > 0) {
      setForm({ ...form, ...updates });
      setExtractedFields(found);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    setOrderSlipFile(file);
    setUploadError(false);
    setExtractedFields(null);
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      const fileUrl = res.file_url;
      setForm({ ...form, order_slip_url: fileUrl, order_slip_name: file.name });
      // Auto-extract data from the uploaded document
      setExtracting(true);
      try {
        const extracted = await extractDocumentData(fileUrl, ORDER_SLIP_SCHEMA);
        if (extracted) applyExtracted(extracted);
      } catch { /* extraction is best-effort */ }
      setExtracting(false);
    } catch (err) {
      console.error(err);
      setUploadError(true);
      setOrderSlipFile(null);
    }
    setUploading(false);
  };

  const lineTotal = (Number(form.unit_cost) || 0) * (Number(form.quantity) || 1);
  const hasPO = !!form.po_number?.trim();
  const hasSlip = !!form.order_slip_url;
  const hasCost = !!form.unit_cost && Number(form.unit_cost) > 0;

  return (
    <div className="space-y-3">
      {/* Quick-pick from Master Price List (Materials) */}
      {rateCardGroups.length > 0 && (
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
            <Tag className="w-3 h-3 text-purple-600" /> Quick-pick from Master Price List (Materials)
          </label>
          <select value="" onChange={(e) => { pickFromRateCard(e.target.value); e.target.value = ''; }} className={inputCls}>
            <option value="">Auto-fill from rate card…</option>
            {rateCardGroups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.description} · {r.price != null ? fmt(r.price) : r.price_text || 'POA'}{r.unit ? `/${r.unit}` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">What are you purchasing? *</label>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Coreliner, HDPE pipe" className={inputCls} />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Supplier (optional)</label>
        <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className={inputCls}>
          <option value="">Select supplier…</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div>
        <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
          <Package className="w-3 h-3 text-emerald-700" /> PO Number *
          {!hasPO && <span className="text-red-400 ml-1">required</span>}
        </label>
        <input value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} placeholder="e.g. PO-1042" className={`${inputCls} font-mono ${!hasPO ? 'border-amber-300' : ''}`} />
      </div>

      <div>
        <label className="flex items-center gap-1 text-xs font-medium text-slate-600 mb-1">
          <Upload className="w-3 h-3 text-emerald-700" /> Order Slip / Purchase Document *
          {!hasSlip && <span className="text-red-400 ml-1">required</span>}
        </label>
        {form.order_slip_url && !orderSlipFile && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200 mb-2">
            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
            <a href={form.order_slip_url} target="_blank" rel="noopener noreferrer" className="hover:underline font-medium truncate">{form.order_slip_name || 'View order slip'}</a>
            <button type="button" onClick={() => setForm({ ...form, order_slip_url: '', order_slip_name: '' })} className="ml-auto text-slate-400 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {!form.order_slip_url && (
          <input type="file" accept=".pdf,image/*,.doc,.docx,.xlsx,.xls" onChange={(e) => handleFile(e.target.files[0])} className={`block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium hover:file:bg-emerald-100 cursor-pointer ${!hasSlip ? 'border border-amber-300 rounded-lg p-1' : ''}`} />
        )}
        {orderSlipFile && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200 mt-1.5">
            {uploading || extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" /> : <FileText className="w-3.5 h-3.5 flex-shrink-0" />}
            <span className="truncate">{orderSlipFile.name}</span>
            {extracting && <span className="ml-auto inline-flex items-center gap-1 text-purple-600 font-medium"><Wand2 className="w-3 h-3" /> Extracting…</span>}
          </div>
        )}
        {extractedFields && extractedFields.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-purple-700 bg-purple-50 rounded-md px-3 py-2 border border-purple-200 mt-1.5">
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Auto-filled from document: <strong>{extractedFields.join(', ')}</strong></span>
          </div>
        )}
        {uploadError && <p className="text-[10px] text-red-500 mt-1">Upload failed. Please try again.</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Unit cost (net) *</label>
          <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} placeholder="0.00" className={`${inputCls} ${!hasCost ? 'border-amber-300' : ''}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
          <select value={form.unit_label} onChange={(e) => setForm({ ...form, unit_label: e.target.value })} className={inputCls}>
            <option value="each">each</option>
            <option value="day">per day</option>
            <option value="m">per metre</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Quantity</label>
          <input type="number" min="0" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Reference Number</label>
          <input value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} placeholder="Asset tag / serial no." className={inputCls} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
        <input type="checkbox" checked={form.vat_exempt} onChange={(e) => setForm({ ...form, vat_exempt: e.target.checked })} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />
        VAT exempt (zero-rated item)
      </label>

      {form.is_poa && (
        <div className="text-xs text-amber-800 bg-amber-50 rounded-md px-3 py-2 border border-amber-200 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> Price on Application — this rate card item has no fixed price. Confirm the agreed price later from the Pending Pricing panel.
        </div>
      )}

      {form.rate_card_item_id && (
        <div className="text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-200 flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> Linked to a Master Price List item.
        </div>
      )}

      {Number(form.unit_cost) > 0 && (
        <div className="text-xs text-slate-600 bg-white rounded-md px-3 py-2 border border-slate-200 flex items-center justify-between">
          <span>Line total: {Number(form.quantity) || 1} × {fmt(Number(form.unit_cost) || 0)}</span>
          <span className="font-bold text-slate-900">{fmt(lineTotal)}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows="2" placeholder="Any special notes about this item" className={inputCls} />
      </div>
    </div>
  );
}