import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import {
  MapPin, Navigation, Loader2, Users, Briefcase, Truck, CircleDot,
} from 'lucide-react';
import ProfileAvatar from '@/components/ui/ProfileAvatar';

/**
 * LiveCrewMap — shows where the division's crews are working today.
 * Lists today's assignments grouped by job site, with crew names and status.
 * Uses job site_lat/site_lng for location (no live GPS tracking — shows
 * planned deployment locations for today).
 */
export default function LiveCrewMap({ divisionId, staff, jobs = [], allStaff = [] }) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: todayAssignments = [], isLoading } = useQuery({
    queryKey: ['live-crew-assignments', divisionId, today],
    queryFn: async () => {
      if (!divisionId) return [];
      const all = await base44.entities.RotaAssignment.filter({ division_id: divisionId, assigned_date: today });
      return all.filter(a => a.assignment_type === 'job' || !a.assignment_type);
    },
    enabled: !!divisionId,
    refetchInterval: 60000,
  });

  const siteGroups = useMemo(() => {
    const map = {};
    todayAssignments.forEach(a => {
      const job = jobs.find(j => j.id === a.job_id);
      if (!job) return;
      const key = job.id;
      if (!map[key]) {
        map[key] = {
          job,
          assignments: [],
          crew: [],
          startedCount: 0,
          completedCount: 0,
        };
      }
      map[key].assignments.push(a);
      const member = allStaff.find(s => s.id === a.staff_id);
      if (member) map[key].crew.push(member);
      if (a.status === 'started') map[key].startedCount++;
      if (a.status === 'completed') map[key].completedCount++;
    });
    return Object.values(map).sort((a, b) => b.crew.length - a.crew.length);
  }, [todayAssignments, jobs, allStaff]);

  const totalCrew = siteGroups.reduce((s, g) => s + g.crew.length, 0);
  const activeSites = siteGroups.filter(g => g.startedCount > 0).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (siteGroups.length === 0) {
    return (
      <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <MapPin className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-500">No crews deployed today</p>
        <p className="text-xs text-slate-400 mt-1">Crew locations will appear here once shifts are assigned</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">{totalCrew}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Crew Out</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Briefcase className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">{siteGroups.length}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Sites</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Navigation className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900 tabular-nums leading-none">{activeSites}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Active</p>
          </div>
        </div>
      </div>

      {/* Site cards */}
      {siteGroups.map(group => (
        <div key={group.job.id} className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900 truncate">{group.job.name}</p>
              {group.job.location && <p className="text-xs text-slate-400 truncate">{group.job.location}</p>}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-xs font-bold text-slate-700">{group.crew.length} crew</span>
              {group.startedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                  <CircleDot className="w-2.5 h-2.5" /> {group.startedCount} started
                </span>
              )}
            </div>
          </div>

          {/* Crew avatars */}
          <div className="flex flex-wrap gap-1.5">
            {group.crew.map(member => (
              <div key={member.id} className="flex items-center gap-1.5 bg-slate-50 rounded-full pl-1 pr-2.5 py-1">
                <ProfileAvatar name={member.name} size={22} />
                <span className="text-xs font-medium text-slate-700 truncate max-w-[100px]">{member.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}