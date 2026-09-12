import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import {
  Upload, Loader2, Building2, FileSpreadsheet, X, Plus, CheckCircle2,
} from 'lucide-react';

const inputClass = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';

/**
 * Modal for uploading a supplier's rate card file directly from the
 * Master Price List. Lets the user pick an existing supplier (or create
 * a new one inline), upload their rate card file, and auto-ingest the
 * line items into the Master Price List under that supplier's tab.
 */
export default function SupplierRateCardUploader({ open, onClose, onIngested }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [stage, setStage] = useState('select'); // select | ingesting
  const [mode, setMode] = useState('existing'); // existing | new
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [file, setFile] = useState(null);

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });

  const reset = () => {
    setStage('select');
    setMode('existing');
    setSelectedSupplierId('');
    setNewSupplierName('');
    setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleUpload = async () => {
    if (!file) {
      toast({ title: 'Choose a file first', variant: 'destructive' });
      return;
    }
    let supplierId = selectedSupplierId;
    if (mode === 'new') {
      if (!newSupplierName.trim()) {
        toast({ title: 'Enter a supplier name', variant: 'destructive' });
        return;
      }
      setStage('ingesting');
      try {
        const created = await base44.entities.Supplier.create({ name: newSupplierName.trim() });
        supplierId = created.id;
        queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      } catch (err) {
        toast({ title: 'Could not create supplier', description: err?.message, variant: 'destructive' });
        setStage('select');
        return;
      }
    } else if (!supplierId) {
      toast({ title: 'Select a supplier', variant: 'destructive' });
      return;
    }

    setStage('ingesting');
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Supplier.update(supplierId, {
        rate_card_file_url: uploadRes.file_url,
        rate_card_file_name: file.name,
      });
      const res = await base44.functions.invoke('processRateCardUpload', {
        supplier_id: supplierId,
        file_url: uploadRes.file_url,
      });
      const data = res.data || res;
      if (data && data.status === 'success') {
        toast({ title: `Ingested ${data.ingested} rate card items`, description: file.name });
        queryClient.invalidateQueries({ queryKey: ['rate-card-items'] });
        queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        onIngested?.(supplierId);
        handleClose();
      } else {
        toast({ title: 'Ingest failed', description: data?.error || 'Could not read the rate card file', variant: 'destructive' });
        setStage('select');
      }
    } catch (err) {
      toast({ title: 'Upload failed', description: err?.message, variant: 'destructive' });
      setStage('select');
    }
  };

  if (!open) return null;

  const isBusy = stage === 'ingesting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Upload Supplier Rate Card</h3>
              <p className="text-xs text-slate-500">Auto-ingest a supplier's rates into the Master Price List</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5" /></button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100 mb-4 w-fit">
          <button onClick={() => setMode('existing')}
            className={'px-3 py-1.5 rounded-lg text-xs font-bold transition ' + (mode === 'existing' ? 'bg-white text-primary shadow-sm' : 'text-slate-500')}>
            Existing Supplier
          </button>
          <button onClick={() => setMode('new')}
            className={'px-3 py-1.5 rounded-lg text-xs font-bold transition ' + (mode === 'new' ? 'bg-white text-primary shadow-sm' : 'text-slate-500')}>
            <Plus className="w-3 h-3 inline mr-1" />New Supplier
          </button>
        </div>

        {mode === 'existing' ? (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Select Supplier</label>
            <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)} className={inputClass} disabled={isBusy}>
              <option value="">— Choose a supplier —</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.rate_card_item_count ? ` (${s.rate_card_item_count} items)` : ''}
                </option>
              ))}
            </select>
            {selectedSupplierId && (
              <p className="text-[11px] text-amber-600 mt-1.5 flex items-center gap-1">
                <FileSpreadsheet className="w-3 h-3" />
                Uploading will replace this supplier's existing rate card items.
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Supplier Name</label>
            <input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} className={inputClass} placeholder="e.g. Sunbelt Rentals" disabled={isBusy} />
          </div>
        )}

        {/* File picker */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Rate Card File</label>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.pdf"
            className="hidden" onChange={e => setFile(e.target.files?.[0])} disabled={isBusy} />
          {!file ? (
            <button onClick={() => fileRef.current?.click()} disabled={isBusy}
              className="w-full flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-200 rounded-xl hover:border-primary hover:bg-primary/5 transition disabled:opacity-50">
              <Upload className="w-6 h-6 text-slate-400" />
              <p className="text-sm font-semibold text-slate-600">Choose Excel, CSV or PDF</p>
              <p className="text-xs text-slate-400">The file will be auto-ingested into line items</p>
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-800 truncate">{file.name}</p>
                <p className="text-xs text-emerald-600">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              {!isBusy && (
                <button onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {isBusy && (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3 mb-4">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Uploading and ingesting rate card…
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleUpload} disabled={isBusy || !file}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition shadow-sm">
            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isBusy ? 'Processing…' : 'Upload & Ingest'}
          </button>
          <button onClick={handleClose} disabled={isBusy}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200 transition disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}