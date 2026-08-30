// Planner helper functions — extracted from importPlannerSpreadsheet to keep
// the entry file under the line limit.

import { normalizeName, nameKey } from './entityRegistry.ts';
import { looksLikeCompanyName } from './spreadsheetParser.ts';
import {
  SUBCONTRACTOR_PATTERNS, KNOWN_AGENCY_NAMES, DEPOT_ALIASES,
  YARD_DEPOT_EXACT_TEXTS, NON_WORK_SECTION_KEYWORDS, DEPOT_TEAM_NAME,
} from './plannerConstants.ts';

// Internal company names that should NOT be flagged as subcontractors.
// These are Ground Control group entities or partner consultancies that
// appear as company-like names in the planner but are internal, not external.
const INTERNAL_COMPANY_WHITELIST = [
  'ground control',
  'land & water',
  'land and water',
  'land & water solutions',
  'sda site investigations',
  'sda',
  'concept engineering',
  'concept',
  'cgl',
  'phenna',
  'phenna group',
];

// Known labour agencies that appear as section headers in the planner.
// Workers listed under these headers are agency labourers supplied by that
// company — not direct employees or subcontractors.
// (KNOWN_AGENCY_NAMES is already in plannerConstants.ts but we also export
// it here for the header-context matcher.)

// Section header keywords that indicate the rows beneath are agency-supplied
// labour, even when the agency name isn't in the known list.
const AGENCY_HEADER_KEYWORDS = ['agency', 'labour', 'labourer', 'temp', 'casual'];

export function isInternalCompany(name: string): boolean {
  if (!name) return false;
  const lower = normalizeName(name).toLowerCase();
  return INTERNAL_COMPANY_WHITELIST.some(c => lower === c || lower.includes(c));
}

export function isSubcontractor(name: string): boolean {
  const lower = normalizeName(name).toLowerCase();
  if (SUBCONTRACTOR_PATTERNS.some(p => lower.includes(p))) return true;
  // Check against internal company whitelist BEFORE flagging as subcontractor.
  // This prevents legitimate internal companies like 'SDA Site Investigations'
  // from being misidentified as external subcontractors.
  if (isInternalCompany(name)) return false;
  return looksLikeCompanyName(name);
}

export function isAgencySection(name: string): boolean {
  if (!name) return false;
  const lower = normalizeName(name).toLowerCase();
  if (lower.includes('agency')) return true;
  // Check for known agency names in the section header
  if (KNOWN_AGENCY_NAMES.some(a => lower.includes(a))) return true;
  // Check for generic agency header keywords (e.g. "Field Teams - Drilling Subbies"
  // implies agency labour even without a specific agency name)
  return AGENCY_HEADER_KEYWORDS.some(k => lower.includes(k));
}

export function extractAgencyNameFromSection(sectionName: string): string {
  if (!sectionName) return '';
  const lower = normalizeName(sectionName).toLowerCase();
  for (const agency of KNOWN_AGENCY_NAMES) {
    if (lower.includes(agency)) {
      return agency.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return '';
}

export function isDepotSection(name: string): boolean {
  if (!name) return false;
  const lower = normalizeName(name).toLowerCase();
  return DEPOT_ALIASES.some(a => lower === a || lower.includes(a));
}

export function isYardDepotText(text: string): boolean {
  if (!text) return false;
  const lower = normalizeName(text).toLowerCase().trim();
  return YARD_DEPOT_EXACT_TEXTS.includes(lower);
}

export function isNonWorkSection(name: string): boolean {
  if (!name) return false;
  const lower = normalizeName(name).toLowerCase().trim();
  return NON_WORK_SECTION_KEYWORDS.some(kw => lower === kw || lower.includes(kw));
}

export function normalizeSection(section: string): string {
  if (!section) return section;
  if (isNonWorkSection(section)) return '';
  if (isDepotSection(section)) return DEPOT_TEAM_NAME;
  return section;
}