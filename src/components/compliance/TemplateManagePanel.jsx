import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Search, Pin, PinOff, EyeOff, Eye, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * TemplateManagePanel — admin panel for managing which Mitti templates
 * appear in the Audit Dashboard. Shows all synced templates (can be 800+)
 * with pin/hide toggles. Pinned templates always show in the grid; hidden
 * templates never show; the rest are filtered out when they have zero audits.
 *
 * Saves to MittiConfig.hidden_templates and MittiConfig.pinned_templates.
 */
export default function TemplateManagePanel({ config, templates, reports, onClose }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState(new Set(config?.hidden_templates || []));
  const [pinned, setPinned] = useState(new Set(config?.pinned_templates || []));
  const [codes, setCodes] = useState(new Set(config?.pinned_template_codes || []));
  const [newCode, setNewCode] = useState('');
  const [saving, setSaving] = useState(false);

  // Count audits per template
  const auditCounts = useMemo(() => {
    const counts = {};
    for (const r of reports) {
      const tid = r.template_id || r.audit_template_name || 'unknown';
      counts[tid] = (counts[tid] || 0) + 1;
    }
    return counts;
  }, [reports]);

  // Build template list with audit counts and state
  const allTemplates = useMemo(() => {
    return templates
      .map(t => ({
        template_id: t.template_id,
        name: t.name || t.template_id,
        auditCount: auditCounts[t.template_id] || 0,
        isHidden: hidden.has(t.template_id),
        isPinned: pinned.has(t.template_id),
      }))
      .filter(t => t.template_id);
  }, [templates, auditCounts, hidden, pinned]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return allTemplates;
    const q = search.toLowerCase();
    return allTemplates.filter(t => t.name.toLowerCase().includes(q));
  }, [allTemplates, search]);

  // Sort: pinned first, then by audit count desc, then alphabetical
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (a.auditCount !== b.auditCount) return b.auditCount - a.auditCount;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

  const togglePin = (tid) => {
    setPinned(prev => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid);
      else next.add(tid);
      return next;
    });
  };

  const toggleHide = (tid) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(tid)) next.delete(tid);
      else next.add(tid);
      return next;
    });
  };

  const addCode = () => {
    const c = newCode.trim().toUpperCase();
    if (!c) return;
    setCodes(prev => new Set([...prev, c]));
    setNewCode('');
  };

  const removeCode = (c) => {
    setCodes(prev => { const next = new Set(prev); next.delete(c); return next; });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.MittiConfig.update(config.id, {
        hidden_templates: Array.from(hidden),
        pinned_templates: Array.from(pinned),
        pinned_template_codes: Array.from(codes),
      });
      queryClient.invalidateQueries({ queryKey: ['mitti-config'] });
      toast({ title: 'Template preferences saved' });
      onClose();
    } catch (e) {
      toast({ title: 'Could not save', description: e?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const stats = {
    total: allTemplates.length,
    pinned: pinned.size,
    hidden: hidden.size,
    codes: codes.size,
    withAudits: allTemplates.filter(t => t.auditCount > 0).length,
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-4xl max-h-[calc(100dvh-2rem)] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Manage Templates</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.total} templates · {stats.withAudits} with audits · {stats.pinned} pinned · {stats.hidden} hidden · {stats.codes} codes
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search templates by name…"
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10"
            />
          </div>
          <div className="flex items-center gap-4 mt-2.5 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><Pin className="w-3 h-3 text-[#2E5A1A]" /> Pinned = always visible</span>
            <span className="flex items-center gap-1.5"><EyeOff className="w-3 h-3 text-slate-400" /> Hidden = never visible</span>
            <span className="flex items-center gap-1.5"><Eye className="w-3 h-3 text-slate-400" /> Default = visible only with audits</span>
          </div>
        </div>

        {/* Pinned GC Codes */}
        <div className="px-5 py-3 border-b border-slate-100 bg-emerald-50/30">
          <p className="text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Pin className="w-3.5 h-3.5 text-[#2E5A1A]" /> Pinned GC Template Codes
          </p>
          <p className="text-[11px] text-slate-500 mb-2.5">When codes are set, only templates whose name contains one of these codes appear in the grid. External contractor audits are always hidden.</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {Array.from(codes).map(c => (
              <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2E5A1A] text-white text-xs font-bold">
                {c}
                <button onClick={() => removeCode(c)} className="hover:bg-white/20 rounded p-0.5"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {codes.size === 0 && <span className="text-[11px] text-slate-400 italic">No codes set — all templates with staff audits are shown.</span>}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCode}
              onChange={e => setNewCode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCode(); } }}
              placeholder="e.g. GC03EXT29"
              className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] uppercase"
            />
            <button onClick={addCode} className="px-3 py-1.5 bg-[#2E5A1A] text-white rounded-lg text-sm font-bold hover:bg-[#244715] transition">Add Code</button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {sorted.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No templates match your search.</p>
          ) : (
            <div className="space-y-1.5">
              {sorted.map(t => (
                <div
                  key={t.template_id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition ${
                    t.isHidden ? 'bg-slate-50 border-slate-100 opacity-60' :
                    t.isPinned ? 'bg-emerald-50/50 border-emerald-100' :
                    'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {t.auditCount > 0 ? `${t.auditCount} audit${t.auditCount === 1 ? '' : 's'}` : 'No audits'}
                    </p>
                  </div>
                  <button
                    onClick={() => togglePin(t.template_id)}
                    className={`p-1.5 rounded-lg transition ${
                      t.isPinned ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                    title={t.isPinned ? 'Unpin' : 'Pin — always show'}
                  >
                    {t.isPinned ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => toggleHide(t.template_id)}
                    className={`p-1.5 rounded-lg transition ${
                      t.isHidden ? 'bg-slate-300 text-slate-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                    title={t.isHidden ? 'Unhide' : 'Hide — never show'}
                  >
                    {t.isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Changes apply to the Audit Dashboard template grid immediately after saving.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold hover:bg-[#244715] transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}