import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';

/**
 * DivisionBrandingApplier — reads the current user's division branding_config
 * and applies the CSS custom properties so every bg-primary, text-primary,
 * border-primary surface in the app uses the division's accent colour.
 *
 * Placed high in the app tree (AuthenticatedApp) so it runs on every page.
 * When the user switches divisions, the branding updates automatically.
 *
 * Only applies overrides when branding_config is set — otherwise the global
 * defaults from index.css remain in effect.
 */
export default function DivisionBrandingApplier() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  const { data: division } = useQuery({
    queryKey: ['my-division-branding', profile?.division_id],
    queryFn: async () => {
      if (!profile?.division_id) return null;
      const divisions = await base44.entities.Division.filter({ id: profile.division_id });
      return divisions[0] || null;
    },
    enabled: !!profile?.division_id,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    const branding = division?.branding_config;
    if (!branding) return;

    const root = document.documentElement;
    const overrides = {};

    if (branding.accent_color) {
      // Convert hex to HSL channels for the CSS variable
      const hsl = hexToHslChannels(branding.accent_color);
      if (hsl) overrides['--primary'] = hsl;
    }
    if (branding.accent_foreground_color) {
      const hsl = hexToHslChannels(branding.accent_foreground_color);
      if (hsl) overrides['--primary-foreground'] = hsl;
    }
    if (branding.secondary_accent_color) {
      const hsl = hexToHslChannels(branding.secondary_accent_color);
      if (hsl) overrides['--accent'] = hsl;
    }

    // Apply overrides
    Object.entries(overrides).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    return () => {
      // Clean up overrides when the component unmounts or division changes
      Object.keys(overrides).forEach(key => {
        root.style.removeProperty(key);
      });
    };
  }, [division]);

  return null;
}

/**
 * Convert a hex colour (#RRGGBB) to HSL channels string ("H S% L%")
 * compatible with the CSS variables in index.css.
 */
function hexToHslChannels(hex) {
  if (!hex || !hex.startsWith('#')) return null;
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return null;

  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}