import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  MessageSquare, ArrowLeftRight, FileText, Plane,
  Check, X, Loader2, Send, AlertCircle, Trash2,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useDivision } from '@/contexts/DivisionContext';
import ProfileAvatar from '@/components/ui/ProfileAvatar';

const REQUEST_TYPE_META = {
  payslip: { label: 'Payslip', icon: FileText, tint: 'bg-violet-100 text-violet-700' },
  expense: { label: 'Expense', icon: FileText, tint: 'bg-amber-100 text-amber-700' },
  equipment: { label: 'Equipment', icon: FileText, tint: 'bg-blue-100 text-blue-700' },
  general: { label: 'General', icon: FileText, tint: 'bg-slate-100 text-slate-700' },
};

const REQUEST_STATUS_META = {
  pending: { label: 'Pending', tint: 'bg-amber-50 text-amber-700 ring-amber-200' },
  in_progress: { label: 'In Progress', tint: 'bg-blue-50 text-blue-700 ring-blue-200' },
  fulfilled: { label: 'Fulfilled', tint: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  rejected: { label: 'Rejected', tint: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

const SWAP_STATUS_META = {
  offered: { label: 'Open', tint: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  claimed: { label: 'Pending Approval', tint: 'bg-amber-50 text-amber-700 ring-amber-200' },
  approved: { label: 'Approved', tint: 'bg-blue-50 text-blue-700 ring-blue-200' },
  rejected: { label: 'Rejected', tint: 'bg-rose-50 text-rose-700 ring-rose-200' },
  cancelled: { label: 'Cancelled', tint: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

/**
 * CrewCommsManager — admin dashboard component for monitoring and responding
 * to all crew communications: messages, shift swaps, holiday requests, and
 * staff requests (payslips, expenses, equipment).
 *
 * Tabs:
 *  - Messages: all crew-channel messages, with reply box
 *  - Shift Swaps: all swap requests, approve/reject claimed swaps
 *  - Holidays: all pending absence requests, approve/reject
 *  - Requests: all staff requests (payslip/expense/equipment/general), respond
 */
export default function CrewCommsManager() {
  const [tab, setTab] = useState('messages');
  const { activeDivision } = useDivision();
  const divisionId = activeDivision?.id;

  const tabs = [
    { key: 'messages', label: 'Messages', icon: MessageSquare },
    { key: 'swaps', label: 'Shift Swaps', icon: ArrowLeftRight },
    { key: 'holidays', label: 'Holidays', icon: Plane },
    { key: 'requests', label: 'Requests', icon: FileText },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center shadow-md">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Crew Comms Center</h1>
          <p className="text-sm text-slate-500">Monitor and respond to crew messages, swaps, and requests</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex bg-white rounded-2xl border border-slate-200 p-1.5 gap-1 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition active:scale-95 ${
                active ? 'bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'messages' && <MessagesTab divisionId={divisionId} />}
      {tab === 'swaps' && <SwapsTab divisionId={divisionId} />}
      {tab === 'holidays' && <HolidaysTab divisionId={divisionId} />}
      {tab === 'requests' && <RequestsTab divisionId={divisionId} />}
    </div>
  );
}

// ── Messages Tab ──────────────────────────────────────────────────────────
function MessagesTab({ divisionId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [replyDraft, setReplyDraft] = useState({});
  const [sending, setSending] = useState(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['admin-crew-messages', divisionId],
    queryFn: async () => {
      if (!divisionId) return [];
      const all = await base44.entities.StaffMessage.filter({ division_id: divisionId });
      return all.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 100);
    },
    enabled: !!divisionId,
    refetchInterval: 15000,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['admin-crew-staff', divisionId],
    queryFn: async () => {
      if (!divisionId) return [];
      return await base44.entities.Staff.filter({ division_id: divisionId, is_active: true });
    },
    enabled: !!divisionId,
  });

  const handleReply = async (msg) => {
    const body = (replyDraft[msg.id] || '').trim();
    if (!body || sending === msg.id) return;
    setSending(msg.id);
    try {
      await base44.entities.StaffMessage.create({
        sender_id: 'admin',
        sender_name: 'Office',
        recipient_id: msg.sender_id,
        recipient_name: msg.sender_name,
        division_id: divisionId,
        channel: 'direct',
        body,
      });
      // Mark original as read
      await base44.entities.StaffMessage.update(msg.id, { read_at: new Date().toISOString() });
      setReplyDraft(d => ({ ...d, [msg.id]: '' }));
      queryClient.invalidateQueries({ queryKey: ['admin-crew-messages', divisionId] });
      toast({ title: 'Reply sent', description: `Message sent to ${msg.sender_name}.` });
    } catch (e) {
      toast({ title: 'Failed to send', description: e.message, variant: 'destructive' });
    }
    setSending(null);
  };

  if (isLoading) return <LoadingSpinner />;

  if (messages.length === 0) {
    return <EmptyState icon={MessageSquare} title="No crew messages" message="Crew chat messages will appear here." />;
  }

  return (
    <div className="space-y-2">
      {messages.map(msg => (
        <div key={msg.id} className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <ProfileAvatar name={msg.sender_name} avatarUrl={null} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900">{msg.sender_name || 'Unknown'}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase ${
                  msg.channel === 'crew' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
                }`}>
                  {msg.channel}
                </span>
                <span className="text-xs text-slate-400">{format(new Date(msg.created_date), 'dd MMM, HH:mm')}</span>
              </div>
              <p className="text-sm text-slate-700 mt-1 break-words">{msg.body}</p>
            </div>
          </div>
          {/* Reply box */}
          <div className="mt-3 flex items-end gap-2 pl-12">
            <textarea
              value={replyDraft[msg.id] || ''}
              onChange={e => setReplyDraft(d => ({ ...d, [msg.id]: e.target.value }))}
              placeholder={`Reply to ${msg.sender_name?.split(' ')[0] || 'crew'}...`}
              rows={1}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
            <button
              onClick={() => handleReply(msg)}
              disabled={sending === msg.id || !(replyDraft[msg.id] || '').trim()}
              className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center transition active:scale-95 disabled:opacity-40 flex-shrink-0"
            >
              {sending === msg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Swaps Tab ──────────────────────────────────────────────────────────────
function SwapsTab({ divisionId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(null);

  const { data: swaps = [], isLoading } = useQuery({
    queryKey: ['admin-crew-swaps', divisionId],
    queryFn: async () => {
      if (!divisionId) return [];
      const all = await base44.entities.ShiftSwap.filter({ division_id: divisionId });
      return all.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!divisionId,
    refetchInterval: 30000,
  });

  const handleDecision = async (swap, decision) => {
    setProcessing(swap.id);
    try {
      await base44.entities.ShiftSwap.update(swap.id, {
        status: decision,
        approved_by: 'Office',
        approved_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['admin-crew-swaps', divisionId] });
      toast({ title: `Swap ${decision}`, description: `${swap.offering_staff_name}'s swap has been ${decision}.` });
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
    setProcessing(null);
  };

  if (isLoading) return <LoadingSpinner />;

  const pending = swaps.filter(s => s.status === 'claimed');
  const others = swaps.filter(s => s.status !== 'claimed');

  if (swaps.length === 0) {
    return <EmptyState icon={ArrowLeftRight} title="No shift swaps" message="Shift swap requests will appear here." />;
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> Pending Approval ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(swap => (
              <SwapCard key={swap.id} swap={swap} onApprove={() => handleDecision(swap, 'approved')} onReject={() => handleDecision(swap, 'rejected')} processing={processing === swap.id} />
            ))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-500 mb-2">All Other Swaps</h3>
          <div className="space-y-2">
            {others.slice(0, 20).map(swap => (
              <SwapCard key={swap.id} swap={swap} readOnly />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SwapCard({ swap, onApprove, onReject, processing, readOnly }) {
  const status = SWAP_STATUS_META[swap.status] || SWAP_STATUS_META.offered;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900">{swap.offering_staff_name}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${status.tint}`}>{status.label}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {swap.job_name || 'Unknown job'} · {format(new Date(swap.assigned_date + 'T00:00:00'), 'dd MMM')}
            {swap.start_time ? ` at ${swap.start_time}` : ''}
          </p>
          {swap.location && <p className="text-xs text-slate-400">{swap.location}</p>}
          {swap.claiming_staff_name && <p className="text-xs text-blue-600 mt-1">Claimed by: {swap.claiming_staff_name}</p>}
          {swap.reason && <p className="text-xs text-slate-400 mt-1 italic">"{swap.reason}"</p>}
        </div>
        {!readOnly && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onApprove} disabled={processing} className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center transition active:scale-95 disabled:opacity-50">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={onReject} disabled={processing} className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center transition active:scale-95 disabled:opacity-50">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Holidays Tab ───────────────────────────────────────────────────────────
function HolidaysTab({ divisionId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(null);

  const { data: absences = [], isLoading } = useQuery({
    queryKey: ['admin-crew-absences', divisionId],
    queryFn: async () => {
      if (!divisionId) return [];
      const all = await base44.entities.Absence.filter({ division_id: divisionId });
      return all.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!divisionId,
    refetchInterval: 30000,
  });

  const handleDecision = async (absence, decision) => {
    setProcessing(absence.id);
    try {
      await base44.entities.Absence.update(absence.id, {
        status: decision,
        approved_by: 'Office',
        approved_at: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ['admin-crew-absences', divisionId] });
      toast({ title: `Holiday ${decision}`, description: `Request has been ${decision}.` });
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
    setProcessing(null);
  };

  if (isLoading) return <LoadingSpinner />;

  const pending = absences.filter(a => a.status === 'pending');
  const others = absences.filter(a => a.status !== 'pending');

  if (absences.length === 0) {
    return <EmptyState icon={Plane} title="No holiday requests" message="Holiday/time-off requests will appear here." />;
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> Pending ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(a => (
              <HolidayCard key={a.id} absence={a} onApprove={() => handleDecision(a, 'approved')} onReject={() => handleDecision(a, 'rejected')} processing={processing === a.id} />
            ))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-500 mb-2">Recent Decisions</h3>
          <div className="space-y-2">
            {others.slice(0, 15).map(a => (
              <HolidayCard key={a.id} absence={a} readOnly />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HolidayCard({ absence, onApprove, onReject, processing, readOnly }) {
  const statusTint = absence.status === 'approved' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : absence.status === 'rejected' ? 'bg-rose-50 text-rose-700 ring-rose-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900">{absence.staff_name || 'Staff member'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${statusTint} capitalize`}>{absence.status}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1 capitalize">{absence.reason || 'Holiday'}</p>
          <p className="text-xs text-slate-400">
            {format(new Date(absence.start_date + 'T00:00:00'), 'dd MMM')} — {format(new Date(absence.end_date + 'T00:00:00'), 'dd MMM')}
          </p>
          {absence.notes && <p className="text-xs text-slate-400 mt-1 italic">"{absence.notes}"</p>}
        </div>
        {!readOnly && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onApprove} disabled={processing} className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center transition active:scale-95 disabled:opacity-50">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={onReject} disabled={processing} className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center transition active:scale-95 disabled:opacity-50">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Requests Tab (payslips, expenses, equipment, general) ──────────────────
function RequestsTab({ divisionId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(null);
  const [responseDraft, setResponseDraft] = useState({});

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-crew-requests', divisionId],
    queryFn: async () => {
      if (!divisionId) return [];
      const all = await base44.entities.StaffRequest.filter({ division_id: divisionId });
      return all.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    },
    enabled: !!divisionId,
    refetchInterval: 30000,
  });

  const handleRespond = async (req, status) => {
    setProcessing(req.id);
    try {
      await base44.entities.StaffRequest.update(req.id, {
        status,
        response: responseDraft[req.id] || '',
        responded_by_name: 'Office',
        responded_at: new Date().toISOString(),
      });
      setResponseDraft(d => ({ ...d, [req.id]: '' }));
      queryClient.invalidateQueries({ queryKey: ['admin-crew-requests', divisionId] });
      toast({ title: `Request ${status}`, description: `${req.staff_name}'s request has been ${status}.` });
    } catch (e) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
    setProcessing(null);
  };

  const handleDelete = async (reqId) => {
    setProcessing(reqId);
    try {
      await base44.entities.StaffRequest.delete(reqId);
      queryClient.invalidateQueries({ queryKey: ['admin-crew-requests', divisionId] });
      toast({ title: 'Request deleted', description: 'The request has been permanently removed.' });
    } catch (e) {
      toast({ title: 'Failed to delete', description: e.message, variant: 'destructive' });
    }
    setProcessing(null);
  };

  if (isLoading) return <LoadingSpinner />;

  const pending = requests.filter(r => r.status === 'pending' || r.status === 'in_progress');
  const resolved = requests.filter(r => r.status === 'fulfilled' || r.status === 'rejected');

  if (requests.length === 0) {
    return <EmptyState icon={FileText} title="No staff requests" message="Payslip, expense, and equipment requests will appear here." />;
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> Pending ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(req => (
              <RequestCard key={req.id} req={req} onFulfill={() => handleRespond(req, 'fulfilled')} onReject={() => handleRespond(req, 'rejected')} onDelete={() => handleDelete(req.id)} processing={processing === req.id} responseDraft={responseDraft[req.id] || ''} onDraftChange={v => setResponseDraft(d => ({ ...d, [req.id]: v }))} />
            ))}
          </div>
        </div>
      )}
      {resolved.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-500 mb-2">Resolved</h3>
          <div className="space-y-2">
            {resolved.slice(0, 15).map(req => (
              <RequestCard key={req.id} req={req} readOnly onDelete={() => handleDelete(req.id)} processing={processing === req.id} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RequestCard({ req, onFulfill, onReject, onDelete, processing, responseDraft, onDraftChange, readOnly }) {
  const typeMeta = REQUEST_TYPE_META[req.request_type] || REQUEST_TYPE_META.general;
  const statusMeta = REQUEST_STATUS_META[req.status] || REQUEST_STATUS_META.pending;
  const TypeIcon = typeMeta.icon;
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="relative bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeMeta.tint}`}>
          <TypeIcon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900">{req.staff_name || 'Staff member'}</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase ${typeMeta.tint}`}>{typeMeta.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${statusMeta.tint}`}>{statusMeta.label}</span>
          </div>
          {/* Delete button — admin can delete any request regardless of status */}
          {onDelete && (
            <div className="absolute top-3 right-3">
              {confirmDelete ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={onDelete}
                    disabled={processing}
                    className="px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold transition active:scale-95 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {processing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 rounded-lg bg-slate-200 text-slate-600 text-[10px] font-bold transition active:scale-95"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center transition active:scale-90 hover:bg-rose-100"
                  aria-label="Delete request"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {req.subject && <p className="text-sm font-semibold text-slate-800 mt-1">{req.subject}</p>}
          {req.body && <p className="text-sm text-slate-600 mt-0.5 break-words">{req.body}</p>}
          {req.amount && <p className="text-sm font-bold text-amber-700 mt-1">£{req.amount.toFixed(2)}</p>}
          <p className="text-xs text-slate-400 mt-1">{format(new Date(req.created_date), 'dd MMM, HH:mm')}</p>
          {req.response && (
            <div className="mt-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-xs text-slate-500"><span className="font-bold">Office response:</span> {req.response}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">— {req.responded_by_name} · {req.responded_at && format(new Date(req.responded_at), 'dd MMM, HH:mm')}</p>
            </div>
          )}
        </div>
      </div>
      {!readOnly && (
        <div className="mt-3 pl-12 space-y-2">
          <textarea
            value={responseDraft}
            onChange={e => onDraftChange(e.target.value)}
            placeholder="Response note (optional)..."
            rows={1}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <div className="flex gap-2">
            <button onClick={onFulfill} disabled={processing} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold transition active:scale-95 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Fulfill
            </button>
            <button onClick={onReject} disabled={processing} className="flex-1 py-2 rounded-xl bg-rose-50 text-rose-600 text-sm font-bold border border-rose-200 transition active:scale-95 disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
              <X className="w-4 h-4" /> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared UI helpers ──────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );
}

function EmptyState({ icon: Icon, title, message }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <p className="text-sm font-bold text-slate-700">{title}</p>
      <p className="text-xs text-slate-400 mt-0.5">{message}</p>
    </div>
  );
}