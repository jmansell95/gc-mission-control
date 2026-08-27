import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useLoginBranding } from '@/hooks/useLoginBranding';
import { Loader2, ShieldCheck, KeyRound, ArrowRight } from 'lucide-react';

// ============================================================
// SetupAccount — the landing page for new users who received a
// branded invite email. They enter the 6-digit verification code
// from the OTP email, and the page verifies it and logs them in.
//
// URL: /setup-account?email=xxx
// Flow: register (creates account + sends OTP) → branded email
// (links here) → user enters OTP → verifyOtp → logged in →
// redirected to onboarding.
// ============================================================

export default function SetupAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { branding } = useLoginBranding();
  const email = searchParams.get('email') || '';

  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!email) {
      navigate('/register', { replace: true });
    }
  }, [email, navigate]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
        window.location.href = '/';
      } else {
        setError('Verification failed. Please check your code and try again.');
      }
    } catch (err) {
      setError(err?.message || 'Invalid or expired code. You can request a new one below.');
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      await base44.auth.resendOtp(email);
      setResent(true);
    } catch (err) {
      setError(err?.message || 'Could not resend code. Please try again.');
    }
    setResending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] shadow-lg mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Ground Control</h1>
          <p className="text-sm text-slate-500 font-medium">Mission Control</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound className="w-5 h-5 text-[#2E5A1A]" />
              <h2 className="text-lg font-bold text-slate-900">Verify Your Account</h2>
            </div>
            <p className="text-sm text-slate-500">
              We've sent a 6-digit verification code to{' '}
              <span className="font-semibold text-slate-700">{email}</span>.
              Enter it below to activate your account.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Verification Code
              </label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => {
                  setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                placeholder="123456"
                autoFocus
                inputMode="numeric"
                className="w-full px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] border border-slate-300 rounded-xl focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/20"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full py-3 bg-[#2E5A1A] text-white rounded-xl font-semibold text-sm hover:bg-[#1c4a12] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
              ) : (
                <>Verify & Enter <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            {resent ? (
              <p className="text-sm text-emerald-600 font-medium">A new code has been sent to your email.</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-sm text-slate-500 hover:text-[#2E5A1A] font-medium transition disabled:opacity-50"
              >
                {resending ? 'Sending new code…' : "Didn't get a code? Resend it"}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Ground Control — Mission Control
        </p>
      </div>
    </div>
  );
}