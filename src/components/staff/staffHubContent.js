import { Briefcase, CalendarClock, Truck, Boxes } from 'lucide-react';

export const STAFF_HELP_TOPICS = [
  { title: 'People', summary: 'Staff, crews, access levels and insights.', body: 'The **Staff** sub-tab lists every crew member. **Crews** groups subcontractor and agency workers by company. **Permission Groups** controls who can see and edit each hub. **Insights** shows cost analytics and utilisation.' },
  { title: 'Time & Pay', summary: 'Timesheets, delegation, holiday accrual, absences.', body: 'Approve timesheets, delegate approval when away, track holiday accrual balances, and record absences (annual leave, sick, training).' },
  { title: 'Training', summary: 'Matrix of required vs held qualifications.', body: 'See every staff member\'s training gaps, book courses, and upload certificates. Expired and expiring cards surface at the top.' },
  { title: 'Contacts', summary: 'Clients, subcontractors, suppliers, agencies.', body: 'The address book for everyone you do business with — client details, subcontractor company profiles, supplier rate cards and agency labour contacts.' },
];

export const STAFF_ONBOARDING = {
  title: 'Welcome to the Staff Hub',
  description: 'Your people, their time, their training and your contacts — all in one place.',
  steps: ['Add staff or import from a spreadsheet', 'Set permission groups for access', 'Book training and track compliance'],
};

export const STAFF_QUICK_LINKS = [
  { to: '/admin', label: 'Projects', icon: Briefcase, state: { section: 'jobs' } },
  { to: '/admin', label: 'Scheduling', icon: CalendarClock, state: { section: 'scheduling' } },
  { to: '/admin/logistics', label: 'Logistics', icon: Truck },
  { to: '/assets', label: 'Assets', icon: Boxes },
];