// Shared Asset Panda QR/barcode lookup logic — used by resolveAssetByQR (scanner).
// Tries Asset Panda first (live source of truth), searching ALL groups by
// Panda object ID, serial, name, OR the dedicated barcode field. Falls back
// to the local SiteAsset database if Panda is unconfigured/unreachable/no match.
//
// Returns:
//   { asset, source: 'panda'|'local', created, updated, live }  — existing local asset (no confirm)
//   { needs_confirm: true, source: 'panda', panda_id, group_id, group_label, barcode, name, serial, asset_type, stock_level } — Panda match, no local record yet
//   { source: 'none', warning } — no match anywhere

import {
  resolvePandaToken, buildFullFieldMap, fetchAllPandaGroups, fetchPandaGroupFields,
} from './assetPandaClient.ts';

const BARCODE_LABEL_KEYWORDS = ['barcode', 'asset tag', 'tag id', 'tag', 'qr', 'code', 'label', 'asset no', 'asset number', 'reference', 'ref'];

// Normalize barcode values for comparison — strips spaces, dashes, and
// common special characters so a scanned "AB-123-C" matches stored "AB123C".
function normalizeBarcode(val) {
  return String(val || '').toLowerCase().replace(/[\s\-_~`'"\\|/.,:;<>{}[\]()!@#$%^&*+=?]/g, '').trim();
}

export async function resolveAssetByQR(base44, scannedValue) {
  const q = String(scannedValue || '').trim().toLowerCase();
  if (!q) return { source: 'none', error: 'Empty scan' };

  // --- LOCAL FIRST: near-instant match against the cached SiteAsset table ---
  // The local records already hold the synced Panda data (barcode, serial,
  // panda_asset_id, name, compliance, stock). Matching locally first makes
  // scanning near-instant; the frontend fires a background Panda refresh
  // (refreshScannedAsset) to pull any live updates after the card is shown.
  const localMatch = await localFallback(base44, q);
  if (localMatch.asset) {
    return { asset: localMatch.asset, source: 'local', live: false, refresh_from_panda: true };
  }

  // --- No local match — fall back to a live Asset Panda search (new-asset path) ---
  const configs = await base44.asServiceRole.entities.AssetPandaConfig.filter({ key: 'global' });
  const config = configs && configs[0];

  // If Panda isn't configured, return the no-match result from the local fallback.
  if (!config) return localMatch;

  const baseUrl = (config.base_url || 'https://api.assetpanda.com').replace(/\/+$/, '');
  const { token, skipped } = await resolvePandaToken(config, baseUrl);
  if (skipped || !token) return localFallback(base44, q);

  const authHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const fieldMap = buildFullFieldMap(config);

  // --- Build the list of groups to search (auto-discover all, merge config) ---
  let groups = [];
  try {
    const all = await fetchAllPandaGroups(baseUrl, token);
    groups = all.map((g) => {
      const cfg = Array.isArray(config.groups) ? config.groups.find((c) => c.group_id === g.id) : null;
      return { group_id: g.id, label: cfg?.label || g.name };
    });
  } catch (_) {
    if (Array.isArray(config.groups) && config.groups.length > 0) {
      groups = config.groups.map((g) => ({ group_id: g.group_id, label: g.label }));
    } else if (config.group_id) {
      groups = [{ group_id: config.group_id, label: 'Asset Panda' }];
    }
  }
  if (groups.length === 0) return localFallback(base44, q);

  // --- Search each group using targeted field filters + global search ---
  // Uses the v3 search endpoint's field_filters and search body parameters to
  // query Asset Panda directly by the scanned value, instead of paginating
  // through every object (which was slow and often timed out before reaching
  // the matching record). Tries barcode/serial/name field filters first, then
  // falls back to a global text search.
  let pandaMatch = null;
  let matchGroupId = '';
  let matchGroupLabel = '';
  let matchBarcodeKey = '';

  for (const group of groups) {
    const groupId = group.group_id;
    // Resolve field keys for this group (explicit map + label auto-detect)
    let groupFields = [];
    try { groupFields = await fetchPandaGroupFields(baseUrl, token, groupId); } catch (_) {}
    const findByLabel = (keywords) => {
      const f = groupFields.find((fld) => keywords.some((k) => String(fld.label || '').toLowerCase().includes(k)));
      return f?.key || '';
    };
    const nameKey = fieldMap.name || findByLabel(['name', 'title', 'asset name', 'description']);
    const serialKey = fieldMap.serial_number || findByLabel(['serial', 'asset tag', 'tag', 'registration', 'reg']);
    const barcodeKey = fieldMap.barcode || findByLabel(BARCODE_LABEL_KEYWORDS);

    // Build targeted searches — most precise first, global text search last.
    const searchAttempts = [];
    if (barcodeKey) searchAttempts.push({ field_filters: { [barcodeKey]: scannedValue } });
    if (serialKey) searchAttempts.push({ field_filters: { [serialKey]: scannedValue } });
    if (nameKey) searchAttempts.push({ field_filters: { [nameKey]: scannedValue } });
    searchAttempts.push({ search: scannedValue }); // global text search fallback

    for (const searchBody of searchAttempts) {
      const url = `${baseUrl}/v3/groups/${groupId}/search/objects?limit=50&offset=0`;
      let objRes;
      try {
        objRes = await fetch(url, { method: 'POST', headers: authHeaders, body: JSON.stringify({ ...searchBody, view_archived: 'all' }) });
      } catch (_) { continue; }
      if (!objRes.ok) continue;
      const objJson = await objRes.json();
      const page = Array.isArray(objJson) ? objJson : (objJson.objects || objJson.data || objJson.results || objJson.group_objects || []);
      if (!page.length) continue;
      pandaMatch = page[0];
      matchGroupId = groupId;
      matchGroupLabel = group.label;
      matchBarcodeKey = barcodeKey;
      break;
    }
    if (pandaMatch) break;
  }

  if (!pandaMatch) return localFallback(base44, q);

  // --- Found in Panda — check for an existing local SiteAsset ---
  const pandaId = String(pandaMatch.id || pandaMatch.object_id || pandaMatch._id || '');
  const allLocal = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
  let local = null;
  if (pandaId) local = allLocal.find((a) => a.panda_asset_id === pandaId);
  const name = fieldValue(pandaMatch, fieldMap.name) || pandaMatch.name || 'Unnamed Asset';
  const serial = fieldValue(pandaMatch, fieldMap.serial_number) || pandaMatch.serial_number || '';
  const barcodeVal = matchBarcodeKey ? fieldValue(pandaMatch, matchBarcodeKey) : '';
  if (!local && serial) local = allLocal.find((a) => String(a.serial_number || '').toLowerCase().trim() === serial.toLowerCase().trim());
  if (!local && barcodeVal) local = allLocal.find((a) => normalizeBarcode(a.barcode) === normalizeBarcode(barcodeVal));
  if (!local) local = allLocal.find((a) => String(a.fleet_number || '').toLowerCase().trim() === q);
  if (!local) local = allLocal.find((a) => String(a.name || '').toLowerCase().trim() === name.toLowerCase().trim());

  if (local) {
    // Existing local record — update with live Panda data and return (no confirm)
    const rawStock = fieldValue(pandaMatch, fieldMap.stock_level) || '';
    const payload = {
      name,
      serial_number: serial,
      panda_asset_id: pandaId,
      panda_group_label: matchGroupLabel,
      ...(barcodeVal ? { barcode: barcodeVal } : {}),
      stock_level: detectStockLevel(rawStock),
      sync_status: 'synced',
      last_sync_timestamp: new Date().toISOString(),
    };
    await base44.asServiceRole.entities.SiteAsset.update(local.id, payload);
    const asset = { ...local, ...payload, id: local.id };
    return { asset, source: 'panda', created: false, updated: true, live: true, panda_id: pandaId };
  }

  // --- No local record yet — return needs_confirm so the user can confirm ---
  return {
    needs_confirm: true,
    source: 'panda',
    panda_id: pandaId,
    group_id: matchGroupId,
    group_label: matchGroupLabel,
    barcode: barcodeVal,
    name,
    serial,
    asset_type: detectAssetType(fieldValue(pandaMatch, fieldMap.asset_type) || '', name),
    stock_level: detectStockLevel(fieldValue(pandaMatch, fieldMap.stock_level) || ''),
  };
}

// --- Exported helpers (reused by confirmPandaScanLink) ---

export function fieldValue(obj, key) {
  if (!key) return '';
  let v = obj[key];
  if (v == null && obj.data) v = obj.data[key];
  if (v == null) return '';
  if (typeof v === 'object') return String(v.value ?? v.name ?? v.label ?? '').trim();
  return String(v).trim();
}

export function detectAssetType(rawType, name) {
  const raw = `${rawType} ${name}`.toLowerCase();
  if (raw.includes('rig') || raw.includes('drill') || raw.includes('percuss') || raw.includes('rotary')) return 'rig';
  if (raw.includes('trailer')) return 'trailer';
  if (raw.includes('lift') || raw.includes('shackle') || raw.includes('sling') || raw.includes('chain') || raw.includes('hook') || raw.includes('hoist') || raw.includes('rigging')) return 'lifting';
  if (raw.includes('pat') || raw.includes('appliance') || raw.includes('110v') || raw.includes('transformer') || raw.includes('power tool') || raw.includes('lead') || raw.includes('extension') || raw.includes('rcd') || raw.includes('charger') || raw.includes('kettle') || raw.includes('microwave') || raw.includes('porter')) return 'portable_appliance';
  if (raw.includes('machine') || raw.includes('excav') || raw.includes('digger') || raw.includes('grout') || raw.includes('mixer')) return 'machinery';
  if (raw.includes('vehicle') || raw.includes('van') || raw.includes('truck')) return 'vehicle';
  return 'machinery';
}

export function detectRigType(rawType, name) {
  const raw = `${rawType} ${name}`.toLowerCase();
  if (raw.includes('rotary')) return 'rotary';
  if (raw.includes('cp') || raw.includes('percuss') || raw.includes('cable')) return 'cp';
  return 'n/a';
}

export function detectStockLevel(raw) {
  if (!raw) return 'unknown';
  const r = String(raw).toLowerCase();
  if (r.includes('service') || r.includes('repair') || r.includes('maintenance')) return 'needs_service';
  if (r.includes('out') || r.includes('unavailable') || r.includes('broken') || r.includes('faulty')) return 'out_of_stock';
  if (r.includes('low') || r.includes('limited')) return 'low_stock';
  if (r.includes('in stock') || r.includes('available') || r.includes('good') || r.includes('ok')) return 'in_stock';
  return 'unknown';
}

export function parseRate(raw) {
  if (!raw) return null;
  const num = Number(String(raw).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? null : num;
}

export function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

export function deriveComplianceStatus(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return 'unknown';
  const days = Math.floor((d.getTime() - Date.now()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'compliant';
}

// --- Local fallback — used when Panda is unconfigured, unreachable, or has no match ---
async function localFallback(base44, q, warning) {
  const allLocal = await base44.asServiceRole.entities.SiteAsset.list('-created_date', 500);
  const found = allLocal.find((a) => {
    const sn = String(a.serial_number || '').toLowerCase().trim();
    const nm = String(a.name || '').toLowerCase().trim();
    const pid = String(a.panda_asset_id || '').toLowerCase().trim();
    const bc = String(a.barcode || '').toLowerCase().trim();
    const fn = String(a.fleet_number || '').toLowerCase().trim();
    const equip = String(a.equipment_type || '').toLowerCase().trim();
    const qr = String(a.qr_code || '').toLowerCase().trim();
    const nbc = normalizeBarcode(a.barcode);
    return sn === q || nm === q || pid === q || bc === q || fn === q || qr === q ||
      (sn && sn.includes(q)) || (nm && nm.includes(q)) || (equip && equip.includes(q)) ||
      (bc && bc.includes(q)) || (nbc && nbc === normalizeBarcode(q));
  });
  if (!found) return { source: 'none', warning };
  return { asset: found, source: 'local', live: false, warning };
}