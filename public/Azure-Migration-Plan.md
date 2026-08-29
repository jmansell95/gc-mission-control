# GC Mission Control — Azure Migration Runbook

**Owner:** GC Mission Control IT
**Target Architecture:** Azure Static Web Apps · Azure SQL · Azure Functions Premium · Entra ID
**Timeline:** 13 weeks (3 months) — phased, low-risk, zero-downtime cutover
**Last updated:** 29 August 2026
**Version:** 2.0 — includes all automation engines, Mitti/SafetyCulture integration, mobile field routing, division context, and AI delay prediction

---

## Executive Summary

GC Mission Control currently runs on the Base44 platform-as-a-service. This runbook details the complete migration to a fully Azure-native architecture, giving Ground Control complete ownership of data, infrastructure, and code. The migration is phased over 13 weeks to ensure zero downtime, full data integrity, and a clean cutover with rollback capability at every stage.

The existing React + Vite + Tailwind frontend is retained and redeployed to Azure Static Web Apps. The Base44 entity layer maps to Azure SQL tables with Row-Level Security via SESSION_CONTEXT. The Base44 backend functions port to Azure Functions (TypeScript, isolated worker). Authentication moves to Microsoft Entra ID with MSAL integration.

**Key principles:**
- **No big-bang.** Every phase has a rollback path.
- **Data parity.** Every record is verified before and after migration.
- **UK-localised.** All currency in £, all dates in en-GB, all text in British English.
- **Cost-conscious.** Consumption-tier resources during migration, scaled up at go-live.

---

## Phase 1 — Foundation & Infrastructure Provisioning (Weeks 1–3)

### Objectives
Provision all Azure infrastructure, establish the resource topology, and configure networking and security baselines before any code or data moves.

### 1.1 Resource Group & Topology

Create a dedicated resource group for the entire GC Mission Control estate. All resources live in `UK South` for data residency compliance.

```bash
# Create the resource group
az group create \
  --name rg-gc-mission-control-prod \
  --location uksouth

# Create a staging resource group for parallel running
az group create \
  --name rg-gc-mission-control-staging \
  --location uksouth
```

### 1.2 Azure SQL Database

Provision the primary database with Row-Level Security support. Use the General Purpose tier during migration, Business Critical at go-live.

```bash
# Create the SQL Server
az sql server create \
  --name sql-gc-mission-control \
  --resource-group rg-gc-mission-control-prod \
  --location uksouth \
  --admin-user "gc_admin" \
  --admin-password "$(openssl rand -base64 24)"

# Allow Azure services to connect
az sql server firewall-rule create \
  --name AllowAzureServices \
  --resource-group rg-gc-mission-control-prod \
  --server sql-gc-mission-control \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Create the database
az sql db create \
  --name gc-mission-control \
  --resource-group rg-gc-mission-control-prod \
  --server sql-gc-mission-control \
  --service-objective GP_Gen5_4 \
  --zone-redundant true

# Enable Advanced Data Security
az sql db threat-policy update \
  --resource-group rg-gc-mission-control-prod \
  --server sql-gc-mission-control \
  --name gc-mission-control \
  --state Enabled
```

### 1.3 Azure Functions Premium Plan

The Premium plan provides VNet integration, pre-warmed instances, and no cold start — essential for a field-ops platform where crew need instant responses on mobile.

```bash
# Create the Functions Premium plan
az functionapp plan create \
  --name asp-gc-mission-control \
  --resource-group rg-gc-mission-control-prod \
  --location uksouth \
  --sku EP1 \
  --is-linux

# Create the Functions app
az functionapp create \
  --name func-gc-mission-control \
  --resource-group rg-gc-mission-control-prod \
  --plan asp-gc-mission-control \
  --runtime node \
  --runtime-version 20 \
  --storage-account stgcmctrlfunc \
  --functions-version 4
```

### 1.4 Azure Static Web App

The React frontend deploys here. It connects to Azure Functions for API calls and uses Entra ID for authentication.

```bash
# Create the Static Web App
az staticwebapp create \
  --name stw-gc-mission-control \
  --resource-group rg-gc-mission-control-prod \
  --location uksouth \
  --source https://github.com/gc-mission-control/frontend \
  --branch main \
  --app-location "/" \
  --output-location "dist" \
  --login-with-github
```

### 1.5 Key Vault & Secrets

All API keys, connection strings, and secrets live in Key Vault. Azure Functions reference them via managed identity — no secrets in code or config files.

```bash
# Create the Key Vault
az keyvault create \
  --name kv-gc-mission-control \
  --resource-group rg-gc-mission-control-prod \
  --location uksouth \
  --enable-rbac-authorization true

# Grant the Functions app access to the Key Vault
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee "$(az functionapp identity assign --name func-gc-mission-control --resource-group rg-gc-mission-control-prod --query principalId -o tsv)" \
  --scope "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-gc-mission-control-prod/providers/Microsoft.KeyVault/vaults/kv-gc-mission-control"

# Store the SQL connection string
az keyvault secret set \
  --vault-name kv-gc-mission-control \
  --name "SqlConnectionString" \
  --value "Server=tcp:sql-gc-mission-control.database.windows.net,1433;Database=gc-mission-control;User ID=gc_admin;Password=YOUR_PASSWORD;Encrypt=true;"
```

### 1.6 Application Insights & Monitoring

Full observability from day one — every function invocation, every SQL query, every frontend error is logged.

```bash
# Create Application Insights
az monitor log-analytics workspace create \
  --workspace-name log-gc-mission-control \
  --resource-group rg-gc-mission-control-prod \
  --location uksouth

az monitor app-insights component create \
  --app ai-gc-mission-control \
  --location uksouth \
  --resource-group rg-gc-mission-control-prod \
  --workspace "/subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-gc-mission-control-prod/providers/Microsoft.OperationalInsights/workspaces/log-gc-mission-control"

# Link to the Functions app
az functionapp config appsettings set \
  --name func-gc-mission-control \
  --resource-group rg-gc-mission-control-prod \
  --settings "APPINSIGHTS_INSTRUMENTATIONKEY=$(az monitor app-insights component show --app ai-gc-mission-control -g rg-gc-mission-control-prod --query instrumentationKey -o tsv)"
```

### 1.7 Entra ID App Registration

Register the application in Entra ID for authentication. This replaces the Base44 auth provider entirely.

```bash
# Create the app registration
az ad app create \
  --display-name "GC Mission Control" \
  --web-redirect-uris "https://gc-mission-control.azurestaticapps.net/auth/callback" "https://staging.gc-mission-control.azurestaticapps.net/auth/callback" \
  --required-resource-accesses '[{"resourceAppId":"00000003-0000-0000-c000-000000000000","resourceAccess":[{"id":"e1fe6dd8-ba00-4677-874c-44d40a0a0e3b","type":"Scope"}]}]'

# Create a client secret
az ad app credential reset \
  --id "$(az ad app list --display-name 'GC Mission Control' --query [0].id -o tsv)" \
  --append
```

### Phase 1 Checklist
- [ ] Resource groups created (prod + staging)
- [ ] Azure SQL server + database provisioned in UK South
- [ ] Azure Functions Premium plan + app created
- [ ] Azure Static Web App created and linked to GitHub repo
- [ ] Key Vault provisioned with managed identity access
- [ ] Application Insights + Log Analytics workspace configured
- [ ] Entra ID app registration created with redirect URIs
- [ ] Firewall rules configured (Azure services + office IP)
- [ ] All infrastructure verified via Azure portal health checks

---

## Phase 2 — Codebase Export & Repository Baseline (Weeks 3–4)

### Objectives
Export the full source code from the Base44 sandbox, establish a version-controlled repository, and set up CI/CD pipelines for automated deployment to Azure.

### 2.1 Source Code Export

Export the React frontend, entity schemas, and backend functions from the Base44 sandbox. The frontend code is retained as-is — only the data and auth layers are refactored.

```bash
# Clone the Base44 sandbox repository
git clone https://github.com/base44-sandbox/gc-mission-control.git
cd gc-mission-control

# Create the new production repository
gh repo create gc-mission-control/frontend --private --source=. --push

# Tag the final Base44 version
git tag -a v-base44-final -m "Final version running on Base44"
git push origin v-base44-final
```

### 2.2 Repository Structure

Reorganise the repository for the Azure target architecture:

```
gc-mission-control/
├── frontend/          # React + Vite + Tailwind (retained from Base44)
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── api/               # Azure Functions (TypeScript, isolated worker)
│   ├── src/
│   │   ├── functions/  # One folder per function
│   │   └── shared/     # Shared logic (extracted from base44/shared/)
│   ├── host.json
│   └── package.json
├── database/          # SQL migration scripts
│   ├── migrations/
│   └── seed/
├── infrastructure/    # Bicep templates + CLI scripts
│   └── main.bicep
└── docs/              # Architecture docs, runbooks
```

### 2.3 CI/CD Pipeline

Set up GitHub Actions for automated deployment to Azure Static Web Apps and Azure Functions.

```yaml
# .github/workflows/deploy.yml
name: Deploy to Azure
on:
  push:
    branches: [main]
jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "frontend"
          output_location: "dist"

  deploy-functions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/functions-action@v1
        with:
          app-name: func-gc-mission-control
          package: api
          publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

### Phase 2 Checklist
- [ ] Full source code exported from Base44 sandbox
- [ ] Repository created on GitHub (private)
- [ ] Final Base44 version tagged
- [ ] Repository reorganised into frontend/api/database/infrastructure structure
- [ ] GitHub Actions CI/CD pipeline configured
- [ ] First successful deployment to staging Static Web App
- [ ] First successful deployment to staging Functions app

---

## Phase 3 — Data Layer Migration (Weeks 4–7)

### Objectives
Convert all Base44 JSON entity schemas into relational SQL tables, migrate existing data, and implement Row-Level Security for multi-tenant data isolation.

### 3.1 Schema Conversion

Each Base44 entity becomes a SQL table. Built-in fields (id, created_date, updated_date, created_by_id) are retained as standard columns. JSON array/object fields become either related tables (for arrays of objects) or NVARCHAR(MAX) JSON columns (for simple arrays).

```sql
-- Example: Staff entity → Staff table
CREATE TABLE [dbo].[Staff] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [name] NVARCHAR(255) NOT NULL,
  [division_id] UNIQUEIDENTIFIER NULL,
  [email] NVARCHAR(255) NULL,
  [phone] NVARCHAR(50) NULL,
  [worker_type] NVARCHAR(20) NOT NULL CHECK ([worker_type] IN ('direct_employee','subcontractor','agency')),
  [team_id] UNIQUEIDENTIFIER NULL,
  [permission_group_id] UNIQUEIDENTIFIER NULL,
  [is_active] BIT DEFAULT 1,
  [user_id] UNIQUEIDENTIFIER NULL,
  [created_date] DATETIME2 DEFAULT SYSUTCDATETIME(),
  [updated_date] DATETIME2 DEFAULT SYSUTCDATETIME(),
  [created_by_id] UNIQUEIDENTIFIER NULL,
  -- Denormalised fields
  [division_id_cache] UNIQUEIDENTIFIER NULL,
  -- JSON fields stored as NVARCHAR(MAX)
  [contacts] NVARCHAR(MAX) NULL,
  [avatar_url] NVARCHAR(500) NULL
);

-- Indexes for common query patterns
CREATE INDEX IX_Staff_division_id ON [dbo].[Staff]([division_id]);
CREATE INDEX IX_Staff_team_id ON [dbo].[Staff]([team_id]);
CREATE INDEX IX_Staff_is_active ON [dbo].[Staff]([is_active]);
CREATE INDEX IX_Staff_user_id ON [dbo].[Staff]([user_id]);
```

### 3.2 Row-Level Security

Implement RLS using security predicates and SESSION_CONTEXT. Each request sets the user's division_id and role into SESSION_CONTEXT, and all queries are automatically filtered.

```sql
-- Enable RLS on every tenant-scoped table
ALTER TABLE [dbo].[Staff] ENABLE ROW LEVEL SECURITY;

-- Create a security predicate function
CREATE FUNCTION [dbo].[fn_staff_security_predicate](@division_id AS UNIQUEIDENTIFIER)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN SELECT 1 AS fn_security_predicate_result
WHERE
  -- Enterprise admins see everything
  SESSION_CONTEXT(N'role') = 'admin'
  OR SESSION_CONTEXT(N'is_enterprise_admin') = 'true'
  -- Division directors see their own + managed divisions
  OR (
    SESSION_CONTEXT(N'role') = 'director'
    AND (
      @division_id = CAST(SESSION_CONTEXT(N'division_id') AS UNIQUEIDENTIFIER)
      OR CHARINDEX(CAST(@division_id AS NVARCHAR(50)), SESSION_CONTEXT(N'managed_division_ids')) > 0
    )
  )
  -- Regular users see only their own division
  OR @division_id = CAST(SESSION_CONTEXT(N'division_id') AS UNIQUEIDENTIFIER)
  OR @division_id IS NULL;

-- Bind the predicate
CREATE SECURITY POLICY [dbo].[StaffSecurityPolicy]
ADD FILTER PREDICATE [dbo].[fn_staff_security_predicate]([division_id]) ON [dbo].[Staff];
```

### 3.3 Data Migration Script

Export all data from Base44 entities and bulk-insert into SQL. The script runs in batches to handle large tables.

```typescript
// database/migrate.ts
import { sql } from './connection';

async function migrateEntity(entityName: string, tableName: string) {
  // 1. Export from Base44 (via the SDK export endpoint)
  const records = await exportFromBase44(entityName);

  // 2. Bulk insert into SQL in batches of 500
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    const columns = Object.keys(batch[0]);
    const values = batch.map(r => `(${columns.map(c => `@${c}_${i}`).join(',')})`).join(',');
    const request = new sql.Request();
    batch.forEach((r, j) => columns.forEach(c => request.input(`${c}_${i + j}`, r[c])));
    await request.query(`INSERT INTO [dbo].[${tableName}] (${columns.join(',')}) VALUES ${values}`);
  }

  console.log(`Migrated ${records.length} records from ${entityName} to ${tableName}`);
}
```

### 3.4 Data Access Layer

Create a TypeScript data access layer that mirrors the Base44 SDK API, so the frontend code changes minimally.

```typescript
// api/src/shared/dataAccess.ts
import { sql } from './connection';

export class EntityAccess<T> {
  constructor(private tableName: string) {}

  async list(sort?: string, limit?: number): Promise<T[]> {
    const request = new sql.Request();
    const sortClause = sort ? `ORDER BY ${sort.replace('-', 'DESC')}` : '';
    const limitClause = limit ? `TOP ${limit}` : '';
    const result = await request.query(`SELECT ${limitClause} * FROM [dbo].[${this.tableName}] ${sortClause}`);
    return result.recordset;
  }

  async filter(filter: Record<string, any>, sort?: string, limit?: number): Promise<T[]> {
    const request = new sql.Request();
    const conditions = Object.entries(filter).map(([k, v]) => {
      if (v === null || v === undefined) return `[${k}] IS NULL`;
      request.input(k, v);
      return `[${k}] = @${k}`;
    }).join(' AND ');
    const sortClause = sort ? `ORDER BY ${sort.replace('-', 'DESC')}` : '';
    const limitClause = limit ? `TOP ${limit}` : '';
    const result = await request.query(`SELECT ${limitClause} * FROM [dbo].[${this.tableName}] WHERE ${conditions} ${sortClause}`);
    return result.recordset;
  }

  async get(id: string): Promise<T> {
    const request = new sql.Request();
    request.input('id', id);
    const result = await request.query(`SELECT * FROM [dbo].[${this.tableName}] WHERE [id] = @id`);
    return result.recordset[0];
  }

  async create(data: Partial<T>): Promise<T> {
    const request = new sql.Request();
    const columns = Object.keys(data);
    columns.forEach(c => request.input(c, (data as any)[c]));
    const columnList = columns.join(',');
    const valueList = columns.map(c => `@${c}`).join(',');
    const result = await request.query(`INSERT INTO [dbo].[${this.tableName}] (${columnList}) OUTPUT INSERTED.* VALUES (${valueList})`);
    return result.recordset[0];
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const request = new sql.Request();
    request.input('id', id);
    const setClause = Object.entries(data).map(([k, v]) => { request.input(k, v); return `[${k}] = @${k}`; }).join(',');
    const result = await request.query(`UPDATE [dbo].[${this.tableName}] SET ${setClause}, [updated_date] = SYSUTCDATETIME() WHERE [id] = @id OUTPUT INSERTED.*`);
    return result.recordset[0];
  }

  async delete(id: string): Promise<void> {
    const request = new sql.Request();
    request.input('id', id);
    await request.query(`DELETE FROM [dbo].[${this.tableName}] WHERE [id] = @id`);
  }
}
```

### Phase 3 Checklist
- [ ] All 100+ entity schemas converted to SQL DDL (including MittiConfig, AutomationControl, JobDelayLog, DivisionAccessManifest, HolidayPayAccrual, IncentiveScore, GeofenceEvent, WeatherLog, JobMilestone, CashFlowEntry, AFPLineItem, CVRLineItem, and all new entities added in 2026)
- [ ] Row-Level Security policies created for every tenant-scoped table
- [ ] SESSION_CONTEXT wiring tested (user → division_id → filtered queries)
- [ ] Data migration script written and tested on staging
- [ ] Full data export from Base44 completed
- [ ] Data imported into staging SQL database
- [ ] Record counts verified (Base44 count = SQL count for every table)
- [ ] Data access layer implemented and unit-tested
- [ ] Sample queries verified against migrated data

---

## Phase 4 — Backend Logic Porting (Weeks 7–10)

### Objectives
Port all 200+ Base44 backend functions to Azure Functions (TypeScript, isolated worker model). Shared logic is extracted into a shared module. The 9 scheduled automation engines become Azure Functions timer triggers. Entity automations become Azure Functions with Event Grid. Webhook receivers (Geotab, Mitti/SafetyCulture, KeyLogBook, Holman, Asset Panda, Stripe, Bob HR, WhatsApp) become HTTP-triggered Azure Functions.

### 4.1 Function Structure

Each Base44 function becomes an Azure Function. The handler signature changes but the business logic is retained.

```typescript
// api/src/functions/geotabWebhook/index.ts
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sql } from '../../shared/connection';
import { processGeofence } from '../../shared/geofence';

export async function geotabWebhook(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('Geotab webhook received');
  try {
    const body = await request.json();
    const secret = request.query.get('secret');
    if (secret !== process.env.GEOTAB_WEBHOOK_SECRET) {
      return { status: 401, jsonBody: { error: 'Invalid secret' } };
    }

    // Set SESSION_CONTEXT for RLS
    await sql.setRequestContext({ role: 'admin' });

    const result = await processGeofence(body);
    return { status: 200, jsonBody: result };
  } catch (error) {
    context.error('Geotab webhook error:', error.message);
    return { status: 500, jsonBody: { error: error.message } };
  }
}

export default geotabWebhook;
```

### 4.2 Scheduled Automation Engines (9 Engines)

Base44 scheduled automations become Azure Functions timer triggers. The NCRONTAB expression runs in UTC. Each engine runs as a service-role (admin) context to bypass RLS, exactly as they do on Base44 via `base44.asServiceRole`.

#### Engine 1 — Payroll Autopilot (`runPayrollAutopilot`)

Runs nightly. Monday exports last week's payroll, Sunday runs the weekly timesheet merge, other days run the daily timesheet merge.

```typescript
// api/src/functions/runPayrollAutopilot/function.json
{
  "bindings": [
    {
      "type": "timerTrigger",
      "direction": "in",
      "name": "timer",
      "schedule": "0 23 * * *",
      "runOnStartup": false
    }
  ]
}

// api/src/functions/runPayrollAutopilot/index.ts
import { Timer, InvocationContext } from '@azure/functions';
import { sql } from '../../shared/connection';
import { runDailyMerge, runWeeklyMerge, runPayrollExport } from '../../shared/payrollAutopilot';

export async function runPayrollAutopilot(timer: Timer, context: InvocationContext): Promise<void> {
  context.log('Payroll autopilot triggered at', new Date().toISOString());
  try {
    await sql.setRequestContext({ role: 'admin' });
    const dayOfWeek = new Date().getDay();

    if (dayOfWeek === 1) {
      // Monday — export last week's approved payroll to the payroll provider
      await runPayrollExport();
    } else if (dayOfWeek === 0) {
      // Sunday — merge the week's approved daily summaries into weekly records
      await runWeeklyMerge();
    } else {
      // Tue–Sat — merge each staff member's granular entries into a daily summary
      await runDailyMerge();
    }
  } catch (error) {
    context.error('Payroll autopilot error:', error.message);
    throw error; // Azure Functions retries automatically on throw
  }
}

export default runPayrollAutopilot;
```

#### Engine 2 — Auto-Billing (`autoBillAssetOnSite` + `autoCreateBillingFromRemarks`)

Runs hourly. Scans approved timesheets and driller log remarks, matches them to BillingRules, and stamps charge amounts onto the timesheet records.

```typescript
// api/src/functions/autoBillAssetOnSite/function.json
{
  "bindings": [
    {
      "type": "timerTrigger",
      "direction": "in",
      "name": "timer",
      "schedule": "0 * * * * *",
      "runOnStartup": false
    }
  ]
}

// api/src/functions/autoBillAssetOnSite/index.ts
import { Timer, InvocationContext } from '@azure/functions';
import { sql } from '../../shared/connection';
import { matchBillingRules, stampCharge } from '../../shared/billingEngine';

export async function autoBillAssetOnSite(timer: Timer, context: InvocationContext): Promise<void> {
  context.log('Auto-billing scan started');
  try {
    await sql.setRequestContext({ role: 'admin' });
    // Fetch all approved timesheets that haven't been charged yet
    const uncharged = await sql.query(`
      SELECT * FROM [dbo].[Timesheet]
      WHERE [status] = 'approved' AND [chargeable] = 0
      AND [task_description] IS NOT NULL
    `);

    let stamped = 0;
    for (const entry of uncharged.recordset) {
      const match = await matchBillingRules(entry.task_description, entry.job_id);
      if (match) {
        await stampCharge(entry.id, match);
        stamped++;
      }
    }
    context.log(`Auto-billing complete: ${stamped} entries charged`);
  } catch (error) {
    context.error('Auto-billing error:', error.message);
    throw error;
  }
}

export default autoBillAssetOnSite;
```

#### Engine 3 — Weather-Rostering (`runWeatherRostering`)

Runs daily at 06:00 UTC (07:00 BST). Checks the Met Office weather forecast for every active job site, and if conditions breach the safety thresholds (wind speed, rainfall, lightning), flags the rota assignment for manager review and sends an alert email.

```typescript
// api/src/functions/runWeatherRostering/function.json
{
  "bindings": [
    {
      "type": "timerTrigger",
      "direction": "in",
      "name": "timer",
      "schedule": "0 6 * * *",
      "runOnStartup": false
    }
  ]
}

// api/src/functions/runWeatherRostering/index.ts
import { Timer, InvocationContext } from '@azure/functions';
import { sql } from '../../shared/connection';
import { getSiteForecast, checkWeatherThresholds } from '../../shared/weatherClient';
import { sendEmail } from '../../shared/emailStyling';

export async function runWeatherRostering(timer: Timer, context: InvocationContext): Promise<void> {
  context.log('Weather rostering engine started');
  try {
    await sql.setRequestContext({ role: 'admin' });
    const today = new Date().toISOString().split('T')[0];

    // Get all active job sites with coordinates
    const sites = await sql.query(`
      SELECT DISTINCT j.[id], j.[name], j.[site_lat], j.[site_lng]
      FROM [dbo].[Job] j
      INNER JOIN [dbo].[RotaAssignment] r ON r.[job_id] = j.[id]
      WHERE r.[assigned_date] = @today AND j.[site_lat] IS NOT NULL
    `, { today });

    for (const site of sites.recordset) {
      const forecast = await getSiteForecast(site.site_lat, site.site_lng);
      const breach = checkWeatherThresholds(forecast);
      if (breach) {
        // Flag the day's assignments for review
        await sql.query(`
          UPDATE [dbo].[RotaAssignment]
          SET [weather_alert] = 1, [weather_alert_note] = @note
          WHERE [job_id] = @jobId AND [assigned_date] = @today
        `, { jobId: site.id, today, note: breach.summary });

        await sendEmail({
          to: 'ops@groundcontrol.co.uk',
          subject: `Weather alert: ${site.name}`,
          body: `Weather conditions at ${site.name} may breach safety thresholds today: ${breach.summary}`,
        });
      }
    }
    context.log('Weather rostering complete');
  } catch (error) {
    context.error('Weather rostering error:', error.message);
    throw error;
  }
}

export default runWeatherRostering;
```

#### Engine 4 — Training Compliance (`runTrainingCompliance`)

Runs daily at 07:00 UTC. Scans all staff compliance items, flags expiring/expired qualifications, and generates training requirements for staff missing required qualifications for their team.

```typescript
// api/src/functions/runTrainingCompliance/function.json
{
  "bindings": [
    {
      "type": "timerTrigger",
      "direction": "in",
      "name": "timer",
      "schedule": "0 7 * * *",
      "runOnStartup": false
    }
  ]
}

// api/src/functions/runTrainingCompliance/index.ts
import { Timer, InvocationContext } from '@azure/functions';
import { sql } from '../../shared/connection';
import { complianceDaysUntil } from '../../shared/complianceDate';

export async function runTrainingCompliance(timer: Timer, context: InvocationContext): Promise<void> {
  context.log('Training compliance engine started');
  try {
    await sql.setRequestContext({ role: 'admin' });
    // Find all compliance items expiring within 30 days or already expired
    const items = await sql.query(`
      SELECT ci.*, s.[name] AS staff_name, s.[email]
      FROM [dbo].[ComplianceItem] ci
      LEFT JOIN [dbo].[Staff] s ON s.[id] = ci.[reference_id]
      WHERE ci.[category] = 'staff' AND ci.[expiry_date] IS NOT NULL
      AND ci.[status_override] = 'auto'
    `);

    const alerts = [];
    for (const item of items.recordset) {
      const daysUntil = complianceDaysUntil(item.expiry_date);
      if (daysUntil !== null && daysUntil <= 30) {
        alerts.push({ item, daysUntil });
      }
    }
    // Send consolidated alert email to the training manager
    if (alerts.length > 0) {
      await sendEmail({
        to: 'training@groundcontrol.co.uk',
        subject: `${alerts.length} compliance items need attention`,
        body: alerts.map(a => `${a.item.staff_name}: ${a.item.title} — ${a.daysUntil < 0 ? 'EXPIRED' : a.daysUntil + ' days remaining'}`).join('\n'),
      });
    }
    context.log(`Training compliance: ${alerts.length} alerts sent`);
  } catch (error) {
    context.error('Training compliance error:', error.message);
    throw error;
  }
}

export default runTrainingCompliance;
```

#### Engine 5 — Client Weekly Report (`runClientWeeklyReport`)

Runs every Friday at 16:00 UTC (17:00 BST). Generates a professional AI-drafted progress report for every active job and publishes it to the client portal.

```typescript
// api/src/functions/runClientWeeklyReport/function.json
{
  "bindings": [
    {
      "type": "timerTrigger",
      "direction": "in",
      "name": "timer",
      "schedule": "0 16 * * 5",
      "runOnStartup": false
    }
  ]
}

// api/src/functions/runClientWeeklyReport/index.ts
import { Timer, InvocationContext } from '@azure/functions';
import { sql } from '../../shared/connection';
import { invokeLLM } from '../../shared/azureOpenAI';

export async function runClientWeeklyReport(timer: Timer, context: InvocationContext): Promise<void> {
  context.log('Client weekly report engine started');
  try {
    await sql.setRequestContext({ role: 'admin' });
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const activeJobs = await sql.query(`
      SELECT * FROM [dbo].[Job] WHERE [status] = 'active'
    `);

    for (const job of activeJobs.recordset) {
      // Aggregate the week's site logs, photos, and milestones
      const logs = await sql.query(`
        SELECT * FROM [dbo].[InvestigationLog]
        WHERE [job_id] = @jobId AND [created_date] >= @weekAgo
        ORDER BY [created_date]
      `, { jobId: job.id, weekAgo });

      const milestones = await sql.query(`
        SELECT * FROM [dbo].[JobMilestone]
        WHERE [job_id] = @jobId AND [status] = 'completed'
        AND [completed_at] >= @weekAgo
      `, { jobId: job.id, weekAgo });

      // Use Azure OpenAI to draft the report
      const prompt = `Write a professional weekly progress report for the geotechnical job "${job.name}".
        Site logs this week: ${JSON.stringify(logs.recordset)}
        Milestones completed: ${JSON.stringify(milestones.recordset)}
        Format: executive summary, progress this week, next week's plan, any issues.`;
      const report = await invokeLLM(prompt);

      // Store as a job comment visible in the client portal
      await sql.query(`
        INSERT INTO [dbo].[JobComment] ([job_id], [author_name], [body], [is_client_visible])
        VALUES (@jobId, 'System — Weekly Report', @report, 1)
      `, { jobId: job.id, report });
    }
    context.log(`Client weekly reports generated for ${activeJobs.recordset.length} jobs`);
  } catch (error) {
    context.error('Client weekly report error:', error.message);
    throw error;
  }
}

export default runClientWeeklyReport;
```

#### Engine 6 — Cash Flow Forecast (`runCashFlowForecast`)

Runs nightly at 22:00 UTC. Projects a 12-week cash flow forecast using pending receivables, open purchase orders, and estimated payroll, and alerts admins if the projected balance drops below £10,000.

```typescript
// api/src/functions/runCashFlowForecast/function.json
{
  "bindings": [
    {
      "type": "timerTrigger",
      "direction": "in",
      "name": "timer",
      "schedule": "0 22 * * *",
      "runOnStartup": false
    }
  ]
}

// api/src/functions/runCashFlowForecast/index.ts
import { Timer, InvocationContext } from '@azure/functions';
import { sql } from '../../shared/connection';
import { sendEmail } from '../../shared/emailStyling';

export async function runCashFlowForecast(timer: Timer, context: InvocationContext): Promise<void> {
  context.log('Cash flow forecast engine started');
  try {
    await sql.setRequestContext({ role: 'admin' });
    // Get approved AFPs (receivables), open POs (payables), and overdue invoices
    const receivables = await sql.query(`SELECT * FROM [dbo].[AFP] WHERE [status] = 'approved'`);
    const payables = await sql.query(`SELECT * FROM [dbo].[PurchaseOrder] WHERE [status] = 'open'`);
    const overdue = await sql.query(`SELECT * FROM [dbo].[Invoice] WHERE [status] = 'overdue'`);

    // Project 12 weeks of net cash flow
    const weeks = [];
    let runningBalance = 50000; // starting balance
    for (let w = 0; w < 12; w++) {
      const weekStart = new Date(Date.now() + w * 7 * 24 * 60 * 60 * 1000);
      const inflow = receivables.recordset.filter(r => new Date(r.expected_date) >= weekStart && new Date(r.expected_date) < new Date(weekStart.getTime() + 7 * 86400000)).reduce((s, r) => s + r.total_claimed, 0);
      const outflow = payables.recordset.filter(p => new Date(p.due_date) >= weekStart && new Date(p.due_date) < new Date(weekStart.getTime() + 7 * 86400000)).reduce((s, p) => s + p.amount, 0);
      const payroll = 15000; // estimated weekly payroll
      const net = inflow - outflow - payroll;
      runningBalance += net;
      weeks.push({ week: w + 1, inflow, outflow, payroll, net, balance: runningBalance });

      // Store the forecast entry
      await sql.query(`
        INSERT INTO [dbo].[CashFlowEntry] ([week_number], [week_start], [inflow], [outflow], [payroll], [net], [projected_balance])
        VALUES (@w, @weekStart, @inflow, @outflow, @payroll, @net, @balance)
      `, { w: w + 1, weekStart, inflow, outflow, payroll, net, balance: runningBalance });

      if (runningBalance < 10000) {
        await sendEmail({
          to: 'finance@groundcontrol.co.uk',
          subject: `Cash flow alert: Week ${w + 1} projected below £10,000`,
          body: `Projected balance for week ${w + 1} is £${runningBalance.toFixed(2)}. Review receivables and payables.`,
        });
      }
    }
    context.log('Cash flow forecast complete: 12 weeks projected');
  } catch (error) {
    context.error('Cash flow forecast error:', error.message);
    throw error;
  }
}

export default runCashFlowForecast;
```

#### Engine 7 — Rig Profitability Check (`runRigProfitabilityCheck`)

Runs weekly on Mondays at 08:00 UTC. Calculates the profitability of every rig deployment (meterage × rate vs day rate) and flags rigs running at a loss.

```typescript
// api/src/functions/runRigProfitabilityCheck/function.json
{
  "bindings": [
    {
      "type": "timerTrigger",
      "direction": "in",
      "name": "timer",
      "schedule": "0 8 * * 1",
      "runOnStartup": false
    }
  ]
}

// api/src/functions/runRigProfitabilityCheck/index.ts
import { Timer, InvocationContext } from '@azure/functions';
import { sql } from '../../shared/connection';
import { matchRigRate } from '../../shared/rigRateMatcher';

export async function runRigProfitabilityCheck(timer: Timer, context: InvocationContext): Promise<void> {
  context.log('Rig profitability check started');
  try {
    await sql.setRequestContext({ role: 'admin' });
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all rig assignments from the past week with meterage
    const rigAssignments = await sql.query(`
      SELECT r.*, s.[name] AS rig_name, j.[name] AS job_name
      FROM [dbo].[RotaAssignment] r
      INNER JOIN [dbo].[SiteAsset] s ON s.[id] = r.[rig_asset_id]
      INNER JOIN [dbo].[Job] j ON j.[id] = r.[job_id]
      WHERE r.[rig_asset_id] IS NOT NULL
      AND r.[assigned_date] >= @weekAgo AND r.[meterage] > 0
    `, { weekAgo });

    for (const assignment of rigAssignments.recordset) {
      const rate = await matchRigRate(assignment.job_id, assignment.rig_asset_id);
      const meterageRevenue = assignment.meterage * rate;
      const dayRate = rate * 1; // simplified
      const profit = meterageRevenue - dayRate;
      if (profit < 0) {
        await sql.query(`
          INSERT INTO [dbo].[FinancialAuditLog] ([entity_name], [entity_id], [action], [record_summary])
          VALUES ('RotaAssignment', @id, 'rig_loss_alert', @summary)
        `, { id: assignment.id, summary: `Rig ${assignment.rig_name} on ${assignment.job_name}: £${profit.toFixed(2)} loss this week` });
      }
    }
    context.log(`Rig profitability checked for ${rigAssignments.recordset.length} assignments`);
  } catch (error) {
    context.error('Rig profitability error:', error.message);
    throw error;
  }
}

export default runRigProfitabilityCheck;
```

#### Engine 8 — Milestone AFP Auto-Create (`autoCreateAFPFromMilestone`)

Runs daily at 09:00 UTC. Checks for jobs that have hit a billing milestone (e.g. site completion, phase completion) and auto-creates a draft AFP populated from field data.

```typescript
// api/src/functions/autoCreateAFPFromMilestone/function.json
{
  "bindings": [
    {
      "type": "timerTrigger",
      "direction": "in",
      "name": "timer",
      "schedule": "0 9 * * *",
      "runOnStartup": false
    }
  ]
}

// api/src/functions/autoCreateAFPFromMilestone/index.ts
import { Timer, InvocationContext } from '@azure/functions';
import { sql } from '../../shared/connection';
import { populateAFPFromFieldData } from '../../shared/afpPopulation';

export async function autoCreateAFPFromMilestone(timer: Timer, context: InvocationContext): Promise<void> {
  context.log('Milestone AFP auto-create started');
  try {
    await sql.setRequestContext({ role: 'admin' });
    // Find milestones completed in the last 24 hours that have an AFP trigger
    const milestones = await sql.query(`
      SELECT m.*, j.[name] AS job_name, j.[client_id]
      FROM [dbo].[JobMilestone] m
      INNER JOIN [dbo].[Job] j ON j.[id] = m.[job_id]
      WHERE m.[status] = 'completed'
      AND m.[completed_at] >= DATEADD(hour, -24, SYSUTCDATETIME())
      AND m.[triggers_afp] = 1
    `);

    for (const milestone of milestones.recordset) {
      // Check if an AFP already exists for this milestone period
      const existing = await sql.query(`
        SELECT TOP 1 1 FROM [dbo].[AFP]
        WHERE [job_id] = @jobId AND [milestone_id] = @milestoneId
      `, { jobId: milestone.job_id, milestoneId: milestone.id });

      if (existing.recordset.length === 0) {
        // Create the draft AFP
        const afp = await sql.query(`
          INSERT INTO [dbo].[AFP] ([job_id], [milestone_id], [status], [period_start], [period_end])
          OUTPUT INSERTED.*
          VALUES (@jobId, @milestoneId, 'draft', @periodStart, @periodEnd)
        `, { jobId: milestone.job_id, milestoneId: milestone.id, periodStart: milestone.period_start, periodEnd: milestone.completed_at });

        // Auto-populate from field data (driller logs, timesheets, deliveries)
        await populateAFPFromFieldData(afp.recordset[0].id, milestone.job_id);
        context.log(`AFP created for job ${milestone.job_name} from milestone ${milestone.title}`);
      }
    }
  } catch (error) {
    context.error('Milestone AFP error:', error.message);
    throw error;
  }
}

export default autoCreateAFPFromMilestone;
```

#### Engine 9 — AI Delay Prediction (`runDelayPrediction`)

Runs daily at 07:00 UTC. Analyses historical delay-log patterns using Azure OpenAI and predicts jobs at risk of delay, flagging them for proactive manager intervention.

```typescript
// api/src/functions/runDelayPrediction/function.json
{
  "bindings": [
    {
      "type": "timerTrigger",
      "direction": "in",
      "name": "timer",
      "schedule": "0 7 * * *",
      "runOnStartup": false
    }
  ]
}

// api/src/functions/runDelayPrediction/index.ts
import { Timer, InvocationContext } from '@azure/functions';
import { sql } from '../../shared/connection';
import { invokeLLM } from '../../shared/azureOpenAI';

export async function runDelayPrediction(timer: Timer, context: InvocationContext): Promise<void> {
  context.log('AI delay prediction started');
  try {
    await sql.setRequestContext({ role: 'admin' });
    // Gather the last 90 days of delay logs for pattern analysis
    const delays = await sql.query(`
      SELECT [job_id], [delay_type], [description], [reported_at], [impacted_days]
      FROM [dbo].[JobDelayLog]
      WHERE [reported_at] >= DATEADD(day, -90, SYSUTCDATETIME())
      ORDER BY [reported_at]
    `);

    // Get all active jobs
    const activeJobs = await sql.query(`SELECT [id], [name], [status] FROM [dbo].[Job] WHERE [status] = 'active'`);

    // Ask Azure OpenAI to identify patterns and predict at-risk jobs
    const prompt = `You are a construction delay analyst. Analyse these historical delay logs from the past 90 days:
      ${JSON.stringify(delays.recordset)}

      Active jobs: ${JSON.stringify(activeJobs.recordset.map(j => ({ id: j.id, name: j.name })))}

      Identify patterns (weather, equipment, staffing, subcontractor delays) and predict which active jobs are at high risk of delay in the next 2 weeks. Return a JSON array of { job_id, risk_level (low/medium/high), predicted_delay_days, reason }.`;
    const predictions = await invokeLLM(prompt, {
      response_json_schema: {
        type: 'object',
        properties: {
          predictions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                job_id: { type: 'string' },
                risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
                predicted_delay_days: { type: 'number' },
                reason: { type: 'string' },
              },
            },
          },
        },
      },
    });

    // Store predictions on the jobs
    for (const pred of predictions.predictions || []) {
      await sql.query(`
        UPDATE [dbo].[Job]
        SET [delay_risk_level] = @risk, [delay_risk_days] = @days, [delay_risk_reason] = @reason,
            [delay_risk_assessed_at] = SYSUTCDATETIME()
        WHERE [id] = @jobId
      `, { risk: pred.risk_level, days: pred.predicted_delay_days, reason: pred.reason, jobId: pred.job_id });
    }
    context.log(`Delay prediction: ${predictions.predictions?.length || 0} jobs assessed`);
  } catch (error) {
    context.error('Delay prediction error:', error.message);
    throw error;
  }
}

export default runDelayPrediction;
```

#### Automation Engine Summary Table

| # | Engine | Function Name | Schedule (UTC) | Purpose |
|---|--------|--------------|----------------|---------|
| 1 | Payroll Autopilot | `runPayrollAutopilot` | `0 23 * * *` (nightly 23:00) | Daily/weekly timesheet merge + Monday payroll export |
| 2 | Auto-Billing | `autoBillAssetOnSite` | `0 * * * * *` (hourly) | Match approved timesheets to BillingRules, stamp charges |
| 3 | Weather-Rostering | `runWeatherRostering` | `0 6 * * *` (daily 06:00) | Met Office forecast check, flag unsafe rota days |
| 4 | Training Compliance | `runTrainingCompliance` | `0 7 * * *` (daily 07:00) | Expiring qualification alerts, training gap generation |
| 5 | Client Weekly Report | `runClientWeeklyReport` | `0 16 * * 5` (Fri 16:00) | AI-drafted weekly progress report to client portal |
| 6 | Cash Flow Forecast | `runCashFlowForecast` | `0 22 * * *` (nightly 22:00) | 12-week cash projection, low-balance alerts |
| 7 | Rig Profitability | `runRigProfitabilityCheck` | `0 8 * * 1` (Mon 08:00) | Rig revenue vs cost, flag loss-making deployments |
| 8 | Milestone AFP | `autoCreateAFPFromMilestone` | `0 9 * * *` (daily 09:00) | Auto-create draft AFP when a billing milestone completes |
| 9 | AI Delay Prediction | `runDelayPrediction` | `0 7 * * *` (daily 07:00) | LLM pattern analysis on delay logs, flag at-risk jobs |

### 4.3 host.json Configuration

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  },
  "extensions": {
    "http": {
      "routePrefix": "api",
      "maxOutstandingRequests": 200,
      "maxConcurrentRequests": 100
    }
  }
}
```

### 4.4 Shared Logic Extraction

All logic shared between functions lives in `api/src/shared/`. This mirrors the Base44 `base44/shared/` directory.

```
api/src/shared/
├── connection.ts          # SQL connection pool + SESSION_CONTEXT
├── dataAccess.ts          # Generic entity CRUD (mirrors Base44 SDK)
├── geofence.ts            # Geofence detection logic (Geotab webhook → auto-timesheet)
├── payrollAutopilot.ts    # Payroll merge + export logic
├── billingEngine.ts       # BillingRule matching + charge stamping
├── emailStyling.ts        # Branded email templates
├── rigRateMatcher.ts      # Rate card matching for rig profitability
├── afpPopulation.ts       # AFP auto-population from field data
├── bobHrHelpers.ts        # Bob HR integration helpers
├── weatherClient.ts       # Met Office weather API client
├── weatherThresholds.ts   # Safety threshold rules for weather rostering
├── complianceDate.ts      # Compliance expiry calculation (UK month/year format)
├── azureOpenAI.ts         # Azure OpenAI wrapper (replaces Base44 InvokeLLM)
├── incentiveEngine.ts     # Weekly incentive score calculation
├── keylogbookTimesheet.ts  # KeyLogBook remarks → timesheet parsing
├── keylogbookRemarks.ts   # KeyLogBook remark classification
├── divisionScope.ts       # Division-scoped data filtering (replaces Base44 division context)
├── staffProfile.ts        # Staff profile resolution + permission group logic
├── appSettings.ts         # AppSetting entity pattern for third-party API config
├── poaResolver.ts         # POA price lock resolution
├── rateResolver.ts        # Rate card resolution pipeline
├── jobRateMatcher.ts      # Job-to-rate-card matching
├── supplierRateMatcher.ts # Supplier rate card matching
├── assetPandaClient.ts    # Asset Panda V3 API client (session token auth)
├── assetPandaLookup.ts    # Asset Panda object lookup
├── assetPandaPush.ts      # Push updates to Asset Panda
├── assetPandaRateMatcher.ts # Asset Panda rate matching
├── assetPandaRawFields.ts # Raw Asset Panda field parsing
├── cvrHelpers.ts          # CVR (Contract Valuation Report) helpers
├── workingDays.ts         # UK working day calculation (excludes bank holidays)
├── ukGeocoder.ts          # UK postcode geocoding
├── predictMaintenance.ts  # Predictive maintenance ML logic
├── depreciation.ts        # Asset depreciation calculation
├── loadWeight.ts          # Vehicle load weight calculation
├── spreadsheetParser.ts   # Rota spreadsheet parser
├── plannerHelpers.ts      # Rta planner helper functions
├── plannerConstants.ts    # Rota planner constants
├── entityRegistry.ts      # Entity name → table name registry
├── vinDecoder.ts          # VIN number decoding for vehicles
├── agsBuilder.ts          # AGS file export builder
└── whatsappSend.ts        # WhatsApp message sending helper
```

### 4.5 Webhook Receivers (HTTP-Triggered Functions)

These Base44 webhook receiver functions become HTTP-triggered Azure Functions. Each validates a shared secret and processes the inbound payload.

| Webhook | Base44 Function | Trigger | Secret Source |
|---------|----------------|---------|--------------|
| Geotab GPS | `geotabWebhook` | HTTP POST | `GEOTAB_WEBHOOK_SECRET` (Key Vault) |
| Mitti/SafetyCulture | `receiveMittiData` | HTTP POST | `MittiConfig.webhook_secret` (SQL) |
| KeyLogBook | `receiveKeyLogBookData` | HTTP POST | `KeyLogBookConfig.webhook_secret` (SQL) |
| Holman Fleet | `holmanWebhook` | HTTP POST | `HOLMAN_WEBHOOK_SECRET` (Key Vault) |
| Asset Panda | `assetPandaWebhook` | HTTP POST | `AssetPandaConfig.webhook_secret` (SQL) |
| Stripe Payments | `stripeWebhook` | HTTP POST | `STRIPE_WEBHOOK_SECRET` (Key Vault) |
| Bob HR | `bobWebhook` | HTTP POST | `BOB_WEBHOOK_SECRET` (Key Vault) |
| WhatsApp | `whatsappWebhook` | HTTP POST | `WHATSAPP_WEBHOOK_SECRET` (Key Vault) |
| Accounting | `accountingWebhook` | HTTP POST | `ACCOUNTING_WEBHOOK_SECRET` (Key Vault) |
| Zapier | `zapierWebhook` | HTTP POST | `ZAPIER_WEBHOOK_SECRET` (Key Vault) |

**Mitti/SafetyCulture webhook example** (the most complex — auto-links audits to jobs and stamps crew check verification):

```typescript
// api/src/functions/receiveMittiData/index.ts
import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { sql } from '../../shared/connection';

export async function receiveMittiData(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    // 1. Validate the webhook secret (stored in MittiConfig entity, not Key Vault)
    const secret = request.query.get('webhook_secret') || request.headers.get('x-webhook-secret');
    const config = await sql.query(`SELECT TOP 1 * FROM [dbo].[MittiConfig] WHERE [key] = 'global'`);
    if (!config.recordset[0]?.enabled || secret !== config.recordset[0].webhook_secret) {
      return { status: 401, jsonBody: { error: 'Invalid secret or receiver disabled' } };
    }

    await sql.setRequestContext({ role: 'admin' });
    const body = await request.json();

    // 2. Extract audit metadata
    const auditId = body.audit_id;
    const templateName = body.template_name || '';
    const auditorEmail = body.audit?.author?.email || '';
    const siteName = body.audit?.metadata?.site_name || '';

    // 3. De-duplicate by audit ID
    const existing = await sql.query(`SELECT TOP 1 1 FROM [dbo].[SafetyReport] WHERE [safetyculture_audit_id] = @auditId`, { auditId });
    if (existing.recordset.length > 0) {
      return { status: 200, jsonBody: { status: 'duplicate', message: 'Audit already stored' } };
    }

    // 4. Auto-classify the audit category (vehicle_check, powra, equipment, general)
    const category = classifyAudit(templateName);

    // 5. Auto-link to a job by site name (if auto_link_to_jobs is enabled)
    let jobId = null;
    if (config.recordset[0].auto_link_to_jobs && siteName) {
      const job = await sql.query(`SELECT TOP 1 [id], [name] FROM [dbo].[Job] WHERE [name] LIKE '%' + @siteName + '%' OR [location] LIKE '%' + @siteName + '%'`, { siteName });
      if (job.recordset[0]) jobId = job.recordset[0].id;
    }

    // 6. Match the auditor to a Staff record by email
    let auditorStaffId = null;
    if (auditorEmail) {
      const staff = await sql.query(`SELECT TOP 1 [id] FROM [dbo].[Staff] WHERE [email] = @email`, { email: auditorEmail });
      if (staff.recordset[0]) auditorStaffId = staff.recordset[0].id;
    }

    // 7. Store the safety report
    await sql.query(`
      INSERT INTO [dbo].[SafetyReport] (
        [safetyculture_audit_id], [report_type], [audit_category], [audit_template_name],
        [audit_title], [auditor_name], [auditor_email], [auditor_staff_id],
        [job_id], [site_name], [conducted_at], [completed_at],
        [overall_score], [max_score], [score_percentage], [pass_fail],
        [items_failed], [items_passed], [action_items], [raw_payload], [status]
      ) VALUES (
        @auditId, 'safetyculture_audit', @category, @templateName,
        @title, @auditorName, @auditorEmail, @auditorStaffId,
        @jobId, @siteName, @conductedAt, @completedAt,
        @overallScore, @maxScore, @scorePct, @passFail,
        @itemsFailed, @itemsPassed, @actionItems, @rawPayload, 'open'
      )
    `, { auditId, category, templateName, title: body.audit?.name || '', auditorName: body.audit?.author?.name || '', auditorEmail, auditorStaffId, jobId, siteName, conductedAt: body.audit?.started_at, completedAt: body.audit?.completed_at, overallScore: body.audit?.score, maxScore: body.audit?.max_score, scorePct: body.audit?.score_percentage, passFail: body.audit?.pass_fail || 'pending', itemsFailed: body.audit?.items_failed || 0, itemsPassed: body.audit?.items_passed || 0, actionItems: JSON.stringify(body.audit?.action_items || []), rawPayload: JSON.stringify(body) });

    // 8. Stamp the crew member's RotaAssignment with the Mitti verification timestamp
    if (auditorStaffId && jobId) {
      const today = new Date().toISOString().split('T')[0];
      const column = category === 'vehicle_check' ? 'mitti_vehicle_check_at'
        : category === 'powra' ? 'mitti_powra_at'
        : category === 'equipment' ? 'mitti_equipment_check_at' : null;
      if (column) {
        await sql.query(`
          UPDATE [dbo].[RotaAssignment] SET [${column}] = SYSUTCDATETIME()
          WHERE [staff_id] = @staffId AND [job_id] = @jobId AND [assigned_date] = @today
        `, { staffId: auditorStaffId, jobId, today });
      }
    }

    // 9. Update the MittiConfig last-webhook status
    await sql.query(`
      UPDATE [dbo].[MittiConfig] SET
        [last_webhook_at] = SYSUTCDATETIME(),
        [last_webhook_status] = 'success',
        [last_webhook_summary] = @summary
      WHERE [key] = 'global'
    `, { summary: `Stored audit "${body.audit?.name || templateName}" · ${body.audit?.items_failed || 0} action items` });

    return { status: 200, jsonBody: { status: 'success', audit_id: auditId, job_linked: !!jobId } };
  } catch (error) {
    context.error('Mitti webhook error:', error.message);
    await sql.query(`UPDATE [dbo].[MittiConfig] SET [last_webhook_status] = 'failed', [last_webhook_summary] = @msg WHERE [key] = 'global'`, { msg: error.message });
    return { status: 500, jsonBody: { error: error.message } };
  }
}

function classifyAudit(templateName: string): string {
  const t = templateName.toLowerCase();
  if (t.includes('vehicle') || t.includes('walk') || t.includes('daily check')) return 'vehicle_check';
  if (t.includes('powra') || t.includes('risk assess') || t.includes('permit')) return 'powra';
  if (t.includes('equipment') || t.includes('plant') || t.includes('inspection')) return 'equipment';
  return 'general';
}

export default receiveMittiData;
```

### 4.6 Entity Automations (Event Grid)

Base44 entity automations (triggered on create/update/delete) become Azure Functions with Event Grid subscriptions. The SystemAuditLog chain (tamper-evident hash chain) is implemented as an Event Grid-triggered function.

```typescript
// api/src/functions/logSystemAudit/function.json
{
  "bindings": [
    {
      "type": "eventGridTrigger",
      "direction": "in",
      "name": "event"
    }
  ]
}

// api/src/functions/logSystemAudit/index.ts
import { EventGridEvent, InvocationContext } from '@azure/functions';
import { sql } from '../../shared/connection';
import crypto from 'crypto';

export async function logSystemAudit(event: EventGridEvent, context: InvocationContext): Promise<void> {
  const { entityName, entityId, action, data, oldData, userId, userName } = event.data;

  await sql.setRequestContext({ role: 'admin' });

  // Calculate the record hash for tamper detection
  const recordHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

  // Get the previous hash in the chain for this entity
  const prev = await sql.query(`
    SELECT TOP 1 [record_hash] FROM [dbo].[SystemAuditLog]
    WHERE [entity_name] = @entityName ORDER BY [created_date] DESC
  `, { entityName });
  const previousHash = prev.recordset[0]?.record_hash || 'genesis';

  // Insert the audit entry, forming the hash chain
  await sql.query(`
    INSERT INTO [dbo].[SystemAuditLog] (
      [entity_name], [entity_id], [action], [changed_fields],
      [field_changes], [record_summary], [record_hash], [previous_hash],
      [actor_user_id], [actor_name], [source], [integrity_status]
    ) VALUES (
      @entityName, @entityId, @action, @changedFields,
      @fieldChanges, @summary, @recordHash, @previousHash,
      @userId, @userName, 'entity_automation', 'valid'
    )
  `, { entityName, entityId, action, changedFields: JSON.stringify(Object.keys(data || {})), fieldChanges: JSON.stringify({ before: oldData, after: data }), summary: `${entityName}: ${data?.name || entityId}`, recordHash, previousHash, userId, userName });
}

export default logSystemAudit;
```

### Phase 4 Checklist
- [ ] All 200+ backend functions ported to Azure Functions (TypeScript, isolated worker)
- [ ] All 9 scheduled automation engines configured with correct NCRONTAB schedules
- [ ] All 10 webhook receivers configured as HTTP-triggered functions
- [ ] Entity automation (SystemAuditLog) configured as Event Grid trigger
- [ ] Shared logic extracted into `api/src/shared/` module (40+ modules)
- [ ] Timer triggers configured for all scheduled automations (see Engine Summary Table)
- [ ] Event Grid triggers configured for entity automations
- [ ] Key Vault references set for all secrets (Geotab, Met Office, Stripe, Holman, etc.)
- [ ] MittiConfig/KeyLogBookConfig/AssetPandaConfig webhook secrets stored in SQL (not Key Vault)
- [ ] Application Insights logging verified for every function
- [ ] All functions tested individually via Azure portal
- [ ] End-to-end API tests passed against staging database
- [ ] AI Delay Prediction tested with Azure OpenAI (GPT-4o-mini)
- [ ] Geofence auto-timesheet creation tested (Geotab webhook → Timesheet draft → RotaAssignment link)

---

## Phase 5 — Authentication Migration (Weeks 9–11)

### Objectives
Replace the Base44 auth provider with Microsoft Entra ID (Azure AD). Implement MSAL in the frontend for login, token refresh, and role-based access control.

### 5.1 Entra ID Configuration

The app registration created in Phase 1 is configured with API permissions, redirect URIs, and role definitions.

```bash
# Add API permissions (Microsoft Graph)
az ad app credential reset \
  --id "$(az ad app list --display-name 'GC Mission Control' --query [0].id -o tsv)" \
  --append

# Define app roles (admin, director, user, field, read_only)
az ad app create \
  --display-name "GC Mission Control" \
  --app-roles '[
    {"allowedMemberTypes":["User"],"displayName":"Admin","id":"00000000-0000-0000-0000-000000000001","value":"admin","description":"Full system access"},
    {"allowedMemberTypes":["User"],"displayName":"Director","id":"00000000-0000-0000-0000-000000000002","value":"director","description":"Division director access"},
    {"allowedMemberTypes":["User"],"displayName":"Field","id":"00000000-0000-0000-0000-000000000003","value":"field","description":"Field crew access"},
    {"allowedMemberTypes":["User"],"displayName":"ReadOnly","id":"00000000-0000-0000-0000-000000000004","value":"read_only","description":"Read-only access"}
  ]'
```

### 5.2 MSAL Frontend Integration

Replace the Base44 auth context with MSAL React.

```typescript
// frontend/src/lib/authConfig.ts
import { Configuration } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.VITE_AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin + '/auth/callback',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: ['User.Read', 'openid', 'profile', 'email'],
};
```

```typescript
// frontend/src/lib/AuthContext.tsx
import { MsalProvider, useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';

export function AuthProvider({ children }) {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthContextInner>{children}</AuthContextInner>
    </MsalProvider>
  );
}

function AuthContextInner({ children }) {
  const { instance, accounts, inProgress } = useMsal();
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (accounts.length > 0 && inProgress === InteractionStatus.None) {
      const account = accounts[0];
      setUser({
        id: account.localAccountId,
        email: account.username,
        full_name: account.name,
        role: account.idTokenClaims?.roles?.[0] || 'field',
      });
    }
  }, [accounts, inProgress]);

  return <AuthContext.Provider value={{ user, login: () => instance.loginPopup(loginRequest), logout: () => instance.logout() }}>{children}</AuthContext.Provider>;
}
```

### 5.3 Token Validation in Azure Functions

Every API call validates the Entra ID token.

```typescript
// api/src/shared/auth.ts
import { JwtPayload, verify } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({ jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys` });

export async function validateToken(token: string): Promise<JwtPayload | null> {
  try {
    const decoded = jwt.decode(token, { complete: true }) as any;
    const key = await client.getSigningKey(decoded.header.kid);
    const verified = jwt.verify(token, key.getPublicKey(), { audience: process.env.AZURE_CLIENT_ID, issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0` }) as JwtPayload;
    return verified;
  } catch {
    return null;
  }
}

export async function setUserContext(req: HttpRequest): Promise<void> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return;
  const payload = await validateToken(token);
  if (!payload) return;
  // Set SESSION_CONTEXT for RLS
  await sql.setRequestContext({
    role: payload.roles?.[0] || 'field',
    division_id: payload.division_id || null,
    is_enterprise_admin: payload.roles?.includes('admin') ? 'true' : 'false',
  });
}
```

### Phase 5 Checklist
- [ ] Entra ID app roles defined (admin, director, field, read_only)
- [ ] MSAL React integrated into the frontend
- [ ] Login flow tested (email/password + Google redirect)
- [ ] Token validation implemented in Azure Functions
- [ ] SESSION_CONTEXT set from Entra ID token claims
- [ ] Role-based access control verified (admin sees all, field sees own division)
- [ ] All existing users invited to the Entra ID tenant
- [ ] Password reset flow tested

---

## Phase 6 — Frontend Adaptation (Weeks 10–12)

### Objectives
Adapt the React frontend to use Azure Functions APIs and Entra ID auth instead of the Base44 SDK. The UI components, pages, and styling are retained entirely — only the data layer and auth context change.

### 6.1 API Client Replacement

Replace the Base44 SDK client with a thin fetch wrapper that calls Azure Functions.

```typescript
// frontend/src/api/azureClient.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getAccessToken(); // from MSAL
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  entities: new Proxy({} as any, {
    get: (_, entityName) => ({
      list: (sort?: string, limit?: number) => request(`/${entityName}?sort=${sort || ''}&limit=${limit || ''}`),
      filter: (filter: any, sort?: string, limit?: number) => request(`/${entityName}/filter`, { method: 'POST', body: JSON.stringify({ filter, sort, limit }) }),
      get: (id: string) => request(`/${entityName}/${id}`),
      create: (data: any) => request(`/${entityName}`, { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request(`/${entityName}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
      delete: (id: string) => request(`/${entityName}/${id}`, { method: 'DELETE' }),
    }),
  }),
  functions: {
    invoke: (name: string, payload: any) => request(`/functions/${name}`, { method: 'POST', body: JSON.stringify(payload) }),
  },
  integrations: {
    Core: {
      InvokeLLM: (payload: any) => request(`/integrations/invokeLLM`, { method: 'POST', body: JSON.stringify(payload) }),
      UploadFile: (payload: any) => request(`/integrations/uploadFile`, { method: 'POST', body: JSON.stringify(payload) }),
      SendEmail: (payload: any) => request(`/integrations/sendEmail`, { method: 'POST', body: JSON.stringify(payload) }),
    },
  },
};
```

### 6.2 Environment Variables

```bash
# frontend/.env.production
VITE_API_BASE_URL=https://func-gc-mission-control.azurewebsites.net/api
VITE_AZURE_CLIENT_ID=your-client-id
VITE_AZURE_TENANT_ID=your-tenant-id
```

### 6.3 Mobile Field Routing (`/m/` Routes)

The app uses hybrid device routing: dedicated `/m/` routes for field crew pages (phones) and responsive layouts for admin hubs. This is retained entirely — only the data layer changes.

```typescript
// frontend/src/App.jsx — the mobile route tree is retained as-is
<Route element={<MobileFieldShell />}>
  <Route path="/m/staff-schedule" element={<RouteGuard><StaffDashboard /></RouteGuard>} />
  <Route path="/m/staff-profile" element={<RouteGuard><StaffProfile /></RouteGuard>} />
  <Route path="/m/deliveries" element={<RouteGuard><DeliveryDashboard /></RouteGuard>} />
  <Route path="/m/scanner" element={<RouteGuard><AssetScannerPage /></RouteGuard>} />
</Route>
```

The `MobileFieldRedirect` component detects phone-width viewports and redirects to the `/m/` equivalent. This logic is purely frontend and needs no Azure changes.

### 6.4 Division Context (Multi-Tenant)

The `DivisionContext` provider manages the active division for scoped data filtering. On Azure, this is backed by the `Division` SQL table and the `DivisionAccessManifest` entity (which controls which divisions each user can access).

```typescript
// frontend/src/contexts/DivisionContext.tsx — retained, only the data source changes
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/azureClient'; // was @/api/base44Client

export function DivisionProvider({ children }) {
  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => api.entities.Division.list(),
  });

  const [activeDivisionId, setActiveDivisionId] = useState(() => {
    return localStorage.getItem('activeDivisionId') || null;
  });

  // Enterprise admins see all divisions; division directors see their own + managed
  const visibleDivisions = user?.role === 'admin' ? divisions : divisions.filter(d =>
    d.id === user.division_id || user.managed_division_ids?.includes(d.id)
  );

  return (
    <DivisionContext.Provider value={{ divisions: visibleDivisions, activeDivisionId, setActiveDivisionId }}>
      {children}
    </DivisionContext.Provider>
  );
}
```

### 6.5 Permission Groups (Access Control)

The `PermissionGroup` entity defines per-module access levels (none/read/write) for every admin section. This maps directly to a SQL table and is enforced by the API layer (Azure Functions check the user's permission group before allowing write operations).

```typescript
// api/src/shared/permissions.ts — enforces permission group access
import { sql } from './connection';

export async function checkPermission(userId: string, module: string, requiredLevel: 'read' | 'write'): Promise<boolean> {
  const result = await sql.query(`
    SELECT pg.[permissions] FROM [dbo].[Staff] s
    INNER JOIN [dbo].[PermissionGroup] pg ON pg.[id] = s.[permission_group_id]
    WHERE s.[id] = @userId
  `, { userId });

  const permissions = result.recordset[0]?.permissions;
  if (!permissions) return false;
  const level = permissions[module] || 'none';
  if (level === 'none') return false;
  if (requiredLevel === 'write' && level !== 'write') return false;
  return true;
}

// Usage in an Azure Function:
export async function updateStaff(request: HttpRequest, context: InvocationContext) {
  const userId = await getRequestUserId(request);
  if (!await checkPermission(userId, 'staff', 'write')) {
    return { status: 403, jsonBody: { error: 'Insufficient permissions' } };
  }
  // ... proceed with the update
}
```

### 6.6 Shift Wizard with Configurable Safety Forms

The Shift Wizard guides crew through arrival → briefing → tasks → end of shift. The safety forms (vehicle check, POWRA, equipment check) are admin-configurable via the `MittiConfig.safety_forms` array and surface as big tappable buttons at each step. This is retained entirely — the Mitti webhook receiver (Section 4.5) stamps the verification timestamps that gate the wizard steps.

### Phase 6 Checklist
- [ ] API client wrapper implemented (drop-in replacement for Base44 SDK)
- [ ] All `@/api/base44Client` imports replaced with `@/api/azureClient`
- [ ] Environment variables configured for staging and production
- [ ] Frontend builds successfully against Azure Functions API
- [ ] All pages render correctly with Azure data
- [ ] Mobile `/m/` field routing verified (StaffDashboard, StaffProfile, DeliveryDashboard, AssetScanner)
- [ ] DivisionContext provider verified (division-scoped data filtering)
- [ ] PermissionGroup access control verified (per-module read/write enforcement)
- [ ] Shift Wizard safety forms verified (Mitti verification badges gate steps)
- [ ] File uploads tested (Azure Blob Storage replaces Base44 UploadFile)
- [ ] Email sending tested (Azure Communication Services replaces Base44 SendEmail)
- [ ] LLM integration tested (Azure OpenAI replaces Base44 InvokeLLM — used by AI Delay Prediction, Client Weekly Report, Drilling Intelligence agent)
- [ ] Geofence auto-timesheet creation tested (Geotab webhook → Timesheet draft → RotaAssignment link)
- [ ] AFP dual-side tables verified (claim side vs client assessment side)
- [ ] EWR AFP format verified (per-borehole meterage for EWR jobs)

---

## Phase 7 — Parallel Running & Validation (Weeks 11–13)

### Objectives
Run the Azure-native version alongside the Base44 version in parallel. All new data writes go to both systems. Compare outputs daily. Fix discrepancies before cutover.

### 7.1 Dual-Write Strategy

During parallel running, every write operation in the Base44 app also writes to Azure SQL. This ensures both systems stay in sync and allows instant rollback.

```typescript
// api/src/shared/dualWrite.ts
export async function dualWrite(entityName: string, operation: string, data: any) {
  // Write to Azure SQL (primary)
  const result = await azureDb[entityName][operation](data);

  // Mirror to Base44 (secondary, for rollback safety)
  if (process.env.DUAL_WRITE_ENABLED === 'true') {
    try {
      await base44.entities[entityName][operation](data);
    } catch (e) {
      console.warn('Base44 mirror write failed:', e.message);
    }
  }

  return result;
}
```

### 7.2 Daily Reconciliation

A nightly job compares record counts and spot-checks data between Base44 and Azure SQL.

```typescript
// api/src/functions/reconcileData/index.ts
export async function reconcileData(timer: Timer, context: ExecutionContext): Promise<void> {
  const entities = ['Staff', 'Job', 'Timesheet', 'RotaAssignment', 'SiteAsset', 'Vehicle', 'AFP'];
  for (const entity of entities) {
    const base44Count = await getBase44Count(entity);
    const azureCount = await getAzureCount(entity);
    if (base44Count !== azureCount) {
      context.error(`Discrepancy in ${entity}: Base44=${base44Count}, Azure=${azureCount}`);
      await sendAlert(`Data discrepancy in ${entity}`, `Base44: ${base44Count}, Azure: ${azureCount}`);
    }
  }
}
```

### Phase 7 Checklist
- [ ] Dual-write enabled for all critical entities
- [ ] Daily reconciliation job running nightly
- [ ] All discrepancies resolved within 48 hours
- [ ] Performance benchmarks passed (Azure response times ≤ Base44)
- [ ] User acceptance testing completed with staging data
- [ ] Rollback procedure documented and tested

---

## Phase 8 — Cutover & Go-Live (Week 13)

### Objectives
Switch all traffic from Base44 to Azure. Decommission the Base44 application. Monitor closely for 7 days post-cutover.

### 8.1 DNS Cutover

Update the custom domain DNS to point to Azure Static Web Apps.

```bash
# Get the Static Web App default domain
az staticwebapp show \
  --name stw-gc-mission-control \
  --resource-group rg-gc-mission-control-prod \
  --query defaultHostname -o tsv

# Configure the custom domain
az staticwebapp custom-domain create \
  --name stw-gc-mission-control \
  --resource-group rg-gc-mission-control-prod \
  --domain-name mission-control.groundcontrol.co.uk \
  --hostname mission-control.groundcontrol.co.uk

# Update DNS CNAME
# In your DNS provider:
# CNAME mission-control → stw-gc-mission-control.azurestaticapps.net
```

### 8.2 Final Data Sync

Run a final delta sync to capture any records written during the cutover window.

```bash
# Run the final sync
az functionapp function invoke \
  --name func-gc-mission-control \
  --function-name finalDataSync \
  --resource-group rg-gc-mission-control-prod
```

### 8.3 Post-Cutover Monitoring

Monitor closely for 7 days. Key alerts:
- API error rate > 1%
- SQL DTU > 80%
- Function execution time > 2s (p95)
- Login failure rate > 5%

### 8.4 Base44 Decommission

After 7 days of stable operation, decommission the Base44 application.

```bash
# Export a final backup from Base44
# (via the Base44 dashboard export tool)

# Archive the Base44 sandbox repository
gh repo archive base44-sandbox/gc-mission-control

# Cancel the Base44 subscription
# (via the Base44 dashboard billing settings)
```

### Phase 8 Checklist
- [ ] DNS cutover completed (custom domain → Azure Static Web Apps)
- [ ] Final delta sync run
- [ ] All users redirected to the Azure-native app
- [ ] 7-day monitoring period completed with no critical alerts
- [ ] Base44 application decommissioned
- [ ] Final backup archived
- [ ] Post-migration review completed
- [ ] Runbook handed to the operations team

---

## Rollback Plan

At every phase, a rollback path is documented and tested:

| Phase | Rollback Action | Time to Roll Back |
|-------|----------------|-------------------|
| 1–2 | Delete Azure resources | < 1 hour |
| 3 | Drop SQL database, keep Base44 as source of truth | < 2 hours |
| 4 | Disable Azure Functions, revert API client to Base44 SDK | < 1 hour |
| 5 | Revert auth context to Base44 provider | < 30 minutes |
| 6 | Redeploy previous frontend build | < 15 minutes |
| 7 | Disable dual-write, revert DNS to Base44 | < 30 minutes |
| 8 | Revert DNS CNAME to Base44, re-enable Base44 app | < 15 minutes |

---

## Cost Estimates (Monthly, Post-Migration)

| Resource | Tier | Estimated Cost (GBP) |
|----------|------|---------------------|
| Azure SQL Database | Business Critical, Gen5_4 | £1,150 |
| Azure Functions Premium | EP1 | £280 |
| Azure Static Web Apps | Standard | £12 |
| Key Vault | Standard | £3 |
| Application Insights | Pay-as-you-go | £40 |
| Azure Blob Storage | Hot, 50GB | £8 |
| Azure Communication Services | Email, 5k/month | £15 |
| Azure OpenAI | GPT-4o-mini, 1M tokens (AI Delay Prediction + Client Reports + Drilling Intelligence agent) | £120 |
| Azure Event Grid | Entity automation triggers | £15 |
| Azure Blob Storage (private) | Safety audit PDFs, site photos, compliance documents | £12 |
| **Total** | | **~£1,655/month** |

*Costs are estimates based on UK South pricing as of August 2026. Actual costs will vary based on usage.*

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Data loss during migration | Low | Critical | Dual-write + daily reconciliation + final delta sync |
| RLS misconfiguration exposes data | Medium | Critical | Security review by external auditor before cutover |
| Auth migration locks out users | Medium | High | All users pre-invited to Entra ID; test logins in staging |
| Performance regression | Low | Medium | Load testing in staging before cutover |
| Third-party integration breakage | Medium | Medium | All integrations (Geotab, Asset Panda, Met Office) tested in staging |
| DNS cutover downtime | Low | Low | Low TTL on DNS records 48 hours before cutover |

---

## Azure & PowerApps Guidance

**Can you start building in Azure now?** Yes — all the infrastructure in Phase 1 can be provisioned immediately. You do not need anything extra from me.

**PowerApps consideration:** The GC Mission Control frontend is a custom React SPA with complex UI (drag-and-drop rota builder, live maps, real-time geofence widgets, AFP dual-side tables). PowerApps is a low-code canvas platform that cannot host this existing codebase or replicate these custom components. The React SPA deploys to Azure Static Web Apps as-is. However, **Power Automate** (included in your Microsoft 365 licence) can replace some of the scheduled automation flows if you prefer a no-code approach — for example, the nightly payroll merge and the weekly client report could run as Power Automate flows calling Azure Functions. The recommendation is: keep the React SPA on Azure Static Web Apps, use Azure Functions for the API layer, and optionally use Power Automate for orchestration where your team prefers visual workflows.

**What you can do now:**
1. Run the Phase 1 Azure CLI scripts to provision all infrastructure.
2. Create the Entra ID app registration.
3. Create the GitHub repository and export the codebase.
4. I'll handle the schema conversion, function porting, and frontend adaptation in the subsequent phases.

---

## Appendix A — Complete Entity Inventory (100+ Entities)

Every Base44 entity becomes a SQL table. Below is the full inventory grouped by domain. Built-in fields (`id`, `created_date`, `updated_date`, `created_by_id`) are standard on every table.

### Core Operations
| Entity | Purpose | RLS (Tenant-Scoped) |
|--------|---------|---------------------|
| Job | Geotechnical job/site | Yes — `division_id` |
| JobType | Job type configuration | No |
| Client | Client company | Yes — `division_id` |
| Team | Crew/team grouping | Yes — `division_id` |
| Staff | Staff member | Yes — `division_id` |
| DrillingCrew | 2-man drilling crew pairing | Yes — `division_id` |
| Contractor | Subcontractor/agency company | Yes — `division_id` |
| Supplier | Equipment/material supplier | Yes — `division_id` |
| Division | Business stream/division | No |
| PermissionGroup | Access level definition | No |
| DivisionAccessManifest | User-to-division access map | No |

### Scheduling & Rota
| Entity | Purpose | RLS |
|--------|---------|-----|
| RotaAssignment | Daily staff assignment | Yes — `division_id` |
| RotaWeek | Weekly rota publish/supersede | Yes — `division_id` |
| RecurringDepotDuty | Continuous depot duty | Yes — `division_id` |
| RecurringAbsence | Recurring leave pattern | Yes — `division_id` |
| Absence | Single absence record | Yes — `division_id` |
| ShiftSwap | Shift swap request | Yes — `division_id` |
| StaffShift | Staff shift definition | Yes — `division_id` |
| BankHoliday | UK bank holiday | No |
| ShutdownPeriod | Christmas/period shutdown | No |
| OvertimeSetting | Overtime configuration | No |
| OvertimeRate | Day-of-week overtime rate | No |

### Timesheets & Payroll
| Entity | Purpose | RLS |
|--------|---------|-----|
| Timesheet | Daily timesheet entry | User-owned + admin |
| TimesheetDelegation | Manager approval delegation | Yes — `division_id` |
| HolidayPayAccrual | Holiday pay accrual tracking | Yes — `division_id` |
| IncentiveScore | Weekly incentive score | Yes — `division_id` |
| Achievement | Staff achievement/badge | Yes — `division_id` |
| Reward | Reward catalogue item | No |
| RewardRedemption | Reward redemption record | Yes — `division_id` |
| StaffReview | Staff performance review | Yes — `division_id` |
| StaffMessage | Staff-to-staff message | User-owned |

### Assets & Equipment
| Entity | Purpose | RLS |
|--------|---------|-----|
| SiteAsset | Rig/plant/vehicle/asset | Yes — `division_id` |
| Vehicle | Vehicle record | Yes — `division_id` |
| VehicleLocationLog | GPS location log | Yes — `division_id` |
| VehicleMOTHistory | MOT test history | Yes — `division_id` |
| VehicleMaintenanceBooking | Maintenance booking | Yes — `division_id` |
| ServiceRecord | Asset service record | Yes — `division_id` |
| EquipmentCalibration | Calibration record | Yes — `division_id` |
| EquipmentCatalogue | Equipment catalogue | No |
| AssetManifest | Asset manifest (QR) | Yes — `division_id` |
| AssetReturnLog | Gear return log | Yes — `division_id` |
| DepreciationProfile | Depreciation config | No |
| ConsumableStockItem | Consumable inventory | Yes — `division_id` |
| GoodsInReceipt | Goods-in receipt | Yes — `division_id` |
| ScrapLog | Scrap disposal log | Yes — `division_id` |

### Compliance & Safety
| Entity | Purpose | RLS |
|--------|---------|-----|
| ComplianceItem | Staff/vehicle/job compliance | User-owned + admin |
| ComplianceTask | Compliance task | Yes — `division_id` |
| ComplianceConfig | Compliance configuration | Admin |
| SafetyReport | SafetyCulture/Mitti audit | Admin |
| ToolboxTalk | Toolbox talk record | Yes — `division_id` |
| EnvironmentalReport | Environmental incident | Yes — `division_id` |
| GeofenceEvent | Geofence entry/exit event | Yes — `division_id` |
| BriefingSignature | Job briefing signature | Yes — `division_id` |
| Signature | E-signature record | User-owned |

### Billing & Financials
| Entity | Purpose | RLS |
|--------|---------|-----|
| AFP | Application for Payment | Admin + enterprise admin |
| AFPLineItem | AFP line item (dual-side) | Admin + enterprise admin |
| AFPTemplate | AFP template | Admin |
| CVR | Contract Valuation Report | Admin |
| CVRLineItem | CVR line item | Admin |
| VariationOrder | Variation order | Admin |
| Invoice | Client invoice | Admin |
| PurchaseOrder | Purchase order | Admin |
| JobBillingContract | Billing contract | Admin |
| JobBillOfQuantities | BOQ | Admin |
| JobCostItem | Job cost item | Yes — `division_id` |
| DailyCost | Daily cost record | Yes — `division_id` |
| CashFlowEntry | Cash flow forecast entry | Admin |
| FinancialAuditLog | Financial audit trail | Admin |
| RateCardItem | Rate card line item | Admin |
| KeywordRateMapping | Keyword-to-rate mapping | Admin |
| POAPriceLock | POA price lock | Admin |
| BillingRule | Billing rule | Admin |
| ExpensePreset | Expense preset | Admin |
| CostPreset | Cost preset | Admin |
| PresetItem | Preset line item | Admin |

### Investigation & Geotechnical
| Entity | Purpose | RLS |
|--------|---------|-----|
| InvestigationLog | Driller/groundworker site log | Yes — `division_id` |
| InvestigationSOR | Schedule of rates | Yes — `division_id` |
| Sample | Soil/water sample | Yes — `division_id` |
| MonitoringWell | Monitoring well | Yes — `division_id` |
| LabTestResult | Lab test result | Yes — `division_id` |
| JobMilestone | Job milestone | Yes — `division_id` |
| JobDelayLog | Delay log | Yes — `division_id` |
| JobComment | Job comment | Yes — `division_id` |
| JobDocument | Job document | Yes — `division_id` |
| JobPack | Job pack (audit) | Yes — `division_id` |
| SitePhoto | Site photo | Yes — `division_id` |
| JobAssetAssignment | Asset-to-job assignment | Yes — `division_id` |
| SubcontractorLog | Subcontractor work log | Yes — `division_id` |

### Logistics & Deliveries
| Entity | Purpose | RLS |
|--------|---------|-----|
| DeliveryLog | Delivery task | Yes — `division_id` |
| DeliveryLeg | Delivery route leg | Yes — `division_id` |

### Training
| Entity | Purpose | RLS |
|--------|---------|-----|
| TrainingCourse | Training course | No |
| TrainingBooking | Course booking | Yes — `division_id` |
| TrainingRequirement | Training requirement | Yes — `division_id` |

### Configuration & Integrations
| Entity | Purpose | RLS |
|--------|---------|-----|
| AppSetting | Generic config (GL codes, Concur, etc.) | Admin |
| BusinessConfig | Business config | Admin |
| MittiConfig | SafetyCulture/Mitti webhook config | Admin |
| AssetPandaConfig | Asset Panda sync config | Admin |
| KeyLogBookConfig | KeyLogBook webhook config | Admin |
| ComplianceConfig | Compliance config | Admin |
| AutomationControl | Automation enable/disable | Admin |
| ConfigList | Dropdown config list | Admin |
| CustomField | Custom field definition | Admin |
| EmailTemplate | Email template | Admin |
| EmailAlertSetting | Email alert config | Admin |
| PortalBranding | Client portal branding | Admin |
| LoginBranding | Login page branding | Admin |
| DashboardLayout | User dashboard layout | User-owned |
| ReportTemplate | Report template | Admin |
| PowerBIDataset | Power BI dataset ref | Admin |
| BackupSchedule | Backup schedule | Admin |
| DivisionSnapshot | Division backup snapshot | Admin |
| HelpTopic | Help guide article | No |
| WeatherLog | Daily weather log | Yes — `division_id` |

### Webhook Logs
| Entity | Purpose | RLS |
|--------|---------|-----|
| KeyLogBookWebhookLog | KeyLogBook webhook log | Admin |

### System
| Entity | Purpose | RLS |
|--------|---------|-----|
| SystemAuditLog | Tamper-evident audit chain | Read: all, Write: admin |

---

## Appendix B — New Feature Migration Notes (2026 Additions)

### B.1 Mitti/SafetyCulture Integration
The Mitti webhook receiver (`receiveMittiData`) auto-links safety audits to jobs and stamps crew check verification timestamps on RotaAssignment records. The `MittiConfig` entity stores the webhook secret, API token, and configurable safety form URLs. See Section 4.5 for the full Azure Function port.

### B.2 Geofence Auto-Timesheet Creation
The Geotab webhook (`geotabWebhook`) detects vehicle arrival/departure at job sites via geofencing (100-yard/91-metre radius) and auto-creates draft Timesheet entries linked to the day's RotaAssignment. This eliminates manual timesheet entry for field crew.

```typescript
// api/src/shared/geofence.ts — the core geofence detection logic
export async function processGeofence(payload: GeotabPayload): Promise<void> {
  const { vehicleId, lat, lng, eventType, timestamp } = payload;

  // Find the vehicle's assigned staff for today
  const assignment = await sql.query(`
    SELECT TOP 1 r.* FROM [dbo].[RotaAssignment] r
    INNER JOIN [dbo].[Vehicle] v ON v.[id] = r.[vehicle_id]
    WHERE v.[id] = @vehicleId AND r.[assigned_date] = @today
    AND r.[status] != 'completed'
  `, { vehicleId, today: timestamp.split('T')[0] });

  if (!assignment.recordset[0]) return;

  if (eventType === 'arrival') {
    // Check if a draft timesheet already exists for this assignment (idempotency)
    const existing = await sql.query(`
      SELECT TOP 1 1 FROM [dbo].[Timesheet]
      WHERE [rota_assignment_id] = @assignmentId AND [source] = 'geotab_auto'
    `, { assignmentId: assignment.recordset[0].id });
    if (existing.recordset.length > 0) return;

    // Create the draft timesheet linked to the assignment
    await sql.query(`
      INSERT INTO [dbo].[Timesheet] (
        [staff_id], [division_id], [job_id], [date], [task_description],
        [task_type], [source], [rota_assignment_id], [status]
      ) VALUES (
        @staffId, @divisionId, @jobId, @date, 'Auto-detected on-site arrival',
        'on_site', 'geotab_auto', @assignmentId, 'draft'
      )
    `, { staffId: assignment.recordset[0].staff_id, divisionId: assignment.recordset[0].division_id, jobId: assignment.recordset[0].job_id, date: timestamp.split('T')[0], assignmentId: assignment.recordset[0].id });

    // Stamp the assignment arrival timestamp
    await sql.query(`UPDATE [dbo].[RotaAssignment] SET [arrived_on_site_at] = @ts WHERE [id] = @id`, { ts: timestamp, id: assignment.recordset[0].id });
  } else if (eventType === 'departure') {
    // Close the draft timesheet and stamp left_site_at
    await sql.query(`
      UPDATE [dbo].[Timesheet] SET [task_duration_minutes] = DATEDIFF(minute, [created_date], @ts)
      WHERE [rota_assignment_id] = @assignmentId AND [source] = 'geotab_auto' AND [status] = 'draft'
    `, { assignmentId: assignment.recordset[0].id, ts: timestamp });
    await sql.query(`UPDATE [dbo].[RotaAssignment] SET [left_site_at] = @ts WHERE [id] = @id`, { ts: timestamp, id: assignment.recordset[0].id });
  }
}
```

### B.3 AI Delay Prediction
The `runDelayPrediction` automation (Engine 9) uses Azure OpenAI to analyse 90 days of delay logs and predict at-risk jobs. The predictions are stored on the Job record (`delay_risk_level`, `delay_risk_days`, `delay_risk_reason`) and surfaced on the admin dashboard. See Section 4.2 for the full implementation.

### B.4 AFP Dual-Side Tables
The AFP (Application for Payment) system uses dual-side line items: the "our claim" side (qty_complete, gross_applied, previous_applied, applied_in_period) and the "client assessment" side (assessed_qty, gross_assessed, previous_assessed, assessed_in_period). The `AFPLineItem` entity stores both sides. The dispute workflow (disputed → counter_offered → agreed → rejected) with full history is retained.

### B.5 EWR AFP Format
EWR (Engineering Waste Remediation) jobs use a per-borehole AFP format with dedicated sheet names (ewr_rotary_drilling, ewr_cp_drilling, ewr_rotary_dayworks, ewr_cp_dayworks, ewr_enabling_crew, ewr_accommodation, ewr_misc, ewr_hires, ewr_mileage). The `week_breakdown` array on AFPLineItem stores per-borehole quantities for EWR drilling lines.

### B.6 Mobile Field Routing
Dedicated `/m/` routes for field crew pages ensure optimal mobile spacing. The `MobileFieldShell` component provides a full-screen shell with no admin header bar. `MobileFieldRedirect` detects phone-width viewports and redirects to the `/m/` equivalent. This is purely frontend — no Azure changes needed.

### B.7 Division Context & Permission Groups
The `DivisionContext` provider manages the active division for scoped data filtering. `PermissionGroup` entities define per-module access levels (none/read/write) enforced by the API layer. See Sections 6.4 and 6.5.

### B.8 Hybrid Device Routing
The app uses hybrid routing: separate `/m/` paths for field-facing pages (phones) and responsive layouts for administrative hubs (tablets/desktop). This ensures responsive perfection across all device classes without compromising the admin experience.

---

## Appendix C — PDF Download & Print Instructions

This runbook is designed to be downloaded as a PDF and printed for offline reference.

### How to Download as PDF
1. Click the **"Download PDF"** button at the top of the page (or press `Ctrl+P` / `Cmd+P`).
2. In the browser's print dialog, select **"Save as PDF"** as the destination.
3. Set paper size to **A4**, margins to **Default**, and enable **Background graphics**.
4. Click **Save** — the PDF will download with all sections, code blocks, and checklists.

### Print Layout
The print CSS automatically:
- Hides all interactive chrome (buttons, sticky headers, progress bars)
- Expands all collapsible phase sections so every step is visible
- Uses brand dark-green (`#2E5A1A`) for all headings
- Formats code blocks with a light background and monospace font
- Paginates cleanly with A4 margins (14mm)
- Keeps tables and code blocks from splitting across pages

### Reading the PDF
- Each phase starts on a new section with a checklist at the end
- Code blocks are copy-pasteable — each has a "Copy" button in the on-screen version
- The presentation view (toggle at the top) shows the executive summary and roadmap for stakeholders
- The runbook view (default) shows the full detailed checklist for the technical team

---

*This runbook is a living document. Update it as the migration progresses, and tick off each checklist item as it completes. Your progress is saved on this device. Version 2.0 — 29 August 2026.*
