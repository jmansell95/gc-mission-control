import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Bot, Pause, Play, AlertTriangle, CheckCircle2, Clock,
  Zap, RefreshCw, ChevronRight, Activity, ShieldCheck,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useToast } from '@/components/ui/use-toast';

// The canonical agent registry — the five autonomous agents from the roadmap.
// On mount, the panel upserts a control record for each so the admin always
// sees every agent even before any has run.
const AGENT_REGISTRY = [
  {
    agent_id: 'billing',
    name: 'Autonomous Billing Engine',
    description: 'Matches timesheets, deliveries & assets to rate cards, auto-generates AFPs and invoices, flags only exceptions for human review.',
    category: 'billing',
    icon: Zap,
  },
  {
    agent_id: 'scheduling',
    name: 'Autonomous Scheduling & Rota',
    description: 'Auto-assigns crews to jobs by qualification, availability, location & rig compatibility. Resolves conflicts, publishes the rota, notifies staff.',
    category: 'scheduling',
    icon: Clock,
  },
  {
    agent_id: 'compliance',
    name: 'Autonomous Compliance & Safety',
    description: 'Monitors expiring certs, MOT, tax, LOLER/PAT/PUWER & insurance. Auto-deactivates non-compliant assets, raises recert tasks, chases owners.',
    category: 'compliance',
    icon: ShieldCheck,
  },
  {
    agent_id: 'logistics',
    name: 'Autonomous Logistics & Routing',
    description: 'Optimises daily delivery routes, auto-assigns drivers & vehicles, checks payload safety, triggers towing checklists, re-routes around traffic.',
    category: 'logistics',
    icon: Activity,
  },
  {
    agent_id: 'financial',
    name: 'Autonomous Financial Control',
    description: 'Runs CVR recalculation, margin-guard, overdue-invoice chasing, retention release & discrepancy detection. Auto-acts on green-path items.',
    category: 'financial',
    icon: Bot,
  },
];

const CATEGORY_COLORS = {
  billing: { bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  scheduling: { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-200' },
  compliance: { bg: 'bg-rose-100', text: 'text-rose-700', ring: 'ring-rose-200' },
  logistics: { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'ring-amber-200' },
  financial: { bg: 'bg-violet-100', text: 'text-violet-700', ring: 'ring-violet-200' },
};

function StatusBadge({ status }) {
  const map = {
    active: { icon: Play, label: 'Active', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    paused: { icon: Pause, label: 'Paused', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
    error: { icon: AlertTriangle, label: 'Error', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  };
  const s = map[status] || map.paused;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ring-1 ${s.cls}`}>
      <Icon className="w-3 h-3" /> {s.label}
    </span>
  );
}

function AgentCard({ agent, onToggle, onConfig }) {
  const colors = CATEGORY_COLORS[agent.category] || CATEGORY_COLORS.financial;
  const Icon = agent.icon;
  const isActive = agent.status === 'active';
  const isError = agent.status === 'error';

  return (
    <div className={`insight-card rounded-2xl p-hub-card-pad relative overflow-hidden ${isError ? 'ring-2 ring-rose-200' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${colors.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-hub-section text-slate-900 font-bold truncate">{agent.name}</h3>
            <StatusBadge status={agent.status} />
          </div>
          <p className="text-hub-caption text-slate-500 mt-1 leading-relaxed">{agent.description}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-bold text-slate-700 tabular-nums">{agent.decision_count || 0}</span>
          <span className="text-slate-400">decisions</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-bold text-slate-700 tabular-nums">{agent.exception_count || 0}</span>
          <span className="text-slate-400">exceptions</span>
        </div>
        {agent.last_run_at && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">
              {new Date(agent.last_run_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}{' '}
              {new Date(agent.last_run_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {agent.last_run_summary && (
        <p className="text-xs text-slate-500 mt-2.5 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
          {agent.last_run_summary}
        </p>
      )}

      {isError && agent.error_message && (
        <p className="text-xs text-rose-600 mt-2 bg-rose-50 rounded-lg px-3 py-2 border border-rose-100">
          {agent.error_message}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
        <button
          onClick={() => onToggle(agent)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition active:scale-95 ${
            isActive
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-[#2E5A1A] text-white hover:bg-[#1c4a12]'
          }`}
        >
          {isActive ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Activate</>}
        </button>
        <button
          onClick={() => onConfig(agent)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 transition active:scale-95"
        >
          <ChevronRight className="w-3.5 h-3.5" /> Config
        </button>
        {agent.paused_by && agent.status === 'paused' && (
          <span className="ml-auto text-xs text-slate-400">Paused by {agent.paused_by}</span>
        )}
      </div>
    </div>
  );
}

export default function AutopilotControlPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [configAgent, setConfigAgent] = useState(null);

  // Load all control records
  const { data: controls = [], isLoading } = useQuery({
    queryKey: ['autopilot-controls'],
    queryFn: () => base44.entities.AutopilotControl.list(),
  });

  // Merge registry with stored records so every agent always shows
  const agents = AGENT_REGISTRY.map(reg => {
    const stored = controls.find(c => c.agent_id === reg.agent_id);
    return { ...reg, ...(stored || {}) };
  });

  const activeCount = agents.filter(a => a.status === 'active').length;
  const errorCount = agents.filter(a => a.status === 'error').length;
  const totalDecisions = agents.reduce((sum, a) => sum + (a.decision_count || 0), 0);

  // Upsert registry on mount so records exist for every agent
  useEffect(() => {
    (async () => {
      const existing = await base44.entities.AutopilotControl.list();
      for (const reg of AGENT_REGISTRY) {
        if (!existing.find(c => c.agent_id === reg.agent_id)) {
          await base44.entities.AutopilotControl.create({
            agent_id: reg.agent_id,
            name: reg.name,
            description: reg.description,
            category: reg.category,
            status: 'paused',
            aggressiveness: 'conservative',
          });
        }
      }
      qc.invalidateQueries({ queryKey: ['autopilot-controls'] });
    })();
  }, [qc]);

  const toggleAgent = useMutation({
    mutationFn: async ({ agent, action }) => {
      const me = await base44.auth.me();
      const myName = me?.full_name || me?.email || 'Admin';
      const updates = action === 'pause'
        ? { status: 'paused', paused_by: myName, paused_at: new Date().toISOString(), pause_reason: 'Manually paused by admin' }
        : { status: 'active', paused_by: null, paused_at: null, error_message: null, pause_reason: null };
      const existing = await base44.entities.AutopilotControl.filter({ agent_id: agent.agent_id });
      if (existing[0]) {
        return base44.entities.AutopilotControl.update(existing[0].id, updates);
      }
      return base44.entities.AutopilotControl.create({ agent_id: agent.agent_id, name: agent.name, description: agent.description, category: agent.category, ...updates });
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['autopilot-controls'] });
      toast({
        title: vars.action === 'pause' ? 'Agent paused' : 'Agent activated',
        description: vars.action === 'pause'
          ? `${vars.name} will no longer take autonomous actions.`
          : `${vars.name} is now running on its schedule.`,
      });
    },
  });

  const pauseAll = useMutation({
    mutationFn: async () => {
      const me = await base44.auth.me();
      const myName = me?.full_name || me?.email || 'Admin';
      const all = await base44.entities.AutopilotControl.list();
      const active = all.filter(c => c.status === 'active');
      return base44.entities.AutopilotControl.bulkUpdate(
        active.map(c => ({ id: c.id, status: 'paused', paused_by: myName, paused_at: new Date().toISOString(), pause_reason: 'Emergency pause-all by admin' }))
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['autopilot-controls'] });
      toast({ title: 'All agents paused', description: 'Every autonomous agent has been halted.', variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-hub-gap-sm sm:space-y-hub-gap">
      <PageHeader
        icon={Bot}
        title="Autopilot Control"
        subtitle="Autonomous agents that decide and act — with full audit trails and one-tap override."
        stats={[
          { icon: Play, label: 'Active', value: activeCount },
          { icon: Pause, label: 'Paused', value: agents.length - activeCount - errorCount },
          { icon: AlertTriangle, label: 'Errors', value: errorCount },
          { icon: CheckCircle2, label: 'Decisions', value: totalDecisions },
        ]}
        actions={
          <button
            onClick={() => pauseAll.mutate()}
            disabled={activeCount === 0 || pauseAll.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition active:scale-95 disabled:opacity-50"
          >
            <Pause className="w-4 h-4" /> Pause All
          </button>
        }
      />

      {/* Agent grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-hub-gap">
        {agents.map(agent => (
          <AgentCard
            key={agent.agent_id}
            agent={agent}
            onToggle={(a) => toggleAgent.mutate({ agent: a, action: a.status === 'active' ? 'pause' : 'activate', name: a.name })}
            onConfig={setConfigAgent}
          />
        ))}
      </div>

      {/* Config drawer */}
      {configAgent && (
        <AgentConfigDrawer
          agent={configAgent}
          onClose={() => setConfigAgent(null)}
          onSaved={() => { setConfigAgent(null); qc.invalidateQueries({ queryKey: ['autopilot-controls'] }); }}
        />
      )}
    </div>
  );
}

function AgentConfigDrawer({ agent, onClose, onSaved }) {
  const { toast } = useToast();
  const [aggressiveness, setAggressiveness] = useState(agent.aggressiveness || 'conservative');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const existing = await base44.entities.AutopilotControl.filter({ agent_id: agent.agent_id });
      if (existing[0]) {
        await base44.entities.AutopilotControl.update(existing[0].id, { aggressiveness });
      }
      toast({ title: 'Configuration saved', description: `${agent.name} aggressiveness set to ${aggressiveness}.` });
      onSaved();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const levels = [
    { id: 'conservative', label: 'Conservative', desc: 'Only green-path, high-confidence actions' },
    { id: 'balanced', label: 'Balanced', desc: 'Green-path + low-risk auto-actions' },
    { id: 'aggressive', label: 'Aggressive', desc: 'Act on anything below the exception threshold' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl animate-pop-in max-h-[90dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-hub-title font-bold text-slate-900">{agent.name}</h3>
          <p className="text-hub-caption text-slate-500 mt-0.5">Autonomous action configuration</p>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Aggressiveness Level</p>
          {levels.map(l => (
            <button
              key={l.id}
              onClick={() => setAggressiveness(l.id)}
              className={`w-full text-left p-3.5 rounded-xl border-2 transition active:scale-[0.98] ${
                aggressiveness === l.id
                  ? 'border-[#2E5A1A] bg-[#2E5A1A]/5'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-sm font-bold text-slate-800">{l.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{l.desc}</p>
            </button>
          ))}
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold text-sm hover:bg-slate-200 transition">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#2E5A1A] text-white font-semibold text-sm hover:bg-[#1c4a12] transition disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}