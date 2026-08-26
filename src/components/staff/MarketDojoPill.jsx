import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

/**
 * MarketDojoPill — compact onboarding status badge for subcontractors and
 * agency workers. Green pill with a tick when onboarded in Market Dojo,
 * red pill with a cross when not. Only shown for subbies/agency (not
 * clients or suppliers).
 */
export default function MarketDojoPill({ onboarded, size = 'sm' }) {
  const ok = !!onboarded;
  const cls = ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white';
  const Icon = ok ? CheckCircle2 : XCircle;
  const sizing =
    size === 'xs'
      ? 'text-[9px] px-1.5 py-0.5 gap-0.5'
      : 'text-[10px] px-2 py-0.5 gap-1';
  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <span className={`inline-flex items-center rounded-full font-bold whitespace-nowrap ${cls} ${sizing}`}>
      <Icon className={iconSize} />
      {ok ? 'Market Dojo' : 'Not onboarded'}
    </span>
  );
}