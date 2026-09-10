import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { useDivision } from '@/contexts/DivisionContext';
import FormModal from '@/components/ui/FormModal';
import ContactsEditor from '@/components/ContactsEditor';
import {
  Building2, Star, MapPin, Loader2, Users, UserCircle2,
} from 'lucide-react';

/**
 * ClientFormModal — the single, full client create/edit form for the whole app.
 * Used by the People Hub Contacts tab → Clients sub-tab.
 *
 * Replaces the old standalone ClientManager page and the minimal name+phone
 * inline form that previously lived in ContactsTab.
 *
 * Sections: Identity, Partner & Group, Contacts, Yard & Geofence.
 */
const blank = {
  name: '',
  parent_client_id: '',
  is_holding: false,
  is_partner: false,
  partner_color: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  contacts: [],
  yard_address: '',
  lat: '',
  lng: '',
  geofence_radius_override: '',
};

export default function ClientFormModal({ open, onClose, editing, clients }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeDivisionId } = useDivision();
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name || '',
          parent_client_id: editing.parent_client_id || '',
          is_holding: editing.is_holding || false,
          is_partner: editing.is_partner || false,
          partner_color: editing.partner_color || '',
          contact_name: editing.contact_name || '',
          contact_email: editing.contact_email || '',
          contact_phone: editing.contact_phone || '',
          contacts: Array.isArray(editing.contacts) ? editing.contacts : [],
          yard_address: editing.yard_address || '',
          lat: editing.lat ?? '',
          lng: editing.lng ?? '',
          geofence_radius_override: editing.geofence_radius_override ?? '',
        });
      } else {
        setForm(blank);
      }
    }
  }, [open, editing]);

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const cleanPayload = (data) => {
    const cleaned = { ...data };
    if (cleaned.lat === '') delete cleaned.lat;
    if (cleaned.lng === '') delete cleaned.lng;
    if (cleaned.geofence_radius_override === '') delete cleaned.geofence_radius_override;
    if (!cleaned.parent_client_id) delete cleaned.parent_client_id;
    if (!cleaned.partner_color) delete cleaned.partner_color;
    return cleaned;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name?.trim()) {
      toast({ title: 'Company name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = cleanPayload(form);
      if (editing) {
        await base44.entities.Client.update(editing.id, payload);
        toast({ title: 'Client updated' });
      } else {
        await base44.entities.Client.create({ ...payload, division_id: activeDivisionId });
        toast({ title: 'Client added' });
      }
      queryClient.invalidateQueries({ queryKey: ['contacts-clients'] });
      queryClient.invalidateQueries({ queryKey: ['scoped', 'Client'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    } catch (err) {
      toast({ title: 'Failed to save client', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1.5';
  const sectionTitle = 'text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5';
  const gridCls = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5';

  // Parent group options — holding groups and partners, excluding self
  const parentOptions = (clients || []).filter(c => c.id !== editing?.id && (c.is_holding || c.is_partner));

  return (
    <FormModal
      open={open}
      onClose={onClose}
      icon={Building2}
      title={editing ? 'Edit Client' : 'New Client'}
      description={editing ? 'Update this client\'s details, partner status and group.' : 'Add a new client — including partner/holding group relationships.'}
      size="3xl"
      saveLabel={editing ? 'Update' : 'Add Client'}
      onSave={handleSave}
      saving={saving}
    >
      <div className="space-y-6">
        {/* Identity */}
        <section>
          <p className={sectionTitle}><UserCircle2 className="w-3.5 h-3.5" /> Identity</p>
          <div className={gridCls}>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className={labelCls}>Company Name *</label>
              <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contact Name</label>
              <input type="text" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contact Email</label>
              <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Contact Phone</label>
              <input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} className={inputCls} />
            </div>
          </div>
        </section>

        {/* Partner & Group */}
        <section>
          <p className={sectionTitle}><Star className="w-3.5 h-3.5" /> Partner & Group</p>
          <div className={gridCls}>
            <div className="sm:col-span-2 lg:col-span-1">
              <label className={labelCls}>Parent Group</label>
              <select value={form.parent_client_id || ''} onChange={e => set('parent_client_id', e.target.value)} className={inputCls}>
                <option value="">— Standalone client —</option>
                {parentOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.is_holding ? ' (Holding Group)' : ''}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">Link this operating entity to its parent holding group (e.g. link Concept to Phenna Group).</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-2 flex items-center gap-4 flex-wrap self-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_partner || false} onChange={e => set('is_partner', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
                <span className="text-sm text-slate-700">Partner consultancy</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_holding || false} onChange={e => set('is_holding', e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
                <span className="text-sm text-slate-700">Holding / parent group</span>
              </label>
              {form.is_partner && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 font-medium">Badge colour:</label>
                  <input type="color" value={form.partner_color || '#2563eb'} onChange={e => set('partner_color', e.target.value)} className="w-8 h-8 rounded border border-slate-200 cursor-pointer" />
                </div>
              )}
            </div>
          </div>
          {form.is_partner && (
            <p className="text-[10px] text-slate-400 mt-2">Partner jobs are visually differentiated on job cards, boards and the Workload Ownership dashboard widget with a distinct badge in this colour.</p>
          )}
        </section>

        {/* Contacts */}
        <section>
          <p className={sectionTitle}><Users className="w-3.5 h-3.5" /> Additional Contacts</p>
          <ContactsEditor
            value={form.contacts}
            onChange={(contacts) => set('contacts', contacts)}
            label="Contacts"
          />
        </section>

        {/* Yard & Geofence */}
        <section>
          <p className={sectionTitle}><MapPin className="w-3.5 h-3.5" /> Yard & Geofence</p>
          <div className={gridCls}>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelCls}>Yard / Collection Point Address</label>
              <input type="text" value={form.yard_address} onChange={e => set('yard_address', e.target.value)} placeholder="e.g. Concept Consulting, Unit 5, Bristol Industrial Park, BS1 5XX" className={inputCls} />
              <p className="text-[10px] text-slate-400 mt-1">The address of the client's yard or depot where crews collect or return gear.</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-3 border-t border-slate-100 pt-3">
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                <MapPin className="w-4 h-4 text-[#2E5A1A]" /> Yard Location
                <span className="text-xs text-slate-400 font-normal">(for Geotab geofence arrival/departure detection)</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="number" step="any" value={form.lat} onChange={e => set('lat', e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Latitude (e.g. 51.5074)" className={inputCls + ' flex-1 min-w-[120px]'} />
                <input type="number" step="any" value={form.lng} onChange={e => set('lng', e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="Longitude (e.g. -0.1278)" className={inputCls + ' flex-1 min-w-[120px]'} />
                <ClientGeocodeButton
                  address={form.yard_address || form.name}
                  onResult={(lat, lng) => setForm(prev => ({ ...prev, lat, lng }))}
                />
              </div>
              <div className="mt-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Geofence Radius Override (metres) — blank = global default</label>
                <input type="number" min="0" step="1" value={form.geofence_radius_override} onChange={e => set('geofence_radius_override', e.target.value === '' ? '' : parseFloat(e.target.value))} placeholder="e.g. 250" className={inputCls + ' max-w-[200px]'} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </FormModal>
  );
}

function ClientGeocodeButton({ address, onResult }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleGeocode = async () => {
    if (!address?.trim()) { setError('Enter a yard address or client name first'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Return the GPS latitude and longitude of this UK location as a JSON object: "${address}". Use only valid numeric coordinates. If the address is ambiguous, return the most likely match for the UK.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: { lat: { type: 'number' }, lng: { type: 'number' } },
          required: ['lat', 'lng'],
        },
      });
      if (res && typeof res.lat === 'number' && typeof res.lng === 'number') {
        onResult(res.lat, res.lng);
      } else {
        setError('Could not geocode this location');
      }
    } catch (e) {
      setError(e.message || 'Geocode failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={handleGeocode} disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 transition disabled:opacity-60 flex-shrink-0">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
        Auto-fill
      </button>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}