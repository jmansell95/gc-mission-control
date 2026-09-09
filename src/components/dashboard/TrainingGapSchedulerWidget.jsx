import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Clock, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';

/**
 * TrainingGapSchedulerWidget — dashboard widget that surfaces staff with
 * expiring training qualifications (within 60 days) and auto-drafted
 * training bookings that need manager confirmation. Links to the People
 * Hub training tab for action.
 */
export default function TrainingGapSchedulerWidget() {
  const { data: complianceItems = [], isLoading } = useQuery({
    queryKey: ['training-gap-compliance'],
    queryFn: async () => {
      const items = await base44.entities.ComplianceItem.filter({ category: 'staff' });
      const now = new Date();
      return items.filter(c => {
        if (!c.expiry_date || c.status_override === 'not_required') return false;
        const exp = c.expiry_date.length === 7 ? new Date(c.expiry_date + '-01') : new Date(c.expiry_date);
        const days = Math.floor((exp - now) / 86400000);
        return days <= 60 && days >= -30;
      });
    },
  });

  const { data: suggestedBookings = [] } = useQuery({
    queryKey: ['training-suggested-bookings'],
    queryFn: () => base44.entities.TrainingBooking.filter({ status: 'suggested' }),
  });

  const { data: staff = [] } = useQuery({ queryKey: ['training-gap-staff'], queryFn: () => base44.entities.Staff.list() });

  const expired = complianceItems.filter(c => {
    const exp = c.expiry_date?.length === 7 ? new Date(c.expiry_date + '-01') : new Date(c.expiry_date);
    return exp < new Date();
  });
  const expiringSoon = complianceItems.length - expired.length;

  const staffName = (id, fallbackName) => staff.find(s => s.id === id)?.name || fallbackName || 'Unknown';

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>;
  }

  if (complianceItems.length === 0 && suggestedBookings.length === 0) {
    return (
      <div className="insight-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-slate-900 text-sm">Training Compliance</h3>
        </div>
        <div className="text-center py-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">All training current</p>
          <p className="text-xs text-slate-400 mt-1">No qualifications expiring within 60 days</p>
        </div>
      </div>
    );
  }

  return (
    <div className="insight-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-slate-900 text-sm">Training Gap Scheduler</h3>
        </div>
        <a href="/staff?tab=training" className="text-xs font-semibold text-[#2E5A1A] hover:underline flex items-center gap-1">
          Review <ChevronRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2.5 rounded-xl bg-rose-50">
          <p className="text-xl font-bold text-rose-600 tabular-nums">{expired.length}</p>
          <p className="text-[10px] text-slate-500 font-semibold uppercase">Expired</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-amber-50">
          <p className="text-xl font-bold text-amber-600 tabular-nums">{expiringSoon}</p>
          <p className="text-[10px] text-slate-500 font-semibold uppercase">Expiring ≤60d</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-blue-50">
          <p className="text-xl font-bold text-blue-600 tabular-nums">{suggestedBookings.length}</p>
          <p className="text-[10px] text-slate-500 font-semibold uppercase">Suggested</p>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {complianceItems.slice(0, 8).map(c => {
          const exp = c.expiry_date?.length === 7 ? new Date(c.expiry_date + '-01') : new Date(c.expiry_date);
          const days = Math.floor((exp - new Date()) / 86400000);
          const isExpired = days < 0;
          const booking = suggestedBookings.find(b => b.compliance_item_id === c.id);
          return (
            <div key={c.id} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/70">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isExpired ? 'bg-rose-100' : 'bg-amber-100'}`}>
                <Clock className={`w-4 h-4 ${isExpired ? 'text-rose-600' : 'text-amber-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{staffName(c.reference_id, c.reference_name)}</p>
                <p className="text-[11px] text-slate-500 truncate">{c.title}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-[11px] font-bold ${isExpired ? 'text-rose-600' : 'text-amber-600'}`}>
                  {isExpired ? `${Math.abs(days)}d overdue` : `${days}d left`}
                </p>
                {booking && <p className="text-[9px] text-blue-500 font-semibold">Booking drafted</p>}
              </div>
            </div>
          );
        })}
      </div>

      {complianceItems.length > 8 && (
        <p className="text-xs text-slate-400 text-center mt-3">+ {complianceItems.length - 8} more — open the People Hub to see all</p>
      )}
    </div>
  );
}