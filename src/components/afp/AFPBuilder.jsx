import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  FileText, Calendar, RefreshCw, Send, ArrowRight, CheckCircle2,
  Plus, Loader2, Clock, Receipt, PoundSterling,
  MessageSquare, X, FileBarChart,
  TrendingUp, Zap, CheckSquare, Square, Trash2, Search,
  ChevronDown, ChevronRight, GitBranch, Package, Upload, ClipboardCheck, Save, Layers,
  Drill, HardHat, Hotel, Truck, MapPin,
} from 'lucide-react';
import useAutoSave from '@/hooks/useAutoSave';
import CreateFirstAFPModal from './CreateFirstAFPModal';
import AFPDatesEditor from './AFPDatesEditor';
import AFPDisputeRow from './AFPDisputeRow';
import AFPExportButtons from './AFPExportButtons';
import AFPUploadModal from '@/components/cvr/AFPUploadModal';
import AFPSummaryHeader from './AFPSummaryHeader';
import AFPDualSideTable from './AFPDualSideTable';
import AFPVariationLifecycle from './AFPVariationLifecycle';
import AFPCompensationItems from './AFPCompensationItems';
import FieldSheetBOQVsActual from './FieldSheetBOQVsActual';
import VariationBreakdownTab from './VariationBreakdownTab';
import EWRSheetTab from './EWRSheetTab';
import AddVariationModal from './AddVariationModal';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_META = {
  draft: { label: 'Draft', color: 'text-slate-600', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  pending_review: { label: 'Pending Review', color: 'text-amber-700', bg: 'bg-amber-100', dot: 'bg-amber-500' },
  submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  approved: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
  invoiced: { label: 'Invoiced', color: 'text-violet-700', bg: 'bg-violet-100', dot: 'bg-violet-500' },
};

const SOURCE_META = {
  driller_log: { label: 'Driller Log', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
  delivery: { label: 'Delivery', icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
  subcontractor: { label: 'Subcontractor', icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50' },
  timesheet: { label: 'Timesheet', icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  cost: { label: 'Daily Cost', icon: Receipt, color: 'text-rose-600', bg: 'bg-rose-50' },
  job_cost_item: { label: 'Job Cost Item', icon: FileText, color: 'text-cyan-600', bg: 'bg-cyan-50' },
  template: { label: 'Template', icon: FileBarChart, color: 'text-slate-600', bg: 'bg-slate-50' },
  manual: { label: 'Manual', icon: Plus, color: 'text-[#2E5A1A]', bg: 'bg-green-50' },
};

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'drilling', label: 'Drilling' },
  { id: 'plant_hire', label: 'Plant Hire' },
  { id: 'labour', label: 'Labour' },
  { id: 'subcontractor', label: 'Subcontractor' },
  { id: 'materials', label: 'Materials' },
  { id: 'mobilisation', label: 'Mobilisation' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'other', label: 'Other' },
];

// EWR jobs use a different AFP template with different sheets. Detected by
// job name containing 'ewr' or 'east west rail'.
const isEWRJob = (job) => /\b(ewr|east\s*west\s*rail)\b/i.test(job?.name || '');

const EWR_SHEETS = [
  { id: 'ewr_rotary_drilling', label: 'Rotary Drilling', icon: 'Drill' },
  { id: 'ewr_cp_drilling', label: 'CP Drilling', icon: 'Drill' },
  { id: 'ewr_rotary_dayworks', label: 'Rotary Dayworks', icon: 'Clock' },
  { id: 'ewr_cp_dayworks', label: 'CP Dayworks', icon: 'Clock' },
  { id: 'ewr_enabling_crew', label: 'Enabling Crew', icon: 'HardHat' },
  { id: 'ewr_accommodation', label: 'Accommodation', icon: 'Hotel' },
  { id: 'ewr_misc', label: 'Misc', icon: 'Package' },
  { id: 'ewr_hires', label: 'Hires', icon: 'Truck' },
  { id: 'ewr_mileage', label: 'Mileage', icon: 'MapPin' },
];

function weekKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

function monthKey(dateStr) {
  if (!dateStr) return '';
  return dateStr.slice(0, 7);
}

export default function AFPBuilder({ job }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedAfpId, setSelectedAfpId] = useState(null);
  const [granularity, setGranularity] = useState('week');
  const [showCreate, setShowCreate] = useState(false);
  const [populating, setPopulating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [repricing, setRepricing] = useState(false);
  const [expandedDisputes, setExpandedDisputes] = useState(new Set());
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualItem, setManualItem] = useState({ item: '', unit: 'sum', qty: 1, rate: 0, category: 'other', source_date: '' });
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState('category');
  const [activeTab, setActiveTab] = useState('measured-works');
  const [collapsedCats, setCollapsedCats] = useState(new Set());
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showDatesEditor, setShowDatesEditor] = useState(false);
  const [savingDates, setSavingDates] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [confirmDeleteAfpId, setConfirmDeleteAfpId] = useState(null);
  const [deletingAfp, setDeletingAfp] = useState(false);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAddVariation, setShowAddVariation] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [approving, setApproving] = useState(false);

  const { data: afps = [], isLoading: afpsLoading } = useQuery({
    queryKey: ['afp', job.id],
    queryFn: () => base44.entities.AFP.filter({ job_id: job.id }, 'afp_number', 50),
  });

  const selectedAfp = useMemo(() => {
    if (!afps.length) return null;
    return afps.find(a => a.id === selectedAfpId) || afps[0];
  }, [afps, selectedAfpId]);

  const ewr = isEWRJob(job);

  // When switching to an EWR job, default to the first EWR sheet tab instead
  // of the standard 'measured-works' tab (which has no EWR data).
  useEffect(() => {
    if (ewr && activeTab === 'measured-works') {
      setActiveTab(EWR_SHEETS[0].id);
    }
    if (!ewr && EWR_SHEETS.some(s => s.id === activeTab)) {
      setActiveTab('measured-works');
    }
  }, [ewr, activeTab]);

  // Auto-save hook — debounced saves on every edit + flush on AFP switch.
  // Must be called AFTER selectedAfp is defined (it depends on selectedAfp.id).
  const lineItemsQueryKey = ['afp-line-items', selectedAfp?.id];
  const { saveStatus, scheduleSave, flushPending } = useAutoSave(
    base44.entities.AFPLineItem,
    queryClient,
    lineItemsQueryKey
  );

  const { data: lineItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['afp-line-items', selectedAfp?.id],
    queryFn: () => base44.entities.AFPLineItem.filter({ afp_id: selectedAfp.id }, 'source_date', 500),
    enabled: !!selectedAfp?.id,
  });

  // Filter by category + search (display only — totals always use all items)
  const filteredItems = useMemo(() => {
    let result = lineItems;
    if (categoryFilter !== 'all') result = result.filter(li => li.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(li => String(li.item || '').toLowerCase().includes(q));
    }
    return result;
  }, [lineItems, categoryFilter, search]);

  // Category-grouped items (collapsible sections with subtotals)
  const categoryGroupedItems = useMemo(() => {
    const groups = {};
    for (const li of filteredItems) {
      const cat = li.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(li);
    }
    return CATEGORIES.filter(c => c.id !== 'all' && groups[c.id])
      .map(c => ({ id: c.id, label: c.label, items: groups[c.id] }));
  }, [filteredItems]);

  // Group filtered items by time bucket
  const groupedItems = useMemo(() => {
    const groups = {};
    for (const li of filteredItems) {
      let key;
      if (granularity === 'day') key = li.source_date || 'undated';
      else if (granularity === 'week') key = weekKey(li.source_date) || 'undated';
      else key = monthKey(li.source_date) || 'undated';
      if (!groups[key]) groups[key] = [];
      groups[key].push(li);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredItems, granularity]);

  // Totals — always computed from ALL line items (not filtered)
  const totals = useMemo(() => {
    let original = 0, disputed = 0, agreed = 0, claimed = 0, assessed = 0, balance = 0;
    for (const li of lineItems) {
      const amt = li.amount || 0;
      original += li.original_amount || amt;
      claimed += Number(li.applied_in_period) || amt;
      assessed += Number(li.assessed_in_period) || Number(li.agreed_amount) || 0;
      balance += Number(li.balance_value) || Math.max(0, (Number(li.amount) || 0) - (Number(li.gross_applied) || 0));
      if (li.dispute_status === 'disputed' || li.dispute_status === 'counter_offered') {
        disputed += amt;
      }
      if (li.dispute_status !== 'rejected') {
        agreed += li.agreed_amount || amt;
      }
    }
    return { original, disputed, agreed, claimed, assessed, balance };
  }, [lineItems]);

  const freshness = useMemo(() => {
    const sources = {};
    for (const li of lineItems) {
      if (!sources[li.source]) sources[li.source] = 0;
      sources[li.source]++;
    }
    return sources;
  }, [lineItems]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const li of lineItems) {
      const cat = li.category || 'other';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [lineItems]);

  // Variation refs — unique vo_refs from variation SUMMARY lines (not breakdowns).
  // Each ref gets its own dynamic tab in the tab bar.
  const variationRefs = useMemo(() => {
    const refs = [];
    const seen = new Set();
    for (const li of lineItems) {
      if (li.sheet_name !== 'variations' || !li.vo_ref) continue;
      if (li.is_variation_breakdown) continue;
      const ref = li.vo_ref;
      if (!seen.has(ref)) {
        seen.add(ref);
        refs.push(ref);
      }
    }
    return refs;
  }, [lineItems]);

  // Variation summary lines only (exclude breakdowns)
  const variationSummaryItems = useMemo(
    () => lineItems.filter(li => li.sheet_name === 'variations' && !li.is_variation_breakdown),
    [lineItems]
  );

  // Variations total value (from summary lines)
  const variationsTotal = useMemo(
    () => variationSummaryItems.reduce((s, li) => s + (Number(li.amount) || 0), 0),
    [variationSummaryItems]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['afp', job.id] });
    queryClient.invalidateQueries({ queryKey: ['afp-line-items', selectedAfp?.id] });
    queryClient.invalidateQueries({ queryKey: ['cvr', job.id] });
    queryClient.invalidateQueries({ queryKey: ['cvr-cash-flow', job.id] });
  };

  const handlePopulate = async () => {
    if (!selectedAfp) return;
    setPopulating(true);
    try {
      const res = await base44.functions.invoke('populateAFPFromFieldData', { afp_id: selectedAfp.id });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      invalidate();
    } catch (e) { console.error(e); }
    setPopulating(false);
  };

  const handleSubmit = async () => {
    if (!selectedAfp) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke('submitAFPToClient', { afp_id: selectedAfp.id });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      try {
        const exportRes = await base44.functions.invoke('exportAFPToExcel', { afp_id: selectedAfp.id });
        const exportData = exportRes.data || exportRes;
        if (exportData.file_url) {
          await base44.entities.AFP.update(selectedAfp.id, {
            source_file_url: exportData.file_url,
            source_file_name: exportData.file_name,
          });
        }
      } catch (exportErr) { console.error('Excel export during submit failed:', exportErr); }
      invalidate();
    } catch (e) { console.error(e); }
    setSubmitting(false);
  };

  const handlePushToCVR = async () => {
    if (!selectedAfp) return;
    setPushing(true);
    try {
      const res = await base44.functions.invoke('pushAFPToCVR', { afp_id: selectedAfp.id });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      invalidate();
    } catch (e) { console.error(e); }
    setPushing(false);
  };

  const handleReprice = async () => {
    if (!selectedAfp) return;
    setRepricing(true);
    try {
      const res = await base44.functions.invoke('repriceAFPFromRateCard', { afp_id: selectedAfp.id });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      invalidate();
    } catch (e) { console.error(e); }
    setRepricing(false);
  };

  // Auto-save wrapper: line item edits go through the debounced auto-save
  const handleLineItemUpdate = (id, updates) => {
    scheduleSave(id, updates);
  };

  const handleSubmitForReview = async () => {
    if (!selectedAfp) return;
    // Flush any pending auto-saves first so the review file has the latest figures
    await flushPending();
    setSubmittingReview(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.AFP.update(selectedAfp.id, {
        status: 'pending_review',
        review_submitted_at: new Date().toISOString(),
        review_submitted_by: user?.full_name || user?.email || '',
      });
      // Generate the Excel review file and attach it
      try {
        const exportRes = await base44.functions.invoke('exportAFPToExcel', { afp_id: selectedAfp.id });
        const exportData = exportRes.data || exportRes;
        if (exportData.file_url) {
          await base44.entities.AFP.update(selectedAfp.id, {
            source_file_url: exportData.file_url,
            source_file_name: exportData.file_name,
          });
        }
      } catch (exportErr) { console.error('Excel export during review submit failed:', exportErr); }
      invalidate();
    } catch (e) { console.error(e); }
    setSubmittingReview(false);
  };

  const handleApprove = async () => {
    if (!selectedAfp) return;
    setApproving(true);
    try {
      const user = await base44.auth.me();
      await base44.entities.AFP.update(selectedAfp.id, {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user?.full_name || user?.email || '',
        dispute_status: 'resolved',
      });
      invalidate();
    } catch (e) { console.error(e); }
    setApproving(false);
  };

  const handleAddManual = async () => {
    if (!manualItem.item || !selectedAfp) return;
    try {
      await base44.entities.AFPLineItem.create({
        afp_id: selectedAfp.id,
        job_id: job.id,
        sheet_name: 'plant_hire',
        category: manualItem.category,
        item: manualItem.item,
        unit: manualItem.unit,
        qty: Number(manualItem.qty) || 0,
        rate: Number(manualItem.rate) || 0,
        amount: (Number(manualItem.qty) || 0) * (Number(manualItem.rate) || 0),
        source: 'manual',
        source_date: manualItem.source_date || new Date().toISOString().slice(0, 10),
        is_manual: true,
        dispute_status: 'none',
        original_amount: (Number(manualItem.qty) || 0) * (Number(manualItem.rate) || 0),
        agreed_amount: (Number(manualItem.qty) || 0) * (Number(manualItem.rate) || 0),
        sort_order: lineItems.length,
      });
      setManualItem({ item: '', unit: 'sum', qty: 1, rate: 0, category: 'other', source_date: selectedAfp?.period_end_date || new Date().toISOString().slice(0, 10) });
      setShowAddManual(false);
      queryClient.invalidateQueries({ queryKey: ['afp-line-items', selectedAfp?.id] });
    } catch (e) { console.error(e); }
  };

  const handleDeleteItem = async (id) => {
    try {
      await base44.entities.AFPLineItem.delete(id);
      queryClient.invalidateQueries({ queryKey: ['afp-line-items', selectedAfp?.id] });
    } catch (e) { console.error(e); }
  };

  const handleDeleteAfp = async () => {
    if (!confirmDeleteAfpId) return;
    setDeletingAfp(true);
    try {
      // Use the backend function which runs as service role to bypass RLS
      // (line items may have been created by the auto-populate service role)
      const res = await base44.functions.invoke('deleteAFP', { afp_id: confirmDeleteAfpId });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      if (selectedAfpId === confirmDeleteAfpId) setSelectedAfpId(null);
      setConfirmDeleteAfpId(null);
      invalidate();
      toast({ title: 'AFP deleted', description: `${data.deleted_line_items || 0} line items removed.` });
    } catch (e) {
      console.error(e);
      toast({ title: 'Failed to delete AFP', description: e.message || 'Please try again.', variant: 'destructive' });
    }
    setDeletingAfp(false);
  };

  const handleBulkDeleteAll = async () => {
    if (afps.length === 0) return;
    setBulkDeleting(true);
    let errors = 0;
    for (const afp of afps) {
      try {
        const res = await base44.functions.invoke('deleteAFP', { afp_id: afp.id });
        const data = res.data || res;
        if (data.error) throw new Error(data.error);
      } catch (e) {
        errors++;
        console.error(`Failed to delete AFP ${afp.afp_number}:`, e);
      }
    }
    setSelectedAfpId(null);
    setShowBulkDelete(false);
    invalidate();
    if (errors > 0) {
      toast({ title: `${errors} AFP${errors !== 1 ? 's' : ''} failed to delete`, description: 'Some AFPs could not be removed — check the console for details.', variant: 'destructive' });
    } else {
      toast({ title: 'All AFPs deleted', description: `${afps.length} AFPs removed.` });
    }
    setBulkDeleting(false);
  };

  const toggleDispute = (id) => {
    setExpandedDisputes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Bulk selection + actions ──
  const toggleItemSelection = (id) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleBucketSelection = (items) => {
    const allSelected = items.every(li => selectedItems.has(li.id));
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (allSelected) {
        items.forEach(li => next.delete(li.id));
      } else {
        items.forEach(li => next.add(li.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedItems(new Set());

  const handleBulkDisputeAction = async (action) => {
    if (selectedItems.size === 0) return;
    setBulkActionLoading(true);
    try {
      const updates = Array.from(selectedItems).map(id => ({
        id,
        dispute_status: action,
      }));
      await base44.entities.AFPLineItem.bulkUpdate(updates);
      clearSelection();
      invalidate();
    } catch (e) { console.error(e); }
    setBulkActionLoading(false);
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    setBulkActionLoading(true);
    try {
      await Promise.all(Array.from(selectedItems).map(id => base44.entities.AFPLineItem.delete(id)));
      clearSelection();
      invalidate();
    } catch (e) { console.error(e); }
    setBulkActionLoading(false);
  };

  // ── Four-date editor + regenerate ──
  const handleDatesSave = async (dates) => {
    if (!selectedAfp) return;
    setSavingDates(true);
    try {
      await base44.entities.AFP.update(selectedAfp.id, {
        period_start_date: dates.period_start_date,
        period_end_date: dates.period_end_date,
        certification_due_date: dates.certification_due_date,
        final_payment_notice_date: dates.final_payment_notice_date,
      });
      invalidate();
      setShowDatesEditor(false);
    } catch (e) { console.error(e); }
    setSavingDates(false);
  };

  const handleRegenerate = async (dates) => {
    if (!selectedAfp) return;
    setRegenerating(true);
    try {
      await base44.entities.AFP.update(selectedAfp.id, {
        period_start_date: dates.period_start_date,
        period_end_date: dates.period_end_date,
        certification_due_date: dates.certification_due_date,
        final_payment_notice_date: dates.final_payment_notice_date,
      });
      await base44.functions.invoke('populateAFPFromFieldData', { afp_id: selectedAfp.id });
      invalidate();
      setShowDatesEditor(false);
    } catch (e) { console.error(e); }
    setRegenerating(false);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Source', 'Category', 'Description', 'Unit', 'Qty', 'Rate', 'Amount', 'Dispute Status', 'Agreed Amount'];
    const rows = lineItems.map(li => [
      li.source_date || '', li.source || '', li.category || '', li.item || '',
      li.unit || '', li.qty || 0, li.rate || 0, li.amount || 0,
      li.dispute_status || 'none', li.agreed_amount || li.amount || 0,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AFP_${job.name}_${selectedAfp?.afp_number || 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Empty state: no AFPs yet ──
  if (!afpsLoading && afps.length === 0) {
    return (
      <>
        <div className="insight-card rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#2E5A1A] to-[#8DC63F]" />
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-[#2E5A1A]" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No AFPs yet</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            Create the first Application for Payment to start the monthly billing chain.
            It will auto-populate with live field data — driller logs, deliveries, subcontractors —
            from the job's start date, priced against your rate card.
          </p>
          <div className="flex items-center justify-center gap-2 mb-5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold">
              <FileText className="w-3 h-3" /> Driller logs auto-priced
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
              <Zap className="w-3 h-3" /> Rate card linked
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-[11px] font-semibold">
              <TrendingUp className="w-3 h-3" /> CVR auto-generated
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-sm font-bold transition active:scale-95 shadow-sm glow-brand"
            >
              <Plus className="w-4 h-4" /> Create First AFP
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl text-sm font-bold transition active:scale-95 shadow-sm"
            >
              <Upload className="w-4 h-4" /> Upload AFP Excel
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Tip: AFPs auto-create when the rota is published and the job goes live.
          </p>
        </div>
        {showCreate && <CreateFirstAFPModal job={job} onClose={() => setShowCreate(false)} onCreated={(id) => { setSelectedAfpId(id); invalidate(); }} />}
        {showUpload && <AFPUploadModal job={job} onClose={() => setShowUpload(false)} />}
      </>
    );
  }

  if (afpsLoading || itemsLoading) {
    return <div className="insight-card rounded-2xl p-8 text-center"><Loader2 className="w-6 h-6 text-slate-400 animate-spin mx-auto" /></div>;
  }

  const statusMeta = selectedAfp ? STATUS_META[selectedAfp.status] : STATUS_META.draft;
  const canSelect = selectedAfp?.status === 'submitted' || selectedAfp?.status === 'draft' || selectedAfp?.status === 'pending_review';

  return (
    <div className="space-y-3">
      {/* ── AFP Chain Selector ── */}
      <div className="insight-card rounded-2xl p-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {afps.map(afp => {
            const meta = STATUS_META[afp.status];
            const isActive = selectedAfp?.id === afp.id;
            return (
              <div key={afp.id} className="flex-shrink-0 flex items-center gap-1 group">
                <button
                  onClick={async () => {
                    const oldAfpId = selectedAfp?.id;
                    await flushPending();
                    // Invalidate the old AFP's line-items cache so switching back
                    // refetches fresh data from the server (not stale cache).
                    if (oldAfpId && oldAfpId !== afp.id) {
                      queryClient.invalidateQueries({ queryKey: ['afp-line-items', oldAfpId] });
                    }
                    setSelectedAfpId(afp.id);
                    clearSelection();
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition active:scale-95 ${
                    isActive ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                  AFP {afp.afp_number}
                  <span className={`text-[10px] ${isActive ? 'text-white/60' : 'text-slate-400'}`}>
                    {afp.period_end_date ? fmtDate(afp.period_end_date) : 'Open'}
                  </span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteAfpId(afp.id); }}
                  className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition active:scale-90"
                  title="Remove AFP"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          <button
            onClick={() => setShowCreate(true)}
            className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 text-slate-500 hover:bg-slate-100 border border-dashed border-slate-300 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
          {afps.length > 0 && (
            <button
              onClick={() => setShowBulkDelete(true)}
              className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete All
            </button>
          )}
        </div>
      </div>

      {/* ── AFP Visual Summary Header ── */}
      {selectedAfp && (
        <>
        <AFPSummaryHeader afp={selectedAfp} job={job} totals={totals} lineItems={lineItems} categoryCounts={categoryCounts} freshness={freshness} />

        {/* Action bar with buttons + auto-save */}
        <div className="insight-card rounded-2xl p-3">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedAfp.status === 'draft' && (
              <button onClick={handlePopulate} disabled={populating}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50">
                {populating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Refresh from Field</span>
                <span className="sm:hidden">Refresh</span>
              </button>
            )}
            {selectedAfp.status === 'draft' && (
              <button onClick={handleReprice} disabled={repricing}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-50">
                {repricing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Re-price</span>
                <span className="sm:hidden">Re-price</span>
              </button>
            )}
            {selectedAfp.status === 'draft' && (
              <button onClick={handleSubmitForReview} disabled={submittingReview}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-amber-500 to-amber-700 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm disabled:opacity-50">
                {submittingReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                Submit for Review
              </button>
            )}
            {selectedAfp.status === 'pending_review' && (
              <button onClick={handleApprove} disabled={approving}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm disabled:opacity-50">
                {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Approve
              </button>
            )}
            {selectedAfp.status === 'approved' && (
              <button onClick={handlePushToCVR} disabled={pushing}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm disabled:opacity-50">
                {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                Push to CVR
              </button>
            )}
            <AFPExportButtons afp={selectedAfp} job={job} />
            <button onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gradient-to-br from-blue-600 to-blue-800 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm">
              <Upload className="w-3.5 h-3.5" /> Upload AFP
            </button>
            <button onClick={() => setShowDatesEditor(true)}
              className="inline-flex items-center gap-1 px-3 py-2 bg-slate-50 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold transition active:scale-95 border border-slate-200">
              <Calendar className="w-3.5 h-3.5" /> Edit Dates
            </button>

            {/* Auto-save + freshness indicators */}
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {saveStatus !== 'idle' && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  saveStatus === 'saving' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
                </span>
              )}
              {selectedAfp.last_populated_at && (
                <span className="text-[10px] text-slate-400">
                  Refreshed {new Date(selectedAfp.last_populated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>
        </>
      )}

      {/* ── AFP Tab Navigation ── */}
      <div className="insight-card rounded-2xl p-2">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(ewr ? [
            ...EWR_SHEETS.map(s => ({ id: s.id, label: s.label, icon: { Drill, Clock, HardHat, Hotel, Package, Truck, MapPin }[s.icon] || Package, count: lineItems.filter(li => li.sheet_name === s.id).length })),
            { id: 'variations', label: 'Variations', icon: GitBranch, count: variationSummaryItems.length },
            ...variationRefs.map(ref => ({ id: `vo-${ref}`, label: ref, icon: GitBranch, count: lineItems.filter(li => li.sheet_name === 'variations' && li.vo_ref === ref && li.is_variation_breakdown).length, isRef: true })),
            { id: 'all-lines', label: 'All Lines', icon: Layers, count: lineItems.length },
          ] : [
            { id: 'measured-works', label: 'Measured Works', icon: FileText, count: lineItems.filter(li => li.sheet_name === 'measured_works').length },
            { id: 'field-sheet', label: 'Field Sheet', icon: Layers, count: lineItems.filter(li => li.sheet_name === 'measured_works').length },
            { id: 'variations', label: 'Variations', icon: GitBranch, count: variationSummaryItems.length },
            ...variationRefs.map(ref => ({ id: `vo-${ref}`, label: ref, icon: GitBranch, count: lineItems.filter(li => li.sheet_name === 'variations' && li.vo_ref === ref && li.is_variation_breakdown).length, isRef: true })),
            { id: 'compensation', label: 'Compensation', icon: Package, count: lineItems.filter(li => li.sheet_name === 'compensation_item').length },
            { id: 'materials', label: 'Materials', icon: Package, count: lineItems.filter(li => li.sheet_name === 'materials').length },
            { id: 'all-lines', label: 'All Lines', icon: Layers, count: lineItems.length },
          ]).map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                  isActive
                    ? tab.isRef ? 'bg-violet-600 text-white shadow-sm' : 'bg-[#2E5A1A] text-white shadow-sm'
                    : tab.isRef ? 'text-violet-600 hover:bg-violet-50' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-white/20' : tab.isRef ? 'bg-violet-100' : 'bg-slate-100'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── All Lines: search + group controls + add line ── */}
      {activeTab === 'all-lines' && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search line items…"
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-[#2E5A1A]"
            />
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {CATEGORIES.map(cat => {
              const count = cat.id === 'all' ? lineItems.length : (categoryCounts[cat.id] || 0);
              if (cat.id !== 'all' && count === 0) return null;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${categoryFilter === cat.id ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            <button onClick={() => setGroupBy('category')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${groupBy === 'category' ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>By Category</button>
            <button onClick={() => setGroupBy('time')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${groupBy === 'time' ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>By Time</button>
          </div>
          {groupBy === 'time' && (
            <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
              {['day', 'week', 'month'].map(g => (
                <button key={g} onClick={() => setGranularity(g)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${granularity === g ? 'bg-white text-[#2E5A1A] shadow-sm' : 'text-slate-500'}`}>{g}</button>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              if (!showAddManual) setManualItem(p => ({ ...p, source_date: selectedAfp?.period_end_date || new Date().toISOString().slice(0, 10) }));
              setShowAddManual(!showAddManual);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> Add Line
          </button>
        </div>
      )}

      {/* ── Bulk Action Toolbar ── */}
      {selectedItems.size > 0 && (
        <div className="insight-card rounded-2xl p-3 bg-[#2E5A1A]/5 border-[#2E5A1A]/20 flex items-center justify-between gap-2 flex-wrap animate-slide-up">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2E5A1A] text-white text-xs font-bold">
              {selectedItems.size} selected
            </span>
            <button onClick={clearSelection} className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition">
              Clear
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(selectedAfp?.status === 'pending_review' || selectedAfp?.status === 'submitted') && (
              <>
                <button
                  onClick={() => handleBulkDisputeAction('agreed')}
                  disabled={bulkActionLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold transition active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Agree
                </button>
                <button
                  onClick={() => handleBulkDisputeAction('disputed')}
                  disabled={bulkActionLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold transition active:scale-95 disabled:opacity-50"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Dispute
                </button>
                <button
                  onClick={() => handleBulkDisputeAction('rejected')}
                  disabled={bulkActionLoading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold transition active:scale-95 disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
              </>
            )}
            {selectedAfp?.status === 'draft' && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkActionLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500 text-white rounded-lg text-xs font-bold transition active:scale-95 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Add Manual Line ── */}
      {showAddManual && (
        <div className="insight-card rounded-2xl p-3 sm:p-4 space-y-3">
          {/* Mobile: stacked layout */}
          <div className="sm:hidden space-y-2">
            <input
              type="text"
              placeholder="Description"
              value={manualItem.item}
              onChange={e => setManualItem(p => ({ ...p, item: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={manualItem.category}
                onChange={e => setManualItem(p => ({ ...p, category: e.target.value }))}
                className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm"
              >
                <option value="drilling">Drilling</option>
                <option value="plant_hire">Plant Hire</option>
                <option value="labour">Labour</option>
                <option value="subcontractor">Subcontractor</option>
                <option value="materials">Materials</option>
                <option value="mobilisation">Mobilisation</option>
                <option value="delivery">Delivery</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                placeholder="Unit (e.g. m, Day, Sum)"
                value={manualItem.unit}
                onChange={e => setManualItem(p => ({ ...p, unit: e.target.value }))}
                className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Qty"
                value={manualItem.qty}
                onChange={e => setManualItem(p => ({ ...p, qty: e.target.value }))}
                className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm"
              />
              <input
                type="number"
                placeholder="Rate (£)"
                value={manualItem.rate}
                onChange={e => setManualItem(p => ({ ...p, rate: e.target.value }))}
                className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide mb-1 px-1">
                Date {selectedAfp?.period_start_date && selectedAfp?.period_end_date && (
                  <span className="normal-case font-medium">· Period {fmtDate(selectedAfp.period_start_date)} → {fmtDate(selectedAfp.period_end_date)}</span>
                )}
              </p>
              <input
                type="date"
                value={manualItem.source_date}
                onChange={e => setManualItem(p => ({ ...p, source_date: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-slate-400">Amount:</span>
              <span className="text-sm font-bold text-slate-800 tabular-nums">{fmt((Number(manualItem.qty) || 0) * (Number(manualItem.rate) || 0))}</span>
            </div>
          </div>
          {/* Desktop: grid layout */}
          <div className="hidden sm:grid grid-cols-12 gap-2">
            <input
              type="text"
              placeholder="Description"
              value={manualItem.item}
              onChange={e => setManualItem(p => ({ ...p, item: e.target.value }))}
              className="col-span-4 px-3 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <select
              value={manualItem.category}
              onChange={e => setManualItem(p => ({ ...p, category: e.target.value }))}
              className="col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            >
              <option value="drilling">Drilling</option>
              <option value="plant_hire">Plant Hire</option>
              <option value="labour">Labour</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="materials">Materials</option>
              <option value="mobilisation">Mobilisation</option>
              <option value="delivery">Delivery</option>
              <option value="other">Other</option>
            </select>
            <input
              type="text"
              placeholder="Unit"
              value={manualItem.unit}
              onChange={e => setManualItem(p => ({ ...p, unit: e.target.value }))}
              className="col-span-1 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <input
              type="number"
              placeholder="Qty"
              value={manualItem.qty}
              onChange={e => setManualItem(p => ({ ...p, qty: e.target.value }))}
              className="col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <input
              type="number"
              placeholder="Rate"
              value={manualItem.rate}
              onChange={e => setManualItem(p => ({ ...p, rate: e.target.value }))}
              className="col-span-2 px-2 py-2 border border-slate-200 rounded-lg text-xs"
            />
            <div className="col-span-1 flex items-center px-2 text-xs font-bold text-slate-700 tabular-nums">
              {fmt((Number(manualItem.qty) || 0) * (Number(manualItem.rate) || 0))}
            </div>
          </div>
          {/* Date row with period hint */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wide">Line Date</span>
              {selectedAfp?.period_start_date && selectedAfp?.period_end_date && (
                <span className="text-[10px] text-slate-400 font-medium">
                  · Period {fmtDate(selectedAfp.period_start_date)} → {fmtDate(selectedAfp.period_end_date)}
                </span>
              )}
            </div>
            <input
              type="date"
              value={manualItem.source_date}
              onChange={e => setManualItem(p => ({ ...p, source_date: e.target.value }))}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs w-44"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAddManual(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
            <button onClick={handleAddManual} disabled={!manualItem.item} className="px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-xs font-bold disabled:opacity-50">Add</button>
          </div>
        </div>
      )}

      {/* ── Measured Works tab (dual-side table) ── */}
      {activeTab === 'measured-works' && (
        <AFPDualSideTable key={selectedAfp?.id} afp={selectedAfp} lineItems={lineItems} canEdit={selectedAfp?.status === 'draft' || selectedAfp?.status === 'pending_review'} onAutoSave={scheduleSave} />
      )}

      {/* ── Field Sheet tab (BOQ vs Actual side-by-side) ── */}
      {activeTab === 'field-sheet' && (
        <FieldSheetBOQVsActual afp={selectedAfp} lineItems={lineItems} />
      )}

      {/* ── Variation breakdown tabs (one per ref) ── */}
      {variationRefs.map(ref => {
        const tabId = `vo-${ref}`;
        if (activeTab !== tabId) return null;
        return (
          <VariationBreakdownTab
            key={ref}
            afp={selectedAfp}
            job={job}
            voRef={ref}
            lineItems={lineItems}
            canEdit={selectedAfp?.status === 'draft' || selectedAfp?.status === 'pending_review'}
            onAutoSave={scheduleSave}
          />
        );
      })}

      {/* ── Variations tab ── */}
      {activeTab === 'variations' && (
        <div className="space-y-3">
          {/* Stat pills */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="relative overflow-hidden rounded-xl stat-gradient-violet text-white px-3 py-3 shadow-sm">
              <p className="text-[10px] text-white/70 uppercase font-bold tracking-wide">Total Value</p>
              <p className="text-lg sm:text-xl font-extrabold tabular-nums mt-0.5">
                <AnimatedNumber value={variationsTotal} format={(v) => fmt(v)} />
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl stat-gradient-blue text-white px-3 py-3 shadow-sm">
              <p className="text-[10px] text-white/70 uppercase font-bold tracking-wide">Variations</p>
              <p className="text-lg sm:text-xl font-extrabold tabular-nums mt-0.5">
                <AnimatedNumber value={variationSummaryItems.length} />
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl stat-gradient-amber text-white px-3 py-3 shadow-sm">
              <p className="text-[10px] text-white/70 uppercase font-bold tracking-wide">Without Breakdown</p>
              <p className="text-lg sm:text-xl font-extrabold tabular-nums mt-0.5">
                <AnimatedNumber value={variationRefs.filter(ref => !lineItems.some(li => li.vo_ref === ref && li.is_variation_breakdown)).length} />
              </p>
            </div>
          </div>

          {/* Add Variation button */}
          {(selectedAfp?.status === 'draft' || selectedAfp?.status === 'pending_review') && (
            <button
              onClick={() => setShowAddVariation(true)}
              className="w-full insight-card rounded-2xl p-3 flex items-center justify-center gap-2 bg-violet-50 border-violet-200 hover:bg-violet-100/80 transition active:scale-[0.99]"
            >
              <Plus className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-bold text-violet-700">Add Variation</span>
              <span className="text-[11px] text-violet-400">— client instructed extra work</span>
            </button>
          )}

          {variationSummaryItems.length === 0 ? (
            <div className="insight-card rounded-2xl p-6 text-center">
              <GitBranch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No variations in this AFP</p>
              <p className="text-[11px] text-slate-400 mt-1">Click "Add Variation" above when the client instructs extra work.</p>
            </div>
          ) : (
            <div className="insight-card rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-violet-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Variation Summary</h3>
                <span className="text-[10px] text-slate-400">({variationSummaryItems.length} lines)</span>
              </div>
              <div className="divide-y divide-slate-100">
                {variationSummaryItems.map((li) => {
                  const hasBreakdown = lineItems.some(b => b.vo_ref === li.vo_ref && b.is_variation_breakdown);
                  return (
                    <div key={li.id}>
                      <div className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {li.vo_ref && (
                            <button
                              onClick={() => setActiveTab(`vo-${li.vo_ref}`)}
                              className="px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-mono font-bold flex-shrink-0 hover:bg-violet-200 transition"
                              title="Open breakdown tab"
                            >
                              {li.vo_ref}
                            </button>
                          )}
                          <span className="text-xs font-medium text-slate-700 truncate">{li.item}</span>
                          {hasBreakdown ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-bold flex-shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Breakdown
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-bold flex-shrink-0">No breakdown</span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-700 tabular-nums flex-shrink-0">{fmt(li.amount)}</span>
                      </div>
                      <AFPVariationLifecycle item={li} canEdit={selectedAfp?.status === 'draft' || selectedAfp?.status === 'pending_review'} onAutoSave={scheduleSave} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Compensation tab ── */}
      {activeTab === 'compensation' && <AFPCompensationItems lineItems={lineItems} />}

      {/* ── Materials tab ── */}
      {activeTab === 'materials' && (
        <div className="space-y-3">
          {lineItems.filter(li => li.sheet_name === 'materials').length === 0 ? (
            <div className="insight-card rounded-2xl p-6 text-center">
              <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No materials in this AFP</p>
            </div>
          ) : (
            <div className="insight-card rounded-2xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Materials On Site</h3>
                <span className="text-[10px] text-slate-400">({lineItems.filter(li => li.sheet_name === 'materials').length} lines)</span>
              </div>
              <div className="divide-y divide-slate-100">
                {lineItems.filter(li => li.sheet_name === 'materials').map((li) => (
                  <div key={li.id} className="px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-700 truncate">{li.item}</p>
                      <p className="text-[10px] text-slate-400">{li.qty} {li.unit} @ {fmt(li.rate)}</p>
                    </div>
                    <span className="text-xs font-bold text-slate-700 tabular-nums flex-shrink-0">{fmt(li.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EWR Sheet Tabs (one per EWR sheet) ── */}
      {ewr && EWR_SHEETS.some(s => s.id === activeTab) && (
        <EWRSheetTab
          sheetName={activeTab}
          lineItems={lineItems}
          afp={selectedAfp}
          canEdit={selectedAfp?.status === 'draft' || selectedAfp?.status === 'pending_review'}
          canDispute={selectedAfp?.status === 'pending_review' || selectedAfp?.status === 'submitted'}
          canSelect={canSelect}
          selectedItems={selectedItems}
          onToggleSelect={toggleItemSelection}
          onAutoSave={scheduleSave}
          onDelete={handleDeleteItem}
        />
      )}

      {/* ── Category-grouped view (collapsible sections with subtotals) ── */}
      {activeTab === 'all-lines' && groupBy === 'category' && (
        <div className="space-y-2.5">
          {categoryGroupedItems.length === 0 ? (
            <div className="insight-card rounded-2xl p-6 text-center">
              <p className="text-sm text-slate-400">{search ? 'No items match your search' : 'No items in this category'}</p>
            </div>
          ) : (
            categoryGroupedItems.map(cat => {
              const catTotal = cat.items.reduce((s, li) => s + (li.agreed_amount != null ? Number(li.agreed_amount) : (li.amount || 0)), 0);
              const isCollapsed = collapsedCats.has(cat.id);
              const allCatSelected = cat.items.every(li => selectedItems.has(li.id));
              return (
                <div key={cat.id} className="insight-card rounded-2xl overflow-hidden">
                  <div className="px-3 py-2.5 bg-slate-100/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {canSelect && (
                        <button onClick={() => toggleBucketSelection(cat.items)} className="flex-shrink-0 active:scale-95 transition">
                          {allCatSelected ? <CheckSquare className="w-4 h-4 text-[#2E5A1A]" /> : <Square className="w-4 h-4 text-slate-300" />}
                        </button>
                      )}
                      <button onClick={() => setCollapsedCats(prev => { const n = new Set(prev); n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id); return n; })} className="flex items-center gap-1.5 active:scale-95 transition">
                        {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">{cat.label}</span>
                        <span className="text-[10px] text-slate-400">({cat.items.length})</span>
                      </button>
                    </div>
                    <span className="font-bold text-slate-700 text-xs tabular-nums">{fmt(catTotal)}</span>
                  </div>
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-50">
                      {cat.items.map(li => (
                        <AFPDisputeRow
                          key={li.id}
                          item={li}
                          mobile
                          canEdit={selectedAfp.status === 'draft'}
                          canDispute={selectedAfp.status === 'pending_review' || selectedAfp.status === 'submitted'}
                          canSelect={canSelect}
                          selected={selectedItems.has(li.id)}
                          onSelect={() => toggleItemSelection(li.id)}
                          expanded={expandedDisputes.has(li.id)}
                          onToggleDispute={() => toggleDispute(li.id)}
                          onUpdate={(updates) => handleLineItemUpdate(li.id, updates)}
                          onAutoSave={scheduleSave}
                          onDelete={() => handleDeleteItem(li.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Line Items — Mobile card view (time-grouped) ── */}
      {activeTab === 'all-lines' && groupBy === 'time' && (
      <div className="sm:hidden space-y-3">
        {groupedItems.length === 0 ? (
          <div className="insight-card rounded-2xl p-6 text-center">
            <p className="text-sm text-slate-400">No items in this category</p>
          </div>
        ) : (
          groupedItems.map(([bucket, items]) => {
            const bucketTotal = items.reduce((s, li) => s + (li.amount || 0), 0);
            const bucketLabel = bucket === 'undated' ? 'Undated' :
              granularity === 'day' ? fmtDate(bucket) :
              granularity === 'week' ? `Week of ${fmtDate(bucket)}` :
              new Date(bucket + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
            const allBucketSelected = items.every(li => selectedItems.has(li.id));
            return (
              <div key={bucket} className="insight-card rounded-2xl overflow-hidden">
                <div className="px-3 py-2 bg-slate-100/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {canSelect && (
                      <button onClick={() => toggleBucketSelection(items)} className="flex-shrink-0 active:scale-95 transition">
                        {allBucketSelected ? <CheckSquare className="w-4 h-4 text-[#2E5A1A]" /> : <Square className="w-4 h-4 text-slate-300" />}
                      </button>
                    )}
                    <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wide">{bucketLabel}</span>
                  </div>
                  <span className="font-bold text-slate-700 text-xs tabular-nums">{fmt(bucketTotal)}</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {items.map((li) => (
                    <AFPDisputeRow
                      key={li.id}
                      item={li}
                      mobile
                      canEdit={selectedAfp.status === 'draft'}
                      canDispute={selectedAfp.status === 'pending_review' || selectedAfp.status === 'submitted'}
                      canSelect={canSelect}
                      selected={selectedItems.has(li.id)}
                      onSelect={() => toggleItemSelection(li.id)}
                      expanded={expandedDisputes.has(li.id)}
                      onToggleDispute={() => toggleDispute(li.id)}
                      onUpdate={(updates) => handleLineItemUpdate(li.id, updates)}
                      onAutoSave={scheduleSave}
                      onDelete={() => handleDeleteItem(li.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      )}

      {/* ── Line Items Table (grouped by time bucket) — Desktop only ── */}
      {activeTab === 'all-lines' && groupBy === 'time' && (
      <div className="insight-card rounded-2xl overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50/80 sticky top-0">
              <tr className="text-slate-500 uppercase tracking-wide text-[10px]">
                <th className="text-left px-3 py-2.5 font-semibold w-8"></th>
                <th className="text-left px-3 py-2.5 font-semibold">Source</th>
                <th className="text-left px-3 py-2.5 font-semibold">Description</th>
                <th className="text-right px-3 py-2.5 font-semibold">Unit</th>
                <th className="text-right px-3 py-2.5 font-semibold">Qty</th>
                <th className="text-right px-3 py-2.5 font-semibold">Rate</th>
                <th className="text-right px-3 py-2.5 font-semibold">Amount</th>
                <th className="text-center px-3 py-2.5 font-semibold">Dispute</th>
                <th className="text-right px-3 py-2.5 font-semibold w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {groupedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-400">No items in this category</td>
                </tr>
              ) : (
                groupedItems.map(([bucket, items]) => {
                  const bucketTotal = items.reduce((s, li) => s + (li.amount || 0), 0);
                  const bucketLabel = bucket === 'undated' ? 'Undated' :
                    granularity === 'day' ? fmtDate(bucket) :
                    granularity === 'week' ? `Week of ${fmtDate(bucket)}` :
                    new Date(bucket + '-01').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                  const allBucketSelected = items.every(li => selectedItems.has(li.id));
                  return (
                    <React.Fragment key={bucket}>
                      <tr className="bg-slate-100/60">
                        <td className="px-3 py-1.5">
                          {canSelect && (
                            <button onClick={() => toggleBucketSelection(items)} className="transition active:scale-95">
                              {allBucketSelected ? <CheckSquare className="w-4 h-4 text-[#2E5A1A]" /> : <Square className="w-4 h-4 text-slate-300" />}
                            </button>
                          )}
                        </td>
                        <td colSpan={4} className="px-3 py-1.5 font-bold text-slate-700 text-[11px] uppercase tracking-wide">
                          {bucketLabel} — {items.length} items
                        </td>
                        <td className="text-right px-3 py-1.5 font-bold text-slate-700 tabular-nums">{fmt(bucketTotal)}</td>
                        <td colSpan={3}></td>
                      </tr>
                      {items.map((li) => (
                        <AFPDisputeRow
                          key={li.id}
                          item={li}
                          canEdit={selectedAfp.status === 'draft'}
                          canDispute={selectedAfp.status === 'pending_review' || selectedAfp.status === 'submitted'}
                          canSelect={canSelect}
                          selected={selectedItems.has(li.id)}
                          onSelect={() => toggleItemSelection(li.id)}
                          expanded={expandedDisputes.has(li.id)}
                          onToggleDispute={() => toggleDispute(li.id)}
                          onUpdate={(updates) => handleLineItemUpdate(li.id, updates)}
                          onAutoSave={scheduleSave}
                          onDelete={() => handleDeleteItem(li.id)}
                        />
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-slate-50/80 border-t-2 border-slate-200 sticky bottom-0">
              <tr className="font-bold text-slate-800">
                <td colSpan={6} className="px-3 py-2.5">AFP Total</td>
                <td className="text-right px-3 py-2.5 tabular-nums">{fmt(totals.agreed)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      )}

      {/* Spacer for sticky bar — increased to clear sticky bar + safe area */}
      <div className="h-28" />

      {/* ── Sticky Running Total Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-4 py-2.5 flex items-center justify-between safe-area-bottom">
        <div className="flex items-center gap-3 sm:gap-4">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Agreed Total</p>
            <p className="text-lg sm:text-xl font-bold text-emerald-700 tabular-nums">{fmt(totals.agreed)}</p>
          </div>
          {totals.disputed > 0 && (
            <div>
              <p className="text-[10px] text-amber-500 uppercase font-semibold">Disputed</p>
              <p className="text-lg sm:text-xl font-bold text-amber-600 tabular-nums">{fmt(totals.disputed)}</p>
            </div>
          )}
          {selectedAfp?.contract_value > 0 && (
            <div className="hidden sm:block pl-4 border-l border-slate-200">
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Contract</p>
              <p className="text-sm font-bold text-slate-600 tabular-nums">{fmt(selectedAfp.contract_value)}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:inline">{lineItems.length} items</span>
          {selectedAfp?.status === 'pending_review' && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-sm disabled:opacity-50"
            >
              {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Approve</span><span className="sm:hidden">Approve</span>
            </button>
          )}
        </div>
      </div>

      {showCreate && <CreateFirstAFPModal job={job} onClose={() => setShowCreate(false)} onCreated={(id) => { setSelectedAfpId(id); invalidate(); }} />}

      {confirmDeleteAfpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={() => !deletingAfp && setConfirmDeleteAfpId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Remove AFP?</h3>
                <p className="text-xs text-slate-500 mt-0.5">This permanently deletes the AFP and all its line items.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setConfirmDeleteAfpId(null)}
                disabled={deletingAfp}
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAfp}
                disabled={deletingAfp}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold transition active:scale-95 disabled:opacity-50"
              >
                {deletingAfp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Remove AFP
              </button>
            </div>
          </div>
        </div>
      )}

      {showDatesEditor && selectedAfp && (
        <AFPDatesEditor
          afp={selectedAfp}
          onClose={() => setShowDatesEditor(false)}
          onSave={handleDatesSave}
          onRegenerate={handleRegenerate}
          saving={savingDates}
          regenerating={regenerating}
        />
      )}

      {showBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4" onClick={() => !bulkDeleting && setShowBulkDelete(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 animate-pop-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete All AFPs?</h3>
                <p className="text-xs text-slate-500 mt-0.5">This permanently deletes all {afps.length} AFPs and their line items for this job.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowBulkDelete(false)}
                disabled={bulkDeleting}
                className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDeleteAll}
                disabled={bulkDeleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold transition active:scale-95 disabled:opacity-50"
              >
                {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete All ({afps.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpload && <AFPUploadModal job={job} onClose={() => setShowUpload(false)} />}

      {showAddVariation && (
        <AddVariationModal
          afp={selectedAfp}
          job={job}
          existingRefs={variationRefs}
          onClose={() => setShowAddVariation(false)}
          onCreated={(ref) => { setActiveTab(`vo-${ref}`); invalidate(); }}
        />
      )}
    </div>
  );
}