// Integration & Connector Setup Guide content — Volume 4.
// Step-by-step instructions for every external integration.

export function generateIntegrationGuide() {
  return `# GC Mission Control — Integration & Connector Setup Guide

**Volume 4 of 5 — External Systems Build Manual**

This guide covers every external integration, with connector setup steps,
authentication config, endpoint URLs, request/response schemas, and the
exact Power Automate expressions to wire them.

---

## 1. Microsoft Entra ID (SSO)

**Purpose:** Single sign-on for all users. Replaces the Base44 email/password auth.

### Setup Steps
1. Go to Azure Portal (portal.azure.com) → Microsoft Entra ID → App registrations → New registration.
2. Name: "GC Mission Control".
3. Supported account types: "Accounts in this organizational directory only".
4. Redirect URI: \`https://[your-powerapps-env].powerappsportals.com/auth/callback\` (or your canvas app redirect).
5. After creation, note the **Application (client) ID** and **Directory (tenant) ID**.
6. Go to Certificates & secrets → New client secret → copy the secret value.
7. Go to API permissions → add:
   - Microsoft Graph → User.Read (delegated)
   - Microsoft Graph → email (delegated)
   - Microsoft Graph → profile (delegated)
8. In Power Apps: Settings → Authentication → add Microsoft Entra ID as the identity provider.

### Power Automate Expression
\`\`\`
@{outputs('HTTP')?['body/access_token']}
\`\`\`

### Auto-Matching Staff Records
On first login, the app looks up the Staff table by email. If no match, create a pending access request. The admin approves and assigns a permission group.

---

## 2. Geotab (Fleet GPS Tracking)

**Purpose:** Vehicle location tracking, trip history, arrival/departure detection for timesheets.

### Setup Steps
1. Create a Geotab account at my.geotab.com.
2. Note your **database name**, **username**, and **password**.
3. In Power Automate, create an HTTP action:
   - Method: POST
   - URI: \`https://[your-db].geotab.com/apiv1\`
   - Body: \`{"method":"Authenticate","params":{"database":"[db]","userName":"[user]","password":"[pass]"}}\`
4. Extract the session ID (credentials) from the response.
5. For subsequent calls (GetFeed, GetTrips), include the credentials in the params.

### Webhook (geotabWebhook flow)
- **Trigger:** Request (HTTP POST)
- **URL:** \`https://[env].api.flow.microsoft.com/.../triggers\` (generated on save)
- **Auth:** Bearer token in the Authorization header
- **Payload schema:**
\`\`\`json
{
  "device": {"id": "...", "name": "..."},
  "latitude": 51.5074,
  "longitude": -0.1278,
  "speed": 45,
  "dateTime": "2026-09-05T10:30:00Z"
}
\`\`\`

### Power Automate Expression (parse GPS)
\`\`\`
@{triggerBody()?['latitude']},@{triggerBody()?['longitude']}
\`\`\`

---

## 3. Asset Panda (Asset Inventory)

**Purpose:** Sync asset records, QR codes, photos, and compliance data.

### Setup Steps
1. Create an Asset Panda account at app.assetpanda.com.
2. Go to Settings → API → generate an API key.
3. Note the **API base URL**: \`https://api.assetpanda.com/v1\`
4. In Dataverse, create an AssetPandaConfig table (see Volume 1) to store the API key.
5. In Power Automate, use the HTTP connector:
   - Headers: \`Authorization: Bearer [api_key]\`
   - GET \`/objects\` — list all asset objects/groups
   - GET \`/objects/{id}/fields\` — get field definitions
   - GET \`/objects/{id}/records\` — list asset records

### Webhook (assetPandaWebhook flow)
- **Trigger:** Request (HTTP POST)
- **Payload:** Asset update event (created/updated/deleted)
- **Processing:** Match the asset by external ID, update the SiteAsset table.

### Power Automate Expression (lookup asset)
\`\`\`
@{first(filter(outputs('List_rows')?['body/value'], equals(item()?['gc_external_id'], triggerBody()?['id'])))?['gc_siteassetid']}
\`\`\`

---

## 4. Holman (Vehicle Maintenance & Fleet)

**Purpose:** Fleet maintenance bookings, MOT history, service records.

### Setup Steps
1. Contact Holman for API access (they provide a REST API for fleet data).
2. Obtain the **API key** and **account number**.
3. Base URL: \`https://api.holman.co.uk/v1/\` (confirm with Holman).
4. In Power Automate:
   - GET \`/vehicles\` — list fleet vehicles
   - GET \`/vehicles/{id}/maintenance\` — maintenance history
   - POST \`/maintenance/bookings\` — create a booking

### Webhook (holmanWebhook flow)
- **Trigger:** Request (HTTP POST)
- **Payload:** Maintenance event (booking created, service completed, MOT due)
- **Processing:** Update the VehicleMaintenanceBooking table.

---

## 5. Mitti / SafetyCulture (Safety Audits)

**Purpose:** Daily vehicle checks, POWRA, equipment checks — safety form verification.

### Setup Steps
1. Create a SafetyCulture account at safetyculture.com.
2. Go to Integrations → API → generate an API token.
3. Base URL: \`https://api.safetyculture.com/v1\`
4. In Power Automate:
   - GET \`/audits/{id}\` — fetch an audit report
   - GET \`/templates/{id}\` — fetch a form template
5. Configure webhooks in SafetyCulture:
   - Go to Integrations → Webhooks
   - Add the Power Automate webhook URL (from the receiveMittiData flow)
   - Select events: audit_completed, action_created

### Webhook (receiveMittiData flow)
- **Trigger:** Request (HTTP POST)
- **Auth:** Bearer token (stored in MittiConfig table)
- **Payload schema:**
\`\`\`json
{
  "event": "audit_completed",
  "audit_id": "...",
  "template_id": "...",
  "audit_name": "Daily Vehicle Check",
  "completed_at": "2026-09-05T08:00:00Z",
  "conducted_by": {"name": "...", "email": "..."},
  "action_items": [...]
}
\`\`\`
- **Processing:** Match the audit to a staff member by email, stamp the RotaAssignment fields (mitti_vehicle_check_at, mitti_powra_at).

---

## 6. KeyLogBook (Borehole Data — AGS Webhooks)

**Purpose:** Ingest borehole data, strata, SPT, samples, and driller remarks via AGS file webhooks.

### Setup Steps
1. Obtain KeyLogBook API credentials from your KeyLogBook provider.
2. Store the API base URL, API key, and webhook secret in the KeyLogBookConfig table (Volume 1).
3. Configure the webhook in KeyLogBook:
   - URL: the Power Automate importAGS flow URL
   - Events: hole_created, hole_updated, hole_deleted
   - Auth: Bearer token (use the ags_sync_secret from KeyLogBookConfig)
   - Request signing: enable HMAC-SHA256 (use ags_webhook_signing_secret)

### Webhook (importAGS flow)
- **Trigger:** Request (HTTP POST)
- **Auth:** Bearer token OR Basic Auth OR custom header (per ags_webhook_auth_method)
- **HMAC verification:** calculate \`HMAC-SHA256(payload, signing_secret)\` and compare to the X-Hole-Signature header
- **Payload:** AGS file content (base64 or multipart)
- **Processing:**
  1. Parse the AGS file (LOCA, GEOL, SAMP, SPT, TREM, WSTG groups)
  2. Match to a Job by project number
  3. Create InvestigationLog records for each borehole/strata/sample
  4. Parse driller remarks into keylogbook_remarks logs
  5. Auto-generate timesheet entries from shift data
  6. Log to KeyLogBookWebhookLog table

### Power Automate Expression (HMAC verification)
\`\`\`
@{base64(binary HMACSHA256(triggerBody(), variables('SigningSecret')))}
\`\`\`

---

## 7. Bob HR (Staff & Absence Sync)

**Purpose:** Sync staff records, absences, and holiday data from Bob HR.

### Setup Steps
1. Create a Bob HR account at bob.hibob.com.
2. Go to Settings → API → generate an API token.
3. Base URL: \`https://api.hibob.com/v1/\`
4. In Power Automate:
   - GET \`/employees\` — list all employees (sync to Staff table)
   - GET \`/timeoff/requests\` — list absence requests (sync to Absence table)
   - POST \`/timeoff/requests\` — push an absence to Bob

### Webhook (bobWebhook flow)
- **Trigger:** Request (HTTP POST)
- **Events:** employee.created, employee.updated, timeoff.created, timeoff.updated
- **Processing:** Upsert the Staff or Absence record in Dataverse.

---

## 8. Concur (Expense Sync)

**Purpose:** Sync expense reports and receipts from SAP Concur.

### Setup Steps
1. Create a Concur developer account at developer.concur.com.
2. Register an app — obtain client_id, client_secret, and region.
3. Base URL: \`https://[region].api.concursolutions.com/v4/\`
4. OAuth 2.0 flow:
   - POST \`/oauth2/token\` with client credentials → get access token
   - Use the token in all subsequent calls
5. In Power Automate:
   - GET \`/expense/reports\` — list expense reports
   - GET \`/expense/reports/{id}/receipts\` — get receipts

### Flow (syncConcurExpenses)
- **Trigger:** Recurrence (daily)
- **Actions:** Fetch reports since last sync, upsert to JobCostItem table with category "other".

---

## 9. HMRC CIS Verification

**Purpose:** Verify subcontractor CIS (Construction Industry Scheme) status with HMRC.

### Setup Steps
1. Register for HMRC Developer Hub at developer.service.hmrc.gov.uk.
2. Create an application — obtain client_id and client_secret.
3. Apply for the "CIS: verify subcontractor" API in production.
4. Base URL: \`https://api.service.hmrc.gov.uk/\`
5. OAuth 2.0 (application-restricted):
   - POST \`/oauth/token\` with client credentials → access token
6. Verify endpoint:
   - POST \`/organisations/vat/verify\` (or the CIS endpoint)
   - Body: \`{"utr": "[subcontractor UTR]", "name": "[company name]"}\`

### Flow (verifyCIS)
- **Trigger:** Power Apps (V2) — accepts subcontractor ID
- **Actions:** Fetch the subcontractor, call HMRC API, update the verification status.

---

## 10. Stripe (Payments)

**Purpose:** Accept client payments for AFPs/invoices via Stripe checkout.

### Setup Steps
1. Create a Stripe account at dashboard.stripe.com.
2. Get the **Publishable key** and **Secret key**.
3. Store the secret key in Azure Key Vault or a Dataverse config table.
4. In Power Automate:
   - POST \`https://api.stripe.com/v1/checkout/sessions\` — create a checkout session
   - Headers: \`Authorization: Bearer [secret_key]\`, \`Content-Type: application/x-www-form-urlencoded\`
   - Body: \`mode=payment&success_url=...&cancel_url=...&line_items[0][price_data][unit_amount]=...&line_items[0][quantity]=1\`

### Webhook (stripeWebhook flow)
- **Trigger:** Request (HTTP POST)
- **URL:** Set in Stripe Dashboard → Developers → Webhooks
- **Events:** checkout.session.completed, invoice.paid
- **Signature verification:** \`Stripe-Signature\` header — use \`t=...,v1=...\` format
- **Processing:** Match the payment to an Invoice, mark as paid.

---

## 11. Twilio WhatsApp (Crew Messaging)

**Purpose:** Send WhatsApp messages to crew members (schedule reminders, assignment notifications).

### Setup Steps
1. Create a Twilio account at twilio.com.
2. Enable WhatsApp Business API (requires Meta Business verification).
3. Get the **Account SID**, **Auth Token**, and **WhatsApp sender number**.
4. Base URL: \`https://api.twilio.com/2010-04-01/\`
5. In Power Automate:
   - POST \`/Accounts/{SID}/Messages.json\`
   - Auth: Basic Auth (SID:AuthToken)
   - Body: \`From=whatsapp:[number]&To=whatsapp:[recipient]&Body=[message]\`

### Webhook (whatsappWebhook flow)
- **Trigger:** Request (HTTP POST)
- **Events:** Incoming WhatsApp message from a crew member
- **Processing:** Log to StaffMessage table, trigger AI response if configured.

---

## 12. Met Office (Weather Data)

**Purpose:** Site weather alerts, safe-working-temperature checks, weather-based rostering.

### Setup Steps
1. Register at datahub.metoffice.gov.uk.
2. Get an **API key**.
3. Base URL: \`https://data.hub.api.metoffice.gov.uk/atmospheric-models/1.0.0/\`
4. In Power Automate:
   - GET \`/uk-deterministic-2km/...\` with lat/lng parameters
   - Headers: \`apikey: [your_key]\`

### Flow (syncMetOfficeWeather)
- **Trigger:** Recurrence (hourly)
- **Actions:** Fetch forecast for each active job site, store in WeatherLog table, evaluate safe-working thresholds.

---

## 13. Google Maps (Route Optimisation)

**Purpose:** Optimise delivery routes for drivers.

### Setup Steps
1. Create a Google Cloud project at console.cloud.google.com.
2. Enable the **Directions API** and **Distance Matrix API**.
3. Create an **API key** (restrict to your Power Automate IP range).
4. Base URL: \`https://maps.googleapis.com/maps/api/\`
5. In Power Automate:
   - POST \`/directions/json\` with waypoints and \`optimize:true\`
   - Parse the optimised waypoint order and leg durations

### Flow (optimizeDailyRoute)
- **Trigger:** Power Apps (V2) — accepts the list of delivery IDs
- **Actions:** Fetch delivery addresses, call Google Maps Directions API, update optimized_sequence_index and optimized_eta on each DeliveryLog.

---

## 14. Azure OpenAI / AI Builder (AI Features)

**Purpose:** Driller remarks professionalisation, delay prediction, crew suggestion, document extraction.

### Setup Steps
1. Create an Azure OpenAI resource in Azure Portal.
2. Deploy a model (e.g. GPT-4o) — note the **endpoint** and **API key**.
3. Base URL: \`https://[your-resource].openai.azure.com/openai/deployments/[deployment]/chat/completions?api-version=2024-02-15-preview\`
4. In Power Automate:
   - POST to the endpoint
   - Headers: \`api-key: [key]\`
   - Body: \`{"messages":[{"role":"user","content":"[prompt]"}],"response_format":{"type":"json_object"}}\`

### Alternative: AI Builder (built-in to Power Platform)
1. Go to make.powerapps.com → AI Builder → Build custom models.
2. For text classification (delay prediction): use the "Category Classification" model.
3. For document extraction: use the "Document Processing" model — train on AFP/CVR Excel templates.

### Flow (generateDelayLogFromRemarks)
- **Trigger:** Instant (from a log review)
- **Actions:** Send the driller remarks to Azure OpenAI with a prompt to professionalise the text, store the result in the InvestigationLog.description field.

---

## 15. Outlook Email (Office 365)

**Purpose:** All automated email notifications (schedule emails, alerts, reminders).

### Setup Steps
1. The Office 365 Outlook connector is built into Power Automate.
2. Ensure the flow's service account has a valid Exchange Online license.
3. Use the "Send an email (V2)" action:
   - To: dynamic content (staff email)
   - Subject: dynamic content
   - Body: HTML body with the email template (see EmailAlertSetting table for templates)

### Power Automate Expression (format currency)
\`\`\`
£@{formatNumber(item()?['amount'], 'C2', 'en-GB')}
\`\`\`

---

## 16. Power BI (Reporting)

**Purpose:** Power BI dashboards for enterprise reporting.

### Setup Steps
1. Create a Power BI workspace in app.powerbi.com.
2. Create a dataset connected to Dataverse (Power BI → Get data → Dataverse).
3. Select the tables to include (Jobs, Timesheets, AFPs, Invoices, etc.).
4. Build reports and dashboards.
5. In the canvas app, use the **Power BI** connector to embed reports:
   - Add the Power BI tile control
   - Set the Workspace and Report properties

### Flow (syncPowerBI)
- **Trigger:** Recurrence (hourly)
- **Actions:** Trigger a Power BI dataset refresh via the Power BI REST API:
  - POST \`https://api.powerbi.com/v1.0/myorg/datasets/{id}/refreshes\`

---

## Summary: Connector Checklist

| # | Integration | Connector Type | Auth Method | Webhook Flow |
|---|------------|---------------|-------------|-------------|
| 1 | Entra ID | Built-in | OAuth 2.0 | — |
| 2 | Geotab | HTTP | Basic Auth | geotabWebhook |
| 3 | Asset Panda | HTTP | Bearer Token | assetPandaWebhook |
| 4 | Holman | HTTP | API Key | holmanWebhook |
| 5 | Mitti/SafetyCulture | HTTP | Bearer Token | receiveMittiData |
| 6 | KeyLogBook | HTTP | Bearer/HMAC | importAGS |
| 7 | Bob HR | HTTP | Bearer Token | bobWebhook |
| 8 | Concur | HTTP | OAuth 2.0 | — |
| 9 | HMRC CIS | HTTP | OAuth 2.0 | — |
| 10 | Stripe | HTTP | Bearer Token | stripeWebhook |
| 11 | Twilio WhatsApp | HTTP | Basic Auth | whatsappWebhook |
| 12 | Met Office | HTTP | API Key | — |
| 13 | Google Maps | HTTP | API Key | — |
| 14 | Azure OpenAI | HTTP | API Key | — |
| 15 | Outlook | Built-in | OAuth 2.0 | — |
| 16 | Power BI | Built-in | OAuth 2.0 | — |
`;
}