export const SITE_EARLY_ACCESS_TIME = '06:00';
export const SITE_OPEN_TIME = '08:00';
export const SITE_CLOSE_TIME = '17:00';
export const SITE_SUBMISSION_CLOSE_TIME = '22:00';
export const CHECK_IN_DEADLINE = '08:15';

export function getCurrentTimeStr() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function isWithinSiteHours() {
  const now = getCurrentTimeStr();
  return now >= SITE_OPEN_TIME && now <= SITE_CLOSE_TIME;
}

export function isBeforeSiteOpen() {
  const now = getCurrentTimeStr();
  return now >= SITE_EARLY_ACCESS_TIME && now < SITE_OPEN_TIME;
}

/**
 * After site close (17:00) but before submission close (22:00) —
 * field staff can submit end-of-day info (travel home, expenses, timesheet)
 * but cannot start new shifts or check in.
 */
export function isWithinSubmissionWindow() {
  const now = getCurrentTimeStr();
  return now > SITE_CLOSE_TIME && now <= SITE_SUBMISSION_CLOSE_TIME;
}

/**
 * After submission close (22:00) and before early access (06:00) —
 * the app is fully locked.
 */
export function isAfterSubmissionClose() {
  const now = getCurrentTimeStr();
  return now > SITE_SUBMISSION_CLOSE_TIME || now < SITE_EARLY_ACCESS_TIME;
}

export function isCheckInDeadlinePassed() {
  return getCurrentTimeStr() > CHECK_IN_DEADLINE;
}