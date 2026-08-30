import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import EnterpriseHeader from '@/components/EnterpriseHeader';

/**
 * EnterpriseHubShell — shared layout wrapper for the enterprise hub pages
 * (Operations, Financial, Compliance). Provides the mobile-first header
 * with back button, page title, icon, and accent colour, plus the max-width
 * body container with consistent spacing.
 */
export default function EnterpriseHubShell({ title, subtitle, icon: Icon, accent = '#2E5A1A', children }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen page-bg-vibrant">
      <EnterpriseHeader />

      {/* Hero header */}
      <div className="relative">
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}dd)` }} />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
        <div className="relative px-4 lg:px-6 pt-4 lg:pt-6 pb-5 lg:pb-6 safe-area-top">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => navigate('/enterprise')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 backdrop-blur-sm text-white text-xs font-bold hover:bg-white/25 transition ring-1 ring-white/20"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-lg ring-1 ring-white/30">
                <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest mb-0.5">Enterprise Hub</p>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-none truncate">
                  {title}
                </h1>
                {subtitle && <p className="text-xs sm:text-sm text-white/80 font-semibold mt-1 truncate">{subtitle}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 lg:px-6 py-5 lg:py-6 max-w-7xl mx-auto space-y-4">
        {children}
      </div>
    </div>
  );
}