# GC Mission Control — Azure Migration Plan

> **Objective:** Migrate GC Mission Control off the Base44 BaaS platform onto a fully owned Microsoft Azure-native stack, achieving complete ecosystem independence while preserving 100% feature parity for end users.

**Status:** Draft for review · **Owner:** GC Mission Control Platform Team · **Date:** August 2026

---

## 1. Executive Summary

GC Mission Control is currently built on the Base44 backend-as-a-service platform. While Base44 has enabled rapid development, the long-term strategy requires full ownership of the data layer, authentication, compute, and hosting to guarantee portability, cost control, and integration flexibility across the wider Microsoft ecosystem.

This plan defines the target architecture (Azure Static Web Apps + Azure SQL + Azure Functions + Entra ID), the phased migration approach, the data and integration translation strategy, an eight-week timeline, risk register, indicative cost model, rollback plan, and a pre-execution checklist.

**Key principles:**
- **No feature loss** — every user-facing capability is preserved.
- **Frontend reuse** — the existing React + Vite + Tailwind SPA is retained; only the data/auth/compute layers are re-platformed.
- **Azure-native first** — prefer managed Azure services over self-hosted or third-party SaaS where a viable equivalent exists.
- **Security by default** — Entra ID identity, Azure SQL Row-Level Security, and Key Vault secrets throughout.

---

## 2. Target Architecture

| Layer | Current (Base44) | Target (Azure) | Notes |
|---|---|---|---|
| **Frontend hosting** | Base44 managed hosting | Azure Static Web Apps | Same React/Vite/Tailwind build artefact; custom domain + CDN included. |
| **API / compute** | Base44 backend functions (Deno) | Azure Functions Premium (Node.js) | HTTP-triggered functions replace each Base44 function; same request/response contract. |
| **Database** | Base44 entity store (Mongo-style) | Azure SQL Database (SQL Server) | Relational schema with Row-Level Security via `SESSION_CONTEXT`. |
| **Authentication** | Base44 Auth (email/password, Google OAuth, OTP) | Microsoft Entra ID (External Identities) | Email/password, OTP, Google, Microsoft, Apple; JWT issuance. |
| **Secrets** | Base44 platform secrets | Azure Key Vault | Per-division credential isolation; referenced by Functions via app settings. |
| **File storage** | Base44 file storage | Azure Blob Storage | Public + private containers; SAS URLs for private file access. |
| **Realtime** | Base44 entity subscriptions | Azure SignalR Service | Live rota/job/asset updates pushed to the SPA. |
| **Scheduled jobs** | Base44 automations (cron/interval) | Azure Functions Timer triggers + Logic Apps | One-to-one replacement of each scheduled automation. |
| **Webhooks** | Base44 function endpoints | Azure Functions HTTP endpoints | Same public URL pattern; registered with each provider. |
| **Email** | Base44 SendEmail integration | Azure Communication Services Email | Branded transactional email via custom domain. |
| **AI / LLM** | Base44 InvokeLLM integration | Azure OpenAI Service | GPT-equivalent models for assistant features, document parsing, classification. |
| **Analytics** | Base44 analytics | Application Insights | Custom event tracking + performance monitoring. |

### 2.1 Architecture Diagram (text)

```
                    ┌──────────────────────────────┐
                    │   Azure Static Web App (SPA)  │
                    │   React + Vite + Tailwind     │
                    └───────────────┬──────────────┘
                                    │ HTTPS
                    ┌───────────────┴──────────────┐
                    │   Azure Functions Premium    │
                    │   (Node.js HTTP + Timer)     │
                    └──┬──────┬──────┬──────┬───────┘
                       │      │      │      │
              ┌────────┘      │      │      └────────────┐
              ▼                ▼      ▼                   ▼
        ┌──────────┐   ┌─────────┐ ┌──────────┐   ┌──────────────┐
        │ Azure SQL│   │ Key Vault│ │ Blob     │   │ SignalR      │
        │ Database │   │          │ │ Storage  │   │ Service      │
        └──────────┘   └─────────┘ └──────────┘   └──────────────┘
              │
              ▼
        ┌──────────────────┐
        │  Entra ID (JWT)   │
        │  External IDs     │
        └──────────────────┘
```

---

## 3. Migration Phases

### Phase 0 — Foundation (Week 1)
- Provision Azure subscription, resource groups, and naming conventions.
- Stand up Azure SQL Database (server + elastic pool), Key Vault, Storage Account, SignalR, Application Insights.
- Configure Entra ID tenant: app registrations, custom domain, redirect URIs.
- Establish CI/CD: GitHub Actions → Azure Static Web Apps + Azure Functions deploy.
- Create dev/staging/prod environments with slot deployments.

### Phase 1 — Data Schema Translation (Week 2)
- Translate every Base44 entity schema to a SQL Server table definition.
- Map Base44 field types to SQL types (`string` → `NVARCHAR`, `date` → `DATE`, `number` → `DECIMAL/INT`, `boolean` → `BIT`, arrays/objects → `JSON` columns or link tables).
- Implement built-in columns: `id` (UNIQUEIDENTIFIER), `created_date`, `updated_date`, `created_by_id`.
- Translate Base44 Row-Level Security (RLS) rules to SQL Server security predicates using `SESSION_CONTEXT`.
- Build the data migration tooling (Base44 export → SQL bulk insert).

### Phase 2 — API Layer (Week 3–4)
- Scaffold Azure Functions project (Node.js, TypeScript).
- Generate one HTTP function per existing Base44 function (160+ functions).
- Implement a thin SDK shim so the frontend `base44.entities.*` / `base44.functions.invoke` calls map to Functions HTTP calls with identical signatures.
- Implement scheduled functions as Timer triggers (one per existing automation).
- Wire Key Vault secrets; implement per-division credential resolution.

### Phase 3 — Auth Migration (Week 4)
- Implement Entra ID sign-up/sign-in/OTP/reset flows matching the existing UX.
- Migrate user accounts: export Base44 users → Entra ID (invite flow).
- Map Base44 user roles (`admin`, `user`, `director`, `enterprise_admin`) to Entra ID app roles.
- Replace frontend auth SDK calls with MSAL.js; preserve `isAuthenticated`, `me()`, `logout` semantics.

### Phase 4 — Integrations & Webhooks (Week 5)
- Re-point every external webhook (Geotab, Holman, Asset Panda, Mitti/SafetyCulture, KeyLogBook, Stripe, WhatsApp, Bob HR, Concur, accounting) to the new Azure Functions endpoints.
- Re-implement each integration sync function against the provider APIs (logic unchanged; only the host and secrets change).
- Register new webhook URLs in each provider's dashboard.
- Validate end-to-end with test payloads.

### Phase 5 — Frontend Cutover (Week 6)
- Replace the Base44 client SDK import with the new Azure API client shim.
- Update environment variables / API base URL.
- Run full regression against the test matrix.
- Configure custom domain on Azure Static Web Apps; issue TLS certificate.

### Phase 6 — Data Cutover & Go-Live (Week 7)
- Final delta export from Base44 → SQL.
- Switch DNS to the Azure Static Web App.
- Enable Application Insights alerting.
- Monitor for 72 hours; retain Base44 in read-only fallback mode.

### Phase 7 — Decommission (Week 8)
- Archive Base44 export artefacts to Blob Storage.
- Cancel Base44 subscription.
- Retire Base44-hosted webhooks.
- Post-migration review and documentation handover.

---

## 4. Data Layer Translation

### 4.1 Entity → Table Mapping Rules

| Base44 Type | SQL Server Type | Notes |
|---|---|---|
| `string` | `NVARCHAR(n)` / `NVARCHAR(MAX)` | MAX for long text fields (descriptions, notes). |
| `string` (format: date) | `DATE` | |
| `string` (format: date-time) | `DATETIME2` | |
| `number` | `DECIMAL(18,4)` / `INT` | INT for counts/quantities; DECIMAL for money/rates. |
| `boolean` | `BIT` | |
| `array` of objects | `JSON` column or link table | Link table when queried/joined; JSON when embedded. |
| `object` | `JSON` column | |

### 4.2 Row-Level Security Translation

Base44 RLS rules are expressed as JSON query predicates. These translate to SQL Server security predicates:

```sql
-- Example: Staff entity RLS
CREATE SECURITY POLICY Staff.RLS
ADD FILTER PREDICATE
  dbo.fn_staff_access(division_id) = 1
ON dbo.Staff;

CREATE FUNCTION dbo.fn_staff_access(@division_id UNIQUEIDENTIFIER)
RETURNS INT
WITH SCHEMABINDING
AS
BEGIN
  DECLARE @user_division UNIQUEIDENTIFIER = CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'user_division_id'));
  DECLARE @is_admin BIT = CONVERT(BIT, SESSION_CONTEXT(N'is_admin'));
  IF @is_admin = 1 RETURN 1;
  IF @division_id = @user_division RETURN 1;
  RETURN 0;
END;
```

The Azure Functions middleware sets `SESSION_CONTEXT` from the authenticated JWT claims on every connection open.

### 4.3 Built-in Columns

Every table includes:
- `id` — `UNIQUEIDENTIFIER DEFAULT NEWID()` primary key.
- `created_date` — `DATETIME2 DEFAULT SYSUTCDATETIME()`.
- `updated_date` — `DATETIME2` updated via trigger or app layer.
- `created_by_id` — `UNIQUEIDENTIFIER` from the JWT subject.

---

## 5. Integrations Mapping

| Integration | Base44 Function | Azure Target | Webhook Required |
|---|---|---|---|
| Geotab GPS | `syncGeotabFleet`, `geotabWebhook` | Azure Function + Geotab API | Yes |
| Holman Fleet | `syncHolmanFleet`, `holmanWebhook` | Azure Function + Holman API | Yes |
| Asset Panda | `syncAssetPanda`, `assetPandaWebhook` | Azure Function + Asset Panda V3 | Yes |
| Mitti / SafetyCulture | `receiveMittiData`, `syncMitti` | Azure Function HTTP endpoint | Yes |
| KeyLogBook (AGS) | `receiveKeyLogBookData`, `syncKeyLogBook` | Azure Function HTTP endpoint | Yes |
| Bob HR (Hibob) | `syncBobAbsences`, `bobWebhook`, `pushAbsenceToBob` | Azure Function + Bob API | Yes |
| SAP Concur | `syncConcurExpenses` | Azure Function + Concur API | No |
| HMRC CIS | `verifyCIS` | Azure Function + HMRC API | No |
| Stripe | `createStripeCheckout`, `stripeWebhook` | Azure Function + Stripe SDK | Yes |
| WhatsApp | `sendCrewWhatsApp`, `whatsappWebhook` | Azure Function + WhatsApp Cloud API | Yes |
| Accounting (Xero/Sage) | `syncAccounting`, `accountingWebhook` | Azure Function + provider API | Yes |
| Open-Meteo Weather | `syncMetOfficeWeather` | Azure Function + Open-Meteo API | No |
| Google Maps | (geocoding) | Azure Function + Google Maps API | No |
| OpenGround | `syncOpenGround` | Azure Function + OpenGround API | No |
| Power BI | `syncPowerBI` | Azure Function + Power BI REST | No |

---

## 6. Timeline (8 Weeks)

| Week | Phase | Key Deliverables |
|---|---|---|
| 1 | Foundation | Azure resources provisioned; Entra ID configured; CI/CD pipelines. |
| 2 | Schema | All entity schemas translated to SQL DDL; RLS predicates written. |
| 3 | API (part 1) | Functions scaffold; CRUD endpoints for core entities. |
| 4 | API (part 2) + Auth | All functions implemented; Entra ID auth live in staging. |
| 5 | Integrations | All webhooks re-pointed; sync functions validated. |
| 6 | Frontend | SPA pointed at Azure API; full regression in staging. |
| 7 | Cutover | Data migration; DNS switch; go-live; 72h monitoring. |
| 8 | Decommission | Base44 cancelled; archive; review. |

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Data loss during cutover | Low | Critical | Rehearsed dry-runs; delta export at cutover; Base44 kept read-only for 7 days. |
| RLS parity gaps | Medium | High | Automated RLS test suite comparing Base44 vs SQL access for every role. |
| Webhook downtime during re-point | Medium | Medium | Dual-write to both endpoints during overlap window. |
| Entra ID user migration friction | Medium | Medium | Invite flow with branded email; support window. |
| Function cold-start latency | Medium | Medium | Premium plan with pre-warmed instances. |
| Cost overrun | Low | Medium | Weekly cost monitoring; budget alerts at 80%. |
| Integration API rate limits | Low | Medium | Retry/backoff policies; queue-based sync. |

---

## 8. Indicative Cost Model (Monthly, Production)

| Resource | SKU | Est. Cost (GBP) |
|---|---|---|
| Azure SQL Database | Business Critical S4 (200 DTU) | £420 |
| Azure Functions Premium | EP2 (2 instances) | £310 |
| Azure Static Web Apps | Standard | £7 |
| Azure SignalR Service | Standard (1 unit) | £45 |
| Azure Blob Storage | Hot + Cool (500 GB) | £12 |
| Azure Key Vault | Standard | £0.03/10k ops |
| Entra ID External Identities | MAU pricing (2,500 users) | £180 |
| Azure Communication Services Email | ~10k emails | £20 |
| Azure OpenAI Service | Pay-as-you-go | £120 |
| Application Insights | 5 GB ingest | £15 |
| Bandwidth / CDN | ~500 GB egress | £25 |
| **Total (approx.)** | | **~£1,150 / month** |

> Costs are indicative and depend on usage. A FinOps review is recommended after Phase 5.

---

## 9. Rollback Plan

- **T+0 to T+72h:** Base44 app remains fully functional in read-only fallback mode. DNS can be reverted to the Base44 hostname within 15 minutes.
- **Data:** All SQL writes are mirrored back to Base44 via a reverse-sync function during the overlap window, so no data is lost if we roll back.
- **Webhooks:** Each provider's webhook URL is recorded; reverting is a single config change per provider.
- **Decision gate:** A go/no-go review at T+48h. If critical defects exceed threshold, execute rollback.

---

## 10. Pre-Execution Checklist

- [ ] Azure subscription confirmed and billing alerts configured.
- [ ] Entra ID tenant verified; custom domain DNS records created.
- [ ] Resource group naming convention approved.
- [ ] All Base44 entity schemas exported and reviewed.
- [ ] RLS rules catalogued per entity.
- [ ] All backend functions inventoried with trigger types (HTTP / scheduled / webhook).
- [ ] All external webhook URLs documented with provider dashboard access.
- [ ] CI/CD repository access confirmed (GitHub Actions secrets).
- [ ] Staging environment provisioned and smoke-tested.
- [ ] Stakeholder sign-off on timeline and rollback plan.
- [ ] Support team briefed on the cutover comms plan.
- [ ] Backup of current Base44 data exported and stored in Blob Storage.

---

## 11. Out of Scope

- Redesigning the frontend UI/UX — the React SPA is reused as-is.
- Changing business logic or workflows — parity is the goal.
- Migrating to a non-Azure cloud — this is an Azure-native commitment.
- Replacing third-party SaaS providers (Asset Panda, Bob HR, etc.) — only the host platform changes.

---

*This document is the single source of truth for the migration. Update it as decisions are finalised.*
