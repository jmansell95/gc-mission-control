import React from 'react';
import DrillingActivitySummary from '@/components/jobs/DrillingActivitySummary';
import GroundworksActivitySummary from '@/components/jobs/GroundworksActivitySummary';

const DRILLING_TYPES = ['cp_drilling', 'rotary_drilling'];

// Routes to the discipline-appropriate activity summary based on job type.
// Drilling jobs (CP, Rotary) get borehole/metreage stats; all other
// disciplines (groundworks, enabling, depot) get groundworks-appropriate
// stats (trial pits, installations, grout, daily activity count).
export default function SiteActivitySummary({ job, invLogs, canSeeCosts, fin }) {
  const isDrillingJob = DRILLING_TYPES.includes(job?.job_type);
  if (isDrillingJob) {
    return <DrillingActivitySummary job={job} invLogs={invLogs} canSeeCosts={canSeeCosts} fin={fin} />;
  }
  return <GroundworksActivitySummary job={job} invLogs={invLogs} canSeeCosts={canSeeCosts} fin={fin} />;
}