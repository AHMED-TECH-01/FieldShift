import React from 'react';
import { FieldShiftEarth } from '../three/FieldShiftEarth';

export const LiquidEarthGlobe: React.FC = () => {
  return (
    <div className="relative w-full max-w-[272px] sm:max-w-[380px] md:max-w-[460px] lg:max-w-[500px] aspect-square mx-auto flex items-center justify-center">
      <FieldShiftEarth
        size="xl"
        speed={1.0}
        showSatellite={true}
        showAtmosphere={true}
        interactive={true}
        quality="high"
        className="w-full h-full max-w-full"
      />
    </div>
  );
};
