import React from 'react';
import { Info } from 'lucide-react';

/**
 * ConcurReminderBanner — persistent info banner reminding field staff
 * that in-app receipt capture does NOT replace the weekly SAP Concur
 * submission. Shown on the receipt capture step and the office
 * expense management view.
 */
export default function ConcurReminderBanner({ compact }) {
  return (
    <div className={`flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl ${compact ? 'px-3 py-2' : 'px-3.5 py-3'}`}>
      <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-blue-900 leading-relaxed">
        These receipts are logged for your timesheet.{' '}
        <strong>You still need to submit your weekly expense report on SAP Concur.</strong>
      </p>
    </div>
  );
}