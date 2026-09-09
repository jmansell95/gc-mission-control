/**
 * Recently viewed assets — localStorage-backed list of the last 12 assets
 * opened from the AssetHub. Each entry stores just enough to render a
 * quick-reopen chip (id, name, type, colour) without a DB round-trip.
 */

const STORAGE_KEY = 'gc-recently-viewed-assets';
const MAX_ITEMS = 12;

export function getRecentlyViewedAssets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function trackRecentlyViewedAsset(asset) {
  if (!asset?.id) return;
  try {
    const current = getRecentlyViewedAssets();
    // De-duplicate by id (move to front)
    const filtered = current.filter(a => a.id !== asset.id);
    const entry = {
      id: asset.id,
      name: asset.name || 'Unnamed',
      asset_type: asset.asset_type || null,
      colour: asset.colour || null,
      viewed_at: new Date().toISOString(),
    };
    const next = [entry, ...filtered].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage might be full or blocked — silently ignore
  }
}

export function clearRecentlyViewedAssets() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}