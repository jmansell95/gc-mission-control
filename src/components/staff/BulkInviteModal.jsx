import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { X, UserPlus, Loader2, CheckCircle2, AlertCircle, Users } from 'lucide-react';

/**
 * Bulk Invite Modal — paste a list of email addresses (one per line or
 * comma-separated), pick a role, and send app invites to all of them at
 * once. Used for initial mass-onboarding during rollout.
 */
export default function BulkInviteModal({ onClose }) {
  const queryClient = useQueryClient();
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState('user');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);

  const emailList = emails
    .split(/[\n,]/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

  const invalidCount = emails.split(/[\n,]/).map((e) => e.trim()).filter((e) => e.length > 0 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)).length;

  const handleInvite = async () => {
    if (emailList.length === 0) return;
    setRunning(true);
    const succeeded = [];
    const failed = [];
    for (const email of emailList) {
      try {
        // Step 1: Register the user — creates their account and sends OTP.
        const tempPassword = 'GC' + Math.random().toString(36).slice(2, 10) + '!';
        let registered = false;
        try {
          await base44.auth.register({ email, password: tempPassword });
          registered = true;
        } catch (regErr) {
          if (!String(regErr?.message || '').match(/already|exists/i)) throw regErr;
          registered = true;
        }
        // Step 2: Send the branded email (works because user is now registered).
        let brandedSent = false;
        if (registered) {
          try {
            const res = await base44.functions.invoke('sendBrandedInvite', { email, staff_name: email.split('@')[0], temp_password: tempPassword });
            brandedSent = (res.data || res)?.sent === true;
          } catch (_) { /* fall back below */ }
        }
        // Step 3: Fall back to platform invite if branded failed.
        if (!brandedSent) {
          await base44.users.inviteUser(email, role);
        }
        succeeded.push(email);
      } catch (e) {
        failed.push({ email, error: e.message || 'Failed' });
      }
    }
    setResults({ succeeded, failed });
    queryClient.invalidateQueries({ queryKey: ['staff'] });
    setRunning(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Bulk Invite Staff</h3>
              <p className="text-xs text-slate-500">Send app invites to multiple people at once</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {results ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-emerald-900">{results.succeeded.length} invite{results.succeeded.length === 1 ? '' : 's'} sent</span>
                </div>
                {results.succeeded.length > 0 && (
                  <p className="text-xs text-emerald-700">{results.succeeded.join(', ')}</p>
                )}
              </div>
              {results.failed.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="font-bold text-red-900">{results.failed.length} failed</span>
                  </div>
                  <ul className="text-xs text-red-700 space-y-0.5">
                    {results.failed.map((f, i) => <li key={i}>{f.email} — {f.error}</li>)}
                  </ul>
                </div>
              )}
              <button onClick={onClose} className="w-full px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg font-semibold text-sm hover:bg-[#1c4a12] transition">Done</button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Email Addresses</label>
                <textarea
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  rows={6}
                  placeholder={'john@example.com\njane@example.com\nbob@example.com'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-[#2E5A1A] text-sm font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  One email per line, or comma-separated. {emailList.length} valid{invalidCount > 0 && <span className="text-red-500"> · {invalidCount} invalid</span>}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Access Level</label>
                <div className="flex gap-2">
                  <button onClick={() => setRole('user')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition ${role === 'user' ? 'bg-[#2E5A1A] text-white border-[#2E5A1A]' : 'bg-white border-slate-300 text-slate-600'}`}>
                    User (Field Staff)
                  </button>
                  <button onClick={() => setRole('admin')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition ${role === 'admin' ? 'bg-[#2E5A1A] text-white border-[#2E5A1A]' : 'bg-white border-slate-300 text-slate-600'}`}>
                    Admin
                  </button>
                </div>
              </div>
              <button
                onClick={handleInvite}
                disabled={running || emailList.length === 0}
                className="w-full px-4 py-2.5 bg-[#2E5A1A] text-white rounded-lg font-semibold text-sm hover:bg-[#1c4a12] transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending {emailList.length} invites…</> : <><UserPlus className="w-4 h-4" /> Send {emailList.length} Invite{emailList.length === 1 ? '' : 's'}</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}