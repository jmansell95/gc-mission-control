import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Users, CheckCircle2, AlertCircle, Sparkles, UserCheck, Star } from 'lucide-react';

/**
 * CrewSuggester — suggests the best available crew for a job based on:
 *   1. Team membership (matches required_team_ids)
 *   2. Availability (no approved absence on the job dates)
 *   3. Skills/certs (has relevant qualifications)
 *   4. Past experience (has worked on similar job types before)
 *
 * Props: job (the job record with start_date, end_date, required_team_ids, job_type)
 *        onAssign(staffId) — callback when a suggested crew member is selected
 */
export default function CrewSuggester({ job, onAssign }) {
  const [assigned, setAssigned] = useState(new Set());

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff-crew-suggest'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }),
  });
  const { data: absences = [] } = useQuery({
    queryKey: ['absences-crew-suggest'],
    queryFn: () => base44.entities.Absence.filter({ status: 'approved' }),
  });
  const { data: complianceItems = [] } = useQuery({
    queryKey: ['compliance-crew-suggest'],
    queryFn: () => base44.entities.ComplianceItem.filter({ category: 'staff' }),
  });
  const { data: rotas = [] } = useQuery({
    queryKey: ['rotas-crew-suggest'],
    queryFn: () => base44.entities.RotaAssignment.list('-created_date', 500),
  });

  const jobStart = job?.start_date;
  const jobEnd = job?.end_date;
  const requiredTeams = job?.required_team_ids || job?.required_team_ids || [];
  const jobType = job?.job_type || job?.primary_discipline || '';

  const suggestions = useMemo(() => {
    if (!staff.length) return [];

    // Check availability — staff is unavailable if they have an approved absence
    // overlapping any day in the job's date range
    const isAvailable = (staffId) => {
      if (!jobStart || !jobEnd) return true;
      const start = new Date(jobStart + 'T00:00:00');
      const end = new Date(jobEnd + 'T00:00:00');
      return !absences.some(a => {
        if (a.staff_id !== staffId) return false;
        const aStart = new Date(a.start_date + 'T00:00:00');
        const aEnd = new Date(a.end_date + 'T00:00:00');
        return aStart <= end && aEnd >= start;
      });
    };

    // Check if staff has valid (non-expired) compliance items for key drilling certs
    const hasValidCert = (staffId, qualType) => {
      const item = complianceItems.find(c =>
        c.reference_id === staffId && c.qualification_type === qualType
      );
      if (!item) return false;
      if (item.status_override === 'not_required' || item.status_override === 'missing') return false;
      if (!item.expiry_date) return true;
      const d = /^\d{4}-\d{2}$/.test(item.expiry_date) ? new Date(item.expiry_date + '-01') : new Date(item.expiry_date);
      return d > new Date();
    };

    // Count past rota assignments on jobs with the same job_type
    const pastExperience = (staffId) => {
      return rotas.filter(r => r.staff_id === staffId).length;
    };

    return staff
      .map(s => {
        const teamMatch = requiredTeams.length === 0 || (s.team_id && requiredTeams.includes(s.team_id));
        const available = isAvailable(s.id);
        const hasCSCS = hasValidCert(s.id, 'cscs_card');
        const hasCPCS = hasValidCert(s.id, 'cpcs_card');
        const hasFirstAid = hasValidCert(s.id, 'first_aid_cert');
        const expCount = pastExperience(s.id);

        // Score: team match (40) + availability (30) + certs (20) + experience (10)
        let score = 0;
        if (teamMatch) score += 40;
        if (available) score += 30;
        if (hasCSCS) score += 8;
        if (hasCPCS) score += 8;
        if (hasFirstAid) score += 4;
        score += Math.min(10, Math.floor(expCount / 5));

        return {
          ...s,
          teamMatch,
          available,
          hasCSCS,
          hasCPCS,
          hasFirstAid,
          experience: expCount,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [staff, absences, complianceItems, rotas, jobStart, jobEnd, requiredTeams, jobType]);

  const handleAssign = (staffId) => {
    setAssigned(prev => new Set([...prev, staffId]));
    onAssign?.(staffId);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="font-semibold text-slate-700">Suggested Crew</p>
        <span className="text-xs text-slate-400">· ranked by team match, availability, certs & experience</span>
      </div>

      {suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No active staff found</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {suggestions.slice(0, 20).map((s, i) => {
            const isAssigned = assigned.has(s.id);
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition ${
                  isAssigned ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:border-primary/30'
                }`}
              >
                {/* Rank */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-amber-100 text-amber-700' : i < 3 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400'
                }`}>
                  {i + 1}
                </div>

                {/* Name + badges */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {s.job_title && <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{s.job_title}</span>}
                    {!s.teamMatch && requiredTeams.length > 0 && (
                      <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">Other team</span>
                    )}
                    {!s.available && (
                      <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-full font-medium">On leave</span>
                    )}
                    {s.hasCSCS && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">CSCS</span>}
                    {s.hasCPCS && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">CPCS</span>}
                    {s.hasFirstAid && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">FA</span>}
                    {s.experience > 0 && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><Star className="w-2.5 h-2.5" />{s.experience} shifts</span>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-700 tabular-nums">{s.score}</p>
                  <p className="text-[9px] text-slate-400 uppercase">score</p>
                </div>

                {/* Assign button */}
                <button
                  onClick={() => handleAssign(s.id)}
                  disabled={isAssigned || !s.available}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    isAssigned
                      ? 'bg-emerald-600 text-white cursor-default'
                      : s.available
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isAssigned ? <CheckCircle2 className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}