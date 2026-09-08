import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { X, ShoppingCart, Package, PencilLine, Layers, Upload, Truck, HardHat, UserCheck, Loader2, FileText, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import WizardBreadcrumb from './WizardBreadcrumb';
import WizardStepCards from './WizardStepCards';
import SingleItemForm from './SingleItemForm';
import MultiItemBasket from './MultiItemBasket';
import SmartUploadReview from './SmartUploadReview';

const STEPS = [
  { id: 'splash', label: 'Splash' },
  { id: 'method', label: 'Method' },
  { id: 'smart-review', label: 'Review' },
  { id: 'source', label: 'Source' },
  { id: 'entry', label: 'Entry' },
];

/**
 * AddBillableItemsWizard — guided multi-step wizard replacing the legacy
 * BillableItemsBasketModal. 4 steps: splash (count) → method (manual/rate
 * cards + smart upload) → source (purchased/hired/client supplied) → entry
 * (single-item form or multi-item basket).
 *
 * The smart quote upload sits on the method screen. When used, it extracts
 * line items via the parseQuoteUpload backend function, then jumps straight
 * to the entry screen pre-filled with the extracted rows (and, for rate
 * cards, with fuzzy-matched rate card items pre-ticked and price
 * discrepancies flagged).
 */
export default function AddBillableItemsWizard({
  jobId, job, rateCardItems = [], suppliers = [], defaultDates = null, onClose,
}) {
  const { toast } = useToast();
  const jobStart = defaultDates?.start || job?.start_date || '';
  const jobEnd = defaultDates?.end || job?.end_date || '';

  const [step, setStep] = useState('splash');
  const [count, setCount] = useState('');      // 'single' | 'multiple'
  const [method, setMethod] = useState('');    // 'manual' | 'rate_cards'
  const [source, setSource] = useState('');    // 'purchased' | 'hired' | 'client_supplied'
  const [uploadRows, setUploadRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [smartUploadData, setSmartUploadData] = useState(null); // { fileUrl, fileName, rawRows, detectedColumns, rawText }
  const [matching, setMatching] = useState(false);

  // Exclude the entire Training category from the billable items flow:
  // filter out RateCardItems whose own category is 'training' OR whose
  // linked supplier's category is 'training'. Training courses and
  // training-supplier rate cards never appear as billable items.
  const filteredRateCardItems = useMemo(() => {
    const trainingSupplierIds = new Set(
      (suppliers || [])
        .filter(s => {
          const cats = Array.isArray(s.category) ? s.category : (s.category ? [s.category] : []);
          return cats.some(c => (c || '').toLowerCase() === 'training');
        })
        .map(s => s.id)
    );
    return (rateCardItems || []).filter(r => {
      if ((r.category || '').toLowerCase() === 'training') return false;
      if (r.supplier_id && trainingSupplierIds.has(r.supplier_id)) return false;
      return true;
    });
  }, [rateCardItems, suppliers]);

  const handleSelectCount = (c) => { setCount(c); setStep('method'); };
  const handleSelectMethod = (m) => { setMethod(m); setStep('source'); };
  const handleSelectSource = (s) => { setSource(s); setStep('entry'); };

  const canGoTo = (stepId) => {
    const idx = STEPS.findIndex(s => s.id === stepId);
    const currentIdx = STEPS.findIndex(s => s.id === step);
    // Can always go back to a step before the current one
    return idx < currentIdx;
  };

  const handleJump = (stepId) => {
    // Jumping back clears downstream selections so state stays consistent
    if (stepId === 'splash') { setCount(''); setMethod(''); setSource(''); setUploadRows([]); setSmartUploadData(null); }
    if (stepId === 'method') { setMethod(''); setSource(''); setUploadRows([]); setSmartUploadData(null); }
    if (stepId === 'source') { setSource(''); }
    setStep(stepId);
  };

  // --- Smart quote upload ---
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // 1. Upload the file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      // 2. Extract raw rows + detected columns (no matching yet — the user
      //    maps columns in the review step first, then we match).
      const res = await base44.functions.invoke('parseQuoteUpload', {
        file_url,
        mode: 'extract',
      });
      const data = res.data;
      if (!data.success) {
        toast({ title: 'Could not extract content', description: data.error || 'No content found. Please enter manually.', variant: 'destructive' });
        setUploading(false);
        return;
      }
      setSmartUploadData({
        fileUrl: file_url,
        fileName: file.name,
        rawRows: data.raw_rows || [],
        detectedColumns: data.detected_columns || [],
        rawText: data.raw_text || '',
      });
      toast({
        title: `Extracted ${(data.raw_rows || []).length} row${(data.raw_rows || []).length !== 1 ? 's' : ''}`,
        description: 'Review and map columns to billable fields.',
      });
      setStep('smart-review');
    } catch (err) {
      console.error('Upload failed:', err);
      toast({ title: 'Upload failed', description: 'Could not read the quote. Please try again or enter manually.', variant: 'destructive' });
    }
    setUploading(false);
  };

  // --- Smart upload: apply column mapping + fuzzy match ---
  const handleSmartApply = async (mappedRows, errorMsg) => {
    if (errorMsg) {
      toast({ title: 'Nothing to extract', description: errorMsg, variant: 'destructive' });
      return;
    }
    if (mappedRows.length === 0) {
      toast({ title: 'No rows', description: 'Map a column to "Description" and try again.', variant: 'destructive' });
      return;
    }
    setMatching(true);
    try {
      const res = await base44.functions.invoke('parseQuoteUpload', {
        mode: 'match',
        mapped_rows: mappedRows,
        supplier_id: '',
      });
      const data = res.data;
      if (!data.success) {
        toast({ title: 'Match failed', description: data.error || 'Could not match rows.', variant: 'destructive' });
        setMatching(false);
        return;
      }
      setUploadRows(data.rows);
      toast({
        title: `Extracted ${data.extracted_count} line item${data.extracted_count !== 1 ? 's' : ''}`,
        description: `${data.matched_count} matched to rate card${data.discrepancy_count > 0 ? ` · ${data.discrepancy_count} price discrepancy${data.discrepancy_count !== 1 ? 's' : ''}` : ''}`,
      });
      // Default method + source, then jump to entry
      if (!method) setMethod('manual');
      if (!source) setSource('purchased');
      setStep('entry');
    } catch (err) {
      console.error('Match failed:', err);
      toast({ title: 'Match failed', description: 'Could not match rows. Please try again or enter manually.', variant: 'destructive' });
    }
    setMatching(false);
  };

  const sourceOptions = [
    { id: 'purchased', label: 'Purchased', description: 'Bought for this job via a PO number', icon: Truck },
    { id: 'hired', label: 'Hired', description: 'Hired from a supplier with hire dates', icon: HardHat },
    { id: 'client_supplied', label: 'Client Supplied', description: 'Informational only — no cost, just logged', icon: UserCheck, disabled: method === 'rate_cards' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 backdrop-blur-md p-3 sm:p-4">
      <div className="hub-glass rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col animate-pop-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200/80 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-md">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900">Add Billable Items</h2>
            <p className="text-xs text-slate-500">
              {step === 'splash' && 'Choose how many items to add'}
              {step === 'method' && 'Choose how to enter your items'}
              {step === 'smart-review' && 'Review extracted rows and map columns'}
              {step === 'source' && 'How do the items reach site?'}
              {step === 'entry' && `${count === 'single' ? 'Single item' : 'Multiple items'} · ${method === 'manual' ? 'Manual entry' : 'Rate cards'} · ${source}`}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <WizardBreadcrumb steps={STEPS} current={step} canGoTo={canGoTo} onJump={handleJump} />

        {/* Splash screen */}
        {step === 'splash' && (
          <WizardStepCards
            options={[
              { id: 'single', label: 'Single Item', description: 'Add one item with a focused form', icon: Package },
              { id: 'multiple', label: 'Multiple Items', description: 'Add several items in a basket with a shared PO', icon: ShoppingCart },
            ]}
            onSelect={handleSelectCount}
          />
        )}

        {/* Method screen */}
        {step === 'method' && (
          <>
            {/* Smart upload button */}
            <div className="px-5 pt-4 flex-shrink-0">
              <label className="block">
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileSelect} disabled={uploading} />
                <div className={`w-full rounded-2xl border-2 border-dashed p-4 text-center transition cursor-pointer ${uploading ? 'border-[#2E5A1A]/40 bg-[#2E5A1A]/5' : 'border-slate-300 bg-slate-50/50 hover:border-[#2E5A1A]/40 hover:bg-[#2E5A1A]/[0.03]'}`}>
                  {uploading ? (
                    <div className="flex items-center justify-center gap-2 text-[#2E5A1A]">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm font-bold">Extracting document…</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" /> Smart Upload a Quote
                        </p>
                        <p className="text-xs text-slate-500">PDF or photo — extracts line items, quantities & prices automatically</p>
                      </div>
                    </div>
                  )}
                </div>
              </label>
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">or enter manually</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
            </div>
            <WizardStepCards
              options={[
                { id: 'manual', label: 'Manual Entry', description: 'Type each item from the quote yourself', icon: PencilLine },
                { id: 'rate_cards', label: 'Rate Cards', description: 'Pick from your saved rate card catalogue', icon: Layers },
              ]}
              onSelect={handleSelectMethod}
            />
          </>
        )}

        {/* Source screen */}
        {step === 'source' && (
          <WizardStepCards options={sourceOptions} onSelect={handleSelectSource} />
        )}

        {/* Smart Upload Review screen */}
        {step === 'smart-review' && smartUploadData && (
          <SmartUploadReview
            fileUrl={smartUploadData.fileUrl}
            fileName={smartUploadData.fileName}
            rawRows={smartUploadData.rawRows}
            detectedColumns={smartUploadData.detectedColumns}
            rawText={smartUploadData.rawText}
            onApply={handleSmartApply}
            onBack={() => setStep('method')}
            onClose={onClose}
            applying={matching}
          />
        )}

        {/* Entry screen */}
        {step === 'entry' && count && method && source && (
          count === 'single' ? (
            <SingleItemForm
              jobId={jobId}
              job={job}
              source={source}
              method={method}
              rateCardItems={filteredRateCardItems}
              suppliers={suppliers}
              jobStart={jobStart}
              jobEnd={jobEnd}
              prefillRow={uploadRows[0] || null}
              onClose={onClose}
            />
          ) : (
            <MultiItemBasket
              jobId={jobId}
              job={job}
              source={source}
              method={method}
              rateCardItems={filteredRateCardItems}
              suppliers={suppliers}
              jobStart={jobStart}
              jobEnd={jobEnd}
              uploadRows={uploadRows}
              onClose={onClose}
            />
          )
        )}
      </div>
    </div>
  );
}