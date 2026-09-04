// Central registry of every hub, page, and integration-dependent feature in the platform.
// Each feature has:
//   id          — unique key (dotted notation for sub-features: 'hub.feature')
//   label       — display name
//   type        — 'hub' (top-level nav item) or 'feature' (tab/panel within a hub)
//   hub         — parent hub id (for features)
//   icon        — lucide icon name (string, resolved in UI)
//   dependsOn   — integration key this feature needs to show live data (null = none)
//   defaultState— 'active' | 'coming_soon' | 'locked'
//
// The ReadinessManager settings page reads this registry and lets admins toggle
// every feature's state. The useReadiness hook + ReadinessGate component consume
// the stored state to gate content across the app.

import {
  Grid3x3, Briefcase, Calendar, Users, Truck, Boxes, Car,
  FlaskConical, ShieldCheck, PoundSterling, Settings,
  Satellite, Radio, Database, ShieldAlert, FileUp, Cloud,
  MapPin, MessageCircle, FileSpreadsheet, CreditCard, Building2,
  Webhook, Bell, Landmark, Link2, FileBarChart, TrendingUp,
} from 'lucide-react';

export const INTEGRATIONS = {
  geotab:         { label: 'Geotab GPS',          icon: Satellite,   configEntity: null,                checkKey: 'geotab' },
  holman:         { label: 'Holman Fleet',        icon: Radio,       configEntity: null,                checkKey: 'holman' },
  assetpanda:     { label: 'Asset Panda',         icon: Database,    configEntity: 'AssetPandaConfig',  checkKey: 'assetpanda' },
  bobhr:          { label: 'Bob HR',              icon: Users,       configEntity: null,                checkKey: 'bobhr' },
  concur:         { label: 'SAP Concur',           icon: Landmark,    configEntity: null,                checkKey: 'concur' },
  safetyculture:  { label: 'SafetyCulture',       icon: ShieldAlert, configEntity: 'SafetyCultureConfig', checkKey: 'safetyculture' },
  keylogbook:     { label: 'KeyLogBook AGS',      icon: FileUp,      configEntity: 'KeyLogBookConfig', checkKey: 'keylogbook' },
  openground:     { label: 'OpenGround',          icon: Database,    configEntity: null,                checkKey: 'openground' },
  cis:            { label: 'HMRC CIS',            icon: ShieldCheck, configEntity: null,                checkKey: 'cis' },
  metoffice:      { label: 'Met Office',          icon: Cloud,       configEntity: null,                checkKey: 'metoffice' },
  googlemaps:     { label: 'Google Maps',          icon: MapPin,      configEntity: null,                checkKey: 'googlemaps' },
  whatsapp:       { label: 'WhatsApp',            icon: MessageCircle, configEntity: null,             checkKey: 'whatsapp' },
  accounting:     { label: 'Xero / Sage',          icon: FileSpreadsheet, configEntity: null,           checkKey: 'accounting' },
  stripe:         { label: 'Stripe Payments',     icon: CreditCard,  configEntity: null,                checkKey: 'stripe' },
  m365:           { label: 'Microsoft 365',       icon: Building2,   configEntity: null,                checkKey: 'm365' },
  zapier:         { label: 'Zapier / Make',       icon: Webhook,     configEntity: null,                checkKey: 'zapier' },
  push:           { label: 'Push Notifications',  icon: Bell,        configEntity: null,                checkKey: 'push' },
};

export const FEATURE_REGISTRY = {
  // === Top-level hubs ===
  dashboard:      { label: 'Dashboard',        type: 'hub', icon: Grid3x3,      dependsOn: null,           defaultState: 'active' },
  jobs:           { label: 'Jobs Hub',         type: 'hub', icon: Briefcase,   dependsOn: null,           defaultState: 'active' },
  scheduling:     { label: 'Scheduling Hub',   type: 'hub', icon: Calendar,    dependsOn: null,           defaultState: 'active' },
  staff:          { label: 'Staff Hub',        type: 'hub', icon: Users,       dependsOn: null,           defaultState: 'active' },
  logistics:      { label: 'Deliveries Hub',   type: 'hub', icon: Truck,       dependsOn: null,           defaultState: 'active' },
  assets:         { label: 'Assets Hub',       type: 'hub', icon: Boxes,       dependsOn: null,           defaultState: 'active' },
  fleet:          { label: 'Tracking',         type: 'hub', icon: Car,         dependsOn: null,           defaultState: 'active' },
  investigation:  { label: 'Investigation Hub',type: 'hub', icon: FlaskConical,dependsOn: null,           defaultState: 'active' },
  compliance:     { label: 'Compliance Hub',   type: 'hub', icon: ShieldCheck, dependsOn: null,           defaultState: 'active' },
  billing:        { label: 'Financial Hub',   type: 'hub', icon: PoundSterling,dependsOn: null,          defaultState: 'active' },
  performance:    { label: 'Performance Hub',  type: 'hub', icon: TrendingUp,  dependsOn: null,           defaultState: 'active' },
  settings:       { label: 'Settings',         type: 'hub', icon: Settings,    dependsOn: null,           defaultState: 'active' },
  reports:        { label: 'Reports Hub',       type: 'hub', icon: FileBarChart, dependsOn: null,           defaultState: 'active' },

  // === Compliance Hub features ===
  'compliance.safetyculture': { label: 'SafetyCulture Audits', type: 'feature', hub: 'compliance', icon: ShieldAlert, dependsOn: 'safetyculture', defaultState: 'coming_soon' },
  'compliance.cis':            { label: 'CIS Verification',     type: 'feature', hub: 'compliance', icon: ShieldCheck, dependsOn: 'cis',            defaultState: 'coming_soon' },

  // === Fleet Hub features ===
  'fleet.geotab': { label: 'Geotab GPS Live Map',  type: 'feature', hub: 'fleet', icon: Satellite, dependsOn: 'geotab',  defaultState: 'coming_soon' },
  'fleet.holman': { label: 'Holman Fleet Sync',   type: 'feature', hub: 'fleet', icon: Radio,    dependsOn: 'holman',  defaultState: 'coming_soon' },

  // === Financial Hub features ===
  'billing.accounting': { label: 'Xero / Sage Sync',   type: 'feature', hub: 'billing', icon: FileSpreadsheet, dependsOn: 'accounting', defaultState: 'coming_soon' },
  'billing.stripe':     { label: 'Stripe Payments',    type: 'feature', hub: 'billing', icon: CreditCard,      dependsOn: 'stripe',     defaultState: 'coming_soon' },
  'billing.concur':     { label: 'SAP Concur Sync',    type: 'feature', hub: 'billing', icon: Landmark,        dependsOn: 'concur',      defaultState: 'coming_soon' },

  // === Staff Hub features ===
  'staff.bobhr':    { label: 'Bob HR Sync',       type: 'feature', hub: 'staff', icon: Users,         dependsOn: 'bobhr',    defaultState: 'coming_soon' },
  'staff.whatsapp': { label: 'WhatsApp Alerts',   type: 'feature', hub: 'staff', icon: MessageCircle, dependsOn: 'whatsapp', defaultState: 'coming_soon' },

  // === Assets Hub features ===
  'assets.assetpanda': { label: 'Asset Panda Sync', type: 'feature', hub: 'assets', icon: Database, dependsOn: 'assetpanda', defaultState: 'coming_soon' },

  // === Investigation Hub features ===
  'investigation.keylogbook': { label: 'KeyLogBook AGS Sync', type: 'feature', hub: 'investigation', icon: FileUp,   dependsOn: 'keylogbook', defaultState: 'coming_soon' },
  'investigation.openground': { label: 'OpenGround Sync',     type: 'feature', hub: 'investigation', icon: Database, dependsOn: 'openground', defaultState: 'coming_soon' },

  // === Scheduling Hub features ===
  'scheduling.metoffice': { label: 'Met Office Weather', type: 'feature', hub: 'scheduling', icon: Cloud, dependsOn: 'metoffice', defaultState: 'coming_soon' },

  // === Deliveries Hub features ===
  'logistics.googlemaps': { label: 'Google Maps Routes', type: 'feature', hub: 'logistics', icon: MapPin, dependsOn: 'googlemaps', defaultState: 'coming_soon' },

  // === Settings Hub features ===
  'settings.m365':   { label: 'Microsoft 365',     type: 'feature', hub: 'settings', icon: Building2, dependsOn: 'm365',   defaultState: 'coming_soon' },
  'settings.zapier': { label: 'Zapier / Make',     type: 'feature', hub: 'settings', icon: Webhook,   dependsOn: 'zapier', defaultState: 'coming_soon' },
  'settings.push':   { label: 'Push Notifications', type: 'feature', hub: 'settings', icon: Bell,      dependsOn: 'push',   defaultState: 'coming_soon' },
};

// Ordered list of hub IDs for display
export const HUB_ORDER = [
  'dashboard', 'jobs', 'scheduling', 'staff', 'logistics',
  'assets', 'fleet', 'investigation', 'compliance', 'billing', 'performance', 'reports', 'settings',
];

// Get all features that belong to a given hub
export function getFeaturesForHub(hubId) {
  return Object.entries(FEATURE_REGISTRY)
    .filter(([, f]) => f.type === 'feature' && f.hub === hubId)
    .map(([id, f]) => ({ id, ...f }));
}

// Get all features that depend on a given integration
export function getFeaturesForIntegration(integrationKey) {
  return Object.entries(FEATURE_REGISTRY)
    .filter(([, f]) => f.dependsOn === integrationKey)
    .map(([id, f]) => ({ id, ...f }));
}