import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link2, Copy, Check, ExternalLink, Eye, EyeOff, RefreshCw, Mail, MessageCircle,
  Loader2, Settings, HardHat, Clock, ShieldCheck, UserPlus, Ban, RotateCw,
  Building2, Lock, Zap,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PortalSectionManager from '@/components/PortalSectionManager';
import { CANONICAL_APP_BASE_URL } from '@/utils/appBaseUrl';

// Status badge for a portal recipient
function PortalStatusBadge({ record }) {
  if (!record) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">No contact</span>;
  if (record.portal_user_id) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5" /> Active</span>;
  if (record.portal_invited_at) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 inline-flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Invited</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Not invited</span>;
}

// A single recipient card (client or subcontractor) for the Secure Login mode
function RecipientCard({ label, icon: Icon, iconColor, record, recipientType, jobId, jobName, onRefresh }) {
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const email = record?.contact_email || '';
  const name = record?.contact_name || '';

  const handleInvite = async () => {
    if (!email) { setError(`No contact email on file. Add one in ${label}.`); return; }
    setInviting(true); setError(null);
    try {
      const res = await base44.functions.invoke('invitePortalUser', {
        recipient_type: recipientType,
        job_id: jobId,
        email,
        name,
        portal_base_url: CANONICAL_APP_BASE_URL,
      });
      if (res.data?.ok) {
        onRefresh();
      } else {
        setError(res.data?.error || 'Invite failed');
      }
    } catch (e) {
      setError(e?.message || 'Invite failed');
    }
    setInviting(false);
  };

  const handleRevoke = async () => {
    if (!confirm(`Revoke portal access for ${name || email}? They will no longer see this job when they log in.`)) return;
    setRevoking(true); setError(null);
    try {
      const entity = recipientType === 'client' ? base44.entities.Client : base44.entities.Contractor;
      await entity.update(record.id, { portal_user_id: '' });
      onRefresh();
    } catch (e) {
      setError(e?.message || 'Revoke failed');
    }
    setRevoking(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800">{label}</p>
          <p className="text-xs text-slate-500 truncate">{record?.name || 'Not linked'}</p>
        </div>
        <PortalStatusBadge record={record} />
      </div>

      {record ? (
        <>
          <div className="text-xs space-y-1">
            {name && <p className="text-slate-700"><span className="text-slate-400">Contact:</span> {name}</p>}
            <p className="text-slate-700 truncate"><span className="text-slate-400">Email:</span> {email || '—'}</p>
            {record.portal_invited_at && (
              <p className="text-slate-400 text-[10px]">
                <Clock className="w-2.5 h-2.5 inline mr-1" />
                Invited {new Date(record.portal_invited_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            {!record.portal_user_id && (
              <button onClick={handleInvite} disabled={inviting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition">
                {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : record.portal_invited_at ? <RotateCw className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                {record.portal_invited_at ? 'Resend Invite' : 'Invite with Login'}
              </button>
            )}
            {record.portal_user_id && (
              <>
                <a href={`${CANONICAL_APP_BASE_URL}/portal`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition">
                  <ExternalLink className="w-3.5 h-3.5" /> Open Portal
                </a>
                <button onClick={handleRevoke} disabled={revoking}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition">
                  {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />} Revoke
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-400">No {label.toLowerCase()} linked to this job. Assign one in the job header.</p>
      )}

      {error && <p className="text-[10px] text-red-600 bg-red-50 rounded-lg px-2 py-1">{error}</p>}
    </div>
  );
}

export default function PortalLinkManager({ job }) {
  const [mode, setMode] = useState('quick');
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [emailSending, setEmailSending] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const [portalToken, setPortalToken] = useState(job.portal_token || null);
  const [portalEnabled, setPortalEnabled] = useState(job.portal_enabled || false);
  const [showSections, setShowSections] = useState(false);
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list() });
  const client = clients.find(c => c.id === job.client_id);
  const contractor = contractors.find(c => c.id === job.contractor_id);
  const clientEmail = client?.contact_email || '';
  const contractorEmail = contractor?.contact_email || '';

  const refreshPortal = () => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
    queryClient.invalidateQueries({ queryKey: ['contractors'] });
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
  };

  const enabledSections = job.portal_sections ? Object.values(job.portal_sections).filter(Boolean).length : 10;
  const portalUrl = portalToken ? `${CANONICAL_APP_BASE_URL}/client-portal/${portalToken}` : null;

  const generateToken = () => 'cl_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  const handleEnable = async () => {
    setToggling(true);
    try {
      const token = portalToken || generateToken();
      await base44.entities.Job.update(job.id, { portal_token: token, portal_enabled: true });
      setPortalToken(token); setPortalEnabled(true);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (e) { console.error(e); }
    setToggling(false);
  };

  const handleDisable = async () => {
    setToggling(true);
    try {
      await base44.entities.Job.update(job.id, { portal_enabled: false });
      setPortalEnabled(false);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (e) { console.error(e); }
    setToggling(false);
  };

  const handleRegenerate = async () => {
    if (!confirm('Regenerate the portal link?\n\nThe old link will stop working immediately.')) return;
    setRegenerating(true);
    try {
      const token = generateToken();
      await base44.entities.Job.update(job.id, { portal_token: token, portal_enabled: true });
      setPortalToken(token); setPortalEnabled(true);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (e) { console.error(e); }
    setRegenerating(false);
  };

  const handleEmail = async (recipient) => {
    const isContractor = recipient === 'contractor';
    const email = isContractor ? contractorEmail : clientEmail;
    if (!email) {
      setEmailStatus({ type: 'error', msg: `No ${recipient} contact email on file.` });
      return;
    }
    setEmailSending(recipient); setEmailStatus(null);
    try {
      const name = isContractor ? contractor?.contact_name : client?.contact_name;
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `${isContractor ? 'Site logging portal for' : 'Live progress portal for'} ${job.name}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
          <div style="background:linear-gradient(135deg,#2E5A1A,#1c4a12);padding:20px 24px;border-radius:10px 10px 0 0"><h2 style="color:#fff;margin:0;font-size:18px">${isContractor ? 'Your site logging portal is ready' : 'Your project portal is ready'}</h2></div>
          <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">
            <p style="margin:0 0 12px">Hi ${name || ''},</p>
            <p style="margin:0 0 12px">You can now follow live progress on <strong>${job.name}</strong> — anytime, no login required.</p>
            <a href="${portalUrl}" style="display:inline-block;background:#2E5A1A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;margin:8px 0 16px">Open Project Portal</a>
            <p style="margin:0;font-size:12px;color:#64748b">If the button doesn't work, copy this link: ${portalUrl}</p>
          </div></div>`,
      });
      setEmailStatus({ type: 'success', msg: `Link emailed to ${email}` });
    } catch (e) {
      setEmailStatus({ type: 'error', msg: e?.message || 'Could not send email' });
    }
    setEmailSending(null);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waUrl = portalUrl ? `https://wa.me/?text=${encodeURIComponent(`Portal for ${job.name}: ${portalUrl}`)}` : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <Link2 className="w-5 h-5 text-emerald-700" />
        <h3 className="font-semibold text-slate-900 text-sm">Portal Access</h3>
        {/* Mode toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg ml-auto">
          <button onClick={() => setMode('quick')} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition ${mode === 'quick' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>
            <Zap className="w-3 h-3" /> Quick Share
          </button>
          <button onClick={() => setMode('secure')} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition ${mode === 'secure' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>
            <Lock className="w-3 h-3" /> Secure Login
          </button>
        </div>
      </div>

      {/* ── Quick Share mode (token-based, no login) ── */}
      {mode === 'quick' && (
        <div className="px-5 py-4">
          {portalUrl && portalEnabled ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-xs text-slate-500 font-mono truncate flex-1">{portalUrl}</span>
                <button onClick={handleCopy} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition flex-shrink-0">
                  {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                </button>
              </div>
              <div className="space-y-2">
                {clientEmail && (
                  <button onClick={() => handleEmail('client')} disabled={emailSending === 'client'} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition disabled:opacity-50">
                    {emailSending === 'client' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Email client · {clientEmail}
                  </button>
                )}
                {contractorEmail && (
                  <button onClick={() => handleEmail('contractor')} disabled={emailSending === 'contractor'} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition disabled:opacity-50">
                    {emailSending === 'contractor' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardHat className="w-3.5 h-3.5" />} Email subcontractor · {contractorEmail}
                  </button>
                )}
                <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                  <ExternalLink className="w-3.5 h-3.5" /> Preview portal
                </a>
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition">
                    <MessageCircle className="w-3.5 h-3.5" /> Share via WhatsApp
                  </a>
                )}
              </div>
              {emailStatus && (
                <div className={`text-xs px-3 py-2 rounded-lg ${emailStatus.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{emailStatus.msg}</div>
              )}
              {job.portal_invite_sent_at && (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                  <Clock className="w-3 h-3" /> Last sent {new Date(job.portal_invite_sent_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{job.portal_invite_sent_to && ` to ${job.portal_invite_sent_to}`}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                <button onClick={() => setShowSections(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition">
                  <Settings className="w-3.5 h-3.5" /> Sections ({enabledSections}/10)
                </button>
                <button onClick={handleRegenerate} disabled={regenerating} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition disabled:opacity-50">
                  {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Regenerate
                </button>
                <button onClick={handleDisable} disabled={toggling} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50">
                  <EyeOff className="w-3.5 h-3.5" /> Disable
                </button>
              </div>
              {!clientEmail && !contractorEmail && (
                <p className="text-[11px] text-amber-600">No client or subcontractor contact email on file — add one to enable email sharing. You can still copy the link manually.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Generate a secure link for your client or subcontractor to view live job progress — no login required.</p>
              <button onClick={handleEnable} disabled={toggling} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium disabled:opacity-50">
                <Eye className="w-4 h-4" /> {toggling ? 'Enabling...' : 'Enable Portal'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Secure Login mode (user-account-based) ── */}
      {mode === 'secure' && (
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-blue-800">Secure login access</p>
              <p className="text-[11px] text-blue-600 mt-0.5">Invite your client or subcontractor as a real user. They'll log in with email/password and see a dashboard scoped to their jobs — more secure than a shareable link.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <RecipientCard label="Client" icon={Building2} iconColor="bg-emerald-600" record={client} recipientType="client" jobId={job.id} jobName={job.name} onRefresh={refreshPortal} />
            <RecipientCard label="Subcontractor" icon={HardHat} iconColor="bg-amber-600" record={contractor} recipientType="subcontractor" jobId={job.id} jobName={job.name} onRefresh={refreshPortal} />
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
            <a href={`${CANONICAL_APP_BASE_URL}/portal`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
              <ExternalLink className="w-3.5 h-3.5" /> Open Portal Dashboard
            </a>
            <span className="text-[11px] text-slate-400">Share this link with invited users after they set their password.</span>
          </div>
        </div>
      )}

      <Dialog open={showSections} onOpenChange={setShowSections}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-primary" /> Portal Section Visibility</DialogTitle></DialogHeader>
          <PortalSectionManager job={job} embedded />
        </DialogContent>
      </Dialog>
    </div>
  );
}