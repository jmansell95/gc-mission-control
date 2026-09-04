import React from 'react';
import { Search, Download, ChevronRight, ArrowLeft, BookOpen, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Skeleton, EmptyState } from '@/components/StateViews';

const categoryConfig = {
  delivery: { label: 'Deliveries', icon: '🚚', color: 'text-[#2E5A1A]', bg: 'bg-[#2E5A1A]/10', dot: 'bg-[#2E5A1A]' },
  logistics: { label: 'Logistics', icon: '📦', color: 'text-teal-600', bg: 'bg-teal-50', dot: 'bg-teal-500' },
  compliance: { label: 'Compliance', icon: '🛡️', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  safety: { label: 'Safety', icon: '⚠️', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  general: { label: 'General', icon: 'ℹ️', color: 'text-slate-600', bg: 'bg-slate-50', dot: 'bg-slate-400' },
  app_usage: { label: 'Using the App', icon: '❓', color: 'text-purple-600', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  financial: { label: 'Financial', icon: '💷', color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-600' },
  enterprise: { label: 'Enterprise', icon: '🏢', color: 'text-indigo-600', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
};

export default function HelpGuideMobile({
  topics, isLoading, search, setSearch, activeCategory, setActiveCategory,
  selectedTopic, setSelectedTopic, filtered, groupedByCategory, handleExportPDF, onBack,
  guideTitle,
}) {
  const categories = Object.keys(groupedByCategory);

  return (
    <div className="xl:hidden min-h-screen page-bg-vibrant">
      {/* Mobile header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200 safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <button onClick={onBack} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-bold text-slate-900">{guideTitle || 'Help & Guides'}</h1>
            </div>
          </div>
          <button onClick={handleExportPDF} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0">
            <Download className="w-4 h-4 text-slate-600" />
          </button>
        </div>
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search help topics…"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30"
            />
          </div>
        </div>
        {/* Category pills — horizontal scroll */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition ${activeCategory === 'all' ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            All ({topics.length})
          </button>
          {Object.entries(categoryConfig).map(([key, cfg]) => {
            const count = topics.filter(t => t.category === key).length;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition ${activeCategory === key ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200'}`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 pb-24" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200">
            <EmptyState icon={Search} title={search ? "No results found" : "No help topics yet"} message={search ? "Try a different search term." : "Help articles will appear here once published."} />
          </div>
        ) : (
          <div className="space-y-5">
            {categories.map(catKey => {
              const cfg = categoryConfig[catKey] || categoryConfig.general;
              return (
                <div key={catKey}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-base">{cfg.icon}</span>
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">{cfg.label}</h2>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="space-y-2">
                    {groupedByCategory[catKey].map(topic => (
                      <button
                        key={topic.id}
                        onClick={() => setSelectedTopic(topic)}
                        className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-[#2E5A1A]/30 active:scale-[0.99] transition group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-900 text-sm group-hover:text-[#2E5A1A] transition">{topic.title}</h3>
                            {topic.summary && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{topic.summary}</p>}
                          </div>
                          <div className="w-7 h-7 rounded-lg bg-slate-50 group-hover:bg-[#2E5A1A]/15 flex items-center justify-center flex-shrink-0 transition">
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2E5A1A] transition" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-screen topic view */}
      <AnimatePresence>
        {selectedTopic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white overflow-y-auto overscroll-contain"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between z-10 safe-area-top">
                <button onClick={() => setSelectedTopic(null)} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#2E5A1A] transition">
                  <ArrowLeft className="w-5 h-5" /> All Guides
                </button>
                <button onClick={() => setSelectedTopic(null)} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0">
                  <X className="w-4 h-4 text-slate-500" />
                </button>
              </div>
              <div className="px-4 py-5 pb-24" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}>
                <span className="text-[11px] font-semibold text-[#2E5A1A] uppercase tracking-wide">
                  {categoryConfig[selectedTopic.category]?.label || selectedTopic.category}
                </span>
                <h1 className="text-xl font-bold text-slate-900 mt-1 leading-tight">{selectedTopic.title}</h1>
                {selectedTopic.summary && <p className="text-sm text-slate-500 mt-2 leading-relaxed">{selectedTopic.summary}</p>}
                {selectedTopic.updated_date && <p className="text-[11px] text-slate-400 mt-2">Last updated {new Date(selectedTopic.updated_date).toLocaleDateString('en-GB')}</p>}
                <div className="mt-5 pt-5 border-t border-slate-100">
                  <ReactMarkdown
                    components={{
                      h2: ({ children }) => <h2 className="text-lg font-bold text-slate-900 mt-6 mb-2.5 pb-1.5 border-b border-slate-100">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-semibold text-slate-800 mt-4 mb-2">{children}</h3>,
                      p: ({ children }) => <p className="text-sm text-slate-600 leading-relaxed mb-3.5">{children}</p>,
                      li: ({ children }) => <li className="text-sm text-slate-600 leading-relaxed mb-1.5 ml-1">{children}</li>,
                      ul: ({ children }) => <ul className="list-disc list-outside space-y-1 mb-4 ml-4 text-slate-600 marker:text-[#8DC63F] marker:text-xs">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-outside space-y-1 mb-4 ml-4 text-slate-600 marker:text-[#2E5A1A] marker:font-semibold">{children}</ol>,
                      strong: ({ children }) => <strong className="font-semibold text-slate-800 bg-[#2E5A1A]/10 px-1 rounded">{children}</strong>,
                      a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-[#2E5A1A] font-medium underline decoration-[#2E5A1A]/40 underline-offset-2 hover:text-[#2E5A1A]">{children}</a>,
                      code: ({ children }) => <code className="text-xs font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md border border-slate-200">{children}</code>,
                      blockquote: ({ children }) => <blockquote className="border-l-3 border-[#2E5A1A]/30 pl-4 my-4 text-sm text-slate-500 italic bg-[#2E5A1A]/10 py-2.5 pr-3 rounded-r-lg">{children}</blockquote>,
                    }}
                  >
                    {selectedTopic.content || ''}
                  </ReactMarkdown>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}