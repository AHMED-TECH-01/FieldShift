import React, { useState } from 'react';
import { Layers, MapPin, Eye, EyeOff, Satellite, Maximize2, Compass, CheckCircle2, Info } from 'lucide-react';
import { Farm } from '../../types';

interface InteractiveFarmMapProps {
  farm: Farm;
}

export const InteractiveFarmMap: React.FC<InteractiveFarmMapProps> = ({ farm }) => {
  const [activeLayers, setActiveLayers] = useState({
    boundary: true,
    smapMoisture: true,
    modisNdvi: true,
    srtmSlope: false,
    gpmRain: false,
    soilZones: true,
  });

  const [opacity, setOpacity] = useState(75);
  const [viewMode, setViewMode] = useState<'standard' | 'before_after'>('standard');
  const [beforeAfterSplit, setBeforeAfterSplit] = useState(50);

  const toggleLayer = (layer: keyof typeof activeLayers) => {
    setActiveLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-8 border border-[#D5E5CA] shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8DE] pb-5">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold uppercase tracking-wider mb-2">
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Requirement K: Interactive Geospatial Map</span>
          </div>
          <h3 className="font-display text-fluid-h2 font-bold text-[#073D2B]">
            Field Boundary & Satellite Layer Fusion
          </h3>
          <p className="text-xs text-[#527367] mt-1 max-w-2xl">
            Visualize the {farm.name} boundary ({farm.acreage} acres) against multi-mission NASA Earth observations.
            Layer resolutions range from 9km (SMAP) down to 30m (Landsat & SRTM).
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1 bg-[#E7EFE6] p-1 rounded-2xl sm:rounded-full self-start md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('standard')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              viewMode === 'standard' ? 'bg-white text-[#073D2B] shadow-xs' : 'text-[#527367]'
            }`}
          >
            Multi-Layer Map
          </button>
          <button
            type="button"
            onClick={() => setViewMode('before_after')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
              viewMode === 'before_after' ? 'bg-white text-[#073D2B] shadow-xs' : 'text-[#527367]'
            }`}
          >
            Before & After Comparison
          </button>
        </div>
      </div>

      {/* Main Map Viewer Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        
        {/* Map Visualization Area */}
        <div className="lg:col-span-9 relative bg-[#1B362A] rounded-3xl overflow-hidden min-h-[340px] sm:min-h-[460px] border border-[#CDE5BA] shadow-inner flex flex-col justify-between p-3.5 sm:p-6 text-white">
          
          {/* Top Map HUD Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#073D2B]/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 text-[11px] sm:text-xs">
              <Compass className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#76B93F] shrink-0" />
              <span className="font-mono">
                {`${Math.abs(farm.coordinates[1]).toFixed(4)}° ${farm.coordinates[1] >= 0 ? 'N' : 'S'} | ${Math.abs(farm.coordinates[0]).toFixed(4)}° ${farm.coordinates[0] >= 0 ? 'E' : 'W'}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono bg-white/20 px-2 py-1 rounded text-white font-bold">
                SCALE: 1:12,000
              </span>
            </div>
          </div>

          {/* Map Layer Rendering Graphic */}
          <div className="my-auto py-6 sm:py-12 flex flex-col items-center justify-center relative select-none w-full">
            
            {/* Simulated Agricultural Field Polygon - Fully fluid on small screens */}
            <div className="relative w-full max-w-md min-h-[210px] sm:min-h-[270px] border-2 border-[#76B93F] bg-emerald-950/40 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-2xl overflow-hidden mx-auto">
              
              {/* Active Overlays Simulated Canvas */}
              {activeLayers.modisNdvi && (
                <div
                  style={{ opacity: opacity / 100 }}
                  className="absolute inset-0 bg-gradient-to-tr from-emerald-600/40 via-lime-500/30 to-emerald-800/50 pointer-events-none"
                />
              )}

              {activeLayers.smapMoisture && (
                <div
                  style={{ opacity: opacity / 100 }}
                  className="absolute inset-0 bg-radial from-blue-500/25 to-transparent pointer-events-none"
                />
              )}

              {activeLayers.srtmSlope && (
                <div
                  style={{ opacity: opacity / 100 }}
                  className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(245,158,11,0.25)_10px,rgba(245,158,11,0.25)_20px)] pointer-events-none"
                />
              )}

              {/* Before & After Split Slider View */}
              {viewMode === 'before_after' && (
                <div
                  style={{ left: `${beforeAfterSplit}%` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-white shadow-xl z-20 flex items-center justify-center"
                >
                  <div className="w-6 h-6 rounded-full bg-white text-[#073D2B] flex items-center justify-center text-[10px] font-bold shadow-md">
                    ⇄
                  </div>
                </div>
              )}

              {/* In-field markers */}
              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono text-[#9BD85A] z-10">
                <span className="flex items-center gap-1 min-w-0">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{farm.name}</span>
                </span>
                <span className="shrink-0">{farm.acreage} ACRES</span>
              </div>

              <div className="text-center z-10 py-4 sm:py-6">
                {viewMode === 'before_after' ? (
                  <div className="flex flex-col sm:flex-row justify-between gap-2 text-xs font-bold px-2 sm:px-4">
                    <span className="text-rose-200 bg-[#073D2B]/70 px-2 py-1 rounded">
                      Baseline (135 Bare Days)
                    </span>
                    <span className="text-emerald-200 bg-[#073D2B]/70 px-2 py-1 rounded">
                      Strategy B (Living Cover)
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-mono uppercase text-white/80 block">Active Ingestion</span>
                    <span className="font-display text-base sm:text-lg font-bold text-white">
                      {farm.soilType} Zone
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-white/70 z-10 border-t border-white/20 pt-2">
                <span>SLOPE: 2.3% CONTOUR</span>
                <span>DRAINAGE: {farm.drainage.toUpperCase()}</span>
              </div>
            </div>

          </div>

          {/* Bottom Resolution Disclosures */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-[#073D2B]/90 backdrop-blur-md p-3 rounded-2xl border border-white/15 z-10">
            <span className="text-[#9BD85A] font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>NASA SMAP (9km) & MODIS (250m) Registered to UTM Zone 15N</span>
            </span>
            <span className="text-white/70 text-[10px]">
              EPSG:3857 Reprojected
            </span>
          </div>

        </div>

        {/* Right Layer Controller Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-[#FAFDF8] p-4 rounded-2xl border border-[#D5E5CA] space-y-3">
            <h4 className="font-bold text-xs text-[#073D2B] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#76B93F]" />
              Satellite Layer Overlays
            </h4>

            <div className="space-y-2 text-xs">
              <label className="flex items-center justify-between cursor-pointer min-h-[44px] px-3 py-2 rounded-xl bg-white border border-[#E2E8DE]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={activeLayers.boundary}
                    onChange={() => toggleLayer('boundary')}
                    className="w-4 h-4 rounded text-[#073D2B] focus:ring-[#76B93F]"
                  />
                  <span className="font-semibold text-[#073D2B]">Farm Boundary</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">CADASTRE</span>
              </label>

              <label className="flex items-center justify-between cursor-pointer min-h-[44px] px-3 py-2 rounded-xl bg-white border border-[#E2E8DE]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={activeLayers.smapMoisture}
                    onChange={() => toggleLayer('smapMoisture')}
                    className="w-4 h-4 rounded text-[#073D2B] focus:ring-[#76B93F]"
                  />
                  <span className="font-semibold text-[#073D2B]">SMAP Soil Moisture</span>
                </div>
                <span className="text-[10px] font-mono text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded font-bold shrink-0">9 KM</span>
              </label>

              <label className="flex items-center justify-between cursor-pointer min-h-[44px] px-3 py-2 rounded-xl bg-white border border-[#E2E8DE]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={activeLayers.modisNdvi}
                    onChange={() => toggleLayer('modisNdvi')}
                    className="w-4 h-4 rounded text-[#073D2B] focus:ring-[#76B93F]"
                  />
                  <span className="font-semibold text-[#073D2B]">MODIS NDVI Vigor</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold shrink-0">250 M</span>
              </label>

              <label className="flex items-center justify-between cursor-pointer min-h-[44px] px-3 py-2 rounded-xl bg-white border border-[#E2E8DE]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={activeLayers.srtmSlope}
                    onChange={() => toggleLayer('srtmSlope')}
                    className="w-4 h-4 rounded text-[#073D2B] focus:ring-[#76B93F]"
                  />
                  <span className="font-semibold text-[#073D2B]">SRTM Slope Hazard</span>
                </div>
                <span className="text-[10px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold shrink-0">30 M</span>
              </label>
            </div>
          </div>

          {/* Opacity Control Slider */}
          <div className="bg-[#FAFDF8] p-4 rounded-2xl border border-[#D5E5CA] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#073D2B]">Satellite Layer Opacity</span>
              <span className="font-bold text-[#145C3D]">{opacity}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-full accent-[#073D2B] cursor-pointer"
            />
          </div>

          {/* Before & After Split Slider Control */}
          {viewMode === 'before_after' && (
            <div className="bg-[#FAFDF8] p-4 rounded-2xl border border-[#D5E5CA] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#073D2B]">Before / After Split</span>
                <span className="font-bold text-[#145C3D]">{beforeAfterSplit}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={beforeAfterSplit}
                onChange={(e) => setBeforeAfterSplit(Number(e.target.value))}
                className="w-full accent-[#073D2B] cursor-pointer"
              />
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
