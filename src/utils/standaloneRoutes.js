// Sections that have their own dedicated sidebar-accessible pages.
// When a nav item or dashboard tile targets one of these, navigate
// directly to the route instead of going through the AdminDashboard
// section state (which causes a blank flash before the redirect fires).
//
// Consolidated sidebar — former standalone pages (Contacts, Timesheets,
// Audit, Price List, Reports, Import, Automations, Vehicles) are now
// tabs inside their parent page rather than separate routes.
export const STANDALONE_ROUTES = {
  staff: '/staff',
  compliance: '/compliance',
  billing: '/billing',
  assets: '/assets',
  fleet: '/fleet',
  reports: '/reports',
};

// Reverse map: route path → section id (for sidebar active-state highlight).
export const ROUTE_TO_SECTION = Object.fromEntries(
  Object.entries(STANDALONE_ROUTES).map(([section, route]) => [route, section])
);

export function isStandaloneSection(section) {
  return Object.prototype.hasOwnProperty.call(STANDALONE_ROUTES, section);
}