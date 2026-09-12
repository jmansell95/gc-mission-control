import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ParticleField from './ParticleField';
import FlowingLines from './FlowingLines';
import GradientMesh from './GradientMesh';
import { loadScene } from '@/hooks/useDivisionLoginConfig';

/**
 * DivisionLoginAnimation — renders the configured animation type as a
 * full-bleed animated background. Used on the login page (behind the card)
 * and inside the post-login overlay.
 *
 * Props:
 *   config — the object returned by useDivisionLoginConfig (animationType,
 *            primaryColor, secondaryColor, accentColor, division)
 *   fullScreen — when true, renders larger/more dramatic for the post-login overlay
 */
export default function DivisionLoginAnimation({ config, fullScreen = false }) {
  const [SceneComponent, setSceneComponent] = useState(null);

  useEffect(() => {
    if (config?.animationType === 'themed_scene' && config?.division?.division_type) {
      let cancelled = false;
      loadScene(config.division.division_type).then(Comp => {
        if (!cancelled) setSceneComponent(() => Comp);
      });
      return () => { cancelled = true; };
    }
    setSceneComponent(null);
  }, [config?.animationType, config?.division?.division_type]);

  if (!config) return null;

  const { animationType, primaryColor, secondaryColor, accentColor, division } = config;

  // Base background — always present
  const baseGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor || primaryColor} 100%)`;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: baseGradient }}>
      {/* Animation layer */}
      {animationType === 'themed_scene' && SceneComponent && (
        <div className={`absolute inset-0 flex items-center justify-center ${fullScreen ? 'opacity-30' : 'opacity-20'}`}>
          <div style={{ width: fullScreen ? '60vw' : '40vw', maxWidth: 500, maxHeight: '60vh' }}>
            <SceneComponent color={accentColor} />
          </div>
        </div>
      )}
      {animationType === 'particle_field' && (
        <ParticleField
          primaryColor={primaryColor}
          accentColor={accentColor}
          count={fullScreen ? 60 : 40}
        />
      )}
      {animationType === 'flowing_lines' && (
        <FlowingLines
          primaryColor={primaryColor}
          accentColor={accentColor}
          count={fullScreen ? 16 : 12}
        />
      )}
      {animationType === 'gradient_mesh' && (
        <GradientMesh
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          accentColor={accentColor}
        />
      )}
      {animationType === 'none' && null}

      {/* Subtle vignette for text readability */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)' }}
      />
    </div>
  );
}