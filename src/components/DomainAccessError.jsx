import React from 'react';
import { ShieldX } from 'lucide-react';

/**
 * Shown when a user authenticates via Microsoft SSO with an email domain
 * that is not on the allowed list (ground-control.co.uk). The session is
 * already cleared by AuthContext before this renders.
 */
export default function DomainAccessError({ email }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-rose-100">
            <ShieldX className="w-8 h-8 text-rose-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Unauthorised Email Domain</h1>
          <p className="text-slate-600 mb-6">
            This platform is restricted to <span className="font-semibold text-slate-900">ground-control.co.uk</span> Microsoft accounts.
            {email && (
              <> You signed in with <span className="font-semibold text-rose-600">{email}</span>, which is not permitted.</>
            )}
          </p>
          <div className="p-4 bg-slate-50 rounded-md text-sm text-slate-600">
            <p>Please sign out of that Microsoft account and sign in with your work email address.</p>
          </div>
          <button
            onClick={() => { window.location.href = '/login'; }}
            className="mt-6 w-full h-11 text-sm font-semibold bg-[#2E5A1A] text-white rounded-xl hover:bg-[#1c4a12] transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}