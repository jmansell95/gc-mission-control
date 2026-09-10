import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Building2, Mail, Phone, User, MapPin, Loader2, Star } from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import SearchFilterBar from '@/components/SearchFilterBar';
import { useScopedEntity } from '@/hooks/useScopedEntity';
import { useDivision } from '@/contexts/DivisionContext';
import ContactsEditor from '@/components/ContactsEditor';
import ExpandableContacts from '@/components/staff/ExpandableContacts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm';
const blank = { name: '', parent_client_id: '', is_holding: false, contact_name: '', contact_email: '', contact_phone: '', contacts: [], yard_address: '', lat: '', lng: '', geofence_radius_override: '', is_partner: false, partner_color: '' };

export default function ClientManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(blank);
  const [searchQuery, setSearchQuery] = useState('');

  const queryClient = useQueryClient();
  const { activeDivisionId } = useDivision();
  const { data: clients = [] } = useScopedEntity('Client', { queryKey: ['clients'] });

  const filteredClients = clients.filter(c => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (c.name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q) || c.contact_email?.toLowerCase().includes(q));
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) { await base44.entities.Client.update(editingId, formData); }
    else { await base44.entities.Client.create({ ...formData, division_id: activeDivisionId }); }
    queryClient.invalidateQueries({ queryKey: ['scoped', 'Client'] });
    setFormData(blank);
    setShowForm(false); setEditingId(null);
  };

  const handleEdit = (c) => {
    setFormData({
      name: c.name || '', parent_client_id: c.parent_client_id || '', is_holding: c.is_holding || false,
      contact_name: c.contact_name || '', contact_email: c.contact_email || '',
      contact_phone: c.contact_phone || '', contacts: c.contacts || [],
      yard_address: c.yard_address || '',
      lat: c.lat ?? '', lng: c.lng ?? '', geofence_radius_override: c.geofence_radius_override ?? '',
      is_partner: c.is_partner || false, partner_color: c.partner_color || '',
    });
    setEditingId(c.id); setShowForm(true);
  };
  const handleDelete = async (id) => {
    if (confirm('Delete this client?')) {
      await base44.entities.Client.delete(id);
      queryClient.invalidateQueries({ queryKey: ['scoped', 'Client'] });
    }
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Building2}
        title="Manage Clients"
        description="Add and manage your client contacts — including their yard/collection point coordinates for geofence arrival detection"
        actions={
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(blank); }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium">
            <Plus className="w-4 h-4" /> Add Client
          </button>
        }
      />

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); setFormData(blank); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Client' : 'New Client'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Company Name *</label>
              <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Parent Group</label>
              <select
                value={formData.parent_client_id || ''}
                onChange={e => setFormData({ ...formData, parent_client_id: e.target.value })}
                className={inputCls}
              >
                <option value="">— Standalone client —</option>
                {clients
                  .filter(c => c.id !== editingId && (c.is_holding || c.is_partner))
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.is_holding ? ' (Holding Group)' : ''}</option>
                  ))
                }
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Link this operating entity to its parent holding group (e.g. link Concept to Phenna Group).</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
              <input type="text" value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Email</label>
              <input type="email" value={formData.contact_email} onChange={e => setFormData({ ...formData, contact_email: e.target.value })}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
              <input type="tel" value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })}
                className={inputCls} />
            </div>
            <ContactsEditor
              value={formData.contacts}
              onChange={(contacts) => setFormData((prev) => ({ ...prev, contacts }))}
              label="Additional Contacts"
            />
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Yard / Collection Point Address</label>
              <input type="text" value={formData.yard_address} onChange={e => setFormData({ ...formData, yard_address: e.target.value })}
                placeholder="e.g. Concept Consulting, Unit 5, Bristol Industrial Park, BS1 5XX"
                className={inputCls} />
              <p className="text-[11px] text-slate-400 mt-1">The address of the client's yard or depot where crews collect or return gear. Used as the reference for the geocode button below.</p>
            </div>

            {/* Geofence Location — for vehicle arrival/departure detection at client yards */}
            <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-1">
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" /> Yard / Collection Point Location
                <span className="text-xs text-slate-400 font-normal">(for Geotab geofence arrival/departure detection)</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <input type="number" step="any" value={formData.lat} onChange={(e) => setFormData({ ...formData, lat: e.target.value === '' ? '' : parseFloat(e.target.value) })} placeholder="Latitude (e.g. 51.5074)" className={inputCls + ' flex-1 min-w-[120px]'} />
                <input type="number" step="any" value={formData.lng} onChange={(e) => setFormData({ ...formData, lng: e.target.value === '' ? '' : parseFloat(e.target.value) })} placeholder="Longitude (e.g. -0.1278)" className={inputCls + ' flex-1 min-w-[120px]'} />
                <ClientGeocodeButton
                  address={formData.yard_address || formData.name}
                  onResult={(lat, lng) => setFormData(prev => ({ ...prev, lat, lng }))}
                />
              </div>
              <div className="mt-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">Geofence Radius Override (metres) — blank = global default</label>
                <input type="number" min="0" step="1" value={formData.geofence_radius_override} onChange={(e) => setFormData({ ...formData, geofence_radius_override: e.target.value === '' ? '' : parseFloat(e.target.value) })} placeholder="e.g. 250" className={inputCls + ' max-w-[200px]'} />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Set the client's yard GPS coordinates so Geotab can detect when vehicles arrive to collect or return gear. Override the radius for large yards.</p>
            </div>

            {/* Partner Client toggle — flags this client as a partner consultancy (e.g. Concept Engineering) */}
            <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-1">
              <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                <Star className="w-4 h-4 text-amber-500" /> Partner Client
                <span className="text-xs text-slate-400 font-normal">(flag consultancy clients that subcontract work to us)</span>
              </label>
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_partner || false}
                    onChange={e => setFormData({ ...formData, is_partner: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">This is a partner consultancy</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_holding || false}
                    onChange={e => setFormData({ ...formData, is_holding: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700">This is a holding/parent group</span>
                </label>
                {formData.is_partner && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 font-medium">Badge colour:</label>
                    <input
                      type="color"
                      value={formData.partner_color || '#2563eb'}
                      onChange={e => setFormData({ ...formData, partner_color: e.target.value })}
                      className="w-8 h-8 rounded border border-slate-200 cursor-pointer"
                    />
                  </div>
                )}
              </div>
              {formData.is_partner && (
                <p className="text-[11px] text-slate-400 mt-1.5">Partner jobs are visually differentiated on job cards, boards and the Workload Ownership dashboard widget with a distinct badge in this colour.</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-5">
            <button type="submit" className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">
              {editingId ? 'Update' : 'Add'} Client
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">
              Cancel
            </button>
          </div>
        </form>
        </DialogContent>
      </Dialog>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No clients yet. Add your first client above.</div>
      ) : (
        <div className="space-y-5">
          <SearchFilterBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by name, contact or email..."
            showCount
            totalCount={filteredClients.length}
          />
          {filteredClients.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No clients match your search.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredClients.map(c => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-extrabold text-slate-900 truncate">{c.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.is_holding && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-slate-700 text-white">
                              <Building2 className="w-3 h-3" /> Holding Group
                            </span>
                          )}
                          {c.is_partner && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                              style={{
                                backgroundColor: (c.partner_color || '#2563eb') + '15',
                                color: c.partner_color || '#2563eb',
                              }}
                            >
                              <Star className="w-3 h-3" /> Partner
                            </span>
                          )}
                          {c.parent_client_id && (() => {
                            const parent = clients.find(p => p.id === c.parent_client_id);
                            return parent ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                ↳ {parent.name}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleEdit(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    {c.contact_phone && (
                      <div className="flex items-center gap-2 font-semibold text-slate-700"><Phone className="w-3.5 h-3.5 text-slate-400" /><span>{c.contact_phone}</span></div>
                    )}
                    {c.contact_name && (
                      <div className="flex items-center gap-2 text-slate-600 text-xs"><User className="w-3.5 h-3.5 text-slate-400" /><span>{c.contact_name}</span></div>
                    )}
                    {c.contact_email && (
                      <div className="flex items-center gap-2 text-slate-500 text-xs"><Mail className="w-3.5 h-3.5 text-slate-400" /><span className="truncate">{c.contact_email}</span></div>
                    )}
                    {c.lat != null && c.lng != null && (
                      <div className="flex items-center gap-2 text-blue-600 font-medium text-xs">
                        <MapPin className="w-3.5 h-3.5" /> Geofence active
                        {c.geofence_radius_override && <span className="text-slate-400 font-normal">· {c.geofence_radius_override}m radius</span>}
                      </div>
                    )}
                    <ExpandableContacts contacts={c.contacts} label="contact" />
                    {!c.contact_name && !c.contact_email && !c.contact_phone && !(c.lat != null && c.lng != null) && (c.contacts || []).length === 0 && (
                      <p className="text-xs text-slate-400">No contact details</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClientGeocodeButton({ address, onResult }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' }
          },
          required: ['lat', 'lng']
        }
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
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 transition disabled:opacity-60 flex-shrink-0">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
        Auto-fill
      </button>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}