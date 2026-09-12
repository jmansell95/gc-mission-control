import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Cog, Clock, Ruler, Route, CalendarDays, PlayCircle, CheckCircle2, HardHat,
  Briefcase, Users, Phone, Mail, ShieldCheck, PoundSterling, ChevronRight,
  MapPin, Truck, FileText, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { computeCrewStats, findCrewPartner, fmtHours } from '@/components/jobs/crewStats';
import AnimatedNumber from '@/components/hubs/AnimatedNumber';
import { useNavigate } from 'react-router-dom';

const workerTypeMeta = {
  direct_employee: { label: 'Direct Employee', icon: Users, cls: 'bg-emerald-100 text-emerald-700' },
  subcontractor: { label: 'Subcontractor', icon: HardHat, cls: 'bg-orange-100 text-orange-700' },
  agency: { label: 'Agency Staff', icon: Briefcase, cls: 'bg-blue-100 text-blue-700' },
};

const roleLabels = {
  lead_driller: 'Lead Driller', second_man: 'Second Man',
  groundworker: 'Groundworker', cp_driller: 'CP Driller', rotary_driller: 'Rotary Driller',
  enabling_crew: 'Enabling Crew', depot: 'Depot', supervisor: 'Supervisor',
};

const statusMeta = {
  assigned: { label: 'Assigned', icon: Clock, cls: 'text-slate-600 bg-slate-100' },
  started: { label: 'On Shift', icon: PlayCircle, cls: 'text-blue-700 bg-blue-100' },
  completed: { label: 'Completed', icon: CheckCircle2, cls: 'text-primary bg-emerald-100' },
};

// Full crew profile modal — opens when a manager clicks a crew member card.
// Shows: personal details, rig + crew partner, full schedule history, compliance,
// and a prominent Time & Pay deep link.
export default function CrewDetailModal({ open, member, rotas, rigs, allStaff, job, onClose }) {
  const navigate = useNavigate();
  const { data: complianceItems = [] } = useQuery({
    queryKey: ['staff-compliance', member?.id],
    queryFn: () => base44.entities.ComplianceItem.filter({ staff_id: member?.id }),
    enabled: !!member?.id,
  });

  const stats = useMemo(() => member ? computeCrewStats(member, rotas, rigs) : null, [member, rotas, rigs]);
  const partner = useMemo(() => member ? findCrewPartner(member, rotas, allStaff) : null, [member, rotas, allStaff]);

  if (!member || !stats) return null;
  const wt = workerTypeMeta[member.worker_type] || workerTypeMeta.direct_employee;
  const WtIcon = wt.icon;
  const roleLabel = roleLabels[stats.crewRole] || roleLabels[member.job_role] || 'Crew Member';
  const sortedRotas = [...stats.memberRotas].sort((a, b) => (b.assigned_date || '').localeCompare(a.assigned_date || ''));

  const expiringCerts = complianceItems.filter(c => c.status === 'expiring').length;
  const expiredCerts = complianceItems.filter(c => c.status === 'expired').length;
  const compliantCerts = complianceItems.filter(c => c.status === 'compliant').length;

  const goToTimeAndPay = () => {
    onClose?.();
    navigate(`/staff?staffId=${member.id}&tab=timesheets`);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
          >
            {/* Header — gradient hero with avatar */}
            <div className="hero-vibrant px-6 py-5 text-white relative">
              <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition">
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 ring-2 ring-white/20">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.name} className="w-full h-full rounded-2xl object-cover" />
                  ) : (
                    <span className="text-2xl font-bold">{member.name.charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold leading-tight truncate">{member.name}</h2>
                  <p className="text-white/80 text-sm mt-0.5">{roleLabel}</p>
                  <span className={`mt-1.5 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold ${wt.cls}`}>
                    <WtIcon className="w-3 h-3" /> {wt.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Stat strip — the three categories */}
              <div className="grid grid-cols-3 gap-3">
                <StatTile icon={CalendarDays} label="Days Worked" value={stats.daysWorked} color="blue" />
                <StatTile icon={Ruler} label="Meterage" value={stats.totalMeterage} suffix="m" color="amber" />
                <StatTile icon={Clock} label="Hours" value={fmtHours(stats.hoursMinutes)} color="emerald" />
              </div>

              {/* Rig & Crew section */}
              <Section icon={Cog} title="Rig & Crew">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Assigned Rig</p>
                    {stats.rig ? (
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                          <Cog className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{stats.rig.name}</p>
                          {stats.rig.serial_number && <p className="text-xs text-slate-400 font-mono">{stats.rig.serial_number}</p>}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No rig assigned</p>
                    )}
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Crew Partner</p>
                    {partner ? (
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center">
                          <span className="text-violet-700 font-bold text-sm">{partner.staff.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{partner.staff.name}</p>
                          <p className="text-xs text-slate-500">{partner.role === 'lead_driller' ? 'Lead Driller' : 'Second Man'}</p>
                        </div>
                      </div>
                    ) : stats.crewRole ? (
                      <p className="text-sm text-slate-500">{stats.crewRole === 'lead_driller' ? 'Lead Driller — no second man paired' : 'Second Man — no lead paired'}</p>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No crew pairing</p>
                    )}
                  </div>
                </div>
              </Section>

              {/* Contact details */}
              <Section icon={Users} title="Contact & Profile">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {member.email && (
                    <ContactRow icon={Mail} label="Email" value={member.email} href={`mailto:${member.email}`} />
                  )}
                  {member.phone && (
                    <ContactRow icon={Phone} label="Phone" value={member.phone} href={`tel:${member.phone}`} />
                  )}
                  {member.job_title && (
                    <ContactRow icon={Briefcase} label="Job Title" value={member.job_title} />
                  )}
                  {member.company && (
                    <ContactRow icon={HardHat} label="Company" value={member.company} />
                  )}
                </div>
              </Section>

              {/* Compliance snapshot */}
              <Section icon={ShieldCheck} title="Compliance">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <CompliancePill label="Compliant" count={compliantCerts} cls="bg-emerald-100 text-emerald-700" />
                  {expiringCerts > 0 && <CompliancePill label="Expiring" count={expiringCerts} cls="bg-amber-100 text-amber-700" />}
                  {expiredCerts > 0 && <CompliancePill label="Expired" count={expiredCerts} cls="bg-red-100 text-red-700" />}
                  {complianceItems.length === 0 && <p className="text-sm text-slate-400 italic">No compliance records on file</p>}
                </div>
              </Section>

              {/* Schedule history on this job */}
              <Section icon={CalendarDays} title={`Schedule History (${sortedRotas.length} shifts)`}>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {sortedRotas.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No shifts on this job yet</p>
                  ) : sortedRotas.map(rota => {
                    const st = statusMeta[rota.status || 'assigned'] || statusMeta.assigned;
                    const StIcon = st.icon;
                    const rig = (rigs || []).find(g => g.id === rota.rig_asset_id);
                    const vehicle = rota.vehicle_id; // just id for now
                    return (
                      <div key={rota.id} className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                        <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <CalendarDays className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800">{format(new Date(rota.assigned_date + 'T00:00:00'), 'EEE dd MMM yyyy')}</p>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 mt-0.5">
                            {rota.start_time && <span>{rota.start_time}{rota.end_time ? `–${rota.end_time}` : ''}</span>}
                            {rig && <span className="inline-flex items-center gap-0.5"><Cog className="w-3 h-3" /> {rig.name}</span>}
                            {Number(rota.meterage) > 0 && <span className="inline-flex items-center gap-0.5 text-amber-600"><Ruler className="w-3 h-3" /> {rota.meterage}m</span>}
                            {Number(rota.inter_site_travel_minutes) > 0 && <span className="inline-flex items-center gap-0.5 text-violet-600"><Route className="w-3 h-3" /> {fmtHours(rota.inter_site_travel_minutes)}</span>}
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full font-semibold flex-shrink-0 ${st.cls}`}>
                          <StIcon className="w-3 h-3" /> {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>

            {/* Footer — Time & Pay CTA */}
            <div className="border-t border-slate-100 p-4 bg-slate-50/50">
              <button
                onClick={goToTimeAndPay}
                className="w-full flex items-center justify-between gap-2 px-5 py-3.5 command-gradient text-white rounded-2xl text-base font-bold shadow-lg shadow-[#2E5A1A]/30 active:scale-[0.98] transition glow-brand"
              >
                <span className="flex items-center gap-2.5">
                  <PoundSterling className="w-5 h-5" /> Time &amp; Pay
                </span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-white/80">
                  View timesheets & earnings <ChevronRight className="w-4 h-4" />
                </span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatTile({ icon: Icon, label, value, suffix, color }) {
  const colorMap = {
    blue: 'from-blue-50 to-blue-100/40 text-blue-700 border-blue-100',
    amber: 'from-amber-50 to-amber-100/40 text-amber-700 border-amber-100',
    emerald: 'from-emerald-50 to-emerald-100/40 text-emerald-700 border-emerald-100',
  };
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${colorMap[color]} border p-3.5`}>
      <Icon className="w-4 h-4 mb-1.5" />
      <p className="text-xl font-bold text-slate-900 tabular-nums leading-tight">
        {typeof value === 'number' ? <AnimatedNumber value={value} format={suffix ? (v) => `${Math.round(v)}${suffix}` : undefined} /> : value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ContactRow({ icon: Icon, label, value, href }) {
  const content = (
    <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-sm text-slate-700 truncate">{value}</p>
      </div>
    </div>
  );
  return href ? <a href={href} className="block hover:opacity-80 transition">{content}</a> : content;
}

function CompliancePill({ label, count, cls }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${cls}`}>
      <ShieldCheck className="w-3.5 h-3.5" /> {count} {label}
    </span>
  );
}