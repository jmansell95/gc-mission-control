import { Briefcase, Users, ShieldCheck, FileBarChart } from 'lucide-react';

export const BILLING_HELP_TOPICS = [
  { title: 'Insights', summary: 'Portfolio-wide financial health.', body: 'A dashboard of revenue, costs, margins and billing readiness across every active project. Drill into any tile to see the underlying records.' },
  { title: 'AFP Portfolio', summary: 'Application for Payment per job.', body: 'Every job\'s AFPs in one place — draft, submitted, assessed and agreed. Upload AFP templates, populate from field data, and submit to clients.' },
  { title: 'Margin Guard', summary: 'Sub-con markup rules and budget alerts.', body: 'Set the minimum markup applied to subcontractor costs. Projects breaching their budget threshold surface here for review.' },
  { title: 'Rate Card & CVR', summary: 'Master Price List and CVR exports.', body: 'The **Rate Card** holds the per-division Master Price List used to price AFPs. **CVR Export** downloads Cost Value Reconciliation packs for higher management.' },
];

export const BILLING_ONBOARDING = {
  title: 'Welcome to the Financial Hub',
  description: 'AFP portfolio, rate card, margin guard, aged debtors and CVR export.',
  steps: ['Set your rate card prices', 'Create AFPs from field data', 'Submit to clients and track agreement'],
};

export const BILLING_QUICK_LINKS = [
  { to: '/admin', label: 'Projects', icon: Briefcase, state: { section: 'jobs' } },
  { to: '/staff', label: 'Staff', icon: Users },
  { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
];