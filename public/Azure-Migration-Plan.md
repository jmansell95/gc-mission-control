# Azure-Native Migration Runbook — GC Mission Control

> **3-Month (13-Week) Continuous-Phase Migration Plan**
> Move GC Mission Control off Base44 onto a fully enterprise-owned Microsoft Azure stack.
> UK South region · GDPR-compliant · CIO-ready

**Owner:** Platform Engineering
**Target Region:** UK South (`uksouth`)
**Timeline:** 13 weeks (3 months)
**Status:** Approved

---

## Executive Summary

GC Mission Control currently runs on the Base44 platform-as-a-service. This runbook migrates the application to a fully enterprise-owned Microsoft Azure stack — Azure Static Web Apps (frontend), Azure SQL Database (data), Azure Functions Premium (API), Microsoft Entra ID (auth), Azure Key Vault (secrets), and Azure Blob Storage (files).

The React + Vite + Tailwind frontend source code is retained in full. Only the data, auth, and backend layers move. Every feature already built — 90+ entities, 180+ backend functions, real-time subscriptions, integrations — is preserved.

**Why Azure:**
- **Full data sovereignty** — all data in UK South (`uksouth`), GDPR-compliant, enterprise-owned and auditable
- **No vendor lock-in** — source code in your GitHub, deployable to any Azure subscription
- **Native M365 ecosystem** — Entra ID SSO, Power BI, Logic Apps, Service Bus, Event Grid
- **Cost predictability** — ~£220–300/mo Azure consumption vs the current platform subscription

**Timeline at a glance:**

| Phase | Weeks | Focus |
|-------|-------|-------|
| Phase 0 | 1 | Prerequisites & Setup |
| Phase 1 | 2 | Export Source Code |
| Phase 2 | 3–4 | Provision Azure Infrastructure |
| Phase 3 | 5–7 | Data Layer (SQL + SDK) |
| Phase 4 | 7–9 | Auth (Entra ID) |
| Phase 5 | 9–11 | Functions & Automations |
| Phase 6 | 12 | Deploy & Cutover |
| Stabilization | 13 | Sign-off & Decommission |

---

## Phase 0 — Prerequisites & Setup (Week 1)

### 0.1 Install the Azure CLI

```bash
# macOS (Homebrew)
brew install azure-cli

# Windows (winget)
winget install -e --id Microsoft.AzureCLI

# Linux (apt)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

Verify the installation:

```bash
az version
```

### 0.2 Sign in to Azure

```bash
az login
```

This opens a browser. Sign in with the Azure admin account that owns the subscription. If you have multiple subscriptions, set the active one:

```bash
# List subscriptions
az account list --output table

# Set the active subscription (replace with your ID)
az account set --subscription "your-subscription-id"
```

### 0.3 Create the resource group in UK South

All resources go in a single resource group in the `uksouth` region for GDPR data residency:

```bash
az group create \
  --name rg-gc-mission-control \
  --location uksouth \
  --tags environment=production owner=platform-engineering
```

### 0.4 Create a service principal for CI/CD

```bash
az ad sp create-for-rbac \
  --name "gc-mission-control-deploy" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-gc-mission-control
```

**Save the output** — you'll need the `appId`, `password`, and `tenant` for GitHub Actions deployment in Phase 6.

### 0.5 Install supporting tools

```bash
# .NET SDK (required for Azure Functions tooling)
# macOS
brew install --cask dotnet-sdk
# Windows
winget install Microsoft.DotNet.SDK.8

# Azure Functions Core Tools
# macOS
brew tap azure/functions
brew install azure-functions-core-tools-4
# Windows
winget install Microsoft.Azure.FunctionsCoreTools

# Node.js 20 LTS (required for the frontend build)
# macOS
brew install node@20
# Windows
winget install OpenJS.NodeJS.LTS

# Verify
dotnet --version
func --version
node --version
```

### 0.6 Checklist — Phase 0

- [ ] Azure CLI installed and `az login` successful
- [ ] Active subscription set to the production subscription
- [ ] Resource group `rg-gc-mission-control` created in `uksouth`
- [ ] Service principal created and credentials saved securely
- [ ] .NET SDK, Azure Functions Core Tools, and Node.js 20 installed

---

## Phase 1 — Export Source Code (Week 2)

### 1.1 Export the frontend from Base44

From the Base44 builder, download the full source archive. This contains the complete React + Vite + Tailwind frontend.

```bash
# Create the project directory
mkdir -p ~/projects/gc-mission-control
cd ~/projects/gc-mission-control

# Unzip the exported source
unzip ~/Downloads/gc-mission-control-source.zip -d .

# Verify the structure
ls -la
# Expected: package.json, vite.config.js, src/, index.html, tailwind.config.js
```

### 1.2 Initialize the Git repository and push to GitHub

```bash
cd ~/projects/gc-mission-control

git init
git add .
git commit -m "Initial export from Base44"

# Create the repo on GitHub first (via github.com or gh CLI)
gh repo create gc-mission-control --private --source=. --push

# Or manually:
git remote add origin git@github.com:your-org/gc-mission-control.git
git branch -M main
git push -u origin main
```

### 1.3 Verify the build works locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` — the frontend should render. Auth and data calls will fail (expected — we haven't migrated the backend yet), but the UI should load.

### 1.4 Create the monorepo structure for Azure

```bash
mkdir -p infrastructure
mkdir -p backend
mkdir -p database

# Move the frontend into a subfolder
git mv src index.html package.json package-lock.json vite.config.js tailwind.config.js postcss.config.js jsconfig.json components.json frontend/
```

Final structure:

```
gc-mission-control/
├── frontend/          # React + Vite SPA
├── backend/           # Azure Functions (created in Phase 5)
├── database/          # SQL migration scripts (created in Phase 3)
└── infrastructure/    # Bicep templates (created in Phase 2)
```

### 1.5 Checklist — Phase 1

- [ ] Source code exported from Base44 and unzipped
- [ ] Git repo initialized and pushed to GitHub (private)
- [ ] `npm run dev` renders the frontend locally
- [ ] Monorepo structure created (`frontend/`, `backend/`, `database/`, `infrastructure/`)

---

## Phase 2 — Provision Azure Infrastructure (Weeks 3–4)

### 2.1 Create the Azure SQL Database

```bash
# Create a SQL Server
az sql server create \
  --name sql-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --location uksouth \
  --admin-user "gcadmin" \
  --admin-password "ChangeThisStrongPassword123!" \
  --enable-public-network true

# Allow Azure services to connect (for Functions)
az sql server firewall-rule create \
  --resource-group rg-gc-mission-control \
  --server sql-gc-mission-control \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0

# Add your office IP for management access
MY_IP=$(curl -s ifconfig.me)
az sql server firewall-rule create \
  --resource-group rg-gc-mission-control \
  --server sql-gc-mission-control \
  --name OfficeIP \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP

# Create the database (S1 tier — 20 DTUs, 250GB)
az sql db create \
  --name gc-mission-control \
  --resource-group rg-gc-mission-control \
  --server sql-gc-mission-control \
  --service-objective S1 \
  --zone-redundant false
```

### 2.2 Create the Azure Storage Account (Blob + file storage)

```bash
# Storage account (must be globally unique — use a random suffix)
RANDOM_SUFFIX=$(openssl rand -hex 4)
az storage account create \
  --name stgcmisionctrl$RANDOM_SUFFIX \
  --resource-group rg-gc-mission-control \
  --location uksouth \
  --sku Standard_LRS \
  --kind StorageV2 \
  --allow-blob-public-access false \
  --min-tls-version TLS1_2

# Create blob containers
az storage container create \
  --name files \
  --account-name stgcmisionctrl$RANDOM_SUFFIX \
  --auth-mode login

az storage container create \
  --name uploads \
  --account-name stgcmisionctrl$RANDOM_SUFFIX \
  --auth-mode login

az storage container create \
  --name private-documents \
  --account-name stgcmisionctrl$RANDOM_SUFFIX \
  --auth-mode login
```

### 2.3 Create the Azure Key Vault (secrets management)

```bash
az keyvault create \
  --name kv-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --location uksouth \
  --enable-rbac-authorization true \
  --sku standard

# Store the SQL admin password as a secret
az keyvault secret set \
  --vault-name kv-gc-mission-control \
  --name sql-admin-password \
  --value "ChangeThisStrongPassword123!"
```

### 2.4 Create the Azure Functions Premium Plan

```bash
# Premium plan (EP1 — 1 core, 3.5GB RAM, always-on)
az functionapp plan create \
  --name plan-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --location uksouth \
  --sku EP1 \
  --is-linux true

# Create the Function App
az functionapp create \
  --name func-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --storage-account stgcmisionctrl$RANDOM_SUFFIX \
  --plan plan-gc-mission-control \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4 \
  --os-type Linux

# Enable managed identity (for Key Vault + SQL access)
az functionapp identity assign \
  --name func-gc-mission-control \
  --resource-group rg-gc-mission-control

# Grant the Function App's managed identity access to Key Vault
FUNCTION_PRINCIPAL_ID=$(az functionapp identity show \
  --name func-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --query principalId -o tsv)

az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee-object-id $FUNCTION_PRINCIPAL_ID \
  --assignee-principal-type ServicePrincipal \
  --scope /subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-gc-mission-control/providers/Microsoft.KeyVault/vaults/kv-gc-mission-control
```

### 2.5 Create the Azure Static Web App

```bash
# Static Web App (free tier — upgrade to Standard for custom domains + auth)
az staticwebapp create \
  --name stw-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --location uksouth \
  --sku Free

# Get the deployment token (save for GitHub Actions)
az staticwebapp secrets list \
  --name stw-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --query properties.apiKey -o tsv
```

### 2.6 Create an Application Insights instance (monitoring)

```bash
az monitor log-analytics workspace create \
  --workspace-name log-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --location uksouth

az monitor app-insights component create \
  --app ai-gc-mission-control \
  --location uksouth \
  --resource-group rg-gc-mission-control \
  --workspace log-gc-mission-control \
  --kind web

# Link App Insights to the Function App
az functionapp config appsettings set \
  --name func-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --settings \
    APPINSIGHTS_INSTRUMENTATIONKEY=$(az monitor app-insights component show --app ai-gc-mission-control -g rg-gc-mission-control --query instrumentationId -o tsv) \
    APPLICATIONINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show --app ai-gc-mission-control -g rg-gc-mission-control --query connectionString -o tsv)
```

### 2.7 Checklist — Phase 2

- [ ] Azure SQL Server + Database created in UK South
- [ ] Firewall rules set (Azure services + office IP)
- [ ] Storage account created with blob containers
- [ ] Key Vault created with SQL admin password stored
- [ ] Functions Premium plan + Function App created with managed identity
- [ ] Function App's managed identity granted Key Vault access
- [ ] Static Web App created and deployment token saved
- [ ] Application Insights + Log Analytics workspace created and linked

---

## Phase 3 — Data Layer: SQL + SDK (Weeks 5–7)

### 3.1 Generate the schema from Base44 entities

Each Base44 entity maps to a SQL table. Run this script to extract all entity schemas:

```bash
# In the frontend directory, create a schema extractor
cat > frontend/src/lib/exportSchemas.js << 'EOF'
import { base44 } from '@/api/base44Client';

// List of all entity names (extract from base44/entities/)
const entityNames = [
  'Job', 'Staff', 'Team', 'Client', 'Contractor', 'Supplier', 'Vehicle',
  'SiteAsset', 'RotaAssignment', 'Timesheet', 'DeliveryLog', 'BillingRule',
  'ComplianceItem', 'SafetyReport', 'HotelBooking', 'AppSetting',
  // ... all 90+ entities
];

async function exportAllSchemas() {
  const schemas = {};
  for (const name of entityNames) {
    try {
      const schema = await base44.entities[name].schema();
      schemas[name] = schema;
    } catch (e) {
      console.error(`Failed to get schema for ${name}:`, e.message);
    }
  }
  console.log(JSON.stringify(schemas, null, 2));
}

exportAllSchemas();
EOF

node frontend/src/lib/exportSchemas.js > database/schemas.json
```

### 3.2 Convert JSON schemas to SQL DDL

Create a script that converts each entity's JSON schema to a `CREATE TABLE` statement:

```sql
-- database/01_create_tables.sql

-- Enable RLS on the database
ALTER DATABASE gc-mission-control SET ENCRYPTION ON;

-- Base fields added to every table
-- id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
-- created_date DATETIME2 DEFAULT SYSUTCDATETIME(),
-- updated_date DATETIME2 DEFAULT SYSUTCDATETIME(),
-- created_by_id NVARCHAR(100)

CREATE TABLE dbo.Staff (
    id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    division_id NVARCHAR(100),
    email NVARCHAR(255),
    worker_type NVARCHAR(50) NOT NULL,
    job_title NVARCHAR(255),
    is_active BIT DEFAULT 1,
    user_id NVARCHAR(100),
    created_date DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_date DATETIME2 DEFAULT SYSUTCDATETIME(),
    created_by_id NVARCHAR(100)
);

CREATE TABLE dbo.Job (
    id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    division_id NVARCHAR(100),
    client_id NVARCHAR(100),
    status NVARCHAR(50) DEFAULT 'planning',
    address NVARCHAR(MAX),
    lat FLOAT,
    lng FLOAT,
    created_date DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_date DATETIME2 DEFAULT SYSUTCDATETIME(),
    created_by_id NVARCHAR(100)
);

-- ... repeat for all 90+ entities
```

### 3.3 Implement Row-Level Security (RLS) with SESSION_CONTEXT

RLS is the Azure SQL equivalent of Base44's entity RLS. Every connection sets `SESSION_CONTEXT` with the user's ID, role, and division, and security predicates filter rows based on those values.

```sql
-- database/02_rls.sql

-- Create a security schema to hold predicate functions
CREATE SCHEMA security;
GO

-- Predicate function for division-scoped tables
CREATE FUNCTION security.fn_division_predicate(@division_id NVARCHAR(100))
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN (
    SELECT 1 AS result
    WHERE @division_id IS NULL
       OR @division_id = CAST(SESSION_CONTEXT(N'division_id') AS NVARCHAR(100))
       OR CAST(SESSION_CONTEXT(N'role') AS NVARCHAR(50)) = 'admin'
);
GO

-- Apply the predicate to Staff
CREATE SECURITY POLICY security.StaffPolicy
ADD FILTER PREDICATE security.fn_division_predicate(division_id) ON dbo.Staff,
ADD BLOCK PREDICATE security.fn_division_predicate(division_id) ON dbo.Staff AFTER INSERT;
GO

-- Apply the predicate to Job
CREATE SECURITY POLICY security.JobPolicy
ADD FILTER PREDICATE security.fn_division_predicate(division_id) ON dbo.Job,
ADD BLOCK PREDICATE security.fn_division_predicate(division_id) ON dbo.Job AFTER INSERT;
GO

-- Repeat for all division-scoped tables:
-- Vehicle, SiteAsset, Client, Contractor, Supplier, RotaAssignment,
-- Timesheet, DeliveryLog, BillingRule, ComplianceItem, etc.
```

### 3.4 Set SESSION_CONTEXT on every connection

The Azure Functions API sets `SESSION_CONTEXT` at the start of every request, reading the user's identity from the Entra ID JWT token:

```typescript
// backend/src/middleware/setSessionContext.ts

import { Connection } from 'mssql';

export async function setSessionContext(connection: Connection, user: {
  id: string;
  role: string;
  division_id: string | null;
}) {
  await connection.request()
    .input('user_id', user.id)
    .input('role', user.role)
    .input('division_id', user.division_id || null)
    .query(`
      EXEC sp_set_session_context @key = N'user_id', @value = @user_id;
      EXEC sp_set_session_context @key = N'role', @value = @role;
      EXEC sp_set_session_context @key = N'division_id', @value = @division_id;
    `);
}
```

### 3.5 Export data from Base44

Create a backend function that exports all entity data as JSON for migration:

```typescript
// backend/src/functions/exportData.ts

import { base44 } from '../base44Client';

const entityNames = [
  'Job', 'Staff', 'Team', 'Client', 'Contractor', 'Supplier', 'Vehicle',
  'SiteAsset', 'RotaAssignment', 'Timesheet', 'DeliveryLog', 'BillingRule',
  'ComplianceItem', 'SafetyReport', 'HotelBooking', 'AppSetting',
  // ... all entities
];

export async function exportAllData() {
  const allData = {};
  for (const name of entityNames) {
    const records = await base44.entities[name].list('-created_date', 10000);
    allData[name] = records;
    console.log(`Exported ${records.length} ${name} records`);
  }
  return allData;
}
```

Run the export and save to a JSON file:

```bash
node backend/src/functions/exportData.ts > database/export.json
```

### 3.6 Import data into Azure SQL

```sql
-- database/03_import_data.sql

-- Bulk insert Staff
INSERT INTO dbo.Staff (id, name, division_id, email, worker_type, job_title, is_active, created_date, updated_date, created_by_id)
SELECT
    TRY_CONVERT(UNIQUEIDENTIFIER, id),
    name,
    division_id,
    email,
    worker_type,
    job_title,
    CASE is_active WHEN 'true' THEN 1 ELSE 0 END,
    TRY_CONVERT(DATETIME2, created_date),
    TRY_CONVERT(DATETIME2, updated_date),
    created_by_id
FROM OPENJSON(@staffJson)
WITH (
    id NVARCHAR(100),
    name NVARCHAR(255),
    division_id NVARCHAR(100),
    email NVARCHAR(255),
    worker_type NVARCHAR(50),
    job_title NVARCHAR(255),
    is_active NVARCHAR(10),
    created_date NVARCHAR(50),
    updated_date NVARCHAR(50),
    created_by_id NVARCHAR(100)
);
```

### 3.7 Verify record counts

```sql
-- database/04_verify_counts.sql

-- Compare counts between source and target
SELECT 'Staff' AS entity, COUNT(*) AS count FROM dbo.Staff
UNION ALL
SELECT 'Job', COUNT(*) FROM dbo.Job
UNION ALL
SELECT 'RotaAssignment', COUNT(*) FROM dbo.RotaAssignment
UNION ALL
SELECT 'Timesheet', COUNT(*) FROM dbo.Timesheet
UNION ALL
SELECT 'DeliveryLog', COUNT(*) FROM dbo.DeliveryLog
-- ... all tables
ORDER BY entity;
```

### 3.8 Checklist — Phase 3

- [ ] All entity schemas extracted from Base44
- [ ] SQL DDL scripts created for all 90+ tables
- [ ] RLS security predicates created for all division-scoped tables
- [ ] SESSION_CONTEXT middleware written
- [ ] Data exported from Base44 as JSON
- [ ] Data imported into Azure SQL
- [ ] Record counts verified (source = target for every table)

---

## Phase 4 — Auth: Entra ID (Weeks 7–9)

### 4.1 Register the application in Entra ID

```bash
# Create the app registration
az ad app create \
  --display-name "GC Mission Control" \
  --web-redirect-uris "https://stw-gc-mission-control.azurestaticapps.net/.auth/login/aad/callback" \
  --required-resource-accesses '[{"resourceAppId":"00000003-0000-0000-c000-000000000000","resourceAccess":[{"id":"e1fe6dd8-af48-4d3c-9b3e-1c50b2f1a2f7","type":"Scope"}]}]'

# Get the app (client) ID and tenant ID
APP_ID=$(az ad app list --display-name "GC Mission Control" --query '[0].appId' -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Client ID: $APP_ID"
echo "Tenant ID: $TENANT_ID"
```

### 4.2 Create a client secret

```bash
# Create a client secret (save the value — it's only shown once)
az ad app credential reset \
  --id $APP_ID \
  --append
```

### 4.3 Configure the API (Functions) for JWT validation

The Azure Functions API validates the Entra ID JWT on every request:

```typescript
// backend/src/middleware/validateToken.ts

import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  rateLimit: true,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

export function validateToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  jwt.verify(token, getKey, {
    audience: process.env.AZURE_CLIENT_ID,
    issuer: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/v2.0`,
    algorithms: ['RS256'],
  }, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = {
      id: decoded.oid,
      email: decoded.preferred_username,
      name: decoded.name,
      role: decoded.roles?.[0] || 'user',
    };
    next();
  });
}
```

### 4.4 Configure the frontend for MSAL

```bash
cd frontend
npm install @azure/msal-browser @azure/msal-react
```

```typescript
// frontend/src/lib/msalConfig.ts

import { Configuration } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.VITE_AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: true,
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email', `api://${process.env.VITE_AZURE_CLIENT_ID}/access_as_user`],
};
```

### 4.5 Enable Static Web App built-in Entra ID auth

```bash
# Configure Static Web App auth with Entra ID
az staticwebapp appsettings set \
  --name stw-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --setting-names "AZURE_CLIENT_ID=$APP_ID" "AZURE_CLIENT_SECRET=<your-secret>" "AZURE_TENANT_ID=$TENANT_ID"
```

### 4.6 Migrate existing users

Existing Base44 users are invited to Entra ID. Map each Staff record's email to an Entra ID user:

```bash
# Export the user list from the app
# Then invite each user via the Azure portal or Graph API
```

### 4.7 Checklist — Phase 4

- [ ] App registration created in Entra ID
- [ ] Client secret created and saved in Key Vault
- [ ] JWT validation middleware written for Functions
- [ ] MSAL configured in the frontend
- [ ] Static Web App built-in auth enabled
- [ ] Existing users mapped and invited to Entra ID

---

## Phase 5 — Functions & Automations (Weeks 9–11)

### 5.1 Port the backend functions

Each Base44 function (`base44/functions/<name>/entry.ts`) becomes an Azure Function. The logic stays identical — only the runtime wrapper changes.

**Before (Base44):**
```typescript
// base44/functions/calculateCharge/entry.ts
export async function calculateCharge({ delivery_id }) {
  const delivery = await base44.entities.DeliveryLog.get(delivery_id);
  // ... billing logic
  return { charge_amount: 100 };
}
```

**After (Azure Functions):**
```typescript
// backend/src/functions/calculateCharge/index.ts
import { app } from '@azure/functions';
import { getDbConnection, setSessionContext } from '../../middleware/db';
import { validateToken } from '../../middleware/validateToken';

app.http('calculateCharge', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request, context) => {
    const user = await validateToken(request);
    const { delivery_id } = await request.json();

    const connection = await getDbConnection();
    await setSessionContext(connection, user);

    const delivery = await connection.request()
      .input('id', delivery_id)
      .query('SELECT * FROM dbo.DeliveryLog WHERE id = @id')
      .then(r => r.recordset[0]);

    // ... billing logic (unchanged)
    return { jsonBody: { charge_amount: 100 } };
  },
});
```

### 5.2 Port automations as timer triggers

Base44 automations become Azure Functions timer triggers:

```typescript
// backend/src/functions/scheduledReports/index.ts
import { app, Timer } from '@azure/functions';

app.timer('sendScheduledReports', {
  schedule: '0 9 * * 1-5', // 9am weekdays
  handler: async (timer: Timer, context) => {
    // Port the logic from base44/functions/sendScheduledReports/entry.ts
    context.log('Scheduled reports sent at:', new Date().toISOString());
  },
});
```

### 5.3 Port webhook receivers as HTTP triggers

```typescript
// backend/src/functions/geotabWebhook/index.ts
import { app } from '@azure/functions';

app.http('geotabWebhook', {
  methods: ['POST'],
  authLevel: 'function', // uses a function key
  handler: async (request, context) => {
    const payload = await request.json();
    // Port the logic from base44/functions/geotabWebhook/entry.ts
    return { status: 200, body: 'OK' };
  },
});
```

### 5.4 Configure the Functions host

```json
// backend/host.json
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

### 5.5 Configure application settings

```bash
az functionapp config appsettings set \
  --name func-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --settings \
    @Microsoft.KeyVault(SecretUri=https://kv-gc-mission-control.vault.azure.net/secrets/sql-admin-password) \
    SQL_SERVER=sql-gc-mission-control.database.windows.net \
    SQL_DATABASE=gc-mission-control \
    AZURE_TENANT_ID=$TENANT_ID \
    AZURE_CLIENT_ID=$APP_ID \
    STORAGE_ACCOUNT=stgcmisionctrl$RANDOM_SUFFIX \
    AZURE_STORAGE_CONNECTION_STRING=$(az storage account show-connection-string -n stgcmisionctrl$RANDOM_SUFFIX -g rg-gc-mission-control --query connectionString -o tsv)
```

### 5.6 Deploy the Functions

```bash
cd backend
npm install
npm run build

# Deploy via the Core Tools
func azure functionapp publish func-gc-mission-control
```

### 5.7 Checklist — Phase 5

- [ ] All 180+ functions ported as Azure Functions
- [ ] All scheduled automations ported as timer triggers
- [ ] All webhook receivers ported as HTTP triggers
- [ ] `host.json` configured
- [ ] Application settings configured (Key Vault references for secrets)
- [ ] Functions deployed and smoke-tested

---

## Phase 6 — Deploy & Cutover (Week 12)

### 6.1 Create the GitHub Actions deployment pipeline

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
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
      - uses: azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          action: 'upload'
          app_location: 'frontend'
          output_location: 'dist'

  deploy-functions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: cd backend && npm ci
      - run: cd backend && npm run build
      - uses: Azure/functions-action@v1
        with:
          app-name: func-gc-mission-control
          package: backend
          publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
```

### 6.2 Configure the custom domain

```bash
# Add a custom domain to the Static Web App
az staticwebapp custom-domain create \
  --name stw-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --hostname missioncontrol.groundcontrol.co.uk

# The CLI returns a CNAME/TXT record to add to your DNS provider
# Add the record, then validate:
az staticwebapp custom-domain validate \
  --name stw-gc-mission-control \
  --resource-group rg-gc-mission-control \
  --hostname missioncontrol.groundcontrol.co.uk
```

### 6.3 Run parallel

Keep Base44 running in read-only mode while the Azure stack runs in parallel. Users access the Azure URL; data is live-migrated. Compare outputs daily.

### 6.4 DNS cutover

```bash
# Update DNS to point the primary domain to Azure Static Web App
# This is done in your DNS provider's dashboard:
# CNAME missioncontrol.groundcontrol.co.uk -> stw-gc-mission-control.azurestaticapps.net

# Keep the Base44 URL as a rollback for 1 week
```

### 6.5 Rollback plan

If issues arise, DNS rollback is instant:

```bash
# Revert the DNS CNAME to the Base44 URL
# Base44 is still running in read-only mode — users can continue working
```

### 6.6 Checklist — Phase 6

- [ ] GitHub Actions pipeline created and tested
- [ ] Custom domain configured and validated
- [ ] Parallel run completed (at least 3 days)
- [ ] DNS cutover executed
- [ ] Rollback plan documented and tested

---

## Stabilization & Sign-off (Week 13)

### 7.1 Set up monitoring and alerts

```bash
# Create alert rules for the Function App
az monitor metrics alert create \
  --name "High-Error-Rate" \
  --resource-group rg-gc-mission-control \
  --condition "avg HttpResultRate > 5" \
  --window-size 5m \
  --description "Alert when HTTP error rate exceeds 5%" \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-gc-mission-control/providers/Microsoft.Web/sites/func-gc-mission-control

az monitor metrics alert create \
  --name "SQL-DTU-High" \
  --resource-group rg-gc-mission-control \
  --condition "avg dtu_consumption_percent > 80" \
  --window-size 5m \
  --description "Alert when SQL DTU usage exceeds 80%" \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/rg-gc-mission-control/providers/Microsoft.Sql/servers/sql-gc-mission-control/databases/gc-mission-control
```

### 7.2 Configure backup

```bash
# Enable automated SQL backups (long-term retention — 7 years for GDPR)
az sql db ltr-policy set \
  --resource-group rg-gc-mission-control \
  --server sql-gc-mission-control \
  --name gc-mission-control \
  --weekly-retention "P52W" \
  --monthly-retention "P120M" \
  --yearly-retention "P7Y" \
  --week-of-year 1
```

### 7.3 Decommission Base44

Once the Azure stack has run stable for 5 business days:

1. Export a final data snapshot from Base44
2. Import any delta records into Azure SQL
3. Verify final record counts
4. Cancel the Base44 subscription
5. Archive the Base44 project

### 7.4 CIO compliance sign-off

Present the compliance pack:
- This runbook (13-week timeline with code)
- Security hardening summary (RLS coverage matrix, audit log coverage, secrets management)
- GDPR data-flow diagram (UK South region, data residency statement, retention policy)
- Known-issues resolution log

### 7.5 Checklist — Stabilization

- [ ] Monitoring and alerts configured
- [ ] Long-term SQL backups enabled (7-year retention)
- [ ] 5-day stable parallel run completed
- [ ] Final data delta migrated
- [ ] Base44 subscription cancelled
- [ ] CIO compliance pack delivered and signed off

---

## Security Hardening — Current App (Immediate)

The following security improvements are applied to the current Base44 app NOW, before the Azure migration:

### RLS Audit & Gaps

Every entity with sensitive data must have RLS configured. The known gap is `SafetyCultureConfig` — it currently has no RLS, meaning any authenticated user can read/write it.

**Fix:** Add admin-only RLS to SafetyCultureConfig:

```jsonc
// base44/entities/SafetyCultureConfig.jsonc — add to the schema:
"rls": {
  "create": { "user_condition": { "role": "admin" } },
  "read": { "user_condition": { "role": "admin" } },
  "update": { "user_condition": { "role": "admin" } },
  "delete": { "user_condition": { "role": "admin" } }
}
```

### Audit Logging

Every sensitive create/update/delete must write to `SystemAuditLog`. Verify that all admin actions (staff edits, billing rule changes, settings changes, compliance updates) call `logSystemAudit` after the mutation.

### Secrets Management

All third-party API credentials (Concur, Bob HR, HMRC CIS, Asset Panda, Geotab, Holman) are stored as `AppSetting` records — not as platform secrets or hardcoded values. Verify no secrets are committed to the Git repo.

---

## GDPR Compliance — UK Data Residency

### Data Residency Statement

All GC Mission Control data is stored in the **UK South (`uksouth`)** Azure region. No data leaves the UK. This includes:
- Azure SQL Database (all entity data)
- Azure Blob Storage (uploaded files, documents, photos)
- Azure Key Vault (secrets)
- Application Insights (telemetry — configure data residency)

### Data Retention Policy

- **Operational data** (jobs, rotas, timesheets): 7 years (HMRC requirement)
- **Compliance documents** (certificates, insurance): 7 years after expiry
- **Audit logs**: 7 years
- **User uploaded files**: Retained for the active job lifecycle + 1 year
- **Deleted records**: Soft-deleted, purged after 90 days

### Data Subject Access Requests (DSAR)

Users can request a copy of their personal data. The process:
1. User emails the Data Protection Officer
2. DPO runs a DSAR export query against Azure SQL for the user's `created_by_id` / `staff_id`
3. Export delivered as JSON within 30 days (GDPR requirement)

### Right to Erasure

Users can request deletion of their personal data. The process:
1. User emails the Data Protection Officer
2. DPO verifies the request
3. Personal data is anonymised (name → "Deleted User", email → null, PII fields nulled)
4. Audit log entry created recording the erasure

---

## Known Issues Resolution Log

| Issue | Status | Resolution |
|-------|--------|------------|
| Discrepancies in calculated financial figures | Fixed | Rate-card description matching hardened; locked_rate_card_item_id takes precedence |
| Two-phase reverse geocoding not rendering | Fixed | useReverseGeocode hook updated to handle async two-phase lookup |
| Safety event date/time formatting | Fixed | Date formatting standardised to Europe/London timezone |
| Mobile/tablet navigation missing key hubs | Fixed | Mobile nav drawer updated with all admin hubs |
| Inaccurate financial attribution in rig profitability | Fixed | runRigProfitabilityCheck updated to use locked rate card items |
| KeyLogBook integration API docs | Documented | Inferred endpoints documented in KeyLogBookDocs page |
| Assets Hub lacks certification tracking | Fixed | Certificate Vault + RecertActionModal added to Rig Hub |
| CI sheet parsing errors | Fixed | parseAFPUpload updated with robust number parsing |
| Incomplete date capture for EWR site logs | Fixed | importEWRApplicationData updated to capture all date fields |
| Rota concurrent-leave bug | Fixed | AssignmentModal conflict detection updated |
| JobDetail blank screen | Fixed | Error boundary + null-safe rendering added |
| RLS missing for SafetyCultureConfig | Fixed | Admin-only RLS added |
| Rig dashboard 'no rigs' false positive | Fixed | RigPerformanceWidget null-safe check added |
| Stat tiles rendering line characters | Fixed | EnterpriseSettings stat tiles use tabular-nums |
| EnterpriseSettings stat boxes inaccurate | Fixed | getSettingsHubStats batched resolver updated |
| Microsoft365Hub import error | Fixed | Import path corrected |

---

*This runbook is a living document. Update it as the migration progresses. Your progress is saved on your device — tick each phase as you complete it.*
