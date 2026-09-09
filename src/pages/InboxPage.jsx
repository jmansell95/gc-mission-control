import React, { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Inbox, CheckCheck, AlertTriangle, Info, Search, Archive, Bell } from 'lucide-react';
import { useInbox } from '@/hooks/useInbox';
import InboxItemCard from '@/components/inbox/InboxItemCard';

// InboxPage — the universal inbox hub. Shows every pending item (approvals,
// alerts, notices) in one filterable list, plus an archive view of handled
// items. This is the single destination for "what needs me".
export default function InboxPage() {
  const { items, counts, isLoading, refetch } = useInbox();
  const [filter, setFilter] = useState('all'); // all | approval | alert | notice
  const [showArchive, setShowArchive] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = items;
    if (showArchive) {
      list = items.filter(i => i.status !== 'pending');
    } else {
      list = items.filter(i => i.status === 'pending');
    }
    if (filter !== 'all') list = list.filter(i => i.type === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.title?.toLowerCase().includes(q) ||
        i.body?.toLowerCase().includes(q) ||
        i.requester_name?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, filter, showArchive, search]);

  const tabs = [
    { key: 'all', label: 'All', count: counts.total, icon: Inbox },
    { key: 'approval', label: 'Approvals', count: counts.approvals, icon: CheckCheck },
    { key: 'alert', label: 'Alerts', count: counts.alerts, icon: AlertTriangle },
    { key: 'notice', label: 'Notices', count: counts.notices, icon: Info },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] page-bg-vibrant">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl command-gradient flex items-center justify-center shadow-lg glow-brand">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 leading-tight">My Inbox</h1>
                <p className="text-sm text-slate-500 mt-0.5">
                  {counts.total > 0
                    ? `${counts.total} item${counts.total !== 1 ? 's' : ''} need your attention`
                    : 'You\'re all caught up'}
                  {counts.overdue > 0 && <span className="text-rose-600 font-semibold"> · {counts.overdue} overdue</span>}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95"
          >
            <Inbox className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your inbox…"
            className="w-full pl-10 pr-4 py-2.5 hub-glass rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 mb-5 overflow-x-auto no-scrollbar">
          {tabs.map(tab => {
            const active = filter === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                  active
                    ? 'command-gradient text-white shadow-md'
                    : 'hub-glass text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setShowArchive(!showArchive)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ml-auto ${
              showArchive ? 'command-gradient text-white shadow-md' : 'hub-glass text-slate-600 hover:text-slate-900'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            {showArchive ? 'Show Pending' : 'Archive'}
          </button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="hub-glass rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCheck className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-slate-700 font-bold text-lg">
              {showArchive ? 'No archived items' : 'Inbox zero'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {showArchive
                ? 'Handled items will appear here.'
                : search || filter !== 'all'
                  ? 'No items match your filters.'
                  : 'Nothing needs your attention right now. New approvals and alerts will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filtered.map(item => (
                <InboxItemCard key={item.id} item={item} onActioned={refetch} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}