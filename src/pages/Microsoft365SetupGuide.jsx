import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, Download, Loader2, ArrowLeft, Printer } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

export default function Microsoft365SetupGuide() {
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);

  const handleDownloadPDF = () => {
    setGenerating(true);
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>GC Mission Control — Microsoft 365 & Entra ID Setup Guide</title>
  <style>
    @page { margin: 1.8cm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; line-height: 1.55; margin: 0; padding: 0; font-size: 13px; }
    .cover { text-align: center; padding: 70px 20px 50px; page-break-after: always; background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%); }
    .cover-logo { width: 72px; height: 72px; margin: 0 auto 24px; background: linear-gradient(135deg, #2E5A1A, #8DC63F); border-radius: 18px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px -8px rgba(46,90,26,0.4); }
    .cover-logo span { font-size: 36px; }
    .cover h1 { font-size: 30px; color: #2E5A1A; margin: 0 0 10px; font-weight: 800; letter-spacing: -0.02em; }
    .cover .subtitle { font-size: 16px; color: #475569; margin: 0 0 8px; font-weight: 500; }
    .cover .audience { font-size: 13px; color: #64748b; margin: 0 0 30px; }
    .cover .meta { font-size: 12px; color: #94a3b8; }
    .cover .stats { display: flex; gap: 28px; justify-content: center; margin-top: 44px; }
    .cover .stat { text-align: center; }
    .cover .stat .num { font-size: 32px; font-weight: 800; color: #2E5A1A; }
    .cover .stat .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

    .toc { page-break-after: always; padding-top: 10px; }
    .toc h2 { color: #2E5A1A; font-size: 20px; border-bottom: 2px solid #d1fae5; padding-bottom: 8px; margin-bottom: 16px; }
    .toc ol { padding-left: 22px; }
    .toc li { margin-bottom: 8px; font-size: 13px; }
    .toc li .page { color: #94a3b8; font-size: 11px; }

    .section { margin-bottom: 24px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; }
    .section-num { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #2E5A1A, #4d7c2a); color: white; font-size: 15px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .section-title { font-size: 17px; font-weight: 700; color: #1e293b; margin: 0; }
    .section-desc { font-size: 12px; color: #64748b; margin: 2px 0 0; }

    .step { margin-bottom: 14px; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; page-break-inside: avoid; background: #fafafa; }
    .step-num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #2E5A1A; color: white; font-size: 11px; font-weight: 700; margin-right: 8px; vertical-align: middle; }
    .step-title { font-size: 13px; font-weight: 700; color: #1e293b; display: inline; }
    .step-body { font-size: 12px; color: #475569; margin: 6px 0 0 30px; }
    .step-body p { margin: 0 0 6px; }
    .step-body ul { margin: 4px 0 6px; padding-left: 18px; }
    .step-body li { margin-bottom: 3px; }

    .code-block { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace; font-size: 11px; color: #334155; margin: 8px 0; word-break: break-all; }
    .code-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }

    .callout { border-radius: 10px; padding: 12px 14px; margin: 10px 0; font-size: 12px; page-break-inside: avoid; }
    .callout-warn { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; }
    .callout-info { background: #dbeafe; border: 1px solid #bfdbfe; color: #1e40af; }
    .callout-danger { background: #fee2e2; border: 1px solid #fecaca; color: #991b1b; }
    .callout-success { background: #d1fae5; border: 1px solid #a7f3d0; color: #065f46; }
    .callout strong { font-weight: 700; }

    .table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px; }
    .table th { background: #2E5A1A; color: white; text-align: left; padding: 8px 10px; font-weight: 600; font-size: 11px; }
    .table td { border: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; }
    .table tr:nth-child(even) td { background: #f8fafc; }

    .footer { text-align: center; padding: 20px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 30px; }
    .page-break { page-break-before: always; }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover">
    <div class="cover-logo"><span>☁️</span></div>
    <h1>Microsoft 365 &amp; Entra ID</h1>
    <p class="subtitle">Integration Setup Guide</p>
    <p class="audience">For IT Department / Azure Administrators</p>
    <p class="meta">GC Mission Control · Generated ${dateStr}</p>
    <div class="stats">
      <div class="stat"><div class="num">9</div><div class="label">Sections</div></div>
      <div class="stat"><div class="num">~45</div><div class="label">Minutes</div></div>
      <div class="stat"><div class="num">4</div><div class="label">Services</div></div>
    </div>
  </div>

  <!-- TABLE OF CONTENTS -->
  <div class="toc">
    <h2>Table of Contents</h2>
    <ol>
      <li><strong>Overview &amp; Objectives</strong> — what this integration achieves</li>
      <li><strong>Prerequisites</strong> — what you need before starting</li>
      <li><strong>Azure AD App Registration</strong> — creating the app in Entra ID</li>
      <li><strong>Authentication &amp; Redirect URIs</strong> — configuring the web platform</li>
      <li><strong>API Permissions &amp; Scopes</strong> — granting Microsoft Graph access</li>
      <li><strong>Client Secret</strong> — generating the app credential</li>
      <li><strong>Enter Credentials in GC Mission Control</strong> — completing the app config</li>
      <li><strong>Register Workspace Connectors</strong> — enabling the four services</li>
      <li><strong>Conditional Access &amp; MFA (Microsoft Authenticator)</strong> — enforcing multi-factor auth</li>
      <li><strong>Testing &amp; Verification</strong> — confirming everything works</li>
      <li><strong>Troubleshooting</strong> — common issues and fixes</li>
    </ol>
  </div>

  <!-- SECTION 1 -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">1</div>
      <div>
        <h3 class="section-title">Overview &amp; Objectives</h3>
        <p class="section-desc">What this integration achieves for GC Mission Control</p>
      </div>
    </div>
    <p style="font-size:12px;color:#475569;margin:0 0 10px;">This guide sets up a single Microsoft Entra ID (Azure AD) app registration that powers four integrated services within GC Mission Control. Staff sign in once with their Microsoft 365 work account and gain access to all four.</p>
    <table class="table">
      <tr><th style="width:30%">Service</th><th style="width:40%">What It Does</th><th style="width:30%">Staff Benefit</th></tr>
      <tr><td><strong>Outlook Calendar &amp; Email</strong></td><td>Two-way rota sync to staff calendars + email notifications</td><td>See their work schedule in their phone calendar automatically</td></tr>
      <tr><td><strong>SharePoint Documents</strong></td><td>Mirror job documents to SharePoint folders for corporate records</td><td>Centralised document storage and audit trail</td></tr>
      <tr><td><strong>Teams Notifications</strong></td><td>Send job alerts and assignment notifications to Teams channels</td><td>Real-time alerts without checking a separate app</td></tr>
      <tr><td><strong>OneDrive Files</strong></td><td>Upload, download, and manage files in staff OneDrive</td><td>Access site photos and documents from anywhere</td></tr>
    </table>
    <div class="callout callout-info">
      <strong>Single Sign-On (SSO):</strong> Once configured, staff use their existing Microsoft 365 work email and password to log into GC Mission Control — no separate password to remember.
    </div>
  </div>

  <!-- SECTION 2 -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">2</div>
      <div>
        <h3 class="section-title">Prerequisites</h3>
        <p class="section-desc">What you need before starting</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">✓</span><span class="step-title">Azure AD Administrator Access</span>
      <div class="step-body">
        <p>You need an account with one of these roles in your organisation's Microsoft 365 / Azure tenant:</p>
        <ul>
          <li><strong>Global Administrator</strong> (recommended — can do everything)</li>
          <li><strong>Application Administrator</strong> (can register apps and grant permissions)</li>
          <li><strong>Cloud Application Administrator</strong> (can register apps)</li>
        </ul>
      </div>
    </div>
    <div class="step">
      <span class="step-num">✓</span><span class="step-title">Microsoft 365 Tenant</span>
      <div class="step-body">
        <p>Your organisation must have an active Microsoft 365 subscription with Entra ID (Azure AD). Most business plans (Business Standard, Business Premium, E3, E5) include this.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">✓</span><span class="step-title">GC Mission Control App URL</span>
      <div class="step-body">
        <p>Confirm the published app URL with the GC Mission Control app builder. The redirect URI (Section 4) must match exactly.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">✓</span><span class="step-title">Approximate Time</span>
      <div class="step-body">
        <p>Allow <strong>30–45 minutes</strong> for the full setup, including app registration, permissions, secret generation, and connector registration.</p>
      </div>
    </div>
  </div>

  <!-- SECTION 3 -->
  <div class="section page-break">
    <div class="section-header">
      <div class="section-num">3</div>
      <div>
        <h3 class="section-title">Azure AD App Registration</h3>
        <p class="section-desc">Creating the app in Entra ID</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">1</span><span class="step-title">Open the Azure Portal</span>
      <div class="step-body">
        <p>Navigate to the Azure portal and sign in with your admin account:</p>
        <div class="code-block">https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade</div>
        <p>Or go to <strong>portal.azure.com → Microsoft Entra ID → App registrations → New registration</strong>.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">2</span><span class="step-title">Create a New Registration</span>
      <div class="step-body">
        <p>Click <strong>"New registration"</strong> and fill in:</p>
        <ul>
          <li><strong>Name:</strong> <code>GC Mission Control M365 Integration</code></li>
          <li><strong>Supported account types:</strong> Select <strong>"Accounts in this organizational directory only"</strong> (single tenant) — this is the most secure option for internal staff only.</li>
        </ul>
        <div class="callout callout-warn">
          <strong>Note:</strong> Do NOT select "Accounts in any organizational directory" unless you plan to allow external contractors to log in with their own Microsoft accounts. For internal staff only, single tenant is correct.
        </div>
      </div>
    </div>
    <div class="step">
      <span class="step-num">3</span><span class="step-title">Click "Register"</span>
      <div class="step-body">
        <p>The app is created. You'll land on the <strong>Overview</strong> page. Note down these two values — you'll need them later:</p>
        <ul>
          <li><strong>Application (client) ID</strong> — a GUID like <code>a1b2c3d4-e5f6-7890-abcd-ef1234567890</code></li>
          <li><strong>Directory (tenant) ID</strong> — a GUID like <code>8d3c2b1a-1234-5678-9abc-def012345678</code></li>
        </ul>
      </div>
    </div>
  </div>

  <!-- SECTION 4 -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">4</div>
      <div>
        <h3 class="section-title">Authentication &amp; Redirect URIs</h3>
        <p class="section-desc">Configuring the web platform</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">1</span><span class="step-title">Open the Authentication Settings</span>
      <div class="step-body">
        <p>In the left sidebar of your app registration, click <strong>"Authentication"</strong>.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">2</span><span class="step-title">Add a Web Platform</span>
      <div class="step-body">
        <p>Click <strong>"Add a platform"</strong> → select <strong>"Web"</strong>.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">3</span><span class="step-title">Add the Redirect URI</span>
      <div class="step-body">
        <p>Paste this exact URI into the <strong>Redirect URI</strong> field:</p>
        <div class="code-label">Redirect URI (copy exactly):</div>
        <div class="code-block">https://api.base44.com/v1/oauth/callback/outlook</div>
        <div class="callout callout-danger">
          <strong>Important:</strong> This URI must match exactly — no trailing slash, no http vs https mismatch. If it doesn't match, the login will fail with an "AADSTS50011" error.
        </div>
      </div>
    </div>
    <div class="step">
      <span class="step-num">4</span><span class="step-title">Configure Logout URL (Optional)</span>
      <div class="step-body">
        <p>In the same screen, you can optionally add a <strong>Logout URL</strong>:</p>
        <div class="code-block">https://api.base44.com/v1/oauth/callback/outlook</div>
      </div>
    </div>
    <div class="step">
      <span class="step-num">5</span><span class="step-title">Enable Tokens and Save</span>
      <div class="step-body">
        <p>Under <strong>"Implicit grant and hybrid flows"</strong>, check <strong>"Access tokens"</strong> and <strong>"ID tokens"</strong>. Click <strong>"Save"</strong> at the top.</p>
      </div>
    </div>
  </div>

  <!-- SECTION 5 -->
  <div class="section page-break">
    <div class="section-header">
      <div class="section-num">5</div>
      <div>
        <h3 class="section-title">API Permissions &amp; Scopes</h3>
        <p class="section-desc">Granting Microsoft Graph access</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">1</span><span class="step-title">Open API Permissions</span>
      <div class="step-body">
        <p>In the left sidebar, click <strong>"API permissions"</strong> → click <strong>"Add a permission"</strong>.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">2</span><span class="step-title">Select Microsoft Graph → Delegated Permissions</span>
      <div class="step-body">
        <p>Choose <strong>"Microsoft Graph"</strong> → <strong>"Delegated permissions"</strong> (NOT Application permissions — delegated is for user sign-in flows).</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">3</span><span class="step-title">Add All Required Scopes</span>
      <div class="step-body">
        <p>Search for and add each of these permissions. Use the search box to find them quickly:</p>
        <table class="table">
          <tr><th>Scope</th><th>Service</th><th>What It Allows</th></tr>
          <tr><td><code>Calendars.ReadWrite</code></td><td>Outlook</td><td>Read and write staff calendars</td></tr>
          <tr><td><code>Mail.ReadWrite</code></td><td>Outlook</td><td>Read and send email notifications</td></tr>
          <tr><td><code>Files.ReadWrite.All</code></td><td>OneDrive / SharePoint</td><td>Manage files in OneDrive and SharePoint</td></tr>
          <tr><td><code>Sites.ReadWrite.All</code></td><td>SharePoint</td><td>Access SharePoint site collections</td></tr>
          <tr><td><code>ChannelMessage.Send</code></td><td>Teams</td><td>Post messages to Teams channels</td></tr>
          <tr><td><code>Team.ReadBasic.All</code></td><td>Teams</td><td>List teams the user belongs to</td></tr>
          <tr><td><code>Chat.ReadWrite</code></td><td>Teams</td><td>Read and write chat messages</td></tr>
          <tr><td><code>OnlineMeetings.ReadWrite</code></td><td>Teams</td><td>Create and manage online meetings</td></tr>
          <tr><td><code>User.Read</code></td><td>All</td><td>Read the signed-in user's profile (required)</td></tr>
          <tr><td><code>offline_access</code></td><td>All</td><td>Maintain access to data the user authorised (refresh tokens — required)</td></tr>
        </table>
      </div>
    </div>
    <div class="step">
      <span class="step-num">4</span><span class="step-title">Grant Admin Consent</span>
      <div class="step-body">
        <p>After adding all permissions, click <strong>"Grant admin consent for [Your Organisation]"</strong> at the top of the permissions list. This pre-approves the scopes so individual staff members don't have to consent to each one manually when they sign in.</p>
        <div class="callout callout-success">
          <strong>Why this matters:</strong> Without admin consent, every staff member sees a scary "needs permission" screen on first login. With admin consent, the sign-in is smooth and silent.
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 6 -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">6</div>
      <div>
        <h3 class="section-title">Client Secret</h3>
        <p class="section-desc">Generating the app credential</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">1</span><span class="step-title">Open Certificates &amp; Secrets</span>
      <div class="step-body">
        <p>In the left sidebar, click <strong>"Certificates &amp; secrets"</strong> → click <strong>"New client secret"</strong>.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">2</span><span class="step-title">Create the Secret</span>
      <div class="step-body">
        <p>Add a description like <code>GC Mission Control production secret</code> and choose an expiry:</p>
        <ul>
          <li><strong>6 months</strong> — most secure, requires rotation</li>
          <li><strong>12 months</strong> — recommended balance</li>
          <li><strong>24 months</strong> — least maintenance</li>
        </ul>
      </div>
    </div>
    <div class="step">
      <span class="step-num">3</span><span class="step-title">Copy the Secret Value Immediately</span>
      <div class="step-body">
        <p>After clicking "Add", the <strong>Value</strong> column shows the secret. <strong>Copy it now</strong> — it is only displayed once. If you navigate away, you will not be able to retrieve it and must create a new one.</p>
        <div class="callout callout-danger">
          <strong>Critical:</strong> Copy the <strong>Value</strong> (not the Secret ID). The Value is what goes into GC Mission Control. Store it securely — treat it like a password.
        </div>
      </div>
    </div>
    <div class="step">
      <span class="step-num">4</span><span class="step-title">Note the Secret ID (Optional)</span>
      <div class="step-body">
        <p>The <strong>Secret ID</strong> is for your records — it identifies the secret in Azure but is not used by GC Mission Control.</p>
      </div>
    </div>
  </div>

  <!-- SECTION 7 -->
  <div class="section page-break">
    <div class="section-header">
      <div class="section-num">7</div>
      <div>
        <h3 class="section-title">Enter Credentials in GC Mission Control</h3>
        <p class="section-desc">Completing the app configuration</p>
      </div>
    </div>
    <p style="font-size:12px;color:#475569;margin:0 0 12px;">This step is performed by the GC Mission Control app administrator (not necessarily the IT department). Hand the three values below to the app admin.</p>
    <div class="step">
      <span class="step-num">1</span><span class="step-title">Collect the Three Values</span>
      <div class="step-body">
        <p>From the Azure portal, gather:</p>
        <table class="table">
          <tr><th>Field</th><th>Where to Find It</th><th>Example</th></tr>
          <tr><td><strong>Tenant ID</strong></td><td>App Overview → Directory (tenant) ID</td><td><code>8d3c2b1a-1234-...</code></td></tr>
          <tr><td><strong>Client ID</strong></td><td>App Overview → Application (client) ID</td><td><code>a1b2c3d4-e5f6-...</code></td></tr>
          <tr><td><strong>Client Secret</strong></td><td>Certificates &amp; secrets → Value (copied in Section 6)</td><td><code>abc123XYZ~...</code></td></tr>
        </table>
      </div>
    </div>
    <div class="step">
      <span class="step-num">2</span><span class="step-title">Open the Microsoft 365 Hub</span>
      <div class="step-body">
        <p>In GC Mission Control, go to <strong>Settings → Microsoft 365 SSO</strong>. Paste the three values into the credential form and click <strong>"Save Credentials"</strong>.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">3</span><span class="step-title">Confirm the Status Banner</span>
      <div class="step-body">
        <p>After saving, a green banner should appear: <strong>"Azure AD app registered and ready"</strong>. If you see an amber "Setup required" banner, one of the three values is missing or incorrect.</p>
      </div>
    </div>
  </div>

  <!-- SECTION 8 -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">8</div>
      <div>
        <h3 class="section-title">Register Workspace Connectors</h3>
        <p class="section-desc">Enabling the four services</p>
      </div>
    </div>
    <p style="font-size:12px;color:#475569;margin:0 0 12px;">This step is also performed by the GC Mission Control app administrator. The same Azure AD credentials are reused for all four connectors.</p>
    <div class="step">
      <span class="step-num">1</span><span class="step-title">Open OAuth Connectors</span>
      <div class="step-body">
        <p>In GC Mission Control, go to <strong>Settings → OAuth Connectors</strong> (or the Integrations Hub).</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">2</span><span class="step-title">Register Four Connectors</span>
      <div class="step-body">
        <p>Register one connector per service, using the same <strong>client_id</strong>, <strong>client_secret</strong>, and <strong>tenant_id</strong> from Section 7:</p>
        <ul>
          <li><strong>Microsoft 365 — Outlook</strong> (Calendar &amp; Email)</li>
          <li><strong>Microsoft 365 — SharePoint</strong> (Documents)</li>
          <li><strong>Microsoft 365 — Teams</strong> (Notifications)</li>
          <li><strong>Microsoft 365 — OneDrive</strong> (Files)</li>
        </ul>
      </div>
    </div>
    <div class="step">
      <span class="step-num">3</span><span class="step-title">Staff Connect Their Accounts</span>
      <div class="step-body">
        <p>Once connectors are registered, each staff member sees a <strong>"Connect Microsoft 365"</strong> button on their profile page. They sign in once with their work account and consent to all four services in a single flow.</p>
      </div>
    </div>
  </div>

  <!-- SECTION 9 -->
  <div class="section page-break">
    <div class="section-header">
      <div class="section-num">9</div>
      <div>
        <h3 class="section-title">Conditional Access &amp; MFA (Microsoft Authenticator)</h3>
        <p class="section-desc">Enforcing multi-factor authentication for staff login</p>
      </div>
    </div>
    <div class="callout callout-info">
      <strong>This is the key step for Microsoft Authenticator.</strong> Multi-factor authentication (MFA) is enforced at the <em>Entra ID level</em>, not inside GC Mission Control. When staff log in via the "Login with Microsoft" button, Entra ID automatically challenges them with the Authenticator app on their phone.
    </div>
    <div class="step">
      <span class="step-num">1</span><span class="step-title">Open Conditional Access</span>
      <div class="step-body">
        <p>In the Azure portal, go to <strong>Microsoft Entra ID → Security → Conditional Access → Policies</strong>. (Or: <strong>Protection → Conditional Access</strong> in some tenants.)</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">2</span><span class="step-title">Create a New Policy</span>
      <div class="step-body">
        <p>Click <strong>"New policy"</strong> and name it <code>GC Mission Control — Require MFA</code>.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">3</span><span class="step-title">Configure Users (Who)</span>
      <div class="step-body">
        <p>Under <strong>"Users"</strong>:</p>
        <ul>
          <li><strong>Include:</strong> Select <strong>"All users"</strong> (or a specific group like "Field Staff" if you prefer a phased rollout).</li>
          <li><strong>Exclude:</strong> Add your emergency/break-glass admin accounts to avoid lockout.</li>
        </ul>
      </div>
    </div>
    <div class="step">
      <span class="step-num">4</span><span class="step-title">Configure Cloud Apps (What)</span>
      <div class="step-body">
        <p>Under <strong>"Target resources"</strong> (or "Cloud apps"):</p>
        <ul>
          <li>Select <strong>"Select apps"</strong> → search for and select the <strong>GC Mission Control M365 Integration</strong> app you registered in Section 3.</li>
          <li>Alternatively, select <strong>"All cloud apps"</strong> to enforce MFA across the entire tenant (recommended for security, but affects all Microsoft 365 services, not just GC Mission Control).</li>
        </ul>
      </div>
    </div>
    <div class="step">
      <span class="step-num">5</span><span class="step-title">Configure Grant Controls (How)</span>
      <div class="step-body">
        <p>Under <strong>"Access controls → Grant"</strong>:</p>
        <ul>
          <li>Check <strong>"Grant access"</strong></li>
          <li>Check <strong>"Require multifactor authentication"</strong></li>
          <li>Optionally check <strong>"Require password change"</strong> for high-security environments</li>
        </ul>
      </div>
    </div>
    <div class="step">
      <span class="step-num">6</span><span class="step-title">Enable the Policy</span>
      <div class="step-body">
        <p>At the bottom, toggle <strong>"Enable policy"</strong> to <strong>"On"</strong> and click <strong>"Create"</strong>.</p>
        <div class="callout callout-warn">
          <strong>Test first:</strong> Before enabling for all users, set the policy to <strong>"Report-only"</strong> mode to preview which users would be challenged, then switch to "On" once confirmed.
        </div>
      </div>
    </div>
    <div class="step">
      <span class="step-num">7</span><span class="step-title">Staff Set Up the Authenticator App</span>
      <div class="step-body">
        <p>When a staff member next logs into GC Mission Control via "Login with Microsoft", Entra ID will prompt them to set up the <strong>Microsoft Authenticator</strong> app:</p>
        <ul>
          <li>They install <strong>Microsoft Authenticator</strong> from the App Store / Google Play on their phone.</li>
          <li>They scan a QR code shown on screen to link their work account.</li>
          <li>Future logins push an approval notification to their phone — they tap "Approve" and enter the matching number.</li>
        </ul>
        <p>Each staff member only does this setup once. After that, MFA is a quick phone tap on each login.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">8</span><span class="step-title">Optional: Security Defaults</span>
      <div class="step-body">
        <p>If your tenant doesn't have Conditional Access licences (Business Basic/Standard include it), you can enable <strong>"Security Defaults"</strong> instead:</p>
        <ul>
          <li>Go to <strong>Microsoft Entra ID → Properties → Security defaults</strong></li>
          <li>Toggle to <strong>"Enabled"</strong></li>
          <li>This enforces MFA for ALL users across ALL apps — simpler but less granular than Conditional Access.</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- SECTION 10 -->
  <div class="section">
    <div class="section-header">
      <div class="section-num">10</div>
      <div>
        <h3 class="section-title">Testing &amp; Verification</h3>
        <p class="section-desc">Confirming everything works</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">1</span><span class="step-title">Test the Login Flow</span>
      <div class="step-body">
        <p>Open the GC Mission Control login page in a private/incognito browser window. Click <strong>"Continue with Google"</strong> — wait, that's the wrong button. Look for the <strong>"Login with Microsoft"</strong> button (if not present, the app admin needs to enable it — see Section 7).</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">2</span><span class="step-title">Verify the MFA Challenge</span>
      <div class="step-body">
        <p>After entering your Microsoft 365 work email and password, you should be prompted by the Microsoft Authenticator app on your phone. Approve the notification and confirm you are redirected back into GC Mission Control.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">3</span><span class="step-title">Test a Staff Member</span>
      <div class="step-body">
        <p>Have a non-admin staff member test the login. If they see a "needs admin consent" error, return to Section 5 Step 4 and ensure admin consent was granted for all scopes.</p>
      </div>
    </div>
    <div class="step">
      <span class="step-num">4</span><span class="step-title">Verify Service Connections</span>
      <div class="step-body">
        <p>After login, the staff member should see a <strong>"Connect Microsoft 365"</strong> button on their profile page. Clicking it should complete without error and enable calendar sync, Teams notifications, etc.</p>
      </div>
    </div>
  </div>

  <!-- SECTION 11 -->
  <div class="section page-break">
    <div class="section-header">
      <div class="section-num">11</div>
      <div>
        <h3 class="section-title">Troubleshooting</h3>
        <p class="section-desc">Common issues and fixes</p>
      </div>
    </div>
    <table class="table">
      <tr><th style="width:35%">Error / Symptom</th><th style="width:65%">Likely Cause &amp; Fix</th></tr>
      <tr>
        <td><strong>AADSTS50011: Reply URL does not match</strong></td>
        <td>The redirect URI in Azure (Section 4) doesn't match exactly. Ensure it is <code>https://api.base44.com/v1/oauth/callback/outlook</code> with no trailing slash.</td>
      </tr>
      <tr>
        <td><strong>AADSTS65001: User or administrator has not consented</strong></td>
        <td>Admin consent was not granted (Section 5 Step 4). Return to API Permissions and click "Grant admin consent for [Your Organisation]".</td>
      </tr>
      <tr>
        <td><strong>AADSTS7000215: Invalid client secret</strong></td>
        <td>The client secret value is wrong or expired. Generate a new one (Section 6) and update it in GC Mission Control (Section 7).</td>
      </tr>
      <tr>
        <td><strong>AADSTS700003: Invalid client ID</strong></td>
        <td>The Application (client) ID was copied incorrectly. Re-copy from the app Overview page.</td>
      </tr>
      <tr>
        <td><strong>"Login with Microsoft" button missing</strong></td>
        <td>The app admin hasn't saved the Azure AD credentials yet (Section 7). The button only appears once credentials are configured.</td>
      </tr>
      <tr>
        <td><strong>Staff see "needs permission" screen on login</strong></td>
        <td>Admin consent not granted for all scopes (Section 5 Step 4). Grant consent and have the staff member retry.</td>
      </tr>
      <tr>
        <td><strong>MFA not triggering</strong></td>
        <td>Conditional Access policy is in "Report-only" mode or not enabled. Set it to "On" (Section 9 Step 6). Also confirm the policy targets the correct app or "All cloud apps".</td>
      </tr>
      <tr>
        <td><strong>Staff locked out after enabling MFA</strong></td>
        <td>They haven't set up the Authenticator app yet. Have them complete the setup at <code>aka.ms/mfasetup</code> from a device they're already signed in on, or use a temporary access pass.</td>
      </tr>
      <tr>
        <td><strong>Calendar sync not working</strong></td>
        <td>The Outlook connector isn't registered (Section 8) or the staff member hasn't clicked "Connect Microsoft 365" on their profile page.</td>
      </tr>
      <tr>
        <td><strong>Secret expired (after 6/12/24 months)</strong></td>
        <td>Generate a new client secret (Section 6), update it in GC Mission Control (Section 7), and re-register the connectors (Section 8). Old tokens remain valid until they expire naturally.</td>
      </tr>
    </table>

    <div class="callout callout-success" style="margin-top:16px;">
      <strong>Need help?</strong> If you hit an error not listed here, note the exact AADSTS error code and contact the GC Mission Control app administrator. They can check the app's integration logs and the Azure sign-in logs (Microsoft Entra ID → Users → Sign-in logs) for the full error detail.
    </div>
  </div>

  <div class="footer">
    GC Mission Control — Microsoft 365 &amp; Entra ID Setup Guide · Generated ${dateStr} · For internal IT use only
  </div>

</body>
</html>
    `;

    try {
      const win = window.open('', '_blank');
      if (!win) {
        alert('Please allow pop-ups to download the setup guide PDF.');
        setGenerating(false);
        return;
      }
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        setGenerating(false);
      }, 700);
    } catch (e) {
      setGenerating(false);
    }
  };

  return (
    <div className="page-bg-vibrant min-h-screen">
      <PageHeader
        icon={Cloud}
        title="Microsoft 365 Setup Guide"
        subtitle="Printable PDF for your IT department — Entra ID, SSO & MFA setup"
        stats={[
          { label: 'Sections', value: 11, icon: Cloud },
          { label: 'Est. Time', value: '45 min', icon: Printer },
          { label: 'Services', value: 4, icon: Cloud },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/admin')} type="button"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/25 text-white text-sm font-medium active:scale-95 transition touch-manipulation">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <button onClick={handleDownloadPDF} disabled={generating} type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-primary ring-1 ring-white/30 text-sm font-bold active:scale-95 transition touch-manipulation disabled:opacity-60 shadow-sm">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{generating ? 'Preparing...' : 'Download / Print PDF'}</span>
            </button>
          </div>
        }
      />

      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
        <div className="hub-glass rounded-2xl p-6 md:p-8 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2E5A1A] to-[#8DC63F] flex items-center justify-center flex-shrink-0 shadow-md">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">IT Department Setup Guide</h2>
              <p className="text-sm text-slate-500 mt-0.5">A complete, printable walkthrough for configuring Microsoft Entra ID (Azure AD), Single Sign-On, and Microsoft Authenticator MFA.</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              Click <strong>Download / Print PDF</strong> above to generate a formatted, 11-section guide. It opens in a new tab with your browser's print dialog — choose <strong>"Save as PDF"</strong> as the destination to save a copy, or print directly to hand to your IT team.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-800 mb-2">What's in the guide:</h3>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex gap-2"><span className="text-primary font-bold">1.</span> Overview &amp; objectives — the four services enabled</li>
              <li className="flex gap-2"><span className="text-primary font-bold">2.</span> Prerequisites — admin roles &amp; tenant requirements</li>
              <li className="flex gap-2"><span className="text-primary font-bold">3–6.</span> Azure AD app registration, redirect URIs, API permissions &amp; client secret</li>
              <li className="flex gap-2"><span className="text-primary font-bold">7–8.</span> Entering credentials in the app &amp; registering connectors</li>
              <li className="flex gap-2"><span className="text-primary font-bold">9.</span> <strong>Conditional Access &amp; MFA</strong> — enforcing Microsoft Authenticator</li>
              <li className="flex gap-2"><span className="text-primary font-bold">10–11.</span> Testing, verification &amp; troubleshooting (with AADSTS error codes)</li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800">
              <strong>Tip:</strong> The PDF includes a cover page and table of contents, making it easy to hand to your IT department or email as an attachment.
            </p>
          </div>

          <div className="flex justify-center pt-2">
            <button onClick={handleDownloadPDF} disabled={generating} type="button"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold active:scale-95 transition touch-manipulation disabled:opacity-60 shadow-md">
              {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              <span>{generating ? 'Preparing PDF...' : 'Generate Setup Guide PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}