import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, RefreshCw, UploadCloud } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import AssetPandaCredentials from '@/components/assetpanda/AssetPandaCredentials';
import AssetPandaGroups from '@/components/assetpanda/AssetPandaGroups';
import AssetPandaFieldMapper from '@/components/assetpanda/AssetPandaFieldMapper';
import AssetPandaLinkReview from '@/components/assetpanda/AssetPandaLinkReview';
import AssetPandaWebhookSection from '@/components/assetpanda/AssetPandaWebhookSection';
import AssetPandaSyncStatus from '@/components/assetpanda/AssetPandaSyncStatus';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useDivision } from '@/contexts/DivisionContext';

export default function AssetPandaSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    api_token: '', email: '', password: '',
    base_url: 'https://api.assetpanda.com', group_id: '',
    groups: [],
    field_name: '', field_serial: '', field_daily_rate: '', field_stock_status: '', field_asset_type: '',
    field_map: [], webhook_secret: '',
    auto_deactivate: true,
  });

  const { activeDivisionId } = useDivision();
  const { data: config } = useQuery({
    queryKey: ['asset-panda-config', activeDivisionId || 'global'],
    queryFn: async () => {
      if (activeDivisionId) {
        const scoped = await base44.entities.AssetPandaConfig.filter({ key: 'global', division_id: activeDivisionId });
        if (scoped.length) return scoped[0];
      }
      const globalRecs = await base44.entities.AssetPandaConfig.filter({ key: 'global', division_id: null });
      if (globalRecs.length) return globalRecs[0];
      const any = await base44.entities.AssetPandaConfig.filter({ key: 'global' });
      return any[0] || null;
    },
  });

  useEffect(() => {
    if (config) {
      setForm({
        api_token: config.api_token || '',
        email: config.email || '',
        password: config.password || '',
        base_url: config.base_url || 'https://api.assetpanda.com',
        group_id: config.group_id || '',
        groups: config.groups || [],
        field_name: config.field_name || '',
        field_serial: config.field_serial || '',
        field_daily_rate: config.field_daily_rate || '',
        field_stock_status: config.field_stock_status || '',
        field_asset_type: config.field_asset_type || '',
        field_map: config.field_map || [],
        webhook_secret: config.webhook_secret || '',
        auto_deactivate: config.auto_deactivate !== false,
      });
    }
  }, [config]);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['site-assets-panda'],
    queryFn: () => base44.entities.SiteAsset.list(),
  });

  const lastSync = config?.last_sync_at || assets
    .map(a => a.last_sync_timestamp)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { key: 'global', division_id: activeDivisionId || null, ...form };
      if (config?.id) {
        await base44.entities.AssetPandaConfig.update(config.id, payload);
      } else {
        await base44.entities.AssetPandaConfig.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['asset-panda-config'] });
      toast({ title: 'Settings saved', description: 'Your Asset Panda credentials have been stored.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Could not save', description: err.message || 'Please try again.', variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('syncAssetPanda', { division_id: activeDivisionId });
      const data = res?.data || res;
      queryClient.invalidateQueries({ queryKey: ['site-assets-panda'] });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-panda-config'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-catalogue'] });
      toast({
        title: data?.success ? `Synced — ${data.created || 0} new, ${data.synced || 0} updated` : 'Sync complete',
        description: data?.summary || data?.error || 'Inventory refreshed from Asset Panda.',
        variant: data?.success ? 'default' : 'destructive',
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Sync failed',
        description: err?.response?.data?.error || err.message || 'Check your credentials and group ID, then try again.',
        variant: 'destructive',
      });
    }
    setSyncing(false);
  };

  // Sync works with just credentials — groups are auto-discovered when none configured
  const ready = !!(form.api_token || (form.email && form.password));

  const handlePushAll = async () => {
    setPushing(true);
    try {
      const res = await base44.functions.invoke('pushAllToAssetPanda', { division_id: activeDivisionId });
      const data = res?.data || res;
      queryClient.invalidateQueries({ queryKey: ['site-assets-panda'] });
      queryClient.invalidateQueries({ queryKey: ['site-assets'] });
      toast({
        title: data?.success ? `Pushed ${data.pushed || 0} assets` : 'Push failed',
        description: data?.success
          ? `${data.created || 0} created, ${data.updated || 0} updated${data.failed ? `, ${data.failed} failed` : ''}`
          : data?.error || 'Push did not complete.',
        variant: data?.success ? 'default' : 'destructive',
      });
    } catch (err) {
      toast({ title: 'Push failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    }
    setPushing(false);
  };

  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        icon={Database}
        title="Asset Panda Sync"
        description="Live inventory, stock levels & billing rates from Asset Panda"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={handlePushAll} disabled={pushing || isLoading || !(form.api_token || (form.email && form.password))}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition text-sm font-semibold disabled:opacity-50 border border-slate-300 text-slate-700 hover:bg-slate-50">
              <UploadCloud className={`w-4 h-4 ${pushing ? 'animate-spin' : ''}`} />
              {pushing ? 'Pushing…' : 'Push All'}
            </button>
            <button onClick={handleSync} disabled={syncing || isLoading || !ready}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-sm font-semibold disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>
        }
      />

      <AssetPandaCredentials form={form} setForm={setForm} config={config} onSave={handleSave} saving={saving} />
      <AssetPandaGroups form={form} setForm={setForm} config={config} onSave={handleSave} saving={saving} />
      <AssetPandaFieldMapper form={form} setForm={setForm} config={config} onSave={handleSave} saving={saving} />
      <AssetPandaLinkReview />
      <AssetPandaWebhookSection form={form} setForm={setForm} config={config} onSave={handleSave} saving={saving} />
      <AssetPandaSyncStatus assets={assets} config={config} isLoading={isLoading} lastSync={lastSync} />
    </div>
  );
}