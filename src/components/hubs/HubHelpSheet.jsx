import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { BookOpen, ArrowUpRight, Search, X } from 'lucide-react';

/**
 * HubHelpSheet — slide-over help panel for a hub. Merges static `topics`
 * (passed by the hub) with active HelpTopic records whose tags mention the
 * hubKey, so office staff can extend hub help without a code change.
 * Includes a keyword search box that filters topics in real time.
 */
export default function HubHelpSheet({ open, onOpenChange, hubKey, title, topics = [] }) {
  const [search, setSearch] = useState('');

  const { data: dbTopics = [] } = useQuery({
    queryKey: ['hub-help-topics', hubKey],
    queryFn: async () => {
      const all = await base44.entities.HelpTopic.filter({ is_active: true }, 'order', 100);
      return all.filter(t => (t.tags || '').toLowerCase().split(',').map(s => s.trim()).includes(hubKey));
    },
    enabled: open && !!hubKey,
  });

  const merged = useMemo(
    () => [...topics, ...dbTopics.map(t => ({ title: t.title, body: t.content, summary: t.summary }))],
    [topics, dbTopics]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter(t => {
      const hay = `${t.title || ''} ${t.summary || ''} ${t.body || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [merged, search]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-[#2E5A1A]" /> {title || 'How this hub works'}</SheetTitle>
          <SheetDescription>Quick guidance for this hub. Search or browse the topics below.</SheetDescription>
        </SheetHeader>

        {/* Sticky search bar */}
        <div className="sticky top-0 z-10 -mx-6 px-6 py-3 bg-white/95 backdrop-blur-sm border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search help topics…"
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/10 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-sm font-semibold text-slate-500">{search ? 'No topics match your search' : 'No help topics yet for this hub.'}</p>
              {search && <p className="text-xs text-slate-400 mt-1">Try a different keyword or clear the search.</p>}
            </div>
          )}
          {filtered.map((t, i) => (
            <article key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h4 className="text-base font-bold text-slate-900 mb-1.5">{t.title}</h4>
              {t.summary && <p className="text-sm text-slate-500 mb-3">{t.summary}</p>}
              <div className="prose prose-sm prose-slate max-w-none text-[14px] leading-relaxed"><ReactMarkdown>{t.body || ''}</ReactMarkdown></div>
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