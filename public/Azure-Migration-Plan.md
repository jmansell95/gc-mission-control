# GC Mission Control — Azure Migration Runbook

**Owner:** GC Mission Control IT
**Target Architecture:** Azure Static Web Apps · Azure SQL · Azure Functions Premium · Entra ID
**Timeline:** 13 weeks (3 months) — phased, low-risk, zero-downtime cutover
**Last updated:** August 2026

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
- [ ] All 80+ entity schemas converted to SQL DDL
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
Port all 180+ Base44 backend functions to Azure Functions (TypeScript, isolated worker model). Shared logic is extracted into a shared module. Scheduled automations become Azure Functions timer triggers. Entity automations become Azure Functions with Event Grid.

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

### 4.2 Scheduled Automations

Base44 scheduled automations become Azure Functions timer triggers. The NCRONTAB expression runs in UTC.

```typescript
// api/src/functions/runPayrollAutopilot/index.ts
import { Timer, ExecutionContext } from '@azure/functions';
import { sql } from '../../shared/connection';
import { runDailyMerge, runWeeklyMerge, runPayrollExport } from '../../shared/payrollAutopilot';

export async function runPayrollAutopilot(timer: Timer, context: ExecutionContext): Promise<void> {
  context.log('Payroll autopilot triggered');
  try {
    await sql.setRequestContext({ role: 'admin' });
    const dayOfWeek = new Date().getDay();

    if (dayOfWeek === 1) {
      // Monday — export last week's payroll
      await runPayrollExport();
    } else if (dayOfWeek === 0) {
      // Sunday — weekly merge
      await runWeeklyMerge();
    } else {
      // Daily — merge granular timesheets
      await runDailyMerge();
    }
  } catch (error) {
    context.error('Payroll autopilot error:', error.message);
  }
}

// Run nightly at 23:00 UTC (00:00 BST)
// NCRONTAB: 0 23 * * * (but Azure uses NCronTab which is the same)
export default runPayrollAutopilot;
```

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
├── connection.ts        # SQL connection pool + SESSION_CONTEXT
├── dataAccess.ts        # Generic entity CRUD (mirrors Base44 SDK)
├── geofence.ts          # Geofence detection logic
├── payrollAutopilot.ts  # Payroll merge + export logic
├── emailStyling.ts      # Branded email templates
├── rigRateMatcher.ts    # Rate card matching
├── afpPopulation.ts     # AFP auto-population
├── bobHrHelpers.ts      # Bob HR integration helpers
└── weatherClient.ts     # Met Office weather API client
```

### Phase 4 Checklist
- [ ] All 180+ backend functions ported to Azure Functions
- [ ] Shared logic extracted into `api/src/shared/` module
- [ ] Timer triggers configured for all scheduled automations
- [ ] Event Grid triggers configured for entity automations
- [ ] Key Vault references set for all secrets (Geotab, Met Office, etc.)
- [ ] Application Insights logging verified for every function
- [ ] All functions tested individually via Azure portal
- [ ] End-to-end API tests passed against staging database

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

### Phase 6 Checklist
- [ ] API client wrapper implemented (drop-in replacement for Base44 SDK)
- [ ] All `@/api/base44Client` imports replaced with `@/api/azureClient`
- [ ] Environment variables configured for staging and production
- [ ] Frontend builds successfully against Azure Functions API
- [ ] All pages render correctly with Azure data
- [ ] File uploads tested (Azure Blob Storage replaces Base44 UploadFile)
- [ ] Email sending tested (Azure Communication Services replaces Base44 SendEmail)
- [ ] LLM integration tested (Azure OpenAI replaces Base44 InvokeLLM)

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
| Azure OpenAI | GPT-4o-mini, 1M tokens | £120 |
| **Total** | | **~£1,628/month** |

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

*This runbook is a living document. Update it as the migration progresses, and tick off each checklist item as it completes. Your progress is saved on this device.*
