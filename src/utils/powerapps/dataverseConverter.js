// Converts a Base44 entity JSON schema into a Dataverse table definition.
// Produces a comprehensive text document listing every column, choice option,
// and relationship — the build spec for recreating the table in Dataverse.

const BUILT_IN_FIELDS = ['id', 'created_date', 'updated_date', 'created_by_id'];

// Map Base44 field types to Dataverse column types with exact schema names
function mapFieldType(fieldName, fieldSchema) {
  const type = fieldSchema.type;
  const format = fieldSchema.format;
  const schemaName = 'gc_' + fieldName;

  // Reference / lookup (ends in _id)
  if (fieldName.endsWith('_id') && type === 'string') {
    const targetEntity = fieldName.replace(/_id$/, '').replace(/_ids$/, '');
    return {
      dataverseType: 'Lookup',
      schemaName,
      target: capitalize(targetEntity),
      relationshipType: 'N:1 (Referential)',
      notes: 'Lookup to ' + capitalize(targetEntity) + ' table. Create a N:1 relationship from ' + schemaName + ' → gc_' + targetEntity.toLowerCase() + '.',
    };
  }

  // Enum / choice
  if (type === 'string' && fieldSchema.enum && fieldSchema.enum.length > 0) {
    const optionSetName = 'gc_' + fieldName + '_options';
    return {
      dataverseType: 'Choice (Option Set)',
      schemaName,
      optionSetName,
      options: fieldSchema.enum,
      notes: 'Create a global Choice (Option Set) named "' + optionSetName + '" with these values: ' + fieldSchema.enum.join(', ') + '. Reference it on this column.',
    };
  }

  // Boolean
  if (type === 'boolean') {
    return { dataverseType: 'Two Options (Yes/No)', schemaName, notes: 'Yes/No boolean field' };
  }

  // Number types
  if (type === 'number') {
    if (fieldSchema.description && /price|amount|cost|rate|charge|fee|budget|value|earnings/i.test(fieldName)) {
      return { dataverseType: 'Currency', schemaName, notes: 'Currency (GBP). Set Precision = 2, Min = 0.' };
    }
    if (format === 'float' || /lat|lng|accuracy|speed|heading|confidence|percentage|qty|quantity|depth|metres|meters|minutes|hours|count|number/i.test(fieldName)) {
      return { dataverseType: 'Decimal', schemaName, notes: 'Decimal number. Set Precision = 2 for lat/lng, Precision = 0 for counts.' };
    }
    return { dataverseType: 'Whole Number', schemaName, notes: 'Whole number (integer)' };
  }

  // Array of strings
  if (type === 'array' && fieldSchema.items && fieldSchema.items.type === 'string') {
    return { dataverseType: 'Multi-Select Picklist (Choices)', schemaName, notes: 'Multi-select text values. For large sets, consider a child table with a N:N relationship.' };
  }

  // Array of objects → child table
  if (type === 'array' && fieldSchema.items && fieldSchema.items.type === 'object') {
    const childTableName = 'gc_' + fieldName;
    return {
      dataverseType: 'Child Table (1:N)',
      schemaName,
      childTableName,
      notes: 'Create a child table "' + childTableName + '" with a Lookup column "gc_parent_id" back to this table. Define the child table columns from the array item schema.',
    };
  }

  // Date
  if (type === 'string' && (format === 'date' || format === 'date-time')) {
    return { dataverseType: 'Date and Time', schemaName, notes: format === 'date' ? 'Date only (Behavior = Date Only)' : 'Date and time (Behavior = User Local)' };
  }

  // Long text (description, content, notes, body)
  if (type === 'string' && /description|content|notes|body|raw_|breakdown|template|summary|message|reason|remarks|history|breakdown/i.test(fieldName)) {
    return { dataverseType: 'Multi-Line Text', schemaName, notes: 'Multi-line text. Set Max Length = 4000 (or more for long content).' };
  }

  // URL fields
  if (type === 'string' && /url|link|photo|avatar|signature|file/i.test(fieldName)) {
    return { dataverseType: 'URL', schemaName, notes: 'URL field. Set Max Length = 2048.' };
  }

  // Default: single-line text
  return { dataverseType: 'Text (Single Line)', schemaName, notes: 'Single line of text. Set Max Length = 255 (default).' };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatColumnRow(name, fieldSchema, isRequired) {
  const mapped = mapFieldType(name, fieldSchema);
  const req = isRequired ? '✅ Yes' : 'No';
  const desc = (fieldSchema.description || '').replace(/\n/g, ' ').substring(0, 200);
  const lines = [];
  lines.push('| ' + name + ' | `' + mapped.schemaName + '` | ' + mapped.dataverseType + ' | ' + req + ' | ' + desc + ' |');
  if (mapped.options) {
    lines.push('|   | Option Set: `' + (mapped.optionSetName || 'gc_' + name + '_options') + '` | | | Values: ' + mapped.options.map(o => '`' + o + '`').join(' · ') + ' |');
  }
  if (mapped.target) {
    lines.push('|   | Relationship | | | ' + mapped.relationshipType + ' → `' + mapped.target + '` table (schema: `gc_' + mapped.target.toLowerCase() + '`) |');
  }
  if (mapped.childTableName) {
    lines.push('|   | Child Table | | | Create `' + mapped.childTableName + '` with Lookup `gc_parent_id` → this table |');
  }
  return lines.join('\n');
}

export function convertEntityToDataverse(entityName, schema) {
  const props = schema.properties || {};
  const required = schema.required || [];
  const schemaName = 'gc_' + entityName.toLowerCase();

  let out = '';
  out += '## Table: ' + entityName + '\n\n';
  out += '**Display Name:** ' + entityName + '\n';
  out += '**Plural Name:** ' + entityName + 's\n';
  out += '**Schema Name:** `' + schemaName + '`\n';
  out += '**Table Code (4 chars):** ' + entityName.substring(0, 4).toLowerCase() + '\n';
  if (schema.description) out += '**Description:** ' + schema.description.substring(0, 300) + '\n';
  out += '\n';

  // Primary column (Dataverse requires a primary name column)
  const nameField = props['name'] || props['title'] || props['hotel_name'] || props['label'];
  out += '**Primary Name Column:** ' + (nameField ? '`name` (Text)' : '`gc_id` (Autonumber — prefix: GC-)') + '\n';
  out += '**Primary Name Type:** ' + (nameField ? 'Text (Single Line), Max 255' : 'Autonumber, Format: GC-{SEQNUM:00000}') + '\n\n';

  // Standard audit columns (Dataverse built-in)
  out += '### Standard Columns (Dataverse built-in — do not create manually)\n';
  out += '| Column | Type | Notes |\n';
  out += '|--------|------|-------|\n';
  out += '| Created On (`createdon`) | Date and Time | Auto-populated by system |\n';
  out += '| Created By (`createdby`) | Lookup (User) | Auto-populated by system |\n';
  out += '| Modified On (`modifiedon`) | Date and Time | Auto-populated by system |\n';
  out += '| Modified By (`modifiedby`) | Lookup (User) | Auto-populated by system |\n';
  out += '| Owner (`ownerid`) | Lookup (Team/User) | Auto-populated by system |\n\n';

  // Custom columns
  out += '### Custom Columns\n';
  out += '| Field Name | Schema Name | Dataverse Type | Required | Description / Options |\n';
  out += '|------------|-------------|---------------|----------|----------------------|\n';

  const relationships = [];
  const childTables = [];
  const optionSets = [];

  for (const [fieldName, fieldSchema] of Object.entries(props)) {
    if (BUILT_IN_FIELDS.includes(fieldName)) continue;
    out += formatColumnRow(fieldName, fieldSchema, required.includes(fieldName)) + '\n';

    // Collect relationships
    if (fieldName.endsWith('_id') && fieldSchema.type === 'string') {
      const target = capitalize(fieldName.replace(/_id$/, '').replace(/_ids$/, ''));
      relationships.push({ field: fieldName, schema: 'gc_' + fieldName, target, type: 'N:1 Lookup' });
    }
    if (fieldName.endsWith('_ids') && fieldSchema.type === 'string') {
      relationships.push({ field: fieldName, schema: 'gc_' + fieldName, target: capitalize(fieldName.replace(/_ids$/, '')), type: 'N:N (stored as comma-separated — migrate to N:N relationship)' });
    }
    if (fieldSchema.type === 'array' && fieldSchema.items && fieldSchema.items.type === 'object') {
      childTables.push({ field: fieldName, parent: entityName, tableName: 'gc_' + entityName.toLowerCase() + '_' + (fieldSchema.items.name || fieldName) });
    }
    if (fieldSchema.type === 'string' && fieldSchema.enum) {
      optionSets.push({ field: fieldName, name: 'gc_' + fieldName + '_options', values: fieldSchema.enum });
    }
  }

  // Option Sets to create
  if (optionSets.length > 0) {
    out += '\n### Global Option Sets (Choices) to Create\n';
    out += 'Create these as global Choice (Option Set) definitions in your solution before adding the columns:\n\n';
    optionSets.forEach(os => {
      out += '**`' + os.name + '`** — used by `' + os.field + '`:\n';
      os.values.forEach((v, i) => {
        out += '- Value ' + (i + 1) + ': `' + v + '` (Label: ' + capitalize(v.replace(/_/g, ' ')) + ')\n';
      });
      out += '\n';
    });
  }

  // Relationships
  if (relationships.length > 0) {
    out += '\n### Relationships\n';
    out += '| Field | Schema Name | Type | Target Table | Notes |\n';
    out += '|-------|-------------|------|-------------|-------|\n';
    relationships.forEach(r => {
      out += '| ' + r.field + ' | `' + r.schema + '` | ' + r.type + ' | `' + r.target + '` (schema: `gc_' + r.target.toLowerCase() + '`) | Create relationship in Dataverse: 1:' + r.target + ' → N:' + entityName + ' |\n';
    });
  }

  // Child tables
  if (childTables.length > 0) {
    out += '\n### Child Tables (create these as separate Dataverse tables)\n';
    childTables.forEach(c => {
      out += '- **`' + c.tableName + '`** — child of ' + c.parent + '.\n';
      out += '  - Add a Lookup column `gc_parent_id` → `' + c.parent + '` (schema: `gc_' + c.parent.toLowerCase() + '`).\n';
      out += '  - Define the child table columns from the array item schema (see the Base44 entity schema for the `items.properties` definition).\n';
    });
  }

  // RLS note
  if (schema.rls) {
    out += '\n### Row-Level Security (RLS)\n';
    out += '**Base44 RLS config:**\n';
    out += '```json\n';
    out += JSON.stringify(schema.rls, null, 2);
    out += '\n```\n\n';
    out += '**Dataverse implementation:**\n';
    out += '1. Add a `gc_division_id` Lookup column to this table (if not already present) → `gc_division` table.\n';
    out += '2. Create security roles: Super Admin, Admin, Office, Field, Read Only.\n';
    out += '3. For division-scoped access, configure each role\'s Row-Level Security filter:\n';
    out += '   - **Super Admin / Admin:** No filter (full access).\n';
    out += '   - **Office / Field:** Filter where `gc_division_id` = the user\'s division OR `gc_division_id` is null.\n';
    out += '4. For sensitive fields (e.g. `ni_number`, `date_of_birth`, `custom_fee`), use Column Security Profiles:\n';
    out += '   - Create a Column Security Profile "Sensitive Fields — Admin Only".\n';
    out += '   - Add the sensitive columns to this profile.\n';
    out += '   - Grant Read/Update only to the Admin security role.\n';
    out += '5. For manager-level access (e.g. a staff member sees their own records), use Dataverse hierarchy security or a custom filter on `createdby` = current user.\n';
  }

  out += '\n---\n\n';
  return out;
}

export function generateDataverseSchemaDocument(schemas) {
  let doc = '';
  doc += '# GC Mission Control — Dataverse Schema Pack\n\n';
  doc += '**Volume 1 of 5 — Database Schema Build Manual**\n\n';
  doc += 'Generated: ' + new Date().toISOString() + '\n\n';
  doc += 'This document defines every Dataverse table, column, choice option, and relationship needed to recreate the GC Mission Control platform.\n\n';
  doc += '## How to Use This Document\n\n';
  doc += '1. **Create the solution** in Power Apps (make.powerapps.com → Solutions → New). Name it `GC Mission Control`.\n';
  doc += '2. **Create global Option Sets first** — scan every table below for the "Global Option Sets to Create" section and create each Choice (Option Set) in the solution before adding any columns.\n';
  doc += '3. **Create tables in dependency order** — create parent tables (Staff, Job, Division, Supplier, Client, Team) before child tables that have Lookups to them.\n';
  doc += '4. **For each table:**\n';
  doc += '   a. Go to Tables → New table.\n';
  doc += '   b. Set the Display Name, Plural Name, and Schema Name exactly as listed.\n';
  doc += '   c. Set the Primary Name Column as specified.\n';
  doc += '   d. Add each custom column with the exact Schema Name and Dataverse Type listed.\n';
  doc += '   e. For Choice columns, reference the global Option Set you created in step 2.\n';
  doc += '   f. For Lookup columns, create the relationship to the target table.\n';
  doc += '   g. For child tables (arrays of objects), create a separate table with a Lookup back to the parent.\n';
  doc += '5. **After all tables are created**, configure Row-Level Security per the RLS section on each table.\n';
  doc += '6. **Enable Dataverse auditing** on every table (Table properties → Auditing → enable all) for the SystemAuditLog equivalent.\n\n';
  doc += '## Naming Conventions\n\n';
  doc += '- All custom tables use the `gc_` prefix (e.g. `gc_staff`, `gc_job`).\n';
  doc += '- All custom columns use the `gc_` prefix (e.g. `gc_name`, `gc_status`).\n';
  doc += '- Global Option Sets use the `gc_<field>_options` naming convention.\n';
  doc += '- Dataverse built-in columns (createdon, createdby, modifiedon, modifiedby, ownerid) are auto-created — do not create them manually.\n\n';
  doc += '## Tables (' + schemas.length + ' total)\n\n';
  doc += '---\n\n';

  for (const { name, schema } of schemas) {
    if (schema) {
      doc += convertEntityToDataverse(name, schema);
    } else {
      doc += '## Table: ' + name + '\n\n**Schema Name:** `gc_' + name.toLowerCase() + '`\n\n**⚠️ Schema not available from the API.** Create this table manually based on the Base44 entity definition. Refer to the Base44 entity file `base44/entities/' + name + '.jsonc` for the field definitions.\n\n---\n\n';
    }
  }

  doc += '\n## Summary\n\n';
  doc += '- **Total tables:** ' + schemas.length + '\n';
  doc += '- **Tables with schemas loaded:** ' + schemas.filter(s => s.schema).length + '\n';
  doc += '- **Tables needing manual creation:** ' + schemas.filter(s => !s.schema).length + '\n';
  doc += '- **Total global Option Sets:** See each table\'s "Global Option Sets to Create" section\n';
  doc += '- **Total relationships:** See each table\'s "Relationships" section\n\n';
  doc += '## Next Steps\n\n';
  doc += '1. Create the solution and all global Option Sets.\n';
  doc += '2. Create all tables in dependency order (parents first).\n';
  doc += '3. Configure Row-Level Security roles.\n';
  doc += '4. Enable auditing on every table.\n';
  doc += '5. Import sample data (export from Base44 → CSV → Power Query Dataflow into Dataverse).\n';
  doc += '6. Proceed to Volume 2 (Power Automate flows) and Volume 3 (Canvas app).\n';

  return doc;
}