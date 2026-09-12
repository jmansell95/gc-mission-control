import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  Mail, Plus, Trash2, Edit2, Save, X, Loader2, Send, Clock,
  FileText, Tag, CheckCircle2, AlertCircle, Eye,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

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
  template_key: '',
  template_name: '',
  category: 'general',
  subject: '',
  body_html: '',
  available_variables: [],
  is_active: true,
};

export default function EmailTemplateManager() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [varInput, setVarInput] = useState('');
  const [previewId, setPreviewId] = useState(null);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => base44.entities.EmailTemplate.list('-created_date', 200),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      available_variables: formData.available_variables || [],
    };
    if (editingId) {
      await base44.entities.EmailTemplate.update(editingId, payload);
    } else {
      await base44.entities.EmailTemplate.create(payload);
    }
    queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (t) => {
    setFormData({
      template_key: t.template_key || '',
      template_name: t.template_name || '',
      category: t.category || 'general',
      subject: t.subject || '',
      body_html: t.body_html || '',
      available_variables: t.available_variables || [],
      is_active: t.is_active !== false,
    });
    setEditingId(t.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this email template? This cannot be undone.')) {
      await base44.entities.EmailTemplate.delete(id);
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

  const removeVariable = (v) => {
    setFormData(f => ({ ...f, available_variables: (f.available_variables || []).filter(x => x !== v) }));
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <SettingsSectionHeader
        title="Email Templates"
        description="Manage branded email templates for portal invitations, schedules, billing and compliance notifications. Templates support {{variable}} tokens that are replaced at send time."
        icon={Mail}
        actions={
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(emptyForm); }}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
            style={{ background: '#2E5A1A' }}>
            <Plus className="w-4 h-4" /> New Template
          </button>
        }
      />

      {/* Template list */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map(t => {
            const cat = CATEGORY_META[t.category] || CATEGORY_META.general;
            const isPreview = previewId === t.id;
            return (
              <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">{t.template_name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cat.cls}`}>{cat.label}</span>
                      {t.is_system && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">System</span>}
                      {!t.is_active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 font-medium">Inactive</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono">{t.template_key}</p>
                    <p className="text-xs text-slate-600 mt-1.5 truncate"><strong>Subject:</strong> {t.subject}</p>
                    {t.available_variables && t.available_variables.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.available_variables.map(v => (
                          <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">{`{{${v}}}`}</span>
                        ))}
                      </div>
                    )}
                    {/* Last sent audit */}
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-400">
                      {t.last_sent_at ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last sent {format(new Date(t.last_sent_at), 'dd MMM yyyy HH:mm')}
                          {t.last_sent_to && ` to ${t.last_sent_to}`}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Never sent</span>
                      )}
                      {t.send_count > 0 && <span>· {t.send_count} total sends</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setPreviewId(isPreview ? null : t.id)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Preview">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleEdit(t)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-emerald-50 rounded-lg transition" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!t.is_system && (
                      <button onClick={() => handleDelete(t.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {isPreview && (
                  <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                    <p className="text-xs font-semibold text-slate-700 mb-2">Email Preview</p>
                    <div className="bg-white rounded-lg border border-slate-200 p-4 max-h-64 overflow-y-auto">
                      <p className="text-sm font-semibold text-slate-900 mb-2">{t.subject}</p>
                      <div className="text-xs text-slate-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: t.body_html }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {templates.length === 0 && !showForm && (
            <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
              <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">No email templates yet.</p>
              <p className="text-xs text-slate-400 mt-1">Create one to customize your portal invitations and notifications.</p>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{editingId ? 'Edit Template' : 'New Email Template'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); setFormData(emptyForm); }}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Template Key (machine name)</label>
                <input type="text" value={formData.template_key} onChange={e => setFormData(f => ({ ...f, template_key: e.target.value.replace(/[^a-z0-9_]/gi, '_').toLowerCase() }))} required disabled={!!editingId}
                  placeholder="e.g. portal_invite_client"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:border-primary disabled:bg-slate-50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Template Name</label>
                <input type="text" value={formData.template_name} onChange={e => setFormData(f => ({ ...f, template_name: e.target.value }))} required
                  placeholder="e.g. Client Portal Invitation"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select value={formData.category} onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary bg-white">
                {Object.entries(CATEGORY_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Subject Line</label>
              <input type="text" value={formData.subject} onChange={e => setFormData(f => ({ ...f, subject: e.target.value }))} required
                placeholder="e.g. Your project portal for {{job_name}} is ready"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Body (HTML)</label>
              <textarea value={formData.body_html} onChange={e => setFormData(f => ({ ...f, body_html: e.target.value }))} required rows={8}
                placeholder="<div style='font-family:Arial,sans-serif'>...</div>"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Available Variables</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={varInput} onChange={e => setVarInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVariable(); } }}
                  placeholder="e.g. job_name"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:border-primary" />
                <button type="button" onClick={addVariable}
                  className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {formData.available_variables.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {formData.available_variables.map(v => (
                    <span key={v} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-mono">
                      {`{{${v}}}`}
                      <button type="button" onClick={() => removeVariable(v)} className="text-slate-400 hover:text-rose-600">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={formData.is_active} onChange={e => setFormData(f => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary" />
              Active (available for dispatch)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setFormData(emptyForm); }}
                className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg text-sm font-medium hover:bg-slate-200">
                Cancel
              </button>
              <button type="submit"
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90"
                style={{ background: '#2E5A1A' }}>
                <Save className="w-4 h-4" /> {editingId ? 'Save Changes' : 'Create Template'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}