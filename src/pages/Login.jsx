import React from "react";
import { base44 } from "@/api/base44Client";
import { LogIn, ShieldCheck, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import MicrosoftIcon from "@/components/MicrosoftIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

/**
 * Microsoft SSO-only login.
 *
 * No email/password form, no Google, no invite emails. Staff click
 * "Continue with Microsoft"; the platform creates their user account from
 * the Microsoft identity on first login, then buildMyProfile (called by
 * Home.jsx via getMyStaffProfile) matches their Microsoft email to a Staff
 * record, links user_id, and routes them straight to their profile.
 */
export default function Login() {
  const handleMicrosoft = () => {
    base44.auth.loginWithProvider("microsoft", safeReturnTo());
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Sign in with your work Microsoft account"
    >
      {/* Microsoft SSO — the only login path */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleMicrosoft}
          className="w-full h-12 text-sm font-semibold bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
        >
          <MicrosoftIcon className="w-5 h-5" />
          Continue with Microsoft
        </button>

        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-center">
          <p className="text-xs text-emerald-800 leading-relaxed">
            Use the email your supervisor set up for you. We'll match it to your
            profile and take you straight to your dashboard — no password needed.
          </p>
        </div>
      </div>

      {/* Trust badges */}
      <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Secured with enterprise-grade encryption</span>
      </div>
    </AuthLayout>
  );
}