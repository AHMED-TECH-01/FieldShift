import React from 'react';
import { FieldShiftEarth } from '../three/FieldShiftEarth';

export const LiquidEarthGlobe: React.FC = () => {
  return (
    <div className="relative w-full h-[440px] md:h-[520px] flex items-center justify-center">
      <FieldShiftEarth
        size="xl"
        speed={1.0}
        showSatellite={true}
        showAtmosphere={true}
        interactive={true}
        quality="high"
        className="w-full h-full"
      />
    </div>
  );
};
