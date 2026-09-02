// ============================================================
// Investigation Hub ↔ Job Site Activity deep-link helpers
// ============================================================
// Bidirectional navigation between the per-job Site Activity tab and the
// cross-job Investigation Hub. Both surfaces live inside the AdminDashboard
// single-page shell (section state, not URL routes), so we pass the pending
// deep-link target through sessionStorage. The destination surface reads
// and clears it on mount, then pre-filters / pre-selects the target log.
//
// Flow A — Hub → Job Site Activity:
//   setSiteActivityDeepLink({ jobId, jobName, logId })
//   then dispatch window event 'app-navigate' { section: 'job-detail', job: {...}, jobTab: 'activity' }
//   JobDetailTabs reads getSiteActivityDeepLink() on mount → switches to the
//   Activity Logs sub-tab and pre-selects the log.
//
// Flow B — Site Activity → Hub:
//   setInvestigationHubDeepLink({ jobId, logId })
//   then dispatch window event 'app-navigate' { section: 'investigation' }
//   InvestigationHub reads getInvestigationHubDeepLink() on mount → pre-filters
//   to the job and opens the log drawer.

const SITE_ACTIVITY_KEY = 'gc_site_activity_deeplink';
const HUB_KEY = 'gc_investigation_hub_deeplink';

export function setSiteActivityDeepLink(target) {
  if (!target) return;
  try { sessionStorage.setItem(SITE_ACTIVITY_KEY, JSON.stringify(target)); } catch (e) { /* ignore */ }
}

export function getSiteActivityDeepLink() {
  try {
    const raw = sessionStorage.getItem(SITE_ACTIVITY_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(SITE_ACTIVITY_KEY);
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export function setInvestigationHubDeepLink(target) {
  if (!target) return;
  try { sessionStorage.setItem(HUB_KEY, JSON.stringify(target)); } catch (e) { /* ignore */ }
}

export function getInvestigationHubDeepLink() {
  try {
    const raw = sessionStorage.getItem(HUB_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(HUB_KEY);
    return JSON.parse(raw);
  } catch (e) { return null; }
}

// Dispatch a navigation event that the AdminDashboard listens for.
// Extends the existing 'app-navigate' contract with two optional fields:
//   jobTab  — the JobDetailTabs initialTab to land on (e.g. 'activity')
//   siteActivityLogId — pre-selected log id on the Site Activity tab
// The AdminDashboard handler maps jobTab → jobInitialTab so JobDetail lands
// on the right tab.
export function navigateToJobSiteActivity(job, logId) {
  if (job) {
    // Stash the log id for JobDetailTabs to pick up on mount
    setSiteActivityDeepLink({ jobId: job.id, jobName: job.name, logId });
  }
  window.dispatchEvent(new CustomEvent('app-navigate', {
    detail: { section: 'job-detail', job, jobTab: 'activity' }
  }));
}

export function navigateToInvestigationHub(jobId, logId) {
  setInvestigationHubDeepLink({ jobId, logId });
  window.dispatchEvent(new CustomEvent('app-navigate', {
    detail: { section: 'investigation' }
  }));
}