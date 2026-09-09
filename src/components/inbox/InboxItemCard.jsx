import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, X, Eye, Clock, AlertTriangle, Info, ChevronRight, User, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { base44 } from '@/api/base44Client';

// InboxItemCard — a single inbox row. Shows type icon, title, requester, age,
// priority/overdue badges, and action buttons (Approve/Reject for approvals,
// View/Dismiss for alerts/notices). Expandable to show the full body + note input.

const TYPE_META = {
  approval: { icon: Check, color: 'amber', bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-200' },
  alert:    { icon: AlertTriangle, color: 'rose', bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-200' },
  notice:   { icon: Info, color: 'blue', bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-200' },
};

const HUB_COLORS = {
  billing: 'text-emerald-600', jobs: 'text-blue-600', scheduling: 'text-violet-600',
  staff: 'text-pink-600', logistics: 'text-cyan-600', assets: 'text-indigo-600',
  fleet: 'text-orange-600', investigation: 'text-teal-600', compliance: 'text-red-600',
  reports: 'text-slate-600', settings: 'text-slate-600', overview: 'text-slate-600',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function InboxItemCard({ item, onActioned }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);

  const meta = TYPE_META[item.type] || TYPE_META.notice;
  const Icon = meta.icon;
  const isPending = item.status === 'pending';
  const isApproval = item.type === 'approval';
  const canAction = isPending && item.assigned_to_user_id === user?.id;
  const hubColor = HUB_COLORS[item.source_hub] || 'text-slate-500';

  const handleAction = async (decision) => {
    setActing(true);
    try {
      const res = await base44.functions.invoke('actionInboxItem', { itemId: item.id, decision, note });
      if (res.data?.error) throw new Error(res.data.error);
      toast({
        title: decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : 'Dismissed',
        description: item.title,
      });
      setNote('');
      setExpanded(false);
      onActioned?.(item, decision);
    } catch (e) {
      toast({ title: 'Action failed', description: e.message, variant: 'destructive' });
    } finally {
      setActing(false);
    }
  };

  const openLink = () => {
    if (item.deep_link) window.location.href = item.deep_link;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={`hub-glass rounded-2xl p-4 transition ${!isPending ? 'opacity-60' : ''} ${item.is_overdue && isPending ? 'ring-2 ring-rose-300' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className={`w-10 h-10 rounded-xl ${meta.bg} ${meta.text} flex items-center justify-center flex-shrink-0 ring-1 ${meta.ring}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-left flex-1 min-w-0"
            >
              <p className="text-sm font-bold text-slate-900 leading-snug">{item.title}</p>
              {item.body && expanded && (
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed whitespace-pre-wrap">{item.body}</p>
              )}
            </button>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {item.is_overdue && isPending && (
                <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Overdue</span>
              )}
              {item.priority === 'urgent' && isPending && !item.is_overdue && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wide">Urgent</span>
              )}
              {!isPending && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
                  item.status === 'approved' ? 'text-emerald-600 bg-emerald-100' :
                  item.status === 'rejected' ? 'text-rose-600 bg-rose-100' :
                  'text-slate-500 bg-slate-100'
                }`}>{item.status}</span>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400 flex-wrap">
            <span className={`font-semibold capitalize ${hubColor}`}>{item.source_hub}</span>
            <span>·</span>
            {item.requester_name && item.requester_name !== 'System' && (
              <>
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {item.requester_name}</span>
                <span>·</span>
              </>
            )}
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {timeAgo(item.created_date)}</span>
            {item.sla_due_at && isPending && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 text-amber-600"><Clock className="w-3 h-3" /> due {timeAgo(item.sla_due_at)}</span>
              </>
            )}
            {item.assigned_to_name && !canAction && (
              <>
                <span>·</span>
                <span>→ {item.assigned_to_name}</span>
              </>
            )}
          </div>

          {/* Expanded note input + actions */}
          {expanded && isPending && canAction && (
            <div className="mt-3 space-y-2.5 animate-slide-up">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={isApproval ? 'Add a note (optional)…' : 'Reason (optional)…'}
                rows={2}
                className="w-full text-sm rounded-xl border border-slate-200 bg-white px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/30"
              />
              <div className="flex items-center gap-2 flex-wrap">
                {isApproval ? (
                  <>
                    <button
                      onClick={() => handleAction('approved')} disabled={acting}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => handleAction('rejected')} disabled={acting}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition active:scale-95 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleAction('dismissed')} disabled={acting}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition active:scale-95 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> Dismiss
                  </button>
                )}
                {item.deep_link && (
                  <button
                    onClick={openLink}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Non-actionable: just open */}
          {expanded && (!canAction || !isPending) && item.deep_link && (
            <div className="mt-3">
              <button
                onClick={openLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition active:scale-95"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open in {item.source_hub}
              </button>
            </div>
          )}

          {/* Expand hint */}
          {!expanded && (
            <button onClick={() => setExpanded(true)} className="text-[11px] text-slate-400 hover:text-slate-600 mt-1.5 flex items-center gap-1">
              <ChevronRight className="w-3 h-3" /> {canAction ? 'Review & decide' : 'View details'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}