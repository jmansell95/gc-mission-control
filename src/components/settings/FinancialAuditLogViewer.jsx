import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  History, Plus, Pencil, Trash2, Filter, Loader2, ShieldCheck,
  ChevronDown, ChevronRight, User, Clock, FileText, Lock,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

const ACTION_META = {
  create: { label: 'Created', color: 'bg-emerald-100 text-emerald-700', icon: Plus },
  update: { label: 'Updated', color: 'bg-amber-100 text-amber-700', icon: Pencil },
  delete: { label: 'Deleted', color: 'bg-rose-100 text-rose-700', icon: Trash2 },
};

const ENTITY_COLORS = {
  RateCardItem: 'bg-blue-50 text-blue-700 border-blue-100',
  InvestigationSOR: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  BillingRule: 'bg-violet-50 text-violet-700 border-violet-100',
  AppSetting: 'bg-slate-50 text-slate-700 border-slate-100',
  ExpensePreset: 'bg-amber-50 text-amber-700 border-amber-100',
  JobBillingContract: 'bg-indigo-50 text-indigo-700 border-indigo-100',
};

const ENTITY_OPTIONS = [
  'RateCardItem', 'InvestigationSOR', 'BillingRule', 'AppSetting', 'ExpensePreset', 'JobBillingContract',
];

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtValue(v) {
  if (v === null || v === undefined) return <span className="text-slate-300 italic">empty</span>;
  if (typeof v === 'object') return <code className="text-[11px] text-slate-600">{JSON.stringify(v)}</code>;
  return <span className="text-slate-700">{String(v)}</span>;
}

export default function FinancialAuditLogViewer() {
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [expanded, setExpanded] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['financial-audit-log', entityFilter, actionFilter],
    queryFn: () => base44.entities.FinancialAuditLog.filter(
      { ...(entityFilter ? { entity_name: entityFilter } : {}), ...(actionFilter ? { action: actionFilter } : {}) },
      '-created_date', 200,
    ),
  });

  const counts = useMemo(() => {
    return logs.reduce((acc, l) => {
      acc[l.action] = (acc[l.action] || 0) + 1;
      acc[l.entity_name] = (acc[l.entity_name] || 0) + 1;
      return acc;
    }, {});
  }, [logs]);

  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        icon={History}
        title="Financial Audit Log"
        description="Tamper-evident record of every create, update and delete on locked financial entities — rate cards, SORs, billing rules, presets, billing contracts & app settings."
      />

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <Plus className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-emerald-700 tabular-nums">{counts.create || 0}</p>
          <p className="text-[10px] text-emerald-600 uppercase font-medium">Created</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
          <Pencil className="w-4 h-4 text-amber-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-amber-700 tabular-nums">{counts.update || 0}</p>
          <p className="text-[10px] text-amber-600 uppercase font-medium">Updated</p>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
          <Trash2 className="w-4 h-4 text-rose-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-rose-700 tabular-nums">{counts.delete || 0}</p>
          <p className="text-[10px] text-rose-600 uppercase font-medium">Deleted</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-primary">
          <option value="">All Entities</option>
          {ENTITY_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:border-primary">
          <option value="">All Actions</option>
          <option value="create">Created</option>
          <option value="update">Updated</option>
          <option value="delete">Deleted</option>
        </select>
        {(entityFilter || actionFilter) && (
          <button onClick={() => { setEntityFilter(''); setActionFilter(''); }} className="text-xs text-slate-500 hover:text-slate-700 underline">Clear</button>
        )}
        <span className="ml-auto text-xs text-slate-400">{logs.length} record{logs.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Audit trail */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : logs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <ShieldCheck className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-500 font-medium">No mutations recorded yet</p>
          <p className="text-xs text-slate-400 mt-1">Every change to a locked financial entity will appear here automatically.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-slate-100 max-h-[32rem] overflow-y-auto">
            {logs.map((log) => {
              const act = ACTION_META[log.action] || ACTION_META.update;
              const ActIcon = act.icon;
              const entityColor = ENTITY_COLORS[log.entity_name] || 'bg-slate-50 text-slate-700 border-slate-100';
              const isExpanded = expanded === log.id;
              let changes = null;
              try { changes = log.field_changes ? JSON.parse(log.field_changes) : null; } catch (_) { changes = null; }
              return (
                <div key={log.id} className="px-4 py-3 hover:bg-slate-50/50 transition">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setExpanded(isExpanded ? null : log.id)} className="flex-shrink-0">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${act.color}`}>
                      <ActIcon className="w-2.5 h-2.5" />{act.label}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${entityColor}`}>
                      {log.entity_name}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800 truncate">{log.record_summary || `${log.entity_name} record`}</p>
                      {log.action === 'update' && log.changed_fields?.length > 0 && (
                        <p className="text-[10px] text-slate-400 truncate">Changed: {log.changed_fields.join(', ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-shrink-0">
                      <User className="w-3 h-3" />
                      <span className="font-mono">{log.actor_name || 'system'}</span>
                      <Clock className="w-3 h-3 ml-1" />
                      <span>{timeAgo(log.created_date)}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="mt-2 ml-9 space-y-2">
                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1"><Lock className="w-2.5 h-2.5" />Record ID: <code className="font-mono">{log.entity_id}</code></span>
                        <span>· {log.source}</span>
                      </div>
                      {changes && (
                        <div className="bg-slate-50 rounded-lg border border-slate-100 p-2.5 space-y-1.5">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">Field Changes</p>
                          {Object.entries(changes).map(([field, { before, after }]) => (
                            <div key={field} className="grid grid-cols-12 gap-2 items-center text-xs">
                              <span className="col-span-3 font-mono text-[11px] text-slate-500 font-medium">{field}</span>
                              <span className="col-span-4 bg-rose-50 rounded px-1.5 py-0.5 line-through text-rose-600 truncate">{fmtValue(before)}</span>
                              <span className="col-span-1 text-slate-300 text-center">→</span>
                              <span className="col-span-4 bg-emerald-50 rounded px-1.5 py-0.5 text-emerald-700 truncate">{fmtValue(after)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {!changes && log.action === 'delete' && (
                        <p className="text-[11px] text-rose-500 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Record permanently deleted — only the summary was captured.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}