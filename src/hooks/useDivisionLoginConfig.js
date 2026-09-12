import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

// Map division_type → scene component loader
const SCENE_LOADERS = {
  geotechnical: () => import('@/components/divisionLoading/GeotechScene'),
  land_water: () => import('@/components/divisionLoading/LandWaterScene'),
  infrastructure: () => import('@/components/divisionLoading/InfrastructureScene'),
  road_care: () => import('@/components/divisionLoading/RoadCareScene'),
  structural: () => import('@/components/divisionLoading/StructuralScene'),
  environmental: () => import('@/components/divisionLoading/EnvironmentalScene'),
  surveys: () => import('@/components/divisionLoading/SurveysScene'),
  renewables: () => import('@/components/divisionLoading/RenewablesScene'),
  lde: () => import('@/components/divisionLoading/LabScene'),
  general: () => import('@/components/divisionLoading/GeneralScene'),
};

const SCENE_CACHE = {};

async function loadScene(divisionType) {
  if (SCENE_CACHE[divisionType]) return SCENE_CACHE[divisionType];
  const loader = SCENE_LOADERS[divisionType] || SCENE_LOADERS.general;
  const mod = await loader();
  SCENE_CACHE[divisionType] = mod.default;
  return mod.default;
}

/**
 * useDivisionLoginConfig — loads the division login animation config.
 *
 * 1. Loads all divisions.
 * 2. If an email is provided, finds the division whose email_domains
 *    includes the email's domain.
 * 3. Returns the division's login_animation_config merged with defaults,
 *    plus the division itself (for name, color, logo_url, etc.)
 *
 * Used by the login page to render the correct animated background and
 * by the post-login overlay to play the right branded loading animation.
 */
export function useDivisionLoginConfig(email) {
  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions-for-login'],
    queryFn: () => base44.entities.Division.list('-sort_order', 500),
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    // Try to match by email domain
    let matchedDivision = null;
    if (email && divisions.length > 0) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain) {
        matchedDivision = divisions.find(d =>
          (d.email_domains || []).some(ed => ed.toLowerCase() === domain)
        );
      }
    }
    // Fall back to the first active division, or null
    if (!matchedDivision && divisions.length > 0) {
      matchedDivision = divisions.find(d => d.is_active !== false && d.status === 'active') || divisions[0];
    }

    if (!matchedDivision) return null;

    const cfg = matchedDivision.login_animation_config || {};
    return {
      division: matchedDivision,
      animationType: cfg.animation_type || 'themed_scene',
      primaryColor: cfg.primary_color || matchedDivision.color || '#2E5A1A',
      secondaryColor: cfg.secondary_color || '#1c4a12',
      accentColor: cfg.accent_color || '#8DC63F',
      logoUrl: cfg.logo_url || matchedDivision.logo_url || null,
      welcomeText: cfg.welcome_text || `Welcome to ${matchedDivision.name}`,
      tagline: cfg.tagline || matchedDivision.tagline || '',
      durationMs: cfg.duration_ms || 2500,
      transitionStyle: cfg.transition_style || 'fade',
      showProgressBar: cfg.show_progress_bar !== false,
    };
  }, [email, divisions]);
}

export { loadScene };