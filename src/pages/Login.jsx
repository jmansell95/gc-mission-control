import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = safeReturnTo();
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", safeReturnTo());
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
    >
      {/* Google SSO */}
      <button
        type="button"
        onClick={handleGoogle}
        className="w-full h-12 text-sm font-semibold mb-5 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 rounded-xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
      >
        <GoogleIcon className="w-5 h-5" />
        Continue with Google
      </button>

      {/* Divider */}
      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground font-medium">or sign in with email</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm flex items-start gap-2.5 animate-pop-in">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email address</Label>
          <div className="relative group">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-11 h-12 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100 rounded-xl transition-all"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
            <Link to="/forgot-password" className="text-xs text-emerald-700 font-medium hover:text-emerald-800 hover:underline transition">
              Forgot password?
            </Link>
          </div>
          <div className="relative group">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-11 h-12 bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100 rounded-xl transition-all"
              required
            />
          </div>
        </div>
        <Button type="submit" disabled={loading}
          className="w-full h-12 font-bold text-base command-gradient text-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:hover:translate-y-0">
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>

      {/* Trust badge */}
      <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>Secured with enterprise-grade encryption</span>
      </div>
    </AuthLayout>
  );
}