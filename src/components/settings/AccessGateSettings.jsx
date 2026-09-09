import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Save, Loader2, Info, UserCog } from 'lucide-react';
import LoginFlowPreview from '@/components/settings/LoginFlowPreview';

/**
 * AccessGateSettings — admin Settings page for configuring the access gate.
 *
 * Approvers are now designated via the 'Access Approver' toggle on each
 * staff card (super admins only). This page manages only the optional
 * contact instructions shown to pending users alongside the approver list.
 */
export default function AccessGateSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [contactInstructions, setContactInstructions] = useState('');
  const [configId, setConfigId] = useState(null);

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
      setContactInstructions(val.contact_instructions || '');
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        key: 'access_gate_config',
        value: { contact_instructions: contactInstructions },
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

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-900">How the access gate works</p>
          <p className="text-xs text-blue-700 mt-1">
            When someone signs in with Microsoft SSO for the first time, they're held in a
            "pending" state until an approver grants access. Approvers are designated via
            the 'Access Approver' toggle on each staff card (super admins only). Creating
            a Staff record with a matching email auto-approves the user.
          </p>
        </div>
      </div>

      {/* Approver pointer */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-[#2E5A1A]/5 border border-[#2E5A1A]/15">
        <UserCog className="w-4 h-4 text-[#2E5A1A] flex-shrink-0" />
        <p className="text-xs text-slate-600">
          To add or remove approvers, open the staff member's card and toggle
          'Access Approver' in the Access Control section.
        </p>
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

      {/* Login Flow Preview — pixel-accurate preview of each gate state */}
      <div className="pt-2 border-t border-slate-100">
        <LoginFlowPreview contactInstructions={contactInstructions} />
      </div>
    </div>
  );
}