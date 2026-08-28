# GC Mission Control — Azure-Native Migration Runbook

> **Goal:** Move GC Mission Control off Base44 onto an Azure-native stack — Azure Static Web Apps (frontend), Azure SQL (database), Azure Functions Premium (API), and Microsoft Entra ID (auth) — while keeping every feature already built.
>
> **Who this is for:** You, executing it yourself. Every command is copy-paste. Follow the phases in order. Tick each checklist item as you go — your progress is saved on this device.
>
> **Golden rule:** Do not rewrite the React UI. Only the **data**, **auth**, and **function-invocation** layers change. The component tree, Tailwind tokens, and all screen behaviour stay identical.

---

## Architecture at a glance

| Layer | Today (Base44) | Target (Azure) |
|---|---|---|
| Frontend hosting | Base44 CDN | Azure Static Web Apps |
| Database | Base44 entities (MongoDB) | Azure SQL Database |
| API / backend | `base44/functions/*.ts` | Azure Functions (Premium plan) |
| Auth | Base44 Auth (email/OTP/Google) | Microsoft Entra ID (MSAL React) |
| Scheduled jobs | Base44 automations (scheduled) | Azure Functions timer triggers |
| Entity-change triggers | Base44 automations (entity) | SQL change tracking → Service Bus |
| Webhook receivers | Base44 automations (connector) | Azure Functions HTTP triggers |
| Secrets | Base44 secrets / AppSetting rows | Azure Key Vault |
| File storage | Base44 files | Azure Blob Storage |

---

## Phase 0 — Before You Start

- [ ] Install the Azure CLI: `brew install azure-cli` (macOS) or `winget install Microsoft.AzureCLI` (Windows)
- [ ] Install Node 20+ and Git
- [ ] Have an Azure subscription with **Owner** access (or a subscription admin on call)
- [ ] Have your Entra ID (Azure AD) tenant admin credentials
- [ ] Have the Base44 app open in one browser tab and a terminal in another
- [ ] Pick a resource name prefix, e.g. `gcmc` (all resources use this prefix)

```bash
# Verify your tools
az --version
node --version
git --version

# Log into Azure (opens browser)
az login
az account set --subscription "<your-subscription-id>"
az account show --query name -o tsv
```

**Expected:** the last command prints your subscription name. If it errors, you don't have access — stop and get it before continuing.

---

## Phase 1 — Export the Source Code

Base44 hosts your code in a sandbox. You need a local copy in Git before you can refactor it.

### 1.1 Create the local repo

```bash
mkdir gcmc-azure && cd gcmc-azure
git init
git branch -M main
```

### 1.2 Copy the source tree

From the Base44 builder, use the **Download / Export** option in the app settings to get a zip of the full project. If a direct export is not available, copy each directory manually using the file viewer:

- `src/` — all pages, components, hooks, contexts, utils, lib
- `base44/entities/` — all `*.jsonc` entity schemas
- `base44/functions/` — all `*/entry.ts` backend functions
- `base44/shared/` — shared TypeScript modules
- `base44/agents/` — agent configs
- `package.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `jsconfig.json`, `index.html`, `src/index.css`, `src/main.jsx`, `src/App.jsx`

```bash
# After copying, verify the structure
ls -la
ls src/pages | wc -l   # expect 40+ pages
ls src/components | wc -l  # expect 300+ components
ls base44/entities | wc -l  # expect 90+ entities
ls base44/functions | wc -l  # expect 180+ functions
```

### 1.3 Commit the baseline

```bash
git add -A
git commit -m "Migration baseline: snapshot of Base44 app"
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

### 1.4 Inventory check

- [ ] `src/` copied and committed
- [ ] `base44/entities/` copied (90+ files)
- [ ] `base44/functions/` copied (180+ files)
- [ ] `base44/shared/` copied
- [ ] Config files copied (`package.json`, `vite.config.js`, `tailwind.config.js`, `index.html`)
- [ ] Baseline commit pushed to GitHub

> **Note:** The `@base44/sdk` and `@base44/vite-plugin` packages are Base44-specific. You'll remove them in Phase 3 once the new data-access SDK is in place. Leave them for now so the app still builds.

---

## Phase 2 — Provision Azure Infrastructure

All resources go in one resource group. Run these in a terminal.

### 2.1 Resource group

```bash
az group create \
  --name gcmc-rg \
  --location uksouth
```

### 2.2 Azure SQL server + database

```bash
# Admin password — save this somewhere safe
ADMIN_PASS="ChangeMe!$(openssl rand -hex 12)"

az sql server create \
  --name gcmc-sql \
  --resource-group gcmc-rg \
  --admin-user gcmcadmin \
  --admin-password "$ADMIN_PASS" \
  --location uksouth

az sql db create \
  --name gcmcdb \
  --server gcmc-sql \
  --resource-group gcmc-rg \
  --service-objective S1 \
  --zone-redundant false

# Allow your IP to connect
MY_IP=$(curl -s https://ifconfig.me)
az sql server firewall-rule create \
  --name AllowMyIP \
  --server gcmc-sql \
  --resource-group gcmc-rg \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP
```

**Expected:** `provisioningState: Succeeded`. Save `$ADMIN_PASS` — you'll need it for the connection string.

### 2.3 Storage account (file uploads + logs)

```bash
az storage account create \
  --name gcmcsa \
  --resource-group gcmc-rg \
  --location uksouth \
  --sku Standard_LRS \
  --kind StorageV2

az storage container create \
  --name uploads \
  --account-name gcmcsa \
  --auth-mode login
```

### 2.4 Key Vault (secrets)

```bash
az keyvault create \
  --name gcmc-kv \
  --resource-group gcmc-rg \
  --location uksouth \
  --enable-rbac-authorization true
```

### 2.5 Functions Premium plan

```bash
az functionapp plan create \
  --name gcmc-plan \
  --resource-group gcmc-rg \
  --location uksouth \
  --sku EP1 \
  --is-linux true
```

### 2.6 Static Web App (frontend)

```bash
az staticwebapp create \
  --name gcmc-web \
  --resource-group gcmc-rg \
  --source https://github.com/<your-org>/gcmc-azure \
  --branch main \
  --app-location "/" \
  --output-location "dist" \
  --login-with-github
```

### 2.7 Provisioning checklist

- [ ] Resource group `gcmc-rg` created
- [ ] SQL server `gcmc-sql` + database `gcmcdb` created; admin password saved
- [ ] Storage account `gcmcsa` + `uploads` container created
- [ ] Key Vault `gcmc-kv` created
- [ ] Functions plan `gcmc-plan` (EP1) created
- [ ] Static Web App `gcmc-web` created and linked to GitHub

---

## Phase 3 — Migrate the Data Layer

This is the biggest phase. You convert 90+ entities to SQL tables, build a TypeScript SDK that mirrors `base44.entities.*`, and bulk-copy the data.

### 3.1 Generate SQL schema from entity JSON

Each `base44/entities/Foo.jsonc` file is a JSON schema. Convert each to a `CREATE TABLE` statement. Run this generator script from your repo root:

```bash
mkdir -p db/schema
node scripts/gen-schema.js base44/entities db/schema
```

Create `scripts/gen-schema.js`:

```javascript
const fs = require('fs');
const path = require('path');

const TYPE_MAP = {
  string: 'NVARCHAR(1000)',
  number: 'DECIMAL(18,4)',
  boolean: 'BIT',
  integer: 'INT',
  array: 'NVARCHAR(MAX)',      // stored as JSON
  object: 'NVARCHAR(MAX)',     // stored as JSON
};

function toSqlType(prop) {
  if (prop.format === 'date') return 'DATE';
  if (prop.format === 'date-time') return 'DATETIME2';
  if (prop.enum) return 'NVARCHAR(100)';
  return TYPE_MAP[prop.type] || 'NVARCHAR(1000)';
}

const entitiesDir = process.argv[2];
const outDir = process.argv[3];
fs.mkdirSync(outDir, { recursive: true });

for (const file of fs.readdirSync(entitiesDir)) {
  if (!file.endsWith('.jsonc')) continue;
  const raw = fs.readFileSync(path.join(entitiesDir, file), 'utf8')
    .replace(/\/\/.*$/gm, '');           // strip JSONC comments
  const schema = JSON.parse(raw);
  const table = schema.name.toLowerCase();
  const cols = [
    '  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID()',
    '  created_date DATETIME2 DEFAULT SYSUTCDATETIME()',
    '  updated_date DATETIME2 DEFAULT SYSUTCDATETIME()',
    '  created_by_id UNIQUEIDENTIFIER NULL',
  ];
  for (const [field, prop] of Object.entries(schema.properties || {})) {
    const nullable = (schema.required || []).includes(field) ? ' NOT NULL' : ' NULL';
    cols.push(`  [${field}] ${toSqlType(prop)}${nullable}`);
  }
  const sql = `CREATE TABLE [dbo].[${table}] (\n${cols.join(',\n')}\n);\nGO\n`;
  fs.writeFileSync(path.join(outDir, `${table}.sql`), sql);
}
console.log('Schema files written to', outDir);
```

### 3.2 Apply the schema

```bash
# Get your connection string from the portal, or build it:
CONN="Server=tcp:gcmc-sql.database.windows.net,1433;Database=gcmcdb;User ID=gcmcadmin;Password=<your-pass>;Encrypt=true;"

# Apply every schema file
for f in db/schema/*.sql; do
  sqlcmd -S gcmc-sql.database.windows.net -d gcmcdb -U gcmcadmin -P "<your-pass>" -i "$f"
done
```

### 3.3 Add Row-Level Security (RLS)

For every table that had an `rls` block in its entity schema, add a security predicate. This example shows the division-scoped pattern used by most entities:

```sql
-- Run once: enable RLS
CREATE SCHEMA SECURITY;
GO

-- Example: Staff table (division-scoped read, admin write)
CREATE FUNCTION SECURITY.fn_StaffPredicate(@division_id NVARCHAR(100))
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN SELECT 1 AS result
WHERE @division_id = SESSION_CONTEXT(N'division_id')
   OR SESSION_CONTEXT(N'is_enterprise_admin') = 1
   OR SESSION_CONTEXT(N'role') = N'admin';
GO

CREATE SECURITY POLICY Staff_Policy
ON dbo.staff
FOR SELECT TO public
ADD FILTER PREDICATE SECURITY.fn_StaffPredicate(division_id);
GO
```

The application sets `SESSION_CONTEXT` on every connection open (see 3.5).

### 3.4 Bulk-migrate existing records out of Base44

Use the Base44 SDK to export every entity's records, then insert them into SQL. Create `scripts/export-data.js`:

```javascript
// Run from the repo root. Requires the @base44/sdk still installed.
const { base44 } = require('@base44/sdk');
const sql = require('mssql');

const ENTITIES = ['Job','Staff','Vehicle','SiteAsset','RotaAssignment','AFP','AFPLineItem',
  'Client','Contractor','Supplier','Team','ComplianceItem','TrainingCourse','Timesheet',
  /* …all 90+ entities… */];

(async () => {
  const pool = await sql.connect(process.env.SQL_CONN);
  for (const name of ENTITIES) {
    const records = await base44.entities[name].list('-created_date', 5000);
    const table = name.toLowerCase();
    for (const r of records) {
      const cols = Object.keys(r);
      const vals = cols.map(c => r[c]);
      const placeholders = cols.map((_, i) => `@p${i}`).join(',');
      await pool.request()
        .input(...) // bind each value
        .query(`INSERT INTO [${table}] (${cols.join(',')}) VALUES (${placeholders})`);
    }
    console.log(name, records.length, 'rows migrated');
  }
  await pool.close();
})();
```

```bash
SQL_CONN="$CONN" node scripts/export-data.js
```

### 3.5 Build the replacement data-access SDK

Create `src/api/dataClient.ts` that mirrors the `base44.entities.*` surface so component code only changes its import:

```typescript
// src/api/dataClient.ts
import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL; // your Functions URL

async function call(entity: string, op: string, body?: any) {
  const res = await fetch(`${API}/api/data/${entity}/${op}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('msal.token')}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function makeEntity(name: string) {
  return {
    list: (sort?: string, limit?: number) => call(name, 'list', { sort, limit }),
    filter: (query: any, sort?: string, limit?: number) => call(name, 'filter', { query, sort, limit }),
    get: (id: string) => call(name, 'get', { id }),
    create: (data: any) => call(name, 'create', { data }),
    update: (id: string, data: any) => call(name, 'update', { id, data }),
    delete: (id: string) => call(name, 'delete', { id }),
    bulkCreate: (items: any[]) => call(name, 'bulkCreate', { items }),
    updateMany: (query: any, set: any) => call(name, 'updateMany', { query, set }),
    deleteMany: (query: any) => call(name, 'deleteMany', { query }),
    subscribe: (cb: (e: any) => void) => {
      // WebSocket or SignalR connection for realtime — see Phase 5
      return () => {};
    },
  };
}
```

Then swap the import across the codebase:

```bash
# One-time sed: replace base44 entity imports
# Before:  import { base44 } from '@/api/base44Client';
#           base44.entities.Job.list()
# After:    import { makeEntity } from '@/api/dataClient';
#           const Job = makeEntity('Job'); Job.list()
```

> **Tip:** Do this swap in small batches per hub (Jobs first, then Rota, then Billing…) and verify each builds before moving on. The API surface is identical, so call sites don't change.

### 3.6 Data-layer checklist

- [ ] `scripts/gen-schema.js` created and run; `db/schema/*.sql` generated for all entities
- [ ] Schema applied to `gcmcdb` (all tables created)
- [ ] RLS predicates added for division-scoped and role-scoped tables
- [ ] `scripts/export-data.js` run; record counts match Base44
- [ ] `src/api/dataClient.ts` created; `VITE_API_URL` set in `.env`
- [ ] Entity imports swapped in at least the Jobs hub and verified building

---

## Phase 4 — Migrate Authentication (Entra ID)

### 4.1 Register the app in Entra ID

```bash
APP_ID=$(az ad app create \
  --display-name "GC Mission Control" \
  --web-redirect-uris "https://gcmc-web.azurestaticapps.net/,http://localhost:5173/" \
  --query appId -o tsv)

# Create a client secret
SECRET=$(az ad app credential reset --id $APP_ID --query password -o tsv)
echo "Client ID: $APP_ID  Secret: $SECRET"  # SAVE THESE
```

### 4.2 Define app roles

Map your existing roles to Entra app roles: `admin`, `management`, `user`, `field`, `read_only`, `director`, `super_admin`. Create them in the portal (Entra ID → App registrations → App roles) or via manifest edit.

### 4.3 Install MSAL React

```bash
npm install @azure/msal-browser @azure/msal-react
```

### 4.4 Replace the auth provider

Create `src/lib/msalConfig.ts`:

```typescript
import { Configuration } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: 'https://login.microsoftonline.com/<your-tenant-id>',
    redirectUri: window.location.origin,
  },
};

export const loginRequest = { scopes: ['User.Read'] };
```

Swap `AuthProvider` in `src/main.jsx` / `src/App.jsx`:

```jsx
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from '@/lib/msalConfig';

const pca = new PublicClientApplication(msalConfig);
// …
<MsalProvider instance={pca}>
  <App />
</MsalProvider>
```

### 4.5 Wire ProtectedRoute to MSAL

`ProtectedRoute` already gates routes. Replace its `isAuthenticated()` check with the MSAL `useMsal` accounts check. The existing `Login.jsx` page becomes a "Sign in with Microsoft" button calling `pca.loginPopup(loginRequest)`.

### 4.6 Map Staff permissions

After login, fetch the user's Staff record (by email) and their PermissionGroup. Store `role`, `division_id`, `is_enterprise_admin`, `managed_division_ids` in app state — these feed the same `RouteGuard` / `HubReadinessGate` logic that exists today. No UI changes needed.

### 4.7 Auth checklist

- [ ] Entra app registered; client ID + secret saved
- [ ] App roles created (admin, management, user, field, read_only, director, super_admin)
- [ ] `@azure/msal-*` installed
- [ ] `MsalProvider` wraps the app
- [ ] `ProtectedRoute` uses MSAL accounts
- [ ] Login page calls `loginPopup`; logout works
- [ ] Staff record + PermissionGroup loaded after login; RouteGuard still gates

---

## Phase 5 — Port Backend Functions & Automations

### 5.1 Scaffold the Functions project

```bash
mkdir -p api && cd api
func init gcmc-api --typescript
cd gcmc-api
npm install @azure/functions mssql @azure/identity
```

### 5.2 Port each backend function

Each `base44/functions/<name>/entry.ts` becomes an Azure Function. The logic stays; only the wrapper changes.

**Before (Base44):**
```typescript
export default async function handler(req, res) {
  const data = req.body;
  // …logic…
  res.json({ result });
}
```

**After (Azure Function):**
```typescript
import { app, HttpRequest, HttpResponseInit } from '@azure/functions';

app.http('calculateCharge', {
  methods: ['POST'],
  authLevel: 'function',
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const data = await req.json();
    // …same logic…
    return { jsonBody: { result } };
  },
});
```

There are 180+ functions. Port them in batches by domain: billing, logistics, safety, staff, geotab, assetpanda, keylogbook, mitti, etc.

### 5.3 Move secrets to Key Vault

```bash
# Example: Geotab credentials
az keyvault secret set --vault-name gcmc-kv --name geotab-user --value "<user>"
az keyvault secret set --vault-name gcmc-kv --name geotab-pass --value "<pass>"
```

In Functions, read via `@azure/identity`:

```typescript
import { DefaultAzureCredential, SecretClient } from '@azure/identity';
const client = new SecretClient('https://gcmc-kv.vault.azure.net', new DefaultAzureCredential());
const pass = (await client.getSecret('geotab-pass')).value;
```

### 5.4 Convert automations

| Base44 automation type | Azure equivalent |
|---|---|
| Scheduled (cron/interval) | Functions `timerTrigger` with the same cron expression |
| Entity create/update/delete | SQL change tracking → Service Bus queue → Functions trigger |
| Connector webhook | Functions `httpTrigger` (same URL + secret validation) |

Example timer trigger for `sendDailyReminders`:

```typescript
app.timer('sendDailyReminders', {
  schedule: '0 7 * * 1-5',  // 07:00 weekdays
  handler: async () => { /* …same logic… */ }
});
```

### 5.5 Deploy the Functions

```bash
func azure functionapp publish gcmc-api-func
```

### 5.6 Functions & automations checklist

- [ ] Functions project scaffolded (`api/gcmc-api`)
- [ ] All 180+ functions ported (batch by domain)
- [ ] Secrets moved to Key Vault; functions read via `@azure/identity`
- [ ] Scheduled automations → timer triggers (cron preserved)
- [ ] Entity-change automations → SQL change tracking + Service Bus
- [ ] Webhook automations → HTTP triggers with secret validation
- [ ] Functions deployed to `gcmc-api-func`
- [ ] `VITE_API_URL` in frontend `.env` points to the Functions URL

---

## Phase 6 — Deploy & Cutover

### 6.1 GitHub Actions pipeline

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy GCMC
on:
  push:
    branches: [main]
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build
      - uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_SWA_TOKEN }}
          action: upload
          app_location: /
          output_location: dist
```

### 6.2 Smoke test every hub

- [ ] Jobs: create a job, open JobDetail, all tabs render
- [ ] Rota: weekly rota builds, assignments save
- [ ] Billing/AFP/CVR: AFP builder opens, line items populate
- [ ] Fleet: live tracking map loads, vehicles appear
- [ ] Assets: inventory grid loads, scanner works
- [ ] Compliance: compliance wallet renders, items show status
- [ ] Staff: directory loads, staff detail opens
- [ ] Scanner: scan flow completes end-to-end

### 6.3 Switch the custom domain

```bash
az staticwebapp hostname set \
  --name gcmc-web \
  --hostname missioncontrol.groundcontrol.co.uk
```

Update your DNS CNAME to point at the Static Web App hostname (shown in portal). Wait for propagation.

### 6.4 Final cutover

- [ ] DNS switched; SSL active
- [ ] All hubs smoke-tested on the new domain
- [ ] Base44 app set to read-only (no new writes)
- [ ] Team notified of new URL
- [ ] After 2 weeks of clean running, decommission Base44

---

## Rollback plan

If something breaks during cutover:
1. DNS CNAME back to the Base44 app (instant, no data loss since Base44 stayed read-only)
2. Re-point `VITE_API_URL` to Base44 functions (kept running during the trial)
3. Fix forward on a branch, redeploy

Base44 stays live and read-only until you're confident — **never delete it on day one**.

---

## Estimated effort

| Phase | Time |
|---|---|
| 0 — Prerequisites | 1 hour |
| 1 — Export code | 2 hours |
| 2 — Provision Azure | 2 hours |
| 3 — Data layer | 3–5 days |
| 4 — Auth | 1 day |
| 5 — Functions & automations | 5–8 days |
| 6 — Deploy & cutover | 1–2 days |
| **Total** | **~2–3 weeks, solo** |

Take it one phase at a time. Tick the boxes. You've got this.
