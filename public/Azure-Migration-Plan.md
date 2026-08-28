# GC Mission Control — Azure Migration Plan

**Document version:** 1.0
**Date:** 28 August 2026
**Prepared for:** Ground Control leadership
**Status:** For review & approval before execution

---

## 1. Executive Summary

This document is the complete plan for migrating **GC Mission Control** off the Base44 platform onto **Microsoft Azure**, with full feature parity, shipped as a web-only installable PWA.

The migration keeps the existing **React + Vite + Tailwind** frontend source almost entirely untouched — only the data-access and authentication layers change. The Base44 backend-as-a-service layer (database, auth, row-level security, SDK, integrations, automations, realtime, and hosting) is rebuilt on Azure so the application runs entirely inside the Microsoft ecosystem with **zero dependency on Base44**.

### Target architecture at a glance

| Layer | Today (Base44) | Tomorrow (Azure) |
|---|---|---|
| Frontend hosting | Base44 publish | Azure Static Web Apps |
| Database | Base44 entities (MongoDB-style) | Azure SQL (SQL Server) |
| Row-level security | Base44 RLS engine | SQL Server RLS (SESSION_CONTEXT predicates) |
| Auth | Base44 Auth + Google | Microsoft Entra ID (MSAL.js) |
| Backend logic | ~200 Base44 functions | Azure Functions Premium (Node 20) |
| File storage | Base44 UploadFile | Azure Blob Storage (SAS URLs) |
| Realtime | Base44 entity subscriptions | Azure SignalR Service |
| Email | Base44 SendEmail | Azure Communication Services Email |
| LLM / AI | Base44 InvokeLLM | Azure OpenAI |
| Scheduled jobs | Base44 automations | Azure Functions timer triggers |
| Webhooks | Base44 function endpoints | Azure Functions HTTP triggers |
| Monitoring | — | Application Insights |
| Mobile | iOS/Android native builds | Web-only PWA (no native builds) |

### Why Azure (not Power Apps)

Power Apps is a low-code canvas builder — it cannot host a custom React SPA, cannot run the AGS/AFP/EWR file-processing logic, and has no equivalent for Leaflet maps, recharts dashboards, three.js, or the custom rota grid. A "Power Apps rebuild" would mean discarding the entire application and rebuilding ~300 screens from scratch in a different paradigm, with large feature gaps. Azure preserves the existing application and lands it fully inside Microsoft.

---

## 2. Current State — What Base44 Provides Today

Before migrating, it's important to inventory exactly what the platform gives us that we must replace:

1. **Entity data store** — ~100 entities (Job, Staff, RotaAssignment, AFP, AFPLineItem, SiteAsset, Vehicle, Contractor, Client, ComplianceItem, etc.), each a JSON schema with built-in `id`, `created_date`, `updated_date`, `created_by_id`.
2. **Row-Level Security (RLS)** — per-entity rules combining division match, managed-division match, platform admin, and enterprise-admin conditions; evaluated silently on every read/write.
3. **Auth** — email/password, Google OAuth, OTP verification, password reset, session tokens; plus a `User` entity with `role` (admin/user) and custom user data (`division_id`, `managed_division_ids`, `is_enterprise_admin`).
4. **SDK** (`@base44/sdk`) — `base44.entities.<Name>.{list,filter,get,create,update,delete,bulkCreate,bulkUpdate,updateMany,deleteMany,schema,subscribe}`, `base44.functions.invoke`, `base44.auth.{me,isAuthenticated,logout,updateMe,redirectToLogin}`, `base44.integrations.Core.{InvokeLLM,SendEmail,UploadFile,UploadPrivateFile,GenerateImage,GenerateVideo,GenerateSpeech,TranscribeAudio,ExtractDataFromUploadedFile,CreateFileSignedUrl}`, `base44.analytics.track`, `base44.users.inviteUser`, `base44.asServiceRole`.
5. **Backend functions** — ~200 TypeScript HTTP handlers in `base44/functions/<name>/entry.ts`.
6. **Automations** — scheduled (cron/interval), entity (create/update/delete triggers), connector (webhook-driven), and in-app-agent triggers.
7. **Realtime** — entity `subscribe()` pushing create/update/delete events to the browser.
8. **In-app AI agents** — `staff_assistant`, `drilling_intelligence`, `scheduling_assistant` (config files + conversation UI + tool permissions).
9. **Hosting & publishing** — the app is published at `https://gc-mission-control.base44.app` and to iOS/Android.
10. **Integrations** — InvokeLLM, SendEmail, UploadFile, GenerateImage/Video/Speech, TranscribeAudio, ExtractDataFromUploadedFile, plus connector webhooks (Geotab, Holman, Asset Panda, Mitti/SafetyCulture, KeyLogBook, Stripe, Bob HR, Concur, etc.).

**Everything in this list must be reproduced on Azure.**

---

## 3. Target Architecture

```
                         ┌───────────────────────────────┐
                         │      Entra ID (tenant)        │
                         │  App registration · App roles │
                         │  Members + B2B guests         │
                         └───────────────┬───────────────┘
                                         │ JWT (MSAL.js)
                         ┌───────────────▼───────────────┐
                         │   Azure Static Web App (/web) │
                         │   React + Vite + Tailwind PWA │
                         │   MSAL auth · API client      │
                         └───────────────┬───────────────┘
                                         │ HTTPS (REST)
                         ┌───────────────▼───────────────┐
                         │   Azure Functions Premium      │
                         │   Node 20 · ~200 functions     │
                         │   HTTP / timer / webhook       │
                         │   Entra JWT validation          │
                         └───┬───────┬───────┬───────┬───┘
                             │       │       │       │
                ┌────────────▼──┐ ┌──▼───────▼──┐ ┌─▼──────────────┐
                │  Azure SQL    │ │ Blob Storage│ │ SignalR Service │
                │  (RLS via     │ │ (SAS URLs)  │ │ (realtime hubs) │
                │  SESSION_CTX) │ │             │ │                 │
                └───────────────┘ └─────────────┘ └─────────────────┘
                             │
                ┌────────────▼──────────────┐
                │  Azure OpenAI · ACS Email   │
                │  Doc Intelligence · App     │
                │  Insights                  │
                └────────────────────────────┘
```

### Repository structure (new repo)

```
gc-mission-control-azure/
├── web/            # the existing React app, retargeted to the Azure API client
├── api/            # Azure Functions TypeScript project (one function per Base44 function)
│   ├── common/     # ported from base44/shared (db, auth, integrations helpers)
│   └── functions/  # ~200 function folders
├── db/             # SQL migration scripts + seed + RLS predicates + data import
├── shared/         # ported base44/shared modules (rateResolver, afpPopulation, etc.)
└── infra/          # Bicep templates (resource group, SQL, Functions, SWA, etc.)
```

---

## 4. Migration Phases

### Phase 0 — Foundation & access (Week 1)
- Confirm Azure subscription, tenant, and naming conventions.
- Create the resource group and a service principal for CI/CD.
- Create the Entra ID app registration (single-page app + API), define app roles.
- Scaffold the new repo with the `/web`, `/api`, `/db`, `/shared`, `/infra` layout.
- **Exit criteria:** empty repo deploys a "hello world" Static Web App + Functions + SQL server via Bicep.

### Phase 1 — Data layer (Weeks 2–3)
- Translate all ~100 entity JSON schemas into Azure SQL tables (one table per entity, one column per field, built-in columns `id UNIQUEIDENTIFIER`, `created_date`, `updated_date`, `created_by_id`).
- Map JSON-array/object fields (`contacts`, `week_breakdown`, `action_items`, `permissions`, `groups`, `field_map`, `filters`) to `NVARCHAR(MAX)` JSON columns.
- Implement the RLS security predicate function reading `SESSION_CONTEXT` for `user_id`, `division_id`, `managed_division_ids`, `role`, `is_enterprise_admin`; apply as FILTER + BLOCK predicates on every table, mirroring each entity's current RLS rules.
- Write the one-time export job that pulls all live records from every Base44 entity and bulk-inserts them into Azure SQL (preserving IDs and relationships).
- **Exit criteria:** all data exported, RLS verified with test users per division.

### Phase 2 — Auth (Week 3)
- Finalise Entra ID app roles mapping to Base44 roles + permission groups.
- Create all users as Entra members (office/admin/field) or B2B guests (subcontractors, client-portal users).
- Integrate MSAL.js 3.x into the frontend; replace the Base44 auth context with an Entra-backed one.
- Add Entra JWT validation middleware to the Functions API (EasyAuth or manual).
- Rewire Login / Register / ForgotPassword / ResetPassword / Onboarding to Entra flows; preserve post-login landing-page routing and the onboarding gate.
- **Exit criteria:** a user can sign in via Entra, hit the API with a valid token, and RLS scopes their data correctly.

### Phase 3 — Backend functions (Weeks 4–7)
- Port all ~200 Base44 functions to Azure Functions, preserving exact input/output JSON contracts:
  - **HTTP triggers** for invoke-style functions (e.g. `getSettingsHubStats`, `calculateJobFinancials`, `parseAFPUpload`).
  - **HTTP triggers with secret/signature validation** for webhooks (`geotabWebhook`, `holmanWebhook`, `assetPandaWebhook`, `receiveMittiData`, `receiveKeyLogBookData`, `stripeWebhook`, `whatsappWebhook`, `bobWebhook`, `accountingWebhook`, `zapierWebhook`).
  - **Timer triggers** (NCRONTAB) for scheduled jobs (`sendDailyReminders`, `checkComplianceExpiry`, `syncGeotabFleet`, `runScheduledBackups`, `checkOverdueInvoices`, etc.).
- Replace `base44.integrations.Core` with Azure-native equivalents (see mapping table in §6).
- Replace `base44.asServiceRole` with a service-principal SQL connection used by timer/webhook functions.
- Move `base44/shared` modules into `/shared`, imported by the Functions project.
- **Exit criteria:** every function callable from the new API client with identical response shape to Base44.

### Phase 4 — Frontend SDK replacement (Weeks 5–7, overlaps Phase 3)
- Replace `@/api/base44Client` with a new typed API client:
  - `base44.entities.<Name>.{list,filter,get,create,update,delete,bulkCreate,bulkUpdate,updateMany,deleteMany}` → REST calls to `/api/entities/<name>/...`.
  - `base44.functions.invoke(name, payload)` → `POST /api/functions/<name>`.
  - `base44.auth.*` → MSAL wrappers.
  - `base44.integrations.Core.*` → direct provider calls or API endpoints.
  - `base44.entities.<Name>.subscribe` → SignalR hub listeners.
  - `base44.analytics.track` → Application Insights `trackEvent`.
  - `base44.users.inviteUser` → Entra invite / Graph API.
- Leave all React pages and components untouched except the data-access layer.
- Add a web manifest + Workbox service worker for PWA installability and offline shell.
- **Exit criteria:** the app builds and runs against the Azure API with no Base44 imports remaining.

### Phase 5 — Realtime, automations & agents (Week 7)
- Stand up Azure SignalR; emit create/update/delete events from SQL change tracking.
- Map Base44 scheduled automations → Functions timer triggers; entity automations → SQL triggers / change-tracking-driven Functions; connector automations → webhook endpoints.
- Recreate the three in-app AI agents (`staff_assistant`, `drilling_intelligence`, `scheduling_assistant`) as Azure Functions backed by Azure OpenAI, with the same tool-permission set and the same conversation-UI components.
- **Exit criteria:** realtime updates live; all scheduled jobs fire; agents respond in-app.

### Phase 6 — Hosting, domain & cutover (Week 8)
- Deploy the frontend to Azure Static Web Apps with a custom domain; link the Functions API.
- Configure CORS and Entra redirect URIs for the production domain.
- Run a final delta data export from Base44 into Azure SQL.
- Switch DNS to the Azure domain.
- Run both systems read-only in parallel for a validation window (data reconciliation, user acceptance testing).
- Decommission the Base44 app once validated.
- **Exit criteria:** production running on Azure, Base44 app decommissioned.

---

## 5. Data Layer Migration — Detail

### Schema translation rules
- Every Base44 entity → one SQL table named after the entity (e.g. `Staff`, `RotaAssignment`, `AFPLineItem`).
- `id` → `UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY`.
- `created_date`, `updated_date` → `DATETIME2`, set by the API.
- `created_by_id` → `NVARCHAR(64)` (Entra object ID).
- `string` → `NVARCHAR(n)` (size from max observed value, capped at `NVARCHAR(MAX)` for long text).
- `number` → `DECIMAL(18,4)` or `FLOAT` depending on usage.
- `boolean` → `BIT`.
- `string` with `format: date` → `DATE`; `format: date-time` → `DATETIME2`.
- `enum` → `NVARCHAR(64)` with a `CHECK` constraint listing allowed values.
- `array` / nested `object` → `NVARCHAR(MAX)` JSON (e.g. `contacts`, `week_breakdown`, `action_items`, `permissions`, `groups`, `field_map`, `filters`).
- `default` values reproduced as column defaults.

### Row-Level Security
- A single schema-level security predicate function `rls.fn_security_predicate` reads `SESSION_CONTEXT` keys: `user_id`, `division_id`, `managed_division_ids` (JSON array), `role`, `is_enterprise_admin`.
- For each table, `CREATE SECURITY POLICY` adds:
  - `FILTER PREDICATE` on `SELECT/UPDATE/DELETE` (rows the caller may see).
  - `BLOCK PREDICATE` on `INSERT/UPDATE/DELETE` (writes the caller may make).
- The Functions API sets `SESSION_CONTEXT` on every pooled connection **before** executing the user's query, using the caller's Entra identity → mapped user profile (division, role, etc.).
- Service-principal connections (timer/webhook functions) set `SESSION_CONTEXT` to a system role that bypasses RLS.
- Each entity's RLS rules are translated from its `rls` JSON (the `$or` of division match, managed-division match, admin, enterprise admin) into the predicate logic.

### Data export & import
- A one-time Node script iterates every entity, calls `base44.entities.<Name>.list('-created_date', 1000)` with pagination, and bulk-inserts into the matching SQL table via `bcp` / `SqlBulkCopy`.
- IDs are preserved so foreign-key relationships (e.g. `staff.team_id`, `rotaAssignment.staff_id`, `afpLineItem.afp_id`) survive.
- A delta export runs at cutover to capture records changed during the build window.

---

## 6. Integrations Mapping

| Base44 integration | Azure replacement | Notes |
|---|---|---|
| `InvokeLLM` | Azure OpenAI | Same prompt + `response_json_schema` → structured outputs. `add_context_from_internet` → Azure AI Search grounding. |
| `SendEmail` | Azure Communication Services Email | Custom domain required for non-registered recipients (same constraint as Base44). |
| `UploadFile` / `UploadPrivateFile` | Azure Blob Storage | Public container for uploads; private container + `CreateFileSignedUrl` → SAS tokens. |
| `GenerateImage` | Direct provider (DALL·E via Azure OpenAI or Azure AI Foundry) | |
| `GenerateVideo` | Direct provider (Azure Sora / Veo) | |
| `GenerateSpeech` | Azure AI Speech (neural TTS) | |
| `TranscribeAudio` | Azure AI Speech (batch transcription) | |
| `ExtractDataFromUploadedFile` | Azure Document Intelligence | Same `json_schema` → structured output. |
| `base44.analytics.track` | Application Insights `trackEvent` | |
| `base44.users.inviteUser` | Microsoft Graph invite / B2B | |
| `base44.asServiceRole` | Service principal SQL connection | Used by timer + webhook functions. |

### Connector webhooks (point at the new Azure Functions URLs)
Geotab, Holman, Asset Panda, Mitti/SafetyCulture, KeyLogBook, Stripe, Bob HR, Concur, WhatsApp, Zapier, accounting — each provider's webhook configuration in their dashboard must be updated to `https://<custom-domain>/api/functions/<webhookName>`.

---

## 7. Auth Migration — Detail

- **Entra ID app registration** — SPA platform with redirect URIs for dev/staging/prod; expose an API scope; define app roles (`Admin`, `Management`, `User`, `Field`, `ReadOnly`) plus enterprise-admin.
- **User provisioning** — office/admin/field staff as Entra **members**; subcontractors and client-portal guests as Entra **B2B guests**. All authentication flows through Entra (no local password store).
- **Permission groups** — Base44's `PermissionGroup` system (per-module none/read/write) is preserved as a local `PermissionGroups` table; each Entra user is mapped to a permission group via a `Staff.permission_group_id` column. A sync function (mirroring `syncStaffUserRoles`) keeps Entra app roles and the local table aligned.
- **Frontend** — MSAL.js 3.x (PublicClientApplication) with auth-code + PKCE; silent token acquisition; the existing `AuthContext` is replaced with an Entra-backed provider that exposes the same `me()`, `isAuthenticated()`, `logout()`, `updateMe()` surface so pages don't change.
- **API** — Functions validate the Entra JWT on every request (EasyAuth or `@azure/functions` middleware using `@azure/msal-node` / `jwt-proxy`); the validated identity sets `SESSION_CONTEXT` for RLS.
- **Existing auth pages** — Login, Register, ForgotPassword, ResetPassword are replaced with Entra redirect-to-login; Onboarding is preserved as a post-login gate (first sign-in → profile setup → landing page).

---

## 8. Backend Functions Migration — Detail

- One Azure Function per Base44 `entry.ts`, named identically, same input/output contract.
- HTTP-trigger functions accept the same JSON body and return the same JSON shape (so the frontend swap is mechanical).
- Webhook functions validate an inbound secret/signature (HMAC or shared secret query param) exactly as the Base44 versions do.
- Timer functions use NCRONTAB expressions matching the Base44 schedules (converted to UTC, same as Base44).
- `base44/shared` modules (e.g. `rateResolver`, `afpPopulation`, `keylogbookRemarks`, `weatherClient`, `geofence`, `loadWeight`, `depreciation`, `predictMaintenance`, `bobHrHelpers`) are ported to `/shared` and imported — no logic changes.
- The `base44.entities.<Name>` SDK calls inside functions are replaced with a thin data-access layer over Azure SQL (`mssql` / `tedious`) that honours RLS via `SESSION_CONTEXT`.
- `base44.asServiceRole` (used by scheduled/webhook functions to bypass user context) becomes a service-principal connection that sets a system `SESSION_CONTEXT` role.

---

## 9. Realtime Migration

- Azure SignalR Service with a hub per entity group (or a single hub with entity-typed messages).
- The Functions API, on every create/update/delete, publishes an event `{ id, type, entity_name, data }` to the hub — matching the Base44 `subscribe()` event shape so frontend listeners don't change.
- SQL Server Change Tracking feeds a lightweight dispatcher function that detects changes and pushes them to SignalR (covering changes made outside the API, e.g. scheduled jobs).

---

## 10. Automations & Agents

- **Scheduled automations** → Azure Functions timer triggers (NCRONTAB).
- **Entity automations** (create/update/delete) → SQL AFTER triggers writing to a queue, or change-tracking-driven Functions, invoking the same logic as the Base44 entity automation.
- **Connector automations** → the existing webhook endpoints (no change — the provider just points at the new URL).
- **In-app agent automations** → a Functions endpoint triggered on conversation start, backed by Azure OpenAI with the same tool-permission set (entity read/write, backend-function invocation) and the same conversation-UI components.

---

## 11. Hosting, Domain & Cutover

1. Deploy frontend to Azure Static Web Apps; attach the custom domain (TLS via managed certificate).
2. Link the Functions API as the managed/linked API; configure CORS for the SWA domain.
3. Update Entra redirect URIs to the production domain.
4. Update all external webhook registrations (Geotab, Holman, Asset Panda, Mitti, KeyLogBook, Stripe, etc.) to the new `https://<custom-domain>/api/functions/<name>` URLs.
5. Run the final delta data export from Base44 → Azure SQL.
6. Switch DNS to the Azure domain.
7. Run Base44 (read-only) and Azure side-by-side for a validation window; reconcile data and run user acceptance tests.
8. Decommission the Base44 app once validated.

---

## 12. Timeline (indicative)

| Week | Phase | Key deliverable |
|---|---|---|
| 1 | 0 — Foundation | Azure provisioned, repo scaffolded, Entra app created |
| 2–3 | 1 — Data layer | All entities in Azure SQL, RLS verified, data exported |
| 3 | 2 — Auth | Entra sign-in working end-to-end |
| 4–7 | 3 — Backend functions | ~200 functions ported, contracts verified |
| 5–7 | 4 — Frontend SDK | App runs on Azure API, no Base44 imports |
| 7 | 5 — Realtime/automations/agents | Live updates, scheduled jobs, agents |
| 8 | 6 — Cutover | Custom domain, DNS switch, Base44 decommissioned |

> This is an indicative 8-week plan for a single focused engineer/team. The ~200-function port is the long pole; parallelising across engineers can compress Phases 3–4.

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| RLS predicate bugs lock users out of their own data | High | Test every entity with real per-division users before cutover; keep a service-principal bypass for admin recovery. |
| Function contract drift breaks the frontend | High | Pin every function to its current input/output shape; add contract tests. |
| Entra B2B guest friction for subcontractors/clients | Medium | Pre-provision guests; provide a clear sign-in link; offer a fallback invite flow. |
| Webhook URL changes drop events during cutover | Medium | Run both systems in parallel; keep Base44 webhooks live until Azure is confirmed receiving. |
| Large data export misses late-changing records | Medium | Delta export at cutover; freeze writes on Base44 during the final sync. |
| AGS/AFP/EWR parsing differences on Azure | High | Port parsers verbatim from `base44/shared`; test against real uploaded files. |
| Azure cost overrun | Medium | Right-size the Functions Premium plan and SQL tier; monitor via Application Insights; set budgets. |
| Offline/PWA gaps on field devices | Low | Workbox offline shell + background sync for scans. |

---

## 14. Cost Considerations (rough)

- **Azure SQL** — Business-critical or General Purpose tier; cost scales with DTU/vCore and storage.
- **Azure Functions Premium** — EP1/EP2 plan; predictable for always-on + scheduled jobs.
- **Azure Static Web Apps** — Standard tier for custom domain + managed identity.
- **Azure SignalR Service** — Standard tier, unit-based (connections + messages).
- **Azure Blob Storage** — negligible for typical upload volumes.
- **Azure OpenAI** — pay-per-token for InvokeLLM + agents.
- **Azure Communication Services Email** — per-email pricing; custom domain verification required.
- **Entra ID** — P1 licences for app roles / B2B guests beyond the free tier.
- **Application Insights** — first 5 GB/month free, then per-GB.

A detailed cost model should be built against expected usage (user count, function invocations, data volume) before execution.

---

## 15. Rollback Plan

- Until DNS is switched, Base44 remains the live system — zero risk.
- After the Azure cutover, if a critical defect is found: switch DNS back to the Base44 domain (kept live during the parallel validation window), fix on Azure, re-export any delta, and re-cut over.
- The Base44 app is only decommissioned after the validation window passes with no critical defects.

---

## 16. Pre-Execution Checklist

- [ ] Azure subscription + tenant confirmed
- [ ] Custom domain decided and DNS control available
- [ ] Entra ID admin access available for app registration + user provisioning
- [ ] All external webhook providers' dashboards accessible (Geotab, Holman, Asset Panda, Mitti, KeyLogBook, Stripe, Bob HR, Concur, WhatsApp, Zapier)
- [ ] API keys/secrets inventoried for every third-party integration (Asset Panda, Geotab, Holman, Mitti, Open-Meteo, Google Maps, Stripe, Azure OpenAI, etc.)
- [ ] Backup of the full Base44 data export taken and stored
- [ ] Stakeholder sign-off on the 8-week timeline and parallel-run window
- [ ] Named migration lead + availability of subject-matter experts for UAT

---

## 17. What Does NOT Change

- The entire React + Vite + Tailwind frontend — pages, components, design system, the Ground Control brand (dark green `#2E5A1A` primary, leaf-green `#8DC63F` accent, Inter typography, glass and insight-card surfaces).
- All business logic in `base44/shared` modules (ported verbatim).
- All input/output contracts of the ~200 backend functions.
- The user experience — same screens, same flows, same look and feel.

Only the platform plumbing underneath changes.

---

*End of document.*
