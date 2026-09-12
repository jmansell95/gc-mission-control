import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lock, LogOut, Mail, UserCog } from 'lucide-react';
import Logo from '@/components/Logo';

/**
 * AccessGateScreen — shown when a user logs in and their access_status is
 * 'pending' (waiting for admin approval) or 'rejected' (admin denied access).
 * The pending variant states the user has not been set up with permissions yet
 * and shows the configured approver contacts so they know who to reach out to.
 */
export default function AccessGateScreen({ status, email, approvers = [], contactInstructions = '', onLogout }) {
  const isRejected = status === 'rejected';

  const handleLogout = async () => {
    if (onLogout) { onLogout(); return; }
    await base44.auth.logout('/login');
  };

  return (
    <div className="min-h-screen page-bg-vibrant flex items-center justify-center px-4 py-8">
      <div className="max-w-md w-full">
        <div className="flex flex-col items-center mb-8">
          <Logo height={48} />
        </div>
        <div className="hub-glass rounded-2xl p-8 text-center">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${isRejected ? 'bg-rose-100' : 'bg-amber-100'}`}>
            {isRejected ? (
              <AlertTriangle className="w-7 h-7 text-rose-600" />
            ) : (
              <Lock className="w-7 h-7 text-amber-600" />
            )}
          </div>

          {isRejected ? (
            <>
              <h1 className="text-xl font-extrabold text-slate-900 mb-2">Access Not Granted</h1>
              <p className="text-sm text-slate-500 mb-6">
                Your request to access GC Mission Control has been declined.
                Please contact your administrator if you believe this is an error.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-extrabold text-slate-900 mb-2">You have not been set up with permissions yet</h1>
              <p className="text-sm text-slate-500 mb-6">
                Your account is waiting for an administrator to grant access.
              </p>
            </>
          )}

          {email && (
            <div className="mb-6 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wide mb-1">Logged in as</p>
              <p className="text-sm font-semibold text-slate-700 truncate">{email}</p>
            </div>
          )}

          {/* Approver contact info — pending only */}
          {!isRejected && (approvers.length > 0 || contactInstructions) && (
            <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/15 text-left">
              <div className="flex items-center gap-1.5 mb-2">
                <UserCog className="w-4 h-4 text-primary" />
                <p className="text-xs font-bold text-primary uppercase tracking-wide">Who to Contact</p>
              </div>
              {contactInstructions && (
                <p className="text-sm text-slate-600 mb-2">{contactInstructions}</p>
              )}
              {approvers.length > 0 && (
                <div className="space-y-1.5">
                  {approvers.map((a, i) => (
                    <a
                      key={i}
                      href={`mailto:${a.email}`}
                      className="flex items-center gap-2 text-sm text-slate-700 hover:text-primary transition"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold">{a.name}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">{a.email}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isRejected && approvers.length === 0 && !contactInstructions && (
            <div className="mb-6 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700">
                No approver contacts have been configured yet. Please ask your
                administrator to set up approver contacts in Settings → Access Gate.
              </p>
            </div>
          )}

          <Button onClick={handleLogout} variant="outline" className="w-full">
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
}