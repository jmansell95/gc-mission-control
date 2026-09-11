import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import {
  Route, Plus, Trash2, Save, X, Wrench, AlertTriangle, ShieldAlert, Settings,
} from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';

const CATEGORY_META = {
  repair: { label: 'Repair', icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  fault: { label: 'Fault', icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  safety: { label: 'Safety', icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  general: { label: 'General', icon: Settings, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
};

/**
 * MittiActionRoutingManager — admin UI to configure how Mitti audit action
 * items are routed to people's inbox. Maps action-item categories (repair,
 * fault, safety, general) to specific staff IDs and/or job-title keywords.
 *
 * When an audit is stored, each action item is classified and an InboxItem
 * is created for each matching recipient.
 */
export default function MittiActionRoutingManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draftRules, setDraftRules] = useState([]);
  const [saving, setSaving] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['mitti-config'],
    queryFn: async () => { const l = await base44.entities.MittiConfig.filter({ key: 'global' }); return l?.[0] || null; },
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['staff-active-for-routing'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }, 'name', 500),
  });

  const rules = config?.action_routing || [];

  const startEdit = () => {
    setDraftRules(JSON.parse(JSON.stringify(rules.length > 0 ? rules : [])));
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setDraftRules([]); };

  const addRule = () => {
    setDraftRules(prev => [...prev, { category: 'repair', recipient_staff_ids: [], job_title_keywords: [], notify_emails: [] }]);
  };

  const updateRule = (idx, field, value) => {
    setDraftRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const removeRule = (idx) => {
    setDraftRules(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleStaff = (idx, staffId) => {
    setDraftRules(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const ids = r.recipient_staff_ids || [];
      return { ...r, recipient_staff_ids: ids.includes(staffId) ? ids.filter(x => x !== staffId) : [...ids, staffId] };
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      if (!config?.id) {
        toast({ title: 'Mitti not configured', description: 'Configure Mitti first before setting up action routing.', variant: 'destructive' });
        setSaving(false);
        return;
      }
      await base44.entities.MittiConfig.update(config.id, { action_routing: draftRules });
      qc.invalidateQueries({ queryKey: ['mitti-config'] });
      setEditing(false);
      toast({ title: 'Action routing saved', description: `${draftRules.length} routing rule${draftRules.length !== 1 ? 's' : ''} active.` });
    } catch (err) {
      toast({ title: 'Save failed', description: err?.message || 'Could not save routing rules.', variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <HubCard icon={Route} title="Action Item Routing" subtitle="Route audit action items to the right people's inbox" tone="brand"
      action={!editing ? (
        <button onClick={startEdit} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E5A1A] text-white text-xs font-semibold hover:bg-[#1c4a12] transition">
          <Plus className="w-3.5 h-3.5" /> Add Rule
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <button onClick={cancelEdit} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#2E5A1A] text-white text-xs font-semibold hover:bg-[#1c4a12] transition disabled:opacity-60">
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    >
      <div className="p-4">
        {!editing ? (
          rules.length === 0 ? (
            <div className="text-center py-6">
              <Route className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">No routing rules configured</p>
              <p className="text-xs text-slate-400 mt-1">Add rules to send audit action items (repairs, faults, safety) to the right people's inbox.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, idx) => {
                const cat = CATEGORY_META[rule.category] || CATEGORY_META.general;
                const CatIcon = cat.icon;
                const recipients = (rule.recipient_staff_ids || []).map(sid => staff.find(s => s.id === sid)).filter(Boolean);
                return (
                  <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl border ${cat.bg}`}>
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 border border-slate-200">
                      <CatIcon className={`w-4 h-4 ${cat.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800">{cat.label} items</p>
                      {recipients.length > 0 && (
                        <p className="text-xs text-slate-600 mt-0.5">
                          → {recipients.map(r => r.name).join(', ')}
                        </p>
                      )}
                      {(rule.job_title_keywords || []).length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Keywords: {rule.job_title_keywords.join(', ')}
                        </p>
                      )}
                      {(rule.notify_emails || []).length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Emails: {rule.notify_emails.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {draftRules.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">No rules yet. Click "Add Rule" to create one.</p>
            )}
            {draftRules.map((rule, idx) => {
              const cat = CATEGORY_META[rule.category] || CATEGORY_META.general;
              const CatIcon = cat.icon;
              return (
                <div key={idx} className="rounded-xl border border-slate-200 p-3 space-y-2.5 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <select
                      value={rule.category}
                      onChange={(e) => updateRule(idx, 'category', e.target.value)}
                      className="text-xs font-semibold border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                    >
                      {Object.entries(CATEGORY_META).map(([k, m]) => (
                        <option key={k} value={k}>{m.label}</option>
                      ))}
                    </select>
                    <button onClick={() => removeRule(idx)} className="p-1 text-slate-400 hover:text-red-500 transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Job title keywords */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Job title keywords (auto-match staff)</label>
                    <input
                      type="text"
                      value={(rule.job_title_keywords || []).join(', ')}
                      onChange={(e) => updateRule(idx, 'job_title_keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="fitter, warehouse, mechanic"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>

                  {/* Staff picker */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Specific people</label>
                    <div className="max-h-32 overflow-y-auto space-y-1 bg-white rounded-lg border border-slate-200 p-2">
                      {staff.map(s => {
                        const checked = (rule.recipient_staff_ids || []).includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-slate-50 rounded p-1">
                            <input type="checkbox" checked={checked} onChange={() => toggleStaff(idx, s.id)} className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                            <span className="font-medium text-slate-700">{s.name}</span>
                            {s.job_title && <span className="text-slate-400">· {s.job_title}</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notify emails */}
                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Extra notification emails</label>
                    <input
                      type="text"
                      value={(rule.notify_emails || []).join(', ')}
                      onChange={(e) => updateRule(idx, 'notify_emails', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="fitters@gc.co.uk, warehouse@gc.co.uk"
                      className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white"
                    />
                  </div>
                </div>
              );
            })}
            <button onClick={addRule} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-xs font-semibold hover:border-emerald-400 hover:text-emerald-600 transition">
              <Plus className="w-4 h-4" /> Add Routing Rule
            </button>
          </div>
        )}
      </div>
    </HubCard>
  );
}