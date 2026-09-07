import { Grid3x3, Users, Truck, PoundSterling } from 'lucide-react';

// Help, onboarding and related-hub links for the Projects Hub.
export const JOBS_HELP_TOPICS = [
  { title: 'Grid vs Kanban', summary: 'Two ways to see the same portfolio.', body: 'Grid shows rich project cards with crew, rig and budget counts. **Kanban** lays projects out by status so you can move them through Planning → In Progress → Completed.' },
  { title: 'Creating a project', summary: 'The wizard does the heavy lifting.', body: 'Use **Add Project** to open the wizard: disciplines, dates, client, site location and a bill of quantities. When you finish you can jump straight to building the rota.' },
  { title: 'Clone & split', summary: 'Reuse work you have already done.', body: 'Clone copies a project with all its cost items, logistics and milestones shifted by a number of days. **Split Multi-Site** breaks a legacy multi-site job into standalone projects.' },
  { title: 'Filters & search', summary: 'Find any project fast.', body: 'Status chips filter by lifecycle stage and the search box matches name, location or reference.' },
];

export const JOBS_ONBOARDING = {
  title: 'Welcome to the Projects Hub',
  description: 'Every project in this business stream, its status, crew and budget — in one place.',
  steps: ['Add a project with the wizard', 'Open it to see detail tabs', 'Build its rota in Scheduling'],
};

export const JOBS_QUICK_LINKS = [
  { to: '/admin', label: 'Scheduling', icon: Grid3x3, state: { section: 'scheduling' } },
  { to: '/staff', label: 'Staff', icon: Users },
  { to: '/admin/logistics', label: 'Logistics', icon: Truck },
  { to: '/billing', label: 'Financials', icon: PoundSterling },
];