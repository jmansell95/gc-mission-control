import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  FileBarChart, Download, Loader2, ChevronRight, Search, X,
  Briefcase, Users, Calendar, Clock, Receipt, Package, Wrench, Truck,
  ShieldAlert, MapPin, FlaskConical, Star, Coins, FileText, Tag,
  Database, QrCode, Gauge, Route, ClipboardList, MessageSquare, Leaf,
  ShieldCheck, Flag, Camera, Bed, GraduationCap, Trophy, Award,
  UserCheck, Building2, HardHat, History, Cloud, CalendarDays,
  Timer, Settings2, HelpCircle, FolderKanban, CalendarX, ScrollText,
  Banknote, ListChecks, PenLine, Trash2, PackageCheck,
} from 'lucide-react';
import WidgetShell from '@/components/dashboard/WidgetShell';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const ICON_MAP = {
  Briefcase, Users, Calendar, Clock, Receipt, Package, Wrench, Truck,
  ShieldAlert, MapPin, FlaskConical, Star, Coins, FileText, Tag,
  Database, QrCode, Gauge, Route, ClipboardList, MessageSquare, Leaf,
  ShieldCheck, Flag, Camera, Bed, GraduationCap, Trophy, Award,
  UserCheck, Building2, HardHat, History, Cloud, CalendarDays,
  Timer, Settings2, HelpCircle, FolderKanban, CalendarX, ScrollText,
  Banknote, ListChecks, PenLine, Trash2, PackageCheck,
};

const QUICK_REPORTS = [
  { id: 'jobs', label: 'Jobs Summary', entity: 'Job', icon: Briefcase, fields: ['name', 'status', 'start_date', 'end_date', 'location', 'budget_amount'] },
  { id: 'staff', label: 'Staff Directory', entity: 'Staff', icon: Users, fields: ['name', 'email', 'worker_type', 'team_id', 'is_active'] },
  { id: 'timesheets', label: 'Timesheet Export', entity: 'Timesheet', icon: Clock, fields: ['staff_id', 'job_id', 'week_start', 'total_hours', 'status'] },
  { id: 'invoices', label: 'Invoice Ledger', entity: 'Invoice', icon: Receipt, fields: ['job_id', 'invoice_number', 'status', 'total_amount', 'issue_date'] },
  { id: 'assets', label: 'Asset Register', entity: 'SiteAsset', icon: Wrench, fields: ['name', 'asset_type', 'serial_number', 'compliance_status', 'stock_level'] },
  { id: 'vehicles', label: 'Fleet Status', entity: 'Vehicle', icon: Truck, fields: ['name', 'registration_number', 'mot_status', 'tax_status', 'current_mileage'] },
  { id: 'deliveries', label: 'Delivery Log', entity: 'DeliveryLog', icon: Truck, fields: ['job_id', 'driver_staff_name', 'delivery_type', 'status', 'scheduled_date'] },
  { id: 'safety-reports', label: 'Safety Report Log', entity: 'SafetyReport', icon: ShieldAlert, fields: ['job_id', 'report_type', 'status', 'created_date'] },
  { id: 'rotas', label: 'Weekly Rota', entity: 'RotaAssignment', icon: Calendar, fields: ['staff_id', 'job_id', 'assigned_date', 'week_start', 'assignment_type'] },
  { id: 'cost-items', label: 'Job Cost Items', entity: 'JobCostItem', icon: Package, fields: ['job_id', 'description', 'category', 'unit_cost', 'quantity'] },
];

export default function ReportsHubWidget({ onNavigate }) {
  const [search, setSearch] = useState('');
  const [generating, setGenerating] = useState(null);
  const { toast } = useToast();

  const q = search.toLowerCase().trim();
  const filtered = QUICK_REPORTS.filter(r => !q || r.label.toLowerCase().includes(q));

  const exportCSV = async (report) => {
    setGenerating(report.id);
    try {
      const records = await base44.entities[report.entity].filter({}, '-created_date', 500);
      if (!records || records.length === 0) {
        toast({ title: 'No data', description: `No ${report.label} records found.`, variant: 'destructive' });
        return;
      }
      const headers = report.fields;
      const rows = records.map(r => report.fields.map(f => {
        const val = r[f];
        if (val == null) return '';
        if (Array.isArray(val)) return val.join('; ');
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      }));
      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.label.toLowerCase().replace(/\s/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Report exported', description: `${records.length} records exported to CSV` });
    } catch (e) {
      toast({ title: 'Export failed', description: e.message || 'Could not export report.', variant: 'destructive' });
    }
    setGenerating(null);
  };

  return (
    <WidgetShell title="Reports Hub" icon={FileBarChart} fullWidth>
      <div className="p-4 space-y-4">
        {/* Header row — search + link to full builder */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search reports..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => onNavigate?.('settings')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-[#244715] transition flex-shrink-0"
          >
            <Settings2 className="w-3.5 h-3.5" /> Full Report Builder
          </button>
        </div>

        {/* Quick report grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {filtered.map(report => {
            const Icon = report.icon;
            const isGenerating = generating === report.id;
            return (
              <button
                key={report.id}
                onClick={() => exportCSV(report)}
                disabled={isGenerating}
                className="hub-glass rounded-xl p-3 text-left hover:border-primary/40 transition group disabled:opacity-60"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2E5A1A]/10 to-[#8DC63F]/10 flex items-center justify-center group-hover:from-[#2E5A1A] group-hover:to-[#5A8C1E] transition">
                    {isGenerating
                      ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      : <Icon className="w-4 h-4 text-primary group-hover:text-white transition" />
                    }
                  </div>
                  <Download className="w-3.5 h-3.5 text-slate-300 group-hover:text-primary transition" />
                </div>
                <p className="text-xs font-bold text-slate-800 leading-tight">{report.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">CSV export</p>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-6 text-sm text-slate-400">
            No reports match "{search}"
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
          <FileBarChart className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{QUICK_REPORTS.length} quick reports available · Full builder in Settings has 60+ data sources with custom columns, filters & PDF export</span>
        </div>
      </div>
    </WidgetShell>
  );
}