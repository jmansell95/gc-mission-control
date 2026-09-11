import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { UserCheck, Save, Loader2, Plus, Trash2, Info } from 'lucide-react';

/**
 * RequestRoutingManager — Settings page for configuring where staff requests
 * (equipment, general, payslip, expense) are routed.
 *
 * For each request type, admins can assign:
 *   - Specific staff members (assignee_staff_ids)
 *   - A role keyword (assignee_role_key — matched against Staff.job_title,
 *     case-insensitive contains)
 *   - Fallback to admins when no assignees resolve
 *
 * On StaffRequest creation, the routeStaffRequest backend function reads this
 * config and creates an InboxItem for each matched recipient.
 *
 * Stored in AppSetting (key: 'request_routing') as a JSON value.
 */

const REQUEST_TYPES = [
  { key: 'equipment', label: 'Equipment Request', desc: 'Crew requesting gear, tools or plant' },
  { key: 'general', label: 'General Request', desc: 'Anything else crew need from the office' },
];

export default function RequestRoutingManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rules, setRules] = useState({});
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { data: configRecord, isLoading } = useQuery({
    queryKey: ['app-setting', 'request_routing'],
    queryFn: async () => {
      const list = await base44.entities.AppSetting.filter({ key: 'request_routing' });
      return list[0] || null;
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['active-staff-for-routing'],
    queryFn: () => base44.entities.Staff.filter({ is_active: true }, 'name', 500),
  });

  useEffect(() => {
    if (configRecord && !initialized) {
      const value = configRecord.value || {};
      setRules(value.rules ? Object.fromEntries(value.rules.map(r => [r.request_type, r])) : {});
      setInitialized(true);
    } else if (!configRecord && !initialized && !isLoading) {
      // Seed defaults
      const defaults = {};
      REQUEST_TYPES.forEach(t => {
        defaults[t.key] = { request_type: t.key, assignee_staff_ids: [], assignee_role_key: '', fallback_admins: true };
      });
      setRules(defaults);
      setInitialized(true);
    }
  }, [configRecord, initialized, isLoading]);

  const updateRule = (typeKey, field, value) => {
    setRules(prev => ({
      ...prev,
      [typeKey]: { ...(prev[typeKey] || { request_type: typeKey, assignee_staff_ids: [], assignee_role_key: '', fallback_admins: true }), [field]: value },
    }));
  };

  const toggleStaff = (typeKey, staffId) => {
    const current = rules[typeKey]?.assignee_staff_ids || [];
    updateRule(typeKey, 'assignee_staff_ids', current.includes(staffId) ? current.filter(id => id !== staffId) : [...current, staffId]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        key: 'request_routing',
        label: 'Request Routing',
        value: { rules: REQUEST_TYPES.map(t => rules[t.key] || { request_type: t.key, assignee_staff_ids: [], assignee_role_key: '', fallback_admins: true }) },
      };
      if (configRecord?.id) {
        await base44.entities.AppSetting.update(configRecord.id, payload);
      } else {
        await base44.entities.AppSetting.create(payload);
      }
      queryClient.invalidateQueries({ queryKey: ['app-setting', 'request_routing'] });
      toast({ title: 'Request routing saved', description: 'New requests will be routed to the configured staff.' });
    } catch (err) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <SettingsSectionHeader
        icon={UserCheck}
        title="Request Routing"
        description="Route staff requests (equipment, general) to the right people — specific staff or by role — straight into their inbox"
        actions={
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-bold transition active:scale-95 shadow-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Routing
          </button>
        }
      />

      <div className="insight-card rounded-2xl p-4 mb-4 bg-indigo-50/60 border-indigo-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">How it works</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              When a staff member submits a request, the system reads these rules and creates an inbox item for each matched recipient.
              Assign specific staff, a role keyword (matched against job titles), or both. If no assignees resolve, the request falls back to admins.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {REQUEST_TYPES.map(typeMeta => {
          const rule = rules[typeMeta.key] || { request_type: typeMeta.key, assignee_staff_ids: [], assignee_role_key: '', fallback_admins: true };
          const assignedIds = rule.assignee_staff_ids || [];
          return (
            <div key={typeMeta.key} className="insight-card rounded-2xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#2E5A1A]" />
                  <h3 className="text-sm font-bold text-slate-700">{typeMeta.label}</h3>
                  <span className="text-[10px] text-slate-400">{typeMeta.desc}</span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {/* Role keyword */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">Role keyword (optional)</label>
                  <input
                    type="text"
                    value={rule.assignee_role_key || ''}
                    onChange={e => updateRule(typeMeta.key, 'assignee_role_key', e.target.value)}
                    placeholder="e.g. warehouse, office manager, fitter"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2E5A1A] transition"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">All active staff whose job title contains this keyword will receive the request.</p>
                </div>

                {/* Specific staff */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1.5">Specific staff (optional)</label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                    {staffList.map(s => {
                      const checked = assignedIds.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStaff(typeMeta.key, s.id)}
                            className="w-4 h-4 rounded accent-[#2E5A1A]"
                          />
                          <span className="text-sm text-slate-700 flex-1 truncate">{s.name}</span>
                          {s.job_title && <span className="text-[10px] text-slate-400 truncate">{s.job_title}</span>}
                        </label>
                      );
                    })}
                    {staffList.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">No active staff found.</p>}
                  </div>
                </div>

                {/* Fallback */}
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rule.fallback_admins !== false}
                    onChange={e => updateRule(typeMeta.key, 'fallback_admins', e.target.checked)}
                    className="w-4 h-4 rounded accent-[#2E5A1A]"
                  />
                  <span className="text-sm text-slate-700">Fall back to admins when no assignees match</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}