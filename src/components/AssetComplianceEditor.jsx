import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Save, Trash2, Cog, Wrench, Package, Truck, Anchor, AlertTriangle, Plug,
  Link2, Plus, Check, Search, MapPin, Database, Sparkles, Calendar,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  DEFAULT_SERVICE_INTERVALS, DEFAULT_COMPLIANCE_CATEGORIES, DEFAULT_INSPECTION_CYCLE_MONTHS,
  COMMON_STORAGE_LOCATIONS, COMMON_COLOURS, autoComplianceStatus, autoNextServiceDate,
  autoMaintenanceStatus, findDuplicateSerial,
} from '@/utils/assetSmartDefaults';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { useDivision } from '@/contexts/DivisionContext';

const ASSET_TYPES = [
  { value: 'rig', label: 'Rig', icon: Cog },
  { value: 'machinery', label: 'Machinery', icon: Wrench },
  { value: 'trailer', label: 'Trailer', icon: Package },
  { value: 'lifting', label: 'Lifting Gear', icon: Anchor },
  { value: 'portable_appliance', label: 'PAT / Electrical', icon: Plug },
];

const RIG_TYPES = [
  { value: 'n/a', label: 'N/A' },
  { value: 'cp', label: 'CP (Cable Percussion)' },
  { value: 'rotary', label: 'Rotary' },
];

const EMPTY = {
  name: '', asset_type: 'machinery', rig_type: 'n/a', is_rig: false,
  equipment_type: '', compliance_category: '', serial_number: '',
  colour: '', storage_location: '', panda_asset_id: '', external_compliance_id: '',
  responsible_person: '', tooling_notes: '', compliance_status: 'unknown',
  compliance_expiry_date: '', last_service_date: '', next_service_date: '',
  service_notes: '', repair_notes: '', is_active: true, notes: '',
  stock_level: 'unknown',
  service_interval_hours: '', operating_hours: 0, hours_since_last_service: 0, hours_at_last_service: 0,
  linked_equipment_ids: [],
  make: '', model: '', fleet_number: '', fuel_type: '', condition: '',
  hours_used: '', length: '', cost_price: '', charge_out_price: '',
};

const STOCK_LEVELS = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'low_stock', label: 'Low Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'needs_service', label: 'Needs Service' },
  { value: 'unknown', label: 'Unknown' },
];

export default function AssetComplianceEditor({ asset, onClose }) {
  const isEdit = !!asset;
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLinker, setShowLinker] = useState(false);
  const [pendingLinks, setPendingLinks] = useState([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [autoCompliance, setAutoCompliance] = useState(true);
  const [autoNextService, setAutoNextService] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeDivisionId } = useDivision();

  // Load all assets for duplicate serial detection + linked equipment selection
  const { data: allAssets = [] } = useScopedEntity('SiteAsset', { queryKey: ['site-assets'], sort: '-created_date', limit: 500 });

  useEffect(() => {
    if (asset) {
      setForm({
        ...EMPTY,
        ...asset,
        rig_type: asset.rig_type || 'n/a',
        compliance_status: asset.compliance_status || 'unknown',
        is_active: asset.is_active !== false,
        is_rig: asset.asset_type === 'rig',
        linked_equipment_ids: asset.linked_equipment_ids || [],
      });
      // If editing an existing asset with a manually-set status, don't auto-calc
      setAutoCompliance(false);
      setAutoNextService(false);
    } else {
      // New asset — apply smart defaults for the default type
      applySmartDefaults('machinery');
    }
  }, [asset]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  // Smart defaults: auto-set compliance category, service interval, and rig type
  const applySmartDefaults = (type) => {
    setForm(prev => ({
      ...prev,
      asset_type: type,
      is_rig: type === 'rig',
      rig_type: type === 'rig' ? (prev.rig_type !== 'n/a' ? prev.rig_type : 'n/a') : 'n/a',
      compliance_category: prev.compliance_category || DEFAULT_COMPLIANCE_CATEGORIES[type] || '',
      service_interval_hours: prev.service_interval_hours || DEFAULT_SERVICE_INTERVALS[type] || '',
    }));
  };

  const handleTypeChange = (type) => {
    applySmartDefaults(type);
  };

  // Auto-calculate compliance status when expiry date changes
  useEffect(() => {
    if (autoCompliance && form.compliance_expiry_date) {
      const status = autoComplianceStatus(form.compliance_expiry_date);
      set('compliance_status', status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.compliance_expiry_date, autoCompliance]);

  // Auto-calculate next service date when last service date changes
  useEffect(() => {
    if (autoNextService && form.last_service_date) {
      const next = autoNextServiceDate(form.last_service_date, form.asset_type);
      if (next) set('next_service_date', next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.last_service_date, autoNextService, form.asset_type]);

  // Duplicate serial detection
  const duplicateNames = useMemo(
    () => findDuplicateSerial(form.serial_number, allAssets, asset?.id),
    [form.serial_number, allAssets, asset?.id]
  );

  // Linkable equipment (not a rig, not already linked, active)
  const linkable = useMemo(() => {
    const existing = new Set([...(form.linked_equipment_ids || []), ...pendingLinks]);
    const q = linkSearch.toLowerCase().trim();
    return allAssets.filter(a =>
      a.id !== asset?.id &&
      a.asset_type !== 'rig' &&
      !existing.has(a.id) &&
      a.is_active !== false &&
      (!q || (a.name || '').toLowerCase().includes(q) || (a.serial_number || '').toLowerCase().includes(q))
    );
  }, [allAssets, form.linked_equipment_ids, pendingLinks, asset?.id, linkSearch]);

  const togglePending = (id) => setPendingLinks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    if (duplicateNames.length > 0) {
      toast({
        title: 'Duplicate serial number',
        description: `Serial "${form.serial_number}" already used by: ${duplicateNames.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      // Auto-calc compliance status one final time if enabled
      let finalStatus = form.compliance_status;
      if (autoCompliance && form.compliance_expiry_date) {
        finalStatus = autoComplianceStatus(form.compliance_expiry_date);
      }
      // Auto-calc next service date one final time if enabled
      let finalNextService = form.next_service_date;
      if (autoNextService && form.last_service_date) {
        finalNextService = autoNextServiceDate(form.last_service_date, form.asset_type) || finalNextService;
      }

      const payload = {
        division_id: activeDivisionId,
        name: form.name.trim(),
        asset_type: form.asset_type,
        is_rig: form.asset_type === 'rig',
        rig_type: form.asset_type === 'rig' ? form.rig_type : 'n/a',
        equipment_type: form.equipment_type || '',
        make: form.make || '',
        model: form.model || '',
        fleet_number: form.fleet_number || '',
        fuel_type: form.fuel_type || '',
        condition: form.condition || '',
        hours_used: form.hours_used === '' ? null : (Number(form.hours_used) || null),
        length: form.length === '' ? null : (Number(form.length) || null),
        cost_price: form.cost_price === '' ? null : (Number(form.cost_price) || null),
        charge_out_price: form.charge_out_price === '' ? null : (Number(form.charge_out_price) || null),
        compliance_category: form.compliance_category || '',
        serial_number: form.serial_number || '',
        colour: form.colour || '',
        storage_location: form.storage_location || '',
        panda_asset_id: form.panda_asset_id || '',
        external_compliance_id: form.external_compliance_id || '',
        responsible_person: form.responsible_person || '',
        tooling_notes: form.tooling_notes || '',
        compliance_status: finalStatus,
        compliance_expiry_date: form.compliance_expiry_date || null,
        last_service_date: form.last_service_date || null,
        next_service_date: finalNextService || null,
        service_notes: form.service_notes || '',
        repair_notes: form.repair_notes || '',
        is_active: form.is_active !== false,
        notes: form.notes || '',
        stock_level: form.stock_level || 'unknown',
        service_interval_hours: (form.asset_type === 'rig' || form.asset_type === 'machinery')
          ? (Number(form.service_interval_hours) || (form.asset_type === 'rig' ? 250 : 500))
          : null,
        operating_hours: Number(form.operating_hours) || 0,
        hours_at_last_service: Number(form.hours_at_last_service) || 0,
        linked_equipment_ids: form.asset_type === 'rig'
          ? [...(form.linked_equipment_ids || []), ...pendingLinks]
          : [],
      };

      // Auto-calc maintenance_status
      payload.maintenance_status = autoMaintenanceStatus(payload);

      if (isEdit) {
        await base44.entities.SiteAsset.update(asset.id, payload);
        toast({ title: 'Asset updated', description: `${payload.name} saved.` });
        // Push back to Asset Panda so it stays the source of truth bidirectionally
        if (payload.panda_asset_id) {
          try {
            await base44.functions.invoke('pushAssetUpdateToPanda', { asset_id: asset.id, action: 'update' });
          } catch (_) { /* non-fatal — local record is already saved */ }
        }
      } else {
        const created = await base44.entities.SiteAsset.create(payload);
        toast({ title: 'Asset added', description: `${payload.name} created.` });
        // Optionally create a matching object in Asset Panda
        if (payload.panda_asset_id) {
          try {
            await base44.functions.invoke('pushAssetUpdateToPanda', { asset_id: created.id, action: 'update' });
          } catch (_) { /* non-fatal */ }
        }
      }
      queryClient.invalidateQueries({ queryKey: ['scoped', 'SiteAsset'] });
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] });
      onClose();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await base44.entities.SiteAsset.delete(asset.id);
      toast({ title: 'Asset deleted', description: `${asset.name} removed.` });
      queryClient.invalidateQueries({ queryKey: ['scoped', 'SiteAsset'] });
      queryClient.invalidateQueries({ queryKey: ['job-asset-assignments'] });
      onClose();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const isRig = form.asset_type === 'rig';
  const hasUsageMaintenance = isRig || form.asset_type === 'machinery';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 overflow-y-auto" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full my-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
              {isEdit ? 'Edit Asset' : 'Add Asset'}
              {!isEdit && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><Sparkles className="w-3 h-3" /> SMART</span>}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{isEdit ? 'Manage compliance & service records' : 'Smart defaults & auto-calculation enabled'}</p>
          </div>
          <button onClick={() => !saving && onClose()} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
          {/* Identity */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Asset Name *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="e.g. Truck-mounted Rig 1, Sling S-04, Excavator CAT 320"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Asset Type</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                {ASSET_TYPES.map(t => {
                  const Icon = t.icon;
                  const active = form.asset_type === t.value;
                  return (
                    <button key={t.value} type="button" onClick={() => handleTypeChange(t.value)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-[10px] font-medium transition ${active ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                      <Icon className="w-4 h-4" /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {isRig && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Rig Type</label>
                  <select value={form.rig_type} onChange={e => set('rig_type', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                    {RIG_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Colour (for ID)</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {COMMON_COLOURS.map(c => (
                      <button key={c} type="button" onClick={() => set('colour', form.colour === c ? '' : c)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition ${form.colour === c ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Serial / Reg Number</label>
                <input type="text" value={form.serial_number} onChange={e => set('serial_number', e.target.value)}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none ${duplicateNames.length > 0 ? 'border-red-400 bg-red-50' : 'border-slate-300 focus:border-emerald-600'}`} />
                {duplicateNames.length > 0 && (
                  <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Duplicate: {duplicateNames.join(', ')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Equipment Type</label>
                <input type="text" value={form.equipment_type} onChange={e => set('equipment_type', e.target.value)}
                  placeholder="e.g. Overshot Tool, Sling, Shackle"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Compliance Category</label>
                <input type="text" value={form.compliance_category} onChange={e => set('compliance_category', e.target.value)}
                  placeholder="Auto-set by type"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Storage Location</label>
                <input type="text" list="storage-locations" value={form.storage_location} onChange={e => set('storage_location', e.target.value)}
                  placeholder="e.g. Dartford Depot"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                <datalist id="storage-locations">
                  {COMMON_STORAGE_LOCATIONS.map(l => <option key={l} value={l} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Responsible Person</label>
                <input type="text" value={form.responsible_person} onChange={e => set('responsible_person', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><Database className="w-3 h-3" /> Asset Panda ID</label>
                <input type="text" value={form.panda_asset_id} onChange={e => set('panda_asset_id', e.target.value)}
                  placeholder="Optional — for sync"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">External Compliance ID</label>
              <input type="text" value={form.external_compliance_id} onChange={e => set('external_compliance_id', e.target.value)}
                placeholder="GC Compliance Manager reference (optional)"
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
            </div>
          </div>

          {/* Specifications (Asset Panda) */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> Specifications
              {form.panda_asset_id && <span className="text-[10px] font-normal text-blue-600 normal-case tracking-normal">· pushed to Asset Panda on save</span>}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Make</label>
                <input type="text" value={form.make || ''} onChange={e => set('make', e.target.value)} placeholder="e.g. Caterpillar"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Model</label>
                <input type="text" value={form.model || ''} onChange={e => set('model', e.target.value)} placeholder="e.g. 320"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fleet / FAA Number</label>
                <input type="text" value={form.fleet_number || ''} onChange={e => set('fleet_number', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fuel Type</label>
                <input type="text" value={form.fuel_type || ''} onChange={e => set('fuel_type', e.target.value)} placeholder="Diesel / Petrol / Electric"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Condition</label>
                <input type="text" value={form.condition || ''} onChange={e => set('condition', e.target.value)} placeholder="Good / Fair / Poor"
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Hours Used (Panda)</label>
                <input type="number" value={form.hours_used ?? ''} onChange={e => set('hours_used', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Length (m)</label>
                <input type="number" step="0.1" value={form.length ?? ''} onChange={e => set('length', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Compliance & Inspection</p>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={autoCompliance} onChange={e => setAutoCompliance(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-[10px] font-medium text-emerald-700 flex items-center gap-0.5"><Sparkles className="w-3 h-3" /> Auto-calc status</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Compliance Status</label>
                <select value={form.compliance_status} onChange={e => set('compliance_status', e.target.value)} disabled={autoCompliance}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white disabled:bg-slate-50 disabled:text-slate-500">
                  <option value="compliant">Compliant</option>
                  <option value="expiring">Expiring Soon</option>
                  <option value="expired">Expired</option>
                  <option value="unknown">Unknown</option>
                </select>
                {autoCompliance && <p className="text-[10px] text-emerald-600 mt-1">Auto-set from expiry date</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Compliance Expiry Date</label>
                <input type="date" value={form.compliance_expiry_date || ''} onChange={e => set('compliance_expiry_date', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><Database className="w-3 h-3" /> Stock Level (Asset Panda)</label>
                <select value={form.stock_level || 'unknown'} onChange={e => set('stock_level', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white">
                  {STOCK_LEVELS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                {form.panda_asset_id && <p className="text-[10px] text-blue-600 mt-1">Pushes back to Asset Panda on save</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Last Service / Test Date</label>
                <input type="date" value={form.last_service_date || ''} onChange={e => set('last_service_date', e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">
                  <span>Next Service Due</span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={autoNextService} onChange={e => setAutoNextService(e.target.checked)}
                      className="w-3 h-3 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                    <span className="text-[9px] font-medium text-emerald-700 flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> Auto</span>
                  </label>
                </label>
                <input type="date" value={form.next_service_date || ''} onChange={e => set('next_service_date', e.target.value)} disabled={autoNextService}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 disabled:bg-slate-50" />
                {autoNextService && form.last_service_date && (
                  <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-0.5">
                    <Calendar className="w-3 h-3" /> +{DEFAULT_INSPECTION_CYCLE_MONTHS[form.asset_type] || 12} months
                  </p>
                )}
              </div>
            </div>
            {/* Usage-based maintenance (rigs & machinery only) */}
            {hasUsageMaintenance && (
              <div className="mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Cog className="w-3.5 h-3.5" /> Usage-Based Maintenance
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Service Interval (hrs)</label>
                    <input type="number" value={form.service_interval_hours || ''} onChange={e => set('service_interval_hours', e.target.value)}
                      placeholder={isRig ? '250' : '500'}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Operating Hours</label>
                    <input type="number" value={form.operating_hours || 0} onChange={e => set('operating_hours', e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-slate-50" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Hours at Last Service</label>
                    <input type="number" value={form.hours_at_last_service || 0} onChange={e => set('hours_at_last_service', e.target.value)}
                      className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-slate-50" />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">Engine hours are auto-calculated from drilling logs. Default: 250h for CP rigs, 500h for heavy machinery.</p>
              </div>
            )}
          </div>

          {/* Pricing (Asset Panda) */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" /> Pricing
              {form.panda_asset_id && <span className="text-[10px] font-normal text-blue-600 normal-case tracking-normal">· pushed to Asset Panda on save</span>}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cost Price (£)</label>
                <input type="number" step="0.01" value={form.cost_price ?? ''} onChange={e => set('cost_price', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Charge-Out Price (£)</label>
                <input type="number" step="0.01" value={form.charge_out_price ?? ''} onChange={e => set('charge_out_price', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
          </div>

          {/* Linked Equipment (rigs only — during creation) */}
          {isRig && (
            <div className="border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Linked Toolkit & Equipment
                </p>
                <button type="button" onClick={() => setShowLinker(s => !s)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-semibold transition">
                  <Plus className="w-3.5 h-3.5" /> Link Equipment
                </button>
              </div>
              {/* Already linked (edit mode) */}
              {(form.linked_equipment_ids || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(form.linked_equipment_ids || []).map(id => {
                    const a = allAssets.find(x => x.id === id);
                    if (!a) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-medium border border-emerald-200">
                        <Check className="w-3 h-3" /> {a.name}
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Pending links */}
              {pendingLinks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {pendingLinks.map(id => {
                    const a = allAssets.find(x => x.id === id);
                    if (!a) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-[11px] font-medium border border-blue-200">
                        <Plus className="w-3 h-3" /> {a.name}
                        <button type="button" onClick={() => togglePending(id)} className="ml-0.5 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {showLinker && (
                <div className="p-3 bg-emerald-50/40 rounded-lg border border-emerald-100">
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input type="text" value={linkSearch} onChange={e => setLinkSearch(e.target.value)} placeholder="Search equipment..."
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-emerald-600" />
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {linkable.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No unlinked equipment available.</p>
                    ) : linkable.slice(0, 20).map(a => {
                      const checked = pendingLinks.includes(a.id);
                      return (
                        <label key={a.id} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-emerald-300 transition">
                          <input type="checkbox" checked={checked} onChange={() => togglePending(a.id)} className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-slate-800 truncate">{a.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{a.equipment_type || a.asset_type}{a.serial_number ? ` · ${a.serial_number}` : ''}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Notes & History</p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tooling Notes</label>
              <textarea value={form.tooling_notes} onChange={e => set('tooling_notes', e.target.value)} rows={2}
                placeholder="Casing sizes, augers, core barrels..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Service Notes</label>
              <textarea value={form.service_notes} onChange={e => set('service_notes', e.target.value)} rows={2}
                placeholder="Last test result, tested by, inspector..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Repair Notes</label>
              <textarea value={form.repair_notes} onChange={e => set('repair_notes', e.target.value)} rows={2}
                placeholder="Faults, decommission reasons..."
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">General Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={form.is_active !== false} onChange={e => set('is_active', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm text-slate-700 font-medium">Active &amp; available for job assignment</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center gap-2">
          {isEdit && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)} disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition disabled:opacity-50">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
          {isEdit && confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Delete permanently?</span>
              <button onClick={handleDelete} disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> Yes, delete
              </button>
              <button onClick={() => setConfirmDelete(false)} disabled={saving}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition">Cancel</button>
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => !saving && onClose()} disabled={saving}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition disabled:opacity-50">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-lg text-sm font-semibold hover:brightness-110 transition disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Asset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}