import React from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { BookOpen, ArrowUpRight } from 'lucide-react';

/**
 * HubHelpSheet — slide-over help panel for a hub. Merges static `topics`
 * (passed by the hub) with active HelpTopic records whose tags mention the
 * hubKey, so office staff can extend hub help without a code change.
 */
export default function HubHelpSheet({ open, onOpenChange, hubKey, title, topics = [] }) {
  const { data: dbTopics = [] } = useQuery({
    queryKey: ['hub-help-topics', hubKey],
    queryFn: async () => {
      const all = await base44.entities.HelpTopic.filter({ is_active: true }, 'order', 100);
      return all.filter(t => (t.tags || '').toLowerCase().split(',').map(s => s.trim()).includes(hubKey));
    },
    enabled: open && !!hubKey,
  });

  const merged = [...topics, ...dbTopics.map(t => ({ title: t.title, body: t.content, summary: t.summary }))];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#2E5A1A]" /> {title || 'How this hub works'}</SheetTitle>
          <SheetDescription>Quick guidance for this hub. The full guide has more.</SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-4">
          {merged.length === 0 && <p className="text-sm text-slate-500">No help topics yet for this hub.</p>}
          {merged.map((t, i) => (
            <article key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="text-sm font-bold text-slate-900 mb-1.5">{t.title}</h4>
              {t.summary && <p className="text-xs text-slate-500 mb-2">{t.summary}</p>}
              <div className="prose prose-sm prose-slate max-w-none text-[13px] leading-relaxed"><ReactMarkdown>{t.body || ''}</ReactMarkdown></div>
            </article>
          ))}
          <Link to="/help" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2E5A1A] hover:underline">
            Open the full Help Guide <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}