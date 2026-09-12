import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Truck, Wrench, ShoppingCart, Plus, Trash2, Edit2,
  Package, FileCheck, Undo2, ExternalLink, AlertTriangle, Boxes, HardHat, User,
  ShieldCheck, ShieldAlert, ShieldX, AlertCircle, Sparkles
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, parseISO, isValid } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import EquipmentForm from '@/components/EquipmentForm';
import EquipmentItemCard from '@/components/EquipmentItemCard';
import ConfirmQuoteModal from '@/components/equipment/ConfirmQuoteModal';
import { extractDocumentData, OFF_HIRE_SCHEMA } from '@/utils/documentExtraction';

const fmt = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const blankForm = () => ({
  category: 'hired_equipment', supplier_id: '', contractor_id: '', client_id: '', description: '',
  reference_number: '', responsible_person: '', site_asset_id: '', rate_card_item_id: '', po_number: '', order_slip_url: '', order_slip_name: '', start_date: '', end_date: '',
  unit_cost: '', quantity: '1', unit_label: 'day', vat_exempt: false, notes: '', men: '', staff_id: '', delivery_notes: '', is_poa: false
});

const categoryConfig = {
  hired_equipment: { label: 'Hired', icon: Truck, bg: 'bg-amber-50', text: 'text-amber-600' },
  purchased_equipment: { label: 'Purchased', icon: ShoppingCart, bg: 'bg-purple-50', text: 'text-purple-600' },
  internal_equipment: { label: 'Owned', icon: Wrench, bg: 'bg-blue-50', text: 'text-blue-600' },
  contractor_supplied: { label: 'Contractor', icon: HardHat, bg: 'bg-indigo-50', text: 'text-indigo-600' },
  client_supplied: { label: 'Client', icon: Boxes, bg: 'bg-slate-100', text: 'text-slate-600' },
};

const locationBadge = {
  in_transit: { label: 'In Transit', cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  site: { label: 'On Site', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  returned: { label: 'Returned', cls: 'bg-teal-50 text-teal-700 border border-teal-200' },
};

const complianceConfig = {
  compliant: { label: 'Compliant', icon: ShieldCheck, badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  expiring: { label: 'Expiring', icon: ShieldAlert, badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  expired: { label: 'Expired', icon: ShieldX, badge: 'bg-red-50 text-red-700 border border-red-200' },
  unknown: { label: 'Unknown', icon: ShieldCheck, badge: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

export default function EquipmentManager({ jobId, job, items: externalItems, onItemsChange, suppliers: externalSuppliers }) {
  const isJobMode = !!jobId;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: fetchedItems = [] } = useQuery({
    queryKey: ['job-cost-items', jobId],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: jobId }),
    enabled: isJobMode
  });
  const { data: fetchedSuppliers = [] } = useQuery({
    queryKey: ['suppliers-equip'],
    queryFn: () => base44.entities.Supplier.list(),
    enabled: isJobMode && !externalSuppliers
  });
  const { data: contractors = [] } = useQuery({
    queryKey: ['contractors-equip'],
    queryFn: () => base44.entities.Contractor.list()
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-equip'],
    queryFn: () => base44.entities.Client.list()
  });
  const { data: presets = [] } = useQuery({
    queryKey: ['cost-presets-active'],
    queryFn: async () => {
      const list = await base44.entities.CostPreset.filter({ is_active: true });
      return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
    },
    enabled: isJobMode
  });
  const { data: catalogueItems = [] } = useQuery({
    queryKey: ['equipment-catalogue-active'],
    queryFn: async () => {
      const list = await base44.entities.EquipmentCatalogue.filter({ is_active: true });
      return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || (a.description || '').localeCompare(b.description || ''));
    }
  });
  const { data: siteAssets = [] } = useQuery({
    queryKey: ['site-assets-equip'],
    queryFn: () => base44.entities.SiteAsset.list()
  });
  const { data: rateCardItems = [] } = useQuery({
    queryKey: ['rate-card-items-equip'],
    queryFn: () => base44.entities.RateCardItem.list('-created_date', 500)
  });
  const { data: staffList = [] } = useQuery({
    queryKey: ['staff-list-equip'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true })
  });

  const items = isJobMode ? fetchedItems : (externalItems || []);
  const suppliers = externalSuppliers || fetchedSuppliers || [];
  // Owned equipment from Asset Panda — non-rig (excludes rigs which use the dedicated rig flow), active & available
  const ownedAssets = (siteAssets || []).filter(a => a.is_rig !== true && a.is_active !== false && a.stock_level !== 'out_of_stock' && a.stock_level !== 'needs_service');

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(blankForm());
  const [savingItem, setSavingItem] = useState(false);
  const [hireFilter, setHireFilter] = useState('active');
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [addingRigGear, setAddingRigGear] = useState(false);

  const [offHiringId, setOffHiringId] = useState(null);
  const [offHireDate, setOffHireDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [offHireFile, setOffHireFile] = useState(null);
  const [uploadingOffHire, setUploadingOffHire] = useState(false);
  const [extractingOffHire, setExtractingOffHire] = useState(false);
  const [extractedOffHireNote, setExtractedOffHireNote] = useState(null);
  const offHireFileRef = useRef(null);
  const [confirmingQuoteItem, setConfirmingQuoteItem] = useState(null);

  const itemNet = (c) => {
    const rate = c.price_confirmed && c.negotiated_unit_cost != null ? Number(c.negotiated_unit_cost) : (Number(c.unit_cost) || 0);
    return rate * (Number(c.quantity) || 1);
  };
  const totalNet = items.reduce((s, c) => s + itemNet(c), 0);
  const pendingPoa = isJobMode ? items.filter(c => c.is_poa && !c.price_confirmed) : [];
  const dailyTotal = items
    .filter(c => (c.hire_status || 'active') !== 'off_hired')
    .filter(c => c.category !== 'contractor_supplied' && c.category !== 'client_supplied')
    .filter(c => ['day', 'week', 'hour'].includes(c.unit_label))
    .reduce((s, c) => {
      const rate = c.price_confirmed && c.negotiated_unit_cost != null ? Number(c.negotiated_unit_cost) : (Number(c.unit_cost) || 0);
      const men = Number(c.men) || 1;
      if (c.unit_label === 'day') return s + rate * men;
      if (c.unit_label === 'week') return s + (rate / 5) * men;
      if (c.unit_label === 'hour') return s + rate * 8 * men;
      return s;
    }, 0);
  const defaultDates = job ? { start: job.start_date, end: job.end_date } : null;
  const rigsWithGear = catalogueItems.filter(c => (c.linked_catalogue_ids || []).length > 0);

  const handleSubmitItem = async (formData) => {
    if (isJobMode) {
      setSavingItem(true);
      try {
        const isNoCost = formData.category === 'contractor_supplied' || formData.category === 'client_supplied';
        const payload = {
          job_id: jobId,
          category: formData.category,
          supplier_id: isNoCost ? '' : (formData.supplier_id || ''),
          contractor_id: formData.category === 'contractor_supplied' ? (formData.contractor_id || '') : '',
          client_id: formData.category === 'client_supplied' ? (formData.client_id || '') : '',
          rate_card_item_id: formData.rate_card_item_id || '',
          is_poa: !!formData.is_poa,
          site_asset_id: formData.site_asset_id || '',
          staff_id: formData.staff_id || '',
          men: formData.men ? Number(formData.men) : null,
          description: formData.description,
          reference_number: formData.reference_number || '',
          responsible_person: formData.responsible_person || '',
          po_number: formData.po_number || '',
          order_slip_url: formData.order_slip_url || '',
          order_slip_name: formData.order_slip_name || '',
          start_date: formData.start_date || '',
          end_date: formData.end_date || '',
          unit_cost: isNoCost ? 0 : (Number(formData.unit_cost) || 0),
          quantity: Number(formData.quantity) || 1,
          unit_label: isNoCost ? 'each' : formData.unit_label,
          vat_exempt: isNoCost ? false : !!formData.vat_exempt,
          notes: formData.notes || '',
          delivery_notes: formData.delivery_notes || '',
          ...(isNoCost ? { current_location: 'site', location_updated_at: new Date().toISOString() } : {})
        };
        if (editingId) {
          await base44.entities.JobCostItem.update(editingId, payload);
        } else {
          await base44.entities.JobCostItem.create(payload);
        }
        queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
        queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
        setAdding(false); setEditingId(null); setForm(blankForm());
      } catch (err) { console.error(err); toast({ title: 'Error', description: 'Could not save item.' }); }
      setSavingItem(false);
    } else {
      const isNoCost = formData.category === 'contractor_supplied' || formData.category === 'client_supplied';
      const newItem = {
        id: editingId || `temp-${Date.now()}`,
        category: formData.category,
        supplier_id: isNoCost ? '' : (formData.supplier_id || ''),
        contractor_id: formData.category === 'contractor_supplied' ? (formData.contractor_id || '') : '',
        client_id: formData.category === 'client_supplied' ? (formData.client_id || '') : '',
        rate_card_item_id: formData.rate_card_item_id || '',
        description: formData.description,
        reference_number: formData.reference_number || '',
        responsible_person: formData.responsible_person || '',
        po_number: formData.po_number || '',
        start_date: formData.start_date || '',
        end_date: formData.end_date || '',
        unit_cost: isNoCost ? 0 : (Number(formData.unit_cost) || 0),
        quantity: Number(formData.quantity) || 1,
        unit_label: isNoCost ? 'each' : formData.unit_label,
        vat_exempt: isNoCost ? false : !!formData.vat_exempt,
        notes: formData.notes || ''
      };
      if (editingId) {
        onItemsChange(items.map(i => i.id === editingId ? newItem : i));
        setEditingId(null);
        setAdding(false);
      } else {
        onItemsChange([...items, newItem]);
      }
      setForm(blankForm());
    }
  };

  const editItem = (c) => {
    if (isJobMode) {
      setEditingId(c.id);
      setForm({
        category: c.category, supplier_id: c.supplier_id || '', contractor_id: c.contractor_id || '', client_id: c.client_id || '', description: c.description,
        reference_number: c.reference_number || '', responsible_person: c.responsible_person || '', site_asset_id: c.site_asset_id || '', rate_card_item_id: c.rate_card_item_id || '', po_number: c.po_number || '',
        order_slip_url: c.order_slip_url || '', order_slip_name: c.order_slip_name || '',
        start_date: c.start_date || '', end_date: c.end_date || '',
        unit_cost: String(c.unit_cost ?? ''), quantity: String(c.quantity ?? '1'),
        unit_label: c.unit_label || 'each', vat_exempt: !!c.vat_exempt,
        notes: c.notes || '',
        delivery_notes: c.delivery_notes || '',
        staff_id: c.staff_id || '',
        men: c.men != null ? String(c.men) : ''
      });
    } else {
      setEditingId(c.id);
      setForm({
        category: c.category || 'hired_equipment', supplier_id: c.supplier_id || '', contractor_id: c.contractor_id || '', client_id: c.client_id || '',
        description: c.description, reference_number: c.reference_number || '', responsible_person: c.responsible_person || '', site_asset_id: c.site_asset_id || '', rate_card_item_id: c.rate_card_item_id || '',
        po_number: c.po_number || '', start_date: c.start_date || '', end_date: c.end_date || '',
        unit_cost: String(c.unit_cost ?? ''), quantity: String(c.quantity ?? '1'),
        unit_label: c.unit_label || 'each', vat_exempt: !!c.vat_exempt, notes: c.notes || ''
      });
    }
    setAdding(true);
  };

  const deleteItem = async (id) => {
    if (isJobMode) {
      if (!confirm('Remove this equipment item?')) return;
      try {
        await base44.entities.JobCostItem.delete(id);
        queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
        queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      } catch (e) { console.error(e); }
    } else {
      onItemsChange(items.filter(i => i.id !== id));
    }
  };

  const applyPreset = async (e) => {
    const presetId = e.target.value;
    if (!presetId) return;
    e.target.value = '';
    setApplyingPreset(true);
    try {
      const presetItems = await base44.entities.PresetItem.filter({ preset_id: presetId });
      if (presetItems.length === 0) {
        toast({ title: 'Preset is empty', description: 'Add items to this preset in Settings first.' });
        return;
      }
      const preset = presets.find(p => p.id === presetId);
      const payload = presetItems.map(item => ({
        job_id: jobId,
        category: item.category || 'hired_equipment',
        supplier_id: item.supplier_id || '',
        rate_card_item_id: item.rate_card_item_id || '',
        description: item.description,
        reference_number: item.reference_number || '',
        po_number: '', site_asset_id: item.site_asset_id || '',
        start_date: '', end_date: '',
        unit_cost: Number(item.unit_cost) || 0,
        quantity: Number(item.quantity) || 1,
        unit_label: item.unit_label || 'each',
        vat_exempt: !!item.vat_exempt,
        hire_status: 'active', current_location: 'yard', notes: ''
      }));
      await base44.entities.JobCostItem.bulkCreate(payload);
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      toast({ title: `Added ${payload.length} items`, description: `From "${preset?.name || 'Preset'}" — adjust prices or dates as needed.` });
    } catch (err) { console.error(err); toast({ title: 'Error', description: 'Could not apply preset.' }); }
    setApplyingPreset(false);
  };

  const addRigWithGear = async (e) => {
    const catId = e.target.value;
    if (!catId) return;
    e.target.value = '';
    setAddingRigGear(true);
    try {
      const rig = catalogueItems.find(c => c.id === catId);
      if (!rig) return;
      const gear = (rig.linked_catalogue_ids || []).map(id => catalogueItems.find(c => c.id === id)).filter(Boolean);
      const payload = [
        {
          job_id: jobId,
          category: rig.category,
          supplier_id: rig.default_supplier_id || '',
          description: rig.description,
          reference_number: rig.reference_number || '',
          responsible_person: rig.responsible_person || '',
          site_asset_id: rig.site_asset_id || '',
          po_number: '', start_date: '', end_date: '',
          unit_cost: Number(rig.default_unit_cost) || 0,
          quantity: 1, unit_label: rig.default_unit_label || 'day',
          vat_exempt: !!rig.default_vat_exempt,
          hire_status: 'active', current_location: 'yard', notes: ''
        },
        ...gear.map(g => ({
          job_id: jobId,
          category: g.category,
          supplier_id: g.default_supplier_id || '',
          description: g.description,
          reference_number: g.reference_number || '',
          responsible_person: g.responsible_person || '',
          site_asset_id: g.site_asset_id || '',
          po_number: '', start_date: '', end_date: '',
          unit_cost: Number(g.default_unit_cost) || 0,
          quantity: 1, unit_label: g.default_unit_label || 'day',
          vat_exempt: !!g.default_vat_exempt,
          hire_status: 'active', current_location: 'yard', notes: ''
        }))
      ];
      await base44.entities.JobCostItem.bulkCreate(payload);
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items-manifest', jobId] });
      toast({ title: `Added ${payload.length} items`, description: `${rig.description} + ${gear.length} linked items — adjust dates and costs as needed.` });
    } catch (err) { console.error(err); toast({ title: 'Error', description: 'Could not add rig and gear.' }); }
    setAddingRigGear(false);
  };

  const openOffHire = (c) => {
    setOffHiringId(c.id);
    setOffHireDate(format(new Date(), 'yyyy-MM-dd'));
    setOffHireFile(null);
    setExtractedOffHireNote(null);
    if (offHireFileRef.current) offHireFileRef.current.value = '';
  };

  const confirmOffHire = async () => {
    setUploadingOffHire(true);
    setExtractedOffHireNote(null);
    try {
      let noteUrl = '', noteName = '';
      if (offHireFile) {
        const res = await base44.integrations.Core.UploadPublicFile({ file: offHireFile });
        noteUrl = res.file_url; noteName = offHireFile.name;
        // Auto-extract return date from the off-hire note
        setExtractingOffHire(true);
        try {
          const extracted = await extractDocumentData(noteUrl, OFF_HIRE_SCHEMA);
          if (extracted?.return_date) {
            const parsed = parseISO(extracted.return_date);
            if (isValid(parsed)) {
              setOffHireDate(format(parsed, 'yyyy-MM-dd'));
              setExtractedOffHireNote('Return date auto-filled from document');
            }
          }
        } catch { /* best-effort */ }
        setExtractingOffHire(false);
      }
      await base44.entities.JobCostItem.update(offHiringId, {
        hire_status: 'off_hired', off_hire_date: offHireDate,
        off_hire_note_url: noteUrl, off_hire_note_name: noteName
      });
      queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
      setOffHiringId(null); setOffHireFile(null);
    } catch (err) { console.error(err); }
    setUploadingOffHire(false);
  };

  const reinstate = async (c) => {
    await base44.entities.JobCostItem.update(c.id, {
      hire_status: 'active', off_hire_date: '', off_hire_note_url: '', off_hire_note_name: ''
    });
    queryClient.invalidateQueries({ queryKey: ['job-cost-items', jobId] });
  };

  const activeItems = isJobMode ? items.filter(c => (c.hire_status || 'active') !== 'off_hired') : items;
  const returnedItems = isJobMode ? items.filter(c => c.hire_status === 'off_hired') : [];
  const visibleItems = isJobMode ? (hireFilter === 'active' ? activeItems : returnedItems) : items;
  const assetMap = {};
  (siteAssets || []).forEach(a => { assetMap[a.id] = a; });
  const rigItemLinks = {};
  const linkedItemIds = new Set();
  for (const c of visibleItems) {
    const asset = c.site_asset_id ? assetMap[c.site_asset_id] : null;
    if (asset && asset.asset_type === 'rig' && asset.linked_equipment_ids?.length) {
      const linked = visibleItems.filter(other =>
        other.id !== c.id && other.site_asset_id && asset.linked_equipment_ids.includes(other.site_asset_id)
      );
      if (linked.length > 0) {
        rigItemLinks[c.id] = linked;
        linked.forEach(li => linkedItemIds.add(li.id));
      }
    }
  }
  const standaloneItems = visibleItems.filter(c => !linkedItemIds.has(c.id));
  const offHiringItem = items.find(c => c.id === offHiringId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <Boxes className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Equipment & Revenue</h2>
        {dailyTotal > 0 && <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{fmt(dailyTotal)}/day</span>}
        <span className={`text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium ${dailyTotal > 0 ? 'ml-1' : 'ml-auto'}`}>{items.length} items{items.some(i => i.category !== 'contractor_supplied') ? ` · ${fmt(totalNet)}` : ''}</span>
        {pendingPoa.length > 0 && (
          <button
            onClick={() => { const first = pendingPoa[0]; setConfirmingQuoteItem(first); }}
            className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-bold inline-flex items-center gap-1 border border-amber-300 hover:bg-amber-200 transition"
            title={`${pendingPoa.length} POA item(s) awaiting a confirmed price`}
          >
            <AlertCircle className="w-3 h-3" /> {pendingPoa.length} POA to confirm
          </button>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {!adding && (
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => { setForm(blankForm()); setEditingId(null); setAdding(true); }} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
              <Plus className="w-3.5 h-3.5" /> Add equipment
            </button>
            {isJobMode && presets.length > 0 && (
              <select value="" onChange={applyPreset} disabled={applyingPreset} className="text-xs px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-white text-emerald-700 font-medium hover:bg-emerald-50 cursor-pointer disabled:opacity-50">
                <option value="">{applyingPreset ? 'Adding…' : '📋 Add from preset…'}</option>
                {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            {isJobMode && rigsWithGear.length > 0 && (
              <select value="" onChange={addRigWithGear} disabled={addingRigGear} className="text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-700 font-medium hover:bg-blue-50 cursor-pointer disabled:opacity-50">
                <option value="">{addingRigGear ? 'Adding…' : '🚜 Add rig + gear…'}</option>
                {rigsWithGear.map(r => <option key={r.id} value={r.id}>{r.description} (+{(r.linked_catalogue_ids || []).length})</option>)}
              </select>
            )}
          </div>
        )}

        <Dialog open={adding} onOpenChange={(open) => { if (!open) { setAdding(false); setEditingId(null); setForm(blankForm()); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle>
            </DialogHeader>
            <EquipmentForm
              form={form}
              setForm={setForm}
              onSubmit={handleSubmitItem}
              onCancel={() => { setAdding(false); setEditingId(null); setForm(blankForm()); }}
              saving={savingItem}
              editing={!!editingId}
              suppliers={suppliers}
              contractors={contractors}
              clients={clients}
              defaultDates={defaultDates}
              catalogueItems={catalogueItems}
              rateCardItems={rateCardItems}
              ownedAssets={ownedAssets}
              staff={staffList}
            />
          </DialogContent>
        </Dialog>

        {isJobMode && (activeItems.length > 0 || returnedItems.length > 0) && (
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto sm:inline-flex">
            <button onClick={() => setHireFilter('active')} className={`flex-1 sm:flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${hireFilter === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <Truck className="w-3.5 h-3.5" /> Active ({activeItems.length})
            </button>
            <button onClick={() => setHireFilter('off_hired')} className={`flex-1 sm:flex-none inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${hireFilter === 'off_hired' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <FileCheck className="w-3.5 h-3.5" /> Returned ({returnedItems.length})
            </button>
          </div>
        )}

        {items.length === 0 && !adding ? (
          <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
            No equipment added yet. Click "Add equipment" to hire or assign items — costs flow automatically into Costing & Billing.
          </div>
        ) : isJobMode && hireFilter === 'off_hired' ? (
          returnedItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">No equipment has been returned yet.</div>
          ) : (
            <div className="space-y-2">
              {returnedItems.map(c => {
                const supplier = suppliers.find(s => s.id === c.supplier_id);
                const net = itemNet(c);
                const cfg = categoryConfig[c.category] || categoryConfig.hired_equipment;
                return (
                  <div key={c.id} className="border border-slate-200 bg-slate-50/70 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <FileCheck className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-600 line-through truncate">{c.description}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">{cfg.label}</span>
                        {c.po_number && <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium font-mono inline-flex items-center gap-1"><Package className="w-2.5 h-2.5" />{c.po_number}</span>}
                        {c.off_hire_date && <span className="text-[10px] text-slate-400">Returned {format(new Date(c.off_hire_date + 'T00:00:00'), 'dd MMM yyyy')}</span>}
                      </div>
                      {c.off_hire_note_url ? (
                        <a href={c.off_hire_note_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-medium bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition">
                          <FileCheck className="w-3.5 h-3.5" /> View off-hire note<ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <p className="mt-1 text-xs text-amber-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> No off-hire note</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <p className="text-sm font-bold text-slate-400">{fmt(net)}</p>
                      <button onClick={() => reinstate(c)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-700 font-medium px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 transition">
                        <Undo2 className="w-3.5 h-3.5" /> Reinstate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : visibleItems.length === 0 && !adding ? (
          <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">No active equipment.</div>
        ) : (
          <div className="space-y-2">
            {standaloneItems.map(c => (
              <EquipmentItemCard
                key={c.id}
                item={c}
                linkedItems={rigItemLinks[c.id] || []}
                assetMap={assetMap}
                suppliers={suppliers}
                contractors={contractors}
                clients={clients}
                isJobMode={isJobMode}
                categoryConfig={categoryConfig}
                locationBadge={locationBadge}
                complianceConfig={complianceConfig}
                onEdit={editItem}
                onDelete={deleteItem}
                onOffHire={openOffHire}
                onConfirmQuote={(c) => setConfirmingQuoteItem(c)}
              />
            ))}
          </div>
        )}
      </div>

      {isJobMode && offHiringId && offHiringItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4" onClick={() => !uploadingOffHire && setOffHiringId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"><FileCheck className="w-5 h-5 text-slate-700" /></div>
              <div>
                <h3 className="font-bold text-slate-900">Return equipment</h3>
                <p className="text-xs text-slate-400 truncate">{offHiringItem.description}</p>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-3">Mark this as returned to the supplier and attach the off-hire note.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Return date</label>
                <input type="date" value={offHireDate} onChange={e => setOffHireDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Off-hire note (PDF / photo)</label>
                <input ref={offHireFileRef} type="file" accept=".pdf,image/*,.doc,.docx" onChange={e => setOffHireFile(e.target.files[0])} className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium hover:file:bg-emerald-100 cursor-pointer" />
                {offHireFile && <p className="text-xs text-emerald-700 mt-1.5 inline-flex items-center gap-1"><FileCheck className="w-3 h-3" /> {offHireFile.name}</p>}
                {extractingOffHire && <p className="text-xs text-purple-600 mt-1.5 inline-flex items-center gap-1"><span className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" /> Extracting details from note…</p>}
                {extractedOffHireNote && <p className="text-xs text-purple-700 bg-purple-50 rounded-md px-2.5 py-1.5 border border-purple-200 mt-1.5 inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> {extractedOffHireNote}</p>}
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={confirmOffHire} disabled={uploadingOffHire || extractingOffHire} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition text-sm font-semibold disabled:opacity-50">
                {uploadingOffHire || extractingOffHire ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {uploadingOffHire ? 'Uploading…' : 'Extracting…'}</> : <><FileCheck className="w-3.5 h-3.5" /> Confirm return</>}
              </button>
              <button onClick={() => setOffHiringId(null)} disabled={uploadingOffHire || extractingOffHire} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition text-sm font-semibold">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {confirmingQuoteItem && (
        <ConfirmQuoteModal
          item={confirmingQuoteItem}
          jobId={jobId}
          onClose={() => setConfirmingQuoteItem(null)}
        />
      )}
    </div>
  );
}