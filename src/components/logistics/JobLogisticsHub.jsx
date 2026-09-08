import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Boxes, Plus, FileCheck, Undo2, ExternalLink, User, Truck, X, Loader2, Package, QrCode, ShoppingCart, Layers, Hammer
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, eachDayOfInterval, isWeekend } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { SITE_OPEN_TIME, SITE_CLOSE_TIME } from '@/utils/siteHours';
import EquipmentForm from '@/components/EquipmentForm';
import LifecycleBar from '@/components/logistics/LifecycleBar';
import LogisticsItemRow from '@/components/logistics/LogisticsItemRow';
import LoadPlannerModal from '@/components/logistics/LoadPlannerModal';
import DeliveryList from '@/components/logistics/DeliveryList';
import RigAssemblyGroup from '@/components/logistics/RigAssemblyGroup';
import RigGearPickerModal from '@/components/logistics/RigGearPickerModal';
import AddBillableItemsWizard from '@/components/logistics/wizard/AddBillableItemsWizard';
import PoGroupedAccordion from '@/components/logistics/PoGroupedAccordion';
import HubDeepLink from '@/components/hubs/HubDeepLink';
import { findRigRateCardItem } from '@/components/logistics/rigRateMatcher';
import SiteManifestPDF from '@/components/logistics/SiteManifestPDF';
import { billingTotal } from '@/components/equipment/shared';
import { useBillingLock } from '@/hooks/useBillingLock';
import BillingLockBanner from '@/components/billing/BillingLockBanner';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const blankForm = () => ({
  category: 'hired_equipment', supplier_id: '', contractor_id: '', client_id: '', description: '',
  reference_number: '', responsible_person: '', site_asset_id: '', staff_id: '', po_number: '', order_slip_url: '', order_slip_name: '',
  rate_card_item_id: '', delivery_notes: '',
  start_date: '', end_date: '', unit_cost: '', quantity: '1', unit_label: 'day', men: '', vat_exempt: false, notes: '',
  already_on_site: false, on_site_signature: null
});

// Get the Monday (week_start) for a given YYYY-MM-DD date string
const getWeekStart = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday of this week
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

export default function JobLogisticsHub({ jobId, job, suppliers: externalSuppliers = [], contractors = [], canSeeCosts = true, isDrillingJob = false }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: items = [] } = useQuery({ queryKey: ['job-cost-items', jobId], queryFn: () => base44.entities.JobCostItem.filter({ job_id: jobId }) });
  const { data: deliveries = [] } = useQuery({
    queryKey: ['job-deliveries', jobId],
    queryFn: async () => { const list = await base44.entities.DeliveryLog.filter({ job_id: jobId }); return list.sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date)); }
  });
  const { data: staff = [] } = useQuery({ queryKey: ['staff-logistics'], queryFn: () => base44.entities.Staff.filter({ is_active: true }) });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles-logistics'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: siteAssets = [] } = useQuery({ queryKey: ['site-assets-logistics'], queryFn: () => base44.entities.SiteAsset.list('-created_date', 500) });
  const { data: catalogueItems = [] } = useQuery({
    queryKey: ['equipment-catalogue-active'],
    queryFn: async () => { const list = await base44.entities.EquipmentCatalogue.filter({ is_active: true }, '-created_date', 500); return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.description || '').localeCompare(b.description || '')); }
  });
  const { data: fetchedSuppliers = [] } = useQuery({ queryKey: ['suppliers-logistics'], queryFn: () => base44.entities.Supplier.list(), enabled: !externalSuppliers || externalSuppliers.length === 0 });
  const suppliers = externalSuppliers.length > 0 ? externalSuppliers : fetchedSuppliers;
  const { data: rateCardItems = [] } = useQuery({ queryKey: ['rate-card-items-logistics'], queryFn: () => base44.entities.RateCardItem.list('-created_date', 500) });
  const { data: clients = [] } = useQuery({ queryKey: ['clients-logistics'], queryFn: () => base44.entities.Client.list() });
  const { data: equipmentCompliance = [] } = useQuery({ queryKey: ['equipment-compliance-logistics'], queryFn: () => base44.entities.ComplianceItem.filter({ category: 'equipment' }) });
  // Fetch all rig assignments across active jobs so we can exclude rigs already
  // on another job from the rig picker — prevents a rig being double-booked.
  const { data: allRigAssignments = [] } = useQuery({
    queryKey: ['all-rig-assignments'],
    queryFn: () => base44.entities.JobAssetAssignment.filter({ role: 'primary_rig', status: { $in: ['assigned', 'on_site'] } }),
  });
  const ownedAssets = (siteAssets || []).filter(a => a.is_active && a.asset_type !== 'rig' && a.stock_level !== 'out_of_stock' && a.stock_level !== 'needs_service');

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showLoadPlanner, setShowLoadPlanner] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [savingItem, setSavingItem] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showBasket, setShowBasket] = useState(false);
  const [addingRigGear, setAddingRigGear] = useState(false);
  const [showRigPicker, setShowRigPicker] = useState(false);
  const [showManifest, setShowManifest] = useState(false);
  const [updatingIds, setUpdatingIds] = useState(new Set());
  const [offHiringId, setOffHiringId] = useState(null);
  const [offHireDate, setOffHireDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [offHireFile, setOffHireFile] = useState(null);
  const [uploadingOffHire, setUploadingOffHire] = useState(false);
  const offHireFileRef = useRef(null);
  const { isLocked, effectiveLocked, lockReason, tempOpen, setTempOpen } = useBillingLock(jobId, job);

  const assetMap = {};
  (siteAssets || []).forEach(a => { assetMap[a.id] = a; });
  const complianceByAssetId = {};
  (equipmentCompliance || []).forEach(ci => {
    if (ci.reference_id) {
      if (!complianceByAssetId[ci.reference_id]) complianceByAssetId[ci.reference_id] = [];
      complianceByAssetId[ci.reference_id].push(ci);
    }
  });

  // Only physical items that need loading into a van are shown in the logistics
  // list. Labour (crew), contractor-supplied and client-supplied items are
  // delivered to site by the people/contractor/client themselves — they aren't
  // loaded by our drivers, so they're excluded from the load list.
  const isLoadable = (c) => c.category !== 'labour' && c.category !== 'contractor_supplied' && c.category !== 'client_supplied';
  const activeItems = items.filter(c => (c.hire_status || 'active') !== 'off_hired').filter(isLoadable);
  const returnedItems = items.filter(c => c.hire_status === 'off_hired').filter(isLoadable);
  // Status derivation for filter pills:
  //   on_site  = hire_status active AND current_location === 'site'
  //   on_hire  = hire_status active AND current_location !== 'site' (yard/in_transit)
  //   returned = hire_status off_hired
  const onSiteItems = activeItems.filter(c => (c.current_location || 'yard') === 'site');
  const onHireItems = activeItems.filter(c => (c.current_location || 'yard') !== 'site' && c.category === 'hired_equipment');
  const statusCounts = {
    all: activeItems.length + returnedItems.length,
    on_site: onSiteItems.length,
    on_hire: onHireItems.length,
    returned: returnedItems.length,
  };
  const filterByStatus = (list) => {
    if (statusFilter === 'all') return list;
    if (statusFilter === 'on_site') return list.filter(c => (c.hire_status || 'active') !== 'off_hired' && (c.current_location || 'yard') === 'site');
    if (statusFilter === 'on_hire') return list.filter(c => (c.hire_status || 'active') !== 'off_hired' && (c.current_location || 'yard') !== 'site' && c.category === 'hired_equipment');
    if (statusFilter === 'returned') return list.filter(c => c.hire_status === 'off_hired');
    return list;
  };
  const visibleItems = statusFilter === 'returned' ? returnedItems : filterByStatus(activeItems);
  const loadableItems = items.filter(isLoadable);
  // For day-rate items, the effective billing quantity = quantity × days on
  // site (from start_date → end_date). Rigs have quantity 1, so their total
  // comes entirely from day_rate × days. Non-day-rate items use quantity only.
  const totalNet = loadableItems.reduce((s, c) => s + billingTotal(c), 0);
  // Equipment summary stats for the stat widgets at the top of the tab.
  const rigsTotal = items.filter(c => {
    const asset = c.site_asset_id ? assetMap[c.site_asset_id] : null;
    return asset?.asset_type === 'rig';
  }).reduce((s, c) => s + billingTotal(c), 0);
  const purchasedTotal = items.filter(c => c.category === 'purchased_equipment').reduce((s, c) => s + billingTotal(c), 0);
  const hiredTotal = items.filter(c => c.category === 'hired_equipment').reduce((s, c) => s + billingTotal(c), 0);
  const clientItemCount = items.filter(c => c.category === 'client_supplied').length;

  // Every rig (SiteAsset with asset_type === 'rig') gets a RigAssemblyGroup card,
  // even when it has zero linked gear — so rigs never fall through to the
  // person-group Internal Equipment list.
  const rigItemLinks = {};
  const linkedItemIds = new Set();
  for (const c of visibleItems) {
    const asset = c.site_asset_id ? assetMap[c.site_asset_id] : null;
    if (asset && asset.asset_type === 'rig') {
      const linkedIds = asset.linked_equipment_ids || [];
      const linked = linkedIds.length > 0
        ? visibleItems.filter(other => other.id !== c.id && other.site_asset_id && linkedIds.includes(other.site_asset_id))
        : [];
      rigItemLinks[c.id] = linked;
      linked.forEach(li => linkedItemIds.add(li.id));
    }
  }

  const rigAssemblyList = Object.entries(rigItemLinks).map(([rigId, linked]) => {
    const rig = visibleItems.find(c => c.id === rigId);
    if (!rig) return null;
    const asset = rig.site_asset_id ? assetMap[rig.site_asset_id] : null;
    return { rig, linked, asset };
  }).filter(Boolean);

  const assemblyItemIds = new Set();
  rigAssemblyList.forEach(a => {
    assemblyItemIds.add(a.rig.id);
    a.linked.forEach(li => assemblyItemIds.add(li.id));
  });

  const standaloneItems = visibleItems.filter(c => !assemblyItemIds.has(c.id));
  // Split standalone items: those with a po_number go into PO accordions;
  // those without stay in the existing person-grouped list.
  const poGroupedItems = standaloneItems.filter(c => c.po_number && c.po_number.trim());
  const noPoItems = standaloneItems.filter(c => !c.po_number || !c.po_number.trim());
  // Group no-PO items by responsible person, falling back to the equipment
  // category label when no person is set (instead of an "Unassigned" bucket).
  const categoryFallback = {
    hired_equipment: 'Hired Equipment',
    purchased_equipment: 'Purchased Equipment',
    internal_equipment: 'Internal Equipment',
  };
  const personGroups = noPoItems.reduce((acc, c) => {
    const person = c.responsible_person || categoryFallback[c.category] || 'Unassigned';
    if (!acc[person]) acc[person] = [];
    acc[person].push(c);
    return acc;
  }, {});

  // Rigs sourced from SiteAsset (synced from Asset Panda). is_rig is the single
  // source of truth for rig identity — the legacy asset_type === 'rig' fallback
  // is dropped so equipment that merely has "Rig" in its name can't leak into the
  // picker. Exclude rigs already assigned to OTHER active jobs (no double-booking).
  const rigsOnOtherJobs = new Set(
    (allRigAssignments || [])
      .filter(a => a.job_id !== jobId)
      .map(a => a.asset_id)
  );
  // Also exclude rigs already on THIS job (from JobCostItem) to avoid duplicates.
  const rigsOnThisJob = new Set(
    (items || []).filter(c => c.site_asset_id).map(c => c.site_asset_id)
  );
  const allRigs = (siteAssets || []).filter(a =>
    a.is_rig === true &&
    a.is_active !== false &&
    !rigsOnOtherJobs.has(a.id) &&
    !rigsOnThisJob.has(a.id)
  );
  const formCatalogueItems = catalogueItems.filter(c => {
    const linkedAsset = c.site_asset_id ? assetMap[c.site_asset_id] : null;
    if (linkedAsset?.asset_type === 'rig') return false;
    if (!isDrillingJob && linkedAsset?.asset_type === 'lifting') return false;
    return true;
  });
  const defaultDates = job ? { start: job.start_date, end: job.end_date } : null;

  // Auto-select all loadable items at the yard so the Plan Load bar appears
  // automatically. Depends on a stable string of yard item IDs (not the array
  // reference) so toggling a checkbox doesn't reset the selection every render.
  const yardIdsKey = activeItems
    .filter(i => (i.current_location || 'yard') === 'yard')
    .map(i => i.id).sort().join(',');
  useEffect(() => {
    setSelectedIds(new Set(yardIdsKey ? yardIdsKey.split(',') : []));
  }, [yardIdsKey]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectedItems = activeItems.filter(i => selectedIds.has(i.id));

  const handleSubmitItem = async (formData) => {
    setSavingItem(true);
    try {
      const isContractorItem = formData.category === 'contractor_supplied';
      const isClientItem = formData.category === 'client_supplied';
      const isLabourItem = formData.category === 'labour';

      // Upload the on-site receipt signature (base64 data URL → file storage)
      let onSiteSignatureUrl = '';
      let onSiteSignedAt = '';
      let onSiteSignedBy = '';
      if (formData.already_on_site && formData.on_site_signature) {
        try {
          const blob = await (await fetch(formData.on_site_signature)).blob();
          const sigFile = new File([blob], `onsite-receipt-${Date.now()}.png`, { type: 'image/png' });
          const uploadRes = await base44.integrations.Core.UploadFile({ file: sigFile });
          onSiteSignatureUrl = uploadRes.file_url;
          onSiteSignedAt = new Date().toISOString();
          const me = await base44.auth.me().catch(() => null);
          onSiteSignedBy = me?.full_name || me?.email || '';
        } catch (sigErr) { console.error('Signature upload failed:', sigErr); }
      }
      // Rigs are unique serial-numbered assets — force quantity to 1 regardless
      // of what the form holds (prevents stale quantity from pre-fix records).
      const linkedAssetForQty = formData.site_asset_id ? (siteAssets || []).find(a => a.id === formData.site_asset_id) : null;
      const isRigItem = linkedAssetForQty?.asset_type === 'rig';
      // Number (men) and date fields must be null — not "" — when unset, otherwise
      // schema validation rejects the record ("Could not save item").
      const payload = {
        job_id: jobId, category: formData.category,
        supplier_id: (isContractorItem || isClientItem) ? '' : (formData.supplier_id || ''),
        contractor_id: isContractorItem ? (formData.contractor_id || '') : '',
        client_id: isClientItem ? (formData.client_id || '') : '',
        staff_id: isLabourItem ? (formData.staff_id || '') : '',
        description: formData.description,
        reference_number: formData.reference_number || '',
        responsible_person: formData.responsible_person || '',
        site_asset_id: formData.site_asset_id || '',
        rate_card_item_id: formData.rate_card_item_id || '',
        po_number: formData.po_number || '',
        order_slip_url: formData.order_slip_url || '',
        order_slip_name: formData.order_slip_name || '',
        start_date: formData.start_date || null, end_date: formData.end_date || null,
        unit_cost: (isContractorItem || isClientItem) ? 0 : (Number(formData.unit_cost) || 0),
        quantity: isRigItem ? 1 : (Number(formData.quantity) || 1),
        unit_label: (isContractorItem || isLabourItem) ? (isContractorItem ? 'each' : formData.unit_label) : formData.unit_label,
        men: (isContractorItem || isClientItem || !formData.men) ? null : Number(formData.men),
        vat_exempt: (isContractorItem || isClientItem) ? false : !!formData.vat_exempt,
        notes: formData.notes || '',
        delivery_notes: formData.delivery_notes || '',
        ...((isContractorItem || isClientItem || isLabourItem) ? { current_location: 'site', location_updated_at: new Date().toISOString() } : {}),
        ...(formData.already_on_site && !isContractorItem && !isClientItem && !isLabourItem ? { current_location: 'site', location_updated_at: new Date().toISOString() } : {}),
        on_site_signature_url: onSiteSignatureUrl || '',
        on_site_signed_at: onSiteSignedAt || '',
        on_site_signed_by: onSiteSignedBy || ''
      };
      let savedItem;
      if (editingId) { savedItem = await base44.entities.JobCostItem.update(editingId, payload); }
      else { savedItem = await base44.entities.JobCostItem.create(payload); }

      // Create a JobAssetAssignment for any item linked to a SiteAsset so the
      // dashboard "Job Assets" widget picks it up. For "already on site" items,
      // set status to 'on_site' with the arrival date; otherwise 'assigned'.
      if (formData.site_asset_id && !editingId) {
        const linkedAsset = (siteAssets || []).find(a => a.id === formData.site_asset_id);
        if (linkedAsset) {
          const today = new Date().toISOString().split('T')[0];
          const isOnSite = formData.already_on_site && !isContractorItem && !isClientItem && !isLabourItem;
          const roleMap = { rig: 'primary_rig', machinery: 'machinery', trailer: 'trailer', lifting: 'lifting', vehicle: 'machinery', portable_appliance: 'machinery' };
          try {
            await base44.entities.JobAssetAssignment.create({
              job_id: jobId, job_name: job?.name || '',
              asset_id: linkedAsset.id, asset_name: linkedAsset.name,
              asset_type: linkedAsset.asset_type || 'machinery',
              rig_type: linkedAsset.rig_type || 'n/a',
              role: roleMap[linkedAsset.asset_type] || 'machinery',
              compliance_status: linkedAsset.compliance_status || 'unknown',
              status: isOnSite ? 'on_site' : 'assigned',
              assigned_date: today,
              arrived_on_site_date: isOnSite ? today : '',
              notes: isOnSite ? 'Marked on-site on creation with signed receipt' : 'Auto-assigned from logistics hub'
            });
            queryClient.invalidateQueries({ queryKey: ['job-asset-assignments-active'] });
            queryClient.invalidateQueries({ queryKey: ['drawer-asset-assignments', jobId] });
          } catch (assignErr) { console.error('Asset assignment creation failed:', assignErr); }
        }
      }

      // For labour items (not editing), create a RotaAssignment for each working day
      // so the crew member appears on the job schedule and billing is linked.
      if (isLabourItem && !editingId && formData.staff_id && formData.start_date && formData.end_date) {
        const start = new Date(formData.start_date + 'T00:00:00');
        const end = new Date(formData.end_date + 'T00:00:00');
        const workingDays = eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d));
        const itemCount = Number(formData.quantity) || 1;
        if (workingDays.length > 0) {
          const rotaPayloads = workingDays.map((d) => ({
            job_id: jobId,
            staff_id: formData.staff_id,
            assigned_date: d.toISOString().split('T')[0],
            week_start: getWeekStart(d.toISOString().split('T')[0]),
            status: 'assigned',
            shift_status: 'pending',
            start_time: SITE_OPEN_TIME,
            end_time: SITE_CLOSE_TIME,
            notes: `Auto-assigned from labour billing item: ${formData.description}`,
          }));
          await base44.entities.RotaAssignment.bulkCreate(rotaPayloads);
          queryClient.invalidateQueries({ queryKey: ['rotas-for-job', jobId] });
          queryClient.invalidateQueries({ queryKey: ['job-rotas-fin', jobId] });
          toast({ title: 'Labour added & rota created', description: `${formData.responsible_person} assigned for ${workingDays.length} working day${workingDays.length > 1 ? 's' : ''}.` });
        }
      } else {
        toast({ title: editingId ? 'Item updated' : 'Item added', description: payload.description });
      }

      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      setAdding(false); setEditingId(null); setForm(blankForm());
    } catch (err) { console.error(err); toast({ title: 'Error', description: 'Could not save item.' }); }
    setSavingItem(false);
  };

  const editItem = (c) => {
    const editAsset = c.site_asset_id ? assetMap[c.site_asset_id] : null;
    const isRigEdit = editAsset?.asset_type === 'rig';
    setEditingId(c.id);
    setForm({
      category: c.category, supplier_id: c.supplier_id || '', contractor_id: c.contractor_id || '', client_id: c.client_id || '',
      staff_id: c.staff_id || '', description: c.description,
      reference_number: c.reference_number || '', responsible_person: c.responsible_person || '', site_asset_id: c.site_asset_id || '',
      po_number: c.po_number || '', order_slip_url: c.order_slip_url || '', order_slip_name: c.order_slip_name || '',
      rate_card_item_id: c.rate_card_item_id || '', start_date: c.start_date || '', end_date: c.end_date || '',
      unit_cost: String(c.unit_cost ?? ''), quantity: isRigEdit ? '1' : String(c.quantity ?? '1'), men: c.men ? String(c.men) : '',
      unit_label: c.unit_label || 'each', vat_exempt: !!c.vat_exempt, notes: c.notes || '',
      delivery_notes: c.delivery_notes || '',
      already_on_site: c.current_location === 'site',
      on_site_signature: null
    });
    setAdding(true);
  };

  const deleteRigAssembly = async (rigItem, linkedItems) => {
    const totalCount = linkedItems.length + 1;
    if (!confirm(`Delete "${rigItem.description}" and all ${linkedItems.length} linked gear items? This removes ${totalCount} items from the job.`)) return;
    try {
      await base44.entities.JobCostItem.delete(rigItem.id);
      await Promise.all(linkedItems.map(li => base44.entities.JobCostItem.delete(li.id)));
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      setSelectedIds(prev => { const s = new Set(prev); s.delete(rigItem.id); linkedItems.forEach(li => s.delete(li.id)); return s; });
      toast({ title: `Deleted ${totalCount} items`, description: `${rigItem.description} and linked gear removed.` });
    } catch (e) { console.error(e); toast({ title: 'Error', description: 'Could not delete rig assembly.' }); }
  };

  const deleteItem = async (id) => {
    if (!confirm('Remove this equipment item?')) return;
    try {
      await base44.entities.JobCostItem.delete(id);
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    } catch (e) { console.error(e); }
  };

  // Match a rig (SiteAsset) to its RateCardItem (Our Rate Card).
  // Uses the shared rigRateMatcher module — supports CP, Rotary, and Window Sampling rigs.
  const matchRigRateCard = (rigAsset) => findRigRateCardItem(rigAsset, rateCardItems, job?.project_id);

  const addRigWithGear = async (rigId, dates = {}) => {
    if (!rigId) return;
    setAddingRigGear(true);
    try {
      const rig = (siteAssets || []).find(a => a.id === rigId);
      if (!rig) return;
      const gear = (rig.linked_equipment_ids || []).map(id => (siteAssets || []).find(a => a.id === id)).filter(Boolean);
      // Compliance hard-lock removed — rigs can be added regardless of tooling
      // compliance status. Managers still see compliance badges on the rig cards.
      // Pull the day rate from Our Rate Card; gear items are £0 (included in the rig rate)
      const rateCardItem = matchRigRateCard(rig);
      const rigDayRate = rateCardItem ? (Number(rateCardItem.price) || 0) : (Number(rig.daily_billing_rate) || 0);
      const rigUnit = rateCardItem?.unit || 'day';
      // Rigs are unique serial-numbered assets — quantity is always 1.
      // Day-rate billing is driven by the on-site date range (start_date →
      // end_date), not the quantity field, so the financials engine calculates
      // cost = day_rate × working days from the dates.
      const rigStartDate = dates.onSiteStart || job?.start_date || '';
      const rigEndDate = dates.onSiteEnd || job?.end_date || '';
      const rigQuantity = 1;
      const payload = [
        { job_id: jobId, category: 'internal_equipment', supplier_id: '', description: rig.name,
          reference_number: rig.serial_number || '', responsible_person: rig.responsible_person || '', site_asset_id: rig.id,
          rate_card_item_id: rateCardItem?.id || '', po_number: '', start_date: rigStartDate, end_date: rigEndDate, unit_cost: rigDayRate,
          quantity: rigQuantity, unit_label: rigUnit, vat_exempt: false,
          hire_status: 'active', current_location: 'yard', notes: rateCardItem ? `Day rate from Our Rate Card — includes ${gear.length} linked gear item(s)` : `Day rate from Asset Panda — includes ${gear.length} linked gear item(s)` },
        ...gear.map(g => ({
          job_id: jobId, category: 'internal_equipment', supplier_id: '', description: g.name,
          reference_number: g.serial_number || '', responsible_person: g.responsible_person || '', site_asset_id: g.id,
          po_number: '', start_date: '', end_date: '', unit_cost: 0,
          quantity: 1, unit_label: 'day', vat_exempt: false,
          hire_status: 'active', current_location: 'yard', notes: 'Included in rig day rate' }))
      ];
      await base44.entities.JobCostItem.bulkCreate(payload);
      // Also create JobAssetAssignment records so the dashboard "Job Assets"
      // widget and compliance tracking pick up the rig + linked gear.
      const today = new Date().toISOString().split('T')[0];
      const assignmentPayload = [
        { job_id: jobId, job_name: job?.name || '', asset_id: rig.id, asset_name: rig.name,
          asset_type: 'rig', rig_type: rig.rig_type || 'n/a', role: 'primary_rig',
          compliance_status: rig.compliance_status || 'unknown', status: 'assigned',
          assigned_date: today, notes: `Auto-assigned from logistics hub` },
        ...gear.map(g => ({
          job_id: jobId, job_name: job?.name || '', asset_id: g.id, asset_name: g.name,
          asset_type: g.asset_type || 'machinery', rig_type: 'n/a',
          role: g.asset_type === 'lifting' ? 'lifting' : g.asset_type === 'trailer' ? 'trailer' : 'machinery',
          compliance_status: g.compliance_status || 'unknown', status: 'assigned',
          assigned_date: today, notes: `Linked to ${rig.name}` }))
      ];
      try {
        // Create the rig assignment first (critical for dashboard visibility),
        // then gear separately so a gear failure can't block the rig.
        await base44.entities.JobAssetAssignment.create(assignmentPayload[0]);
        if (assignmentPayload.length > 1) {
          await base44.entities.JobAssetAssignment.bulkCreate(assignmentPayload.slice(1));
        }
        queryClient.invalidateQueries({ queryKey: ['job-asset-assignments-active'] });
        queryClient.invalidateQueries({ queryKey: ['drawer-asset-assignments', jobId] });
      } catch (assignErr) { console.error('Asset assignment creation failed:', assignErr); }
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      toast({ title: `Added ${rig.name}`, description: `Rig + ${gear.length} gear items · ${fmt(rigDayRate)}/${rigUnit} · on site ${dates.onSiteStart || 'TBD'} → ${dates.onSiteEnd || 'ongoing'}.` });
      setShowRigPicker(false);
    } catch (err) { console.error(err); toast({ title: 'Error', description: 'Could not add rig and gear.' }); }
    setAddingRigGear(false);
  };

  const updateLocation = async (itemId, newLocation) => {
    setUpdatingIds(prev => new Set(prev).add(itemId));
    try {
      const item = items.find(i => i.id === itemId);
      const today = new Date().toISOString().split('T')[0];
      const payload = { current_location: newLocation, location_updated_at: new Date().toISOString() };
      // When a rig/equipment arrives on site, lock in the start_date so the
      // financials engine can calculate rig cost from the actual arrival date
      // (day rate × working days). Without this, cost is £0 or only counts
      // the single day the location was last changed.
      if (newLocation === 'site' && item && !item.start_date) {
        payload.start_date = today;
      }
      if (newLocation === 'returned') {
        payload.hire_status = 'off_hired';
        payload.off_hire_date = today;
        payload.return_destination = item?.supplier_id || 'depot';
      }
      await base44.entities.JobCostItem.update(itemId, payload);
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
    } catch (e) { console.error(e); toast({ title: 'Error', description: 'Could not update location.' }); }
    setUpdatingIds(prev => { const s = new Set(prev); s.delete(itemId); return s; });
  };

  const bulkCollectAll = async () => {
    const siteItems = activeItems.filter(i => (i.current_location || 'yard') === 'site');
    if (siteItems.length === 0) return;
    setUpdatingIds(new Set(siteItems.map(i => i.id)));
    try {
      const now = new Date().toISOString();
      await base44.entities.JobCostItem.bulkUpdate(
        siteItems.map(i => ({ id: i.id, current_location: 'returned', return_destination: i.supplier_id || 'depot', location_updated_at: now, hire_status: 'off_hired', off_hire_date: now.split('T')[0] }))
      );
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      toast({ title: 'All items collected', description: `${siteItems.length} items marked as returned.` });
    } catch (e) { console.error(e); toast({ title: 'Error', description: 'Could not collect all items.' }); }
    setUpdatingIds(new Set());
  };

  const openOffHire = (c) => {
    setOffHiringId(c.id); setOffHireDate(format(new Date(), 'yyyy-MM-dd'));
    setOffHireFile(null); if (offHireFileRef.current) offHireFileRef.current.value = '';
  };

  const confirmOffHire = async () => {
    setUploadingOffHire(true);
    try {
      let noteUrl = '', noteName = '';
      if (offHireFile) { const res = await base44.integrations.Core.UploadFile({ file: offHireFile }); noteUrl = res.file_url; noteName = offHireFile.name; }
      await base44.entities.JobCostItem.update(offHiringId, { hire_status: 'off_hired', off_hire_date: offHireDate, off_hire_note_url: noteUrl, off_hire_note_name: noteName });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      setOffHiringId(null); setOffHireFile(null);
    } catch (err) { console.error(err); }
    setUploadingOffHire(false);
  };

  const reinstate = async (c) => {
    await base44.entities.JobCostItem.update(c.id, { hire_status: 'active', off_hire_date: '', off_hire_note_url: '', off_hire_note_name: '' });
    queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
  };

  const offHiringItem = items.find(c => c.id === offHiringId);

  return (
    <div className="space-y-4 pb-28 sm:pb-0">
      {/* Stats + hub links row — stats on the left, hub deep-links on the right */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {canSeeCosts && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="hub-glass rounded-xl px-3 py-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="leading-tight">
                <p className="text-sm font-bold text-slate-900 tabular-nums">{fmt(rigsTotal)}</p>
                <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">Rigs</p>
              </div>
            </div>
            <div className="hub-glass rounded-xl px-3 py-2 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-purple-600 flex-shrink-0" />
              <div className="leading-tight">
                <p className="text-sm font-bold text-slate-900 tabular-nums">{fmt(purchasedTotal)}</p>
                <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">Purchased</p>
              </div>
            </div>
            <div className="hub-glass rounded-xl px-3 py-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="leading-tight">
                <p className="text-sm font-bold text-slate-900 tabular-nums">{fmt(hiredTotal)}</p>
                <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">Hired</p>
              </div>
            </div>
            <div className="hub-glass rounded-xl px-3 py-2 flex items-center gap-2">
              <Hammer className="w-4 h-4 text-slate-600 flex-shrink-0" />
              <div className="leading-tight">
                <p className="text-sm font-bold text-slate-900 tabular-nums">{clientItemCount}</p>
                <p className="text-[10px] text-slate-400 uppercase font-medium tracking-wide">Client Items</p>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          <HubDeepLink to="/admin/logistics" jobId={jobId} label="Logistics Hub" icon={Truck} />
          <HubDeepLink to="/assets" jobId={jobId} label="Assets Hub" icon={Boxes} />
        </div>
      </div>

      <LifecycleBar items={items} isDecommissioning={job?.status === 'decommissioning'} onBulkCollect={bulkCollectAll} />

      {/* Equipment & Assets — unified section: physical asset assignments (compliance) + billable hire items */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          <Boxes className="w-5 h-5 text-emerald-700" />
          <h3 className="font-semibold text-slate-900 text-sm">Equipment & Assets</h3>
          <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
            {loadableItems.length} items{canSeeCosts && loadableItems.length > 0 ? ` · ${fmt(totalNet)}` : ''}
          </span>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          {isLocked && <BillingLockBanner lockReason={lockReason} job={job} tempOpen={tempOpen} onTempOpen={setTempOpen} />}
          {canSeeCosts && !effectiveLocked && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:flex-wrap">
              <button onClick={() => setShowBasket(true)}
                className="inline-flex items-center justify-center gap-2 text-sm text-white font-semibold px-4 py-3.5 sm:px-4 sm:py-2.5 rounded-xl bg-[#2E5A1A] hover:bg-[#1c4a12] active:scale-[0.98] transition shadow-md w-full sm:w-auto">
                <ShoppingCart className="w-4 h-4" /> Add Billable Items
              </button>
              {isDrillingJob && allRigs.length > 0 && (
                <button onClick={() => setShowRigPicker(true)} disabled={addingRigGear}
                  className="inline-flex items-center justify-center gap-2 text-sm text-white font-semibold px-4 py-3 sm:px-4 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 transition shadow-sm disabled:opacity-50 w-full sm:w-auto">
                  <Plus className="w-4 h-4" /> Add Rig & Gear
                </button>
              )}
              <button onClick={() => setShowManifest(true)}
                className="inline-flex items-center justify-center gap-2 text-sm text-slate-700 font-semibold px-4 py-3.5 sm:px-4 sm:py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 active:scale-[0.98] transition shadow-sm w-full sm:w-auto">
                <QrCode className="w-4 h-4 text-blue-600" /> Print Site Manifest
              </button>
            </div>
          )}

          <Dialog open={adding} onOpenChange={(open) => { if (!open) { setAdding(false); setEditingId(null); setForm(blankForm()); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Billable Item' : 'Add Billable Item'}</DialogTitle></DialogHeader>
              <EquipmentForm form={form} setForm={setForm} onSubmit={handleSubmitItem}
                onCancel={() => { setAdding(false); setEditingId(null); setForm(blankForm()); }}
                saving={savingItem} editing={!!editingId} suppliers={suppliers} contractors={contractors}
                defaultDates={defaultDates} catalogueItems={formCatalogueItems}
                rateCardItems={rateCardItems} ownedAssets={ownedAssets} staff={staff} clients={clients} />
            </DialogContent>
          </Dialog>

          {(activeItems.length > 0 || returnedItems.length > 0) && (
            <div className="flex gap-1.5 flex-wrap w-full">
              <button onClick={() => setStatusFilter('all')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${statusFilter === 'all' ? 'bg-slate-700 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                All <span className={`text-[10px] ${statusFilter === 'all' ? 'text-white/70' : 'text-slate-400'}`}>({statusCounts.all})</span>
              </button>
              <button onClick={() => setStatusFilter('on_site')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${statusFilter === 'on_site' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                <span className={`w-2 h-2 rounded-full ${statusFilter === 'on_site' ? 'bg-white' : 'bg-emerald-500'}`} /> On Site <span className={`text-[10px] ${statusFilter === 'on_site' ? 'text-white/70' : 'text-emerald-600/60'}`}>({statusCounts.on_site})</span>
              </button>
              <button onClick={() => setStatusFilter('on_hire')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${statusFilter === 'on_hire' ? 'bg-amber-500 text-white shadow-sm' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
                <span className={`w-2 h-2 rounded-full ${statusFilter === 'on_hire' ? 'bg-white' : 'bg-amber-500'}`} /> On Hire <span className={`text-[10px] ${statusFilter === 'on_hire' ? 'text-white/70' : 'text-amber-600/60'}`}>({statusCounts.on_hire})</span>
              </button>
              <button onClick={() => setStatusFilter('returned')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${statusFilter === 'returned' ? 'bg-slate-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                <FileCheck className="w-3 h-3" /> Returned <span className={`text-[10px] ${statusFilter === 'returned' ? 'text-white/70' : 'text-slate-400'}`}>({statusCounts.returned})</span>
              </button>
            </div>
          )}

          {items.length === 0 && !adding ? (
            <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
              {canSeeCosts ? 'No equipment on this job yet. Click "Add Billable Item" to add rigs, machinery, trailers, lifting gear, consumables or hire items.' : 'No equipment added to this job yet.'}
            </div>
          ) : statusFilter === 'returned' ? (
            returnedItems.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">No equipment returned yet.</div>
            ) : (
              <div className="space-y-2">
                {returnedItems.map(c => {
                  const net = billingTotal(c);
                  return (
                    <div key={c.id} className="border border-slate-200 bg-slate-50/70 rounded-lg p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0"><FileCheck className="w-4 h-4 text-slate-500" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-600 line-through truncate">{c.description}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {c.off_hire_date && <span className="text-[10px] text-slate-400">Returned {format(new Date(c.off_hire_date + 'T00:00:00'), 'dd MMM yyyy')}</span>}
                          {c.off_hire_note_url && <a href={c.off_hire_note_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-700 hover:text-emerald-900 font-medium inline-flex items-center gap-1"><FileCheck className="w-2.5 h-2.5" /> Note<ExternalLink className="w-2.5 h-2.5" /></a>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {canSeeCosts && <p className="text-sm font-bold text-slate-400">{fmt(net)}</p>}
                        {canSeeCosts && <button onClick={() => reinstate(c)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700 font-medium px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 transition"><Undo2 className="w-3.5 h-3.5" /> Reinstate</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : visibleItems.length === 0 && !adding ? (
            <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
              {statusFilter === 'on_site' ? 'No equipment on site.' : statusFilter === 'on_hire' ? 'No equipment on hire (at yard/depot).' : 'No equipment in this category.'}
            </div>
          ) : (
            <div className="space-y-4">
              {rigAssemblyList.map(assembly => (
                <RigAssemblyGroup key={assembly.rig.id} rigItem={assembly.rig} linkedItems={assembly.linked}
                  asset={assembly.asset} suppliers={suppliers} contractors={contractors}
                  canSeeCosts={canSeeCosts} canEdit={canSeeCosts}
                  selectedIds={selectedIds} onToggleSelect={toggleSelect}
                  onEdit={editItem} onDeleteItem={deleteItem} onDeleteAssembly={deleteRigAssembly}
                  onOffHire={openOffHire} onLocationUpdate={updateLocation}
                  updatingIds={updatingIds} assetMap={assetMap} complianceByAssetId={complianceByAssetId} />
              ))}
              {poGroupedItems.length > 0 && (
                <PoGroupedAccordion
                  poItems={poGroupedItems}
                  suppliers={suppliers} contractors={contractors}
                  canSeeCosts={canSeeCosts} canEdit={canSeeCosts}
                  selectedIds={selectedIds} onToggleSelect={toggleSelect}
                  onEdit={editItem} onDeleteItem={deleteItem} onOffHire={openOffHire}
                  onLocationUpdate={updateLocation} updatingIds={updatingIds}
                  assetMap={assetMap} complianceByAssetId={complianceByAssetId} />
              )}
              {Object.entries(personGroups).map(([person, personItems]) => (
                <div key={person}>
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{person}</p>
                    <span className="text-xs text-slate-400">({personItems.length})</span>
                    {canSeeCosts && <span className="ml-auto text-xs font-bold text-[#2E5A1A]">{fmt(personItems.reduce((s, c) => s + billingTotal(c), 0))}</span>}
                  </div>
                  <div className="space-y-2">
                    {personItems.map(c => (
                      <LogisticsItemRow key={c.id} item={c} isSelected={selectedIds.has(c.id)} onToggleSelect={toggleSelect}
                        asset={c.site_asset_id ? assetMap[c.site_asset_id] : null}
                        supplier={c.supplier_id ? suppliers.find(s => s.id === c.supplier_id) : null}
                        contractor={c.contractor_id ? contractors.find(ct => ct.id === c.contractor_id) : null}
                        linkedItems={[]} isUpdating={updatingIds.has(c.id)}
                        onEdit={editItem} onDelete={deleteItem} onOffHire={openOffHire} onLocationUpdate={updateLocation}
                        canSelect={canSeeCosts} canEdit={canSeeCosts} showCost={canSeeCosts}
                        complianceItems={c.site_asset_id ? (complianceByAssetId[c.site_asset_id] || []) : []} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Truck className="w-5 h-5 text-emerald-700" />
          <h3 className="font-semibold text-slate-900 text-sm">Deliveries & Collections</h3>
          <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{deliveries.length}</span>
          {canSeeCosts && (
            <button onClick={() => setShowLoadPlanner(true)} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition ml-2">
              <Plus className="w-3.5 h-3.5" /> Add Delivery
            </button>
          )}
        </div>
        <div className="p-4 sm:p-5">
          <DeliveryList deliveries={deliveries} jobId={jobId} canSeeCosts={canSeeCosts} />
        </div>
      </div>

      {selectedIds.size > 0 && !showLoadPlanner && (
        <div className="hidden sm:block fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg safe-area-bottom">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900">{selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected</p>
              <p className="text-xs text-slate-400 truncate">{selectedItems.map(i => i.description).join(', ')}</p>
            </div>
            <button onClick={() => setShowLoadPlanner(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-700 text-white rounded-xl font-semibold text-sm hover:bg-emerald-800 transition active:scale-95 flex-shrink-0">
              <Truck className="w-4 h-4" /> Plan Load
            </button>
            <button onClick={clearSelection} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg flex-shrink-0"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      {showLoadPlanner && (
        <LoadPlannerModal selectedItems={selectedItems} staff={staff} vehicles={vehicles} job={job}
          onClose={() => { setShowLoadPlanner(false); clearSelection(); }} />
      )}

      {showRigPicker && (
        <RigGearPickerModal rigs={allRigs} assets={siteAssets} rateCardItems={rateCardItems} projectId={job?.project_id}
          jobStartDate={job?.start_date} jobEndDate={job?.end_date}
          onAdd={addRigWithGear} onClose={() => setShowRigPicker(false)} adding={addingRigGear} />
      )}

      {/* Mobile sticky footer — Plan Load only, shown when items are selected.
          Portaled to body so the dashboard's framer-motion transform can't trap it. */}
      {selectedIds.size > 0 && !showLoadPlanner && createPortal(
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[60] bg-white/95 backdrop-blur-md border-t border-slate-200 safe-area-bottom shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-4 pt-2.5 pb-2.5 flex items-center gap-2">
          <button onClick={() => setShowLoadPlanner(true)} className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm text-white font-semibold px-3 py-3 rounded-xl bg-emerald-700 active:scale-95 transition shadow-sm">
            <Truck className="w-4 h-4" /> Plan Load ({selectedIds.size})
          </button>
          <button onClick={clearSelection} className="p-3 text-slate-400 hover:text-slate-600 rounded-lg flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>,
        document.body
      )}

      {offHiringId && offHiringItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => !uploadingOffHire && setOffHiringId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><FileCheck className="w-5 h-5 text-slate-700" /></div>
              <div><h3 className="font-bold text-slate-900">Return equipment</h3><p className="text-xs text-slate-400 truncate">{offHiringItem.description}</p></div>
            </div>
            <p className="text-sm text-slate-500 mb-3">Mark as returned and attach the off-hire note.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Return date</label>
                <input type="date" value={offHireDate} onChange={e => setOffHireDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Off-hire note (PDF / photo)</label>
                <input ref={offHireFileRef} type="file" accept=".pdf,image/*,.doc,.docx" onChange={e => setOffHireFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium hover:file:bg-emerald-100 cursor-pointer" />
                {offHireFile && <p className="text-xs text-emerald-700 mt-1.5 inline-flex items-center gap-1"><FileCheck className="w-3 h-3" /> {offHireFile.name}</p>}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={confirmOffHire} disabled={uploadingOffHire} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition text-sm font-semibold disabled:opacity-50">
                {uploadingOffHire ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</> : <><FileCheck className="w-3.5 h-3.5" /> Confirm return</>}
              </button>
              <button onClick={() => setOffHiringId(null)} disabled={uploadingOffHire} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}
      {showManifest && (
        <SiteManifestPDF jobId={jobId} jobName={job?.name || ''} onClose={() => setShowManifest(false)} />
      )}

      {showBasket && (
        <AddBillableItemsWizard
          jobId={jobId}
          job={job}
          rateCardItems={rateCardItems}
          suppliers={suppliers}
          defaultDates={defaultDates}
          onClose={() => setShowBasket(false)}
        />
      )}
    </div>
  );
}