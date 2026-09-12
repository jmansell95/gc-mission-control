import React from 'react';
import {
  Building2, Layers, Plug, Check, Palette, Sparkles,
} from 'lucide-react';
import {
  DIVISION_TYPE_LABELS, ALL_HUBS, HUB_LABELS, HUB_DESCRIPTIONS, HUB_TABS, INTEGRATIONS, COLOR_SWATCHES,
} from './divisionWizardData';
import TemplatePicker from './TemplatePicker';
import BlankSlateBanner from './BlankSlateBanner';

const labelCls = 'text-xs font-bold text-slate-500 uppercase tracking-wide';
const requiredMark = <span className="text-rose-500"> *</span>;

function inputClass(hasError) {
  return 'mt-1 w-full px-3 py-2.5 rounded-xl border outline-none text-sm font-medium transition ' +
    (hasError
      ? 'border-rose-300 ring-1 ring-rose-200 focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
      : 'border-slate-200 focus:border-primary focus:ring-2 focus:ring-primary/10');
}

/* ───────────────────────── Step 1: Identity ───────────────────────── */
export function StepIdentity({ form, setForm, divisions, divisionsLoading, applyTemplate, selectedTemplateId }) {
  return (
    <div className="space-y-4">
      <BlankSlateBanner stepLabel="Identity" />
      <div>
        <label className={labelCls}>Business Stream Name{requiredMark}</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Geotechnical SI"
          className={inputClass(!form.name.trim())} autoFocus />
        {!form.name.trim() && <p className="text-[11px] text-rose-500 mt-1 font-semibold">Business Stream name is required</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Short Code{requiredMark}</label>
          <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="GEO" maxLength={6}
            className={inputClass(!form.code.trim()) + ' uppercase font-mono'} />
          {!form.code.trim() && <p className="text-[11px] text-rose-500 mt-1 font-semibold">Code is required</p>}
        </div>
        <div>
          <label className={labelCls}>Tagline</label>
          <input value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} placeholder="Ground Investigation Specialists"
            className={inputClass(false)} />
        </div>
      </div>

      <div>
        <label className={labelCls + ' mb-1.5 block'}>Copy from an Existing Business Stream</label>
        <p className="text-[11px] text-slate-400 mb-2">Pick a business stream to copy its hubs, navigation, integrations and settings. You can tweak everything afterwards.</p>
        <TemplatePicker divisions={divisions} selectedId={selectedTemplateId} onSelect={applyTemplate} isLoading={divisionsLoading} />
      </div>

      <div>
        <label className={labelCls + ' flex items-center gap-1.5 mb-1.5'}><Palette className="w-3.5 h-3.5" /> Brand Colour</label>
        <div className="flex items-center gap-2 flex-wrap">
          {COLOR_SWATCHES.map(c => (
            <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
              className={'w-9 h-9 rounded-xl transition ' + (form.color === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'hover:scale-105')}
              style={{ background: c }} />
          ))}
          <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
            className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer" />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Step 2: Hubs & Tabs ───────────────────────── */
export function StepHubs({ form, setForm }) {
  const toggleHub = (h) => setForm(f => {
    const hubs = f.enabled_hubs.includes(h) ? f.enabled_hubs.filter(x => x !== h) : [...f.enabled_hubs, h];
    const tabs = { ...(f.enabled_tabs || {}) };
    if (!hubs.includes(h)) {
      delete tabs[h];
    } else {
      tabs[h] = HUB_TABS[h]?.map(t => t.id) || [];
    }
    return { ...f, enabled_hubs: hubs, enabled_tabs: tabs };
  });

  const toggleTab = (hub, tabId) => setForm(f => {
    const hubTabs = f.enabled_tabs?.[hub] || [];
    const newTabs = hubTabs.includes(tabId) ? hubTabs.filter(t => t !== tabId) : [...hubTabs, tabId];
    return { ...f, enabled_tabs: { ...(f.enabled_tabs || {}), [hub]: newTabs } };
  });

  const toggleAllTabs = (hub, selectAll) => setForm(f => ({
    ...f,
    enabled_tabs: { ...(f.enabled_tabs || {}), [hub]: selectAll ? (HUB_TABS[hub]?.map(t => t.id) || []) : [] },
  }));

  return (
    <div className="space-y-3">
      <BlankSlateBanner stepLabel="Hubs & Tabs" />
      <label className={labelCls + ' flex items-center gap-1.5'}><Layers className="w-3.5 h-3.5" /> Choose Hubs & Tabs</label>
      <p className="text-[11px] text-slate-400">Enable hubs, then choose which tabs within each hub you need. Disabled tabs are hidden from your team's workspace.</p>
      <div className="space-y-2 max-h-[calc(100dvh-22rem)] overflow-y-auto pr-1">
        {ALL_HUBS.map(h => {
          const enabled = form.enabled_hubs.includes(h);
          const tabs = HUB_TABS[h] || [];
          const hubTabs = form.enabled_tabs?.[h] || [];
          return (
            <div key={h} className={'rounded-xl border-2 transition ' + (enabled ? 'border-primary bg-emerald-50/30' : 'border-slate-200')}>
              <button type="button" onClick={() => toggleHub(h)} className="w-full flex items-center justify-between p-3 text-left">
                <div className="flex items-center gap-2.5">
                  <span className={'w-5 h-5 rounded-md flex items-center justify-center transition flex-shrink-0 ' + (enabled ? 'bg-primary' : 'bg-slate-200')}>
                    {enabled && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <div>
                    <span className="text-sm font-bold text-slate-800">{HUB_LABELS[h] || h}</span>
                    <p className="text-[10px] text-slate-400 leading-tight">{HUB_DESCRIPTIONS[h] || h}</p>
                  </div>
                </div>
                {enabled && tabs.length > 0 && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0">{hubTabs.length}/{tabs.length} tabs</span>
                )}
              </button>
              {enabled && tabs.length > 0 && (
                <div className="px-3 pb-3 pt-1 border-t border-emerald-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tabs in this hub</span>
                    <button type="button" onClick={() => toggleAllTabs(h, hubTabs.length < tabs.length)}
                      className="text-[10px] font-semibold text-primary hover:underline">
                      {hubTabs.length < tabs.length ? 'Select all' : 'Deselect all'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tabs.map(t => {
                      const tabOn = hubTabs.includes(t.id);
                      return (
                        <button key={t.id} type="button" onClick={() => toggleTab(h, t.id)}
                          className={'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ' +
                            (tabOn ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50')}>
                          {tabOn && <Check className="w-3 h-3" />}
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className={'text-[11px] pt-1 ' + ((form.enabled_hubs || []).length === 0 ? 'text-rose-500 font-semibold' : 'text-slate-500')}>
        {(form.enabled_hubs || []).length} of {ALL_HUBS.length} hubs selected
        {(form.enabled_hubs || []).length === 0 && ' — select at least one hub to continue'}
      </p>
    </div>
  );
}

/* ───────────────────────── Step 3: Integrations (info-only) ───────────────────────── */
export function StepIntegrations({ form, setForm }) {
  return (
    <div className="space-y-3">
      <BlankSlateBanner stepLabel="Connect" />
      <label className={labelCls + ' flex items-center gap-1.5'}><Plug className="w-3.5 h-3.5" /> Integrations</label>
      <div className="hub-glass rounded-2xl p-5 text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl command-gradient flex items-center justify-center shadow-md mx-auto">
          <Plug className="w-7 h-7 text-white" />
        </div>
        <div>
          <p className="text-sm font-extrabold text-slate-900">Managed Centrally</p>
          <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
            All integrations (Geotab, SafetyCulture, Asset Panda, OpenGround, KeyLogBook, and more) are configured
            once at the enterprise level and apply to every business stream automatically.
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-emerald-700">
            After launching this business stream, go to Enterprise Settings → Integrations to connect your services.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Step 4: Review ───────────────────────── */
export function StepReview({ form }) {
  const typeLabel = DIVISION_TYPE_LABELS[form.division_type] || form.division_type;
  return (
    <div className="space-y-3">
      <BlankSlateBanner stepLabel="Launch" />
      <label className={labelCls + ' flex items-center gap-1.5'}><Sparkles className="w-3.5 h-3.5" /> Ready to Launch</label>
      <p className="text-[11px] text-slate-400">Review your workspace configuration below.</p>
      <div className="hub-glass rounded-2xl p-4 space-y-3">
        <ReviewRow icon={Building2} label="Name" value={form.name || '—'} />
        <ReviewRow label="Type" value={typeLabel} />
        <ReviewRow label="Code" value={form.code || '—'} />
        <ReviewRow label="Brand Colour">
          <span className="inline-flex items-center gap-1.5"><span className="w-4 h-4 rounded" style={{ background: form.color }} /> {form.color}</span>
        </ReviewRow>
        <ReviewRow label="Hubs" value={(form.enabled_hubs || []).length + ' enabled'} />
        <ReviewRow label="Integrations" value="Managed centrally" />
      </div>
    </div>
  );
}

function ReviewRow({ icon: Icon, label, value, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">{Icon && <Icon className="w-3.5 h-3.5" />}{label}</span>
      <span className="text-sm font-semibold text-slate-800 text-right truncate">{children || value}</span>
    </div>
  );
}