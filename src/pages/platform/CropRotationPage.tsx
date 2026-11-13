import React, { useState } from 'react';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import {
  RefreshCw,
  Sprout,
  Droplets,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Sliders,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Layers,
  ChevronRight,
  Info,
  Calendar,
} from 'lucide-react';

interface CropRotationPageProps {
  onNavigate: (path: string) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
}

export const CropRotationPage: React.FC<CropRotationPageProps> = ({ onNavigate, onOpenAuth }) => {
  const [selectedStrategy, setSelectedStrategy] = useState<'A' | 'B' | 'C'>('B');
  const [soilWeight, setSoilWeight] = useState<number>(4);
  const [waterWeight, setWaterWeight] = useState<number>(4);
  const [profitWeight, setProfitWeight] = useState<number>(3);

  // Dynamic score simulation based on priority sliders
  const scoreA = Math.max(55, Math.min(85, Math.round(72 + (profitWeight - 3) * 4 - (soilWeight - 3) * 3)));
  const scoreB = Math.max(70, Math.min(98, Math.round(86 + (soilWeight - 3) * 4 + (waterWeight - 3) * 2)));
  const scoreC = Math.max(75, Math.min(96, Math.round(91 + (waterWeight - 3) * 4 + (soilWeight - 3) * 2)));

  const strategies = [
    {
      code: 'A',
      name: 'Strategy A — Baseline Monoculture',
      tagline: 'Corn / Soybean Standard Biennial',
      score: scoreA,
      badgeColor: 'border-amber-300 text-amber-900 bg-amber-50',
      nitrogen: '~35 lbs N/acre',
      bareDays: '135 Days (High Winter Vulnerability)',
      waterUse: 'High (transpirational July peak)',
      pestBreak: 'Incomplete rootworm interruption',
      description:
        'The conventional high-synthetic input rotation common across the Corn Belt. Leaves fields bare from late October through mid-April, creating severe erosion vulnerability during early spring rainfall.',
    },
    {
      code: 'B',
      name: 'Strategy B — Soil Restoration & Living Armor',
      tagline: 'Corn → Winter Rye/Vetch → Soybean → Small Grain',
      score: scoreB,
      badgeColor: 'border-emerald-400 text-emerald-900 bg-emerald-50',
      nitrogen: '+75 to +95 lbs N/acre biologically fixed',
      bareDays: '0 Days (365 Continuous Living Armor)',
      waterUse: '+22,000 gal/ac retention capacity',
      pestBreak: 'Breaks rootworm & stimulates mycorrhizae',
      description:
        'Integrates an overwintering cereal rye and hairy vetch biculture immediately after corn silage/grain harvest. Builds soil organic matter, stops rill erosion, and cuts commercial fertilizer purchases by up to 35%.',
    },
    {
      code: 'C',
      name: 'Strategy C — Climate Resilient Polyculture',
      tagline: 'Corn → Triticale → Sorghum → Field Peas → Sunflower',
      score: scoreC,
      badgeColor: 'border-blue-400 text-blue-900 bg-blue-50',
      nitrogen: '+60 lbs N/acre via pulse legumes',
      bareDays: '45 Days (Resilient stover mulch)',
      waterUse: '32% less total seasonal water demand',
      pestBreak: 'Complete interruption of cereal & legume pests',
      description:
        'Designed for moisture-stressed regions facing erratic summer heat spikes. Substitutes water-thirsty continuous corn with drought-hardy grain sorghum, deep-taproot sunflowers, and early-harvest field peas.',
    },
  ];

  const currentStrat = strategies.find((s) => s.code === selectedStrategy) || strategies[1];

  return (
    <div className="py-8 sm:py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        
        {/* Breadcrumb Header */}
        <div>
          <Breadcrumbs
            items={[
              { label: 'Platform', path: '/features' },
              { label: 'Crop Rotation Engine' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
                Scientific Rotational Modeling
              </span>
              <h1 className="font-display text-fluid-h1 font-extrabold text-[#073D2B] mt-1">
                Multi-Year Crop Rotation Engine
              </h1>
              <p className="text-fluid-lead text-[#527367] mt-2 max-w-2xl leading-relaxed">
                Evaluate existing crop sequences against restorative cover crop architectures and
                drought-resilient polycultures using NASA Earth observations and local soil physics.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/crop-rotation')}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] text-white text-xs sm:text-sm font-semibold hover:bg-[#145C3D] transition-all shadow-md self-start md:self-auto shrink-0"
            >
              <span>Launch Live Engine in Dashboard</span>
              <ArrowRight className="w-4 h-4 text-[#76B93F] shrink-0" />
            </button>
          </div>
        </div>

        {/* Priority Calibration Simulator Bar */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-[#D5E5CA] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8DE] pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#145C3D] shrink-0" />
              <h2 className="font-bold text-base text-[#073D2B]">Interactive Farmer Priority Calibration</h2>
            </div>
            <span className="text-xs text-[#527367]">
              Adjust weights (1–5) to observe model recalculations in real time
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 pt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-[#073D2B] mb-1">
                <span>Soil Organic Matter Priority</span>
                <span className="text-[#145C3D] font-bold">{soilWeight} / 5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={soilWeight}
                onChange={(e) => setSoilWeight(Number(e.target.value))}
                className="w-full accent-[#76B93F] cursor-pointer"
                aria-label="Soil Organic Matter Priority"
              />
              <p className="text-[11px] text-[#527367] mt-0.5">Rewards continuous living roots and biological carbon.</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-[#073D2B] mb-1">
                <span>Water Conservation Priority</span>
                <span className="text-[#145C3D] font-bold">{waterWeight} / 5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={waterWeight}
                onChange={(e) => setWaterWeight(Number(e.target.value))}
                className="w-full accent-[#76B93F] cursor-pointer"
                aria-label="Water Conservation Priority"
              />
              <p className="text-[11px] text-[#527367] mt-0.5">Calibrates against NASA SMAP root-zone deficit risk.</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-[#073D2B] mb-1">
                <span>Immediate Cash Margin Priority</span>
                <span className="text-[#145C3D] font-bold">{profitWeight} / 5</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={profitWeight}
                onChange={(e) => setProfitWeight(Number(e.target.value))}
                className="w-full accent-[#76B93F] cursor-pointer"
                aria-label="Immediate Cash Margin Priority"
              />
              <p className="text-[11px] text-[#527367] mt-0.5">Balances near-term cash crops with multi-year soil health.</p>
            </div>
          </div>
        </div>

        {/* 3-Strategy Comparison Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {strategies.map((strat) => {
            const isSelected = selectedStrategy === strat.code;
            return (
              <button
                type="button"
                key={strat.code}
                onClick={() => setSelectedStrategy(strat.code as 'A' | 'B' | 'C')}
                className={`text-left w-full p-5 sm:p-6 rounded-3xl cursor-pointer transition-all border flex flex-col justify-between min-w-0 ${
                  isSelected
                    ? 'bg-white border-[#76B93F] shadow-lg ring-2 ring-[#76B93F]/30'
                    : 'bg-white/80 border-[#D5E5CA] hover:border-[#76B93F]/60 shadow-2xs'
                }`}
              >
                <div className="space-y-4 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${strat.badgeColor}`}>
                      Strategy {strat.code}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#073D2B]">
                      <span className="text-xl font-display">{strat.score}</span>
                      <span className="text-[10px] text-[#527367]">/ 100</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg text-[#073D2B] leading-snug">{strat.name}</h3>
                    <p className="text-xs text-[#76B93F] font-semibold mt-0.5">{strat.tagline}</p>
                  </div>

                  <p className="text-xs text-[#527367] leading-relaxed">{strat.description}</p>
                </div>

                <div className="w-full mt-6 pt-4 border-t border-[#E2E8DE] space-y-2.5 text-xs">
                  <div className="flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-0.5 min-[380px]:gap-2 text-[#2A4D3E]">
                    <span className="text-[#527367] shrink-0">Nitrogen Contribution:</span>
                    <span className="font-semibold min-[380px]:text-right">{strat.nitrogen}</span>
                  </div>
                  <div className="flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-0.5 min-[380px]:gap-2 text-[#2A4D3E]">
                    <span className="text-[#527367] shrink-0">Bare Field Window:</span>
                    <span className="font-semibold min-[380px]:text-right">{strat.bareDays}</span>
                  </div>
                  <div className="flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-0.5 min-[380px]:gap-2 text-[#2A4D3E]">
                    <span className="text-[#527367] shrink-0">Pest Interruption:</span>
                    <span className="font-semibold min-[380px]:text-right">{strat.pestBreak}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detailed Agronomic Breakdown for Selected Strategy */}
        <div className="p-5 sm:p-8 rounded-3xl bg-white border border-[#D5E5CA] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-[#E2E8DE] pb-4">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
                Deep Agronomic Profiling
              </span>
              <h2 className="font-display text-fluid-h2 font-bold text-[#073D2B] mt-1">
                {currentStrat.name} — Scientific Analysis
              </h2>
            </div>
            <span className="self-start sm:self-auto text-xs font-semibold px-3 py-1.5 rounded-full bg-[#EAF5DF] text-[#145C3D] shrink-0">
              Calibrated for Midwest Silt Loam & Loess
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-4 min-w-0">
              <h3 className="font-bold text-base text-[#073D2B] flex items-center gap-2">
                <Sprout className="w-5 h-5 text-[#145C3D] shrink-0" />
                <span>Soil Physical & Biological Dynamics</span>
              </h3>
              <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
                By maintaining root structures in the 0–60 cm depth through winter, the biological rhizosphere
                sustains active mycorrhizal fungi and earthworm populations. In contrast to conventional fallow,
                living root exudates cement silt particles into stable water-aggregate granules, dramatically
                increasing hydraulic infiltration and reducing crusting after heavy spring downpours.
              </p>
              <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#E2E8DE] space-y-2 text-xs text-[#2A4D3E]">
                <div className="font-bold text-[#073D2B]">NASA Satellite Calibration:</div>
                <p>
                  NASA MODIS 250m NDVI is monitored from November through April to verify canopy coverage.
                  SMAP 9km root-zone moisture data demonstrates an average 18% moisture retention advantage
                  during dry June seedling establishment periods.
                </p>
              </div>
            </div>

            <div className="space-y-4 min-w-0">
              <h3 className="font-bold text-base text-[#073D2B] flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#145C3D] shrink-0" />
                <span>Pest & Pathogen Life-Cycle Disruption</span>
              </h3>
              <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
                Repeated continuous cultivation of the same botanical family (e.g. Poaceae/Gramineae for corn)
                allows western corn rootworm (<em>Diabrotica virgifera</em>) and stalk rots (<em>Fusarium</em>)
                to compound in the soil bank. Introducing legumes (Fabaceae) or brassicas disrupts larval nutrition
                and suppresses overwintering egg hatch rates.
              </p>
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5 text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Agronomic Limitation & Caveat</span>
                </div>
                <p>
                  Satellite observations cannot confirm subterranean pathogen presence. Rotation recommendations
                  provide statistical risk mitigation based on published extension trials and must be paired
                  with local field scouting.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Related Platform Links */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => onNavigate('/soil-intelligence')}
            className="text-left w-full min-h-[44px] p-5 rounded-2xl bg-white border border-[#D5E5CA] hover:border-[#76B93F] cursor-pointer transition-all shadow-2xs space-y-2"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#145C3D] flex items-center justify-center font-bold">
              01
            </div>
            <h4 className="font-bold text-sm text-[#073D2B]">Precision Soil Intelligence</h4>
            <p className="text-xs text-[#527367]">Connect your pH, organic matter, and CEC laboratory tests.</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/field-risk')}
            className="text-left w-full min-h-[44px] p-5 rounded-2xl bg-white border border-[#D5E5CA] hover:border-[#76B93F] cursor-pointer transition-all shadow-2xs space-y-2"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#145C3D] flex items-center justify-center font-bold">
              02
            </div>
            <h4 className="font-bold text-sm text-[#073D2B]">Field Risk Diagnostic</h4>
            <p className="text-xs text-[#527367]">Evaluate erosion, drought stress, and heat wave vulnerability.</p>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/nasa-data')}
            className="text-left w-full min-h-[44px] p-5 rounded-2xl bg-white border border-[#D5E5CA] hover:border-[#76B93F] cursor-pointer transition-all shadow-2xs space-y-2"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#145C3D] flex items-center justify-center font-bold">
              03
            </div>
            <h4 className="font-bold text-sm text-[#073D2B]">NASA Data Catalog</h4>
            <p className="text-xs text-[#527367]">Explore open satellite feeds from SMAP, GPM, and MODIS.</p>
          </button>
        </div>

      </div>
    </div>
  );
};
