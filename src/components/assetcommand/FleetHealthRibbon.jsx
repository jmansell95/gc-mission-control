import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, HelpCircle, Activity, Wrench } from 'lucide-react';

/**
 * Fleet Health Ribbon — persistent summary bar at the top of the Asset
 * Command Centre. Shows live compliance aggregates plus an overall fleet
 * health score so managers get an instant read on fleet status.
 */
export default function FleetHealthRibbon({ assets = [] }) {
  const total = assets.length;
  const active = assets.filter(a => a.is_active !== false).length;
  const compliant = assets.filter(a => a.compliance_status === 'compliant').length;
  const expiring = assets.filter(a => a.compliance_status === 'expiring').length;
  const expired = assets.filter(a => a.compliance_status === 'expired').length;
  const unknown = assets.filter(a => (a.compliance_status || 'unknown') === 'unknown').length;
  const rigs = assets.filter(a => a.asset_type === 'rig').length;

  // Fleet health score = weighted % of fleet in good standing.
  const score = total > 0
    ? Math.round((compliant * 1 + expiring * 0.6) / total * 100)
    : 0;
  const scoreTone = score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';

  const tiles = [
    { label: 'Total Fleet', value: total, sub: `${active} active`, grad: 'stat-gradient-slate', Icon: Wrench },
    { label: 'Compliant', value: compliant, sub: rigs ? `${rigs} rigs` : 'in date', grad: 'stat-gradient-emerald', Icon: ShieldCheck },
    { label: 'Expiring Soon', value: expiring, sub: '≤30 days', grad: 'stat-gradient-amber', Icon: ShieldAlert },
    { label: 'Expired', value: expired, sub: 'action needed', grad: 'stat-gradient-rose', Icon: ShieldX },
    { label: 'Unknown', value: unknown, sub: 'no data', grad: 'stat-gradient-slate', Icon: HelpCircle },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      {/* Fleet health score — spans 1, larger on desktop */}
      <div className="hub-glass rounded-xl p-3.5 flex items-center gap-3 col-span-2 md:col-span-1 lg:col-span-1">
        <div className="w-10 h-10 rounded-xl stat-gradient-brand flex items-center justify-center shadow-md icon-tile-glow flex-shrink-0">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className={`text-2xl font-bold leading-none tabular-nums ${scoreTone}`}>{score}%</p>
          <p className="text-xs text-slate-500 font-medium mt-1">Fleet Health</p>
        </div>
      </div>
      {tiles.map(t => {
        const SIcon = t.Icon;
        return (
          <div key={t.label} className="hub-glass rounded-xl p-3.5 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${t.grad} flex items-center justify-center shadow-md icon-tile-glow flex-shrink-0`}>
              <SIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{t.value}</p>
              <p className="text-xs text-slate-500 font-medium mt-1 truncate">{t.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}