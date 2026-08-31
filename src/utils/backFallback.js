/**
 * Context-aware back-button fallback resolver.
 *
 * Returns the appropriate "home" route for a given pathname so that
 * back buttons always land the user somewhere sensible when there's no
 * browser history (fresh load / deep link):
 *
 *   - Field-facing pages → /staff-schedule  (field crew home)
 *   - Enterprise pages   → /enterprise      (Ground Control dashboard)
 *   - Everything else    → /admin            (business stream dashboard)
 */
const FIELD_PREFIXES = [
  '/staff-schedule',
  '/staff-profile',
  '/deliveries',
  '/scanner',
  '/m/',
];

const ENTERPRISE_PREFIXES = [
  '/enterprise',
];

export function resolveBackFallback(pathname = typeof window !== 'undefined' ? window.location.pathname : '/') {
  if (FIELD_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return '/staff-schedule';
  }
  if (ENTERPRISE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return '/enterprise';
  }
  return '/admin';
}