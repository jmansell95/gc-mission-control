import { Briefcase, CalendarClock, Truck, Boxes } from 'lucide-react';

export const LOGISTICS_HELP_TOPICS = [
  { title: 'Delivery Board', summary: 'Kanban of every delivery by status.', body: 'Cards move from **Pending** → **In Transit** → **Completed**. Click any card to open the detail drawer with the full chain, signature and photos.' },
  { title: 'Day Plan', summary: 'Per-driver timeline of today\'s stops.', body: 'A vertical timeline for each driver showing the order of their stops, optimised sequence, and leg times. Use it to brief drivers before they leave.' },
  { title: 'Reconcile', summary: 'Bulk proof-of-delivery approval.', body: 'Approve multiple completed deliveries at once — check signatures, photos and condition reports in a single queue.' },
  { title: 'Goods In & Stock', summary: 'Receive deliveries and manage consumables.', body: '**Goods In** verifies supplier deliveries against purchase orders. **Consumable Stock** tracks what is on the shelf and raises alerts when items run low.' },
];

export const LOGISTICS_ONBOARDING = {
  title: 'Welcome to the Logistics Hub',
  description: 'Deliveries, collections, route optimisation, goods in and consumable stock.',
  steps: ['Create deliveries from within a job', 'Optimise routes for each driver', 'Reconcile completed deliveries in bulk'],
};

export const LOGISTICS_QUICK_LINKS = [
  { to: '/admin', label: 'Projects', icon: Briefcase, state: { section: 'jobs' } },
  { to: '/admin', label: 'Scheduling', icon: CalendarClock, state: { section: 'scheduling' } },
  { to: '/fleet', label: 'Fleet', icon: Truck },
  { to: '/assets', label: 'Assets', icon: Boxes },
];