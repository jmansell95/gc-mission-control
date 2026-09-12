import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldAlert, CheckCircle2, RefreshCw, Loader2, Zap } from 'lucide-react';

/**
 * MittiGate — wraps compliance hub tab content.
 *
 * When Mitti is NOT connected (no webhook secret or disabled):
 *   - Shows an amber "not connected" banner with a Configure button
 *   - Shows a "No data available" info card instead of the tab content
 *
 * When Mitti IS connected:
 *   - Shows a green "everything is working" banner with a Sync Now button
 *   - Renders the children (normal tab content)
 */
export default function MittiGate({ children, onConfigure, message }) {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['mitti-config'],
    queryFn: async () => {
      const list = await base44.entities.MittiConfig.filter({ key: 'global' });
      return list?.[0] || null;
    },
  });

  const isConnected = !!(config?.enabled && config?.webhook_secret);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await base44.functions.invoke('syncMitti');
      queryClient.invalidateQueries({ queryKey: ['safety-reports'] });
      queryClient.invalidateQueries({ queryKey: ['mitti-config'] });
    } catch (e) {
      // sync errors are non-fatal — the banner stays green
    }
    setSyncing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="space-y-4">
        {/* Amber not-connected banner */}
        <div className="hub-glass rounded-2xl p-4 flex items-start gap-3 bg-amber-50/60 border-amber-200">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">Mitti not connected</p>
            <p className="text-xs text-slate-600 mt-0.5">
              {message ||
                'Mitti sync is not connected. Once the integration is configured, data will appear here automatically.'}
            </p>
          </div>
          {onConfigure && (
            <button
              onClick={onConfigure}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition flex-shrink-0"
            >
              <Zap className="w-3.5 h-3.5" /> Configure
            </button>
          )}
        </div>

        {/* No data info card */}
        <div className="hub-glass rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1.5">No data available</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Mitti sync is not connected. Once the integration is configured, data will appear here automatically.
          </p>
        </div>
      </div>
    );
  }

  // Connected — green banner + normal content
  return (
    <div className="space-y-4">
      <div className="hub-glass rounded-2xl p-4 flex items-center gap-3 bg-emerald-50/60 border-emerald-200">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900">Everything is working</p>
          <p className="text-xs text-slate-600 mt-0.5">
            Audits, incidents and inspections are being synced from Mitti.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition flex-shrink-0 disabled:opacity-60"
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Sync Now
        </button>
      </div>
      {children}
    </div>
  );
}