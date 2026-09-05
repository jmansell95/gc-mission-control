// Converts a Base44 entity JSON schema into a Dataverse table definition.
// Produces a comprehensive text document listing every column, choice option,
// and relationship — the build spec for recreating the table in Dataverse.

const BUILT_IN_FIELDS = ['id', 'created_date', 'updated_date', 'created_by_id'];

// Map Base44 field types to Dataverse column types
function mapFieldType(fieldName, fieldSchema) {
  const type = fieldSchema.type;
  const format = fieldSchema.format;

  // Reference / lookup (ends in _id)
  if (fieldName.endsWith('_id') && type === 'string') {
    const targetEntity = fieldName.replace(/_id$/, '').replace(/_ids$/, '');
    return { dataverseType: 'Lookup', target: capitalize(targetEntity), notes: `Lookup to ${capitalize(targetEntity)} table` };
  }

  // Enum / choice
  if (type === 'string' && fieldSchema.enum && fieldSchema.enum.length > 0) {
    return {
      dataverseType: 'Choice',
      options: fieldSchema.enum,
      notes: `Choice: ${fieldSchema.enum.join(', ')}`
    };
  }

  // Boolean
  if (type === 'boolean') {
    return { dataverseType: 'Two Options', options: ['true', 'false'], notes: 'Yes/No' };
  }

  // Number types
  if (type === 'number') {
    if (fieldSchema.description && /price|amount|cost|rate|charge|fee|budget|value|earnings/i.test(fieldName)) {
      return { dataverseType: 'Currency', notes: 'Currency (GBP)' };
    }
    return { dataverseType: 'Whole Number', notes: 'Integer' };
  }

  // Array of strings
  if (type === 'array' && fieldSchema.items && fieldSchema.items.type === 'string') {
    return { dataverseType: 'Multi-Select Picklist', options: [], notes: 'Multi-select text values (consider child table for large sets)' };
  }

  // Array of objects → child table
  if (type === 'array' && fieldSchema.items && fieldSchema.items.type === 'object') {
    return { dataverseType: 'Child Table (1:N)', notes: 'Create a child table for this array. Define a Lookup back to the parent.' };
  }

  // Date
  if (type === 'string' && (format === 'date' || format === 'date-time')) {
    return { dataverseType: 'Date and Time', notes: format === 'date' ? 'Date only' : 'Date and time' };
  }

  // Long text (description, content, notes, body)
  if (type === 'string' && /description|content|notes|body|raw_|breakdown|template|summary|message|reason/.test(fieldName)) {
    return { dataverseType: 'Multi-Line Text', notes: 'Multi-line text' };
  }

  // Default: single-line text
  return { dataverseType: 'Text (Single Line)', notes: 'Single line of text' };
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatColumnRow(name, schema, isRequired) {
  const mapped = mapFieldType(name, schema);
  const req = isRequired ? 'Yes' : 'No';
  const desc = (schema.description || '').replace(/\n/g, ' ').substring(0, 120);
  let line = `| ${name} | ${mapped.dataverseType} | ${req} | ${desc}`;
  if (mapped.options) {
    line += `\n|   | Options: | | ${mapped.options.join(' · ')}`;
  }
  return line;
}

export function convertEntityToDataverse(entityName, schema) {
  const props = schema.properties || {};
  const required = schema.required || [];

  let out = '';
  out += `## Table: ${entityName}\n\n`;
  out += `**Display Name:** ${entityName}\n`;
  out += `**Plural Name:** ${entityName}s\n`;
  out += `**Schema Name:** gc_${entityName.toLowerCase()}\n`;
  if (schema.description) out += `**Description:** ${schema.description}\n`;
  out += `\n`;

  // Primary column (Dataverse requires a primary name column)
  const nameField = props['name'] || props['title'] || props['hotel_name'] || props['label'];
  out += `**Primary Name Column:** ${nameField ? 'name' : 'gc_id'}\n`;
  out += `**Primary Name Type:** ${nameField ? 'Text (Single Line)' : 'Autonumber'}\n\n`;

  // Standard audit columns (Dataverse built-in)
  out += `### Standard Columns (Dataverse built-in)\n`;
  out += `| Column | Type | Notes |\n`;
  out += `|--------|------|-------|\n`;
  out += `| Created On | Date and Time | Auto-populated |\n`;
  out += `| Created By | Lookup (User) | Auto-populated |\n`;
  out += `| Modified On | Date and Time | Auto-populated |\n`;
  out += `| Modified By | Lookup (User) | Auto-populated |\n`;
  out += `| Owner | Lookup (Team) | Auto-populated |\n\n`;

  // Custom columns
  out += `### Custom Columns\n`;
  out += `| Column Name | Dataverse Type | Required | Description / Options |\n`;
  out += `|------------|---------------|----------|----------------------|\n`;

  const relationships = [];
  const childTables = [];

  for (const [fieldName, fieldSchema] of Object.entries(props)) {
    if (BUILT_IN_FIELDS.includes(fieldName)) continue;
    out += formatColumnRow(fieldName, fieldSchema, required.includes(fieldName)) + '\n';

    // Collect relationships
    if (fieldName.endsWith('_id') && fieldSchema.type === 'string') {
      const target = capitalize(fieldName.replace(/_id$/, '').replace(/_ids$/, ''));
      relationships.push({ field: fieldName, target, type: 'N:1 Lookup' });
    }
    if (fieldName.endsWith('_ids') && fieldSchema.type === 'string') {
      relationships.push({ field: fieldName, target: capitalize(fieldName.replace(/_ids$/, '')), type: 'N:N (stored as comma-separated — migrate to N:N relationship)' });
    }
    if (fieldSchema.type === 'array' && fieldSchema.items && fieldSchema.items.type === 'object') {
      childTables.push({ field: fieldName, parent: entityName });
    }
  }

  // Relationships
  if (relationships.length > 0) {
    out += `\n### Relationships\n`;
    out += `| Field | Type | Target Table |\n`;
    out += `|-------|------|-------------|\n`;
    relationships.forEach(r => {
      out += `| ${r.field} | ${r.type} | ${r.target} |\n`;
    });
  }

  // Child tables
  if (childTables.length > 0) {
    out += `\n### Child Tables (create these as separate Dataverse tables)\n`;
    childTables.forEach(c => {
      out += `- **gc_${entityName.toLowerCase()}_${c.field}** — child of ${c.parent}. Add a Lookup column \`_parent_id\` back to \`${entityName}\`.\n`;
    });
  }

  // RLS note
  if (schema.rls) {
    out += `\n### Row-Level Security (recreate as Dataverse column security + roles)\n`;
    out += '```json\n';
    out += JSON.stringify(schema.rls, null, 2);
    out += '\n```\n';
    out += `\n**Implementation:** Create a \`Division\` Lookup column on this table. Create security roles per division. Use column-level security for sensitive fields (ni_number, date_of_birth, custom_fee). Use Dataverse hierarchy security for manager-level access.\n`;
  }

  out += `\n---\n\n`;
  return out;
}

export function generateDataverseSchemaDocument(schemas) {
  let doc = '';
  doc += `# GC Mission Control — Dataverse Schema Pack\n\n`;
  doc += `**Volume 1 of 5 — Database Schema Build Manual**\n\n`;
  doc += `This document defines every Dataverse table, column, choice option, and relationship needed to recreate the GC Mission Control platform.\n\n`;
  doc += `## Build Instructions\n\n`;
  doc += `1. Create a new solution in Power Apps (make.powerapps.com → Solutions → New).\n`;
  doc += `2. Name it \`GC Mission Control\`.\n`;
  doc += `3. For each table below:\n`;
  doc += `   a. Go to Tables → New table.\n`;
  doc += `   b. Set the Display Name, Plural Name, and Schema Name as listed.\n`;
  doc += `   c. Set the Primary Name Column.\n`;
  doc += `   d. Add each custom column with the exact Dataverse Type listed.\n`;
  doc += `   e. For Choice columns, create a new Choice (option set) with the listed options.\n`;
  doc += `   f. For Lookup columns, create the relationship to the target table.\n`;
  doc += `   g. For child tables (arrays of objects), create a separate table with a Lookup back.\n`;
  doc += `4. After all tables are created, configure Row-Level Security:\n`;
  doc += `   a. Add a Division Lookup to each table that has \`division_id\`.\n`;
  doc += `   b. Create security roles: Super Admin, Admin, Office, Field, Read Only.\n`;
  doc += `   c. Use column security profiles for sensitive fields.\n`;
  doc += `5. Import sample data (see Volume 5 — seed data).\n\n`;
  doc += `## Tables (${schemas.length} total)\n\n`;
  doc += `---\n\n`;

  for (const { name, schema } of schemas) {
    if (schema) {
      doc += convertEntityToDataverse(name, schema);
    } else {
      doc += `## Table: ${name}\n\n**Schema not available — create manually based on the Base44 entity.**\n\n---\n\n`;
    }
  }

  return doc;
}