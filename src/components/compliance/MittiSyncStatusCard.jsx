import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, FileStack, Clock } from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';

export default function MittiSyncStatusCard() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const { data: config } = useQuery({
    queryKey: ['mitti-config'],
    queryFn: async () => { const l = await base44.entities.MittiConfig.filter({ key: 'global' }); return l?.[0] || null; },
  });
  const isConnected = !!(config?.enabled && config?.webhook_secret);
  const templates = config?.synced_templates || [];
  const lastSync = config?.last_pull_sync_at || config?.last_webhook_at;
  const handleSync = async () => {
    setSyncing(true);
    try { await base44.functions.invoke('syncMitti'); queryClient.invalidateQueries({ queryKey: ['mitti-config'] }); queryClient.invalidateQueries({ queryKey: ['safety-reports'] }); } catch {}
    setSyncing(false);
  };

  // Auto-sync once on mount when Mitti is connected
  const autoSynced = useRef(false);
  useEffect(() => {
    if (autoSynced.current) return;
    if (config === undefined) return; // still loading
    if (isConnected) {
      autoSynced.current = true;
      handleSync();
    }
  }, [config, isConnected]);
  return (
    <HubCard icon={isConnected ? CheckCircle2 : AlertCircle} title="Mitti Sync Status" subtitle="Template & audit sync from Mitti API" tone={isConnected ? 'brand' : 'amber'}
      action={<button onClick={handleSync} disabled={syncing} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2E5A1A] text-white text-xs font-semibold hover:bg-[#1c4a12] transition disabled:opacity-60">{syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync Now</button>}>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center"><div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-1.5"><FileStack className="w-4 h-4 text-blue-600" /></div><p className="text-xl font-extrabold text-slate-900 tabular-nums">{templates.length}</p><p className="text-[10px] text-slate-500 font-semibold uppercase">Templates</p></div>
        <div className="text-center"><div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div><p className="text-sm font-bold text-slate-700">{isConnected ? 'Connected' : 'Off'}</p><p className="text-[10px] text-slate-500 font-semibold uppercase">Status</p></div>
        <div className="text-center"><div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-1.5"><Clock className="w-4 h-4 text-amber-600" /></div><p className="text-xs font-bold text-slate-700">{lastSync ? new Date(lastSync).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Never'}</p><p className="text-[10px] text-slate-500 font-semibold uppercase">Last Sync</p></div>
      </div>
      {templates.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {templates.slice(0, 8).map(t => <span key={t.template_id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[140px]">{t.name || t.template_id}</span>)}
          {templates.length > 8 && <span className="text-[10px] text-slate-400">+{templates.length - 8} more</span>}
        </div>
      )}
    </HubCard>
  );
}