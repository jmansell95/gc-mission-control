import React from 'react';
import { Inbox } from 'lucide-react';
import { useInbox } from '@/hooks/useInbox';

// InboxBadge — shows a live count of pending inbox items. Used in the admin
// sidebar/top bar and the field shell. Renders just the bell + count; the
// parent decides where to navigate on click.
export default function InboxBadge({ onClick, className = '', size = 'md' }) {
  const { counts } = useInbox();
  const count = counts.total || 0;
  const urgent = counts.urgent || 0;
  const overdue = counts.overdue || 0;

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]';
  const badgeBg = overdue > 0 ? 'bg-rose-500' : urgent > 0 ? 'bg-amber-500' : 'bg-[#8DC63F]';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Inbox"
      className={`relative flex items-center justify-center text-white hover:bg-white/15 active:scale-95 rounded-lg transition flex-shrink-0 touch-manipulation select-none ${className}`}
    >
      <Inbox className={iconSize} />
      {count > 0 && (
        <span
          className={`absolute top-0.5 right-0.5 min-w-[15px] h-4 px-1 ${badgeBg} text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-1 ring-white/30`}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}