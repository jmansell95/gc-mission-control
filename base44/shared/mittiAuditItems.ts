// ============================================================
// Shared Mitti audit item/response parser
// ============================================================
// Parses the full Mitti (SafetyCulture) audit payload into a
// structured list of check items (questions, answers, pass/fail,
// photos, GPS, signatures) for the in-app drill-down detail view.
// Used by the getMittiAuditDetail backend function.

import { deepGet, num } from './mittiAudit.ts';

export interface AuditCheckItem {
  id: string;
  label: string;
  type: string;
  response: string;
  status: 'pass' | 'fail' | 'pending' | 'n/a';
  score: number | null;
  maxScore: number | null;
  photos: string[];
  comments: string;
  section: string;
  order: number;
}

export interface ParsedAuditDetail {
  items: AuditCheckItem[];
  headerFields: { label: string; value: string }[];
  gps: { lat: number | null; lng: number | null };
  signatureUrl: string | null;
  auditorName: string;
  auditorEmail: string;
  templateName: string;
  auditTitle: string;
  conductedAt: string;
  completedAt: string;
  reportUrl: string;
  overallScore: number | null;
  maxScore: number | null;
  scorePercentage: number | null;
  passFail: string;
  itemsPassed: number;
  itemsFailed: number;
  actionItems: any[];
  siteName: string;
}

// Extract photo URLs from a media/asset field — handles multiple
// Mitti payload shapes (media, assets, photos, image_url).
function extractPhotos(item: any): string[] {
  const photos: string[] = [];
  const sources = [
    deepGet(item, 'media'),
    deepGet(item, 'assets'),
    deepGet(item, 'photos'),
    deepGet(item, 'image'),
    deepGet(item, 'image_url'),
  ];
  for (const src of sources) {
    if (src == null) continue;
    if (typeof src === 'string') { photos.push(src); continue; }
    if (Array.isArray(src)) {
      for (const m of src) {
        if (typeof m === 'string') { photos.push(m); continue; }
        const url = deepGet(m, 'url', 'media_url', 'file_url', 'src', 'download_url');
        if (url) photos.push(String(url));
      }
    } else if (typeof src === 'object') {
      const url = deepGet(src, 'url', 'media_url', 'file_url', 'src', 'download_url');
      if (url) photos.push(String(url));
    }
  }
  return photos;
}

// Determine pass/fail status from a response value
function classifyStatus(val: any, itemType: string): 'pass' | 'fail' | 'pending' | 'n/a' {
  if (val == null || val === '') return 'pending';
  const s = String(val).toLowerCase().trim();
  if (s === 'n/a' || s === 'na' || s === 'not applicable') return 'n/a';
  // SafetyCulture uses specific response values
  if (['pass', 'safe', 'yes', 'compliant', 'good', 'ok', 'complete', 'done'].includes(s)) return 'pass';
  if (['fail', 'unsafe', 'no', 'non-compliant', 'noncompliant', 'bad', 'defective', 'broken', 'missing', 'incomplete'].includes(s)) return 'fail';
  // For question types that don't have pass/fail, return pending
  if (['text', 'textarea', 'signature', 'media', 'slider', 'datetime', 'information'].includes(itemType)) return 'pending';
  return 'pending';
}

// Parse the full Mitti audit payload into structured check items.
// Handles both the legacy SafetyCulture inspection format (items array
// with nested sections/questions) and the newer Mitti format.
export function parseAuditItems(audit: any): ParsedAuditDetail {
  const items: AuditCheckItem[] = [];
  const headerFields: { label: string; value: string }[] = [];
  let order = 0;

  // ── Extract items from the audit payload ──
  // Mitti/SafetyCulture stores items in various locations:
  // audit_data.items, items, audit.items, header_items + body_items
  const rawItems: any[] = [];
  const itemSources = [
    deepGet(audit, 'audit_data.items'),
    deepGet(audit, 'items'),
    deepGet(audit, 'audit.items'),
  ];
  for (const src of itemSources) {
    if (Array.isArray(src)) { rawItems.push(...src); break; }
  }

  // Also check for body_items / header_items structure
  const bodyItems = deepGet(audit, 'audit_data.body_items', 'body_items', 'audit.body_items');
  const headerItems = deepGet(audit, 'audit_data.header_items', 'header_items', 'audit.header_items');
  if (Array.isArray(headerItems) && headerItems.length > 0 && rawItems.length === 0) {
    for (const hi of headerItems) {
      const label = String(deepGet(hi, 'label', 'title', 'name') || '');
      const val = deepGet(hi, 'value', 'response', 'text');
      if (label) headerFields.push({ label, value: val != null ? String(val) : '—' });
    }
  }
  if (Array.isArray(bodyItems) && bodyItems.length > 0 && rawItems.length === 0) {
    rawItems.push(...bodyItems);
  }

  // Process raw items — each item may be a section (containing children)
  // or a leaf question
  function processItem(item: any, sectionName: string) {
    if (!item || typeof item !== 'object') return;
    const itemType = String(deepGet(item, 'type', 'item_type', 'control_type') || 'question').toLowerCase();
    const label = String(deepGet(item, 'label', 'title', 'name', 'question', 'text') || '');
    const children = deepGet(item, 'items', 'children', 'sub_items', 'sections');

    // Section header — recurse into children
    if (Array.isArray(children) && children.length > 0) {
      const newSection = label || sectionName;
      for (const child of children) {
        processItem(child, newSection);
      }
      return;
    }

    // Leaf question
    const responseVal = deepGet(item, 'value', 'response', 'answer', 'text', 'result');
    const photos = extractPhotos(item);
    const comments = String(deepGet(item, 'comments', 'note', 'notes', 'description') || '');
    const score = num(deepGet(item, 'score', 'points'));
    const maxScore = num(deepGet(item, 'max_score', 'total_score', 'max_points'));
    const status = classifyStatus(responseVal, itemType);

    items.push({
      id: String(deepGet(item, 'id', 'item_id', 'uuid') || `item-${order}`),
      label: label || 'Untitled item',
      type: itemType,
      response: responseVal != null ? String(responseVal) : '',
      status,
      score,
      maxScore,
      photos,
      comments,
      section: sectionName || 'General',
      order: order++,
    });
  }

  for (const item of rawItems) {
    processItem(item, '');
  }

  // ── GPS coordinates ──
  const gpsLat = num(deepGet(audit, 'audit_data.gps.lat', 'audit_data.location.lat', 'gps.latitude', 'location.lat', 'geo.lat'));
  const gpsLng = num(deepGet(audit, 'audit_data.gps.lng', 'audit_data.location.lng', 'gps.longitude', 'location.lng', 'geo.lng'));

  // ── Signature ──
  let signatureUrl: string | null = null;
  const sigSources = [deepGet(audit, 'audit_data.signature', 'signature', 'audit.signature')];
  for (const sig of sigSources) {
    if (typeof sig === 'string' && sig) { signatureUrl = sig; break; }
    if (sig && typeof sig === 'object') {
      const url = deepGet(sig, 'url', 'media_url', 'image_url', 'data');
      if (url) { signatureUrl = String(url); break; }
    }
  }

  // ── Extract summary fields using the existing extractor ──
  const templateName = String(deepGet(audit, 'template_data.metadata.name', 'template_data.name', 'template.name', 'template_name') || '');
  const auditTitle = String(deepGet(audit, 'audit_data.name', 'name', 'audit.name', 'audit.title') || '');
  const auditorName = String(deepGet(audit, 'audit_data.authorship.author', 'authorship.author', 'audit_data.authorship.owner', 'authorship.owner', 'audit.author.name', 'author.name') || '');
  const auditorEmail = String(deepGet(audit, 'audit_data.authorship.email', 'authorship.email', 'owner.email', 'audit.author.email', 'author.email') || '');
  const siteName = String(deepGet(audit, 'audit_data.site.name', 'site.name', 'audit_data.site', 'site', 'location') || '');
  const conductedAt = String(deepGet(audit, 'audit_data.date_started', 'date_started', 'created_at', 'audit.audit_started_at', 'audit_started_at') || '');
  const completedAt = String(deepGet(audit, 'audit_data.date_completed', 'date_completed', 'modified_at', 'audit.audit_completed_at', 'audit_completed_at', 'completed_at') || '');
  const reportUrl = String(deepGet(audit, 'audit_data.report_url', 'report_url', 'pdf_url', 'audit.report_url') || '');
  const overallScore = num(deepGet(audit, 'audit_data.score', 'score', 'audit.score'));
  const maxScore = num(deepGet(audit, 'audit_data.total_score', 'total_score', 'max_score', 'audit.max_score'));
  const scorePct = num(deepGet(audit, 'audit_data.score_percentage', 'score_percentage', 'audit.score_percentage'));
  const passFailRaw = String(deepGet(audit, 'audit_data.pass_fail', 'pass_fail', 'result', 'audit.audit_data.pass_fail') || '').toLowerCase();
  const passFail = passFailRaw === 'pass' ? 'pass' : passFailRaw === 'fail' ? 'fail' : 'pending';
  const itemsPassed = num(deepGet(audit, 'audit_data.items_passed', 'items_passed', 'audit.items_passed')) || 0;
  const itemsFailed = num(deepGet(audit, 'audit_data.items_failed', 'items_failed', 'audit.items_failed')) || 0;

  // Action items
  const actionItems: any[] = [];
  const rawActions: any = deepGet(audit, 'audit_data.action_items', 'action_items', 'corrective_actions', 'actions', 'audit.action_items');
  if (Array.isArray(rawActions)) {
    for (const a of rawActions) {
      if (!a || typeof a !== 'object') continue;
      actionItems.push({
        description: String(a.description || a.action || a.text || ''),
        priority: String(a.priority || 'medium').toLowerCase(),
        assignee: String(a.assignee || a.assigned_to || ''),
        due_date: a.due_date ? String(a.due_date).slice(0, 10) : '',
      });
    }
  }

  return {
    items,
    headerFields,
    gps: { lat: gpsLat, lng: gpsLng },
    signatureUrl,
    auditorName,
    auditorEmail,
    templateName,
    auditTitle,
    conductedAt,
    completedAt,
    reportUrl,
    overallScore,
    maxScore,
    scorePercentage: scorePct != null ? scorePct : (overallScore != null && maxScore && maxScore > 0 ? Math.round((overallScore / maxScore) * 10000) / 100 : null),
    passFail,
    itemsPassed,
    itemsFailed,
    actionItems,
    siteName,
  };
}