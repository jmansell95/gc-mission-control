import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Trash2, Truck, Scale, X, Loader2, CheckCircle2, Package, Weight,
  Calendar, MapPin, User, AlertCircle, RefreshCw, FileDown,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { safeFormat } from '@/utils/format';
import { downloadStructuredCsv } from '@/utils/csvExport';

const STATUS_META = {
  scrapped: { label: 'In Scrap Pile', tone: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  loaded_for_weigh_in: { label: 'Loaded for Weigh-In', tone: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  weighed_in: { label: 'Weighed In', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  disposed: { label: 'Disposed', tone: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

export default function ScrapPilePanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bookingItem, setBookingItem] = useState(null);
  const [weighInItem, setWeighInItem] = useState(null);

  const { data: scraps = [], isLoading } = useQuery({
    queryKey: ['scrap-logs'],
    queryFn: () => base44.entities.ScrapLog.list('-scrapped_date', 200),
  });
  const { data: vehicles = [] } = useQuery({ queryKey: ['vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });
  const { data: suppliers = [] } = useQuery({
    queryKey: ['scrap-yards'],
    queryFn: async () => {
      const all = await base44.entities.Supplier.list();
      return all.filter(s => s.maintenance_services?.includes('repair') || (s.name || '').toLowerCase().includes('scrap') || (s.name || '').toLowerCase().includes('metal') || (s.name || '').toLowerCase().includes('recycl'));
    },
  });

  const inPile = scraps.filter(s => s.status === 'scrapped');
  const loaded = scraps.filter(s => s.status === 'loaded_for_weigh_in');
  const weighed = scraps.filter(s => s.status === 'weighed_in' || s.status === 'disposed');

  const handleExportAudit = () => {
    if (!scraps.length) { toast({ title: 'No scrap records to export', variant: 'destructive' }); return; }
    const columns = [
      { key: 'asset_name', label: 'Asset' },
      { key: 'serial_number', label: 'Serial / Reg' },
      { key: 'asset_type', label: 'Type' },
      { key: 'scrap_category', label: 'Category' },
      { key: 'scrapped_date', label: 'Scrapped Date' },
      { key: 'scrapped_by_name', label: 'Scrapped By' },
      { key: 'reason', label: 'Reason' },
      { key: 'estimated_weight_kg', label: 'Est. Weight (kg)' },
      { key: 'actual_weight_kg', label: 'Actual Weight (kg)' },
      { key: 'scrap_yard_name', label: 'Scrap Yard' },
      { key: 'weigh_in_date', label: 'Weigh-In Date' },
      { key: 'weigh_in_ticket_ref', label: 'Ticket Ref' },
      { key: 'weigh_in_value_gbp', label: 'Value (£)' },
      { key: 'status', label: 'Status' },
      { key: 'notes', label: 'Notes' },
    ];
    downloadStructuredCsv(`scrap-disposal-audit-${new Date().toISOString().slice(0, 10)}.csv`, columns, scraps);
    toast({ title: 'Disposal audit exported', description: `${scraps.length} scrap records exported to CSV.` });
  };

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[10px] uppercase font-bold text-slate-400">In Pile</span></div>
          <p className="text-xl font-bold text-slate-900">{inPile.length}</p>
          <p className="text-[10px] text-slate-400">{inPile.reduce((sum, s) => sum + (s.estimated_weight_kg || 0), 0).toFixed(0)} kg est.</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-[10px] uppercase font-bold text-slate-400">Loaded</span></div>
          <p className="text-xl font-bold text-slate-900">{loaded.length}</p>
          <p className="text-[10px] text-slate-400">Awaiting weigh-in</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] uppercase font-bold text-slate-400">Weighed In</span></div>
          <p className="text-xl font-bold text-slate-900">{weighed.length}</p>
          <p className="text-[10px] text-slate-400">£{weighed.reduce((sum, s) => sum + (s.weigh_in_value_gbp || 0), 0).toFixed(0)} recovered</p>
        </div>
      </div>
      {scraps.length > 0 && (
        <button onClick={handleExportAudit} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-400 transition shadow-sm">
          <FileDown className="w-3.5 h-3.5" /> Export Disposal Audit
        </button>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : scraps.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Trash2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">Scrap pile is empty</p>
          <p className="text-xs text-slate-400 mt-1">Scan an asset in the Logistics Hub and tap "Scrap" to add items here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* In Pile */}
          {inPile.length > 0 && (
            <ScrapSection title="In Scrap Pile" items={inPile} vehicles={vehicles} staff={staff} suppliers={suppliers}
              onBookWeighIn={(item) => setBookingItem(item)} onWeighIn={(item) => setWeighInItem(item)} />
          )}
          {/* Loaded */}
          {loaded.length > 0 && (
            <ScrapSection title="Loaded for Weigh-In" items={loaded} vehicles={vehicles} staff={staff} suppliers={suppliers}
              onBookWeighIn={(item) => setBookingItem(item)} onWeighIn={(item) => setWeighInItem(item)} />
          )}
          {/* Weighed In */}
          {weighed.length > 0 && (
            <ScrapSection title="Weighed In / Disposed" items={weighed} vehicles={vehicles} staff={staff} suppliers={suppliers}
              onBookWeighIn={(item) => setBookingItem(item)} onWeighIn={(item) => setWeighInItem(item)} />
          )}
        </div>
      )}

      {/* Book to Weigh-In Modal */}
      {bookingItem && (
        <BookWeighInModal item={bookingItem} vehicles={vehicles} staff={staff} suppliers={suppliers}
          onClose={() => setBookingItem(null)}
          onBooked={() => { queryClient.invalidateQueries({ queryKey: ['scrap-logs'] }); setBookingItem(null); }} />
      )}

      {/* Record Weigh-In Modal */}
      {weighInItem && (
        <RecordWeighInModal item={weighInItem}
          onClose={() => setWeighInItem(null)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['scrap-logs'] }); setWeighInItem(null); }} />
      )}
    </div>
  );
}

function ScrapSection({ title, items, vehicles, staff, suppliers, onBookWeighIn, onWeighIn }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <span className="text-xs text-slate-400">{items.length} item{items.length > 1 ? 's' : ''}</span>
      </div>
      <div className="divide-y divide-slate-50">
        {items.map(item => {
          const meta = STATUS_META[item.status] || STATUS_META.scrapped;
          return (
            <div key={item.id} className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0"><Trash2 className="w-4 h-4 text-red-500" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 truncate">{item.asset_name}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${meta.tone}`}>{meta.label}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                  {item.serial_number && <span className="font-mono">{item.serial_number}</span>}
                  <span className="flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" /> {safeFormat(item.scrapped_date, 'dd MMM')}</span>
                  {item.estimated_weight_kg && <span className="flex items-center gap-0.5"><Weight className="w-2.5 h-2.5" /> {item.estimated_weight_kg}kg</span>}
                  {item.scrap_category && <span className="uppercase">{item.scrap_category}</span>}
                  {item.weigh_in_value_gbp != null && <span className="text-emerald-600 font-semibold">£{item.weigh_in_value_gbp.toFixed(0)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {item.status === 'scrapped' && (
                  <button onClick={() => onBookWeighIn(item)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition">
                    <Truck className="w-3.5 h-3.5" /> Book Weigh-In
                  </button>
                )}
                {item.status === 'loaded_for_weigh_in' && (
                  <button onClick={() => onWeighIn(item)} className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
                    <Scale className="w-3.5 h-3.5" /> Record Weigh-In
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookWeighInModal({ item, vehicles, staff, suppliers, onClose, onBooked }) {
  const { toast } = useToast();
  const [vehicleId, setVehicleId] = useState('');
  const [driverStaffId, setDriverStaffId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const handleBook = async () => {
    if (!vehicleId || !supplierId) { toast({ title: 'Select a vehicle and scrap yard', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      const supplier = suppliers.find(s => s.id === supplierId);
      const driver = staff.find(s => s.id === (driverStaffId || vehicle?.assigned_staff_id));
      const delivery = await base44.entities.DeliveryLog.create({
        delivery_type: 'supplier_collection',
        items: `Scrap: ${item.asset_name} (${item.scrap_category || 'mixed'})${item.estimated_weight_kg ? ` ~${item.estimated_weight_kg}kg` : ''}`,
        driver_staff_id: driver?.id || '',
        driver_staff_name: driver?.name || '',
        vehicle_id: vehicleId,
        pickup_address: 'GC Depot / Scrap Pile',
        delivery_address: supplier?.yard_address || supplier?.name || '',
        contact_name: supplier?.contact_name || '',
        contact_phone: supplier?.contact_phone || '',
        scheduled_date: date,
        status: 'pending',
        chargeable: false,
      });
      await base44.entities.ScrapLog.update(item.id, {
        status: 'loaded_for_weigh_in',
        vehicle_id: vehicleId,
        delivery_log_id: delivery.id,
        scrap_yard_supplier_id: supplierId,
        scrap_yard_name: supplier?.name || '',
      });
      onBooked();
    } catch (e) { toast({ title: 'Error', description: 'Could not book weigh-in', variant: 'destructive' }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center"><Truck className="w-4 h-4 text-emerald-700" /></div><div><h3 className="font-bold text-slate-900">Book to Weigh-In</h3><p className="text-[11px] text-slate-400">Load scrap onto a vehicle for the yard run</p></div></div>
          <button onClick={() => !saving && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3.5">
          <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3"><Trash2 className="w-5 h-5 text-red-500 flex-shrink-0" /><div><p className="text-sm font-bold text-slate-900">{item.asset_name}</p><p className="text-xs text-slate-500">{item.scrap_category || 'mixed'} · {item.estimated_weight_kg || '?'}kg est.</p></div></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Scrap Yard / Weighbridge *</label><select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white"><option value="">Select scrap yard…</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Vehicle *</label><select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white"><option value="">Select vehicle…</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Driver</label><select value={driverStaffId} onChange={e => setDriverStaffId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 bg-white"><option value="">Auto / Select…</option>{staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" /></div>
          </div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
          <button onClick={handleBook} disabled={saving} className="flex-1 py-2.5 bg-emerald-700 text-white rounded-xl font-semibold text-sm hover:bg-emerald-800 transition disabled:opacity-60 inline-flex items-center justify-center gap-1.5">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} {saving ? 'Booking…' : 'Confirm Load'}</button>
          <button onClick={() => !saving && onClose()} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function RecordWeighInModal({ item, onClose, onSaved }) {
  const { toast } = useToast();
  const [actualWeight, setActualWeight] = useState(item.actual_weight_kg || item.estimated_weight_kg || '');
  const [value, setValue] = useState(item.weigh_in_value_gbp || '');
  const [ticketRef, setTicketRef] = useState(item.weigh_in_ticket_ref || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.ScrapLog.update(item.id, {
        status: 'weighed_in',
        actual_weight_kg: Number(actualWeight) || null,
        weigh_in_value_gbp: Number(value) || null,
        weigh_in_ticket_ref: ticketRef,
        weigh_in_date: date,
      });
      // Also update the asset's disposal_value
      if (item.asset_id) {
        await base44.entities.SiteAsset.update(item.asset_id, { disposal_value: Number(value) || null });
      }
      onSaved();
    } catch (e) { toast({ title: 'Error', description: 'Could not save weigh-in', variant: 'destructive' }); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto overscroll-contain p-4 bg-slate-950/60 backdrop-blur-md" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><Scale className="w-4 h-4 text-blue-700" /></div><div><h3 className="font-bold text-slate-900">Record Weigh-In</h3><p className="text-[11px] text-slate-400">Enter weighbridge ticket details</p></div></div>
          <button onClick={() => !saving && onClose()} className="p-1 text-slate-400 hover:text-slate-600 rounded"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3.5">
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl p-3"><Package className="w-5 h-5 text-slate-400 flex-shrink-0" /><div><p className="text-sm font-bold text-slate-900">{item.asset_name}</p><p className="text-xs text-slate-500">{item.scrap_yard_name || 'Scrap yard'} · Est. {item.estimated_weight_kg || '?'}kg</p></div></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Actual Weight (kg)</label><input type="number" step="0.1" value={actualWeight} onChange={e => setActualWeight(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" /></div>
            <div><label className="block text-xs font-medium text-slate-600 mb-1">Value (£)</label><input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" /></div>
          </div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Weighbridge Ticket Ref</label><input type="text" value={ticketRef} onChange={e => setTicketRef(e.target.value)} placeholder="Ticket number…" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" /></div>
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Weigh-In Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-600" /></div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex gap-2">
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition disabled:opacity-60 inline-flex items-center justify-center gap-1.5">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {saving ? 'Saving…' : 'Save Weigh-In'}</button>
          <button onClick={() => !saving && onClose()} className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}