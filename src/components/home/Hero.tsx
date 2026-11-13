import React from 'react';
import { ArrowRight, Play, ShieldAlert, Sparkles, TrendingUp, CheckCircle2, ChevronRight, Info } from 'lucide-react';
import { LiquidEarthGlobe } from './LiquidEarthGlobe';

interface HeroProps {
  onExplore: () => void;
  onWatchDemo: () => void;
  onSelectStrategy: (strategyCode: 'A' | 'B' | 'C') => void;
  onViewDetailedAnalysis: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onExplore,
  onWatchDemo,
  onSelectStrategy,
  onViewDetailedAnalysis,
}) => {
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-b from-[#F8F7ED] via-[#F4F6EA] to-[#EBF3E5] pt-6 md:pt-10 pb-16 lg:pb-24 border-b border-[#E2E8DE]">
      
      {/* Background Hero Farmland Image with subtle overlay for contrast */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <img
          src="/images/hero-climate-farm.jpg"
          alt="Modern precision agriculture farmland with contoured crop strips and sustainable farming practices"
          width="1920"
          height="1080"
          loading="eager"
          fetchPriority="high"
          className="w-full h-full object-cover object-center opacity-15 mix-blend-multiply scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#F8F7ED] via-[#F8F7ED]/85 to-[#EBF3E5]/70" />
        <div className="absolute inset-0 bg-[radial-gradient(#145c3d_1px,transparent_1px)] [background-size:28px_28px] opacity-30" />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Main Two-Column Hero Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* ================= LEFT COLUMN ================= */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            
            {/* NASA Earth Observations Badge */}
            <div className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-white/90 border border-[#CDE5BA] shadow-xs">
              <span className="w-5 h-5 rounded-full bg-[#0B3D91] text-white flex items-center justify-center text-[10px] font-black tracking-tighter">
                NASA
              </span>
              <span className="text-xs font-semibold text-[#145C3D]">
                Powered by NASA Earth Observations
              </span>
              <span className="w-2 h-2 rounded-full bg-[#76B93F] animate-pulse" />
            </div>

            {/* Main Heading with leaf green highlight */}
            <h1 className="font-display text-fluid-hero font-extrabold text-[#073D2B] tracking-tight">
              Smarter Farming <br />
              with <span className="text-[#76B93F] underline decoration-[#76B93F]/40 underline-offset-8">NASA</span> Data
            </h1>

            {/* Description */}
            <p className="text-fluid-lead text-[#2A4D3E] max-w-xl font-normal">
              Explore crop rotation strategies, analyze environmental trends and build a more
              resilient farm for a greener tomorrow.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={onExplore}
                className="inline-flex items-center justify-center gap-2.5 min-h-[44px] px-6 py-3 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white font-semibold text-sm sm:text-base shadow-lg hover:shadow-xl transition-all group"
              >
                <span>Explore the Platform</span>
                <ArrowRight className="w-4 h-4 text-[#76B93F] group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={onWatchDemo}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-full bg-white hover:bg-[#F0F5EE] text-[#073D2B] font-semibold text-sm sm:text-base border border-[#CDE5BA] shadow-xs hover:border-[#76B93F] transition-all"
              >
                <div className="w-6 h-6 rounded-full bg-[#EAF5DF] flex items-center justify-center text-[#145C3D]">
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                </div>
                <span>Watch Demo</span>
              </button>
            </div>

            {/* Lower-left Agricultural Field Area with Tractor */}
            <div className="pt-4 mt-2">
              <div className="relative rounded-2xl bg-gradient-to-r from-[#FFFFFF]/90 via-[#F7FAF4]/90 to-[#EBF3E5]/90 border border-[#D5E5CA] p-3.5 sm:p-4 shadow-sm flex flex-col min-[400px]:flex-row items-start min-[400px]:items-center gap-3.5 sm:gap-4">
                <div className="relative w-full min-[400px]:w-28 h-24 min-[400px]:h-20 sm:w-32 sm:h-22 flex-shrink-0 overflow-hidden rounded-xl bg-[#EAF2E4]/60 flex items-center justify-center">
                  <img
                    src="/images/tractor_transparent.png"
                    alt="Agricultural Tractor in Field"
                    className="w-full h-full object-contain filter drop-shadow-md hover:scale-105 transition-transform"
                    onError={(e) => {
                      // Fallback to original image if transparent variant isn't available
                      (e.target as HTMLImageElement).src = '/images/image.png';
                    }}
                  />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-[#073D2B]/85 text-white text-[9px] font-bold rounded">
                    FIELD OPS
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#073D2B]">
                    <Sparkles className="w-3.5 h-3.5 text-[#76B93F]" />
                    <span>Real-World Ground Truth Integration</span>
                  </div>
                  <p className="text-[12px] text-[#527367] mt-0.5 leading-snug">
                    Calibrates NASA SMAP and MODIS satellite feeds directly with your in-field soil samples and planting equipment logs.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="lg:col-span-6 relative flex flex-col items-center justify-center">
            
            {/* Upper Right Orbiting Satellite Badge & Image */}
            <div className="absolute top-2 right-4 z-20 hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white/90 backdrop-blur-md border border-[#D5E5CA] shadow-md animate-float">
              <div className="w-8 h-8 rounded-lg bg-[#073D2B]/10 p-1 flex items-center justify-center overflow-hidden">
                <img
                  src="/images/satellite_transparent.png"
                  alt="NASA Earth Satellite"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/image copy.png';
                  }}
                />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#145C3D]">SMAP / GPM Telemetry</p>
                <p className="text-[11px] font-semibold text-[#073D2B]">Active Orbital Pass</p>
              </div>
            </div>

            {/* 3D Liquid Earth Globe Visual */}
            <div className="relative w-full max-w-[500px]">
              <LiquidEarthGlobe />
            </div>

            {/* Floating Crop Rotation Insights Glass Panel */}
            <div className="w-full max-w-[440px] mt-2 relative z-20 glass-panel rounded-2xl p-3.5 sm:p-5 shadow-2xl border border-white/80">
              
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E8DE]/70">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-sm font-bold text-[#073D2B]">Crop Rotation Insights</h2>
                </div>
                <span className="text-[10px] font-semibold text-[#527367] bg-[#F0F5EE] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Info className="w-3 h-3 text-[#76B93F]" />
                  Simulated Models
                </span>
              </div>

              {/* Notice that percentage indicators are illustrative */}
              <div className="mt-2 mb-3 bg-[#F4F9EE] border border-[#D5E8C8] rounded-xl px-2.5 py-1.5 text-[11px] text-[#2F5942] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#76B93F] flex-shrink-0" />
                <span>Percentage indicators are model-derived and illustrative until soil calibration is finalized.</span>
              </div>

              {/* Strategy Cards */}
              <div className="space-y-2.5">
                
                {/* Strategy A */}
                <button
                  type="button"
                  onClick={() => onSelectStrategy('A')}
                  className="w-full text-left group flex items-center justify-between gap-2 min-h-[56px] p-2.5 rounded-xl bg-white/80 hover:bg-[#F8FBF5] border border-[#E2E8DE] hover:border-[#76B93F]/60 cursor-pointer transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-amber-100 flex items-center justify-center text-amber-800 font-bold text-xs border border-amber-200">
                      🌾 A
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[#073D2B] group-hover:text-[#145C3D]">
                        Strategy A — Current Rotation
                      </h4>
                      <p className="text-[11px] text-[#527367]">Corn / Soybean Standard Biennial</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <div className="relative w-9 h-9 rounded-full bg-[#EAEFE8] flex items-center justify-center text-xs font-bold text-[#073D2B] border-2 border-amber-400">
                      72%
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8C9E94] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* Strategy B */}
                <button
                  type="button"
                  onClick={() => onSelectStrategy('B')}
                  className="w-full text-left group flex items-center justify-between gap-2 min-h-[56px] p-2.5 rounded-xl bg-white/80 hover:bg-[#F8FBF5] border border-[#E2E8DE] hover:border-[#76B93F]/60 cursor-pointer transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold text-xs border border-emerald-200">
                      🌱 B
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[#073D2B] group-hover:text-[#145C3D]">
                        Strategy B — Soil Restoration
                      </h4>
                      <p className="text-[11px] text-[#527367]">Cereal Rye + Vetch Living Cover</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <div className="relative w-9 h-9 rounded-full bg-[#EAEFE8] flex items-center justify-center text-xs font-bold text-[#073D2B] border-2 border-[#76B93F]">
                      86%
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8C9E94] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* Strategy C */}
                <button
                  type="button"
                  onClick={() => onSelectStrategy('C')}
                  className="w-full text-left group flex items-center justify-between gap-2 min-h-[56px] p-2.5 rounded-xl bg-white/80 hover:bg-[#F8FBF5] border border-[#E2E8DE] hover:border-[#76B93F]/60 cursor-pointer transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-blue-100 flex items-center justify-center text-blue-800 font-bold text-xs border border-blue-200">
                      🌽 C
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[#073D2B] group-hover:text-[#145C3D]">
                        Strategy C — Climate Resilient
                      </h4>
                      <p className="text-[11px] text-[#527367]">Sorghum & Drought-Tolerant Pulses</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <div className="relative w-9 h-9 rounded-full bg-[#EAEFE8] flex items-center justify-center text-xs font-bold text-[#073D2B] border-2 border-emerald-600">
                      91%
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8C9E94] group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

              </div>

              {/* View Detailed Analysis Action */}
              <button
                onClick={onViewDetailedAnalysis}
                className="mt-3.5 w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
              >
                <span>View Detailed Analysis</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#76B93F]" />
              </button>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
