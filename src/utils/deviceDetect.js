/**
 * detectDeviceType — determines whether the current device is a phone, tablet,
 * or desktop based on user agent and viewport width.
 *
 * Used by the GPS tracking hook to stamp device_type on every StaffLocationLog
 * so the Tracking Hub can show what kind of device each crew member is carrying.
 *
 * Detection order:
 *   1. User agent patterns (iPad, Android tablet, iPhone, Android phone)
 *   2. Viewport width fallback (<768 = phone, <1024 = tablet, else desktop)
 */
export function detectDeviceType() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const hasTouch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;

  // iPadOS 13+ reports as Mac desktop but has touch
  const isIPad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && hasTouch);
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
  const isPhone = /iPhone|iPod/i.test(ua) || (/Android/i.test(ua) && /Mobile/i.test(ua));

  if (isIPad || isAndroidTablet) return 'tablet';
  if (isPhone) return 'phone';

  // Fallback to viewport width
  const w = window.innerWidth;
  if (w < 768) return 'phone';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

/** Short label for display */
export function deviceTypeLabel(type) {
  switch (type) {
    case 'phone': return 'Phone';
    case 'tablet': return 'Tablet';
    case 'desktop': return 'Desktop';
    default: return 'Unknown';
  }
}