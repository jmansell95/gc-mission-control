import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Save, Loader2, UserCog, Mail, Info } from 'lucide-react';

/**
 * AccessGateSettings — admin Settings page for configuring the access
 * gate. Admins select which users are "approvers" (shown to pending
 * users as contacts) and set optional contact instructions.
 *
 * The config is stored in an AppSetting with key 'access_gate_config'.
 */
export default function AccessGateSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedApproverIds, setSelectedApproverIds] = useState([]);
  const [contactInstructions, setContactInstructions] = useState('');
  const [configId, setConfigId] = useState(null);

  // Fetch all admin users (potential approvers)
  const { data: adminUsers = [], isLoading: adminsLoading } = useQuery({
    queryKey: ['admin-users-for-gate'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
  });

  // Fetch existing config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['access-gate-config'],
    queryFn: async () => {
      const results = await base44.entities.AppSetting.filter({ key: 'access_gate_config' });
      return results[0] || null;
    },
  });

  // Populate form when config loads
  useEffect(() => {
    if (config) {
      setConfigId(config.id);
      const val = config.value || {};
      setSelectedApproverIds(val.approver_user_ids || []);
      setContactInstructions(val.contact_instructions || '');
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        key: 'access_gate_config',
        value: {
          approver_user_ids: selectedApproverIds,
          contact_instructions: contactInstructions,
        },
      };
      if (configId) {
        await base44.entities.AppSetting.update(configId, payload);
      } else {
        const created = await base44.entities.AppSetting.create(payload);
        setConfigId(created.id);
      }
    },
    onSuccess: () => {
      toast({ title: 'Access gate settings saved' });
      qc.invalidateQueries({ queryKey: ['access-gate-config'] });
    },
    onError: (e) => toast({ title: 'Failed to save', description: e.message || 'Unknown error', variant: 'destructive' }),
  });

  const isLoading = adminsLoading || configLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const toggleApprover = (userId) => {
    setSelectedApproverIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">How the access gate works</p>
          <p className="text-xs text-blue-700 mt-1">
            When someone signs in with Microsoft SSO for the first time, they're held in a
            "pending" state until an approver grants access. The approvers you select below
            receive an email notification and their names appear on the pending user's screen
            as contacts. Creating a Staff record with a matching email auto-approves the user.
          </p>
        </div>
      </div>

      {/* Approver selection */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <UserCog className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-900">Approver Group</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Select which users can approve access requests. These people will be shown to pending
          users as contacts and will receive email notifications when someone new is waiting.
        </p>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {adminUsers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No users found.</p>
          ) : (
            adminUsers.map((u) => {
              const isSelected = selectedApproverIds.includes(u.id);
              const isAdmin = u.role === 'admin';
              return (
                <button
                  key={u.id}
                  onClick={() => toggleApprover(u.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                    isSelected
                      ? 'bg-[#2E5A1A]/5 border-[#2E5A1A]/30'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-[#2E5A1A] border-[#2E5A1A]' : 'border-slate-300'
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {u.full_name || 'No name set'}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{u.email}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <span className="text-[10px] font-bold text-[#2E5A1A] bg-[#2E5A1A]/10 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Admin
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Contact instructions */}
      <div>
        <label className="text-sm font-semibold text-slate-700">Contact Instructions (optional)</label>
        <p className="text-xs text-slate-500 mb-2">
          Custom text shown to pending users alongside the approver contacts.
          e.g. "Call Jordan on 07xxx to request access."
        </p>
        <textarea
          value={contactInstructions}
          onChange={(e) => setContactInstructions(e.target.value)}
          rows={2}
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/20 focus:border-[#2E5A1A]/30"
          placeholder="e.g. Contact Jordan Mansell on 07xxx xxxxxx to request access."
        />
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-[#2E5A1A] hover:bg-[#1c4a12] text-white"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}