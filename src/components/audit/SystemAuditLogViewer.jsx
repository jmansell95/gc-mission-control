import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  ShieldCheck, Search, ChevronDown, ChevronRight, Hash, User, Clock,
  FileText, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

function StatTile({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <p className="text-[10px] uppercase text-slate-400 font-semibold">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none mt-1">{value}</p>
    </div>
  );
}

const ACTION_META = {
  create: { label: 'Create', cls: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  update: { label: 'Update', cls: 'bg-blue-100 text-blue-700', icon: FileText },
  delete: { label: 'Delete', cls: 'bg-rose-100 text-rose-700', icon: AlertTriangle },
};

const SOURCE_META = {
  entity_automation: 'Auto',
  manual: 'Manual',
  scheduled: 'Scheduled',
  webhook: 'Webhook',
  api: 'API',
};

export default function SystemAuditLogViewer() {
  const [query, setQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['system-audit-logs'],
    queryFn: () => base44.entities.SystemAuditLog.list('-created_date', 200),
  });

  const entityNames = useMemo(() => {
    const set = new Set(logs.map(l => l.entity_name));
    return ['all', ...Array.from(set).sort()];
  }, [logs]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return logs.filter(l => {
      if (entityFilter !== 'all' && l.entity_name !== entityFilter) return false;
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (!q) return true;
      return (
        (l.record_summary || '').toLowerCase().includes(q) ||
        (l.entity_name || '').toLowerCase().includes(q) ||
        (l.actor_name || '').toLowerCase().includes(q) ||
        (l.entity_id || '').toLowerCase().includes(q)
      );
    });
  }, [logs, query, entityFilter, actionFilter]);

  return (
    <div className="space-y-4">
      <SettingsSectionHeader icon={ShieldCheck} title="System Audit Log" description="ISO 27001 tamper-evident audit trail with SHA-256 record hashing & chain linking for non-repudiation" />
      {/* Context banner — distinguishes this from the Job Pack Audit Trail */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
        <Hash className="w-4 h-4 text-slate-500 flex-shrink-0" />
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-700">System-level audit log</span> — tracks every database mutation with SHA-256 hashing. For per-job audit packs, use the <span className="font-semibold">Audit Trail</span> tab.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Total Entries" value={logs.length} />
        <StatTile label="Creates" value={logs.filter(l => l.action === 'create').length} />
        <StatTile label="Updates" value={logs.filter(l => l.action === 'update').length} />
        <StatTile label="Deletes" value={logs.filter(l => l.action === 'delete').length} />
      </div>

      {/* Search & filter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by record summary, entity, actor or ID..."
              className="w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/20 transition"
            />
          </div>
          <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
            className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] bg-white">
            {entityNames.map(n => (
              <option key={n} value={n}>{n === 'all' ? 'All entities' : n}</option>
            ))}
          </select>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
            className="px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] bg-white">
            <option value="all">All actions</option>
            <option value="create">Creates</option>
            <option value="update">Updates</option>
            <option value="delete">Deletes</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of {logs.length} audit entries. Click an entry to expand its full detail.
        </p>
      </div>

      {/* Audit log list */}
      <div className="space-y-2">
        {isLoading && (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-[#2E5A1A] animate-spin mx-auto" />
            <p className="text-sm text-slate-400 mt-3">Loading audit trail…</p>
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">No audit entries found.</p>
          </div>
        )}
        {filtered.map(log => {
          const isExpanded = expandedId === log.id;
          const meta = ACTION_META[log.action] || ACTION_META.update;
          const ActionIcon = meta.icon;
          return (
            <div key={log.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50/70 transition text-left"
              >
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-[#2E5A1A] flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.cls}`}>
                  <ActionIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900 truncate">{log.record_summary || `${log.entity_name} record`}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${meta.cls}`}>{meta.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{log.entity_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{log.actor_name || 'system'}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{log.created_date ? format(new Date(log.created_date), 'dd MMM yyyy HH:mm') : '—'}</span>
                    <span className="text-slate-400">{SOURCE_META[log.source] || log.source}</span>
                  </div>
                </div>
                <Hash className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              </button>
              {isExpanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Record Hash (SHA-256)</p>
                      <p className="font-mono text-slate-500 break-all bg-white rounded-lg p-2 border border-slate-200">{log.record_hash || '—'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 mb-1">Previous Hash (Chain Link)</p>
                      <p className="font-mono text-slate-500 break-all bg-white rounded-lg p-2 border border-slate-200">{log.previous_hash || '— (genesis)'}</p>
                    </div>
                  </div>
                  {log.changed_fields && log.changed_fields.length > 0 && (
                    <div>
                      <p className="font-semibold text-slate-700 mb-1 text-xs">Changed Fields</p>
                      <div className="flex flex-wrap gap-1.5">
                        {log.changed_fields.map(f => (
                          <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {log.field_changes && (
                    <div>
                      <p className="font-semibold text-slate-700 mb-1 text-xs">Field Changes</p>
                      <pre className="text-[10px] font-mono text-slate-600 bg-white rounded-lg p-3 border border-slate-200 overflow-x-auto max-h-48 overflow-y-auto">{log.field_changes}</pre>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    {log.actor_ip && <span>IP: {log.actor_ip}</span>}
                    <span>Entity ID: <span className="font-mono">{log.entity_id}</span></span>
                    <span>Integrity: <span className={`font-semibold ${log.integrity_status === 'valid' ? 'text-emerald-600' : 'text-rose-600'}`}>{log.integrity_status || 'valid'}</span></span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}