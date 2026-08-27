import React from 'react';
import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * AccessSelect — shared dropdown for the Access Levels tab.
 * Wraps the shadcn Select with consistent brand styling so every selector
 * (division, group, crew permission) looks and behaves identically.
 * Renders via a Radix portal, so it never gets clipped by constrained panes
 * and never closes unexpectedly from parent scroll/click handlers.
 *
 * The "clear / unassigned" option uses the sentinel value "__none", which is
 * translated back to an empty string via onChange so callers keep their
 * existing null/blank semantics.
 */
export default function AccessSelect({ value, onChange, placeholder, children, triggerClassName, disabled }) {
  return (
    <Select value={value || '__none'} onValueChange={(v) => onChange(v === '__none' ? '' : v)} disabled={disabled}>
      <SelectTrigger
        className={cn(
          'h-8 min-w-[120px] rounded-lg border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition data-[placeholder]:text-slate-400',
          triggerClassName
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-xl min-w-[12rem]">
        {children}
      </SelectContent>
    </Select>
  );
}