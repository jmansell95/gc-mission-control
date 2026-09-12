import React from 'react';
import { PoundSterling, Database, AlertTriangle } from 'lucide-react';
import { getLogBillingStatus } from '@/utils/logBillingStatus';

const ICON_MAP = {
  PoundSign: PoundSterling,
  Database,
  AlertTriangle,
};

/**
 * BillingBadge — small pill showing whether a log is billable, a data
 * point, or unmatched. Used in SiteLogDayCard and InvestigationBoreholeDetail
 * so managers can see at a glance what generates revenue and what's being missed.
 */
export default function BillingBadge({ log, size = 'sm' }) {
  const status = getLogBillingStatus(log);
  const Icon = ICON_MAP[status.icon] || Database;
  const sizeClasses = size === 'xs'
    ? 'text-[9px] px-1.5 py-0.5 gap-0.5'
    : 'text-[10px] px-1.5 py-0.5 gap-1';
  const iconSize = size === 'xs' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <span className={`inline-flex items-center ${sizeClasses} rounded-full font-medium ${status.badge} flex-shrink-0`}>
      <Icon className={iconSize} />
      {status.label}
    </span>
  );
}