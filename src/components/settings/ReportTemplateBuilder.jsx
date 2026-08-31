import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  FileBarChart, Plus, Trash2, Edit2, Save, X, Loader2, Clock, Search,
  BarChart3, Table2, PieChart, LineChart, Calendar, Share2, Send,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import BuilderPreviewFrame from '@/components/builder/BuilderPreviewFrame';

const CATEGORY_META = {
  overview: { label: 'Overview', cls: 'bg-slate-50 text-slate-700' },
  financial: { label: 'Financial', cls: 'bg-emerald-50 text-emerald-700' },
  jobs: { label: 'Jobs', cls: 'bg-blue-50 text-blue-700' },
  fleet: { label: 'Fleet', cls: 'bg-cyan-50 text-cyan-700' },
  staff: { label: 'Staff', cls: 'bg-violet-50 text-violet-700' },
  compliance: { label: 'Compliance', cls: 'bg-rose-50 text-rose-700' },
  assets: { label: 'Assets', cls: 'bg-amber-50 text-amber-700' },
  geotech: { label: 'Geotechnical', cls: 'bg-teal-50 text-teal-700' },
  logistics: { label: 'Logistics', cls: 'bg-indigo-50 text-indigo-700' },
  powerbi: { label: 'Power BI', cls: 'bg-purple-50 text-purple-700' },
  custom: { label: 'Custom', cls: 'bg-slate-50 text-slate-600' },
};

const CHART_META = {
  bar: { label: 'Bar Chart', icon: BarChart3 },
  pie: { label: 'Pie Chart', icon: PieChart },
  line: { label: 'Line Chart', icon: LineChart },
  area: { label: 'Area Chart', icon: LineChart },
  table: { label: 'Data Table', icon: Table2 },
  stat: { label: 'Stat Tiles', icon: BarChart3 },
};

const emptyForm = {
  name: '', category: 'custom', description: '', source_entity: '',
  fields: [], group_by: '', chart_type: 'bar', filters: {},
  is_shared: false, schedule_cadence: 'none', schedule_recipients: '', schedule_message: '',
};

// Build a mock preview of the report layout
function previewReportHtml(tpl) {
  const P = '#2E5A1A', A = '#8DC63F';
  const ChartIcon = CHART_META[tpl.chart_type]?.icon || BarChart3;
  const cat = CATEGORY_META[tpl.category] || CATEGORY_META.custom;
  const fields = tpl.fields?.length ? tpl.fields : ['Field 1', 'Field 2', 'Field 3'];
  const isChart = ['bar', 'pie', 'line', 'area'].includes(tpl.chart_type);

  let body = `<h2 style="margin:0 0 6px 0;color:#0f172a;font-size:18px;font-weight:800">${tpl.name || 'Untitled Report'}</h2>`;
  if (tpl.description) body += `<p style="margin:0 0 16px 0;color:#64748b;font-size:13px">${tpl.description}</p>`;

  // Filter summary
  const f = tpl.filters || {};
  const filterBits = [];
  if (f.datePreset) filterBits.push(`Date: ${f.datePreset}`);
  if (f.divisionId) filterBits.push('Division: filtered');
  if (f.status) filterBits.push(`Status: ${f.status}`);
  if (filterBits.length) body += `<p style="margin:0 0 12px 0;color:#94a3b8;font-size:11px">Filters: ${filterBits.join(' · ')}</p>`;

  if (tpl.chart_type === 'table' || tpl.chart_type === 'stat') {
    // Table preview
    const headers = fields.slice(0, 5);
    const th = `style="padding:10px 14px;background:${P};color:#fff;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.4px"`;
    body += `<table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden"><thead><tr>${headers.map(h => `<th ${th}>${h}</th>`).join('')}</tr></thead><tbody>`;
    for (let i = 1; i <= 4; i++) {
      const bg = i % 2 ? 'background:#f8fafc;' : '';
      body += `<tr>${headers.map(() => `<td style="padding:10px 14px;font-size:13px;color:#334155;border-bottom:1px solid #e2e8f0;${bg}">Sample ${i}</td>`).join('')}</tr>`;
    }
    body += `</tbody></table>`;
  } else if (tpl.chart_type === 'stat') {
    for (let i = 0; i < 3; i++) {
      body += `<div style="display:inline-block;width:30%;margin-right:3%;background:#f1f5f9;border-radius:10px;padding:16px;text-align:center"><p style="margin:0;color:#64748b;font-size:11px;text-transform:uppercase">${fields[i] || 'Metric'}</p><p style="margin:6px 0 0 0;color:${P};font-size:24px;font-weight:800">${(i + 1) * 23}%</p></div>`;
    }
  } else {
    // Chart placeholder
    const bars = [60, 85, 45, 90, 70, 55, 80];
    body += `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin:12px 0">`;
    if (tpl.chart_type === 'pie') {
      body += `<div style="text-align:center"><div style="display:inline-block;width:120px;height:120px;border-radius:50%;background:conic-gradient(${P} 0% 35%, ${A} 35% 60%, #fbbf24 60% 80%, #f43f5e 80% 100%);margin-bottom:8px"></div><p style="margin:4px 0 0 0;color:#94a3b8;font-size:11px">Pie chart preview</p></div>`;
    } else {
      body += `<div style="display:flex;align-items:flex-end;gap:6px;height:120px">`;
      bars.forEach((h, i) => { body += `<div style="flex:1;height:${h}%;background:${i % 2 ? A : P};border-radius:4px 4px 0 0;min-height:8px"></div>`; });
      body += `</div><div style="display:flex;gap:6px;margin-top:6px">${bars.map((_, i) => `<div style="flex:1;text-align:center;font-size:9px;color:#94a3b8">Q${i + 1}</div>`).join('')}</div>`;
    }
    body += `</div>`;
  }

  if (tpl.group_by) body += `<p style="margin:14px 0 0 0;color:#64748b;font-size:12px">Grouped by: <strong>${tpl.group_by}</strong></p>`;

  // Schedule info
  if (tpl.schedule_cadence && tpl.schedule_cadence !== 'none') {
    body += `<div style="margin-top:16px;padding:10px 14px;background:#f0f7e8;border:1px solid #d4e4c4;border-radius:8px"><p style="margin:0;color:#1c4a12;font-size:12px;font-weight:600">📅 Scheduled ${tpl.schedule_cadence}${tpl.schedule_recipients ? ` → ${tpl.schedule_recipients}` : ''}</p></div>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif">` +
    `<table align="center" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 32px rgba(15,42,31,0.10)">` +
    `<tr><td style="padding:16px 28px;background:${P};display:flex;align-items:center;gap:10px"><span style="color:${A};font-size:18px;font-weight:800">📊 ${tpl.name || 'Report'}</span><span style="margin-left:auto;color:#fff;font-size:11px;background:rgba(255,255,255,0.15);padding:3px 10px;border-radius:999px">${cat.label}</span></td></tr>` +
    `<tr><td style="padding:24px 28px">${body}</td></tr>` +
    `<tr><td style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center"><p style="margin:0;color:#94a3b8;font-size:11px">Generated by GC Mission Control Reports</p></td></tr>` +
    `</table></body></html>`;
}

export default function ReportTemplateBuilder() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [fieldInput, setFieldInput] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['report-templates'],
    queryFn: () => base44.entities.ReportTemplate.list('-created_date', 200),
  });

  const selected = templates.find(t => t.id === selectedId);
  const isEditingSelected = selected && editingId === selected.id;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return templates.filter(t => {
      if (catFilter !== 'all' && t.category !== catFilter) return false;
      if (q && !(t.name?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [templates, search, catFilter]);

  const previewHtml = useMemo(() => {
    if (isEditingSelected) return previewReportHtml(formData);
    if (selected) return previewReportHtml(selected);
    return '';
  }, [selected, isEditingSelected, formData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData, fields: formData.fields || [] };
    if (editingId) {
      await base44.entities.ReportTemplate.update(editingId, payload);
    } else {
      const created = await base44.entities.ReportTemplate.create(payload);
      setSelectedId(created.id);
    }
    queryClient.invalidateQueries({ queryKey: ['report-templates'] });
    setFormData(emptyForm);
    setShowForm(false);
    setEditingId(null);
  };

  const handleEdit = (t) => {
    setFormData({
      name: t.name || '', category: t.category || 'custom', description: t.description || '',
      source_entity: t.source_entity || '', fields: t.fields || [], group_by: t.group_by || '',
      chart_type: t.chart_type || 'bar', filters: t.filters || {}, is_shared: t.is_shared || false,
      schedule_cadence: t.schedule_cadence || 'none', schedule_recipients: t.schedule_recipients || '',
      schedule_message: t.schedule_message || '',
    });
    setEditingId(t.id);
    setSelectedId(t.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this report template? This cannot be undone.')) {
      await base44.entities.ReportTemplate.delete(id);
      if (selectedId === id) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
    }
  };

  const addField = () => {
    const v = fieldInput.trim();
    if (v && !formData.fields.includes(v)) {
      setFormData(f => ({ ...f, fields: [...(f.fields || []), v] }));
      setFieldInput('');
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="Report Template Builder"
        description="Build and manage report templates — mirrors the Email Builder for a consistent experience. Pick data source, fields, chart type, filters and scheduling with a live layout preview."
        icon={FileBarChart}
        actions={
          <button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(emptyForm); setSelectedId(null); }}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition" style={{ background: '#2E5A1A' }}>
            <Plus className="w-4 h-4" /> New Report
          </button>
        }
      />

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Template list */}
        <div className="w-full lg:w-80 flex-shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reports..."
              className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setCatFilter('all')} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${catFilter === 'all' ? 'bg-[#2E5A1A] text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>All</button>
            {Object.entries(CATEGORY_META).map(([k, v]) => (
              <button key={k} onClick={() => setCatFilter(k)} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${catFilter === k ? 'bg-[#2E5A1A] text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>{v.label}</button>
            ))}
          </div>
          {isLoading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 text-[#2E5A1A] animate-spin mx-auto" /></div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filtered.map(t => {
                const cat = CATEGORY_META[t.category] || CATEGORY_META.custom;
                const isSel = selectedId === t.id && !showForm;
                return (
                  <button key={t.id} onClick={() => { setSelectedId(t.id); setShowForm(false); setEditingId(null); }}
                    className={`w-full text-left p-3 rounded-xl border transition ${isSel ? 'border-[#2E5A1A] bg-emerald-50/50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <FileBarChart className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <p className="text-sm font-semibold text-slate-800 truncate flex-1">{t.name}</p>
                      {t.is_shared && <Share2 className="w-3 h-3 text-emerald-500" />}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{t.description || 'No description'}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${cat.cls}`}>{cat.label}</span>
                      {t.schedule_cadence && t.schedule_cadence !== 'none' && <span className="text-[9px] text-amber-600 flex items-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{t.schedule_cadence}</span>}
                      {t.last_run_at && <span className="text-[9px] text-slate-400 flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{format(new Date(t.last_run_at), 'dd MMM')}</span>}
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && <p className="text-center text-xs text-slate-400 py-6">No reports found.</p>}
            </div>
          )}
        </div>

        {/* Editor + Preview */}
        <div className="flex-1 min-w-0">
          {showForm ? (
            <div className="flex flex-col xl:flex-row gap-4">
              <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">{editingId ? 'Edit Report' : 'New Report Template'}</h3>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Report Name</label>
                      <input type="text" value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} required placeholder="Monthly Fleet Utilisation"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                      <select value={formData.category} onChange={e => setFormData(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] bg-white">
                        {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                    <input type="text" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} placeholder="What this report shows"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Source Entity</label>
                      <input type="text" value={formData.source_entity} onChange={e => setFormData(f => ({ ...f, source_entity: e.target.value }))} placeholder="e.g. Job, Vehicle, Staff"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Group By</label>
                      <input type="text" value={formData.group_by} onChange={e => setFormData(f => ({ ...f, group_by: e.target.value }))} placeholder="e.g. status, division_id"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
                    </div>
                  </div>
                  {/* Chart type selector */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Chart Type</label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {Object.entries(CHART_META).map(([k, v]) => {
                        const Icon = v.icon;
                        return (
                          <button key={k} type="button" onClick={() => setFormData(f => ({ ...f, chart_type: k }))}
                            className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-[10px] font-semibold transition ${formData.chart_type === k ? 'border-[#2E5A1A] bg-emerald-50 text-[#2E5A1A]' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                            <Icon className="w-4 h-4" /> {v.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Fields */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Fields / Columns</label>
                    <div className="flex gap-2 mb-2">
                      <input type="text" value={fieldInput} onChange={e => setFieldInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }} placeholder="Add a field name"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
                      <button type="button" onClick={addField} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200"><Plus className="w-4 h-4" /></button>
                    </div>
                    {formData.fields.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {formData.fields.map(v => (
                          <span key={v} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-mono">
                            {v}<button type="button" onClick={() => setFormData(f => ({ ...f, fields: f.fields.filter(x => x !== v) }))} className="text-slate-400 hover:text-rose-600"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Scheduling */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Schedule</label>
                      <select value={formData.schedule_cadence} onChange={e => setFormData(f => ({ ...f, schedule_cadence: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] bg-white">
                        <option value="none">On-demand only</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Recipients (comma-separated)</label>
                      <input type="text" value={formData.schedule_recipients} onChange={e => setFormData(f => ({ ...f, schedule_recipients: e.target.value }))} placeholder="ops@groundcontrol.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={formData.is_shared} onChange={e => setFormData(f => ({ ...f, is_shared: e.target.checked }))} className="w-4 h-4 rounded border-slate-300 text-[#2E5A1A] focus:ring-[#2E5A1A]" />
                    <Share2 className="w-3.5 h-3.5 text-slate-400" /> Share with whole organisation
                  </label>
                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setFormData(emptyForm); }} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg text-sm font-medium hover:bg-slate-200">Cancel</button>
                    <button type="submit" className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90" style={{ background: '#2E5A1A' }}>
                      <Save className="w-4 h-4" /> {editingId ? 'Save Changes' : 'Create Report'}
                    </button>
                  </div>
                </form>
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <BuilderPreviewFrame html={previewHtml} label="Layout Preview" emptyHint="Configure your report to see the layout…" />
              </div>
            </div>
          ) : selected ? (
            <div className="flex flex-col xl:flex-row gap-4">
              <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selected.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{selected.description || 'No description'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEdit(selected)} className="p-2 text-slate-400 hover:text-[#2E5A1A] hover:bg-emerald-50 rounded-lg transition" title="Edit"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(selected.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${(CATEGORY_META[selected.category] || CATEGORY_META.custom).cls}`}>{(CATEGORY_META[selected.category] || CATEGORY_META.custom).label}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{CHART_META[selected.chart_type]?.label || selected.chart_type}</span>
                  {selected.is_shared && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">Shared</span>}
                  {selected.schedule_cadence && selected.schedule_cadence !== 'none' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">{selected.schedule_cadence}</span>}
                </div>
                {selected.fields?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Fields</p>
                    <div className="flex flex-wrap gap-1">{selected.fields.map(v => <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">{v}</span>)}</div>
                  </div>
                )}
                {selected.source_entity && <p className="text-xs text-slate-500">Source: <span className="font-mono font-semibold text-slate-700">{selected.source_entity}</span>{selected.group_by ? ` · grouped by ${selected.group_by}` : ''}</p>}
                {selected.last_run_at && <p className="text-[11px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />Last run {format(new Date(selected.last_run_at), 'dd MMM yyyy HH:mm')}</p>}
                <button onClick={() => handleEdit(selected)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#2E5A1A] text-white text-sm font-semibold hover:bg-[#1c4a12] transition">
                  <Edit2 className="w-4 h-4" /> Edit this report
                </button>
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <BuilderPreviewFrame html={previewHtml} label="Report Preview" emptyHint="Select a report to preview" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border-2 border-dashed border-slate-200">
              <FileBarChart className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">Select a report to preview</p>
              <p className="text-xs text-slate-400 mt-1">or create a new one to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}