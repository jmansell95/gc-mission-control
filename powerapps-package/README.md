# GC Mission Control — Power Platform Package (Phase 1)

This folder contains a real, importable Dataverse solution generated with Microsoft's
own Power Platform CLI (`pac`), built to eventually recreate GC Mission Control
(the Base44 app in this repo) as a web app inside Power Apps.

**This session had no credentials or connector into any Power Apps / Power Platform
environment**, so nothing here has been imported or tested against a live tenant.
Everything was built and validated offline: packed and re-unpacked with `pac solution
pack`/`unpack` (Microsoft's SolutionPackager) to confirm the XML is well-formed and
self-consistent. Treat this as a strong first draft, not a guarantee — a first import
can still surface tenant-specific fixups.

## What's in Phase 1

Six Dataverse tables, mirroring the core of the real app's data model
(`base44/entities/*.jsonc` in the repo root), with real 1:N relationships between them:

| Table | Logical name | Mirrors | Key relationships |
|---|---|---|---|
| Job | `gc_job` | `Job.jsonc` | → Client, → Contractor |
| Site Asset | `gc_siteasset` | `SiteAsset.jsonc` | (rigs, trailers, machinery, lifting gear) |
| Staff Member | `gc_staff` | `Staff.jsonc` | → Agency (Contractor), → Manager (self) |
| Client | `gc_client` | `Client.jsonc` | → Parent Client (self) |
| Contractor | `gc_contractor` | `Contractor.jsonc` | (sub-contractors & agencies) |
| Job Asset Assignment | `gc_jobassetassignment` | `JobAssetAssignment.jsonc` | → Job, → Asset, → Vehicle |

Each table carries a pragmatic subset of the real entity's fields (the full fields are
listed in `base44/entities/*.jsonc` — some have 40-75 fields; nested arrays/objects
like `Job.disciplines` or `SiteAsset.panda_raw_fields` were left out of Phase 1 since
Dataverse columns are flat, not JSON blobs — they'll need child tables or JSON-text
columns in a later phase).

Forms and views were left at Dataverse's auto-generated defaults rather than
hand-authored — that FormXml/SavedQuery format is intricate and this session couldn't
verify a hand-built one actually renders correctly in Studio, so it's safer to let
the platform generate the default Main form and views on import, then customize those
visually in App Designer (very quick, no XML involved).

## What's deliberately NOT in Phase 1

- The other **~126 entities** from `base44/entities/` (compliance, timesheets, rota,
  billing, training, financials, borehole/geotech, logistics, etc.)
- The **250+ backend functions** in `base44/functions/` — these need to become Power
  Automate flows or Dataverse plugins one by one; they're business logic, not schema.
- The **3 AI agents** (scheduling assistant, drilling intelligence, staff assistant) —
  would map to Copilot Studio or an Azure OpenAI-backed flow.
- **External integrations** (WhatsApp, SharePoint sync, Asset Panda, Geotab, Holman,
  Bob HR, Concur, Met Office, Stripe, Power BI, OpenGround, Companies House, Zapier)
  — each needs real API credentials from Ground Control to wire up; none of that can
  be built without you in the loop.
- A **Canvas App** UI. An early attempt at hand-authoring one was abandoned — the
  `.msapp` source format is an undocumented, version-fragile binary format with no
  way to verify it actually opens correctly in Studio from this session. A
  **model-driven app** was used instead (see below): same "real web app in the
  browser" outcome, but built from the same well-documented XML as the tables, so it
  round-trips cleanly through Microsoft's own tooling.
- Field-level **choice (picklist) columns** — status/type fields like `gc_job.status`
  are plain text for now rather than dropdowns, to avoid guessing option-set value
  numbering blind. Easy to upgrade once you can test an import.

## How to import

1. Go to [make.powerapps.com](https://make.powerapps.com), select the target
   environment.
2. **Solutions** → **Import solution** → browse to `GCMissionControl_Phase1.zip` →
   Next → Import. This creates the publisher ("GroundControl", prefix `gc`) and the
   six tables.
3. Once imported, build the actual app screen in two minutes of clicking, no XML:
   **Apps** → **New app** → **Model-driven** → give it a name → in App Designer, add
   all six tables as **Site map** entries → **Publish**. That's your web app,
   immediately usable at its own URL, with list/detail/edit screens, filtering, and
   related-record grids for every table, generated for you.
4. Open the relevant table's form in App Designer if you want to reorder fields or
   add a picklist for `status`/`asset_type`/`worker_type` etc. — quick, visual, no
   redeploy needed.

## Update: the solution-import approach doesn't work for new tables

Four rounds of hand-editing `Entities/*/Entity.xml` all failed with the identical
`PrimaryName attribute not found for Entity` error, despite fixing element order,
the primary-name flag name, and the `unmodified` flag in turn — a strong sign the
importer wasn't even reaching the attribute content. Research confirmed why:
**Microsoft does not support defining brand-new tables by hand-editing
`customizations.xml` at all.** That mechanism only works for editing specific
aspects (forms, views, ribbons, sitemap) of tables that already exist — never for
creating one from nothing. No amount of further XML tweaking was ever going to fix
this; `GCMissionControl_Phase1.zip` and the `Entities/` folder are being kept in
this repo for reference/history, but they cannot be imported successfully as-is.

**What actually works instead: create each table from a CSV/Excel file.** Power
Apps' "Start with data" table creation reads column headers and sample rows to
build a table with correctly-typed columns — fully supported, no XML involved.
Six ready-to-upload CSVs (one per table, headers matching the schema above, two
sample data rows for type inference) are in `csv-tables/`.

**Steps per table** (Tables → New table → **From Excel/CSV** in
make.powerapps.com):
1. Upload the matching CSV — do Client and Contractor first, since Job, Staff,
   and Job Asset Assignment all reference them.
2. Delete the two sample data rows Power Apps imports along with the columns
   (Data tab on the table, select rows, delete) — they're only there to make type
   inference pick sensible column types.
3. The lookup columns listed below import as plain text — replace each with a
   real **Lookup** column (New column → Lookup → pick the target table) once
   both sides of the relationship exist, then delete the text version:
   - Job: `Client` → Client, `Contractor` → Contractor
   - Staff Member: `Agency` → Contractor, `Manager` → Staff Member (self-lookup)
   - Client: `Parent Client` → Client (self-lookup)
   - Job Asset Assignment: `Job` → Job, `Asset` → Site Asset, `Vehicle` → Site Asset

Once the six tables exist, Phase 2 additional tables can use the same CSV
approach — and *editing* forms/views on tables that already exist is one of the
things solution-XML packaging is actually supported for, so that mechanism isn't
wasted, just not usable for table creation itself.

## Rebuilding the package

`gen_solution.py` (in this folder) generates `solution/src/Entities/*` and
`solution/src/Other/Relationships.xml` from a declarative Python schema at the top of
the file — that's the place to add more tables/fields for Phase 2 rather than
hand-editing the generated XML. After editing, regenerate and repack:

```bash
python3 gen_solution.py
cd solution
pac solution pack --folder ./src --zipfile ../GCMissionControl_Phase1.zip --packagetype Unmanaged
```

(Requires the .NET SDK and `dotnet tool install --global Microsoft.PowerApps.CLI.Tool
--version 1.34.3` — later versions failed to install in this sandbox; worth retrying
newer versions in an environment with unrestricted NuGet access.)

## Suggested Phase 2+ order

1. Wire real **choice columns** and **views** for the six existing tables (needs a
   live tenant to verify option-set numbering behaves as expected).
2. Add the next tier of entities: `RotaWeek`, `StaffShift`, `ComplianceConfig`,
   `TrainingRequirement`, `CVR`, `Absence` — the scheduling/compliance core.
3. Pick 5-10 of the highest-value backend functions (e.g.
   `calculateJobFinancials`, `checkComplianceExpiry`, `generateRecurringDuties`) and
   rebuild them as Power Automate cloud flows triggered from Dataverse.
4. Only after the data model and core flows are proven in your tenant, revisit a
   Canvas App for a more bespoke UI than the model-driven default — at that point a
   real `.msapp` from Studio can be exported and used as a starting point instead of
   guessing the format blind.
