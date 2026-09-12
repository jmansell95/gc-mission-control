import React from 'react';
import { HardHat, TrendingUp, Trophy, ClipboardList, Wrench, GraduationCap, FileText, Users, UserPlus, Loader2 } from 'lucide-react';

// Shown when a platform admin has no linked crew profile (staff.id is null).
// Instead of rendering a blank tab, this friendly state explains why no
// personal performance/incentive/timesheet data is available and offers the
// admin a one-click button to create their own crew profile so they can
// track their own performance, incentives and timesheets.
const TAB_META = {
  performance: { icon: TrendingUp, title: 'No Performance Data', desc: 'Performance metrics are calculated from your crew logs and timesheets. Since you don\'t have a linked crew profile, there\'s nothing to display here.' },
  earnings: { icon: Trophy, title: 'No Earnings Data', desc: 'Incentive scores, badges and rewards are calculated weekly from your drilling logs, on-time arrivals, and safety submissions. Admin accounts without a crew profile don\'t earn incentives.' },
  compliance: { icon: GraduationCap, title: 'No Compliance Records', desc: 'Training courses and compliance wallets are linked to crew profiles. Admins manage training and compliance from the Admin Dashboard.' },
  incentives: { icon: Trophy, title: 'No Incentive Score', desc: 'Incentive scores and badges are calculated weekly from your drilling logs, on-time arrivals, and safety submissions. Admin accounts without a crew profile don\'t earn incentives.' },
  timesheets: { icon: ClipboardList, title: 'No Timesheet History', desc: 'Timesheets are submitted by crew members from the field. As an admin, you approve timesheets rather than submit them.' },
  bookings: { icon: Wrench, title: 'No Bookings', desc: 'Vehicle maintenance and equipment bookings are assigned to crew members. Admins manage bookings from the Admin Dashboard.' },
  training: { icon: GraduationCap, title: 'No Training Records', desc: 'Training courses are booked for crew members. Admins manage the training schedule from Settings → Training.' },
  documents: { icon: FileText, title: 'No Documents', desc: 'Personal documents (certifications, inductions) are stored against crew profiles. Admins manage compliance from the Compliance page.' },
  crew: { icon: Users, title: 'No Crew Assignment', desc: 'You\'re not assigned to a crew team. Admins oversee all crews from the Admin Dashboard.' },
};

export default function NoCrewProfileState({ tab = 'performance', onGoAdmin, onCreateProfile, creating }) {
  const meta = TAB_META[tab] || TAB_META.performance;
  const Icon = meta.icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
      <div className="flex flex-col items-center text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1.5">{meta.title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed mb-5">{meta.desc}</p>

        {/* Create crew profile CTA — lets admins track their own performance */}
        {onCreateProfile && (
          <button
            onClick={onCreateProfile}
            disabled={creating}
            className="mt-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center gap-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {creating ? 'Creating…' : 'Create My Crew Profile'}
          </button>
        )}

        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 rounded-xl text-sm text-slate-600 mt-4">
          <HardHat className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span>Your account is an <strong className="text-slate-700">admin profile</strong> — no crew record linked.</span>
        </div>
        {onGoAdmin && (
          <button
            onClick={onGoAdmin}
            className="mt-3 text-sm text-slate-500 hover:text-slate-700 font-medium transition"
          >
            Go to Admin Dashboard →
          </button>
        )}
      </div>
    </div>
  );
}