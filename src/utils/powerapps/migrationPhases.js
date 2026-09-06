// Single source of truth for the Power Apps migration phase timeline.
// The roadmap page (src/pages/PowerAppsMigrationRoadmap.jsx) holds the full
// phase objects (steps, icons, colors); this file mirrors just the timeline
// triples so the Claude Build Cheat-Sheet and any other consumer stay in
// sync without importing the roadmap page (which would create a circular
// import via DeveloperPackPage). If you change a phase name or duration in
// the roadmap, update it here too.

export const PHASE_TIMELINE = [
  { n: 0, name: 'Foundation & Environment Setup', weeks: 2, deps: [] },
  { n: 1, name: 'Core Data Schema Migration (Dataverse)', weeks: 3, deps: [0] },
  { n: 2, name: 'Staff & Permission Model', weeks: 2, deps: [1] },
  { n: 3, name: 'Model-Driven Admin Hubs', weeks: 4, deps: [2] },
  { n: 4, name: 'Canvas Field-Crew Mobile App', weeks: 5, deps: [2] },
  { n: 5, name: 'Financial Hub (AFP + CVR)', weeks: 6, deps: [3, 4] },
  { n: 6, name: 'Rota Builder', weeks: 4, deps: [3, 4] },
  { n: 7, name: 'Investigation & Borehole Data', weeks: 4, deps: [3] },
  { n: 8, name: 'Integration Replacement (Power Automate)', weeks: 6, deps: [1, 2] },
  { n: 9, name: 'Dashboards, Reports & Power BI', weeks: 3, deps: [5, 6, 7] },
  { n: 10, name: 'Automation & Notifications', weeks: 2, deps: [8] },
  { n: 11, name: 'Data Cutover & Decommission', weeks: 2, deps: [3, 4, 5, 6, 7, 8, 9, 10] },
];

// Critical-path total duration (weeks) — the longest dependency chain, matching
// the TOTAL_WEEKS figure shown on the roadmap page. Phases run in parallel
// where their dependencies allow, so this is less than the naive sum.
export function totalWeeks() {
  const memo = {};
  const calc = (n) => {
    if (memo[n] != null) return memo[n];
    const phase = PHASE_TIMELINE.find((p) => p.n === n);
    if (!phase) return 0;
    const depEnd = phase.deps.length ? Math.max(...phase.deps.map(calc)) : 0;
    memo[n] = depEnd + phase.weeks;
    return memo[n];
  };
  return Math.max(...PHASE_TIMELINE.map((p) => calc(p.n)));
}