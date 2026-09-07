import { Briefcase, Users, ShieldCheck, HardHat } from 'lucide-react';

export const COMPLIANCE_HELP_TOPICS = [
  { title: 'Safety', summary: 'Crew shift status, safety hub, incidents, H&S stats.', body: '**Crew Shift Status** shows who is on shift right now. **Safety Hub** connects to Mitti/SafetyCulture for audits and checklists. **Incidents** logs and tracks reportable incidents. **H&S Stats** summarises RIDDOR metrics.' },
  { title: 'Readiness', summary: 'Site readiness gate and compliance calendar.', body: 'The **Readiness Gate** checks every project for compliance before work starts. The **Calendar** shows upcoming expiries, training deadlines and audit dates.' },
  { title: 'Training & Environment', summary: 'Toolbox talks and carbon footprint.', body: '**Toolbox Talks** records safety briefings delivered on site. **Environmental** tracks the carbon footprint across projects.' },
];

export const COMPLIANCE_ONBOARDING = {
  title: 'Welcome to the Compliance Hub',
  description: 'Safety, readiness, training and environmental — all in one place.',
  steps: ['Connect Mitti/SafetyCulture in Settings', 'Log incidents and toolbox talks', 'Check the readiness gate before each project'],
};

export const COMPLIANCE_QUICK_LINKS = [
  { to: '/admin', label: 'Projects', icon: Briefcase, state: { section: 'jobs' } },
  { to: '/staff', label: 'Staff', icon: Users },
  { to: '/assets', label: 'Assets', icon: HardHat },
  { to: '/billing', label: 'Financials', icon: ShieldCheck },
];