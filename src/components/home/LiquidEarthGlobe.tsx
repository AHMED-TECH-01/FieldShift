import React from 'react';
import { FieldShiftEarth } from '../three/FieldShiftEarth';

export const LiquidEarthGlobe: React.FC = () => {
  return (
    <div className="relative w-full max-w-full h-[300px] sm:h-[400px] md:h-[480px] lg:h-[520px] flex items-center justify-center overflow-hidden">
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
