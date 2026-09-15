# GC Mission Control — Power Platform Migration

Native rebuild of GC Mission Control (the Base44 app in this repo) as a Power Apps
/ Dataverse app, done in phases. Each phase adds a batch of tables you import
directly into Power Apps — no Base44 dependency, nothing embedded.

## The only mechanism that actually works: CSV import

Two other approaches were tried and ruled out this session — worth knowing so
nobody re-attempts them:

- **Hand-authored solution XML for new tables.** Four different fixes all failed
  identically. Microsoft's own guidance: *"You cannot create brand new custom
  tables by hand-writing customizations.xml — that's not supported."* It only
  works for editing forms/views/ribbons/sitemap on tables that **already exist**.
- **PCF-embedded iframe of the live Base44 app** (`GCMissionControl_PCF.zip`,
  `pcf-missioncontrol/`, `pcf-solution/` — kept in the repo but not the active
  plan). Builds fine, but embeds the *existing* Base44-backed app rather than
  building anything native, and needs an environment admin setting most accounts
  don't have on by default. Parked, not deleted, in case it's wanted later.

**What works, proven by Phase 1**: Power Apps' **Tables → New table → From
Excel/CSV**. Upload a CSV with the right headers and a couple of sample rows,
and it creates a correctly-typed table — fully supported, no XML, no import
errors.

## Phases

| Phase | Tables | Status |
|---|---|---|
| 1 | Job, Site Asset, Staff Member, Client, Contractor, Job Asset Assignment | ✅ Imported |
| 2 | Team, Rota Week, Rota Assignment, Staff Shift Pattern, Absence, Training Course, Training Requirement, CVR | 📦 Ready to import |

CSVs live in `csv-tables/phase<N>/`. Each table's columns are a pragmatic subset
of the real entity in `base44/entities/*.jsonc` — nested arrays/objects
(e.g. `Job.disciplines`, `RotaAssignment`'s signature/audit-timestamp fields)
don't map to flat CSV/Dataverse columns and were left out; add them as JSON-text
columns or child tables later if actually needed.

### Importing a phase

For each CSV in the phase's folder, in make.powerapps.com:
1. **Tables → New table → From Excel/CSV** → upload the CSV.
2. Delete the two sample data rows afterwards (Data tab → select rows → delete)
   — they're only there so Power Apps infers sensible column types.
3. Import tables in an order where lookup targets already exist where possible
   (e.g. Team and Job before Rota Assignment) — it's not strictly required since
   lookups are fixed up afterwards anyway, just tidier.

### Fixing up lookup columns

CSV import can't create relationships, so every column that should be a lookup
imports as plain text. After import, for each one: **New column → Lookup** → pick
the target table → then delete the old text column of the same name.

**Phase 1:**
| Table | Text column | → Lookup to |
|---|---|---|
| Job | Client | Client |
| Job | Contractor | Contractor |
| Staff Member | Agency | Contractor |
| Staff Member | Manager | Staff Member (self) |
| Client | Parent Client | Client (self) |
| Job Asset Assignment | Job | Job |
| Job Asset Assignment | Asset | Site Asset |
| Job Asset Assignment | Vehicle | Site Asset |

**Phase 2:**
| Table | Text column | → Lookup to |
|---|---|---|
| Team | Parent Team | Team (self) |
| Team | Supervisor | Staff Member |
| Rota Assignment | Job | Job |
| Rota Assignment | Staff | Staff Member |
| Rota Assignment | Vehicle | Site Asset |
| Rota Assignment | Rig Asset | Site Asset |
| Staff Shift Pattern | Staff | Staff Member |
| Absence | Staff | Staff Member |
| CVR (Cost Value Report) | Job | Job |

### Seeing it as an app

**Apps → New app → Model-driven** → in App Designer, add every table you've
imported so far under **Site map** → **Publish**. Real Power Apps screens
(grids, forms, filtering, related-record views), natively, no XML — re-publish
after each new phase to add its tables to the same app.

### Not in scope yet

- The other ~118 entities beyond phases 1-2 (compliance detail, billing/financials,
  logistics, borehole/geotech, safety, HR, etc.) — more phases, same CSV process.
- The 250+ backend functions in `base44/functions/` — these are business logic
  (Power Automate flows or Dataverse plugins), not schema; a separate effort once
  enough of the data model exists to drive them.
- The 3 AI agents and the external integrations (WhatsApp, SharePoint, Asset
  Panda, Geotab, Stripe, etc.) — each needs real credentials from you to wire up.
- Choice (picklist) columns — status/type fields are plain text for now to avoid
  guessing option-set numbering; upgrade candidates once more of the app exists.

## Adding a phase / rebuilding CSVs

`gen_csv.py` is the canonical tool — a declarative Python schema (`PHASES` dict at
the top) generates every CSV. To add Phase 3: add a new `3: {...}` entry following
the existing pattern, then:

```bash
python3 gen_csv.py 3
```

`gen_solution.py` and `solution/` (the old hand-authored-XML attempt) are kept for
history only — don't use them for new tables, per above.
