import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import EnterpriseHeader from '@/components/EnterpriseHeader';
import HubHeader from '@/components/hubs/HubHeader';

/**
 * EnterpriseHubShell — shared layout wrapper for the enterprise hub pages
 * (Operations, Financial, Compliance, Staff, Fleet). Uses the same HubHeader
 * (hub-glass) as the stream-level hubs so the entire office experience reads
 * as one product. The accent colour is applied to the icon tile gradient.
 */
export default function EnterpriseHubShell({ title, subtitle, icon: Icon, accent = '#2E5A1A', children }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen page-bg-vibrant">
      <EnterpriseHeader />

      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-7xl mx-auto safe-area-top">
        <HubHeader
          icon={Icon}
          title={title}
          subtitle={subtitle}
          eyebrow="Enterprise Hub"
          breadcrumbs={[{ label: 'Enterprise', to: '/enterprise' }]}
          actions={
            <button
              onClick={() => navigate('/enterprise')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-200 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          }
        />
      </div>

      {/* Body */}
      <div className="px-4 lg:px-6 py-5 lg:py-6 max-w-7xl mx-auto space-y-4">
        {children}
      </div>
    </div>
  );
}