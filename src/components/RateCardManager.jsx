import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PoundSterling, Search, Plus, Users, Wrench, Package,
  Loader2, Receipt, Building2, TrendingUp, Percent, Copy, Upload, AlertTriangle,
  HardHat, Calendar, FileSpreadsheet, Download
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import SORRateCardManager from '@/components/SORRateCardManager';
import JobRateCardManager from '@/components/JobRateCardManager';
import SupplierRateCardUploader from '@/components/billing/SupplierRateCardUploader';
import RateCardSummaryDashboard from '@/components/billing/RateCardSummaryDashboard';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { useDivision } from '@/contexts/DivisionContext';
import RateItemRow from '@/components/ratecard/RateItemRow';
import AddRateForm from '@/components/ratecard/AddRateForm';
import RateCardViewToggle from '@/components/ratecard/RateCardViewToggle';

const CATEGORY_META = {
  labour: { label: 'Labour', icon: Users, color: 'emerald' },
  plant: { label: 'Plant Hire', icon: Wrench, color: 'blue' },
  materials: { label: 'Materials', icon: Package, color: 'amber' },
};

export default function RateCardManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState('chargeable');
  const [activeSource, setActiveSource] = useState('standard');
  const [activeCategory, setActiveCategory] = useState('labour');
  const [query, setQuery] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPct, setBulkPct] = useState('');
  const [bulkScope, setBulkScope] = useState('category');
  const [bulkApplying, setBulkApplying] = useState(false);
  const [viewMode, setViewMode] = useState('master');
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [cloneOpen, setCloneOpen] = useState(false);
  const [onlyNoCost, setOnlyNoCost] = useState(false);
  const [clonePct, setClonePct] = useState('');
  const [cloning, setCloning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingInternal, setUploadingInternal] = useState(false);
  const [showSupplierUpload, setShowSupplierUpload] = useState(false);
  const masterFileInputRef = useRef(null);
  const internalFileInputRef = useRef(null);

  const INTERNAL_COSTS_SUPPLIER_NAME = 'Internal Costs';

  const handleInternalUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingInternal(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await base44.functions.invoke('importInternalCostRates', formData);
      toast({
        title: 'Internal cost rates imported',
        description: `${res.data.summary.role_items_created} role rates + ${res.data.summary.staff_items_created} staff rates loaded into "Internal Costs".`,
      });
      refresh();
    } catch (err) {
      toast({ title: 'Upload failed', description: err?.message || 'Could not process file', variant: 'destructive' });
    }
    setUploadingInternal(false);
    if (internalFileInputRef.current) internalFileInputRef.current.value = '';
  };

  // FIX: was base44.integrations.Core.UploadFile (non-existent) → now UploadPublicFile
  const handleMasterUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
      const res = await base44.functions.invoke('processMasterPriceListUpload', { file_url: uploadRes.file_url });
      toast({
        title: 'Master price list ingested',
        description: `${res.data.ingested} rates loaded.`,
      });
      refresh();
    } catch (err) {
      toast({ title: 'Upload failed', description: err?.message || 'Could not process file', variant: 'destructive' });
    }
    setUploading(false);
    if (masterFileInputRef.current) masterFileInputRef.current.value = '';
  };

  const { activeDivisionId } = useDivision();
  const { data: items = [], isLoading } = useScopedEntity('RateCardItem', { queryKey: ['rate-card-items'], sort: '-created_date', limit: 500 });
  const { data: suppliers = [] } = useScopedEntity('Supplier', { queryKey: ['suppliers'] });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['scoped', 'RateCardItem'] });
    queryClient.invalidateQueries({ queryKey: ['scoped', 'Supplier'] });
  };

  const exportCSV = () => {
    const rows = filtered.map(i => ({
      category: i.category || '',
      subcategory: i.subcategory || '',
      description: i.description || '',
      charge_out: i.price ?? '',
      price_text: i.price_text || '',
      internal_cost: i.cost_price ?? '',
      unit: i.unit || '',
      men: i.men ?? '',
      notes: (i.notes || '').replace(/[\r\n]+/g, ' '),
      effective_date: i.effective_date || '',
      expiry_date: i.expiry_date || '',
    }));
    if (rows.length === 0) { toast({ title: 'Nothing to export', variant: 'destructive' }); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate-card-${activeView}-${activeCategory}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isInternalCosts = activeView === 'internal';
  const isDrillingRates = activeView === 'chargeable' && activeSource === 'drilling';
  const isOurCard = activeView === 'chargeable' && activeSource === 'standard';
  const internalCostsSupplier = useMemo(() => suppliers.find(s => s.name === INTERNAL_COSTS_SUPPLIER_NAME), [suppliers]);
  const activeSupplier = (activeView === 'chargeable' && activeSource !== 'standard' && activeSource !== 'drilling')
    ? suppliers.find(s => s.id === activeSource) : null;

  const parseYearFromName = (name) => {
    const m = String(name || '').match(/(20\d{2})/);
    return m ? parseInt(m[1]) : null;
  };

  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    for (const s of suppliers) {
      const y = parseYearFromName(s.name);
      if (y) years.add(y);
    }
    return [...years].sort((a, b) => b - a);
  }, [suppliers]);

  const suppliersWithItems = useMemo(() => {
    const supplierIds = new Set(items.filter(i => i.rate_card_source === 'supplier' && i.supplier_id).map(i => i.supplier_id));
    return suppliers.filter(s => supplierIds.has(s.id) && s.name !== INTERNAL_COSTS_SUPPLIER_NAME);
  }, [items, suppliers]);

  const draftSuppliersForYear = useMemo(() => {
    return suppliersWithItems.filter(s => parseYearFromName(s.name) === activeYear);
  }, [suppliersWithItems, activeYear]);

  const scopedItems = useMemo(() => {
    if (isOurCard) return items.filter(i => i.rate_card_source !== 'supplier');
    if (isInternalCosts) return items.filter(i => i.rate_card_source === 'supplier' && internalCostsSupplier && i.supplier_id === internalCostsSupplier.id);
    return items.filter(i => i.rate_card_source === 'supplier' && i.supplier_id === activeSource);
  }, [items, isOurCard, isInternalCosts, internalCostsSupplier, activeSource]);

  const filtered = useMemo(() => {
    let list = scopedItems.filter(i => i.category === activeCategory);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(i =>
        (i.description || '').toLowerCase().includes(q) ||
        (i.subcategory || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q)
      );
    }
    if (onlyNoCost) {
      list = list.filter(i => (i.cost_price == null || i.cost_price === '') && i.price != null);
    }
    return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [scopedItems, activeCategory, query, onlyNoCost]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach(i => {
      const key = i.subcategory || 'General';
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return Object.entries(map);
  }, [filtered]);

  const counts = useMemo(() => ({
    labour: scopedItems.filter(i => i.category === 'labour').length,
    plant: scopedItems.filter(i => i.category === 'plant').length,
    materials: scopedItems.filter(i => i.category === 'materials').length,
  }), [scopedItems]);

  const totalForCard = counts.labour + counts.plant + counts.materials;

  const health = useMemo(() => {
    const withPrice = scopedItems.filter(i => i.price != null && !isNaN(Number(i.price)) && Number(i.price) > 0);
    const missingCost = scopedItems.filter(i => (i.cost_price == null || i.cost_price === '') && i.price != null);
    const zeroMargin = withPrice.filter(i => i.cost_price != null && Number(i.cost_price) >= Number(i.price));
    const margins = withPrice
      .filter(i => i.cost_price != null && Number(i.cost_price) > 0)
      .map(i => ((Number(i.price) - Number(i.cost_price)) / Number(i.price)) * 100);
    const avgMargin = margins.length > 0 ? margins.reduce((s, m) => s + m, 0) / margins.length : null;
    return { total: scopedItems.length, missingCost: missingCost.length, zeroMargin: zeroMargin.length, avgMargin, withMargin: margins.length };
  }, [scopedItems]);

  const applyBulkAdjustment = async () => {
    const pct = parseFloat(bulkPct);
    if (isNaN(pct)) { toast({ title: 'Enter a valid percentage', variant: 'destructive' }); return; }
    const multiplier = 1 + pct / 100;
    const targetItems = (bulkScope === 'category' ? filtered : scopedItems).filter(i => i.price != null && !isNaN(Number(i.price)));
    if (targetItems.length === 0) { toast({ title: 'No adjustable rates', description: 'Only items with a numeric price can be bulk-adjusted.', variant: 'destructive' }); return; }
    if (!confirm(`Apply ${pct > 0 ? '+' : ''}${pct}% to ${targetItems.length} rate${targetItems.length === 1 ? '' : 's'} (${bulkScope === 'category' ? CATEGORY_META[activeCategory].label : 'all categories'})?`)) return;
    setBulkApplying(true);
    try {
      const updates = targetItems.map(i => ({ id: i.id, price: Math.round(Number(i.price) * multiplier * 100) / 100 }));
      await base44.entities.RateCardItem.bulkUpdate(updates);
      toast({ title: 'Rates updated', description: `${updates.length} rate${updates.length === 1 ? '' : 's'} adjusted by ${pct > 0 ? '+' : ''}${pct}%.` });
      setBulkOpen(false); setBulkPct('');
      refresh();
    } catch (e) { toast({ title: 'Could not apply adjustment', description: e?.message, variant: 'destructive' }); }
    setBulkApplying(false);
  };

  const cloneToDraft = async () => {
    const pct = parseFloat(clonePct);
    const multiplier = isNaN(pct) ? 1 : 1 + pct / 100;
    const nextYear = new Date().getFullYear() + 1;
    const draftName = `Chargeable Rates — ${nextYear} Draft`;
    setCloning(true);
    try {
      const sourceItems = items.filter(i => i.rate_card_source !== 'supplier' && i.price != null);
      if (sourceItems.length === 0) { toast({ title: 'No rates to clone', description: 'Add rates to the live card first.', variant: 'destructive' }); setCloning(false); return; }
      let draftSupplier = suppliers.find(s => s.name === draftName);
      if (!draftSupplier) draftSupplier = await base44.entities.Supplier.create({ name: draftName, notes: 'Draft rate card clone — edit prices here before going live.', division_id: activeDivisionId });
      const clones = sourceItems.map(i => ({
        division_id: activeDivisionId, category: i.category, subcategory: i.subcategory || null,
        description: i.description, unit: i.unit || null, men: i.men ?? null, size: i.size || null,
        notes: i.notes || null, sort_order: i.sort_order || 0, is_active: true,
        rate_card_source: 'supplier', supplier_id: draftSupplier.id,
        price: i.price != null ? Math.round(Number(i.price) * multiplier * 100) / 100 : null,
        price_text: i.price_text || null,
      }));
      for (let i = 0; i < clones.length; i += 500) await base44.entities.RateCardItem.bulkCreate(clones.slice(i, i + 500));
      toast({ title: 'Draft rate card created', description: `${clones.length} rates cloned to "${draftName}"${!isNaN(pct) ? ` with ${pct > 0 ? '+' : ''}${pct}% uplift` : ''}.` });
      setCloneOpen(false); setClonePct('');
      refresh();
      setActiveSource(draftSupplier.id);
    } catch (e) { toast({ title: 'Clone failed', description: e?.message, variant: 'destructive' }); }
    setCloning(false);
  };

  // ── Job Rate Cards view ──
  if (viewMode === 'job') {
    return (
      <div className="space-y-4">
        <SettingsSectionHeader icon={Receipt} title="Rate Card Manager" description="Master Price List (chargeable rates, internal costs, drilling rates) and Job Rate Cards" />
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg w-fit">
          <button onClick={() => setViewMode('master')} className="px-4 py-2 rounded-md text-sm font-semibold transition text-slate-500">Master Price List</button>
          <button onClick={() => setViewMode('job')} className="px-4 py-2 rounded-md text-sm font-semibold transition bg-white text-[#2E5A1A] shadow-sm">Job Rate Cards</button>
        </div>
        <JobRateCardManager />
      </div>
    );
  }

  // ── Drilling Rates 2026 view ──
  if (isDrillingRates) {
    return (
      <div className="space-y-4">
        <SettingsSectionHeader icon={Receipt} title="Rate Card Manager" description="Master Price List (chargeable rates, internal costs, drilling rates) and Job Rate Cards" />
        <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg w-fit">
          <button onClick={() => { setViewMode('master'); setActiveSource('standard'); }} className="px-4 py-2 rounded-md text-sm font-semibold transition bg-white text-[#2E5A1A] shadow-sm">Master Price List</button>
          <button onClick={() => setViewMode('job')} className="px-4 py-2 rounded-md text-sm font-semibold transition text-slate-500">Job Rate Cards</button>
        </div>
        <RateCardViewToggle activeView={activeView} setActiveView={setActiveView} activeSource={activeSource} setActiveSource={setActiveSource}
          internalCostItemCount={items.filter(i => i.supplier_id === internalCostsSupplier?.id).length}
          suppliersWithItems={suppliersWithItems} draftSuppliersForYear={draftSuppliersForYear} items={items}
          availableYears={availableYears} activeYear={activeYear} setActiveYear={setActiveYear} />
        <SORRateCardManager />
      </div>
    );
  }

  // ── Main Master Price List view ──
  return (
    <div className="space-y-4">
      <SettingsSectionHeader icon={Receipt} title="Rate Card Manager" description="Master Price List (chargeable rates, internal costs, drilling rates) and Job Rate Cards" />
      <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg w-fit">
        <button onClick={() => setViewMode('master')} className="px-4 py-2 rounded-md text-sm font-semibold transition bg-white text-[#2E5A1A] shadow-sm">Master Price List</button>
        <button onClick={() => setViewMode('job')} className="px-4 py-2 rounded-md text-sm font-semibold transition text-slate-500">Job Rate Cards</button>
      </div>

      <RateCardViewToggle activeView={activeView} setActiveView={setActiveView} activeSource={activeSource} setActiveSource={setActiveSource}
        internalCostItemCount={items.filter(i => i.supplier_id === internalCostsSupplier?.id).length}
        suppliersWithItems={suppliersWithItems} draftSuppliersForYear={draftSuppliersForYear} items={items}
        availableYears={availableYears} activeYear={activeYear} setActiveYear={setActiveYear} />

      <RateCardSummaryDashboard items={filtered} cardLabel={isOurCard ? 'Chargeable Rates' : isInternalCosts ? 'Internal Costs' : activeSupplier?.name || 'Rate Card'} isOurCard={isOurCard} isInternalCosts={isInternalCosts} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header bar */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          {isOurCard ? <Receipt className="w-5 h-5 text-[#2E5A1A]" /> : isInternalCosts ? <HardHat className="w-5 h-5 text-amber-600" /> : <Building2 className="w-5 h-5 text-[#2E5A1A]" />}
          <h2 className="font-semibold text-slate-900 text-sm sm:text-base">
            {isOurCard ? 'Chargeable Rates' : isInternalCosts ? 'Internal Costs' : activeSupplier?.name || 'Supplier'}
          </h2>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{totalForCard} rates</span>
          {/* Health pills */}
          <div className="flex items-center gap-1.5 flex-wrap sm:ml-auto">
            {health.avgMargin != null && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <TrendingUp className="w-3 h-3" /> Avg {health.avgMargin.toFixed(0)}%
              </span>
            )}
            {health.missingCost > 0 && (
              <button onClick={() => setOnlyNoCost(!onlyNoCost)}
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border transition ${onlyNoCost ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}
                title="Items with a charge-out price but no internal cost — click to filter">
                <AlertTriangle className="w-3 h-3" /> {health.missingCost} no cost {onlyNoCost && '✓'}
              </button>
            )}
            {health.zeroMargin > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-600 border border-red-200" title="Items where internal cost is ≥ charge-out price">
                <AlertTriangle className="w-3 h-3" /> {health.zeroMargin} at-risk
              </span>
            )}
          </div>
          {/* Upload buttons */}
          {isOurCard && (
            <>
              <input ref={masterFileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleMasterUpload} className="hidden" />
              <button onClick={() => masterFileInputRef.current?.click()} disabled={uploading}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition bg-[#2E5A1A] text-white hover:bg-[#1c4a12] disabled:opacity-50 flex-shrink-0">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className="hidden sm:inline">{uploading ? 'Processing...' : 'Upload MPL'}</span>
                <span className="sm:hidden">{uploading ? '...' : 'MPL'}</span>
              </button>
            </>
          )}
          {isInternalCosts && (
            <>
              <input ref={internalFileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleInternalUpload} className="hidden" />
              <button onClick={() => internalFileInputRef.current?.click()} disabled={uploadingInternal}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 flex-shrink-0">
                {uploadingInternal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className="hidden sm:inline">{uploadingInternal ? 'Processing...' : 'Upload Costs'}</span>
                <span className="sm:hidden">{uploadingInternal ? '...' : 'Costs'}</span>
              </button>
            </>
          )}
          <button onClick={() => setShowSupplierUpload(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition bg-white text-[#2E5A1A] border border-[#2E5A1A]/20 hover:bg-[#2E5A1A]/5 flex-shrink-0">
            <Building2 className="w-4 h-4" /> <span className="hidden sm:inline">Upload Supplier</span><span className="sm:hidden">Supplier</span>
          </button>
          <button onClick={exportCSV}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 flex-shrink-0">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export CSV</span><span className="sm:hidden">CSV</span>
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-3 pt-3 border-b border-slate-100">
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const Icon = meta.icon;
            const active = activeCategory === key;
            return (
              <button key={key} onClick={() => setActiveCategory(key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition border-b-2 ${active ? 'border-[#2E5A1A] text-[#2E5A1A] bg-[#2E5A1A]/5' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Icon className="w-4 h-4" /> {meta.label}
                <span className="text-xs text-slate-400">({counts[key]})</span>
              </button>
            );
          })}
        </div>

        {/* Search + Bulk Adjust + Clone */}
        <div className="px-4 py-3 border-b border-slate-100 space-y-2.5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${CATEGORY_META[activeCategory].label.toLowerCase()} rates...`} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
            </div>
            <button onClick={() => setBulkOpen(!bulkOpen)} className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition w-full sm:w-auto flex-shrink-0 ${bulkOpen ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <TrendingUp className="w-4 h-4" /> Bulk Adjust
            </button>
            <button onClick={() => setCloneOpen(!cloneOpen)} className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition w-full sm:w-auto flex-shrink-0 ${cloneOpen ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              <Copy className="w-4 h-4" /> Clone to Draft
            </button>
          </div>
          {bulkOpen && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800"><Percent className="w-3.5 h-3.5" /> Bulk Percentage Adjustment</div>
              <p className="text-xs text-amber-700">Apply a percentage increase or decrease to all rates with a numeric price. Use a negative value to decrease (e.g. -5 for -5%). Items with "POA" or text-only prices are skipped.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={bulkScope} onChange={e => setBulkScope(e.target.value)} className="px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500">
                  <option value="category">This category only ({CATEGORY_META[activeCategory].label})</option>
                  <option value="card">Entire rate card ({isOurCard ? 'Chargeable Rates' : isInternalCosts ? 'Internal Costs' : activeSupplier?.name || 'Supplier'})</option>
                </select>
                <input type="number" step="0.1" value={bulkPct} onChange={e => setBulkPct(e.target.value)} placeholder="e.g. 5 or -3" className="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm bg-white focus:outline-none focus:border-amber-500" />
                <button onClick={applyBulkAdjustment} disabled={bulkApplying} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 transition">
                  {bulkApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <PoundSterling className="w-4 h-4" />} Apply
                </button>
                <button onClick={() => { setBulkOpen(false); setBulkPct(''); }} className="px-3 py-2 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-medium transition">Cancel</button>
              </div>
            </div>
          )}
          {cloneOpen && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800"><Copy className="w-3.5 h-3.5" /> Clone Live Rate Card to a {new Date().getFullYear() + 1} Draft</div>
              <p className="text-xs text-emerald-700">Copies every rate from "Chargeable Rates" into a new draft supplier tab so you can prepare next year's prices without affecting live billing. Optionally apply an uplift %.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input type="number" step="0.1" value={clonePct} onChange={e => setClonePct(e.target.value)} placeholder="Uplift % (e.g. 5, or leave blank)" className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500" />
                <button onClick={cloneToDraft} disabled={cloning} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#2E5A1A] text-white rounded-lg text-sm font-semibold hover:bg-[#1c4a12] disabled:opacity-50 transition">
                  {cloning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} Clone
                </button>
                <button onClick={() => { setCloneOpen(false); setClonePct(''); }} className="px-3 py-2 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-medium transition">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Rate list */}
        <div className="overflow-y-auto max-h-[55vh]">
          {/* Column header (desktop only) */}
          <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 bg-slate-100/80 border-b border-slate-200 sticky top-0 z-20">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide flex-1">Description</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide w-12 text-right">Unit</span>
            {activeView === 'internal' && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wide w-24 text-right">Internal Cost</span>}
            {activeView === 'chargeable' && <>
              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide w-24 text-right">Charge Out</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide w-16 text-right">Margin</span>
            </>}
            <span className="w-6 flex-shrink-0" />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              {isOurCard ? 'No rates found for this category.' : isInternalCosts ? 'No internal cost rates yet. Upload your crew costs spreadsheet to populate this rate card.' : 'No items ingested for this supplier yet. Upload their rate card in Settings → Suppliers.'}
            </div>
          ) : (
            grouped.map(([subcategory, subItems]) => (
              <div key={subcategory} className="border-b border-slate-100 last:border-0">
                <div className="px-4 py-2 bg-slate-50/80 sticky top-0 z-10">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{subcategory}</p>
                </div>
                {subItems.map(item => <RateItemRow key={item.id} item={item} onUpdate={refresh} viewMode={activeView} />)}
                <AddRateForm category={activeCategory} subcategory={subcategory} source={isOurCard ? 'our_company' : 'supplier'} supplierId={isOurCard ? null : (isInternalCosts ? internalCostsSupplier?.id : activeSource)} onAdded={refresh} viewMode={activeView} />
              </div>
            ))
          )}
        </div>
      </div>

      <SupplierRateCardUploader open={showSupplierUpload} onClose={() => setShowSupplierUpload(false)} onIngested={(supplierId) => { setActiveView('chargeable'); setActiveSource(supplierId); refresh(); }} />
    </div>
  );
}