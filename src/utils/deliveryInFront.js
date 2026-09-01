/**
 * Derive the "delivery-in-front" state for a staff member on a given date.
 *
 * A delivery is "in front" when the driver has at least one non-completed
 * DeliveryLog on that date AND a yard_depot RotaAssignment on the same date.
 * Mirrors the bank-holiday pattern: the delivery surfaces as the primary
 * item while the depot shift is kept (collapsed to a badge) behind it.
 * Once all deliveries are completed, the state clears and depot duty
 * resumes as the primary shift — no manager action required.
 */
export function getDeliveryInFrontState({ deliveries, assignments, staffId, dateStr }) {
  const activeDeliveries = (deliveries || []).filter(
    (d) => d.driver_staff_id === staffId && d.scheduled_date === dateStr && d.status !== 'completed'
  );
  const hasDepotDuty = (assignments || []).some(
    (a) => a.staff_id === staffId && a.assigned_date === dateStr && a.assignment_type === 'yard_depot'
  );
  const deliveryInFront = activeDeliveries.length > 0 && hasDepotDuty;
  return { activeDeliveries, hasDepotDuty, deliveryInFront };
}