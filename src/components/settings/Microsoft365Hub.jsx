import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar, Files, MessageSquare, HardDrive, Loader2, CheckCircle2,
  AlertCircle, ExternalLink, Copy, KeyRound, Building2, Shield, Cloud,
  Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';
import { useToast } from '@/components/ui/use-toast';

const SETTING_KEY = 'm365_config';

const SERVICES = [
  {
    id: 'outlook',
    name: 'Outlook Calendar & Email',
    icon: Calendar,
    color: 'bg-blue-100 text-blue-600',
    desc: 'Two-way rota sync to staff calendars + email notifications',
    scopes: 'Calendars.ReadWrite, Mail.ReadWrite, User.Read, offline_access',
    connectorName: 'Microsoft 365 — Outlook',
  },
  {
    id: 'share_point',
    name: 'SharePoint Documents',
    icon: Files,
    color: 'bg-emerald-100 text-emerald-600',
    desc: 'Mirror job documents to SharePoint folders for corporate records',
    scopes: 'Files.ReadWrite.All, Sites.ReadWrite.All, User.Read, offline_access',
    connectorName: 'Microsoft 365 — SharePoint',
  },
  {
    id: 'microsoft_teams',
    name: 'Teams Notifications',
    icon: MessageSquare,
    color: 'bg-violet-100 text-violet-600',
    desc: 'Send job alerts and assignment notifications to Teams channels',
    scopes: 'ChannelMessage.Send, Team.ReadBasic.All, Chat.ReadWrite, OnlineMeetings.ReadWrite, User.Read, offline_access',
    connectorName: 'Microsoft 365 — Teams',
  },
  {
    id: 'one_drive',
    name: 'OneDrive Files',
    icon: HardDrive,
    color: 'bg-amber-100 text-amber-600',
    desc: 'Upload, download, and manage files in staff OneDrive',
    scopes: 'Files.ReadWrite.All, User.Read, offline_access',
    connectorName: 'Microsoft 365 — OneDrive',
  },
];

export default function Microsoft365Hub() {
  // Microsoft 365 Hub — unified Azure AD SSO, Outlook, Teams, OneDrive & SharePoint
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [config, setConfig] = useState({ tenant_id: '', client_id: '', client_secret: '' });
  const [settingId, setSettingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const existing = await base44.entities.AppSetting.filter({ key: SETTING_KEY });
        if (existing.length > 0) {
          setSettingId(existing[0].id);
          setConfig(existing[0].value || { tenant_id: '', client_id: '', client_secret: '' });
        }
      } catch (e) {
        // AppSetting may not exist yet
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settingId) {
        await base44.entities.AppSetting.update(settingId, { key: SETTING_KEY, value: config });
      } else {
        const created = await base44.entities.AppSetting.create({ key: SETTING_KEY, value: config });
        setSettingId(created.id);
      }
      await queryClient.invalidateQueries({ queryKey: ['all-integration-configs'] });
      toast({ title: 'Microsoft 365 credentials saved', description: 'Register the four connectors below using these credentials.' });
    } catch (e) {
      toast({ title: 'Error saving', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const isConfigured = !!(config.tenant_id && config.client_id && config.client_secret);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SettingsSectionHeader
        icon={Cloud}
        title="Microsoft 365 SSO"
        description="One Azure AD app registration powers Outlook Calendar, SharePoint, Teams, and OneDrive. Staff connect once and get all four services."
        actions={
          <button onClick={() => navigate('/m365-setup-guide')} type="button"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#244715] transition active:scale-95 touch-manipulation shadow-sm">
            <Download className="w-4 h-4" />
            <span>IT Setup Guide PDF</span>
          </button>
        }
      />

      {/* Status banner */}
      {isConfigured ? (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Azure AD app registered and ready</p>
            <p className="text-xs text-emerald-600 mt-0.5">Register the four workspace connectors below using these credentials, then staff can connect their Microsoft 365 accounts.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Setup required</p>
            <p className="text-xs text-amber-700 mt-0.5">Create one Azure AD app registration with all the scopes below, then enter the credentials here. One app covers all four services.</p>
          </div>
        </div>
      )}

      {/* Setup guide */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Azure AD App Registration — Step by Step</h3>
        </div>
        <ol className="space-y-2.5 text-sm text-slate-600">
          <li className="flex gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">1</span>
            <span>Go to the <button onClick={() => window.open('https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade', '_blank')} className="text-[#2E5A1A] underline font-medium inline-flex items-center gap-0.5">Azure portal — App registrations <ExternalLink className="w-3 h-3" /></button> and click "New registration".</span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">2</span>
            <span>Name it "GC Mission Control M365 Integration" and select "Accounts in this organizational directory only" (single tenant).</span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">3</span>
            <span>Add a redirect URI (Web platform). Copy the value below into the Azure portal:</span>
          </li>
          <li className="flex gap-2.5 ml-7">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <code className="text-xs text-slate-700 flex-1 break-all">https://api.base44.com/v1/oauth/callback/outlook</code>
              <button onClick={() => handleCopy('https://api.base44.com/v1/oauth/callback/outlook', 'Redirect URI')} className="flex-shrink-0 p-1.5 hover:bg-slate-200 rounded transition">
                <Copy className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </li>
          <li className="flex gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">4</span>
            <span>Go to "API permissions" → Add permission → Microsoft Graph → Delegated → add ALL of these scopes:</span>
          </li>
          <li className="flex gap-2.5 ml-7">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <code className="text-xs text-slate-700 break-all">Calendars.ReadWrite, Mail.ReadWrite, Files.ReadWrite.All, Sites.ReadWrite.All, ChannelMessage.Send, Team.ReadBasic.All, Chat.ReadWrite, OnlineMeetings.ReadWrite, User.Read, offline_access</code>
            </div>
          </li>
          <li className="flex gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">5</span>
            <span>Go to "Certificates & secrets" → New client secret → copy the secret value (shown only once).</span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">6</span>
            <span>Copy the <strong>Tenant ID</strong> and <strong>Application (client) ID</strong> from the Overview page, and paste all three values below.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">7</span>
            <span>Register the four workspace connectors in <strong>Settings → OAuth Connectors</strong> using the same client_id, client_secret, and tenant_id. One per service (Outlook, SharePoint, Teams, OneDrive).</span>
          </li>
        </ol>
      </div>

      {/* Credential form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#2E5A1A]" />
          <h3 className="text-sm font-bold text-slate-800">Azure AD Credentials (shared across all four services)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
              <Building2 className="w-3.5 h-3.5" /> Tenant ID
            </label>
            <input
              value={config.tenant_id}
              onChange={e => setConfig(c => ({ ...c, tenant_id: e.target.value }))}
              placeholder="e.g. 8d3c2b1a-..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
              <KeyRound className="w-3.5 h-3.5" /> Application (Client) ID
            </label>
            <input
              value={config.client_id}
              onChange={e => setConfig(c => ({ ...c, client_id: e.target.value }))}
              placeholder="e.g. a1b2c3d4-..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
            <Shield className="w-3.5 h-3.5" /> Client Secret
          </label>
          <input
            type="password"
            value={config.client_secret}
            onChange={e => setConfig(c => ({ ...c, client_secret: e.target.value }))}
            placeholder="Paste the client secret value from Azure"
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-emerald-100"
          />
          <p className="text-xs text-slate-400 mt-1">The secret is stored securely in your app settings and never exposed to the frontend.</p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving || (!config.tenant_id && !config.client_id && !config.client_secret)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#244715] transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Credentials
          </button>
        </div>
      </div>

      {/* Service cards */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3">Services Enabled by This Integration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SERVICES.map(service => {
            const Icon = service.icon;
            return (
              <div key={service.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${service.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-slate-800">{service.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{service.desc}</p>
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Scopes</p>
                    <p className="text-xs text-slate-500 mt-0.5 break-words">{service.scopes}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* What happens next */}
      {isConfigured && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-2">
          <h3 className="text-sm font-bold text-blue-800">What happens next?</h3>
          <ul className="text-sm text-blue-700 space-y-1.5 list-disc pl-5">
            <li>Register the four workspace connectors in Settings → OAuth Connectors (Outlook, SharePoint, Teams, OneDrive) using the same Azure AD credentials.</li>
            <li>Each staff member sees a "Connect Microsoft 365" button on their profile page.</li>
            <li>They sign in once with their Microsoft 365 work account and consent to all four services.</li>
            <li>Calendar sync, document sharing, Teams notifications, and OneDrive file access all activate from that single connection.</li>
          </ul>
        </div>
      )}
    </div>
  );
}