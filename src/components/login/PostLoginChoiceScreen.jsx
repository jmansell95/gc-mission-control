import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe, Building2, ChevronRight } from 'lucide-react';
import { EMBLEM_URL } from '@/components/Logo';

/**
 * PostLoginChoiceScreen — shown to enterprise admins after login when they
 * haven't yet chosen a destination this session. Offers two paths:
 *   • Enterprise Dashboard — global cross-division management (/enterprise)
 *   • Stream Dashboard — their assigned division's Command Centre (/admin)
 *
 * The choice is stored in sessionStorage so a page refresh skips the
 * choice and goes straight to the saved destination.
 */
export default function PostLoginChoiceScreen({ profile, divisionName }) {
  const navigate = useNavigate();

  const handleChoose = (destination) => {
    try { sessionStorage.setItem('post_login_destination', destination); } catch {}
    navigate(destination, { replace: true });
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-4 py-8 overflow-hidden mesh-bg">
      {/* Logo + heading */}
      <div className="text-center mb-8 relative z-10">
        <img src={EMBLEM_URL} alt="Ground Control" className="mx-auto h-12 w-auto mb-3 object-contain drop-shadow-2xl" />
        <p className="text-white/70 text-sm font-medium mb-1">Welcome back</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
          {profile?.name || 'Choose your workspace'}
        </h1>
      </div>

      {/* Choice cards */}
      <div className="relative z-10 w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Enterprise Dashboard */}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          onClick={() => handleChoose('/enterprise')}
          className="group flex flex-col items-start text-left p-6 rounded-2xl bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl hover:shadow-xl hover:-translate-y-1 transition-all active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Enterprise Dashboard</h2>
          <p className="text-sm text-slate-500 flex-1">Manage all business units globally</p>
          <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
            Enter <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>

        {/* Stream Dashboard */}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          onClick={() => handleChoose('/admin')}
          className="group flex flex-col items-start text-left p-6 rounded-2xl bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl hover:shadow-xl hover:-translate-y-1 transition-all active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Stream Dashboard</h2>
          <p className="text-sm text-slate-500 flex-1">
            {divisionName ? `${divisionName} Command Centre` : 'Your business stream'}
          </p>
          <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
            Enter <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>
      </div>
    </div>
  );
}