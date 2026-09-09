// Shared constants for the audit dashboard — category metadata,
// status tones, and formatting helpers used across template cards,
// audit lists, and the detail drawer.

import {
  Car,
  ShieldAlert,
  Wrench,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
} from 'lucide-react';

export const CATEGORY_META = {
  vehicle_check: {
    label: 'Vehicle Check',
    icon: Car,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-500',
    cardAccent: 'from-blue-500 to-blue-600',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
  },
  powra: {
    label: 'POWRA',
    icon: ShieldAlert,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    dotClass: 'bg-amber-500',
    cardAccent: 'from-amber-500 to-orange-600',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  equipment: {
    label: 'Equipment Check',
    icon: Wrench,
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
    dotClass: 'bg-violet-500',
    cardAccent: 'from-violet-500 to-purple-600',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
  },
  general: {
    label: 'General Audit',
    icon: FileText,
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400',
    cardAccent: 'from-slate-500 to-slate-600',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-500',
  },
};

export function getCategoryMeta(category) {
  return CATEGORY_META[category] || CATEGORY_META.general;
}

export const STATUS_META = {
  pass: { label: 'Pass', icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  fail: { label: 'Fail', icon: XCircle, tone: 'text-rose-600 bg-rose-50 border-rose-200' },
  pending: { label: 'Pending', icon: Clock, tone: 'text-slate-500 bg-slate-50 border-slate-200' },
  'n/a': { label: 'N/A', icon: MinusCircle, tone: 'text-slate-400 bg-slate-50 border-slate-200' },
};

export function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.pending;
}

export const PRIORITY_TONE = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-50 text-amber-700',
  high: 'bg-rose-50 text-rose-700',
  critical: 'bg-rose-100 text-rose-800 ring-1 ring-rose-300',
};

export function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function fmtRelative(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(iso);
}