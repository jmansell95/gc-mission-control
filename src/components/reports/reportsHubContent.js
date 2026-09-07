import { Briefcase, Users, Truck, ShieldCheck } from 'lucide-react';

export const REPORTS_HELP_TOPICS = [
  { title: 'Categories', summary: 'Reports grouped by hub.', body: 'Pick a category in the sidebar — Financial, Fleet, Staff, Compliance, Assets — to see the native report for that hub. Each report has its own charts and drill-downs.' },
  { title: 'Filters & Export', summary: 'Date range, division, team, client.', body: 'Set the date preset (today, 7 days, 30 days, quarter, custom) and filter by division, team, client or job type. Export the filtered data to CSV or PDF.' },
  { title: 'Templates & Scheduling', summary: 'Save and schedule recurring reports.', body: 'Save any filtered report as a template, then schedule it to run daily, weekly or monthly and email the result to a distribution list.' },
  { title: 'Custom Builder', summary: 'Build your own report from scratch.', body: 'The **Custom Report Builder** lets you pick entities, columns and groupings to create a report tailored to your exact needs. Save it as a template for reuse.' },
];

export const REPORTS_ONBOARDING = {
  title: 'Welcome to the Reports Hub',
  description: 'Unified analytics across every hub — financials, fleet, staff, compliance and assets.',
  steps: ['Pick a category in the sidebar', 'Set your filters and date range', 'Export to CSV or PDF, or save as a template'],
};

export const REPORTS_QUICK_LINKS = [
  { to: '/admin', label: 'Projects', icon: Briefcase, state: { section: 'jobs' } },
  { to: '/staff', label: 'Staff', icon: Users },
  { to: '/fleet', label: 'Fleet', icon: Truck },
  { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
];