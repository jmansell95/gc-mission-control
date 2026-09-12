/**
 * Enterprise Settings Configuration — frontend copy of the setting field
 * definitions used by the Global Settings UI and the per-stream override UI.
 *
 * The server-side resolver lives in base44/shared/enterpriseSettings.ts.
 * This file holds only the constant definitions (no server logic) so the
 * frontend can render the settings forms without a cross-boundary import.
 */

export const ENTERPRISE_SETTING_FIELDS = [
  // Branding
  { key: 'enterprise_name', label: 'Enterprise Name', category: 'Branding', type: 'text', description: 'The legal/trading name shown across the app.' },
  { key: 'enterprise_logo_url', label: 'Enterprise Logo URL', category: 'Branding', type: 'text', description: 'Logo shown on the login page and enterprise dashboard.' },
  { key: 'primary_color', label: 'Primary Brand Colour', category: 'Branding', type: 'color', description: 'Default --primary CSS variable for all streams.' },
  { key: 'secondary_color', label: 'Secondary Brand Colour', category: 'Branding', type: 'color', description: 'Default gradient end colour.' },
  { key: 'accent_color', label: 'Accent Colour', category: 'Branding', type: 'color', description: 'Default --accent CSS variable.' },
  // Financial
  { key: 'default_vat_rate', label: 'Default VAT Rate (%)', category: 'Financial', type: 'number', description: 'UK standard is 20.' },
  { key: 'default_markup_percentage', label: 'Default Markup (%)', category: 'Financial', type: 'number', description: 'Applied to jobs when assigned.' },
  // Field Operations
  { key: 'require_briefing_signature', label: 'Require Briefing Signature', category: 'Field Operations', type: 'boolean', description: 'Staff must sign the job briefing before starting work.' },
  { key: 'allow_timesheet_edit', label: 'Allow Timesheet Edit', category: 'Field Operations', type: 'boolean', description: 'Field staff can edit their own timesheets.' },
  // Weather
  { key: 'weather_temp_min', label: 'Min Working Temp (°C)', category: 'Weather', type: 'number', description: 'Below this, the weather card flags do not work.' },
  { key: 'weather_temp_max', label: 'Max Working Temp (°C)', category: 'Weather', type: 'number', description: 'Above this, the weather card flags do not work.' },
  { key: 'weather_wind_max_mph', label: 'Max Wind Gust (mph)', category: 'Weather', type: 'number', description: 'Above this, the weather card flags do not work.' },
  { key: 'weather_rain_max_mm', label: 'Max Rainfall (mm)', category: 'Weather', type: 'number', description: 'Above this, the weather card flags do not work.' },
  { key: 'weather_lightning_block', label: 'Block Work for Lightning', category: 'Weather', type: 'boolean', description: 'Thunderstorms block work due to lightning risk.' },
  // Geofence
  { key: 'geofence_default_radius_m', label: 'Geofence Radius (m)', category: 'Geofence', type: 'number', description: 'Default radius for site arrival/departure detection.' },
  // Login
  { key: 'default_login_animation_type', label: 'Login Animation Type', category: 'Login', type: 'text', description: 'Default animation style for streams without their own.' },
  { key: 'default_login_welcome_text', label: 'Login Welcome Text', category: 'Login', type: 'text', description: 'Shown on the login page when no stream is selected.' },
  { key: 'default_login_tagline', label: 'Login Tagline', category: 'Login', type: 'text', description: 'Shown below the welcome text.' },
  { key: 'default_post_login_duration_ms', label: 'Post-Login Duration (ms)', category: 'Login', type: 'number', description: 'How long the loading animation plays.' },
  { key: 'email_domain_auto_detect', label: 'Email Domain Auto-Detect', category: 'Login', type: 'boolean', description: 'Auto-select stream from email domain on the login page.' },
  // System
  { key: 'enable_global_search', label: 'Global Search', category: 'System', type: 'boolean', description: 'Enterprise-wide search in the sidebar.' },
  { key: 'enable_org_tree_navigator', label: 'Org Tree Navigator', category: 'System', type: 'boolean', description: 'Show admins the org tree for quick navigation.' },
  { key: 'audit_log_enabled', label: 'Audit Log', category: 'System', type: 'boolean', description: 'Record every settings change in the audit log.' },
];

export const SETTING_CATEGORIES = ['Branding', 'Financial', 'Field Operations', 'Weather', 'Geofence', 'Login', 'System'];