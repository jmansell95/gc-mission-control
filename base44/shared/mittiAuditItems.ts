// ============================================================
// Shared Mitti (SafetyCulture) audit item/response parser
// ============================================================
// Parses the full Mitti audit payload into a structured list of
// check items (questions, answers, pass/fail, photos, GPS,
// signatures) for the in-app drill-down detail view.
//
// KEY: The Mitti API returns items as a FLAT array at `audit.items`.
// Each item has `item_id`, `parent_id`, and `children` (array of
// item_id strings — NOT nested objects). Sections have type "section"
// and their children are ID references to other items in the flat
// array. We build the tree by mapping IDs to items and recursing.
//
// Responses are in `item.responses.selected` — an array of
// {id, label, colour, score, enable_score} objects. The pass/fail
// flag is `item.responses.failed` (boolean). Media is in
// `item.responses.media` — an array of media objects with media_id/href.

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

// Extract the response label(s) from a Mitti item's `responses.selected` array.
// Multiple selections are joined with ", ".
function extractResponseLabel(item: any): string {
  const selected = deepGet(item, 'responses.selected');
  if (Array.isArray(selected) && selected.length > 0) {
    return selected.map((s: any) => String(s.label || '')).filter(Boolean).join(', ');
  }
  // Some item types store the response as a simple string/number
  const textVal = deepGet(item, 'responses.text', 'responses.value', 'responses.answer');
  if (textVal) return String(textVal);
  return '';
}

// Extract photo/media URLs from a Mitti item's `responses.media` array.
// Each media entry has a `media_id` and optionally an `href` field with
// a direct URL. When only `media_id` is present, we emit a `mitti-media:`
// prefixed ID that the backend function resolves via the media endpoint.
function extractPhotos(item: any): string[] {
  const photos: string[] = [];
  const media = deepGet(item, 'responses.media');
  if (Array.isArray(media)) {
    for (const m of media) {
      if (!m) continue;
      if (typeof m === 'string') { photos.push(m); continue; }
      const url = deepGet(m, 'href', 'url', 'media_url', 'file_url', 'download_url', 'link');
      if (url) { photos.push(String(url)); continue; }
      const mediaId = deepGet(m, 'media_id', 'id');
      if (mediaId) { photos.push(`mitti-media:${mediaId}`); }
    }
  }
  return photos;
}

// Determine pass/fail status from a Mitti item's responses.
// Priority: explicit `responses.failed` boolean → score-based inference → pending.
function classifyStatus(item: any, itemType: string): 'pass' | 'fail' | 'pending' | 'n/a' {
  const responses = item?.responses;
  if (responses && typeof responses === 'object') {
    // Explicit failed flag from Mitti
    if (responses.failed === true) return 'fail';
    if (responses.failed === false && responses.selected != null) {
      // Has a selected response and not failed — check if it's a pass-type
      const selected = responses.selected;
      if (Array.isArray(selected) && selected.length > 0) {
        // If any selected response has score 0 or is a "fail" type, mark as fail
        const hasFail = selected.some((s: any) => s.enable_score === true && s.score === 0);
        if (hasFail) return 'fail';
        return 'pass';
      }
    }
  }

  // Score-based inference from the item's scoring object
  const scorePct = num(deepGet(item, 'scoring.combined_score_percentage'));
  if (scorePct != null) {
    if (scorePct >= 80) return 'pass';
    if (scorePct < 50 && scorePct > 0) return 'fail';
  }

  // Non-question types are always pending (informational, text, etc.)
  const informational = ['text', 'textsingle', 'textarea', 'information', 'media', 'signature', 'datetime', 'address', 'drawing', 'smartfield', 'dynamicfield', 'primeelement', 'category'];
  if (informational.includes(itemType)) return 'pending';

  // No response at all
  if (!responses || (responses.selected == null && responses.text == null && responses.value == null)) return 'pending';

  return 'pending';
}

// Parse the full Mitti audit payload into structured check items.
export function parseAuditItems(audit: any): ParsedAuditDetail {
  const checkItems: AuditCheckItem[] = [];
  const headerFields: { label: string; value: string }[] = [];
  let order = 0;

  // ── Build a flat item map from `audit.items` ──
  // The Mitti API stores ALL items in a flat array. Each item has
  // `item_id` and optionally `parent_id` / `children` (ID strings).
  const flatItems: any[] = Array.isArray(audit?.items) ? audit.items : [];
  const itemMap: Record<string, any> = {};
  for (const item of flatItems) {
    const id = String(item?.item_id || item?.id || '');
    if (id) itemMap[id] = item;
  }

  // Also check legacy locations (audit_data.items, audit.items) for older payloads
  if (flatItems.length === 0) {
    const legacyItems = deepGet(audit, 'audit_data.items');
    if (Array.isArray(legacyItems) && legacyItems.length > 0) {
      for (const item of legacyItems) {
        const id = String(item?.item_id || item?.id || '');
        if (id) itemMap[id] = item;
      }
      flatItems.push(...legacyItems);
    }
  }

  // ── Recursive tree builder ──
  // Walks the flat array by following `children` ID references,
  // recursing into each child. Section items become section headers;
  // leaf items (no children or children that don't exist) become check items.
  function processItem(item: any, sectionName: string, visited: Set<string>) {
    if (!item || typeof item !== 'object') return;
    const itemId = String(item.item_id || item.id || '');
    if (itemId && visited.has(itemId)) return; // prevent cycles
    if (itemId) visited.add(itemId);

    // Skip inactive items
    if (item.inactive === true) return;

    const itemType = String(item.type || 'question').toLowerCase();
    const label = String(item.label || item.title || item.name || '');

    // Get children — array of item_id strings (Mitti format) or nested objects (legacy)
    const childRefs = item.children;
    const hasChildRefs = Array.isArray(childRefs) && childRefs.length > 0 && typeof childRefs[0] === 'string';

    if (itemType === 'section' || itemType === 'category') {
      // Section header — recurse into children
      const newSection = label || sectionName;
      if (hasChildRefs) {
        for (const childId of childRefs) {
          const child = itemMap[String(childId)];
          if (child) processItem(child, newSection, visited);
        }
      }
      return;
    }

    // Leaf question — extract response, photos, etc.
    const responseVal = extractResponseLabel(item);
    const photos = extractPhotos(item);
    const comments = String(deepGet(item, 'responses.note', 'responses.comment', 'comments', 'note') || '');
    const score = num(deepGet(item, 'scoring.combined_score', 'scoring.score', 'score'));
    const maxScore = num(deepGet(item, 'scoring.combined_max_score', 'scoring.max_score', 'max_score'));
    const status = classifyStatus(item, itemType);

    // Skip items with no label and no response (smartfields, dynamic fields, etc.)
    if (!label && !responseVal && photos.length === 0) return;

    checkItems.push({
      id: itemId || `item-${order}`,
      label: label || 'Untitled item',
      type: itemType,
      response: responseVal,
      status,
      score,
      maxScore,
      photos,
      comments,
      section: sectionName || 'General',
      order: order++,
    });
  }

  // Process top-level items (those without a parent_id, or with parent_id that doesn't exist in map)
  const visited = new Set<string>();
  for (const item of flatItems) {
    const parentId = String(item.parent_id || '');
    const isTopLevel = !parentId || !itemMap[parentId];
    if (isTopLevel) {
      processItem(item, '', visited);
    }
  }

  // If no items were found via the tree walk, fall back to processing all items flat
  // (some older payloads may not have parent_id/children structure)
  if (checkItems.length === 0 && flatItems.length > 0) {
    for (const item of flatItems) {
      processItem(item, '', new Set());
    }
  }

  // ── Header fields ──
  // Extract from header_items if present (legacy), or from top-level text/info items
  const headerItems = deepGet(audit, 'audit_data.header_items', 'header_items');
  if (Array.isArray(headerItems)) {
    for (const hi of headerItems) {
      const label = String(deepGet(hi, 'label', 'title', 'name') || '');
      const val = extractResponseLabel(hi) || String(deepGet(hi, 'value', 'response', 'text') || '');
      if (label && val) headerFields.push({ label, value: val });
    }
  }

  // ── GPS coordinates ──
  const gpsLat = num(deepGet(audit, 'audit_data.gps.lat', 'audit_data.location.lat', 'gps.latitude', 'location.lat', 'geo.lat', 'audit_data.gps.latitude'));
  const gpsLng = num(deepGet(audit, 'audit_data.gps.lng', 'audit_data.location.lng', 'gps.longitude', 'location.lng', 'geo.lng', 'audit_data.gps.longitude'));

  // ── Signature ──
  // Find the first signature-type item that has a media response
  let signatureUrl: string | null = null;
  for (const item of flatItems) {
    if (String(item?.type || '').toLowerCase() === 'signature' && !item?.inactive) {
      const sigMedia = deepGet(item, 'responses.media');
      if (Array.isArray(sigMedia) && sigMedia.length > 0) {
        const url = deepGet(sigMedia[0], 'href', 'url', 'media_url');
        if (url) { signatureUrl = String(url); break; }
      }
      const sigData = deepGet(item, 'responses.signature', 'responses.data', 'responses.image');
      if (typeof sigData === 'string' && sigData) { signatureUrl = sigData; break; }
    }
  }

  // ── Summary fields ──
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
  const itemsPassed = num(deepGet(audit, 'audit_data.items_passed', 'items_passed', 'audit.items_passed')) || 0;
  const itemsFailed = num(deepGet(audit, 'audit_data.items_failed', 'items_failed', 'audit.items_failed')) || 0;

  // Pass/fail — infer from score and item-level failures (same logic as extractAuditFields)
  const passFailRaw = String(deepGet(audit, 'audit_data.pass_fail', 'pass_fail', 'result') || '').toLowerCase();
  const computedPct = scorePct != null ? scorePct : (overallScore != null && maxScore && maxScore > 0 ? Math.round((overallScore / maxScore) * 10000) / 100 : null);
  let passFail: string;
  if (passFailRaw === 'pass') passFail = 'pass';
  else if (passFailRaw === 'fail') passFail = 'fail';
  else if (itemsFailed > 0) passFail = 'fail';
  else if (computedPct != null && computedPct >= 80) passFail = 'pass';
  else if (computedPct != null && computedPct < 50) passFail = 'fail';
  else passFail = 'pending';

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
    items: checkItems,
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
    scorePercentage: computedPct,
    passFail,
    itemsPassed,
    itemsFailed,
    actionItems,
    siteName,
  };
}