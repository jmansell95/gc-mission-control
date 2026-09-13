import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import ParticleField from '@/components/login/ParticleField';
import FlowingLines from '@/components/login/FlowingLines';
import GradientMesh from '@/components/login/GradientMesh';
import { loadScene } from '@/hooks/useDivisionLoginConfig';

/**
 * DivisionLoadingScreen — full-screen animated splash shown when entering
 * ANY division (switching business streams) and as a preview from the
 * division editor/wizard.
 *
 * Reads the division's login_animation_config to determine:
 *  - animation_type: themed_scene | particle_field | flowing_lines |
 *    gradient_mesh | custom_media | none
 *  - primary/secondary/accent colours
 *  - welcome text, tagline, logo URL
 *  - duration (ms), transition style, progress bar visibility
 *  - custom_media_url + custom_media_type (image or video)
 *
 * Falls back to the division's color/name/tagline when config is not set,
 * and to the division_type's themed scene when animation_type is themed_scene.
 */
export default function DivisionLoadingScreen({ division, onComplete, duration }) {
  const [SceneComponent, setSceneComponent] = useState(null);
  const [progress, setProgress] = useState(0);

  const cfg = division?.login_animation_config || {};
  const animationType = cfg.animation_type || 'themed_scene';
  const primaryColor = cfg.primary_color || division?.color || '#2E5A1A';
  const secondaryColor = cfg.secondary_color || '#1c4a12';
  const accentColor = cfg.accent_color || '#8DC63F';
  const welcomeText = cfg.welcome_text || `${division?.name || 'Business Stream'} is loading`;
  const tagline = cfg.tagline || division?.tagline || division?.description || '';
  const logoUrl = cfg.logo_url || division?.logo_url || null;
  const actualDuration = duration || cfg.duration_ms || 3600;
  const showProgressBar = cfg.show_progress_bar !== false;
  const customMediaUrl = cfg.custom_media_url || null;
  const customMediaType = cfg.custom_media_type || 'image';

  // Load scene component for themed_scene
  useEffect(() => {
    if (animationType === 'themed_scene' && division?.division_type) {
      let cancelled = false;
      loadScene(division.division_type).then(Comp => {
        if (!cancelled) setSceneComponent(() => Comp);
      });
      return () => { cancelled = true; };
    }
    setSceneComponent(null);
  }, [animationType, division?.division_type]);

  // Progress bar + completion
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / actualDuration) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 30);
    return () => clearInterval(interval);
  }, [actualDuration, onComplete]);

  const baseGradient = `linear-gradient(155deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: baseGradient }}
    >
      {/* Animation layer */}
      {animationType === 'themed_scene' && SceneComponent && (
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <div style={{ width: '60vw', maxWidth: 500, maxHeight: '60vh' }}>
            <SceneComponent color={accentColor} />
          </div>
        </div>
      )}
      {animationType === 'particle_field' && (
        <ParticleField primaryColor={primaryColor} accentColor={accentColor} count={60} />
      )}
      {animationType === 'flowing_lines' && (
        <FlowingLines primaryColor={primaryColor} accentColor={accentColor} count={16} />
      )}
      {animationType === 'gradient_mesh' && (
        <GradientMesh primaryColor={primaryColor} secondaryColor={secondaryColor} accentColor={accentColor} />
      )}
      {animationType === 'custom_media' && customMediaUrl && (
        customMediaType === 'video' ? (
          <video
            src={customMediaUrl}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <img
            src={customMediaUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )
      )}

      {/* Vignette for text readability */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)' }}
      />

      {/* Content layer */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        {logoUrl && (
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
            src={logoUrl}
            alt={division?.name || 'Logo'}
            className="h-16 w-auto object-contain drop-shadow-2xl mb-4"
          />
        )}
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-xl font-extrabold text-white tracking-tight mb-1"
        >
          {welcomeText}
        </motion.h2>
        {tagline && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-white/60 font-medium mb-6 text-center max-w-xs px-4"
          >
            {tagline}
          </motion.p>
        )}
        {showProgressBar && (
          <div className="w-56 h-1.5 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-75 ease-out"
              style={{
                background: `linear-gradient(to right, ${accentColor}, #ffffff)`,
                width: `${progress}%`,
              }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}