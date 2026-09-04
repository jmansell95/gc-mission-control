import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import HelpGuideDesktop from '@/components/help/HelpGuideDesktop';
import HelpGuideMobile from '@/components/help/HelpGuideMobile';

/**
 * Help Guide — split by audience.
 *
 * audience="office" → Office Staff Help Guide (/help) — admin hubs, billing,
 *   compliance, reports, settings, permissions, rig earnings, AFP.
 * audience="field"  → Field Crew Help Guide (/help-field) — schedule, scanner,
 *   deliveries, shift wizard, safety forms, profile, SSO login.
 *
 * Topics are filtered by their `audience` field: a topic shows in a guide when
 * its audience is 'both', matches the requested audience, or is unset (legacy
 * topics default to both).
 */
export default function HelpGuide({ audience = 'office' }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState(null);

  const isField = audience === 'field';
  const guideTitle = isField ? 'Field Crew Help & Guides' : 'Office Staff Help & Guides';

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['help-topics', audience],
    queryFn: async () => {
      const list = await base44.entities.HelpTopic.filter({ is_active: true });
      const filtered = list.filter(
        (t) => !t.audience || t.audience === 'both' || t.audience === audience
      );
      return filtered.sort((a, b) => (a.order || 0) - (b.order || 0));
    },
  });

  const filtered = useMemo(() => {
    let result = topics;
    if (activeCategory !== 'all') {
      result = result.filter((t) => t.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
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
    filtered.forEach((t) => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [filtered]);

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const categoryLabels = {
      delivery: 'Deliveries', logistics: 'Logistics & Equipment', compliance: 'Compliance',
      safety: 'Safety', general: 'General', app_usage: 'Using the App', financial: 'Financial',
    };

    const html = `
      <html>
      <head>
        <title>GC Mission Control — ${guideTitle}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
          h1 { color: #2E5A1A; border-bottom: 2px solid #d1fae5; padding-bottom: 10px; }
          h2 { color: #2E5A1A; margin-top: 32px; }
          h3 { color: #2E5A1A; }
          .topic { margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; page-break-inside: avoid; }
          .category-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; }
          .summary { color: #475569; font-style: italic; margin: 4px 0 12px; }
          p { line-height: 1.6; }
          ul, ol { line-height: 1.6; }
          code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>GC Mission Control — ${guideTitle}</h1>
        <p>Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        ${filtered.map((t) => `
          <div class="topic">
            <p class="category-label">${categoryLabels[t.category] || t.category}</p>
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

  const sharedProps = {
    topics, isLoading, search, setSearch, activeCategory, setActiveCategory,
    selectedTopic, setSelectedTopic, filtered, groupedByCategory, handleExportPDF,
    guideTitle,
  };

  return (
    <>
      <HelpGuideDesktop {...sharedProps} onBack={() => navigate(-1)} />
      <HelpGuideMobile {...sharedProps} onBack={() => navigate(-1)} />
    </>
  );
}