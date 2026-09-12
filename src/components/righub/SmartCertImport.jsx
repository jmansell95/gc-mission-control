import React, { useState, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Sparkles, Scan,
  ChevronLeft, ChevronRight, Edit3, ArrowRight, Calendar, Wrench,
  Hash, Type, ShieldCheck, User, Building2, StickyNote, RotateCw, FilePlus,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  DEFAULT_SERVICE_INTERVALS, DEFAULT_COMPLIANCE_CATEGORIES,
  DEFAULT_INSPECTION_CYCLE_MONTHS,
  autoComplianceStatus, autoNextServiceDate, autoMaintenanceStatus,
} from '@/utils/assetSmartDefaults';

/**
 * SmartCertImport — upload PDF certificate files and the system reads them
 * automatically to create assets + service records.
 *
 * OVERHAULED FLOW:
 *   1. Drag-and-drop or select multiple PDFs
 *   2. Parallel AI extraction (concurrency-limited) with live per-file progress grid
 *   3. Thumbnail grid overview of all processed PDFs with NEW / LINKED / FAILED badges
 *   4. Tap any thumbnail → full-screen swipe-through carousel with large PDF preview
 *   5. Edit any field inline with auto-expiry recalculation
 *   6. Retry any failed file individually
 *   7. Commit all valid entries at once
 */

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    asset_name: { type: 'string', description: 'Name or description of the equipment inspected' },
    serial_number: { type: 'string', description: 'Serial number, asset tag, or registration' },
    asset_type: { type: 'string', enum: ['rig', 'machinery', 'trailer', 'lifting', 'portable_appliance'], description: 'Type of equipment' },
    equipment_type: { type: 'string', description: 'Specific equipment type (e.g. Sling, Shackle, 110V Transformer)' },
    inspection_date: { type: 'string', description: 'Date of inspection/test (ISO format yyyy-mm-dd if possible)' },
    expiry_date: { type: 'string', description: 'Next inspection due / expiry date (ISO format yyyy-mm-dd if possible)' },
    inspection_type: { type: 'string', enum: ['loler_inspection', 'puwer_inspection', 'pat_inspection', 'service', 'calibration', 'other'], description: 'Type of inspection' },
    result: { type: 'string', enum: ['pass', 'fail', 'advisory', 'n/a'], description: 'Inspection result' },
    tested_by: { type: 'string', description: 'Name of person who carried out the inspection' },
    company: { type: 'string', description: 'Testing/inspection company' },
    notes: { type: 'string', description: 'Any findings, defects, or observations noted' },
  },
};

const TYPE_LABELS = { rig: 'Rig', machinery: 'Machinery', trailer: 'Trailer', lifting: 'Lifting Gear', portable_appliance: 'PAT / Electrical' };
const INSPECTION_LABELS = {
  loler_inspection: 'LOLER Inspection',
  puwer_inspection: 'PUWER Inspection',
  pat_inspection: 'PAT Test',
  service: 'Service / Maintenance',
  calibration: 'Calibration',
  other: 'Other Inspection',
};

const INSPECTION_CYCLE_MONTHS = {
  loler_inspection: 6,
  puwer_inspection: 12,
  pat_inspection: 12,
  service: null,
  calibration: 12,
  other: 12,
};

const CONCURRENCY = 3;

function parseDate(str) {
  if (!str) return '';
  const iso = new Date(str);
  if (!isNaN(iso.getTime()) && str.match(/\d{4}-\d{2}-\d{2}/)) return str.slice(0, 10);
  const m = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const m2 = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
  if (m2) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const mi = months.findIndex(mo => mo.toLowerCase().startsWith(m2[2].toLowerCase().slice(0,3)));
    if (mi >= 0) return `${m2[3]}-${String(mi+1).padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
  }
  return '';
}

function autoExpiryFromDate(issueDate, inspectionType, assetType) {
  if (!issueDate) return '';
  let cycle = INSPECTION_CYCLE_MONTHS[inspectionType];
  if (!cycle && assetType) cycle = DEFAULT_INSPECTION_CYCLE_MONTHS[assetType];
  if (!cycle) cycle = 12;
  const d = new Date(issueDate + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  d.setMonth(d.getMonth() + cycle);
  return d.toISOString().slice(0, 10);
}

const FIELD_MAP = [
  { key: 'asset_name', label: 'Asset Name', icon: Type, target: 'SiteAsset.name', editable: true },
  { key: 'serial_number', label: 'Serial Number', icon: Hash, target: 'SiteAsset.serial_number', editable: true },
  { key: 'asset_type', label: 'Asset Type', icon: Wrench, target: 'SiteAsset.asset_type', editable: true, isType: true },
  { key: 'equipment_type', label: 'Equipment Type', icon: Wrench, target: 'SiteAsset.equipment_type', editable: true },
  { key: 'inspection_date', label: 'Issue / Inspection Date', icon: Calendar, target: 'ServiceRecord.date', editable: true, isDate: true },
  { key: 'expiry_date', label: 'Expiry Date', icon: Calendar, target: 'ServiceRecord.resulting_expiry_date', editable: true, isDate: true, autoCalc: true },
  { key: 'inspection_type', label: 'Inspection Type', icon: ShieldCheck, target: 'ServiceRecord.record_type', editable: true, isInspection: true },
  { key: 'result', label: 'Result', icon: ShieldCheck, target: 'ServiceRecord.result', editable: true, isResult: true },
  { key: 'tested_by', label: 'Tested By', icon: User, target: 'ServiceRecord.tested_by', editable: true },
  { key: 'company', label: 'Company', icon: Building2, target: 'ServiceRecord.company', editable: true },
  { key: 'notes', label: 'Notes', icon: StickyNote, target: 'ServiceRecord.notes', editable: true, isTextarea: true },
];

export default function SmartCertImport({ onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [screen, setScreen] = useState('upload'); // upload | processing | review | success
  const [fileStatuses, setFileStatuses] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showViewer, setShowViewer] = useState(false);
  const [editing, setEditing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const { data: existingAssets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const validPreviews = useMemo(() => previews.filter(p => !p.error && !p.retrying), [previews]);
  const failedPreviews = useMemo(() => previews.map((p, i) => ({ p, i })).filter(({ p }) => p.error), [previews]);
  const newCount = validPreviews.filter(p => p.isNewAsset).length;
  const linkedCount = validPreviews.filter(p => !p.isNewAsset).length;

  const handleFiles = useCallback((fileList) => {
    const pdfs = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      toast({ title: 'No PDF files', description: 'Select PDF certificate files to import.', variant: 'destructive' });
      return;
    }
    setFiles(prev => [...prev, ...pdfs]);
  }, [toast]);

  // === Drag handlers ===
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  // === Per-file processing (same logic, stores file ref for retry) ===
  const processFile = async (file) => {
    const uploadRes = await base44.integrations.Core.UploadFile({ file });
    const fileUrl = uploadRes.file_url;
    const extractRes = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: EXTRACTION_SCHEMA,
    });
    if (extractRes.status !== 'success' || !extractRes.output) {
      throw new Error('Could not read certificate data from PDF');
    }
    const data = extractRes.output;
    const assetName = data.asset_name || file.name.replace(/\.pdf$/i, '');
    const serial = data.serial_number || '';
    const type = ['rig', 'machinery', 'trailer', 'lifting', 'portable_appliance'].includes(data.asset_type) ? data.asset_type : 'machinery';
    const inspectionDate = parseDate(data.inspection_date) || new Date().toISOString().slice(0, 10);
    const inspectionType = data.inspection_type || 'service';
    let expiryDate = parseDate(data.expiry_date);
    if (!expiryDate) expiryDate = autoExpiryFromDate(inspectionDate, inspectionType, type);
    const result = data.result || 'pass';

    let matchedAsset = null;
    let matchMethod = '';
    if (serial) {
      matchedAsset = existingAssets.find(a => a.serial_number && a.serial_number.toLowerCase() === serial.toLowerCase());
      if (matchedAsset) matchMethod = 'serial';
    }
    if (!matchedAsset) {
      matchedAsset = existingAssets.find(a => a.name.toLowerCase() === assetName.toLowerCase());
      if (matchedAsset) matchMethod = 'name';
    }

    return {
      fileName: file.name,
      file,
      fileUrl,
      fileSize: file.size,
      extracted: {
        asset_name: assetName,
        serial_number: serial,
        asset_type: type,
        equipment_type: data.equipment_type || '',
        inspection_date: inspectionDate,
        expiry_date: expiryDate,
        inspection_type: inspectionType,
        result,
        tested_by: data.tested_by || '',
        company: data.company || '',
        notes: data.notes || '',
      },
      matchedAsset,
      matchMethod,
      isNewAsset: !matchedAsset,
      autoExpiryCalculated: !parseDate(data.expiry_date),
    };
  };

  // === Parallel extraction (concurrency-limited) ===
  const handleExtract = async () => {
    setScreen('processing');
    const toProcess = files;
    setFileStatuses(toProcess.map(() => 'processing'));
    const newPreviews = new Array(toProcess.length);

    let nextIndex = 0;
    const runWorker = async () => {
      while (nextIndex < toProcess.length) {
        const i = nextIndex++;
        try {
          newPreviews[i] = await processFile(toProcess[i]);
          setFileStatuses(prev => { const n = [...prev]; n[i] = 'done'; return n; });
        } catch (e) {
          newPreviews[i] = { fileName: toProcess[i].name, file: toProcess[i], error: e.message };
          setFileStatuses(prev => { const n = [...prev]; n[i] = 'failed'; return n; });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toProcess.length) }, () => runWorker()));

    setPreviews(prev => [...prev, ...newPreviews.filter(Boolean)]);
    setScreen('review');
    queryClient.invalidateQueries({ queryKey: ['site-assets'] });
  };

  // === Retry a single failed file ===
  const retryFile = async (idx) => {
    const preview = previews[idx];
    if (!preview?.file) return;
    setPreviews(prev => prev.map((p, i) => i === idx ? { ...p, retrying: true, error: null } : p));
    try {
      const newPreview = await processFile(preview.file);
      setPreviews(prev => prev.map((p, i) => i === idx ? newPreview : p));
    } catch (e) {
      setPreviews(prev => prev.map((p, i) => i === idx ? { ...p, retrying: false, error: e.message } : p));
    }
  };

  const updatePreview = (idx, field, value) => {
    setPreviews(prev => prev.map((p, i) => {
      if (i !== idx || p.error) return p;
      const newExtracted = { ...p.extracted, [field]: value };
      if (field === 'inspection_date' || field === 'inspection_type' || field === 'asset_type') {
        if (!newExtracted.expiry_date || p.autoExpiryCalculated) {
          newExtracted.expiry_date = autoExpiryFromDate(
            newExtracted.inspection_date,
            newExtracted.inspection_type,
            newExtracted.asset_type
          );
        }
      }
      return { ...p, extracted: newExtracted };
    }));
  };

  const commitAll = async () => {
    setCommitting(true);
    let success = 0, newAssets = 0, errors = 0;
    for (const p of previews) {
      if (p.error || p.retrying) { errors++; continue; }
      try {
        const d = p.extracted;
        let asset = p.matchedAsset;
        if (!asset) {
          const status = d.expiry_date ? autoComplianceStatus(d.expiry_date) : 'unknown';
          const nextService = d.inspection_date ? autoNextServiceDate(d.inspection_date, d.asset_type) : '';
          const interval = (d.asset_type === 'rig' || d.asset_type === 'machinery')
            ? DEFAULT_SERVICE_INTERVALS[d.asset_type] : null;
          const payload = {
            name: d.asset_name,
            asset_type: d.asset_type,
            is_rig: d.asset_type === 'rig',
            rig_type: 'n/a',
            equipment_type: d.equipment_type,
            compliance_category: DEFAULT_COMPLIANCE_CATEGORIES[d.asset_type] || '',
            serial_number: d.serial_number,
            compliance_status: status,
            compliance_expiry_date: d.expiry_date || null,
            last_service_date: d.inspection_date,
            next_service_date: nextService || null,
            is_active: true,
            service_interval_hours: interval,
            operating_hours: 0,
            hours_at_last_service: 0,
            linked_equipment_ids: [],
          };
          payload.maintenance_status = autoMaintenanceStatus(payload);
          asset = await base44.entities.SiteAsset.create(payload);
          newAssets++;
        } else {
          const updates = {};
          if (d.expiry_date) {
            updates.compliance_expiry_date = d.expiry_date;
            updates.compliance_status = autoComplianceStatus(d.expiry_date);
          }
          if (d.inspection_date) updates.last_service_date = d.inspection_date;
          const nextService = autoNextServiceDate(d.inspection_date, asset.asset_type);
          if (nextService) updates.next_service_date = nextService;
          if (Object.keys(updates).length > 0) {
            await base44.entities.SiteAsset.update(asset.id, updates);
          }
        }
        await base44.entities.ServiceRecord.create({
          site_asset_id: asset.id,
          record_type: d.inspection_type,
          date: d.inspection_date,
          result: d.result,
          tested_by: d.tested_by,
          company: d.company,
          certificate_url: p.fileUrl,
          certificate_name: p.fileName,
          resulting_expiry_date: d.expiry_date || null,
          notes: d.notes,
        });
        success++;
      } catch (e) {
        errors++;
      }
    }
    setCommitting(false);
    setScreen('success');
    queryClient.invalidateQueries({ queryKey: ['site-assets'] });
    queryClient.invalidateQueries({ queryKey: ['service-records'] });
    queryClient.invalidateQueries({ queryKey: ['cert-vault'] });
    queryClient.invalidateQueries({ queryKey: ['master-cert-vault'] });
    toast({
      title: `${success} certificate(s) imported`,
      description: `${newAssets} new assets created${errors > 0 ? ` · ${errors} failed` : ''}`,
    });
  };

  const addMoreFiles = (fileList) => {
    handleFiles(fileList);
    setScreen('upload');
  };

  const currentPreview = previews[activeIdx];

  // === Helper: status badge for a preview ===
  const statusBadge = (p) => {
    if (p.error) return { label: 'Failed', cls: 'bg-red-100 text-red-700', icon: AlertTriangle };
    if (p.retrying) return { label: 'Retrying', cls: 'bg-amber-100 text-amber-700', icon: Loader2 };
    if (p.isNewAsset) return { label: 'New', cls: 'bg-blue-100 text-blue-700', icon: Sparkles };
    return { label: 'Linked', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/60 backdrop-blur-md p-0 sm:p-4 overflow-y-auto" onClick={() => !committing && onClose()}>
      <div className="bg-white w-full min-h-full sm:min-h-0 sm:max-w-5xl sm:rounded-2xl sm:shadow-xl sm:max-h-[calc(100dvh-2rem)] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              <Scan className="w-5 h-5 text-primary" /> Smart Certificate Import
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" /> AI Preview
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {screen === 'review' ? `${validPreviews.length} ready to commit · ${failedPreviews.length} failed` : 'Drop PDFs — AI reads each file and maps data to your asset fields automatically'}
            </p>
          </div>
          <button onClick={() => !committing && onClose()} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── Success screen ── */}
          {screen === 'success' ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-slate-800">Import Complete</p>
              <p className="text-sm text-slate-500 mt-1">{validPreviews.length} certificate(s) committed to the system</p>
              <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition">
                Done
              </button>
            </div>
          ) : screen === 'processing' ? (
            /* ── Processing screen — parallel progress grid ── */
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <p className="text-sm font-bold">Reading {files.length} PDFs in parallel…</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {files.map((f, i) => {
                  const st = fileStatuses[i] || 'processing';
                  return (
                    <div key={i} className={`rounded-xl border p-3 flex flex-col items-center gap-2 transition ${
                      st === 'done' ? 'bg-emerald-50 border-emerald-200' :
                      st === 'failed' ? 'bg-red-50 border-red-200' :
                      'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0">
                        {st === 'processing' ? <Loader2 className="w-5 h-5 text-slate-400 animate-spin" /> :
                         st === 'done' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                         <AlertTriangle className="w-5 h-5 text-red-500" />}
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 truncate w-full text-center">{f.name}</p>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                        st === 'done' ? 'bg-emerald-100 text-emerald-700' :
                        st === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>{st}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : screen === 'review' && !showViewer ? (
            /* ── Thumbnail grid overview ── */
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-700">{validPreviews.length} ready</span>
                {newCount > 0 && <span className="inline-flex items-center gap-1 text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500" /> {newCount} new</span>}
                {linkedCount > 0 && <span className="inline-flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {linkedCount} linked</span>}
                {failedPreviews.length > 0 && <span className="inline-flex items-center gap-1 text-red-600"><span className="w-2 h-2 rounded-full bg-red-500" /> {failedPreviews.length} failed</span>}
              </div>

              {/* Thumbnail grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {previews.map((p, i) => {
                  const badge = statusBadge(p);
                  const BadgeIcon = badge.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => { if (!p.error && !p.retrying) { setActiveIdx(i); setShowViewer(true); setEditing(false); } }}
                      disabled={p.error || p.retrying}
                      className={`relative rounded-xl border-2 p-3 flex flex-col items-center gap-2 transition text-left ${
                        p.error ? 'bg-red-50/50 border-red-200 cursor-default' :
                        p.retrying ? 'bg-amber-50/50 border-amber-200 cursor-wait' :
                        'bg-white border-slate-200 hover:border-primary hover:shadow-md cursor-pointer'
                      }`}
                    >
                      <div className="w-12 h-14 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-red-500" />
                      </div>
                      <p className="text-[11px] font-medium text-slate-600 truncate w-full text-center">{p.fileName}</p>
                      <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                        <BadgeIcon className={`w-2.5 h-2.5 ${p.retrying ? 'animate-spin' : ''}`} /> {badge.label}
                      </span>
                      {p.error && (
                        <button
                          onClick={(e) => { e.stopPropagation(); retryFile(i); }}
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700 px-2 py-1 rounded-md bg-red-100 hover:bg-red-200 transition"
                        >
                          <RotateCw className="w-3 h-3" /> Retry
                        </button>
                      )}
                    </button>
                  );
                })}
                {/* Add more tile */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed border-slate-300 p-3 flex flex-col items-center justify-center gap-2 min-h-[120px] hover:border-primary hover:bg-emerald-50/30 transition"
                >
                  <FilePlus className="w-6 h-6 text-slate-400" />
                  <span className="text-[11px] font-medium text-slate-500">Add More</span>
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={e => { if (e.target.files.length > 0) addMoreFiles(e.target.files); e.target.value = ''; }} />
            </div>
          ) : screen === 'review' && showViewer && currentPreview ? (
            /* ── Full-screen carousel viewer ── */
            <div className="space-y-3">
              {/* File chips carousel */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {previews.map((p, i) => {
                  const badge = statusBadge(p);
                  return (
                    <button key={i} onClick={() => { setActiveIdx(i); setEditing(false); }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                        i === activeIdx ? 'bg-primary text-white shadow-sm' :
                        p.error ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' :
                        'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}>
                      {i + 1}
                      {!p.error && p.isNewAsset && <span className="text-[8px] bg-blue-500 text-white px-1 rounded-full">N</span>}
                      {!p.error && !p.isNewAsset && <span className="text-[8px] bg-emerald-500 text-white px-1 rounded-full">L</span>}
                    </button>
                  );
                })}
              </div>

              {currentPreview.error ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-700">{currentPreview.fileName}</p>
                    <p className="text-xs text-red-500 mt-0.5">{currentPreview.error}</p>
                  </div>
                  <button onClick={() => retryFile(activeIdx)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition">
                    <RotateCw className="w-3.5 h-3.5" /> Retry
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* PDF Preview — swipeable */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-200">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                        <p className="text-xs font-semibold text-slate-700 truncate">{currentPreview.fileName}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">{(currentPreview.fileSize / 1024).toFixed(0)} KB</span>
                    </div>
                    <motion.div
                      key={activeIdx}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.2}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -80 && activeIdx < previews.length - 1) setActiveIdx(activeIdx + 1);
                        if (info.offset.x > 80 && activeIdx > 0) setActiveIdx(activeIdx - 1);
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15 }}
                    >
                      <iframe src={currentPreview.fileUrl} title="PDF Preview" className="w-full h-[300px] sm:h-[400px] bg-white" />
                    </motion.div>
                  </div>

                  {/* Extracted Data + Field Mapping */}
                  <div className="space-y-3">
                    <div className={`rounded-xl p-3 border flex items-center gap-2.5 ${
                      currentPreview.isNewAsset ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'
                    }`}>
                      {currentPreview.isNewAsset ? (
                        <>
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0"><Sparkles className="w-4 h-4 text-blue-600" /></div>
                          <div><p className="text-xs font-bold text-blue-700">New Asset will be created</p><p className="text-[11px] text-blue-600">No matching serial or name found</p></div>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div>
                          <div><p className="text-xs font-bold text-emerald-700">Linked to existing asset</p><p className="text-[11px] text-emerald-600">Matched by {currentPreview.matchMethod}: <span className="font-semibold">{currentPreview.matchedAsset?.name}</span></p></div>
                        </>
                      )}
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Extracted Data</p>
                        <button onClick={() => setEditing(!editing)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition ${editing ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                          <Edit3 className="w-3 h-3" /> {editing ? 'Editing' : 'Edit'}
                        </button>
                      </div>
                      {FIELD_MAP.map(field => {
                        const value = currentPreview.extracted?.[field.key] || '';
                        const Icon = field.icon;
                        const isAuto = field.autoCalc && currentPreview.autoExpiryCalculated;
                        return (
                          <div key={field.key} className="flex items-start gap-2">
                            <div className="flex items-center gap-1.5 w-32 flex-shrink-0 pt-1.5">
                              <Icon className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="text-[11px] text-slate-500 font-medium">{field.label}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              {editing && field.editable ? (
                                field.isTextarea ? (
                                  <textarea value={value} onChange={e => updatePreview(activeIdx, field.key, e.target.value)} rows={2} className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:border-primary" />
                                ) : field.isDate ? (
                                  <input type="date" value={value} onChange={e => updatePreview(activeIdx, field.key, e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:border-primary" />
                                ) : field.isType ? (
                                  <select value={value} onChange={e => updatePreview(activeIdx, field.key, e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:border-primary bg-white">
                                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                  </select>
                                ) : field.isInspection ? (
                                  <select value={value} onChange={e => updatePreview(activeIdx, field.key, e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:border-primary bg-white">
                                    {Object.entries(INSPECTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                  </select>
                                ) : field.isResult ? (
                                  <select value={value} onChange={e => updatePreview(activeIdx, field.key, e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:border-primary bg-white">
                                    <option value="pass">Pass</option><option value="fail">Fail</option><option value="advisory">Advisory</option><option value="n/a">N/A</option>
                                  </select>
                                ) : (
                                  <input type="text" value={value} onChange={e => updatePreview(activeIdx, field.key, e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:border-primary" />
                                )
                              ) : (
                                <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                                  <span className={`text-xs font-medium ${value ? 'text-slate-800' : 'text-slate-300 italic'}`}>{value || 'Not detected'}</span>
                                  {isAuto && <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full"><Sparkles className="w-2.5 h-2.5" /> Auto</span>}
                                </div>
                              )}
                              <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-0.5"><ArrowRight className="w-2 h-2" /> {field.target}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {currentPreview.autoExpiryCalculated && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-700">
                          <strong>Auto-expiry:</strong> Calculated from issue date + {INSPECTION_LABELS[currentPreview.extracted.inspection_type] || 'inspection'} cycle ({INSPECTION_CYCLE_MONTHS[currentPreview.extracted.inspection_type] || DEFAULT_INSPECTION_CYCLE_MONTHS[currentPreview.extracted.asset_type] || 12} months).
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Upload screen — drag-and-drop ── */
            <>
              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 py-12 px-6 border-2 border-dashed rounded-2xl cursor-pointer transition ${
                  dragActive ? 'border-primary bg-emerald-50/50 scale-[1.01]' : 'border-slate-300 hover:border-emerald-500 hover:bg-emerald-50/30'
                }`}
              >
                <motion.div
                  animate={dragActive ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center ${dragActive ? 'bg-primary/10' : 'bg-slate-100'}`}
                >
                  <Upload className={`w-8 h-8 ${dragActive ? 'text-primary' : 'text-slate-400'}`} />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700">{dragActive ? 'Drop your PDFs here' : 'Drag & drop PDF certificates'}</p>
                  <p className="text-xs text-slate-400 mt-1">or click to browse · AI reads each file and extracts asset data automatically</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={e => { if (e.target.files.length > 0) handleFiles(e.target.files); e.target.value = ''; }} />
              </div>

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">{files.length} PDF file(s) selected</p>
                    <button onClick={() => setFiles([])} className="text-xs text-slate-400 hover:text-red-500 transition">Clear</button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <p className="text-xs font-medium text-slate-700 truncate flex-1">{f.name}</p>
                        <p className="text-[10px] text-slate-400 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</p>
                        <button onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, idx) => idx !== i)); }} className="text-slate-300 hover:text-red-500 transition flex-shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {screen !== 'success' && (
          <div className="px-5 py-3.5 border-t border-slate-100 flex items-center gap-2 flex-shrink-0">
            {screen === 'review' && showViewer ? (
              <>
                <button onClick={() => setShowViewer(false)} className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition">
                  <ChevronLeft className="w-4 h-4" /> Grid
                </button>
                {activeIdx > 0 && (
                  <button onClick={() => { setActiveIdx(activeIdx - 1); setEditing(false); }} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                {activeIdx < previews.length - 1 && (
                  <button onClick={() => { setActiveIdx(activeIdx + 1); setEditing(false); }} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                <button onClick={commitAll} disabled={committing || validPreviews.length === 0}
                  className="ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-sm font-bold hover:brightness-110 transition disabled:opacity-50 shadow-sm">
                  {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {committing ? 'Committing...' : `Commit ${validPreviews.length}`}
                </button>
              </>
            ) : screen === 'review' ? (
              <>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="font-bold text-slate-700">{validPreviews.length}</span> ready
                  {failedPreviews.length > 0 && <span className="text-red-500">· {failedPreviews.length} failed</span>}
                </div>
                <button onClick={() => !committing && onClose()} disabled={committing} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition disabled:opacity-50">Cancel</button>
                <button onClick={commitAll} disabled={committing || validPreviews.length === 0}
                  className="ml-auto inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-sm font-bold hover:brightness-110 transition disabled:opacity-50 shadow-sm">
                  {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {committing ? 'Committing...' : `Commit ${validPreviews.length} to System`}
                </button>
              </>
            ) : screen === 'processing' ? (
              <div className="ml-auto text-xs text-slate-400">Processing in parallel…</div>
            ) : (
              <>
                <button onClick={() => !committing && onClose()} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition">Cancel</button>
                <button onClick={handleExtract} disabled={!files.length}
                  className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-sm font-semibold hover:brightness-110 transition disabled:opacity-50">
                  <Sparkles className="w-4 h-4" />
                  Read & Extract {files.length || ''} PDF{files.length !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}