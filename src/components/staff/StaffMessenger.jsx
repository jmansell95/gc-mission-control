import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Send, Users, MessageCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ProfileAvatar from '@/components/ui/ProfileAvatar';

/**
 * StaffMessenger — in-app messaging for field crews.
 * Two channels: Crew (division-wide broadcast) and Direct (1:1 with colleagues).
 * Messages are scoped to the staff member's division.
 */
export default function StaffMessenger({ staff, divisionStaff = [], divisionId }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeChannel, setActiveChannel] = useState(null); // { type: 'crew'|'direct', peerId?, peerName? }
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['staff-messages', staff?.id, divisionId],
    queryFn: async () => {
      if (!staff?.id || !divisionId) return [];
      const all = await base44.entities.StaffMessage.filter({ division_id: divisionId });
      return all.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    },
    enabled: !!staff?.id && !!divisionId,
    refetchInterval: 15000,
  });

  // Real-time subscription
  useEffect(() => {
    if (!divisionId) return;
    const unsub = base44.entities.StaffMessage.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['staff-messages', staff?.id, divisionId] });
    });
    return unsub;
  }, [divisionId, staff?.id, queryClient]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeChannel]);

  const myDirectPeers = useMemo(() => {
    if (!staff?.id) return [];
    const peerIds = new Set();
    messages.forEach(m => {
      if (m.channel === 'direct') {
        if (m.sender_id === staff.id && m.recipient_id) peerIds.add(m.recipient_id);
        if (m.recipient_id === staff.id && m.sender_id) peerIds.add(m.sender_id);
      }
    });
    return divisionStaff.filter(s => peerIds.has(s.id) && s.id !== staff.id);
  }, [messages, staff?.id, divisionStaff]);

  const channelMessages = useMemo(() => {
    if (!activeChannel) return [];
    return messages.filter(m => {
      if (activeChannel.type === 'crew') return m.channel === 'crew';
      if (activeChannel.type === 'direct') {
        const peer = activeChannel.peerId;
        return m.channel === 'direct' && (
          (m.sender_id === staff.id && m.recipient_id === peer) ||
          (m.sender_id === peer && m.recipient_id === staff.id)
        );
      }
      return false;
    });
  }, [messages, activeChannel, staff?.id]);

  // Unread counts per channel for badge display
  const crewUnread = messages.filter(m => m.channel === 'crew' && m.sender_id !== staff?.id && !m.read_at).length;
  const directUnreadFor = (peerId) => messages.filter(m => m.channel === 'direct' && m.sender_id === peerId && m.recipient_id === staff?.id && !m.read_at).length;

  // Mark messages as read when a channel is opened
  useEffect(() => {
    if (!activeChannel || !staff?.id || !divisionId) return;
    const unread = messages.filter(m => {
      if (m.sender_id === staff.id || m.read_at) return false;
      if (activeChannel.type === 'crew') return m.channel === 'crew';
      if (activeChannel.type === 'direct') return m.channel === 'direct' && m.sender_id === activeChannel.peerId;
      return false;
    });
    if (unread.length === 0) return;
    Promise.all(unread.map(m => base44.entities.StaffMessage.update(m.id, { read_at: new Date().toISOString() })))
      .then(() => queryClient.invalidateQueries({ queryKey: ['staff-messages', staff?.id, divisionId] }))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !activeChannel || sending) return;
    setSending(true);
    try {
      await base44.entities.StaffMessage.create({
        sender_id: staff.id,
        sender_name: staff.name,
        recipient_id: activeChannel.type === 'direct' ? activeChannel.peerId : null,
        recipient_name: activeChannel.type === 'direct' ? activeChannel.peerName : null,
        division_id: divisionId,
        channel: activeChannel.type,
        body,
      });
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['staff-messages', staff?.id, divisionId] });
    } catch (e) {
      toast({ title: 'Failed to send', description: e.message, variant: 'destructive' });
    }
    setSending(false);
  };

  // Channel list view
  if (!activeChannel) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setActiveChannel({ type: 'crew' })}
          className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-3.5 hover:border-emerald-300 hover:shadow-sm transition active:scale-[0.99] text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900">Crew Channel</p>
            <p className="text-xs text-slate-400 truncate">Everyone in your division</p>
          </div>
          {crewUnread > 0 ? (
            <span className="min-w-[20px] h-5 px-1.5 bg-[#8DC63F] text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
              {crewUnread > 9 ? '9+' : crewUnread}
            </span>
          ) : (
            <MessageCircle className="w-4 h-4 text-slate-300 flex-shrink-0" />
          )}
        </button>

        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Direct Messages</p>
        {divisionStaff.filter(s => s.id !== staff?.id).slice(0, 20).map(peer => {
          const unread = directUnreadFor(peer.id);
          return (
          <button
            key={peer.id}
            onClick={() => setActiveChannel({ type: 'direct', peerId: peer.id, peerName: peer.name })}
            className="w-full flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-3 hover:border-emerald-300 hover:shadow-sm transition active:scale-[0.99] text-left"
          >
            <ProfileAvatar name={peer.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{peer.name}</p>
              <p className="text-xs text-slate-400 truncate">{peer.job_title || 'Crew'}</p>
            </div>
            {unread > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 bg-[#8DC63F] text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          );
        })}
        {divisionStaff.length <= 1 && (
          <p className="text-center text-xs text-slate-400 py-4">No other crew in your division yet</p>
        )}
      </div>
    );
  }

  // Conversation view
  return (
    <div className="flex flex-col h-[60vh] bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <button onClick={() => setActiveChannel(null)} className="p-1.5 rounded-lg hover:bg-slate-200 transition active:scale-95">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </button>
        {activeChannel.type === 'crew' ? (
          <>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Crew Channel</p>
              <p className="text-[11px] text-slate-400">{divisionStaff.length} members</p>
            </div>
          </>
        ) : (
          <>
            <ProfileAvatar name={activeChannel.peerName} size={36} />
            <div>
              <p className="text-sm font-bold text-slate-900">{activeChannel.peerName}</p>
              <p className="text-[11px] text-slate-400">Direct message</p>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-slate-50/30">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : channelMessages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">No messages yet — say hello 👋</p>
          </div>
        ) : (
          channelMessages.map(m => {
            const mine = m.sender_id === staff?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${mine ? 'bg-primary text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'}`}>
                  {!mine && activeChannel.type === 'crew' && (
                    <p className="text-[10px] font-bold text-emerald-700 mb-0.5">{m.sender_name}</p>
                  )}
                  <p className="text-sm leading-snug whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`text-[9px] mt-1 ${mine ? 'text-white/60' : 'text-slate-400'}`}>
                    {format(new Date(m.created_date), 'HH:mm')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-3 flex items-center gap-2 bg-white">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type a message…"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-24"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition flex-shrink-0"
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}