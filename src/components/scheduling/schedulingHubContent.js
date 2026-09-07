import { Briefcase, Users, Truck, MapPin } from 'lucide-react';

// Help, onboarding and related-hub links for the Scheduling Hub.
export const SCHEDULING_HELP_TOPICS = [
  { title: 'Rota Builder', summary: 'Assign crews, rigs and vehicles week by week.', body: 'Drag staff onto days, pair a Lead Driller and Second Man to a rig, and publish the week when it is ready. Publishing emails the crew and moves planning projects to **In Progress**.' },
  { title: 'Availability Heatmap', summary: 'See who is free before you assign.', body: 'Green cells are available crew, amber are partially booked and red are fully booked or on leave. Use it to spot capacity before committing a new project.' },
  { title: 'Calendar', summary: 'Month view of every assignment.', body: 'A bird’s-eye view of all shifts, leave and training across the month — ideal for spotting gaps and clashes.' },
  { title: 'GPS timesheet sync', summary: 'Pull real arrival/departure times.', body: '**Sync GPS Timesheets** reads Geotab vehicle geofence events for today and drafts timesheet entries so crews only need to confirm.' },
];

export const SCHEDULING_ONBOARDING = {
  title: 'Welcome to the Scheduling Hub',
  description: 'Plan the week, check availability, and publish the rota to the field.',
  steps: ['Pick a week in the Rota Builder', 'Drag crew onto projects', 'Publish to notify the field'],
};

export const SCHEDULING_QUICK_LINKS = [
  { to: '/admin', label: 'Projects', icon: Briefcase, state: { section: 'jobs' } },
  { to: '/staff', label: 'Staff', icon: Users },
  { to: '/fleet', label: 'Fleet', icon: Truck },
  { to: '/admin/logistics', label: 'Logistics', icon: MapPin },
];