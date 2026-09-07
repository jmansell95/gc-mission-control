import { Briefcase, Truck, Wrench, ShieldCheck } from 'lucide-react';

export const ASSETS_HELP_TOPICS = [
  { title: 'Inventory', summary: 'Every asset, searchable and filterable.', body: 'The grid shows rigs, lifting gear, machinery, trailers and PAT. Filter by category, compliance status, source (Asset Panda vs local) and storage location. Click any asset to open its detail drawer.' },
  { title: 'Compliance & Certs', summary: 'Recertification pipeline and certificate vault.', body: 'The **Recert Pipeline** surfaces everything expired or expiring in 30 days. The **Certificate Vault** holds every uploaded cert, LOLE thorough examination, and service record. Upload new certs from the recert action modal.' },
  { title: 'Performance & Lifecycle', summary: 'Utilisation, drilling efficiency and depreciation.', body: 'See which rigs are earning their keep, drill down into per-rig efficiency, and track depreciation schedules for the fleet.' },
  { title: 'Tools', summary: 'Bulk upload, smart cert import, QR labels.', body: '**Bulk Upload** imports assets from a spreadsheet. **Smart Cert Import** pulls certificates from email. **QR Labels** prints asset QR codes for scanning. **Bulk Weights** sets kg values for vehicle payload checks.' },
];

export const ASSETS_ONBOARDING = {
  title: 'Welcome to the Assets Hub',
  description: 'Rigs, lifting gear, machinery, trailers and PAT — synced with Asset Panda.',
  steps: ['Sync Asset Panda in Settings', 'Add assets or bulk upload', 'Upload certificates and track recerts'],
};

export const ASSETS_QUICK_LINKS = [
  { to: '/admin', label: 'Projects', icon: Briefcase, state: { section: 'jobs' } },
  { to: '/fleet', label: 'Fleet', icon: Truck },
  { to: '/admin/logistics', label: 'Logistics', icon: Wrench },
  { to: '/compliance', label: 'Compliance', icon: ShieldCheck },
];