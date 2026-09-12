import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ClipboardList, Search, Plus, Trash2, PoundSterling, Loader2, ShoppingBag, Upload, FileSpreadsheet,
} from 'lucide-react';

const fmt = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQty = (n) => (Math.round((n || 0) * 10) / 10).toLocaleString('en-GB');

/**
 * BOQWizardStep — the "shopping list" step in the job creation wizard.
 *
 * Builds a list of Bill of Quantities lines in wizard state (not persisted
 * until the job is created). Lets the user search the rate card, pick SOR
 * items, set qty + unit price, and see a live running contract-value total.
 *
 * On edit, pre-loaded lines (with `id`) are shown alongside new ones; removed
 * lines are reconciled by the parent on save.
 *
 * Props:
 *   boqLines: array   — wizard-state BOQ lines
 *   onChange: fn(lines) — update the wizard state
 */
export default function BOQWizardStep({ boqLines = [], onChange }) {
  const [search, setSearch] = useState('');
  const [selectedRateId, setSelectedRateId] = useState('');
  const [qty, setQty] = useState('');
  const [priceOverride, setPriceOverride] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Company rate card (no job/project exists yet in the wizard)
  const { data: rateItems = [], isLoading } = useQuery({
    queryKey: ['boq-wizard-rate-items'],
    queryFn: () => base44.entities.RateCardItem.filter({ rate_card_source: 'our_company', is_active: true }, 'sort_order', 500),
  });

  const filteredRates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rateItems.slice(0, 50);
    return rateItems.filter((r) =>
      r.description?.toLowerCase().includes(q) ||
      r.sor_ref?.toLowerCase().includes(q) ||
      r.subcategory?.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [rateItems, search]);

  const selected = rateItems.find((r) => r.id === selectedRateId);
  const unitPrice = priceOverride ? Number(priceOverride) : (selected?.price || 0);
  const lineTotal = (Number(qty) || 0) * unitPrice;

  const contractValue = useMemo(() =>
    boqLines.reduce((s, l) => s + (Number(l.agreed_line_total) || 0), 0),
  [boqLines]);

  const addLine = () => {
    if (!selected || !qty || Number(qty) <= 0) return;
    const newLine = {
      rate_card_item_id: selected.id,
      sor_ref: selected.sor_ref || '',
      description: selected.description,
      category: selected.category || 'labour',
      subcategory: selected.subcategory || '',
      unit: selected.unit || 'nr',
      agreed_quantity: Number(qty),
      agreed_unit_price: unitPrice,
      agreed_line_total: Math.round(lineTotal * 100) / 100,
      sort_order: boqLines.length,
    };
    onChange([...boqLines, newLine]);
    setSelectedRateId('');
    setQty('');
    setPriceOverride('');
  };

  const updateLine = (idx, patch) => {
    const next = boqLines.map((l, i) => {
      if (i !== idx) return l;
      const merged = { ...l, ...patch };
      merged.agreed_line_total = Math.round((Number(merged.agreed_quantity) || 0) * (Number(merged.agreed_unit_price) || 0) * 100) / 100;
      return merged;
    });
    onChange(next);
  };

  const removeLine = (idx) => {
    onChange(boqLines.filter((_, i) => i !== idx));
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            lines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sor_ref: { type: "string" },
                  description: { type: "string" },
                  unit: { type: "string" },
                  agreed_quantity: { type: "number" },
                  agreed_unit_price: { type: "number" },
                  category: { type: "string" },
                },
              },
            },
          },
        },
      });
      const extracted = result?.output?.lines || (Array.isArray(result?.output) ? result.output : []);
      const newLines = extracted
        .filter((l) => l.description || l.sor_ref)
        .map((l, i) => ({
          rate_card_item_id: '',
          sor_ref: l.sor_ref || '',
          description: l.description || '',
          category: l.category || 'labour',
          subcategory: '',
          unit: l.unit || 'nr',
          agreed_quantity: Number(l.agreed_quantity) || 0,
          agreed_unit_price: Number(l.agreed_unit_price) || 0,
          agreed_line_total: Math.round((Number(l.agreed_quantity) || 0) * (Number(l.agreed_unit_price) || 0) * 100) / 100,
          sort_order: boqLines.length + i,
        }));
      if (newLines.length > 0) {
        onChange([...boqLines, ...newLines]);
      }
    } catch (err) {
      console.error('BOQ import failed:', err);
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Intro / running total */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardList className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 leading-tight">Bill of Quantities</h3>
            <p className="text-[11px] text-slate-500 leading-tight">Contracted "shopping list" — pick SOR items and set agreed quantities.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/15">
          <PoundSterling className="w-3.5 h-3.5 text-primary" />
          <div>
            <p className="text-[9px] text-slate-500 uppercase font-semibold tracking-wide leading-none">Contract Value</p>
            <p className="text-sm font-bold text-primary tabular-nums leading-tight">{fmt(contractValue)}</p>
          </div>
        </div>
      </div>

      {/* Import from Excel */}
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImportExcel} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition disabled:opacity-50"
        >
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {importing ? 'Importing…' : 'Import from Excel'}
        </button>
        <span className="text-[11px] text-slate-400 flex items-center gap-1">
          <FileSpreadsheet className="w-3 h-3" /> Upload a BOQ spreadsheet to auto-fill line items
        </span>
      </div>

      {/* Rate card search + pick */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-slate-800">Add from Schedule of Rates</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rate card items by description, SOR ref or section…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg max-h-[160px] overflow-y-auto divide-y divide-slate-100 bg-white">
            {filteredRates.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { setSelectedRateId(r.id); setPriceOverride(''); }}
                className={`w-full text-left px-2.5 py-1.5 hover:bg-primary/5 transition ${selectedRateId === r.id ? 'bg-primary/10 border-l-4 border-primary' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold uppercase">
                    {r.category?.[0] || '•'}
                  </span>
                  <p className="text-xs font-medium text-slate-800 flex-1 truncate">{r.description}</p>
                  <span className="text-xs font-semibold text-slate-900">£{r.price}</span>
                  <span className="text-[10px] text-slate-400">/{r.unit}</span>
                </div>
                {r.subcategory && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{r.subcategory}</p>}
              </button>
            ))}
            {filteredRates.length === 0 && (
              <p className="text-center py-4 text-slate-400 text-xs">No rate items found</p>
            )}
          </div>
        )}

        {/* Selected item — qty + price */}
        {selected && (
          <div className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-2">
            <div className="text-[11px] text-slate-600">
              <span className="font-medium text-slate-800">{selected.description}</span>
              <span className="text-slate-400"> · {selected.subcategory || selected.category}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-medium block mb-0.5">Quantity</label>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="0"
                  autoFocus
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-medium block mb-0.5">Unit Price (£)</label>
                <input
                  type="number"
                  value={priceOverride}
                  onChange={(e) => setPriceOverride(e.target.value)}
                  placeholder={String(selected.price || '')}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-medium block mb-0.5">Line Total</label>
                <div className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-primary">
                  {fmt(lineTotal)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-slate-400">Unit: {selected.unit || 'nr'} · Override only for negotiated rates</p>
              <button
                type="button"
                onClick={addLine}
                disabled={!qty || Number(qty) <= 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white hover:bg-primary/90 rounded-lg text-xs font-medium transition disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" /> Add to BOQ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Current lines */}
      {boqLines.length === 0 ? (
        <div className="text-center py-5 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
          <ClipboardList className="w-6 h-6 text-slate-200 mx-auto mb-1.5" />
          No BOQ lines yet — this step is optional.
          <p className="text-[10px] mt-0.5">Add them later from the job's Financials tab → Controls.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {boqLines.map((line, idx) => (
            <div key={idx} className="px-3 py-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {line.sor_ref && (
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold">
                      {line.sor_ref}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">{line.category}</span>
                  <p className="text-xs font-medium text-slate-800 truncate">{line.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <input
                  type="number"
                  value={line.agreed_quantity}
                  onChange={(e) => updateLine(idx, { agreed_quantity: Number(e.target.value) || 0 })}
                  className="w-14 px-1.5 py-1 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-[10px] text-slate-400 w-6">{line.unit}</span>
                <span className="text-slate-300 text-xs">@</span>
                <div className="relative">
                  <PoundSterling className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                  <input
                    type="number"
                    value={line.agreed_unit_price}
                    onChange={(e) => updateLine(idx, { agreed_unit_price: Number(e.target.value) || 0 })}
                    className="w-20 pl-6 pr-1 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <span className="text-xs font-bold text-slate-900 tabular-nums w-20 text-right">{fmt(line.agreed_line_total)}</span>
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition"
                  title="Remove line"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {/* Footer total */}
          <div className="px-3 py-2 bg-slate-50 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              {boqLines.length} line{boqLines.length !== 1 ? 's' : ''} · Contract Value
            </span>
            <span className="text-sm font-bold text-primary tabular-nums">{fmt(contractValue)}</span>
          </div>
        </div>
      )}
    </div>
  );
}