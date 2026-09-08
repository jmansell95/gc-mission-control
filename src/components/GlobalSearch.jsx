import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Briefcase, Users, Truck, Search, MapPin, Hash } from 'lucide-react';

export default function GlobalSearch({ compact = false }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
    enabled: open,
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
    enabled: open,
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    enabled: open,
  });

  // Navigate straight to the entity's page
  const goTo = (path, state) => {
    navigate(path, state ? { state } : undefined);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Search jobs, crew, vehicles…"
        className={`hidden lg:flex items-center ${compact ? 'justify-center px-2' : 'gap-2.5 px-4'} w-full py-3 bg-emerald-900/40 text-emerald-300/60 hover:text-white hover:bg-emerald-800/60 rounded-xl transition cursor-pointer text-ui-body font-medium ring-1 ring-emerald-700/30`}
      >
        <Search className="w-4 h-4 flex-shrink-0" />
        {!compact && <span>Search jobs, crew, vehicles…</span>}
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="px-3 pt-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2 text-ui-micro font-semibold uppercase tracking-wide text-slate-400">
            <Search className="w-3.5 h-3.5" />
            <span>Global Search — jump straight to any record</span>
          </div>
        </div>
        <CommandInput placeholder="Type a job name, crew member, or vehicle…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {jobs.length > 0 && (
            <CommandGroup heading="Jobs — click to open job detail">
              {jobs.slice(0, 10).map(job => (
                <CommandItem
                  key={job.id}
                  value={`job ${job.name} ${job.location || ''} ${job.job_reference || ''}`}
                  onSelect={() => goTo('/admin', { state: { section: 'job-detail', job } })}
                >
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{job.name}</p>
                    {job.location && <p className="text-ui-caption text-slate-400 truncate flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {staff.length > 0 && (
            <CommandGroup heading="Crew — click to open staff page">
              {staff.slice(0, 10).map(member => (
                <CommandItem
                  key={member.id}
                  value={`staff ${member.name} ${member.email || ''}`}
                  onSelect={() => goTo('/staff')}
                >
                  <Users className="w-4 h-4 text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{member.name}</p>
                    {member.email && <p className="text-xs text-slate-400 truncate">{member.email}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {vehicles.length > 0 && (
            <CommandGroup heading="Vehicles — click to open fleet page">
              {vehicles.slice(0, 10).map(v => (
                <CommandItem
                  key={v.id}
                  value={`vehicle ${v.name} ${v.registration_number || ''}`}
                  onSelect={() => goTo('/fleet')}
                >
                  <Truck className="w-4 h-4 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{v.name}</p>
                    {v.registration_number && <p className="text-xs text-slate-400 truncate font-mono flex items-center gap-1"><Hash className="w-3 h-3" />{v.registration_number}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}