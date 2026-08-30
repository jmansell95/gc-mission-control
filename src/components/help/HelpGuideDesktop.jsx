import React from 'react';
import { Search, Download, ChevronRight, BookOpen, X, ArrowLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Skeleton, EmptyState } from '@/components/StateViews';

const categoryConfig = {
  delivery: { label: 'Deliveries', icon: '🚚', color: 'text-[#2E5A1A]', bg: 'bg-[#2E5A1A]/10', dot: 'bg-[#2E5A1A]' },
  logistics: { label: 'Logistics & Equipment', icon: '📦', color: 'text-teal-600', bg: 'bg-teal-50', dot: 'bg-teal-500' },
  compliance: { label: 'Compliance', icon: '🛡️', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  safety: { label: 'Safety', icon: '⚠️', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500' },
  general: { label: 'General', icon: 'ℹ️', color: 'text-slate-600', bg: 'bg-slate-50', dot: 'bg-slate-400' },
  app_usage: { label: 'Using the App', icon: '❓', color: 'text-purple-600', bg: 'bg-purple-50', dot: 'bg-purple-500' },
  financial: { label: 'Financial', icon: '💷', color: 'text-emerald-700', bg: 'bg-emerald-50', dot: 'bg-emerald-600' },
  enterprise: { label: 'Enterprise', icon: '🏢', color: 'text-indigo-600', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
};

export default function HelpGuideDesktop({
  topics, isLoading, search, setSearch, activeCategory, setActiveCategory,
  selectedTopic, setSelectedTopic, filtered, groupedByCategory, handleExportPDF, onBack,
}) {
  const categories = Object.keys(groupedByCategory);

  return (
    <div className="hidden xl:flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left sidebar — categories + search */}
      <aside className="w-80 flex-shrink-0 border-r border-slate-200 bg-white/60 backdrop-blur-sm flex flex-col">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5 mb-4">
            {onBack && (
              <button onClick={onBack} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Help & Guides</h1>
              <p className="text-[11px] text-slate-500 leading-tight">{topics.length} articles</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search articles…"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30 focus:border-[#2E5A1A]/30"
            />
          </div>
        </div>

        <div className="px-3 pb-3 flex-1 overflow-y-auto">
          <button
            onClick={() => { setActiveCategory('all'); setSelectedTopic(null); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition mb-1 ${activeCategory === 'all' ? 'bg-[#2E5A1A] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <span className="flex items-center gap-2.5">
              <span className="text-base">📚</span> All Articles
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeCategory === 'all' ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{topics.length}</span>
          </button>
          {Object.entries(categoryConfig).map(([key, cfg]) => {
            const count = topics.filter(t => t.category === key).length;
            if (count === 0) return null;
            const active = activeCategory === key;
            return (
              <button
                key={key}
                onClick={() => { setActiveCategory(key); setSelectedTopic(null); }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition mb-1 ${active ? 'bg-[#2E5A1A] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="text-base">{cfg.icon}</span> {cfg.label}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-slate-200">
          <button onClick={handleExportPDF} type="button"
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white text-[#2E5A1A] ring-1 ring-slate-200 text-sm font-semibold hover:bg-slate-50 transition">
            <Download className="w-4 h-4" /> Print All Guides
          </button>
        </div>
      </aside>

      {/* Right content — topic list or selected topic */}
      <div className="flex-1 overflow-y-auto bg-slate-50/40">
        {selectedTopic ? (
          <div className="max-w-3xl mx-auto px-8 py-6">
            <button
              onClick={() => setSelectedTopic(null)}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#2E5A1A] transition mb-4"
            >
              <ChevronRight className="w-4 h-4 rotate-180" /> Back to articles
            </button>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-7 pt-6 pb-4 border-b border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-[#2E5A1A] uppercase tracking-wide">
                      {categoryConfig[selectedTopic.category]?.label || selectedTopic.category}
                    </span>
                    <h1 className="text-2xl font-bold text-slate-900 mt-1 leading-tight">{selectedTopic.title}</h1>
                  </div>
                  <button onClick={() => setSelectedTopic(null)} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition flex-shrink-0">
                    <X className="w-4 h-4 text-slate-500" />
                  </button>
                </div>
                {selectedTopic.summary && <p className="text-sm text-slate-500 mt-3 leading-relaxed">{selectedTopic.summary}</p>}
                {selectedTopic.updated_date && <p className="text-[11px] text-slate-400 mt-3">Last updated {new Date(selectedTopic.updated_date).toLocaleDateString('en-GB')}</p>}
              </div>
              <div className="px-7 py-6">
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
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-8 py-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">
                {activeCategory === 'all' ? 'All Articles' : categoryConfig[activeCategory]?.label || 'Articles'}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">{filtered.length} {filtered.length === 1 ? 'article' : 'articles'} {search && `matching "${search}"`}</p>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200">
                <EmptyState icon={Search} title={search ? "No results found" : "No help topics yet"} message={search ? "Try a different search term." : "Help articles will appear here once published."} />
              </div>
            ) : (
              <div className="space-y-6">
                {categories.map(catKey => {
                  const cfg = categoryConfig[catKey] || categoryConfig.general;
                  return (
                    <div key={catKey}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-base">{cfg.icon}</span>
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">{cfg.label}</h3>
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-xs text-slate-400 font-medium">{groupedByCategory[catKey].length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {groupedByCategory[catKey].map(topic => (
                          <button
                            key={topic.id}
                            onClick={() => setSelectedTopic(topic)}
                            className="w-full text-left bg-white rounded-xl border border-slate-200 p-3.5 hover:border-[#2E5A1A]/30 hover:shadow-md hover:bg-[#2E5A1A]/5 transition group flex items-center gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <h4 className="font-semibold text-slate-900 text-sm group-hover:text-[#2E5A1A] transition">{topic.title}</h4>
                              {topic.summary && <p className="text-xs text-slate-500 mt-1 line-clamp-1 leading-relaxed">{topic.summary}</p>}
                            </div>
                            <div className="w-7 h-7 rounded-lg bg-slate-50 group-hover:bg-[#2E5A1A]/15 flex items-center justify-center flex-shrink-0 transition">
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2E5A1A] transition" />
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
        )}
      </div>
    </div>
  );
}