import { Briefcase, Users, ShieldCheck, HardHat, BarChart3 } from 'lucide-react';

export const COMPLIANCE_HELP_TOPICS = [
  { title: 'Audit Dashboard', summary: 'Full Mitti audit intelligence — scores, trends, templates, action items.', body: 'The **Audit Dashboard** pulls every synced Mitti audit into a filterable list with pass/fail badges, scores, action items, auditor and job links. The **trend chart** shows weekly pass rates. The **sync status card** shows template count and last sync time with a Sync Now button. Click any audit to open the detail drawer with full action items.' },
  { title: 'Incidents', summary: 'Safety incidents and failed audits in a chronological timeline.', body: 'The **Safety Timeline** merges in-app incident reports with Mitti-flagged audit failures, sorted chronologically. Each entry shows severity, auditor, job/site, and description. Use **Report Incident** to log a new safety event.' },
  { title: 'Readiness', summary: 'Site readiness gate, compliance calendar, and crew certification pulse.', body: 'The **Readiness Gate** checks every project for compliance before work starts. The **Calendar** shows upcoming expiries, training deadlines and audit dates. The **Crew Certification Pulse** shows compliance status across the workforce.' },
  { title: 'Training & Environment', summary: 'Toolbox talks and carbon footprint tracking.', body: '**Toolbox Talks** records safety briefings delivered on site. **Environmental** tracks the carbon footprint across projects.' },
];

export const COMPLIANCE_ONBOARDING = {
  title: 'Welcome to the Compliance Hub',
  description: 'Full Mitti audit intelligence, incidents, readiness and training — all in one place.',
  steps: ['Connect Mitti in Settings → Integrations', 'Sync audits to populate the dashboard', 'Review failed audits and action items', 'Log incidents and toolbox talks'],
};

export const COMPLIANCE_QUICK_LINKS = [
  { to: '/admin', label: 'Projects', icon: Briefcase, state: { section: 'jobs' } },
  { to: '/staff', label: 'Staff', icon: Users },
  { to: '/assets', label: 'Assets', icon: HardHat },
  { to: '/billing', label: 'Financials', icon: ShieldCheck },
  { to: '/fleet', label: 'Fleet', icon: BarChart3 },
];