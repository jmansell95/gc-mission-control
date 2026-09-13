/**
 * Navigation context detector — determines whether the current route is in
 * the enterprise context (global, cross-division) or the stream context
 * (inside a specific business stream like Geotechnical).
 *
 * Used by MobileNavShell, UnifiedMobileDrawer, and MoreSheet to render
 * context-appropriate navigation links and prevent context leaking between
 * the enterprise and stream levels.
 */

export function getNavContext(pathname) {
  if (pathname === '/choose-workspace') return 'choice';
  if (pathname.startsWith('/enterprise')) return 'enterprise';
  return 'stream';
}

export function isEnterpriseRoute(pathname) {
  return pathname.startsWith('/enterprise');
}

export function isChoiceRoute(pathname) {
  return pathname === '/choose-workspace';
}