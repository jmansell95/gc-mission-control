import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';
import { useToast } from '@/components/ui/use-toast';
import {
  ShieldCheck, Car, HardHat, FileCheck, Save, Loader2, Search,
  ChevronDown, Check, AlertCircle,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const CHECK_CATEGORIES = [
  { key: 'vehicle_check', label: 'Daily Vehicle Check', icon: Car, desc: 'Pre-departure vehicle walk-round inspection', color: 'blue' },
  { key: 'powra', label: 'POWRA', icon: ShieldCheck, desc: 'Point of Work Risk Assessment on site arrival', color: 'amber' },
  { key: 'equipment', label: 'Equipment / Plant Check', icon: HardHat, desc: 'Plant and equipment inspection during briefing', color: 'emerald' },
  { key: 'general', label: 'General Audit', icon: FileCheck, desc: 'Any other audit type (toolbox talks, site inspections, etc.)', color: 'violet' },
];

export default function DivisionCheckConfigManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { divisions, activeDivisionId, setActiveDivision } = useDivision();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [templateSearch, setTemplateSearch] = useState({});

  // Fetch MittiConfig for synced templates
  const { data: mittiConfig } = useQuery({
    queryKey: ['mitti-config-check'],
    queryFn: async () => {
      const list = await base44.entities.MittiConfig.filter({ key: 'global' });
      return list[0] || null;
    },
  });

  const templates = mittiConfig?.synced_templates || [];

  // Fetch DivisionCheckConfig for the selected division
  const selectedDivisionId = activeDivisionId || divisions[0]?.id;

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ['division-check-config', selectedDivisionId],
    queryFn: async () => {
      if (!selectedDivisionId) return null;
      const list = await base44.entities.DivisionCheckConfig.filter({ division_id: selectedDivisionId });
      return list[0] || null;
    },
    enabled: !!selectedDivisionId,
  });

  // Initialize config state when existing config loads or division changes
  useEffect(() => {
    if (existingConfig) {
      setConfig(existingConfig.check_configs || []);
    } else {
      // Default: all categories disabled
      setConfig(CHECK_CATEGORIES.map(c => ({
        category: c.key,
        enabled: false,
        label: c.label,
        template_ids: [],
      })));
    }
  }, [existingConfig, selectedDivisionId]);

  const handleToggle = (category) => {
    setConfig(prev => prev.map(c =>
      c.category === category ? { ...c, enabled: !c.enabled } : c
    ));
  };

  const handleTemplateToggle = (category, templateId) => {
    setConfig(prev => prev.map(c => {
      if (c.category !== category) return c;
      const ids = c.template_ids || [];
      return {
        ...c,
        template_ids: ids.includes(templateId)
          ? ids.filter(id => id !== templateId)
          : [...ids, templateId],
      };
    }));
  };

  const handleSave = async () => {
    if (!selectedDivisionId) return;
    setSaving(true);
    try {
      if (existingConfig?.id) {
        await base44.entities.DivisionCheckConfig.update(existingConfig.id, { check_configs: config });
      } else {
        await base44.entities.DivisionCheckConfig.create({
          division_id: selectedDivisionId,
          check_configs: config,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['division-check-config', selectedDivisionId] });
      queryClient.invalidateQueries({ queryKey: ['missing-checks'] });
      toast({ title: 'Check configuration saved', description: 'The Missing Checks view and Reports Hub will now reflect these requirements.' });
    } catch (e) {
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const activeDivision = divisions.find(d => d.id === selectedDivisionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Division selector */}
      <div className="hub-glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-[#2E5A1A]" />
          <h2 className="text-sm font-bold text-slate-900">Division Check Configuration</h2>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Configure which Mitti safety checks each division requires. Toggle categories on/off and assign specific Mitti templates.
          The Missing Checks view in the Compliance Hub and the Reports Hub will reflect these settings.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {divisions.filter(d => d.is_active !== false).map(d => (
            <button
              key={d.id}
              onClick={() => setActiveDivision(d.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                selectedDivisionId === d.id
                  ? 'command-gradient text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* Check categories */}
      {config && (
        <div className="space-y-3">
          {CHECK_CATEGORIES.map(cat => {
            const cfg = config.find(c => c.category === cat.key) || { enabled: false, template_ids: [] };
            const Icon = cat.icon;
            const assignedTemplates = (cfg.template_ids || []).map(tid => templates.find(t => t.template_id === tid)).filter(Boolean);

            return (
              <div key={cat.key} className="hub-glass rounded-2xl overflow-hidden">
                {/* Header row with toggle */}
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    cfg.enabled ? 'stat-gradient-' + cat.color : 'bg-slate-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${cfg.enabled ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{cat.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{cat.desc}</p>
                  </div>
                  <Switch
                    checked={cfg.enabled}
                    onCheckedChange={() => handleToggle(cat.key)}
                  />
                </div>

                {/* Template picker (only when enabled) */}
                {cfg.enabled && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-slate-600">Assigned Mitti Templates</p>
                      <span className="text-[10px] text-slate-400">
                        ({assignedTemplates.length} selected · {templates.length} available)
                      </span>
                    </div>

                    {/* Selected templates */}
                    {assignedTemplates.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {assignedTemplates.map(t => (
                          <span key={t.template_id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-medium text-emerald-700">
                            {t.name || t.template_id}
                            <button
                              onClick={() => handleTemplateToggle(cat.key, t.template_id)}
                              className="text-emerald-400 hover:text-emerald-600"
                            >
                              <ChevronDown className="w-3 h-3 rotate-45" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Template search and list */}
                    <TemplatePicker
                      templates={templates}
                      selectedIds={cfg.template_ids || []}
                      onToggle={(tid) => handleTemplateToggle(cat.key, tid)}
                      search={templateSearch[cat.key] || ''}
                      onSearch={(v) => setTemplateSearch(prev => ({ ...prev, [cat.key]: v }))}
                    />

                    {assignedTemplates.length === 0 && (
                      <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-2">
                        <AlertCircle className="w-3 h-3" />
                        No templates assigned — any Mitti audit matching "{cat.label}" keywords will count as this check.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Save button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Template picker with search ──
function TemplatePicker({ templates, selectedIds, onToggle, search, onSearch }) {
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return templates.slice(0, 50);
    const q = search.toLowerCase();
    return templates.filter(t => (t.name || '').toLowerCase().includes(q) || t.template_id.toLowerCase().includes(q)).slice(0, 50);
  }, [templates, search]);

  return (
    <div>
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={e => { onSearch(e.target.value); setExpanded(true); }}
          onFocus={() => setExpanded(true)}
          placeholder="Search Mitti templates…"
          className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E5A1A] placeholder:text-slate-400"
        />
      </div>

      {expanded && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-400 text-center">No templates found</p>
          ) : (
            filtered.map(t => {
              const selected = selectedIds.includes(t.template_id);
              return (
                <button
                  key={t.template_id}
                  onClick={() => onToggle(t.template_id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition ${
                    selected ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-white text-slate-600'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    selected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'
                  }`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="truncate">{t.name || t.template_id}</span>
                </button>
              );
            })
          )}
          {templates.length > 50 && !search.trim() && (
            <p className="px-3 py-2 text-[10px] text-slate-400 text-center border-t border-slate-100">
              Showing first 50 of {templates.length} templates — search to find more
            </p>
          )}
        </div>
      )}
    </div>
  );
}