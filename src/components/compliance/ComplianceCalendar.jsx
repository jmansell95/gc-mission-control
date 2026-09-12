import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, ChevronRight, ShieldCheck, Wrench, Users, Truck } from 'lucide-react';
import HubCard from '@/components/hubs/HubCard';
import HubLoadingState from '@/components/hubs/HubLoadingState';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, startOfWeek, endOfWeek, isToday } from 'date-fns';

const CATEGORY_STYLES = {
  staff: { color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700', icon: Users, label: 'Staff' },
  vehicle: { color: 'bg-teal-500', light: 'bg-teal-50', text: 'text-teal-700', icon: Truck, label: 'Vehicle' },
  equipment: { color: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700', icon: Wrench, label: 'Equipment' },
  company: { color: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-700', icon: ShieldCheck, label: 'Company' },
};

export default function ComplianceCalendar() {
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const { data: staff = [], isLoading: sl } = useQuery({
    queryKey: ['staff-compliance-cal'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }, 'name', 500),
  });
  const { data: assets = [], isLoading: al } = useQuery({
    queryKey: ['assets-compliance-cal'],
    queryFn: () => base44.entities.SiteAsset.filter({ is_active: true }, 'name', 500),
  });
  const { data: vehicles = [], isLoading: vl } = useQuery({
    queryKey: ['vehicles-compliance-cal'],
    queryFn: () => base44.entities.Vehicle.filter({ is_active: true }, 'name', 500),
  });

  const isLoading = sl || al || vl;

  const expiries = useMemo(() => {
    const items = [];
    const monthStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const monthEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const now = new Date();

    const urgencyFor = (d) => {
      const days = Math.ceil((d - now) / 86400000);
      if (days < 0) return 'expired';
      if (days <= 7) return 'critical';
      if (days <= 30) return 'soon';
      return 'ok';
    };

    const push = (d, category, title) => {
      if (d < monthStart || d > monthEnd) return;
      items.push({ date: d, category, title, urgency: urgencyFor(d) });
    };

    staff.forEach(s => {
      (s.compliance_items || []).forEach(c => {
        if (!c.expiry_date) return;
        push(new Date(c.expiry_date), 'staff', `${s.name}: ${c.type || c.name || 'Cert'}`);
      });
    });

    assets.forEach(a => {
      if (a.compliance_expiry_date) push(new Date(a.compliance_expiry_date), 'equipment', `${a.name}: LOLER/PUWER/PAT`);
      if (a.next_service_date) push(new Date(a.next_service_date), 'equipment', `${a.name}: Service Due`);
    });

    vehicles.forEach(v => {
      ['mot_expiry', 'tax_expiry', 'insurance_expiry'].forEach(field => {
        if (v[field]) {
          const label = field.replace('_expiry', '').toUpperCase();
          push(new Date(v[field]), 'vehicle', `${v.name || v.registration}: ${label}`);
        }
      });
    });

    return items;
  }, [staff, assets, vehicles, month]);

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    });
  }, [month]);

  const expiriesByDay = useMemo(() => {
    const m = {};
    expiries.forEach(e => {
      const key = format(e.date, 'yyyy-MM-dd');
      if (!m[key]) m[key] = [];
      m[key].push(e);
    });
    return m;
  }, [expiries]);

  if (isLoading) return <HubLoadingState variant="list" count={6} />;

  const selectedDayExpiries = selectedDay ? (expiriesByDay[format(selectedDay, 'yyyy-MM-dd')] || []) : [];

  return (
    <HubCard
      icon={ShieldCheck}
      title="Compliance Calendar"
      subtitle="Staff certs, vehicle MOT/tax, equipment LOLER/PUWER/PAT"
      tone="rose"
      padded={false}
      action={
        <div className="flex items-center gap-2">
          <button onClick={() => setMonth(addMonths(month, -1))} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">{format(month, 'MMMM yyyy')}</span>
          <button onClick={() => setMonth(addMonths(month, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
          <button onClick={() => { setMonth(new Date()); setSelectedDay(new Date()); }} className="ml-1 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
            Today
          </button>
        </div>
      }
    >
      {/* Legend */}
      <div className="px-4 sm:px-5 py-2 border-b border-slate-50 flex items-center gap-3 flex-wrap">
        {Object.entries(CATEGORY_STYLES).map(([key, s]) => (
          <span key={key} className="inline-flex items-center gap-1 text-[11px] text-slate-500">
            <span className={`w-2 h-2 rounded-full ${s.color}`} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-2 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />Expired</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />≤7 days</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300" />≤30 days</span>
        </span>
      </div>

      {/* Calendar grid */}
      <div className="p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayExpiries = expiriesByDay[dayKey] || [];
            const inMonth = isSameMonth(day, month);
            const isSel = selectedDay && isSameDay(day, selectedDay);
            const today = isToday(day);

            return (
              <button
                key={dayKey}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[64px] p-1.5 rounded-xl border text-left transition ${
                  isSel ? 'border-primary border-2 bg-primary/5' :
                  today ? 'border-primary bg-primary/5' :
                  'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                } ${!inMonth ? 'opacity-40' : ''}`}
              >
                <span className={`text-[11px] font-medium ${today ? 'text-primary font-bold' : 'text-slate-600'}`}>
                  {format(day, 'd')}
                </span>
                <div className="space-y-0.5 mt-0.5">
                  {dayExpiries.slice(0, 3).map((e, i) => {
                    const s = CATEGORY_STYLES[e.category];
                    const urgencyClass =
                      e.urgency === 'expired' ? 'bg-rose-100 text-rose-700 border border-rose-300' :
                      e.urgency === 'critical' ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                      e.urgency === 'soon' ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                      `${s.light} ${s.text}`;
                    return (
                      <div key={i} className={`text-[9px] px-1 py-0.5 rounded truncate font-medium ${urgencyClass}`}>
                        {e.urgency === 'expired' && '⚠ '}{e.title}
                      </div>
                    );
                  })}
                  {dayExpiries.length > 3 && (
                    <p className="text-[9px] text-slate-400 px-1">+{dayExpiries.length - 3} more</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day details */}
      {selectedDay && (
        <div className="px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs font-semibold text-slate-700 mb-2">{format(selectedDay, 'EEEE, do MMMM yyyy')}</p>
          {selectedDayExpiries.length === 0 ? (
            <p className="text-xs text-slate-400">No compliance expiries on this day.</p>
          ) : (
            <div className="space-y-1.5">
              {selectedDayExpiries.map((e, i) => {
                const s = CATEGORY_STYLES[e.category];
                const Icon = s.icon;
                const urgencyBadge =
                  e.urgency === 'expired' ? 'bg-rose-100 text-rose-700' :
                  e.urgency === 'critical' ? 'bg-amber-100 text-amber-700' :
                  e.urgency === 'soon' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500';
                const urgencyLabel =
                  e.urgency === 'expired' ? 'EXPIRED' :
                  e.urgency === 'critical' ? '≤7 DAYS' :
                  e.urgency === 'soon' ? '≤30 DAYS' : '';
                return (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`w-5 h-5 rounded-lg ${s.light} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-3 h-3 ${s.text}`} />
                    </span>
                    <span className="text-slate-700 flex-1">{e.title}</span>
                    {urgencyLabel && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${urgencyBadge}`}>{urgencyLabel}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </HubCard>
  );
}