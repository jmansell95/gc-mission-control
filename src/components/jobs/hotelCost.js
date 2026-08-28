/**
 * Shared accommodation cost helpers.
 *
 * Hotel:   total = cost_per_night × room_count × nights
 * Air B&B: per-person total = total_cost ÷ crew_count
 *          per-person day rate = per-person total ÷ nights
 *          booking total = total_cost (the flat amount paid)
 *
 * Existing bookings without a booking_type default to 'hotel' so historical
 * data continues to render with the original formula.
 */

export function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((new Date(checkOut + 'T00:00:00') - new Date(checkIn + 'T00:00:00')) / 86400000));
}

/** The booking type, defaulting to 'hotel' for legacy records. */
export function bookingType(booking) {
  return booking?.booking_type === 'airbnb' ? 'airbnb' : 'hotel';
}

/** Total cost of the entire booking (what was paid). */
export function bookingTotal(booking) {
  if (!booking) return 0;
  const nights = nightsBetween(booking.check_in_date, booking.check_out_date);
  if (bookingType(booking) === 'airbnb') {
    return Number(booking.total_cost) || 0;
  }
  return (Number(booking.cost_per_night) || 0) * (Number(booking.room_count) || 1) * nights;
}

/**
 * Per-person cost for a single crew member on this booking.
 * Hotel:   cost_per_night × room_count × nights ÷ crew_count
 *          (each person's share of the room total)
 * Air B&B: total_cost ÷ crew_count
 */
export function perPersonTotal(booking) {
  if (!booking) return 0;
  const crewCount = Math.max(1, (booking.assigned_staff_ids || []).length);
  if (bookingType(booking) === 'airbnb') {
    return (Number(booking.total_cost) || 0) / crewCount;
  }
  return bookingTotal(booking) / crewCount;
}

/**
 * Per-person day rate — the cost attributed to each staff member per night.
 * Hotel:   perPersonTotal ÷ nights
 * Air B&B: (total_cost ÷ crew_count) ÷ nights
 */
export function perPersonDayRate(booking) {
  if (!booking) return 0;
  const nights = nightsBetween(booking.check_in_date, booking.check_out_date);
  if (nights === 0) return 0;
  return perPersonTotal(booking) / nights;
}

export function fmtGBP(n, opts = {}) {
  const { decimals = 2 } = opts;
  return '£' + Number(n || 0).toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}