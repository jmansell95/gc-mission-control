import React from 'react';
import { base44 } from '@/api/base44Client';
import { ShieldCheck } from 'lucide-react';
import MicrosoftIcon from '@/components/MicrosoftIcon';
import { safeReturnTo } from '@/lib/authReturnTo';
import { EMBLEM_URL } from '@/components/Logo';
import DivisionLoginAnimation from '@/components/login/DivisionLoginAnimation';

/**
 * Enterprise Unified Login — single login page for the entire enterprise.
 *
 * Shows a clean "Welcome to / GC Mission Control" heading with the Microsoft
 * SSO button. No BU/Stream picker — the user's division is resolved from
 * their Staff record and permissions after login.
 */
export default function Login() {
  // Default enterprise animation config (brand green, particle field).
  // No stream is selected on the login page anymore, so we use a neutral
  // brand animation instead of a per-division themed scene.
  const config = {
    animationType: 'particle_field',
    primaryColor: '#2E5A1A',
    secondaryColor: '#1c4a12',
    accentColor: '#8DC63F',
    division: null,
  };

  const handleMicrosoft = () => {
    base44.auth.loginWithProvider('microsoft', safeReturnTo());
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-8 overflow-hidden">
      {/* Animated background */}
      <DivisionLoginAnimation config={config} />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Enterprise logo + two-line welcome heading */}
        <div className="text-center mb-6">
          <img src={EMBLEM_URL} alt="Ground Control" className="mx-auto h-14 w-auto mb-4 object-contain drop-shadow-2xl" />
          <p className="text-white/70 text-lg font-medium drop-shadow-sm mb-1">
            Welcome to
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-lg">
            GC Mission Control
          </h1>
        </div>

        {/* Login card */}
        <div className="rounded-2xl p-6 sm:p-8 bg-white/95 backdrop-blur-xl border border-white/40 shadow-2xl">
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