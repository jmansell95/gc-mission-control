import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Building2, X, Check, Loader2, Layers, Settings as SettingsIcon, Navigation,
  Palette, ChevronUp, ChevronDown, GripVertical,
} from 'lucide-react';
import { NAV_ITEM_REGISTRY, ALL_NAV_ITEM_IDS, DIVISION_TYPE_NAV_DEFAULTS } from '@/utils/divisionNav';
import { DIVISION_TYPES, ALL_HUBS, HUB_LABELS } from '@/components/wizard/divisionWizardData';

const LANDING_OPTIONS = [
  { value: '', label: 'Auto (by role)', },
  { value: '/admin', label: 'Admin Dashboard' },
  { value: '/staff-schedule', label: 'Staff Schedule' },
  { value: '/enterprise', label: 'Enterprise Dashboard' },
];

/** Capitalise each word — "geotechnical ltd" → "Geotechnical Ltd" */
function toProperCase(str) {
  return str.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
}

const SUB_TABS = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'navigation', label: 'Navigation', icon: Navigation },
  { id: 'hubs', label: 'Hubs', icon: Layers },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function DivisionEditor({ division, onClose, onSaved }) {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState('general');
  const [form, setForm] = useState(() => ({
    name: division?.name || '',
    code: division?.code || '',
    division_type: division?.division_type || 'general',
    description: division?.description || '',
    tagline: division?.tagline || '',
    color: division?.color || '#475569',
    logo_url: division?.logo_url || '',
    is_active: division?.is_active !== false,
    status: division?.status || 'setup',
    sort_order: division?.sort_order || 0,
    enabled_hubs: division?.enabled_hubs || [...ALL_HUBS],
    nav_items: division?.nav_items || [],
    landing_page: division?.landing_page || '',
    settings: division?.settings || {
      vat_rate: 20,
      default_markup_percentage: 0,
      require_briefing_signature: true,
      allow_timesheet_edit: true,
    },
  }));
  const [saving, setSaving] = useState(false);

  const setHubsFromType = (type) => {
    const preset = DIVISION_TYPES.find(t => t.value === type);
    const defaultHubs = type === 'geotechnical'
      ? ALL_HUBS
      : ALL_HUBS.filter(h => h !== 'investigation');
    setForm(f => ({
      ...f,
      division_type: type,
      color: preset?.color || f.color,
      enabled_hubs: division ? f.enabled_hubs : defaultHubs,
      nav_items: division ? f.nav_items : (DIVISION_TYPE_NAV_DEFAULTS[type] || DIVISION_TYPE_NAV_DEFAULTS.general),
    }));
  };

  const toggleHub = (h) => {
    setForm(f => {
      const hubs = f.enabled_hubs.includes(h) ? f.enabled_hubs.filter(x => x !== h) : [...f.enabled_hubs, h];
      return { ...f, enabled_hubs: hubs };
    });
  };

  const toggleNavItem = (id) => {
    setForm(f => {
      const items = f.nav_items.includes(id) ? f.nav_items.filter(x => x !== id) : [...f.nav_items, id];
      return { ...f, nav_items: items };
    });
  };

  const moveNavItem = (index, dir) => {
    setForm(f => {
      const items = [...f.nav_items];
      const target = index + dir;
      if (target < 0 || target >= items.length) return f;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...f, nav_items: items };
    });
  };

  const updateSetting = (key, value) => {
    setForm(f => ({ ...f, settings: { ...f.settings, [key]: value } }));
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: 'Name and code are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: toProperCase(form.name.trim()),
        code: form.code.toUpperCase().trim(),
        nav_items: form.nav_items.length > 0 ? form.nav_items : [],
      };
      if (division) {
        await base44.entities.Division.update(division.id, payload);
        toast({ title: 'Business Stream updated' });
      } else {
        await base44.entities.Division.create(payload);
        toast({ title: 'Business Stream created' });
      }
      onSaved();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 outline-none text-sm';
  const labelCls = 'text-xs font-bold text-slate-500 uppercase tracking-wide';

  return createPortal(
    <div className="fixed inset-0 z-50 bg-blue-950/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, ' + form.color + ', ' + form.color + 'cc)' }}>
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900">{division ? 'Edit Business Stream' : 'New Business Stream'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {/* Sub-tabs */}
        <div className="sticky top-[57px] bg-white border-b border-slate-100 px-3 py-2 flex gap-1 z-10 overflow-x-auto no-scrollbar">
          {SUB_TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} type="button" onClick={() => setSubTab(t.id)}
                className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ' + (subTab === t.id ? 'command-gradient text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50')}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="p-5 space-y-4">
          {/* ═══ General ═══ */}
          {subTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Name</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Geotechnical"
                    className={inputCls} />
                  <p className="text-[10px] text-slate-400 mt-1">Auto-formatted to proper case</p>
                </div>
                <div>
                  <label className={labelCls}>Code</label>
                  <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="GEO" maxLength={6}
                    className={inputCls + ' uppercase'} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Business Stream Type</label>
                <p className="text-[11px] text-slate-400 mt-0.5">Determines default hubs and navigation.</p>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {DIVISION_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => setHubsFromType(t.value)}
                      className={'flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition ' + (form.division_type === t.value ? 'border-[#2E5A1A] bg-emerald-50 text-[#2E5A1A]' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} /> {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Tagline</label>
                <input value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} placeholder="Ground Investigation Specialists"
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls + ' flex items-center gap-1.5'}><Palette className="w-3.5 h-3.5" /> Brand Colour</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer" />
                    <input value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={inputCls}>
                    <option value="setup">Setup</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Sort Order</label>
                <input type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} className={inputCls} />
                <p className="text-[10px] text-slate-400 mt-1">Lower = appears first in the dashboard and switcher</p>
              </div>
              <div>
                <label className={labelCls}>Logo URL (optional)</label>
                <input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..."
                  className={inputCls} />
              </div>
            </div>
          )}

          {/* ═══ Navigation ═══ */}
          {subTab === 'navigation' && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Landing Page</label>
                <p className="text-[11px] text-slate-400 mt-0.5">Where users land when they enter this division.</p>
                <select value={form.landing_page} onChange={e => setForm({ ...form, landing_page: e.target.value })} className={inputCls}>
                  {LANDING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls + ' flex items-center gap-1.5'}><Navigation className="w-3.5 h-3.5" /> Mobile Bottom Nav Items</label>
                <p className="text-[11px] text-slate-400 mt-0.5">Tap to add/remove. Use arrows to reorder. Leave empty to use the division type default.</p>

                {/* Active items (ordered, reorderable) */}
                {form.nav_items.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {form.nav_items.map((id, index) => {
                      const item = NAV_ITEM_REGISTRY[id];
                      if (!item) return null;
                      return (
                        <div key={id} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                          <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                          <span className="flex-1 text-sm font-semibold text-slate-700">{item.label}</span>
                          <button type="button" onClick={() => moveNavItem(index, -1)} disabled={index === 0} className="p-1 rounded hover:bg-white disabled:opacity-30 transition">
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          </button>
                          <button type="button" onClick={() => moveNavItem(index, 1)} disabled={index === form.nav_items.length - 1} className="p-1 rounded hover:bg-white disabled:opacity-30 transition">
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          </button>
                          <button type="button" onClick={() => toggleNavItem(id)} className="p-1 rounded hover:bg-white transition">
                            <X className="w-4 h-4 text-rose-500" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Available items (not yet added) */}
                {ALL_NAV_ITEM_IDS.filter(id => !form.nav_items.includes(id)).length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Available Items</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_NAV_ITEM_IDS.filter(id => !form.nav_items.includes(id)).map(id => {
                        const item = NAV_ITEM_REGISTRY[id];
                        return (
                          <button key={id} type="button" onClick={() => toggleNavItem(id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
                            + {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Reset to type default */}
                <button type="button" onClick={() => setForm(f => ({ ...f, nav_items: [...(DIVISION_TYPE_NAV_DEFAULTS[f.division_type] || DIVISION_TYPE_NAV_DEFAULTS.general)] }))}
                  className="mt-3 text-xs font-semibold text-[#2E5A1A] hover:underline">
                  Reset to {DIVISION_TYPES.find(t => t.value === form.division_type)?.label || 'General'} default
                </button>
              </div>
            </div>
          )}

          {/* ═══ Hubs ═══ */}
          {subTab === 'hubs' && (
            <div className="space-y-3">
              <label className={labelCls + ' flex items-center gap-1.5'}><Layers className="w-3.5 h-3.5" /> Enabled Hubs</label>
              <p className="text-[11px] text-slate-400 mt-0.5">Which hubs show in this division's sidebar. Geotechnical includes Investigation; others typically don't.</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {ALL_HUBS.map(h => (
                  <button key={h} type="button" onClick={() => toggleHub(h)}
                    className={'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ' + (form.enabled_hubs.includes(h) ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}>
                    <span className={'w-4 h-4 rounded flex items-center justify-center ' + (form.enabled_hubs.includes(h) ? 'bg-white/20' : 'bg-slate-200')}>
                      {form.enabled_hubs.includes(h) && <Check className="w-3 h-3" />}
                    </span>
                    {HUB_LABELS[h] || h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ═══ Settings ═══ */}
          {subTab === 'settings' && (
            <div className="space-y-4">
              <label className={labelCls + ' flex items-center gap-1.5'}><SettingsIcon className="w-3.5 h-3.5" /> Business Stream-Specific Settings</label>
              <p className="text-[11px] text-slate-400 mt-0.5">These override platform defaults for this stream's users only.</p>

              {/* Financial */}
              <div className="hub-glass rounded-xl p-3 space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Financial</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">VAT Rate (%)</label>
                    <input type="number" value={form.settings.vat_rate} onChange={e => updateSetting('vat_rate', Number(e.target.value))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500">Default Markup (%)</label>
                    <input type="number" value={form.settings.default_markup_percentage} onChange={e => updateSetting('default_markup_percentage', Number(e.target.value))}
                      className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Field Operations */}
              <div className="hub-glass rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Field Operations</p>
                <SettingToggle
                  label="Require Briefing Signature"
                  desc="Staff must sign the job briefing before starting work"
                  value={form.settings.require_briefing_signature}
                  onChange={v => updateSetting('require_briefing_signature', v)}
                />
                <SettingToggle
                  label="Allow Timesheet Edit"
                  desc="Field staff can edit their own timesheets"
                  value={form.settings.allow_timesheet_edit}
                  onChange={v => updateSetting('allow_timesheet_edit', v)}
                />
              </div>

              {/* Integrations are managed centrally from Enterprise Settings → Integrations.
                  Division-level toggles have been removed to ensure a single source of truth. */}
              <div className="hub-glass rounded-xl p-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Integrations</p>
                <p className="text-[11px] text-slate-400">
                  All integrations (Geotab, SafetyCulture, Asset Panda, OpenGround, KeyLogBook, etc.) are now managed
                  centrally from <span className="font-semibold text-[#2E5A1A]">Enterprise Settings → Integrations</span>.
                  This ensures every division uses the same configuration.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg command-gradient text-white text-sm font-bold shadow-md disabled:opacity-60 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {division ? 'Save Changes' : 'Create Business Stream'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SettingToggle({ label, desc, value, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-400">{desc}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={'relative w-11 h-6 rounded-full transition flex-shrink-0 ' + (value ? 'bg-[#2E5A1A]' : 'bg-slate-300')}
      >
        <span className={'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition ' + (value ? 'translate-x-5' : '')} />
      </button>
    </label>
  );
}