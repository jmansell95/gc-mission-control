import React, { useState } from 'react';
import { SECURITY_RISKS, RISK_CATEGORIES, STATUS_CONFIG } from '@/lib/securityRiskMatrix';
import { ShieldCheck, AlertTriangle, AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';

const STATUS_ICON = {
  mitigated: CheckCircle2,
  partial: AlertTriangle,
  action: AlertCircle,
};

export default function RiskMitigationTab() {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedRisk, setExpandedRisk] = useState(null);

  const stats = {
    total: SECURITY_RISKS.length,
    mitigated: SECURITY_RISKS.filter(r => r.status === 'mitigated').length,
    partial: SECURITY_RISKS.filter(r => r.status === 'partial').length,
    action: SECURITY_RISKS.filter(r => r.status === 'action').length,
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="hub-glass rounded-xl p-3">
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.total}</p>
          <p className="text-xs text-slate-500 font-medium">Total Risks</p>
        </div>
        <div className="hub-glass rounded-xl p-3">
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">{stats.mitigated}</p>
          <p className="text-xs text-slate-500 font-medium">Mitigated</p>
        </div>
        <div className="hub-glass rounded-xl p-3">
          <p className="text-2xl font-bold text-amber-600 tabular-nums">{stats.partial}</p>
          <p className="text-xs text-slate-500 font-medium">Partially Mitigated</p>
        </div>
        <div className="hub-glass rounded-xl p-3">
          <p className="text-2xl font-bold text-rose-600 tabular-nums">{stats.action}</p>
          <p className="text-xs text-slate-500 font-medium">Action Required</p>
        </div>
      </div>

      {/* Risk categories */}
      {RISK_CATEGORIES.map(category => {
        const risks = SECURITY_RISKS.filter(r => r.category === category);
        if (risks.length === 0) return null;
        const isExpanded = expandedCategory === category || expandedCategory === null;

        return (
          <div key={category} className="hub-glass rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedCategory(isExpanded === true && expandedCategory !== null ? null : category)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50/50 transition"
            >
              <div className="flex items-center gap-2.5">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                <h3 className="font-bold text-sm text-slate-900">{category}</h3>
                <span className="text-xs text-slate-400">({risks.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                {risks.map(r => {
                  const cfg = STATUS_CONFIG[r.status];
                  return <span key={r.id} className={`w-2 h-2 rounded-full ${cfg.dot}`} />;
                })}
              </div>
            </button>

            {isExpanded && (
              <div className="divide-y divide-slate-100">
                {risks.map(risk => {
                  const cfg = STATUS_CONFIG[risk.status];
                  const Icon = STATUS_ICON[risk.status];
                  const isRiskExpanded = expandedRisk === risk.id;

                  return (
                    <div key={risk.id} className="p-4">
                      <button
                        type="button"
                        onClick={() => setExpandedRisk(isRiskExpanded ? null : risk.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.border} border`}>
                            <Icon className={`w-4 h-4 ${cfg.text}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-bold text-slate-400">#{risk.id}</span>
                              <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed">{risk.risk}</p>
                          </div>
                          {isRiskExpanded ? <ChevronDown className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />}
                        </div>
                      </button>

                      {isRiskExpanded && (
                        <div className="mt-3 ml-9 space-y-2.5 animate-slide-up">
                          <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-1">Mitigation</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{risk.mitigation}</p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Controls in place</p>
                            <div className="flex flex-wrap gap-1.5">
                              {risk.controls.map((c, i) => (
                                <span key={i} className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium">
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}