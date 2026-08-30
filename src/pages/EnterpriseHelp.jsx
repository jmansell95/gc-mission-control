import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, HelpCircle, Search, FileText, X, Download,
} from 'lucide-react';
import EnterpriseHeader from '@/components/EnterpriseHeader';
import { useDivision } from '@/contexts/DivisionContext';

// Enterprise-only help categories — excludes division-specific topics
// (delivery, compliance, safety, logistics) which belong to division contexts.
const ENTERPRISE_CATEGORIES = ['enterprise', 'general', 'app_usage', 'financial'];

const CATEGORY_LABELS = {
  enterprise: 'Enterprise',
  general: 'General',
  app_usage: 'Using the Platform',
  financial: 'Financial',
};

export default function EnterpriseHelp() {
  const navigate = useNavigate();
  const { setActiveDivision } = useDivision();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState(null);

  // Clear division context — this is an enterprise-level page.
  useEffect(() => { setActiveDivision(null); }, [setActiveDivision]);

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['enterprise-help-topics'],
    queryFn: async () => {
      const list = await base44.entities.HelpTopic.filter({ is_active: true });
      // Filter to enterprise-level categories only
      return list
        .filter(t => ENTERPRISE_CATEGORIES.includes(t.category))
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    },
  });

  const filtered = useMemo(() => {
    let result = topics;
    if (activeCategory !== 'all') {
      result = result.filter(t => t.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.summary?.toLowerCase().includes(q) ||
        t.content?.toLowerCase().includes(q) ||
        t.tags?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [topics, activeCategory, search]);

  const groupedByCategory = useMemo(() => {
    const groups = {};
    filtered.forEach(t => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [filtered]);

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const html = `
      <html>
      <head>
        <title>Enterprise Help Guides</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
          h1 { color: #2E5A1A; border-bottom: 2px solid #d1fae5; padding-bottom: 10px; }
          h2 { color: #2E5A1A; margin-top: 32px; }
          .topic { margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; page-break-inside: avoid; }
          .category-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; }
          .summary { color: #475569; font-style: italic; margin: 4px 0 12px; }
          p { line-height: 1.6; }
          ul, ol { line-height: 1.6; }
          code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
        </style>
      </head>
      <body>
        <h1>Enterprise Help Guides</h1>
        <p>Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        ${filtered.map(t => `
          <div class="topic">
            <p class="category-label">${CATEGORY_LABELS[t.category] || t.category}</p>
            <h2>${t.title}</h2>
            ${t.summary ? `<p class="summary">${t.summary}</p>` : ''}
            <div>${(t.content || '').replace(/\n/g, '<br>')}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div className="min-h-screen page-bg-vibrant">
      <EnterpriseHeader />
      {/* Desktop top bar — visible only on lg+ since EnterpriseHeader is mobile-only */}
      <div className="hidden lg:block sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/70">
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/enterprise')} type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-100 transition">
              <ArrowLeft className="w-4 h-4" /> Enterprise
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-bold text-slate-900">Help Guides</span>
          </div>
        </div>
      </div>
      <div className="px-4 pt-5 pb-24 lg:pt-8 lg:px-8 lg:pb-10 space-y-5 max-w-5xl mx-auto">
        {/* Back link + title */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate(-1)} type="button"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition shadow-sm active:scale-95 touch-manipulation">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-lg glow-brand">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-none truncate">
                Enterprise Help
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-0.5">Platform guides — no division content</p>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search help guides…"
            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-base focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/20 transition"
          />
          {search && (
            <button onClick={() => setSearch('')} type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-slate-100 transition">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Category filter + export */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveCategory('all')}
            type="button"
            className={'px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition flex-shrink-0 '
              + (activeCategory === 'all'
                ? 'bg-[#2E5A1A] text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}
          >
            All
          </button>
          {ENTERPRISE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              type="button"
              className={'px-3.5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition flex-shrink-0 '
                + (activeCategory === cat
                  ? 'bg-[#2E5A1A] text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
          <button onClick={handleExportPDF} type="button"
            className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition flex-shrink-0">
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>

        {/* Topics */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="insight-card rounded-2xl p-8 text-center">
            <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">No guides found</p>
            <p className="text-xs text-slate-400 mt-1">Try a different search or category.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(groupedByCategory).map(([cat, items]) => (
              <div key={cat}>
                <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide mb-2.5 px-1">
                  {CATEGORY_LABELS[cat] || cat}
                </h2>
                <div className="grid grid-cols-1 gap-2.5">
                  {items.map(topic => (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopic(topic)}
                      type="button"
                      className="insight-card rounded-2xl p-4 text-left group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#2E5A1A] transition">{topic.title}</h3>
                          {topic.summary && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{topic.summary}</p>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Topic detail modal */}
      {selectedTopic && (
        <div className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelectedTopic(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0 shadow-sm">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 truncate">{selectedTopic.title}</h3>
              </div>
              <button onClick={() => setSelectedTopic(null)} type="button"
                className="p-1.5 rounded-lg hover:bg-slate-100 transition flex-shrink-0">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="px-5 py-5">
              {selectedTopic.summary && (
                <p className="text-sm text-slate-500 italic mb-4 pb-4 border-b border-slate-100">{selectedTopic.summary}</p>
              )}
              {selectedTopic.updated_date && (
                <p className="text-[11px] text-slate-400 mb-4">Last updated {new Date(selectedTopic.updated_date).toLocaleDateString('en-GB')}</p>
              )}
              <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">{selectedTopic.content}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}