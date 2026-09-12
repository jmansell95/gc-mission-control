import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Mail, Plus, Trash2, Edit2, Save, X, Loader2, Clock, Eye, Code2,
  FileText, Tag, CheckCircle2, Search, Table, Type, Pill, Link2,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import BuilderPreviewFrame from '@/components/builder/BuilderPreviewFrame';

const CATEGORY_META = {
  portal_invite: { label: 'Portal Invitations', cls: 'bg-emerald-50 text-emerald-700' },
  schedule: { label: 'Schedule', cls: 'bg-blue-50 text-blue-700' },
  billing: { label: 'Billing', cls: 'bg-amber-50 text-amber-700' },
  compliance: { label: 'Compliance', cls: 'bg-rose-50 text-rose-700' },
  onboarding: { label: 'Onboarding', cls: 'bg-violet-50 text-violet-700' },
  notification: { label: 'Notifications', cls: 'bg-cyan-50 text-cyan-700' },
  general: { label: 'General', cls: 'bg-slate-50 text-slate-700' },
};

const emptyForm = {
  template_key: '', template_name: '', category: 'general',
  subject: '', body_html: '', available_variables: [], is_active: true,
};

// Frontend preview wrapper — mirrors the backend brandedWrapper for live preview
function previewWrapper(contentHtml, bannerTitle) {
  const P = '#2E5A1A', A = '#8DC63F', S50 = '#f8fafc', S100 = '#f1f5f9', S200 = '#e2e8f0', S500 = '#64748b', S400 = '#94a3b8';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background:${S100};font-family:Arial,Helvetica,sans-serif">` +
    `<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid ${S200};box-shadow:0 8px 32px rgba(15,42,31,0.10)">` +
    `<tr><td style="padding:20px 32px;background:${P};text-align:center"><h1 style="margin:0;color:#fff;font-size:20px;font-weight:800">${bannerTitle || 'GC Mission Control'}</h1></td></tr>` +
    `<tr><td style="padding:0;background:${A};height:4px;line-height:4px;font-size:4px">&nbsp;</td></tr>` +
    `<tr><td style="padding:28px 32px;color:#0f172a;font-size:14px;line-height:1.65">${contentHtml || '<p style="color:#94a3b8">Start typing to see your email preview…</p>'}</td></tr>` +
    `<tr><td style="padding:20px 32px;background:${S50};border-top:1px solid ${S200};text-align:center"><p style="margin:0 0 4px 0;color:${S500};font-size:12px;font-weight:600">GC Mission Control</p><p style="margin:0;color:${S400};font-size:11px">This is an automated message from GC Mission Control. Please do not reply directly.</p></td></tr>` +
    `</table></body></html>`;
}

export default function EmailTemplateBuilder() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [varInput, setVarInput] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [view, setView] = useState('editor'); // 'editor' | 'code'
  const queryClient = useQueryClient();
  const bodyRef = useRef(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => base44.entities.EmailTemplate.list('-created_date', 200),
  });

  const selected = templates.find(t => t.id === selectedId);
  const isEditingSelected = selected && editingId === selected.id;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return templates.filter(t => {
      if (catFilter !== 'all' && t.category !== catFilter) return false;
      if (q && !(t.template_name?.toLowerCase().includes(q) || t.template_key?.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [templates, search, catFilter]);

  const previewHtml = useMemo(() => {
    if (isEditingSelected) return previewWrapper(formData.body_html, formData.template_name);
    if (selected) return previewWrapper(selected.body_html, selected.template_name);
    return '';
  }, [selected, isEditingSelected, formData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData, available_variables: formData.available_variables || [] };
    if (editingId) {
      await base44.entities.EmailTemplate.update(editingId, payload);
    } else {
      const created = await base44.entities.EmailTemplate.create(payload);
      setSelectedId(created.id);
    }
    queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (t) => {
    setFormData({
      template_key: t.template_key || '', template_name: t.template_name || '',
      category: t.category || 'general', subject: t.subject || '',
      body_html: t.body_html || '', available_variables: t.available_variables || [],
      is_active: t.is_active !== false,
    });
    setEditingId(t.id);
    setSelectedId(t.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this email template? This cannot be undone.')) {
      await base44.entities.EmailTemplate.delete(id);
      if (selectedId === id) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    }
  };

  const addVariable = () => {
    const v = varInput.trim().replace(/[^a-z0-9_]/gi, '');
    if (v && !formData.available_variables.includes(v)) {
      setFormData(f => ({ ...f, available_variables: [...(f.available_variables || []), v] }));
      setVarInput('');
    }
  };

  // Insert helper snippet at cursor in body textarea
  const insertSnippet = (snippet) => {
    const ta = bodyRef.current;
    if (!ta) {
      setFormData(f => ({ ...f, body_html: (f.body_html || '') + snippet }));
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = (formData.body_html || '').slice(0, start) + snippet + (formData.body_html || '').slice(end);
    setFormData(f => ({ ...f, body_html: next }));
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + snippet.length; }, 0);
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Email Template Builder"
        description="Modern branded email templates — every email uses the same GC Mission Control design kit. Edit content with a live preview, insert tables, pills and buttons, and manage {{variable}} tokens."
        icon={Mail}
        actions={
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(emptyForm); setSelectedId(null); }}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
            style={{ background: '#2E5A1A' }}>
            <Plus className="w-4 h-4" /> New Template
          </button>
        }
      />

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── Template list ── */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..."
              className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setCatFilter('all')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${catFilter === 'all' ? 'bg-primary text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>All</button>
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <button key={k} onClick={() => setCatFilter(k)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${catFilter === k ? 'bg-primary text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>{v.label}</button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" /></div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filtered.map(t => {
                const cat = CATEGORY_META[t.category] || CATEGORY_META.general;
                const isSel = selectedId === t.id && !showForm;
                return (
                  <button key={t.id} onClick={() => { setSelectedId(t.id); setShowForm(false); setEditingId(null); }}
                    className={`w-full text-left p-3 rounded-xl border transition ${isSel ? 'border-primary bg-emerald-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <p className="text-sm font-semibold text-slate-800 truncate flex-1">{t.template_name}</p>
                      {!t.is_active && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold">Off</span>}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{t.template_key}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${cat.cls}`}>{cat.label}</span>
                      {t.last_sent_at && (
                        <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{format(new Date(t.last_sent_at), 'dd MMM')}</span>
                      )}
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="text-center text-xs text-slate-400 py-6">No templates found.</p>}
            </div>
          )}
        </div>

        {/* ── Editor + Preview ── */}
        <div className="flex-1 min-w-0">
          {showForm ? (
            /* Create / Edit form with live preview */
            <div className="flex flex-col xl:flex-row gap-4">
              <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">{editingId ? 'Edit Template' : 'New Email Template'}</h3>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setView('editor')} className={`p-1.5 rounded-lg transition ${view === 'editor' ? 'bg-slate-100 text-slate-700' : 'text-slate-400'}`} title="Editor"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setView('code')} className={`p-1.5 rounded-lg transition ${view === 'code' ? 'bg-slate-100 text-slate-700' : 'text-slate-400'}`} title="HTML code"><Code2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Template Key</label>
                      <input type="text" value={formData.template_key} onChange={e => setFormData(f => ({ ...f, template_key: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() }))} required disabled={!!editingId}
                        placeholder="portal_invite_client" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:border-primary disabled:bg-slate-50" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Template Name</label>
                      <input type="text" value={formData.template_name} onChange={e => setFormData(f => ({ ...f, template_name: e.target.value }))} required
                        placeholder="Client Portal Invitation" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                      <select value={formData.category} onChange={e => setFormData(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary bg-white">
                        {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Subject Line</label>
                      <input type="text" value={formData.subject} onChange={e => setFormData(f => ({ ...f, subject: e.target.value }))} required
                        placeholder="Your project portal for {{job_name}} is ready" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
                    </div>
                  </div>

                  {/* Insert toolbar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-700">Email Body (HTML)</label>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => insertSnippet('<h2>Section Heading</h2>')} className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold hover:bg-slate-200"><Type className="w-3 h-3" /> Heading</button>
                        <button type="button" onClick={() => insertSnippet('<table style="width:100%;border-collapse:collapse"><thead><tr><th style="padding:10px;background:#2E5A1A;color:#fff;text-align:left">Col 1</th><th style="padding:10px;background:#2E5A1A;color:#fff;text-align:left">Col 2</th></tr></thead><tbody><tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Row 1</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">Value</td></tr></tbody></table>')} className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold hover:bg-slate-200"><Table className="w-3 h-3" /> Table</button>
                        <button type="button" onClick={() => insertSnippet('<span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;background:#ecfdf5;color:#059669">Active</span>')} className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold hover:bg-slate-200"><Pill className="w-3 h-3" /> Pill</button>
                        <button type="button" onClick={() => insertSnippet('<a href="{{cta_url}}" style="display:inline-block;background:#2E5A1A;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700">Click Here</a>')} className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold hover:bg-slate-200"><Link2 className="w-3 h-3" /> Button</button>
                      </div>
                    </div>
                    <textarea ref={bodyRef} value={formData.body_html} onChange={e => setFormData(f => ({ ...f, body_html: e.target.value }))} required rows={10}
                      placeholder="<p>Write your email content here...</p>"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:border-primary" />
                  </div>

                  {/* Variables */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Available Variables</label>
                    <div className="flex gap-2 mb-2">
                      <input type="text" value={varInput} onChange={e => setVarInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVariable(); } }}
                        placeholder="e.g. job_name" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:border-primary" />
                      <button type="button" onClick={addVariable} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"><Plus className="w-4 h-4" /></button>
                    </div>
                    {formData.available_variables.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {formData.available_variables.map(v => (
                          <span key={v} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-mono">
                            {`{{${v}}}`}<button type="button" onClick={() => setFormData(f => ({ ...f, available_variables: f.available_variables.filter(x => x !== v) }))} className="text-slate-400 hover:text-rose-600"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={formData.is_active} onChange={e => setFormData(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
                    Active (available for dispatch)
                  </label>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setFormData(emptyForm); }} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg text-sm font-medium hover:bg-slate-200">Cancel</button>
                    <button type="submit" className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90" style={{ background: '#2E5A1A' }}>
                      <Save className="w-4 h-4" /> {editingId ? 'Save Changes' : 'Create Template'}
                    </button>
                  </div>
                </form>
              </div>
              {/* Live preview */}
              <div className="flex-1 min-w-0 flex flex-col">
                <BuilderPreviewFrame html={previewHtml} label="Live Preview" emptyHint="Start typing to see your email…" />
              </div>
            </div>
          ) : selected ? (
            /* Read-only detail with preview */
            <div className="flex flex-col xl:flex-row gap-4">
              <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selected.template_name}</h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{selected.template_key}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(selected)} className="p-2 text-slate-400 hover:text-primary hover:bg-emerald-50 rounded-lg transition" title="Edit"><Edit2 className="w-4 h-4" /></button>
                    {!selected.is_system && <button onClick={() => handleDelete(selected.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${(CATEGORY_META[selected.category] || CATEGORY_META.general).cls}`}>{(CATEGORY_META[selected.category] || CATEGORY_META.general).label}</span>
                  {selected.is_system && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">System</span>}
                  {selected.is_active ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">Active</span> : <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-bold">Inactive</span>}
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-slate-500 mb-1">Subject</p>
                  <p className="text-sm text-slate-800">{selected.subject}</p>
                </div>
                {selected.available_variables?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Variables</p>
                    <div className="flex flex-wrap gap-1">
                      {selected.available_variables.map(v => <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">{`{{${v}}}`}</span>)}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                  {selected.last_sent_at ? <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Last sent {format(new Date(selected.last_sent_at), 'dd MMM yyyy HH:mm')}{selected.last_sent_to && ` to ${selected.last_sent_to}`}</span> : <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Never sent</span>}
                  {selected.send_count > 0 && <span>· {selected.send_count} total sends</span>}
                </div>
                <button onClick={() => handleEdit(selected)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition">
                  <Edit2 className="w-4 h-4" /> Edit this template
                </button>
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <BuilderPreviewFrame html={previewHtml} label="Email Preview" emptyHint="Select a template to preview" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
              <Mail className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Select a template to preview</p>
              <p className="text-xs text-slate-400 mt-1">or create a new one to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}