import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Upload, Download, FileSpreadsheet, Loader2, ArrowUpDown,
  ClipboardList, Layers, BookOpen, CheckCircle2,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => '£' + (Math.round((n || 0) * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function csvEscape(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FinancialDataExchange() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(null);
  const [importJobId, setImportJobId] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const fileRefs = {
    rateCard: useRef(null),
    billingRules: useRef(null),
    boq: useRef(null),
  };

  // ── Rate Card export ──
  const { data: rateItems = [] } = useQuery({
    queryKey: ['fdx-rate-items'],
    queryFn: () => base44.entities.RateCardItem.list('-sort_order', 500),
  });

  const exportRateCards = () => {
    const headers = ['Category', 'Subcategory', 'Description', 'Price', 'Cost Price', 'Unit', 'Men', 'Project ID', 'Supplier ID', 'Staff ID', 'Rate Card Source', 'Is Active', 'Sort Order'];
    const rows = rateItems.map((r) => [
      r.category || '', r.subcategory || '', r.description || '',
      r.price ?? '', r.cost_price ?? '', r.unit || '', r.men ?? '',
      r.project_id || '', r.supplier_id || '', r.staff_id || '',
      r.rate_card_source || '', r.is_active ? 'Yes' : 'No', r.sort_order || 0,
    ]);
    downloadCSV(`rate-cards-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
    toast({ title: 'Rate cards exported', description: `${rateItems.length} items downloaded as CSV` });
  };

  // ── Billing Rules export ──
  const { data: billingRules = [] } = useQuery({
    queryKey: ['fdx-billing-rules'],
    queryFn: () => base44.entities.BillingRule.list('-sort_order', 500),
  });

  const exportBillingRules = () => {
    const headers = ['Rule Type', 'Name', 'Description', 'Charge Method', 'Flat Fee', 'Per Mile Rate', 'Per Hour Rate', 'Per Unit Rate', 'Unit Label', 'Is Chargeable', 'Is Active', 'Category', 'Sort Order'];
    const rows = billingRules.map((r) => [
      r.rule_type || '', r.name || '', r.description || '', r.charge_method || '',
      r.flat_fee ?? '', r.per_mile_rate ?? '', r.per_hour_rate ?? '', r.per_unit_rate ?? '',
      r.unit_label || '', r.is_chargeable ? 'Yes' : 'No', r.is_active ? 'Yes' : 'No',
      r.category || '', r.sort_order || 0,
    ]);
    downloadCSV(`billing-rules-${new Date().toISOString().slice(0, 10)}.csv`, [headers, ...rows]);
    toast({ title: 'Billing rules exported', description: `${billingRules.length} rules downloaded as CSV` });
  };

  // ── BOQ export (for a specific job) ──
  const exportBOQ = async () => {
    if (!importJobId) { toast({ title: 'Select a job first', variant: 'destructive' }); return; }
    setBusy('boq-export');
    try {
      const res = await base44.functions.invoke('boqImportExport', { mode: 'export', job_id: importJobId });
      if (res.data?.csv) {
        const blob = new Blob([res.data.csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `boq-${importJobId}-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'BOQ exported', description: `${res.data.line_count} lines downloaded` });
      }
    } catch (e) {
      toast({ title: 'Export failed', description: e?.message, variant: 'destructive' });
    }
    setBusy(null);
  };

  // ── BOQ import ──
  const importBOQ = async (file) => {
    if (!importJobId) { toast({ title: 'Select a job first', variant: 'destructive' }); return; }
    if (!file) return;
    setBusy('boq-import');
    try {
      // Upload the file first
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
      const fileUrl = uploadRes.file_url;

      // Fetch the job to get project_id
      const job = await base44.entities.Job.get(importJobId);

      const res = await base44.functions.invoke('boqImportExport', {
        mode: 'import',
        file_url: fileUrl,
        job_id: importJobId,
        project_id: job?.project_id || null,
        replace_existing: replaceExisting,
      });
      if (res.data?.ok) {
        toast({
          title: 'BOQ imported',
          description: `${res.data.imported} lines created${res.data.matched_rates ? ` (${res.data.matched_rates} matched to rate card)` : ''}${res.data.skipped ? `, ${res.data.skipped} skipped` : ''}`,
        });
        queryClient.invalidateQueries({ queryKey: ['boq-lines', importJobId] });
      } else {
        toast({ title: 'Import failed', description: res.data?.error || 'Unknown error', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Import failed', description: e?.message, variant: 'destructive' });
    }
    setBusy(null);
    if (fileRefs.boq.current) fileRefs.boq.current.value = '';
  };

  // ── Rate Card CSV import ──
  const importRateCardCSV = async (file) => {
    if (!file) return;
    setBusy('rate-import');
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { toast({ title: 'File is empty', variant: 'destructive' }); return; }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
      const getCol = (row, ...keys) => {
        for (const k of keys) {
          const idx = headers.indexOf(k.toLowerCase().replace(/[^a-z0-9]/g, '_'));
          if (idx >= 0) return row[idx]?.trim() || '';
        }
        return '';
      };

      const payload = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map((c) => c.trim());
        const description = getCol(row, 'description', 'item_description');
        if (!description) continue;
        payload.push({
          description,
          category: getCol(row, 'category', 'cat') || 'labour',
          subcategory: getCol(row, 'subcategory', 'section') || null,
          price: getCol(row, 'price', 'unit_price') ? Number(getCol(row, 'price', 'unit_price')) : null,
          cost_price: getCol(row, 'cost_price', 'cost') ? Number(getCol(row, 'cost_price', 'cost')) : null,
          unit: getCol(row, 'unit', 'uom') || 'nr',
          men: getCol(row, 'men', 'crew') ? Number(getCol(row, 'men', 'crew')) : null,
          rate_card_source: 'our_company',
          is_active: true,
          sort_order: i,
        });
      }

      if (payload.length === 0) { toast({ title: 'No valid rows found', variant: 'destructive' }); return; }
      await base44.entities.RateCardItem.bulkCreate(payload);
      toast({ title: 'Rate cards imported', description: `${payload.length} items added` });
      queryClient.invalidateQueries({ queryKey: ['fdx-rate-items'] });
    } catch (e) {
      toast({ title: 'Import failed', description: e?.message, variant: 'destructive' });
    }
    setBusy(null);
    if (fileRefs.rateCard.current) fileRefs.rateCard.current.value = '';
  };

  // ── Billing Rules CSV import ──
  const importBillingRulesCSV = async (file) => {
    if (!file) return;
    setBusy('rules-import');
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { toast({ title: 'File is empty', variant: 'destructive' }); return; }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
      const getCol = (row, ...keys) => {
        for (const k of keys) {
          const idx = headers.indexOf(k.toLowerCase().replace(/[^a-z0-9]/g, '_'));
          if (idx >= 0) return row[idx]?.trim() || '';
        }
        return '';
      };

      const payload = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map((c) => c.trim());
        const name = getCol(row, 'name', 'rule_name');
        const ruleType = getCol(row, 'rule_type', 'type') || 'task';
        const chargeMethod = getCol(row, 'charge_method', 'method') || 'flat_fee';
        if (!name) continue;
        payload.push({
          name,
          rule_type: ruleType,
          charge_method: chargeMethod,
          description: getCol(row, 'description', 'desc') || null,
          flat_fee: getCol(row, 'flat_fee', 'flat') ? Number(getCol(row, 'flat_fee', 'flat')) : null,
          per_mile_rate: getCol(row, 'per_mile_rate', 'mile_rate') ? Number(getCol(row, 'per_mile_rate', 'mile_rate')) : null,
          per_hour_rate: getCol(row, 'per_hour_rate', 'hour_rate') ? Number(getCol(row, 'per_hour_rate', 'hour_rate')) : null,
          per_unit_rate: getCol(row, 'per_unit_rate', 'unit_rate') ? Number(getCol(row, 'per_unit_rate', 'unit_rate')) : null,
          unit_label: getCol(row, 'unit_label', 'unit') || 'each',
          is_chargeable: getCol(row, 'is_chargeable', 'chargeable') !== 'No',
          is_active: getCol(row, 'is_active', 'active') !== 'No',
          category: getCol(row, 'category', 'cat') || null,
          sort_order: i,
        });
      }

      if (payload.length === 0) { toast({ title: 'No valid rows found', variant: 'destructive' }); return; }
      await base44.entities.BillingRule.bulkCreate(payload);
      toast({ title: 'Billing rules imported', description: `${payload.length} rules added` });
      queryClient.invalidateQueries({ queryKey: ['fdx-billing-rules'] });
    } catch (e) {
      toast({ title: 'Import failed', description: e?.message, variant: 'destructive' });
    }
    setBusy(null);
    if (fileRefs.billingRules.current) fileRefs.billingRules.current.value = '';
  };

  const Card = ({ icon: Icon, title, description, children, color = 'emerald' }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg bg-${color}-50 flex items-center justify-center`}>
          <Icon className={`w-4 h-4 text-${color}-700`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );

  const Btn = ({ onClick, disabled, busy: btnBusy, icon: Icon, label, variant = 'primary' }) => (
    <button onClick={onClick} disabled={disabled || btnBusy}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
        variant === 'primary' ? 'bg-primary text-white hover:bg-primary/90'
        : variant === 'secondary' ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        : 'bg-white text-primary border border-primary/20 hover:bg-primary/5'
      }`}>
      {btnBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );

  return (
    <div>
      <SettingsSectionHeader
        icon={ArrowUpDown}
        title="Financial Data Exchange"
        description="Import and export rate cards, billing rules, and BOQ data — bulk manage your financial configuration"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Rate Cards */}
        <Card icon={Layers} title="Rate Cards (Master Price List)" description={`${rateItems.length} items — global & project rates`} color="emerald">
          <div className="flex gap-2 flex-wrap">
            <Btn onClick={exportRateCards} icon={Download} label="Export CSV" variant="secondary" />
            <Btn onClick={() => fileRefs.rateCard.current?.click()} busy={busy === 'rate-import'} icon={Upload} label="Import CSV" variant="primary" />
          </div>
          <input ref={fileRefs.rateCard} type="file" accept=".csv" className="hidden"
            onChange={(e) => importRateCardCSV(e.target.files?.[0])} />
          <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg p-2.5">
            <p className="font-semibold text-slate-500 mb-1">CSV columns:</p>
            <code className="text-[10px]">category, subcategory, description, price, cost_price, unit, men</code>
          </div>
        </Card>

        {/* Billing Rules */}
        <Card icon={BookOpen} title="Billing Rules" description={`${billingRules.length} rules — charge calculations`} color="blue">
          <div className="flex gap-2 flex-wrap">
            <Btn onClick={exportBillingRules} icon={Download} label="Export CSV" variant="secondary" />
            <Btn onClick={() => fileRefs.billingRules.current?.click()} busy={busy === 'rules-import'} icon={Upload} label="Import CSV" variant="primary" />
          </div>
          <input ref={fileRefs.billingRules} type="file" accept=".csv" className="hidden"
            onChange={(e) => importBillingRulesCSV(e.target.files?.[0])} />
          <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg p-2.5">
            <p className="font-semibold text-slate-500 mb-1">CSV columns:</p>
            <code className="text-[10px]">rule_type, name, charge_method, flat_fee, per_mile_rate, per_hour_rate, per_unit_rate, unit_label, is_chargeable, is_active</code>
          </div>
        </Card>

        {/* BOQ */}
        <Card icon={ClipboardList} title="Bill of Quantities" description="Import/export contracted scope per job" color="violet">
          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] text-slate-400 uppercase font-medium block mb-1">Target Job</label>
              <input value={importJobId} onChange={(e) => setImportJobId(e.target.value)}
                placeholder="Paste job ID…"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)}
                className="rounded border-slate-300" />
              Replace existing BOQ for this job
            </label>
            <div className="flex gap-2 flex-wrap">
              <Btn onClick={exportBOQ} busy={busy === 'boq-export'} disabled={!importJobId} icon={Download} label="Export CSV" variant="secondary" />
              <Btn onClick={() => fileRefs.boq.current?.click()} busy={busy === 'boq-import'} disabled={!importJobId} icon={Upload} label="Import CSV" variant="primary" />
            </div>
            <input ref={fileRefs.boq} type="file" accept=".csv" className="hidden"
              onChange={(e) => importBOQ(e.target.files?.[0])} />
          </div>
          <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg p-2.5">
            <p className="font-semibold text-slate-500 mb-1">CSV columns:</p>
            <code className="text-[10px]">sor_ref, description, category, subcategory, unit, agreed_quantity, agreed_unit_price, notes</code>
          </div>
        </Card>

        {/* SOR (existing import) */}
        <Card icon={FileSpreadsheet} title="Schedule of Rates (SOR)" description="Excel import via existing processor" color="amber">
          <p className="text-xs text-slate-500">
            The SOR Excel importer supports multi-sheet workbooks (CP Standard, CP Cutdown, Rotary, Sonic, Dynamic Sampling) with automatic year-column detection.
          </p>
          <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = 'sor-manager'; }}
            className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition w-fit">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Go to SOR Manager
          </a>
        </Card>
      </div>

      {/* Info banner */}
      <div className="mt-4 bg-gradient-to-br from-[#2E5A1A]/5 to-[#8DC63F]/5 rounded-xl border border-primary/15 p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-slate-800">How the data flows</p>
          <p className="text-xs text-slate-600 mt-1">
            Rate Cards define unit prices → Billing Rules define charge methods for tasks/deliveries → BOQ lines lock contracted scope per job.
            When work is logged, the unified resolver prices it (contract snapshot → project rate card → global), and the variation engine compares actuals against the BOQ automatically.
          </p>
        </div>
      </div>
    </div>
  );
}