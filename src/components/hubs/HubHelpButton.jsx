import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import HubHelpSheet from '@/components/hubs/HubHelpSheet';

/**
 * HubHelpButton — the "?" affordance in every hub header. Opens the hub's
 * help sheet. Props: hubKey, title, topics [{ title, summary, body }]
 */
export default function HubHelpButton({ hubKey, title, topics }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Help for this hub"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 bg-white/80 text-slate-500 hover:text-[#2E5A1A] hover:border-[#2E5A1A]/30 hover:bg-[#2E5A1A]/5 text-ui-caption font-semibold transition active:scale-[0.97]"
      >
        <HelpCircle className="w-4 h-4" />
        <span className="hidden sm:inline">Help</span>
      </button>
      <HubHelpSheet open={open} onOpenChange={setOpen} hubKey={hubKey} title={title} topics={topics} />
    </>
  );
}