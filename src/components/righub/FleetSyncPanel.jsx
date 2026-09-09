import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Database, UploadCloud } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

/**
 * Compact Asset Panda sync control for the Fleet Hub hero.
 * Shows how many assets are linked + last sync time, with a one-click Sync Now button.
 */
export default function FleetSyncPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);

  const { data: configs = [] } = useQuery({
    queryKey: ['asset-panda-config'],
    queryFn: () => base44.entities.AssetPandaConfig.filter({ key: 'global' }),
  });
  const config = configs[0];

  const { data: assets = [] } = useQuery({
    queryKey: ['site-assets'],
    queryFn: () => base44.entities.SiteAsset.list('-created_date', 500),
  });

  const pandaLinked = assets.filter(a => a.panda_asset_id).length;
  const localOnly = assets.filter(a => !a.panda_asset_id).length;
  const lastSync = config?.last_sync_at;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncAssetPanda', {});
      const data = res?.data || res;
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-panda-config'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-catalogue'] });
      toast({
        title: data?.success ? `Synced — ${data.created || 0} new, ${data.synced || 0} updated` : 'Sync complete',
        description: data?.summary || data?.error || data?.reason || 'Inventory refreshed from Asset Panda.',
        variant: data?.success ? 'default' : 'destructive',
      });
    } catch (err) {
      toast({ title: 'Sync failed', description: err?.response?.data?.error || err.message || 'Check your Asset Panda credentials.', variant: 'destructive' });
    }
    setSyncing(false);
  };

  const handlePushAll = async () => {
    setPushing(true);
    try {
      const res = await base44.functions.invoke('pushAllToAssetPanda', {});
      const data = res?.data || res;
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-panda-config'] });
      toast({
        title: data?.success ? `Pushed ${data.pushed || 0} assets (${data.created || 0} new, ${data.updated || 0} updated)` : 'Push complete',
        description: data?.failed ? `${data.failed} failed${data.errors ? ': ' + data.errors.join('; ') : ''}` : 'All local assets synced to Asset Panda.',
        variant: data?.success ? 'default' : 'destructive',
      });
    } catch (err) {
      toast({ title: 'Push failed', description: err?.response?.data?.error || err.message || 'Check your Asset Panda credentials.', variant: 'destructive' });
    }
    setPushing(false);
  };

  const ready = !!(config?.group_id && (config?.api_token || (config?.email && config?.password)));

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-1.5 flex-shrink-0 flex-wrap">
      <div className="flex items-center gap-2 text-slate-900 min-w-0">
        <Database className="w-4 h-4 flex-shrink-0 text-slate-500" />
        <div className="leading-tight min-w-0">
          <p className="text-xs font-semibold tabular-nums">{pandaLinked} linked</p>
          <p className="text-[10px] text-slate-500 truncate">{lastSync ? new Date(lastSync).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never synced'}</p>
        </div>
      </div>
      <button onClick={handleSync} disabled={syncing || !ready}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E5A1A] hover:bg-[#244715] text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 flex-shrink-0">
        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing…' : 'Sync Now'}
      </button>
      {localOnly > 0 && (
        <button onClick={handlePushAll} disabled={pushing || !ready}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 flex-shrink-0"
          title={`Push ${localOnly} local-only assets to Asset Panda`}>
          <UploadCloud className={`w-3.5 h-3.5 ${pushing ? 'animate-spin' : ''}`} />
          {pushing ? 'Pushing…' : `Push ${localOnly} → Panda`}
        </button>
      )}
    </div>
  );
}