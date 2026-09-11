import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarDays, Wrench, ScanLine, Truck, ClipboardList, UserCircle,
  Inbox, HelpCircle, LayoutDashboard, Users,
} from 'lucide-react';
import FieldGreetingHeader from '@/components/field/FieldGreetingHeader';
import { useFieldData } from '@/components/field/FieldDataProvider';
import { useInbox } from '@/hooks/useInbox';
import { staggerContainer, slideUp } from '@/lib/fieldAnimations';

/**
 * FieldDashboard — the Home page for field crew.
 *
 * Pure navigation hub: greeting header + a clean grid of navigation tiles.
 * Zero live data (job details, compliance, stats, quick actions) — all
 * live data lives on the Today page and other dedicated pages.
 */
export default function FieldDashboard() {
  const navigate = useNavigate();
  const ctx = useFieldData();
  const { staff, isPlatformAdmin, activeDivision } = ctx || {};
  const { counts: inboxCounts } = useInbox();
  const isAdmin = isPlatformAdmin || staff?.is_admin || ['super_admin', 'admin', 'management', 'read_only'].includes(staff?.system_role);

  const tiles = [
    { label: "Today's Schedule", icon: CalendarDays, path: '/today-schedule', gradient: 'stat-gradient-brand' },
    { label: 'Tools', icon: Wrench, path: '/tools', gradient: 'stat-gradient-sky' },
    { label: 'Scan', icon: ScanLine, path: '/scanner', gradient: 'stat-gradient-emerald' },
    ...(staff?.delivery_dashboard_enabled ? [{ label: 'Deliveries', icon: Truck, path: '/deliveries', gradient: 'stat-gradient-blue' }] : []),
    { label: 'My Duties', icon: ClipboardList, path: '/my-duties', gradient: 'stat-gradient-amber' },
    { label: 'Profile', icon: UserCircle, path: '/staff-profile', gradient: 'stat-gradient-violet' },
    ...((inboxCounts?.total || 0) > 0 ? [{ label: 'Inbox', icon: Inbox, path: '/inbox', gradient: 'stat-gradient-rose', badge: inboxCounts.total }] : []),
    { label: 'Help', icon: HelpCircle, path: '/help-field', gradient: 'stat-gradient-slate' },
    ...(isAdmin ? [{ label: 'Admin', icon: LayoutDashboard, path: '/admin', gradient: 'stat-gradient-teal' }] : []),
    ...(isAdmin ? [{ label: 'My Team', icon: Users, path: '/manager-team', gradient: 'stat-gradient-indigo' }] : []),
  ];

  return (
    <div className="pb-6">
      <FieldGreetingHeader staff={staff} accentColor={activeDivision?.color} />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-4 sm:px-6 mt-4"
      >
        {tiles.map(tile => {
          const Icon = tile.icon;
          return (
            <motion.button
              key={tile.label}
              variants={slideUp}
              whileTap={{ scale: 0.94 }}
              whileHover={{ scale: 1.03 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              onClick={() => navigate(tile.path)}
              type="button"
              className="field-card p-4 flex flex-col items-center gap-3 text-center touch-manipulation"
            >
              <div className={`relative w-14 h-14 rounded-2xl ${tile.gradient} flex items-center justify-center shadow-md`}>
                <Icon className="w-7 h-7 text-white" strokeWidth={2.5} />
                {tile.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-[#8DC63F] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow-sm">
                    {tile.badge > 9 ? '9+' : tile.badge}
                  </span>
                )}
              </div>
              <span className="text-sm font-bold text-slate-800">{tile.label}</span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}