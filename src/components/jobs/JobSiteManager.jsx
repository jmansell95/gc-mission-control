import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Edit2, Trash2, X, Navigation, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-sm transition";

const siteStatusBadge = {
  planning: 'bg-slate-100 text-slate-600',
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-teal-100 text-teal-700',
  on_hold: 'bg-amber-100 text-amber-700',
};

const siteStatusLabels = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
};

export default function JobSiteManager({ job }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const sites = Array.isArray(job.sites) ? job.sites : [];

  const saveSite = async (siteData) => {
    setSaving(true);
    try {
      const updatedSites = editing?.index != null
        ? sites.map((s, i) => i === editing.index ? siteData : s)
        : [...sites, siteData];
      await base44.entities.Job.update(job.id, { sites: updatedSites });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({ title: editing?.index != null ? 'Site updated' : 'Site added' });
      setEditing(null);
    } catch (e) {
      toast({ title: 'Could not save site', description: e.message });
    }
    setSaving(false);
  };

  const deleteSite = async (index) => {
    try {
      const updatedSites = sites.filter((_, i) => i !== index);
      await base44.entities.Job.update(job.id, { sites: updatedSites });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({ title: 'Site removed' });
    } catch (e) {
      toast({ title: 'Could not remove site', description: e.message });
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { toast({ title: 'Geolocation not supported' }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setEditing(prev => ({ ...prev, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })),
      () => toast({ title: 'Could not get your location' })
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm">Sites</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            {sites.length === 0 ? 'No additional sites — this job uses the primary location' : `${sites.length} ${sites.length === 1 ? 'site' : 'sites'} within this job`}
          </p>
        </div>
        <button onClick={() => setEditing({})} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition shadow-sm">
          <Plus className="w-4 h-4" /> Add Site
        </button>
      </div>

      {/* Primary site */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="font-semibold text-slate-900 text-sm">Primary Site</h3>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase">Default</span>
        </div>
        <p className="text-sm text-slate-700">{job.location || 'No location set'}</p>
        {job.site_lat != null && job.site_lng != null && (
          <p className="text-xs text-slate-400 mt-1 tabular-nums">{Number(job.site_lat).toFixed(6)}, {Number(job.site_lng).toFixed(6)}</p>
        )}
      </div>

      {/* Additional sites */}
      {sites.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sites.map((site, i) => (
            <SiteCard key={i} site={site} onEdit={() => setEditing({ ...site, index: i })} onDelete={() => deleteSite(i)} />
          ))}
        </div>
      )}

      {editing && (
        <SiteEditor site={editing} saving={saving} onSave={saveSite} onClose={() => setEditing(null)} useMyLocation={useMyLocation} />
      )}
    </div>
  );
}

function SiteCard({ site, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm truncate">{site.name || 'Unnamed Site'}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${siteStatusBadge[site.status] || siteStatusBadge.planning}`}>
              {siteStatusLabels[site.status] || 'Planning'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{site.location || 'No address'}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
        {site.start_date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(site.start_date + 'T00:00:00'), 'dd MMM')}
            {site.end_date && ` → ${format(new Date(site.end_date + 'T00:00:00'), 'dd MMM')}`}
          </span>
        )}
        {site.lat != null && site.lng != null && (
            <span className="tabular-nums">{Number(site.lat).toFixed(6)}, {Number(site.lng).toFixed(6)}</span>
        )}
        {site.what3words && (
          <span className="inline-flex items-center gap-1 text-primary bg-primary/8 rounded-full px-2 py-0.5 font-mono font-semibold text-[10px]">
            <MapPin className="w-2.5 h-2.5" /> {site.what3words}
          </span>
        )}
        </div>
        {site.notes && <p className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">{site.notes}</p>}
    </div>
  );
}

function SiteEditor({ site, saving, onSave, onClose, useMyLocation }) {
  const [form, setForm] = useState({
    name: site.name || '',
    location: site.location || '',
    lat: site.lat != null ? String(site.lat) : '',
    lng: site.lng != null ? String(site.lng) : '',
    what3words: site.what3words || '',
    status: site.status || 'planning',
    start_date: site.start_date || '',
    end_date: site.end_date || '',
    notes: site.notes || '',
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = () => {
    const clean = { ...form };
    if (clean.lat) clean.lat = parseFloat(clean.lat); else delete clean.lat;
    if (clean.lng) clean.lng = parseFloat(clean.lng); else delete clean.lng;
    if (!clean.start_date) delete clean.start_date;
    if (!clean.end_date) delete clean.end_date;
    if (!clean.notes) delete clean.notes;
    onSave(clean);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl shadow-2xl max-h-[95vh] overflow-y-auto rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">{site.index != null ? 'Edit Site' : 'Add Site'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Site Name <span className="text-red-500">*</span></label>
            <input autoFocus type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Site A, North Field" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Location / Address</label>
            <input type="text" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Site address" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Latitude</label>
              <input type="number" step="0.000001" value={form.lat} onChange={e => set('lat', e.target.value)} placeholder="51.5074" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Longitude</label>
              <input type="number" step="0.000001" value={form.lng} onChange={e => set('lng', e.target.value)} placeholder="-0.1278" className={inputCls} />
            </div>
          </div>
          <button onClick={useMyLocation} type="button" className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition border border-blue-100">
            <Navigation className="w-3.5 h-3.5" /> Use My Current Location
          </button>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">what3words Address</label>
            <input type="text" value={form.what3words} onChange={e => set('what3words', e.target.value)} placeholder="e.g. filled.count.soap" className={inputCls + ' font-mono'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows="2" placeholder="Access arrangements, hazards, special requirements..." className={inputCls} />
          </div>
        </div>
        <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-white">
          <button onClick={onClose} className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name?.trim()} className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50">
            {saving ? 'Saving...' : site.index != null ? 'Update Site' : 'Add Site'}
          </button>
        </div>
      </div>
    </div>
  );
}