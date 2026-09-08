/**
 * Power Apps Migration — Financial & Build-Effort Data
 *
 * Single source of truth for the Base44 vs Power Apps cost comparison.
 * All figures in GBP. Based on 100-user deployment.
 *
 * Pricing sources:
 *  - Microsoft Power Platform pricing (Sept 2026, GBP):
 *    Power Apps Per User Premium: £16/user/month
 *    Power Automate Per Flow: £80/flow/month
 *    Power BI Pro: £8/user/month
 *    Dataverse: included in Per User (3GB relational + 3GB file per user)
 *  - Azure services (UK South, consumption estimates)
 *  - Base44: estimated platform subscription + integration credits
 *
 * Build-effort rates:
 *  - Power Platform developer: £65/hour (UK blended contract rate)
 *  - Project manager: £75/hour
 */

export const USER_COUNT = 100;

// ── RECURRING ANNUAL COSTS ──────────────────────────────────────────────────

export const BASE44_RECURRING = [
  { item: 'Platform subscription', detail: `${USER_COUNT} users × £20/user/month`, base44: 24000, powerApps: 0 },
  { item: 'Power Apps Per User Premium', detail: `${USER_COUNT} users × £16/user/month`, base44: 0, powerApps: 19200 },
  { item: 'Power Automate (per-flow, unattended)', detail: '10 unattended flows × £80/flow/month', base44: 0, powerApps: 9600 },
  { item: 'Power BI Pro', detail: `${USER_COUNT} users × £8/user/month`, base44: 0, powerApps: 9600 },
  { item: 'Dataverse additional capacity', detail: 'File/log capacity add-on', base44: 0, powerApps: 1200 },
  { item: 'Azure Functions (Premium plan)', detail: '200 functions, always-on', base44: 0, powerApps: 1800 },
  { item: 'Azure infrastructure', detail: 'Blob, SignalR, Key Vault, App Insights', base44: 0, powerApps: 1800 },
  { item: 'Azure Communication Services (email)', detail: 'Automated notification emails', base44: 0, powerApps: 600 },
  { item: 'Integration / AI credits', detail: 'LLM calls, file uploads, TTS', base44: 3000, powerApps: 0 },
];

export const BASE44_ANNUAL_TOTAL = BASE44_RECURRING.reduce((s, r) => s + r.base44, 0);
export const POWERAPPS_ANNUAL_TOTAL = BASE44_RECURRING.reduce((s, r) => s + r.powerApps, 0);

// ── ONE-TIME BUILD COSTS ────────────────────────────────────────────────────

export const BUILD_EFFORT = [
  { category: 'Dataverse schema', detail: '100 tables, columns, relationships, RLS', count: 100, unit: 'tables', hoursPerUnit: 2, totalHours: 200, rate: 65 },
  { category: 'Model-driven admin apps', detail: '12 hub apps (Dashboard, Jobs, Staff, Fleet, Assets, Compliance, Billing, Reports, Logistics, Settings, Scheduling, Investigation)', count: 12, unit: 'apps', hoursPerUnit: 40, totalHours: 480, rate: 65 },
  { category: 'Canvas field-crew mobile app', detail: '5 screens (Today, Upcoming, Scanner, Profile, More) + Shift Wizard', count: 5, unit: 'screens', hoursPerUnit: 120, totalHours: 600, rate: 65 },
  { category: 'Power Automate flows', detail: '80 workflows + 20 scheduled automations', count: 100, unit: 'flows', hoursPerUnit: 8, totalHours: 800, rate: 65 },
  { category: 'Azure Functions', detail: '200 backend functions (HTTP + Timer triggers)', count: 200, unit: 'functions', hoursPerUnit: 4, totalHours: 800, rate: 65 },
  { category: 'Custom connectors', detail: '16 third-party integrations (Geotab, Holman, Asset Panda, Mitti, KeyLogBook, Bob HR, Concur, HMRC, Stripe, WhatsApp, Met Office, Google Maps, OpenAI, OpenGround, DVLA, Zapier)', count: 16, unit: 'connectors', hoursPerUnit: 16, totalHours: 256, rate: 65 },
  { category: 'PCF custom controls', detail: 'Heatmap grid, drag-drop rota, signature pad, map layers, barcode scanner, flip card, 3D scene, sparkline, progress ring, animated number', count: 10, unit: 'controls', hoursPerUnit: 40, totalHours: 400, rate: 65 },
  { category: 'Power BI dashboards', detail: '8 report dashboards (Financial, Compliance, Fleet, Crew Performance, Rig Profitability, Cash Flow, Utilisation, Executive)', count: 8, unit: 'dashboards', hoursPerUnit: 24, totalHours: 192, rate: 65 },
  { category: 'Data migration', detail: '100 tables, ETL scripts, validation, cutover', count: 100, unit: 'tables', hoursPerUnit: 4, totalHours: 400, rate: 65 },
  { category: 'Testing & QA', detail: 'Unit, integration, UAT, performance, security', count: 1, unit: 'phase', hoursPerUnit: 400, totalHours: 400, rate: 65 },
  { category: 'Project management', detail: 'Planning, coordination, stakeholder management', count: 1, unit: 'phase', hoursPerUnit: 300, totalHours: 300, rate: 75 },
  { category: 'Documentation & training', detail: 'User guides, admin manual, training sessions', count: 1, unit: 'phase', hoursPerUnit: 200, totalHours: 200, rate: 65 },
];

export const TOTAL_BUILD_HOURS = BUILD_EFFORT.reduce((s, r) => s + r.totalHours, 0);
export const TOTAL_BUILD_COST = BUILD_EFFORT.reduce((s, r) => s + r.totalHours * r.rate, 0);

// ── TCO COMPARISON ──────────────────────────────────────────────────────────

export const TCO_YEARS = 5;
export const BASE44_5YR_TCO = BASE44_ANNUAL_TOTAL * TCO_YEARS;
export const POWERAPPS_5YR_TCO = TOTAL_BUILD_COST + POWERAPPS_ANNUAL_TOTAL * TCO_YEARS;
export const TCO_DELTA = POWERAPPS_5YR_TCO - BASE44_5YR_TCO;

// ── TIMELINE ─────────────────────────────────────────────────────────────────

export const TIMELINE_WEEKS = 23; // critical-path total from PHASE_TIMELINE
export const TIMELINE_MONTHS = (TIMELINE_WEEKS / 4.33).toFixed(1);
export const DEVELOPER_TEAM_SIZE = 3;
export const EFFECTIVE_HOURS_PER_WEEK = TOTAL_BUILD_HOURS / TIMELINE_WEEKS;

// ── INTEGRATION RISK ─────────────────────────────────────────────────────────

export const INTEGRATION_RISKS = [
  { name: 'Microsoft Entra ID (SSO)', connector: 'Built-in', auth: 'OAuth 2.0', risk: 'Low', note: 'Native Power Platform integration — replaces Base44 email/OTP auth.' },
  { name: 'Geotab (Fleet GPS)', connector: 'HTTP custom', auth: 'Basic Auth', risk: 'Medium', note: 'Custom connector for GPS feed + trip history. Webhook receiver flow.' },
  { name: 'Asset Panda (Assets)', connector: 'HTTP custom', auth: 'Bearer Token', risk: 'Medium', note: 'REST API, bidirectional sync, photo push. 256+ fields to map.' },
  { name: 'Holman (Fleet maintenance)', connector: 'HTTP custom', auth: 'API Key', risk: 'Medium', note: 'REST API for MOT, service, mileage. Webhook for maintenance events.' },
  { name: 'Mitti / SafetyCulture', connector: 'HTTP custom', auth: 'Bearer Token', risk: 'Medium', note: 'Audit webhook receiver + template sync. Gates Shift Wizard steps.' },
  { name: 'KeyLogBook (AGS borehole)', connector: 'HTTP custom', auth: 'Bearer + HMAC', risk: 'High', note: 'Complex AGS file parsing, HMAC signature verification, multi-group extraction. Highest-risk integration.' },
  { name: 'Bob HR (Staff & absence)', connector: 'HTTP custom', auth: 'Bearer Token', risk: 'Low', note: 'Standard REST API for employee + timeoff sync.' },
  { name: 'SAP Concur (Expenses)', connector: 'HTTP custom', auth: 'OAuth 2.0', risk: 'Medium', note: 'OAuth 2.0 client credentials flow, expense report sync.' },
  { name: 'HMRC CIS Verification', connector: 'HTTP custom', auth: 'OAuth 2.0', risk: 'High', note: 'Government API, production approval required, strict rate limits.' },
  { name: 'Stripe (Payments)', connector: 'HTTP custom', auth: 'Bearer Token', risk: 'Low', note: 'Well-documented API, webhook signature verification.' },
  { name: 'Twilio WhatsApp', connector: 'HTTP custom', auth: 'Basic Auth', risk: 'Medium', note: 'WhatsApp Business API requires Meta verification. Inbound webhook flow.' },
  { name: 'Met Office (Weather)', connector: 'HTTP custom', auth: 'API Key', risk: 'Low', note: 'DataHub API, hourly forecast sync per active job site.' },
  { name: 'Google Maps (Routes)', connector: 'HTTP custom', auth: 'API Key', risk: 'Low', note: 'Directions + Distance Matrix APIs for route optimisation.' },
  { name: 'Azure OpenAI / AI Builder', connector: 'HTTP / AI Builder', auth: 'API Key', risk: 'Medium', note: 'Custom LLM calls (remarks professionalisation, delay prediction). AI Builder alternative for document extraction.' },
  { name: 'Bentley OpenGround', connector: 'HTTP custom', auth: 'OAuth 2.0', risk: 'Medium', note: 'Bentley Developer portal, geotechnical data push.' },
  { name: 'DVLA (Vehicle spec/MOT)', connector: 'HTTP custom', auth: 'API Key', risk: 'Medium', note: 'DVLA Vehicle Enquiry + MOT History APIs, rate-limited.' },
];

export const RISK_COUNTS = INTEGRATION_RISKS.reduce((acc, r) => {
  acc[r.risk] = (acc[r.risk] || 0) + 1;
  return acc;
}, {});

// ── PARITY MATRIX SUMMARY ─────────────────────────────────────────────────────

export const PARITY_SUMMARY = {
  entities: { count: 100, base44: 'Base44 entities (MongoDB)', powerApps: 'Dataverse tables (with RLS)' },
  functions: { count: 200, base44: 'Base44 backend functions (Deno)', powerApps: 'Azure Functions (Node 20, HTTP + Timer)' },
  workflows: { count: 80, base44: 'Base44 workflows (.jsonc)', powerApps: 'Power Automate flows' },
  automations: { count: 20, base44: 'Base44 scheduled automations', powerApps: 'Power Automate timer triggers' },
  pages: { count: 50, base44: 'React pages + components', powerApps: 'Canvas + Model-driven apps' },
  integrations: { count: 16, base44: 'Base44 integrations + connectors', powerApps: 'Custom connectors + HTTP actions' },
  agents: { count: 3, base44: 'Base44 in-app AI agents', powerApps: 'Azure Functions + Copilot Studio' },
  authFlows: { count: 7, base44: 'Base44 auth (email/OTP/Google)', powerApps: 'Microsoft Entra ID (MSAL)' },
};

// ── RECOMMENDATION ───────────────────────────────────────────────────────────

export const RECOMMENDATION = {
  verdict: 'Stay on Base44',
  summary: 'A 1:1 Power Apps migration is technically feasible but costs £411K more over 5 years, takes 6 months of dedicated development, and carries high integration risk — with zero functional gain.',
  factors: [
    { label: '5-Year TCO', base44: `£${BASE44_5YR_TCO.toLocaleString()}`, powerApps: `£${POWERAPPS_5YR_TCO.toLocaleString()}`, delta: `+£${TCO_DELTA.toLocaleString()}`, favours: 'base44' },
    { label: 'Annual recurring', base44: `£${BASE44_ANNUAL_TOTAL.toLocaleString()}/yr`, powerApps: `£${POWERAPPS_ANNUAL_TOTAL.toLocaleString()}/yr`, delta: `+£${(POWERAPPS_ANNUAL_TOTAL - BASE44_ANNUAL_TOTAL).toLocaleString()}/yr`, favours: 'base44' },
    { label: 'One-time build', base44: '£0', powerApps: `£${TOTAL_BUILD_COST.toLocaleString()}`, delta: `+£${TOTAL_BUILD_COST.toLocaleString()}`, favours: 'base44' },
    { label: 'Build effort', base44: '0 hours', powerApps: `${TOTAL_BUILD_HOURS.toLocaleString()} hours`, delta: `+${TIMELINE_MONTHS} months`, favours: 'base44' },
    { label: 'Integration risk', base44: 'None (already connected)', powerApps: `${RISK_COUNTS.High || 0} high-risk, ${RISK_COUNTS.Medium || 0} medium`, delta: '2 high-risk', favours: 'base44' },
    { label: 'Capability parity', base44: '100% (current)', powerApps: '~95% (PCF gaps)', delta: '-5% gap', favours: 'base44' },
    { label: 'Maintenance burden', base44: 'Platform-managed', powerApps: 'Self-managed (Azure + Dataverse)', delta: 'Higher overhead', favours: 'base44' },
    { label: 'Data ownership', base44: 'Base44-hosted', powerApps: 'Self-hosted (Dataverse)', delta: 'More control', favours: 'powerApps' },
  ],
};

export const fmtGBP = (n) => '£' + Number(n || 0).toLocaleString('en-GB');