import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, ChevronDown, Check } from 'lucide-react';
import MicrosoftIcon from '@/components/MicrosoftIcon';
import { safeReturnTo } from '@/lib/authReturnTo';
import { EMBLEM_URL } from '@/components/Logo';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import DivisionLoginAnimation from '@/components/login/DivisionLoginAnimation';
import { useDivisionLoginConfig } from '@/hooks/useDivisionLoginConfig';

/**
 * Microsoft SSO-only login with division-based animated background.
 *
 * The login page shows an animated background based on the selected
 * division (defaults to the first active division). A division picker
 * in the corner lets users preview different divisions' animations.
 * After Microsoft SSO, the post-login loading animation plays in the
 * app entry point (Home.jsx) based on the user's actual division.
 */
export default function Login() {
  const [selectedDivisionId, setSelectedDivisionId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load all divisions for the picker
  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions-for-login-picker'],
    queryFn: () => base44.entities.Division.list('-sort_order', 500),
    staleTime: 5 * 60 * 1000,
  });

  // Find the selected division (or default to first active)
  const selectedDivision = useMemo(() => {
    if (selectedDivisionId) return divisions.find(d => d.id === selectedDivisionId);
    return divisions.find(d => d.is_active !== false && d.status === 'active') || divisions[0] || null;
  }, [divisions, selectedDivisionId]);

  // Build the config for the animation
  const config = useMemo(() => {
    if (!selectedDivision) return null;
    const cfg = selectedDivision.login_animation_config || {};
    return {
      division: selectedDivision,
      animationType: cfg.animation_type || 'themed_scene',
      primaryColor: cfg.primary_color || selectedDivision.color || '#2E5A1A',
      secondaryColor: cfg.secondary_color || '#1c4a12',
      accentColor: cfg.accent_color || '#8DC63F',
      logoUrl: cfg.logo_url || selectedDivision.logo_url || null,
      welcomeText: cfg.welcome_text || `Welcome to ${selectedDivision.name}`,
      tagline: cfg.tagline || selectedDivision.tagline || '',
      durationMs: cfg.duration_ms || 2500,
      transitionStyle: cfg.transition_style || 'fade',
      showProgressBar: cfg.show_progress_bar !== false,
    };
  }, [selectedDivision]);

  const handleMicrosoft = () => {
    base44.auth.loginWithProvider('microsoft', safeReturnTo());
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-8 overflow-hidden">
      {/* Animated background */}
      <DivisionLoginAnimation config={config} />

      {/* Division picker — top right corner */}
      {divisions.length > 1 && (
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-semibold hover:bg-white/25 transition"
          >
            <span className="w-2 h-2 rounded-full" style={{ background: selectedDivision?.color || '#8DC63F' }} />
            {selectedDivision?.name || 'Select Division'}
            <ChevronDown className={`w-3.5 h-3.5 transition ${pickerOpen ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {pickerOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full right-0 mt-2 w-56 max-h-64 overflow-y-auto rounded-xl bg-white/95 backdrop-blur-xl border border-white/30 shadow-2xl py-1.5"
              >
                {divisions.filter(d => d.is_active !== false).map(d => (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedDivisionId(d.id); setPickerOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 transition text-left"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color || '#2E5A1A' }} />
                    <span className="text-sm font-semibold text-slate-700 flex-1 truncate">{d.name}</span>
                    {selectedDivision?.id === d.id && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={EMBLEM_URL} alt="Ground Control" className="mx-auto h-16 w-auto mb-4 object-contain drop-shadow-2xl" />
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-lg">
            {config?.welcomeText || 'Welcome back'}
          </h1>
          {config?.tagline && (
            <p className="text-white/70 mt-2 drop-shadow-sm font-medium">{config.tagline}</p>
          )}
        </div>

        {/* Login card */}
        <div className="rounded-2xl p-8 bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl">
          <p className="text-sm text-slate-500 font-medium mb-4 text-center">
            Sign in with your work Microsoft account
          </p>

          <button
            type="button"
            onClick={handleMicrosoft}
            className="w-full h-12 text-sm font-semibold bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
          >
            <MicrosoftIcon className="w-5 h-5" />
            Continue with Microsoft
          </button>

          {/* Trust badges */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Secured with enterprise-grade encryption</span>
          </div>
        </div>

        <p className="text-center text-[11px] text-white/50 mt-4 drop-shadow-sm">
          This application was created by Jordan Mansell
        </p>
      </div>
    </div>
  );
}