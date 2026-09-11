import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MessageSquare, X, ArrowLeftRight, FileText } from 'lucide-react';
import { useFieldData } from '@/components/field/FieldDataProvider';
import SelfServiceHub from '@/components/staff/SelfServiceHub';

/**
 * FieldCommsButton — always-visible floating action button (bottom-right)
 * that opens a bottom sheet with the SelfServiceHub (messages, shift swaps,
 * requests). Shows a badge with the count of unread/pending items.
 *
 * Rendered by FieldShell so it appears on every field page.
 */
export default function FieldCommsButton() {
  const [open, setOpen] = useState(false);
  const ctx = useFieldData();
  const { staff, activeDivision } = ctx || {};

  // Count unread crew messages
  const { data: messages = [] } = useQuery({
    queryKey: ['comms-messages', staff?.id, activeDivision?.id],
    queryFn: async () => {
      if (!staff?.id || !activeDivision?.id) return [];
      const all = await base44.entities.StaffMessage.filter({ division_id: activeDivision.id });
      return all.filter(m => m.sender_id !== staff.id && !m.read_at);
    },
    enabled: !!staff?.id && !!activeDivision?.id,
    refetchInterval: 30000,
  });

  // Count pending staff requests (my own, pending status)
  const { data: myRequests = [] } = useQuery({
    queryKey: ['comms-my-requests', staff?.id, activeDivision?.id],
    queryFn: async () => {
      if (!staff?.id || !activeDivision?.id) return [];
      return await base44.entities.StaffRequest.filter({ staff_id: staff.id, status: 'pending' });
    },
    enabled: !!staff?.id && !!activeDivision?.id,
    refetchInterval: 30000,
  });

  const unreadCount = messages.length + myRequests.length;

  return (
    <>
      {/* Floating button — bottom-right */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-5 z-30 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] shadow-lg shadow-[#2E5A1A]/30 flex items-center justify-center transition active:scale-90 touch-manipulation hover:shadow-xl hover:shadow-[#2E5A1A]/40 safe-area-bottom"
        aria-label="Open crew comms"
      >
        <MessageSquare className="w-6 h-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 bg-[#8DC63F] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {/* Pulse ring for attention */}
        {unreadCount > 0 && (
          <span className="absolute inset-0 rounded-2xl bg-[#2E5A1A] animate-ping opacity-20" style={{ animationDuration: '2s' }} />
        )}
      </button>

      {/* Bottom sheet */}
      {open && <CommsSheet onClose={() => setOpen(false)} ctx={ctx} unreadMessages={messages} pendingRequests={myRequests} />}
    </>
  );
}

function CommsSheet({ onClose, ctx, unreadMessages = [], pendingRequests = [] }) {
  const [tab, setTab] = useState(unreadMessages.length > 0 ? 'messages' : pendingRequests.length > 0 ? 'requests' : 'messages');
  const { staff, activeDivision, allStaff, visibleAssignments, jobs, isPlatformAdmin } = ctx || {};

  const tabs = [
    { key: 'messages', label: 'Messages', icon: MessageSquare, badge: unreadMessages.length },
    { key: 'swap', label: 'Shift Swap', icon: ArrowLeftRight },
    { key: 'requests', label: 'Requests', icon: FileText, badge: pendingRequests.length },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm animate-slide-up"
        onClick={onClose}
        style={{ animationDuration: '0.2s' }}
      />

      {/* Sheet panel */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col animate-slide-up safe-area-bottom"
        style={{
          maxHeight: '85dvh',
          animationDuration: '0.3s',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Crew Comms</h2>
            <p className="text-xs text-slate-400">Message your team, swap shifts, request time off</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition active:scale-95 flex-shrink-0"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex bg-slate-50 mx-4 mb-2 rounded-2xl p-1.5 gap-1 flex-shrink-0">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-bold transition active:scale-95 ${
                  active ? 'bg-gradient-to-br from-[#2E5A1A] to-[#1c4a12] text-white shadow-sm' : 'text-slate-500 hover:bg-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {t.badge > 0 && (
                  <span className="absolute top-1 right-1.5 min-w-[16px] h-4 px-1 bg-[#8DC63F] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {t.badge > 9 ? '9+' : t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 mobile-app-content">
          <SelfServiceHub
            staff={staff}
            divisionId={activeDivision?.id}
            divisionStaff={allStaff}
            myAssignments={visibleAssignments.map(a => ({
              ...a,
              jobName: jobs.find(j => j.id === a.job_id)?.name,
              location: jobs.find(j => j.id === a.job_id)?.location,
            }))}
            isManager={staff?.is_admin || isPlatformAdmin}
            activeTab={tab}
            onTabChange={setTab}
          />
        </div>
      </div>
    </>
  );
}