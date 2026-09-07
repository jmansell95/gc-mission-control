// Help + first-run content for the Command Centre (Admin Dashboard).
// Kept out of the page component so the copy can be edited without touching layout.
export const DASHBOARD_HELP_TOPICS = [
  {
    title: 'Command Centre',
    summary: 'Your live operations overview for the whole business stream.',
    body: 'The widget grid is fully customisable — drag, resize or hide any block and the layout is saved to your profile. Every block loads its own data, so hiding one you never use makes the page faster.',
  },
  {
    title: 'All Projects vs one project',
    summary: 'The project selector switches the whole page into focus mode.',
    body: 'With **All Projects** selected you see the greeting, KPI strip, quick actions and the widget grid. Pick a single project and the page narrows to that project — the header shows its status, location and budget.',
  },
  {
    title: 'Drilling into detail',
    summary: 'Open a project without losing your place.',
    body: 'Click any project card for the quick drawer (a fast summary), or choose **Open full details** to go to the full project record with all its tabs.',
  },
  {
    title: 'Quick actions',
    summary: 'Start the most common jobs in one tap.',
    body: 'The action bar jumps straight to creating a project, adding staff, raising an invoice, logging an incident, booking a delivery or adding an asset.',
  },
];

export const DASHBOARD_ONBOARDING = {
  title: 'This is your Command Centre',
  description: 'A live overview of projects, crews, rigs and exceptions — arranged the way you want it.',
  steps: [
    'Use the project selector to focus on one project',
    'Drag or hide widgets to build your own layout',
    'Tap a project card to drill into the detail',
  ],
};