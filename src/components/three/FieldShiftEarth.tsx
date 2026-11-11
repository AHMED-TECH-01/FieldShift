import React, { useEffect, useRef, useState } from 'react';
import { initEarthScene, EarthSceneConfig } from './EarthScene';

export interface FieldShiftEarthProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  speed?: number;
  showSatellite?: boolean;
  showAtmosphere?: boolean;
  interactive?: boolean;
  quality?: 'high' | 'medium' | 'low';
  className?: string;
  fallbackImageUrl?: string;
}

export const FieldShiftEarth: React.FC<FieldShiftEarthProps> = ({
  size = 'md',
  speed = 1.0,
  showSatellite = true,
  showAtmosphere = true,
  interactive = true,
  quality = 'high',
  className = '',
  fallbackImageUrl = '/images/globe_extracted.png',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  // Map size token to dimensions with full mobile responsiveness
  const getDimensions = () => {
    if (typeof size === 'number') {
      return { width: size, height: size };
    }
    switch (size) {
      case 'sm':
        return { width: 220, height: 220, styleClass: 'w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] max-w-full' };
      case 'md':
        return { width: 340, height: 340, styleClass: 'w-[240px] h-[240px] sm:w-[300px] sm:h-[300px] md:w-[340px] md:h-[340px] max-w-full' };
      case 'lg':
        return { width: 440, height: 440, styleClass: 'w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] md:w-[440px] md:h-[440px] max-w-full' };
      case 'xl':
        return { width: 520, height: 520, styleClass: 'w-full max-w-[290px] h-[290px] sm:max-w-[380px] sm:h-[380px] md:max-w-[480px] md:h-[480px] lg:max-w-[520px] lg:h-[520px]' };
      default:
        return { width: 340, height: 340, styleClass: 'w-[260px] h-[260px] sm:w-[340px] sm:h-[340px] max-w-full' };
    }
  };

  const dim = getDimensions();

  useEffect(() => {
    if (!containerRef.current) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const effectiveSpeed = prefersReducedMotion ? 0.15 : speed;

    let sceneHandle: { destroy: () => void; resize: () => void } | null = null;

    try {
      sceneHandle = initEarthScene({
        container: containerRef.current,
        size: typeof size === 'string' ? size : 'md',
        speed: effectiveSpeed,
        showSatellite,
        showAtmosphere,
        interactive,
        quality,
      });
    } catch (err) {
      console.warn('WebGL initialization error, falling back to static visual:', err);
      setHasWebGL(false);
      return;
    }

    // Responsive resize observer
    const resizeObserver = new ResizeObserver(() => {
      sceneHandle?.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      sceneHandle?.destroy();
    };
  }, [size, speed, showSatellite, showAtmosphere, interactive, quality]);

  if (!hasWebGL) {
    return (
      <div
        className={`relative flex items-center justify-center ${
          typeof size === 'string' ? dim.styleClass : ''
        } ${className}`}
        style={typeof size === 'number' ? { width: size, height: size } : {}}
      >
        <img
          src={fallbackImageUrl}
          alt="Field Shift Liquid Earth"
          className="w-full h-full object-contain drop-shadow-2xl animate-pulse-subtle"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center select-none ${
        typeof size === 'string' ? dim.styleClass : ''
      } ${className}`}
      style={typeof size === 'number' ? { width: size, height: size } : {}}
    >
      {/* Ambient background glow behind the liquid Earth */}
      <div className="absolute w-[80%] h-[80%] rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
      <div className="absolute w-[60%] h-[60%] rounded-full bg-lime-400/15 blur-2xl pointer-events-none" />

      {/* Three.js canvas container */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing relative z-10"
        title="Interactive Field Shift Liquid Earth — Click and drag to inspect"
      />
    </div>
  );
};
