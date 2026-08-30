import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * confirmHomeLocation — learns the staff member's home location from GPS.
 *
 * Called by the ArrivalPromptBanner when the crew member taps "I'm home"
 * after leaving site. Captures their current GPS position and either:
 *   - Establishes a new home candidate (confidence = 1) if none exists
 *   - Increments confidence if within 200m of existing home
 *   - Replaces candidate if >200m away AND confidence < 3 (may have moved)
 *   - Ignores if confidence >= 3 and >200m away (one-off visit)
 *
 * Once confidence >= 3, the home location is "confirmed" and used by the
 * zero-touch timesheet engine for automatic travel-from-site detection.
 */
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Auth check
    let user: any = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { lat, lng } = body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return Response.json({ error: 'lat and lng are required' }, { status: 400 });
    }

    // Find the staff record for this user
    const staffRes = await base44.asServiceRole.entities.Staff.filter({
      user_id: user.id,
    });
    const staff = staffRes[0];
    if (!staff) {
      return Response.json({ error: 'Staff record not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const existingLat = staff.home_lat;
    const existingLng = staff.home_lng;
    const existingConfidence = staff.home_geofence_confidence || 0;

    let newLat = lat;
    let newLng = lng;
    let newConfidence = 1;
    let status = 'new_candidate';

    if (existingLat != null && existingLng != null) {
      const distance = haversineMetres(lat, lng, existingLat, existingLng);

      if (distance <= 200) {
        // Within 200m of existing home — corroborate it
        newLat = existingLat;
        newLng = existingLng;
        newConfidence = existingConfidence + 1;
        status = newConfidence >= 3 ? 'confirmed' : 'corroborated';
      } else if (existingConfidence < 3) {
        // Not yet confirmed and somewhere new — replace the candidate
        newConfidence = 1;
        status = 'replaced_candidate';
      } else {
        // Already confirmed and >200m away — ignore (one-off visit)
        return Response.json({
          success: true,
          status: 'ignored_outlier',
          home_lat: existingLat,
          home_lng: existingLng,
          home_geofence_confidence: existingConfidence,
          distance_from_home: Math.round(distance),
        });
      }
    }

    await base44.asServiceRole.entities.Staff.update(staff.id, {
      home_lat: newLat,
      home_lng: newLng,
      home_geofence_confidence: newConfidence,
      home_learned_at: now,
    });

    return Response.json({
      success: true,
      status,
      home_lat: newLat,
      home_lng: newLng,
      home_geofence_confidence: newConfidence,
      is_confirmed: newConfidence >= 3,
    });
  } catch (error) {
    const msg = (error && typeof error === 'object' && error.message) ? error.message : 'Internal server error';
    return Response.json({ error: msg }, { status: 500 });
  }
}