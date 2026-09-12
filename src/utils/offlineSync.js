import { base44 } from '@/api/base44Client';

// ============================================================
// UNIFIED OFFLINE SYNC SERVICE
// Handles both Briefing Signatures and Delivery Logs.
// Replaces the old briefingSync.js with backwards-compatible exports.
// ============================================================

const STORAGE_KEYS = {
  BRIEFING: 'pending_briefing_signatures',
  DELIVERY: 'pending_delivery_logs',
  ACTIONS: 'pending_offline_actions'
};

// --- Generic queue helpers ---

function getQueue(key) {
  return JSON.parse(localStorage.getItem(key) || '[]');
}

function setQueue(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

// --- Data URL to Blob/File conversion ---

function dataURLtoBlob(dataURL) {
  const [meta, base64] = dataURL.split(',');
  const mime = meta.match(/:(.*?);/)[1];
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function dataURLtoFile(dataURL, filename) {
  const blob = dataURLtoBlob(dataURL);
  return new File([blob], filename, { type: blob.type });
}

// Upload a data URL and return the hosted file_url
async function uploadDataURL(dataURL, filename) {
  const file = dataURLtoFile(dataURL, filename);
  const res = await base44.integrations.Core.UploadPublicFile({ file });
  return res.file_url;
}

// Upload multiple comma-separated data URLs and return comma-separated hosted URLs
async function uploadDataURLs(dataUrlsStr, prefix) {
  if (!dataUrlsStr) return '';
  // Split on || — data URLs contain a comma, so ',' would corrupt multi-photo parsing.
  const urls = dataUrlsStr.split('||').filter(Boolean);
  const uploaded = [];
  for (let i = 0; i < urls.length; i++) {
    const hosted = await uploadDataURL(urls[i], `${prefix}_${i}.png`);
    uploaded.push(hosted);
  }
  return uploaded.join(',');
}

// ============================================================
// BRIEFING QUEUE — backwards compatible with old briefingSync.js
// ============================================================

export function saveOfflineBriefing(data) {
  const pending = getQueue(STORAGE_KEYS.BRIEFING);
  pending.push({ ...data, saved_at: new Date().toISOString() });
  setQueue(STORAGE_KEYS.BRIEFING, pending);
}

export function getOfflineBriefingCount() {
  return getQueue(STORAGE_KEYS.BRIEFING).length;
}

export function hasOfflineBriefing(assignmentId) {
  return getQueue(STORAGE_KEYS.BRIEFING).some(p => p.assignment_id === assignmentId);
}

async function syncBriefingQueue() {
  const pending = getQueue(STORAGE_KEYS.BRIEFING);
  if (pending.length === 0) return 0;

  const remaining = [];
  let synced = 0;

  for (const item of pending) {
    try {
      let signatureUrl = item.signature_url || '';
      if (item.signature_data_url) {
        signatureUrl = await uploadDataURL(item.signature_data_url, `signature_${item.assignment_id}.png`);
      }

      await base44.entities.BriefingSignature.create({
        assignment_id: item.assignment_id,
        staff_id: item.staff_id,
        staff_name: item.staff_name,
        job_id: item.job_id,
        assigned_date: item.assigned_date,
        signature_url: signatureUrl,
        signed_at: item.signed_at,
        induction_completed: item.induction_completed || false,
        induction_completed_at: item.induction_completed_at || null,
        document_ids_reviewed: item.document_ids_reviewed || '',
        briefing_duration_minutes: item.briefing_duration_minutes || 0,
        synced_from_offline: true
      });

      await base44.functions.invoke('updateMyAssignment', {
        assignmentId: item.assignment_id,
        updates: { briefing_signed: true, briefing_signed_at: item.signed_at },
      });

      try {
        const briefingStart = item.briefing_start_at || new Date(new Date(item.signed_at).getTime() - (item.briefing_duration_minutes || 0) * 60000).toISOString();
        await base44.functions.invoke('logBriefingAsTask', {
          staff_id: item.staff_id,
          job_id: item.job_id,
          assigned_date: item.assigned_date,
          briefing_start_at: briefingStart,
          briefing_signed_at: item.signed_at,
          travel_depart_home: item.travel_depart_home || null,
          travel_arrive_site: item.travel_arrive_site || null
        });
      } catch (err) {
        console.error('Error logging offline briefing as task:', err);
      }

      synced++;
    } catch (err) {
      console.error('Sync error for briefing item:', err);
      remaining.push(item);
    }
  }

  setQueue(STORAGE_KEYS.BRIEFING, remaining);
  return synced;
}

// ============================================================
// DELIVERY QUEUE
// ============================================================

export function saveOfflineDelivery(data) {
  const pending = getQueue(STORAGE_KEYS.DELIVERY);
  pending.push({ ...data, saved_at: new Date().toISOString() });
  setQueue(STORAGE_KEYS.DELIVERY, pending);
}

export function getOfflineDeliveryCount() {
  return getQueue(STORAGE_KEYS.DELIVERY).length;
}

export function hasOfflineDelivery(deliveryId) {
  return getQueue(STORAGE_KEYS.DELIVERY).some(p => p.delivery_id === deliveryId);
}

export function getOfflineDeliveryIds() {
  return getQueue(STORAGE_KEYS.DELIVERY).map(p => p.delivery_id);
}

async function syncDeliveryQueue() {
  const pending = getQueue(STORAGE_KEYS.DELIVERY);
  if (pending.length === 0) return 0;

  const remaining = [];
  let synced = 0;

  for (const item of pending) {
    // Skip items without a valid delivery ID — they can never sync
    if (!item.delivery_id) {
      console.warn('Skipping delivery queue item with no delivery_id');
      continue;
    }

    try {
      // Verify server status first — if already completed, a previous sync
      // succeeded but didn't clear the queue. Drop it instead of re-uploading.
      let serverRecord = null;
      try {
        serverRecord = await base44.entities.DeliveryLog.get(item.delivery_id);
      } catch (fetchErr) {
        // If we can't even read the record, the network is down — keep in queue
        console.warn('Cannot reach server to verify delivery status:', fetchErr.message);
        remaining.push(item);
        continue;
      }

      if (serverRecord && serverRecord.status === 'completed') {
        // Already synced — just update linked cost items if they weren't set
        const linkedIds = (item.linked_cost_item_ids || serverRecord.linked_cost_item_ids || '').split(',').map(s => s.trim()).filter(Boolean);
        if (linkedIds.length > 0) {
          const newLocation = (item.delivery_type || serverRecord.delivery_type) === 'supplier_collection' ? 'returned' : 'site';
          const updates = linkedIds.map(id => ({
            id,
            current_location: newLocation,
            location_updated_at: new Date().toISOString(),
            ...(newLocation === 'returned' ? {
              hire_status: 'off_hired',
              off_hire_date: new Date().toISOString().split('T')[0]
            } : {})
          }));
          try { await base44.entities.JobCostItem.bulkUpdate(updates); } catch (e) { console.error('Item location sync error:', e); }
        }
        synced++;
        continue; // Skip re-upload — already done
      }

      let signatureUrl = item.signature_url || '';
      if (item.signature_data_url) {
        signatureUrl = await uploadDataURL(item.signature_data_url, `delivery_sig_${item.delivery_id}.png`);
      }

      let photoUrls = item.photo_urls || '';
      if (item.photo_data_urls) {
        photoUrls = await uploadDataURLs(item.photo_data_urls, `delivery_photo_${item.delivery_id}`);
      }

      await base44.entities.DeliveryLog.update(item.delivery_id, {
        status: 'completed',
        completed_at: item.completed_at,
        signature_url: signatureUrl,
        signed_by_name: item.signed_by_name,
        photo_urls: photoUrls,
        gps_coordinates: item.gps_coordinates || '',
        notes: item.notes || '',
        condition_report: item.condition_report || '',
        synced_from_offline: true
      });

      // Auto-update linked cost item locations (same as online completion path)
      const linkedIds = (item.linked_cost_item_ids || '').split(',').map(s => s.trim()).filter(Boolean);
      if (linkedIds.length > 0) {
        const newLocation = item.delivery_type === 'supplier_collection' ? 'returned' : 'site';
        const updates = linkedIds.map(id => ({
          id,
          current_location: newLocation,
          location_updated_at: new Date().toISOString(),
          ...(newLocation === 'returned' ? {
            hire_status: 'off_hired',
            off_hire_date: new Date().toISOString().split('T')[0]
          } : {})
        }));
        try { await base44.entities.JobCostItem.bulkUpdate(updates); } catch (e) { console.error('Item location sync error:', e); }
      }

      synced++;
    } catch (err) {
      console.error('Sync error for delivery item:', err);
      // Keep in queue — will retry on next sync cycle. Never drop data.
      remaining.push(item);
    }
  }

  setQueue(STORAGE_KEYS.DELIVERY, remaining);
  return synced;
}

// ============================================================
// GENERIC ACTION QUEUE — queue any entity create/update while offline
// ============================================================

export function saveOfflineAction({ entity_name, operation, data, entity_id }) {
  const pending = getQueue(STORAGE_KEYS.ACTIONS);
  pending.push({ entity_name, operation, data, entity_id, saved_at: new Date().toISOString() });
  setQueue(STORAGE_KEYS.ACTIONS, pending);
}

export function getOfflineActionCount() {
  return getQueue(STORAGE_KEYS.ACTIONS).length;
}

async function syncActionQueue() {
  const pending = getQueue(STORAGE_KEYS.ACTIONS);
  if (pending.length === 0) return 0;

  const remaining = [];
  let synced = 0;

  for (const item of pending) {
    try {
      const entity = base44.entities[item.entity_name];
      if (!entity) throw new Error(`Entity ${item.entity_name} not found`);

      if (item.operation === 'create') {
        await entity.create(item.data);
      } else if (item.operation === 'update') {
        await entity.update(item.entity_id, item.data);
      } else if (item.operation === 'delete') {
        await entity.delete(item.entity_id);
      } else {
        throw new Error(`Unknown operation: ${item.operation}`);
      }
      synced++;
    } catch (err) {
      console.error(`Sync error for ${item.entity_name} ${item.operation}:`, err);
      remaining.push(item);
    }
  }

  setQueue(STORAGE_KEYS.ACTIONS, remaining);
  return synced;
}

// ============================================================
// UNIFIED SYNC — call this on the 'online' event
// ============================================================

export async function syncAllOfflineData() {
  const [briefings, deliveries, actions] = await Promise.all([
    syncBriefingQueue(),
    syncDeliveryQueue(),
    syncActionQueue()
  ]);
  return { briefings, deliveries, actions, total: briefings + deliveries + actions };
}

// Backwards-compatible alias for existing code
export async function syncPendingBriefings() {
  const result = await syncAllOfflineData();
  return result.briefings;
}

// Total pending count across all queues (for the sync badge)
export function getTotalOfflineCount() {
  return getOfflineBriefingCount() + getOfflineDeliveryCount() + getOfflineActionCount();
}

// ============================================================
// saveOrQueue — try an entity create/update; if the network
// fails, queue it offline for automatic sync on reconnect.
// Used by field forms (driller logs, PAT tests, etc.) so staff
// never lose data to a dead signal.
// Returns the entity record on success, or { _offline: true } when queued.
// ============================================================

export async function saveOrQueue(entityName, operation, data, entityId = null) {
  const entity = base44.entities[entityName];
  if (!entity) throw new Error(`Entity ${entityName} not found`);

  // Fast path: if we know we're offline, skip the doomed network round-trip
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    saveOfflineAction({ entity_name: entityName, operation, data, entity_id: entityId });
    return { _offline: true };
  }

  try {
    if (operation === 'create') return await entity.create(data);
    if (operation === 'update') return await entity.update(entityId, data);
    throw new Error(`Unknown operation: ${operation}`);
  } catch (err) {
    // Network failure (TypeError: Failed to fetch, network error, etc.) — queue
    const isNetworkError = err?.message?.includes('fetch')
      || err?.message?.includes('network')
      || err?.message?.includes('Network')
      || err?.name === 'TypeError'
      || !navigator.onLine;
    if (isNetworkError) {
      saveOfflineAction({ entity_name: entityName, operation, data, entity_id: entityId });
      return { _offline: true };
    }
    // Validation or server error — don't queue, let it surface to the user
    throw err;
  }
}