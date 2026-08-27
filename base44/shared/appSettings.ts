// Shared helper for reading/writing AppSetting config records.
// Used by all third-party integration functions (Stripe, WhatsApp, Xero/Sage, Met Office)
// to avoid duplicating the filter-then-update pattern in every function.
//
// Division-scoped: pass a divisionId to read/write the per-stream config record.
// Omit it (or pass null) to read/write the global/shared record — this preserves
// backward compatibility for existing backend functions that have no division
// context (they continue to use the global config).

export async function getAppSetting(base44, key, divisionId = null) {
  // When a divisionId is given, read that stream's scoped record.
  // When omitted, filter by key only — this preserves the exact legacy
  // behaviour (first record by created_date) so existing backend functions
  // that have no division context keep working unchanged.
  const filter = divisionId ? { key, division_id: divisionId } : { key };
  const recs = await base44.asServiceRole.entities.AppSetting.filter(filter, '-created_date', 1);
  return recs?.[0] || null;
}

export async function getAppSettingValue(base44, key, defaultValue = {}, divisionId = null) {
  const rec = await getAppSetting(base44, key, divisionId);
  return rec?.value || defaultValue;
}

export async function updateAppSettingValue(base44, key, label, value, divisionId = null) {
  const rec = await getAppSetting(base44, key, divisionId);
  if (rec) {
    await base44.asServiceRole.entities.AppSetting.update(rec.id, { value });
  } else {
    await base44.asServiceRole.entities.AppSetting.create({ key, label, value, division_id: divisionId || null });
  }
}