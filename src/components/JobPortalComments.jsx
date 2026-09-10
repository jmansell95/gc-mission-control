import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { MessageSquare, Send, Loader2, HardHat, User } from 'lucide-react';
import { format } from 'date-fns';

/**
 * JobPortalComments — admin-side view of client-facing portal comments.
 *
 * Shows all JobComment records for this job (both client-posted and
 * staff-posted) and lets internal staff post new comments that are
 * shared with the client/contractor via the secure portal.
 *
 * Staff-posted comments are created with is_client=false so they render
 * as company messages on the client portal (left-aligned, grey).
 * Client-posted comments (is_client=true) render as their own messages
 * (right-aligned, emerald) so staff can see the conversation from the
 * client's perspective.
 */
export default function JobPortalComments({ job }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const authorName = user?.full_name || user?.email || 'Staff';

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['job-portal-comments', job?.id],
    queryFn: () => base44.entities.JobComment.filter({ job_id: job?.id }, '-created_date', 100),
    enabled: !!job?.id,
  });

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !job?.id) return;
    setSending(true);
    try {
      await base44.entities.JobComment.create({
        job_id: job.id,
        author_name: authorName,
        message: message.trim(),
        is_client: false,
      });
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['job-portal-comments', job.id] });
    } catch (err) {
      console.error('Error posting portal comment:', err);
    }
    setSending(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-[#2E5A1A]" />
        <h3 className="font-semibold text-slate-900 text-sm">Portal Comments</h3>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{comments.length}</span>
      </div>

      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
          </div>
        ) : comments.length > 0 ? (
          <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
            {comments.map((c, i) => (
              <div key={i} className={`flex ${c.is_client ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] rounded-lg px-4 py-2.5 ${c.is_client ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {c.is_client ? (
                      <User className="w-3 h-3 text-emerald-100" />
                    ) : (
                      <HardHat className="w-3 h-3 text-slate-400" />
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-wide ${c.is_client ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {c.is_client ? 'Client' : 'Staff'}
                    </span>
                  </div>
                  <p className="text-sm">{c.message}</p>
                  <p className={`text-[10px] mt-1 ${c.is_client ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {c.author_name} · {c.created_date ? format(new Date(c.created_date), 'dd MMM HH:mm') : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4 mb-4">No portal comments yet. Post a comment below to share an update with the client.</p>
        )}

        <form onSubmit={handleSend} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write a comment for the client portal…"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]"
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2E5A1A] text-white rounded-lg hover:bg-[#244715] transition text-sm font-medium disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? '...' : 'Send'}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">Posting as <span className="font-semibold text-slate-600">{authorName}</span> · visible to the client on the portal</p>
        </form>
      </div>
    </div>
  );
}