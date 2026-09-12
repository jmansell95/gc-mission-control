import React from 'react';
import { ShieldCheck, Clock, Hotel, CheckCircle2, AlertTriangle, Ruler, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

// Refined prep strip — polished chips with icon tiles, horizontal scroll.
export default function TodayPrepStrip({ todaysSorted = [], jobs = [], myCompliance = [], myHotelBookings = [], staffId }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const items = [];

  const pendingBriefings = todaysSorted.filter(a => (a.status || 'assigned') !== 'completed' && !a.briefing_signed).length;
  if (pendingBriefings > 0) {
    items.push({ icon: ShieldCheck, label: `${pendingBriefings} briefing${pendingBriefings > 1 ? 's' : ''} pending`, tone: 'amber' });
  }

  let tightGap = null;
  for (let i = 0; i < todaysSorted.length - 1; i++) {
    const gap = gapMinutes(todaysSorted[i].end_time, todaysSorted[i + 1].start_time);
    if (gap != null && gap >= 0 && gap < 30) { tightGap = gap; break; }
  }
  if (tightGap != null) {
    items.push({ icon: Clock, label: `Tight turnaround: ${tightGap} min gap`, tone: 'red' });
  }

  const hotelToday = myHotelBookings.some(h => h.check_in_date === todayStr);
  if (hotelToday) {
    items.push({ icon: Hotel, label: 'Hotel check-in today', tone: 'blue' });
  }

  const now = new Date();
  const expiring = myCompliance.filter(c => {
    if (!c.expiry_date || c.status_override !== 'auto') return false;
    const d = new Date(c.expiry_date.length <= 7 ? c.expiry_date + '-01' : c.expiry_date + 'T00:00:00');
    const days = Math.round((d - now) / (1000 * 60 * 60 * 24));
    return days < 30;
  });
  if (expiring.length > 0) {
    items.push({ icon: AlertTriangle, label: `${expiring.length} compliance expiring`, tone: 'amber' });
  }

  const startedNoMeterage = todaysSorted.some(a => {
    if (a.status !== 'started') return false;
    const job = jobs.find(j => j.id === a.job_id);
    const isDriller = job?.job_type === 'cp_drilling' || job?.job_type === 'rotary_drilling';
    return isDriller && (!a.meterage || a.meterage === 0);
  });
  if (startedNoMeterage) {
    items.push({ icon: Ruler, label: 'Record meterage', tone: 'amber' });
  }

  if (items.length === 0) {
    return (
      <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-[#8DC63F]/8 border border-emerald-200/60 px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-100 to-emerald-200/50 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={2.5} />
        </div>
        <p className="text-sm font-semibold text-emerald-800">All set — no prep items outstanding for today.</p>
      </div>
    );
  }

  const toneStyles = {
    amber: { chip: 'bg-gradient-to-r from-amber-50 to-amber-100/40 text-amber-800 border-amber-200/60', icon: 'bg-gradient-to-br from-amber-100 to-amber-200/50 text-amber-600' },
    red: { chip: 'bg-gradient-to-r from-red-50 to-red-100/40 text-red-800 border-red-200/60', icon: 'bg-gradient-to-br from-red-100 to-red-200/50 text-red-600' },
    blue: { chip: 'bg-gradient-to-r from-blue-50 to-blue-100/40 text-blue-800 border-blue-200/60', icon: 'bg-gradient-to-br from-blue-100 to-blue-200/50 text-blue-600' },
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        <Sparkles className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Today's Prep</p>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1.5">
        {items.map((item, i) => {
          const Icon = item.icon;
          const tone = toneStyles[item.tone];
          return (
            <span key={i} className={`inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap border ${tone.chip}`}>
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tone.icon}`}>
                <Icon className="w-4 h-4" strokeWidth={2.5} />
              </span>
              {item.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function gapMinutes(endTime, startTime) {
  if (!endTime || !startTime) return null;
  const [eh, em] = endTime.split(':').map(Number);
  const [sh, sm] = startTime.split(':').map(Number);
  return sh * 60 + sm - (eh * 60 + em);
}