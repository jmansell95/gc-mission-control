import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Save, Upload, Eye, Building2, HardHat, Phone, Mail, Palette, Type, Power,
  GripVertical, Plus, Trash2, ChevronUp, ChevronDown, ToggleLeft, ToggleRight,
  MapPin, ClipboardList, FileQuestion, LayoutGrid, Settings2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const PORTALS = [
  { key: 'client_portal', label: 'Client Portal', icon: Building2, desc: 'Branded job progress portal shared with your clients via a private link.' },
  { key: 'subcontractor_onboarding', label: 'Subcontractor Portal', icon: HardHat, desc: 'Self-service portal for subcontractors — onboarding, site sign-in, daily logs & KeyLogBook.' },
];

const WIDGET_TYPES = {
  progress: { label: 'Project Progress', icon: '📊', color: '#2E5A1A' },
  schedule: { label: 'Schedule', icon: '📅', color: '#2563eb' },
  team: { label: 'Project Team', icon: '👥', color: '#7c3aed' },
  documents: { label: 'Documents', icon: '📄', color: '#b45309' },
  photos: { label: 'Site Photos', icon: '📸', color: '#059669' },
  milestones: { label: 'Milestones', icon: '🎯', color: '#d97706' },
  comments: { label: 'Comments', icon: '💬', color: '#64748b' },
  client_charge: { label: 'Client Charge', icon: '💰', color: '#e11d48' },
  site_signin: { label: 'Site Sign-In', icon: 'MapPin', color: '#2563eb' },
  daily_logs: { label: 'Daily Activity Log', icon: 'ClipboardList', color: '#059669' },
  keylogbook_prompt: { label: 'KeyLogBook Prompt', icon: 'FileQuestion', color: '#7c3aed' },
  company_info: { label: 'Company Information', icon: '🏢', color: '#2E5A1A' },
  insurance: { label: 'Insurance Details', icon: '🛡', color: '#2563eb' },
  cis: { label: 'CIS / Tax Details', icon: '📋', color: '#b45309' },
  contacts: { label: 'Key Contacts', icon: '👤', color: '#7c3aed' },
  references: { label: 'References', icon: '✓', color: '#059669' },
  custom_html: { label: 'Custom HTML', icon: 'LayoutGrid', color: '#64748b' },
};

const CLIENT_WIDGET_OPTIONS = ['progress', 'schedule', 'team', 'documents', 'photos', 'milestones', 'comments', 'client_charge', 'site_signin', 'custom_html'];
const SUBCON_WIDGET_OPTIONS = ['company_info', 'insurance', 'cis', 'contacts', 'references', 'site_signin', 'daily_logs', 'keylogbook_prompt', 'custom_html'];

export default function PortalEditor() {
  const { toast } = useToast();
  const [activePortal, setActivePortal] = useState('client_portal');
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('appearance');

  useEffect(() => {
    setLoading(true);
    setBranding(null);
    (async () => {
      try {
        const res = await base44.functions.invoke('getPortalBranding', { portal_type: activePortal });
        setBranding(res.data.branding);
      } catch (e) {
        toast({ title: 'Load failed', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [activePortal]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('getPortalBranding', { portal_type: activePortal, action: 'save', ...branding });
      toast({ title: 'Saved', description: 'Portal configuration updated.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setBranding(b => ({ ...b, logo_url: res.file_url, logo_name: file.name, show_logo: true }));
    } catch (err) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
  };

  const set = (field, value) => setBranding(b => ({ ...b, [field]: value }));

  const SECTIONS = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'widgets', label: 'Widgets', icon: LayoutGrid },
    { id: 'features', label: 'Site Features', icon: Settings2 },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Portal Editor</h2>
        <p className="text-sm text-slate-500 mt-1">Customise everything on your client and subcontractor portals — appearance, widgets, site sign-in, daily logs & KeyLogBook integration.</p>
      </div>

      {/* Portal selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PORTALS.map(p => {
          const Icon = p.icon;
          const active = activePortal === p.key;
          return (
            <button key={p.key} onClick={() => setActivePortal(p.key)}
              className={`text-left p-4 rounded-xl border-2 transition ${active ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-5 h-5 ${active ? 'text-emerald-700' : 'text-slate-400'}`} />
                <span className={`font-semibold ${active ? 'text-emerald-900' : 'text-slate-700'}`}>{p.label}</span>
              </div>
              <p className="text-xs text-slate-500">{p.desc}</p>
            </button>
          );
        })}
      </div>

      {loading || !branding ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-emerald-600 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_360px] gap-4">
          {/* Section nav */}
          <div className="space-y-1">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const active = activeSection === s.id;
              return (
                <button key={s.id} onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${active ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  <Icon className="w-4 h-4" />
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Editor */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            {activeSection === 'appearance' && (
              <AppearanceSection branding={branding} set={set} handleLogo={handleLogo} activePortal={activePortal} />
            )}
            {activeSection === 'widgets' && (
              <WidgetManager branding={branding} set={set} activePortal={activePortal} />
            )}
            {activeSection === 'features' && (
              <FeatureSettings branding={branding} set={set} activePortal={activePortal} />
            )}

            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-lg font-semibold hover:bg-emerald-800 disabled:opacity-50 transition">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>

          {/* Live preview */}
          <PortalPreview branding={branding} portalType={activePortal} />
        </div>
      )}
    </div>
  );
}

function AppearanceSection({ branding, set, handleLogo, activePortal }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <Palette className="w-4 h-4 text-emerald-600" />
        <h3 className="font-semibold text-slate-800">Appearance & Content</h3>
      </div>

      <ToggleRow icon={Power} label="Portal enabled" desc="Turn off to show a 'temporarily unavailable' message"
        checked={branding.enabled} onChange={v => set('enabled', v)} />

      <Field label="Welcome title" icon={Type}>
        <input type="text" value={branding.welcome_title || ''} onChange={e => set('welcome_title', e.target.value)}
          placeholder={activePortal === 'client_portal' ? '(uses job name)' : 'Subcontractor Onboarding'}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
      </Field>

      <Field label="Welcome subtitle">
        <input type="text" value={branding.welcome_subtitle || ''} onChange={e => set('welcome_subtitle', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
      </Field>

      <Field label="Intro message">
        <textarea value={branding.intro_message || ''} onChange={e => set('intro_message', e.target.value)} rows={3}
          placeholder="Shown beneath the heading — instructions or welcome note for visitors"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
      </Field>

      <Field label="Accent colour">
        <div className="flex items-center gap-2">
          <input type="color" value={branding.accent_color || '#2E5A1A'} onChange={e => set('accent_color', e.target.value)}
            className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer" />
          <input type="text" value={branding.accent_color || ''} onChange={e => set('accent_color', e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
        </div>
      </Field>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Logo</label>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 cursor-pointer transition">
            <Upload className="w-4 h-4" /> Upload
            <input type="file" accept="image/*" onChange={handleLogo} className="hidden" />
          </label>
          {branding.logo_url && <img src={branding.logo_url} alt="logo" className="h-10 max-w-32 object-contain border border-slate-200 rounded" />}
          {branding.logo_name && <span className="text-xs text-slate-500 truncate">{branding.logo_name}</span>}
        </div>
        <ToggleRow icon={Eye} label="Show logo in header" checked={!!branding.show_logo} onChange={v => set('show_logo', v)} compact />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Support phone" icon={Phone}>
          <input type="tel" value={branding.support_phone || ''} onChange={e => set('support_phone', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
        </Field>
        <Field label="Support email" icon={Mail}>
          <input type="email" value={branding.support_email || ''} onChange={e => set('support_email', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
        </Field>
      </div>

      <Field label="Footer text">
        <input type="text" value={branding.footer_text || ''} onChange={e => set('footer_text', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
      </Field>
    </div>
  );
}

function WidgetManager({ branding, set, activePortal }) {
  const widgets = branding.widgets || [];
  const availableTypes = activePortal === 'client_portal' ? CLIENT_WIDGET_OPTIONS : SUBCON_WIDGET_OPTIONS;

  const updateWidget = (id, patch) => {
    set('widgets', widgets.map(w => w.id === id ? { ...w, ...patch } : w));
  };

  const removeWidget = (id) => {
    set('widgets', widgets.filter(w => w.id !== id));
  };

  const moveWidget = (id, dir) => {
    const idx = widgets.findIndex(w => w.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= widgets.length) return;
    const reordered = [...widgets];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    set('widgets', reordered.map((w, i) => ({ ...w, order: i })));
  };

  const addWidget = (type) => {
    const w = {
      id: 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type,
      title: WIDGET_TYPES[type]?.label || 'Widget',
      enabled: true,
      order: widgets.length,
      config: {},
    };
    set('widgets', [...widgets, w]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <LayoutGrid className="w-4 h-4 text-emerald-600" />
        <h3 className="font-semibold text-slate-800">Widget Manager</h3>
      </div>
      <p className="text-sm text-slate-500">Add, remove, reorder and toggle the widgets shown on the portal. Drag is not available — use the arrows to reorder.</p>

      {/* Widget list */}
      <div className="space-y-2">
        {widgets.map((w, i) => {
          const wt = WIDGET_TYPES[w.type] || { label: w.type, icon: '📦', color: '#64748b' };
          return (
            <div key={w.id} className={`flex items-center gap-2 p-3 rounded-xl border ${w.enabled ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'}`}>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveWidget(w.id, -1)} disabled={i === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <GripVertical className="w-3.5 h-3.5 text-slate-300" />
                <button onClick={() => moveWidget(w.id, 1)} disabled={i === widgets.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: wt.color + '15', color: wt.color }}>
                {typeof wt.icon === 'string' ? wt.icon : <wt.icon className="w-4 h-4" />}
              </div>
              <input type="text" value={w.title} onChange={e => updateWidget(w.id, { title: e.target.value })}
                className="flex-1 px-2 py-1 text-sm font-medium border border-transparent rounded hover:border-slate-200 focus:border-emerald-600 focus:outline-none" />
              <button onClick={() => updateWidget(w.id, { enabled: !w.enabled })}
                className={`p-1.5 rounded-lg transition ${w.enabled ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                {w.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => removeWidget(w.id)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add widget */}
      <div className="pt-3 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Add Widget</p>
        <div className="flex flex-wrap gap-2">
          {availableTypes.map(type => {
            const wt = WIDGET_TYPES[type];
            if (!wt) return null;
            return (
              <button key={type} onClick={() => addWidget(type)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition">
                <Plus className="w-3 h-3" />
                {typeof wt.icon === 'string' ? wt.icon : <wt.icon className="w-3 h-3" />}
                {wt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FeatureSettings({ branding, set, activePortal }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <Settings2 className="w-4 h-4 text-emerald-600" />
        <h3 className="font-semibold text-slate-800">Site Features</h3>
      </div>

      {/* Site Sign-In */}
      <div className="p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Site Sign-In</p>
              <p className="text-xs text-slate-500">Let visitors sign in when they arrive on site</p>
            </div>
          </div>
          <ToggleRow icon={null} label="" checked={!!branding.site_signin_enabled} onChange={v => set('site_signin_enabled', v)} compact noLabel />
        </div>
        {branding.site_signin_enabled && (
          <Field label="Sign-in instructions">
            <textarea value={branding.site_signin_instructions || ''} onChange={e => set('site_signin_instructions', e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
          </Field>
        )}
      </div>

      {/* Subcontractor Daily Logs */}
      {activePortal === 'subcontractor_onboarding' && (
        <div className="p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Daily Activity Log</p>
                <p className="text-xs text-slate-500">Let subcontractors log their daily activities</p>
              </div>
            </div>
            <ToggleRow icon={null} label="" checked={!!branding.subcontractor_logs_enabled} onChange={v => set('subcontractor_logs_enabled', v)} compact noLabel />
          </div>
          {branding.subcontractor_logs_enabled && (
            <Field label="Log instructions">
              <textarea value={branding.subcontractor_logs_instructions || ''} onChange={e => set('subcontractor_logs_instructions', e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
            </Field>
          )}
        </div>
      )}

      {/* KeyLogBook Prompt */}
      {activePortal === 'subcontractor_onboarding' && (
        <div className="p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <FileQuestion className="w-4 h-4 text-violet-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">KeyLogBook Prompt</p>
                <p className="text-xs text-slate-500">Ask subcontractors if they use KeyLogBook</p>
              </div>
            </div>
            <ToggleRow icon={null} label="" checked={!!branding.keylogbook_prompt_enabled} onChange={v => set('keylogbook_prompt_enabled', v)} compact noLabel />
          </div>
          {branding.keylogbook_prompt_enabled && (
            <>
              <Field label="Prompt question">
                <input type="text" value={branding.keylogbook_prompt_text || ''} onChange={e => set('keylogbook_prompt_text', e.target.value)}
                  placeholder="Do you use KeyLogBook for your drilling logs?"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </Field>
              <Field label="'Yes' message">
                <textarea value={branding.keylogbook_yes_message || ''} onChange={e => set('keylogbook_yes_message', e.target.value)} rows={2}
                  placeholder="Great — please log all your drilling activity on your tablet inside KeyLogBook."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
              </Field>
              <Field label="'No' message">
                <textarea value={branding.keylogbook_no_message || ''} onChange={e => set('keylogbook_no_message', e.target.value)} rows={2}
                  placeholder="No problem — please use the daily log form below to record your activities."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 resize-none" />
              </Field>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PortalPreview({ branding, portalType }) {
  const accent = branding.accent_color || '#2E5A1A';
  const title = branding.welcome_title || (portalType === 'client_portal' ? 'Job Name' : 'Subcontractor Onboarding');
  const widgets = (branding.widgets || []).filter(w => w.enabled);
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Live Preview</p>
      <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-h-[600px] overflow-y-auto">
        <div className="px-5 py-6 text-white relative" style={{ background: `linear-gradient(135deg, ${accent} 0%, ${shade(accent, -20)} 100%)` }}>
          <div className="flex items-center gap-2 mb-2">
            {branding.show_logo && branding.logo_url
              ? <img src={branding.logo_url} alt="logo" className="h-8 max-w-32 object-contain bg-white/10 rounded p-0.5" />
              : (portalType === 'client_portal' ? <Building2 className="w-5 h-5 text-white/80" /> : <HardHat className="w-5 h-5 text-white/80" />)}
            <span className="text-white/80 text-sm font-medium">{branding.welcome_subtitle || 'Portal'}</span>
          </div>
          <h1 className="text-xl font-bold">{title}</h1>
          {branding.intro_message && <p className="text-white/85 text-sm mt-2 max-w-md">{branding.intro_message}</p>}
        </div>
        <div className="bg-slate-50 p-5 space-y-2">
          {widgets.length === 0 && <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs text-slate-400">No widgets enabled</div>}
          {widgets.map(w => (
            <div key={w.id} className="bg-white rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold text-slate-700 mb-1">{w.title}</p>
              <div className="text-xs text-slate-400">
                {w.type === 'site_signin' && branding.site_signin_enabled ? '📍 Sign-in button + form' : ''}
                {w.type === 'daily_logs' && branding.subcontractor_logs_enabled ? '📋 Daily log form' : ''}
                {w.type === 'keylogbook_prompt' && branding.keylogbook_prompt_enabled ? '❓ KeyLogBook prompt' : ''}
                {!['site_signin', 'daily_logs', 'keylogbook_prompt'].includes(w.type) ? 'Sample content' : ''}
              </div>
            </div>
          ))}
          {(branding.support_phone || branding.support_email) && (
            <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
              {branding.support_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{branding.support_phone}</span>}
              {branding.support_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{branding.support_email}</span>}
            </div>
          )}
          <p className="text-center text-[10px] text-slate-400 pt-2">{branding.footer_text || 'Ground Control'}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}{label}
      </label>
      {children}
    </div>
  );
}

function ToggleRow({ icon: Icon, label, desc, checked, onChange, compact, noLabel }) {
  return (
    <div className={`flex items-center justify-between ${compact ? 'py-1' : 'py-2'}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
        <div>
          {!noLabel && <p className="text-sm font-medium text-slate-700">{label}</p>}
          {desc && <p className="text-xs text-slate-400">{desc}</p>}
        </div>
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition ${checked ? 'bg-emerald-600' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  );
}

function shade(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + Math.round(255 * percent / 100)));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100)));
  const b = Math.max(0, Math.min(255, (num & 0xff) + Math.round(255 * percent / 100)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}