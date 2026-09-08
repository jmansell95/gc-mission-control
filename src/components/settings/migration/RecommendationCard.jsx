import React from 'react';
import { Award, Check, ArrowRight } from 'lucide-react';
import { RECOMMENDATION, fmtGBP } from '@/utils/powerapps/migrationCostData';

export default function RecommendationCard() {
  return (
    <div className="bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] rounded-xl shadow-lg overflow-hidden text-white">
      <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
        <Award className="w-5 h-5 text-[#8DC63F]" />
        <h3 className="font-bold text-sm">Recommendation</h3>
        <span className="ml-auto text-xs font-bold bg-[#8DC63F] text-[#1c4a12] px-3 py-1 rounded-full">
          {RECOMMENDATION.verdict}
        </span>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm text-white/90 leading-relaxed mb-4">{RECOMMENDATION.summary}</p>

        <div className="space-y-2">
          {RECOMMENDATION.factors.map((f) => (
            <div key={f.label} className="flex items-center gap-3 py-2 border-b border-white/10 last:border-0">
              <div className="w-32 sm:w-40 flex-shrink-0">
                <p className="text-xs font-semibold text-white/70">{f.label}</p>
              </div>
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-white/60">{f.base44}</span>
                <ArrowRight className="w-3 h-3 text-white/40" />
                <span className="text-xs font-medium text-white">{f.powerApps}</span>
              </div>
              <div className="flex-shrink-0">
                {f.favours === 'base44' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8DC63F]">
                    <Check className="w-3.5 h-3.5" /> Base44
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-300">
                    <Check className="w-3.5 h-3.5" /> Power Apps
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 py-3 bg-white/5 border-t border-white/10">
        <p className="text-xs text-white/60">
          Migration is technically feasible with full 1:1 parity, but the financial case doesn't justify it —
          the £330K build cost plus £16K/year higher recurring spend yields no functional gain.
          Revisit if Base44 pricing changes significantly or data-ownership requirements shift.
        </p>
      </div>
    </div>
  );
}