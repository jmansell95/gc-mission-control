import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, FileStack, Clock, X, ChevronRight, Database, Search, Download } from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';
import { Button } from '@/components/ui/button';

const STEPS = [
  { key: 'templates', label: 'Sync Templates', icon: FileStack, desc: 'Fetching audit form templates from Mitti' },
  { key: 'search', label: 'Search Audits', icon: Search, desc: 'Finding audits modified since last sync' },
  { key: 'fetch', label: 'Fetch & Store', icon: Download, desc: 'Downloading and storing audit data' },
];

export default function MittiSyncStatusCard() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [syncStep, setSyncStep] = useState(0);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncLog, setSyncLog] = useState([]);
  const [syncStats, setSyncStats] = useState({ templates: 0, found: 0, stored: 0, updated: 0, errors: 0 });
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['mitti-config'],
    queryFn: async () => { const l = await base44.entities.MittiConfig.filter({ key: 'global' }); return l?.[0] || null; },
  });
  const isConnected = !!(config?.enabled && config?.webhook_secret);
  const templates = config?.synced_templates || [];
  const lastSync = config?.last_pull_sync_at || config?.last_webhook_at;

  // Pending audits check — lightweight query with 5-min staleTime so we
  // don't hit the Mitti API on every mount. Shows an amber badge when
  // there are audits waiting to be synced.
  const { data: pendingData } = useQuery({
    queryKey: ['mitti-pending'],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('searchMittiAudits', {});
        const d = res.data || res;
        return d?.pending_count || 0;
      } catch { return 0; }
    },
    enabled: isConnected && !syncing,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  });
  const pendingCount = pendingData || 0;

  const addLog = useCallback((msg, type = 'info') => {
    setSyncLog(prev => [...prev.slice(-80), { time: new Date().toLocaleTimeString('en-GB'), msg, type }]);
  }, []);

  const runSync = useCallback(async () => {
    setSyncing(true);
    setShowOverlay(true);
    setSyncStep(0);
    setSyncProgress(0);
    setSyncLog([]);
    setSyncStats({ templates: 0, found: 0, stored: 0, updated: 0, errors: 0 });

    try {
      // ── Step 1: Sync Templates ──
      setSyncStep(0);
      addLog('Fetching templates from Mitti API…');
      const tplRes = await base44.functions.invoke('syncMittiTemplates', {});
      const tplData = tplRes.data || tplRes;
      if (tplData.error) throw new Error(tplData.error);
      const tplCount = tplData.templates_synced || 0;
      setSyncStats(s => ({ ...s, templates: tplCount }));
      setSyncProgress(15);
      addLog(`Synced ${tplCount} templates`, 'success');
      queryClient.invalidateQueries({ queryKey: ['mitti-config'] });

      // ── Step 2: Search Audits ──
      setSyncStep(1);
      addLog('Searching for audits modified since last sync…');
      const searchRes = await base44.functions.invoke('searchMittiAudits', {});
      const searchData = searchRes.data || searchRes;
      if (searchData.error) throw new Error(searchData.error);
      const auditEntries = searchData.audit_ids || [];
      const totalFound = auditEntries.length;
      setSyncStats(s => ({ ...s, found: totalFound }));
      setSyncProgress(25);
      addLog(`Found ${totalFound} audits to fetch`, 'success');

      if (totalFound === 0) {
        addLog('No new audits to sync — all caught up!', 'success');
        setSyncProgress(100);
        setSyncStep(3);
        // Update last_pull_sync_at
        if (searchData.latest_modified) {
          try {
            const cfg = await base44.entities.MittiConfig.filter({ key: 'global' });
            if (cfg?.[0]?.id) {
              await base44.entities.MittiConfig.update(cfg[0].id, { last_pull_sync_at: searchData.latest_modified });
            }
          } catch {}
        }
        queryClient.invalidateQueries({ queryKey: ['mitti-config'] });
        queryClient.invalidateQueries({ queryKey: ['safety-reports'] });
        setSyncing(false);
        return;
      }

      // ── Step 3: Fetch & Store in batches of 10 ──
      setSyncStep(2);
      let processed = 0;
      let totalStored = 0, totalUpdated = 0, totalErrors = 0;
      const batchSize = 25;
      for (let i = 0; i < auditEntries.length; i += batchSize) {
        const batch = auditEntries.slice(i, i + batchSize);
        addLog(`Fetching batch ${Math.floor(i / batchSize) + 1} (${batch.length} audits)…`);
        const batchRes = await base44.functions.invoke('syncMittiAuditBatch', { audit_entries: batch });
        const batchData = batchRes.data || batchRes;
        if (batchData.error) {
          addLog(`Batch error: ${batchData.error}`, 'error');
          totalErrors += batch.length;
        } else {
          totalStored += batchData.stored || 0;
          totalUpdated += batchData.updated || 0;
          totalErrors += batchData.errors || 0;
          // Log each audit result
          for (const r of (batchData.results || [])) {
            if (r.status === 'stored') addLog(`✓ Stored: ${r.title}`, 'success');
            else if (r.status === 'updated') addLog(`↻ Updated: ${r.title}`, 'success');
            else if (r.status === 'error') addLog(`✗ Error: ${r.error}`, 'error');
          }
        }
        processed += batch.length;
        setSyncStats(s => ({ ...s, stored: totalStored, updated: totalUpdated, errors: totalErrors }));
        setSyncProgress(25 + Math.round((processed / totalFound) * 70));
      }

      // Update last_pull_sync_at cursor
      if (searchData.latest_modified) {
        try {
          const cfg = await base44.entities.MittiConfig.filter({ key: 'global' });
          if (cfg?.[0]?.id) {
            await base44.entities.MittiConfig.update(cfg[0].id, { last_pull_sync_at: searchData.latest_modified });
          }
        } catch {}
      }

      setSyncStep(3);
      setSyncProgress(100);
      addLog(`Done! ${totalStored} stored, ${totalUpdated} updated, ${totalErrors} errors`, 'success');
      queryClient.invalidateQueries({ queryKey: ['mitti-config'] });
      queryClient.invalidateQueries({ queryKey: ['safety-reports'] });
      queryClient.invalidateQueries({ queryKey: ['safety-reports-all-templates'] });
    } catch (err) {
      addLog(`Sync failed: ${err.message}`, 'error');
    } finally {
      setSyncing(false);
    }
  }, [addLog, queryClient]);

  // Auto-sync once on mount when Mitti is connected
  const autoSynced = useRef(false);
  useEffect(() => {
    if (autoSynced.current) return;
    if (config === undefined) return;
    if (isConnected) {
      autoSynced.current = true;
      runSync();
    }
  }, [config, isConnected, runSync]);

  return (
    <>
      <HubCard icon={isConnected ? CheckCircle2 : AlertCircle} title="Mitti Sync Status" subtitle="Template & audit sync from Mitti API" tone={isConnected ? 'brand' : 'amber'}
        action={
          <div className="flex items-center gap-2">
            {templates.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setShowAllTemplates(true)}>
                <FileStack className="w-3.5 h-3.5" /> View All
              </Button>
            )}
            <Button variant="default" size="sm" onClick={runSync} disabled={syncing}>
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync Now
            </Button>
          </div>
        }>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center"><div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-1.5"><FileStack className="w-4 h-4 text-blue-600" /></div><p className="text-xl font-extrabold text-slate-900 tabular-nums">{templates.length}</p><p className="text-[10px] text-slate-500 font-semibold uppercase">Templates</p></div>
          <div className="text-center"><div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></div><p className="text-sm font-bold text-slate-700">{isConnected ? 'Connected' : 'Off'}</p><p className="text-[10px] text-slate-500 font-semibold uppercase">Status</p></div>
          <div className="text-center"><div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-1.5"><Clock className="w-4 h-4 text-amber-600" /></div><p className="text-xs font-bold text-slate-700">{lastSync ? new Date(lastSync).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Never'}</p><p className="text-[10px] text-slate-500 font-semibold uppercase">Last Sync</p></div>
        </div>
        {pendingCount > 0 && !syncing && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-700">{pendingCount} audit{pendingCount !== 1 ? 's' : ''} pending sync</p>
            <Button variant="ghost" size="sm" onClick={runSync} className="ml-auto text-amber-700 hover:bg-amber-100">
              Sync now
            </Button>
          </div>
        )}
        {templates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {templates.slice(0, 8).map(t => <span key={t.template_id} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 truncate max-w-[140px]">{t.name || t.template_id}</span>)}
            {templates.length > 8 && <Button variant="link" size="sm" onClick={() => setShowAllTemplates(true)} className="text-[10px] text-slate-400 hover:text-slate-600">+{templates.length - 8} more</Button>}
          </div>
        )}
      </HubCard>

      {/* ── Sync Progress Overlay ── */}
      {showOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" onClick={() => !syncing && setShowOverlay(false)}>
          <div className="hub-glass rounded-3xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto animate-pop-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Mitti Sync Progress</h3>
              <Button variant="ghost" size="icon" onClick={() => !syncing && setShowOverlay(false)} disabled={syncing} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-1 mb-5">
              {STEPS.map((step, i) => {
                const StepIcon = step.icon;
                const isDone = syncStep > i;
                const isActive = syncStep === i;
                return (
                  <React.Fragment key={step.key}>
                    <div className={`flex flex-col items-center gap-1 flex-1 ${i === 0 ? '' : 'flex-1'}`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${isDone ? 'bg-emerald-100 text-emerald-600' : isActive ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : isActive ? <Loader2 className="w-4 h-4 animate-spin" /> : <StepIcon className="w-4 h-4" />}
                      </div>
                      <span className={`text-[10px] font-semibold text-center leading-tight ${isDone ? 'text-emerald-600' : isActive ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className={`h-0.5 w-4 rounded-full ${syncStep > i ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-600">
                  {syncStep < STEPS.length ? STEPS[syncStep]?.desc : 'Sync complete'}
                </span>
                <span className="text-xs font-bold text-slate-900 tabular-nums">{syncProgress}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#2E5A1A] to-[#8DC63F] rounded-full transition-all duration-500" style={{ width: `${syncProgress}%` }} />
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="text-center rounded-xl bg-blue-50 p-2">
                <p className="text-lg font-extrabold text-blue-600 tabular-nums">{syncStats.templates}</p>
                <p className="text-[9px] text-slate-500 font-semibold uppercase">Templates</p>
              </div>
              <div className="text-center rounded-xl bg-slate-50 p-2">
                <p className="text-lg font-extrabold text-slate-600 tabular-nums">{syncStats.found}</p>
                <p className="text-[9px] text-slate-500 font-semibold uppercase">Found</p>
              </div>
              <div className="text-center rounded-xl bg-emerald-50 p-2">
                <p className="text-lg font-extrabold text-emerald-600 tabular-nums">{syncStats.stored + syncStats.updated}</p>
                <p className="text-[9px] text-slate-500 font-semibold uppercase">Synced</p>
              </div>
              <div className="text-center rounded-xl bg-rose-50 p-2">
                <p className="text-lg font-extrabold text-rose-600 tabular-nums">{syncStats.errors}</p>
                <p className="text-[9px] text-slate-500 font-semibold uppercase">Errors</p>
              </div>
            </div>

            {/* Live log */}
            <div className="rounded-xl bg-slate-900 p-3 max-h-48 overflow-y-auto no-scrollbar">
              {syncLog.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">Waiting to start…</p>
              ) : (
                <div className="space-y-0.5">
                  {syncLog.map((entry, i) => (
                    <div key={i} className={`text-[11px] font-mono leading-relaxed flex gap-2 ${entry.type === 'error' ? 'text-rose-400' : entry.type === 'success' ? 'text-emerald-400' : 'text-slate-400'}`}>
                      <span className="text-slate-600 flex-shrink-0">{entry.time}</span>
                      <span className="truncate">{entry.msg}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Done button */}
            {!syncing && syncStep >= 3 && (
              <Button variant="default" className="w-full mt-4" onClick={() => setShowOverlay(false)}>
                Done
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── All Templates Modal ── */}
      {showAllTemplates && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" onClick={() => setShowAllTemplates(false)}>
          <div className="hub-glass rounded-3xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto animate-pop-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">All Synced Templates</h3>
                <p className="text-xs text-slate-500">{templates.length} templates from Mitti</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowAllTemplates(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
              {templates.map(t => (
                <div key={t.template_id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <FileStack className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.name || t.template_id}</p>
                    <p className="text-[10px] text-slate-400 truncate">{t.template_id}</p>
                  </div>
                  {t.modified_at && (
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{new Date(t.modified_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}