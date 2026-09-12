import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, X, Check, Database, Zap, Clock, Bot, Webhook,
  ShieldCheck, Server, ChevronDown, ChevronRight, CheckCircle2,
} from 'lucide-react';
import {
  ENTITIES, FUNCTIONS, AUTOMATIONS, AGENTS, CONNECTOR_WEBHOOKS,
  AUTH_FLOWS, INFRASTRUCTURE, MIGRATION_SUMMARY, ALL_PARITY_ITEMS,
} from '@/utils/azureMigrationData';

const STORAGE_KEY = 'gcmc-azure-parity-progress';

const RLS_LABELS = {
  division: 'Division-scoped (SESSION_CONTEXT)',
  ownership: 'Ownership (created_by_id)',
  admin: 'Admin-only',
  public: 'Public read (null)',
  complex: 'Complex $or (division + ownership + admin)',
  none: 'No RLS',
};

const RLS_COLORS = {
  division: 'bg-blue-100 text-blue-700',
  ownership: 'bg-violet-100 text-violet-700',
  admin: 'bg-rose-100 text-rose-700',
  public: 'bg-emerald-100 text-emerald-700',
  complex: 'bg-amber-100 text-amber-700',
  none: 'bg-slate-100 text-slate-500',
};

const TABS = [
  { id: 'entities', label: 'Entities', icon: Database, count: MIGRATION_SUMMARY.entities },
  { id: 'functions', label: 'Functions', icon: Zap, count: MIGRATION_SUMMARY.functions },
  { id: 'automations', label: 'Automations', icon: Clock, count: MIGRATION_SUMMARY.automations },
  { id: 'agents', label: 'Agents', icon: Bot, count: MIGRATION_SUMMARY.agents },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, count: MIGRATION_SUMMARY.connectorWebhooks },
  { id: 'auth', label: 'Auth', icon: ShieldCheck, count: MIGRATION_SUMMARY.authFlows },
  { id: 'infra', label: 'Infrastructure', icon: Server, count: MIGRATION_SUMMARY.infrastructure },
];

function Row({ item, isDone, onToggle, extra }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${
      isDone ? 'bg-emerald-50/60 border-emerald-200/70' : 'bg-white border-slate-200/70 hover:border-slate-300'
    }`}>
      <button
        onClick={() => onToggle(item.id)}
        className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition ${
          isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
        }`}
        aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
      >
        {isDone ? <Check className="w-4 h-4" /> : <span className="w-3 h-3 rounded-sm border-2 border-current" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold truncate ${isDone ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
          {item.name}
        </p>
        <p className="text-xs text-slate-400 truncate mt-0.5">{item.azureTarget}</p>
      </div>
      {extra}
    </div>
  );
}

export default function ParityMatrix() {
  const [tab, setTab] = useState('entities');
  const [query, setQuery] = useState('');
  const [done, setDone] = useState({});
  const [collapsedCats, setCollapsedCats] = useState({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setDone(JSON.parse(saved));
    } catch (e) { /* ignore */ }
  }, []);

  const toggle = (id) => {
    setDone(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
      return next;
    });
  };

  const toggleCat = (cat) => setCollapsedCats(p => ({ ...p, [cat]: !p[cat] }));

  const totalCount = ALL_PARITY_ITEMS.length;
  const doneCount = Object.values(done).filter(Boolean).length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const q = query.toLowerCase().trim();

  const itemsForTab = useMemo(() => {
    switch (tab) {
      case 'entities': return ENTITIES;
      case 'functions': return FUNCTIONS;
      case 'automations': return AUTOMATIONS;
      case 'agents': return AGENTS;
      case 'webhooks': return CONNECTOR_WEBHOOKS;
      case 'auth': return AUTH_FLOWS;
      case 'infra': return INFRASTRUCTURE;
      default: return [];
    }
  }, [tab]);

  const filtered = q
    ? itemsForTab.filter(i => i.name?.toLowerCase().includes(q) || i.azureTarget?.toLowerCase().includes(q))
    : itemsForTab;

  // Group by category for entities; flat for others
  const grouped = useMemo(() => {
    if (tab === 'entities') {
      const map = {};
      filtered.forEach(i => {
        if (!map[i.category]) map[i.category] = [];
        map[i.category].push(i);
      });
      return map;
    }
    return null;
  }, [filtered, tab]);

  const tabDoneCount = itemsForTab.filter(i => done[i.id]).length;
  const markAll = () => {
    const next = { ...done };
    itemsForTab.forEach(i => { if (!next[i.id]) next[i.id] = true; });
    setDone(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      {/* Header + progress */}
      <div className="hub-glass rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-5 h-5 text-[#2E5A1A]" />
          <h2 className="text-lg font-bold text-slate-900">1:1 Parity Matrix</h2>
          <span className="ml-auto text-xs font-bold text-slate-500 tabular-nums">
            {doneCount}/{totalCount} verified · {progressPct}%
          </span>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Every entity, function, automation, agent, and webhook that must map to an Azure
          equivalent. Tick each row as you verify the migration — progress is saved on this device.
        </p>
        <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#2E5A1A] to-[#8DC63F] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setQuery(''); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${
                active ? 'bg-[#2E5A1A] text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
              }`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${TABS.find(t => t.id === tab)?.label?.toLowerCase()}...`}
          className="w-full pl-10 pr-10 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 transition"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tab progress */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
          {TABS.find(t => t.id === tab)?.label} — {tabDoneCount}/{itemsForTab.length} verified
        </p>
        <button onClick={markAll} className="text-xs font-semibold text-[#2E5A1A] hover:underline">
          Mark all complete
        </button>
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <div className="hub-glass rounded-2xl p-8 text-center">
          <p className="text-sm text-slate-500">No items match "{query}"</p>
        </div>
      ) : grouped ? (
        <div className="space-y-3">
          {Object.entries(grouped).map(([cat, items]) => {
            const isCollapsed = collapsedCats[cat];
            const catDone = items.filter(i => done[i.id]).length;
            return (
              <div key={cat} className="hub-glass rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleCat(cat)}
                  className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50/50 transition"
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  <span className="text-sm font-bold text-slate-800">{cat}</span>
                  <span className="text-xs text-slate-400">· {items.length} tables</span>
                  <span className="ml-auto text-xs font-bold text-emerald-600">{catDone}/{items.length}</span>
                </button>
                {!isCollapsed && (
                  <div className="px-3 pb-3 space-y-2">
                    {items.map(item => (
                      <Row
                        key={item.id}
                        item={item}
                        isDone={!!done[item.id]}
                        onToggle={toggle}
                        extra={
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${RLS_COLORS[item.rls]}`}>
                            {RLS_LABELS[item.rls]}
                          </span>
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className="hub-glass rounded-xl">
              <Row
                item={item}
                isDone={!!done[item.id]}
                onToggle={toggle}
                extra={
                  item.trigger ? (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                      {item.trigger}
                    </span>
                  ) : item.schedule ? (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-600 whitespace-nowrap">
                      {item.schedule}
                    </span>
                  ) : item.events ? (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-violet-100 text-violet-600 whitespace-nowrap">
                      {item.events}
                    </span>
                  ) : item.base44Source ? (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap hidden sm:inline">
                      {item.base44Source}
                    </span>
                  ) : null
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}