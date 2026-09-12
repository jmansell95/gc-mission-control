import React from 'react';
import { Plug, ShieldAlert, ShieldCheck, Shield } from 'lucide-react';
import { INTEGRATION_RISKS, RISK_COUNTS } from '@/utils/powerapps/migrationCostData';

const riskConfig = {
  Low: { icon: ShieldCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Medium: { icon: Shield, cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  High: { icon: ShieldAlert, cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
};

export default function IntegrationRiskMap() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Plug className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-slate-900 text-sm">Integration Mapping & Risk</h3>
        <div className="ml-auto flex items-center gap-2">
          {['High', 'Medium', 'Low'].map(r => {
            const cfg = riskConfig[r];
            const Icon = cfg.icon;
            return (
              <span key={r} className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${cfg.cls}`}>
                <Icon className="w-3 h-3" /> {RISK_COUNTS[r] || 0} {r}
              </span>
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {INTEGRATION_RISKS.map((int) => {
          const cfg = riskConfig[int.risk];
          const Icon = cfg.icon;
          return (
            <div key={int.name} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50/50">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-800">{int.name}</p>
                  <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{int.connector}</span>
                  <span className="text-[10px] text-slate-400">· {int.auth}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{int.note}</p>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border flex-shrink-0 ${cfg.cls}`}>
                <Icon className="w-3 h-3" /> {int.risk}
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-3 bg-amber-50 border-t border-amber-100 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          <strong>{RISK_COUNTS.High || 0} high-risk integrations</strong> (KeyLogBook AGS parsing, HMRC CIS) require custom HMAC verification and government API approval — these are the most likely to cause migration delays.
        </p>
      </div>
    </div>
  );
}