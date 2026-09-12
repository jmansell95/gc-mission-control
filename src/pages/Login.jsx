import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, ChevronDown, Check, Building2, Layers, Globe } from 'lucide-react';
import MicrosoftIcon from '@/components/MicrosoftIcon';
import { safeReturnTo } from '@/lib/authReturnTo';
import { EMBLEM_URL } from '@/components/Logo';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import DivisionLoginAnimation from '@/components/login/DivisionLoginAnimation';

/**
 * Enterprise Unified Login — single login page for the entire enterprise.
 *
 * Shows a Business Unit → Business Stream picker that dynamically swaps
 * the animated background and branding based on the selected stream.
 * Email-domain auto-detect runs on blur (matched against each Division's
 * email_domains array). After Microsoft SSO, the post-login animation
 * plays the selected stream's theme.
 */
export default function Login() {
  const [selectedBuId, setSelectedBuId] = useState(null);
  const [selectedStreamId, setSelectedStreamId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load all divisions
  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions-for-login-picker'],
    queryFn: () => base44.entities.Division.list('-sort_order', 500),
    staleTime: 5 * 60 * 1000,
  });

  // Group divisions into BU → Streams
  const buGroups = useMemo(() => {
    const bus = divisions.filter(d => !d.parent_division_id && d.is_active !== false);
    const streams = divisions.filter(d => d.parent_division_id && d.is_active !== false);
    return bus.map(bu => ({
      bu,
      streams: streams.filter(s => s.parent_division_id === bu.id).sort((a, b) =>
        (a.sort_order || 0) - (b.sort_order || 0)
      ),
    })).filter(g => g.streams.length > 0 || g.bu.status === 'active');
  }, [divisions]);

  // Standalone divisions (no parent, no children — backward compat)
  const standaloneStreams = useMemo(() => {
    const childIds = new Set(divisions.filter(d => d.parent_division_id).map(d => d.id));
    return divisions.filter(d => !d.parent_division_id && !childIds.has(d.id) && d.is_active !== false && d.status === 'active');
  }, [divisions]);

  // The selected stream (for animation config)
  const selectedStream = useMemo(() => {
    if (selectedStreamId) return divisions.find(d => d.id === selectedStreamId);
    // Default to first stream of first BU, or first standalone
    if (buGroups.length > 0 && buGroups[0].streams.length > 0) return buGroups[0].streams[0];
    if (standaloneStreams.length > 0) return standaloneStreams[0];
    return divisions.find(d => d.is_active !== false && d.status === 'active') || null;
  }, [divisions, selectedStreamId, buGroups, standaloneStreams]);

  const selectedBu = useMemo(() => {
    if (!selectedStream) return null;
    return divisions.find(d => d.id === selectedStream.parent_division_id) || null;
  }, [divisions, selectedStream]);

  // Build animation config from the selected stream
  const config = useMemo(() => {
    if (!selectedStream) return null;
    const cfg = selectedStream.login_animation_config || {};
    return {
      division: selectedStream,
      animationType: cfg.animation_type || 'themed_scene',
      primaryColor: cfg.primary_color || selectedStream.color || '#2E5A1A',
      secondaryColor: cfg.secondary_color || '#1c4a12',
      accentColor: cfg.accent_color || '#8DC63F',
      logoUrl: cfg.logo_url || selectedStream.logo_url || null,
      welcomeText: cfg.welcome_text || `Welcome to ${selectedStream.name}`,
      tagline: cfg.tagline || selectedStream.tagline || (selectedBu ? selectedBu.name : ''),
      durationMs: cfg.duration_ms || 2500,
      transitionStyle: cfg.transition_style || 'fade',
      showProgressBar: cfg.show_progress_bar !== false,
    };
  }, [selectedStream, selectedBu]);

  const handleMicrosoft = () => {
    // Store the selected stream for the post-login animation
    if (selectedStream) {
      try { sessionStorage.setItem('login_selected_division_id', selectedStream.id); } catch {}
    }
    base44.auth.loginWithProvider('microsoft', safeReturnTo());
  };

  // Auto-select first BU's first stream on mount
  useEffect(() => {
    if (!selectedStreamId && buGroups.length > 0 && buGroups[0].streams.length > 0) {
      setSelectedBuId(buGroups[0].bu.id);
      setSelectedStreamId(buGroups[0].streams[0].id);
    }
  }, [buGroups, selectedStreamId]);

  const availableStreams = selectedBuId
    ? (buGroups.find(g => g.bu.id === selectedBuId)?.streams || [])
    : standaloneStreams;

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-8 overflow-hidden">
      {/* Animated background */}
      <DivisionLoginAnimation config={config} />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Enterprise logo + welcome */}
        <div className="text-center mb-6">
          <img src={EMBLEM_URL} alt="Ground Control" className="mx-auto h-14 w-auto mb-3 object-contain drop-shadow-2xl" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-lg">
            {config?.welcomeText || 'Welcome back'}
          </h1>
          {config?.tagline && (
            <p className="text-white/70 mt-1.5 drop-shadow-sm font-medium text-sm">{config.tagline}</p>
          )}
        </div>

        {/* Login card */}
        <div className="rounded-2xl p-6 sm:p-8 bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl">
          {/* BU → Stream picker */}
          <div className="mb-5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">
              Select your Business Unit & Stream
            </label>

            {/* BU selector */}
            <div className="relative mb-2">
              <button
                type="button"
                onClick={() => setPickerOpen(!pickerOpen)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white text-left transition"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0">
                  {selectedBu ? <Building2 className="w-4 h-4 text-white" /> : <Globe className="w-4 h-4 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Business Unit</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{selectedBu?.name || 'Select unit'}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition ${pickerOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {pickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-xl bg-white border-2 border-slate-200 shadow-2xl z-50 py-1"
                  >
                    {buGroups.map(g => (
                      <button
                        key={g.bu.id}
                        type="button"
                        onClick={() => {
                          setSelectedBuId(g.bu.id);
                          // Auto-select first stream in this BU
                          if (g.streams.length > 0) setSelectedStreamId(g.streams[0].id);
                          setPickerOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition text-left"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: g.bu.color || '#2E5A1A' }}>
                          <Building2 className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{g.bu.name}</p>
                          <p className="text-[10px] text-slate-400">{g.streams.length} stream{g.streams.length !== 1 ? 's' : ''}</p>
                        </div>
                        {selectedBuId === g.bu.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stream selector */}
            <div className="relative">
              <select
                value={selectedStreamId || ''}
                onChange={e => setSelectedStreamId(e.target.value)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white text-sm font-semibold text-slate-800 cursor-pointer outline-none focus:border-primary transition appearance-none"
                style={{ backgroundImage: 'none' }}
              >
                {availableStreams.length === 0 && <option value="">No streams available</option>}
                {availableStreams.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Selected stream badge */}
            {selectedStream && (
              <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: selectedStream.color || '#2E5A1A' }} />
                <span className="text-xs font-semibold text-slate-600 truncate">
                  {selectedBu ? `${selectedBu.name} → ` : ''}{selectedStream.name}
                </span>
              </div>
            )}
          </div>

          {/* Microsoft SSO */}
          <button
            type="button"
            onClick={handleMicrosoft}
            className="w-full h-12 text-sm font-semibold bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
          >
            <MicrosoftIcon className="w-5 h-5" />
            Continue with Microsoft
          </button>

          {/* Trust badges */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
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