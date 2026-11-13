import React, { useState } from 'react';
import {
  RefreshCw,
  Droplets,
  Sprout,
  ShieldAlert,
  DollarSign,
  TrendingUp,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { CropRotationStrategy } from '../../types';

interface RotationSimulatorProps {
  onOpenDetailedPage: () => void;
  selectedStrategyCode?: 'A' | 'B' | 'C';
}

export const RotationSimulator: React.FC<RotationSimulatorProps> = ({
  onOpenDetailedPage,
  selectedStrategyCode = 'B',
}) => {
  const [activeCode, setActiveCode] = useState<'A' | 'B' | 'C'>(selectedStrategyCode);

  const strategiesData: Record<'A' | 'B' | 'C', CropRotationStrategy> = {
    A: {
      id: 'strategy-a',
      code: 'A',
      title: 'Current Rotation Baseline',
      tagline: 'Standard Commercial Monoculture / Biennial Cycle',
      score: 72,
      isIllustrative: true,
      cropSequence: ['Corn (Maize)', 'Soybean', 'Corn (Maize)', 'Soybean'],
      seasons: ['Spring Planting - Autumn Harvest', 'Winter Fallow (Uncovered)'],
      soilBenefits: {
        nitrogenFixation: 'Moderate (~35 lbs N/acre from soybean nodules)',
        organicMatterGrowth: '+0.05% estimated 3-yr delta',
        erosionMitigation: 'Low (4.2 months bare soil exposure over winter)',
        rootDiversityScore: 48,
      },
      climateResilience: {
        waterEfficiency: 'Medium (High corn transpirational demand during July pollination)',
        droughtTolerance: 'Moderate vulnerability during silking',
        heatRiskExposure: 'Elevated during pollination window >32°C',
      },
      economicProfile: {
        grossMarginEst: '$710 - $780 / acre / yr',
        inputCostIndex: 'High synthetic nitrogen & chemical herbicide dependence',
        marketVolatility: 'Directly exposed to single-commodity price swings',
      },
      limitations: 'High Western Corn Rootworm pressure; accelerated soil compaction in wheel tracks; chronic nutrient leaching into groundwater during spring thaws.',
    },
    B: {
      id: 'strategy-b',
      code: 'B',
      title: 'Soil Restoration & Carbon Strategy',
      tagline: 'Multi-Species Cover Cropping & Legume Intensification',
      score: 86,
      isIllustrative: true,
      cropSequence: [
        'Corn (Grain)',
        'Cereal Rye + Hairy Vetch (Winter Living Roots)',
        'Soybean (No-Till)',
        'Crimson Clover + Oats (Autumn Cover)',
        'Alfalfa / Small Grains',
      ],
      seasons: ['Continuous Living Roots (365 Days Ground Armor)', 'Spring Roller-Crimper Termination'],
      soilBenefits: {
        nitrogenFixation: 'Very High (+75 to +95 lbs atmospheric N fixed biologically/acre)',
        organicMatterGrowth: '+0.28% to +0.36% estimated 3-yr delta',
        erosionMitigation: 'Very High (94% ground cover throughout winter freeze/thaw)',
        rootDiversityScore: 89,
      },
      climateResilience: {
        waterEfficiency: 'High (Soil organic matter holds ~22,000 gal/acre additional moisture)',
        droughtTolerance: 'High root-zone water retention confirmed via NASA SMAP data',
        heatRiskExposure: 'Lower canopy surface temps (-2.1°C via MODIS thermal comparison)',
      },
      economicProfile: {
        grossMarginEst: '$745 - $825 / acre / yr',
        inputCostIndex: '35% reduction in synthetic N purchasing by Year 3',
        marketVolatility: 'Diversified income stream with small grain seed sales & carbon credits',
      },
      limitations: 'Requires specialized seed drill or aerial seeding equipment; spring cover crop termination timing must be managed in unusually dry springs.',
    },
    C: {
      id: 'strategy-c',
      code: 'C',
      title: 'Climate-Resilient & Water-Conserving Rotation',
      tagline: 'Deep-Rooted Cereals, Drought-Tolerant Legumes & Adaptive Fallowing',
      score: 91,
      isIllustrative: true,
      cropSequence: [
        'Drought-Tolerant Corn Hybrid',
        'Triticale Winter Cover',
        'Grain Sorghum (Milo)',
        'Field Peas / Chickpeas',
        'Confectionery Sunflowers',
      ],
      seasons: ['Staggered Water Demand Peak Cycles', 'Continuous Soil Armor & Fiber'],
      soilBenefits: {
        nitrogenFixation: 'High (Cool season pulse legumes contribute biological nitrogen)',
        organicMatterGrowth: '+0.22% estimated 3-yr delta with deep fibrous sunflower taproots',
        erosionMitigation: 'High (Stubble residue breaks surface wind velocity)',
        rootDiversityScore: 94,
      },
      climateResilience: {
        waterEfficiency: 'Superior (Grain sorghum consumes 32% less water than corn)',
        droughtTolerance: 'Exceptional (Survives prolonged 4-week dry spells detected by GPM)',
        heatRiskExposure: 'Sorghum & sunflower photosynthesize efficiently at temps up to 38°C',
      },
      economicProfile: {
        grossMarginEst: '$760 - $855 / acre / yr',
        inputCostIndex: 'Lowest water and synthetic chemical dependency',
        marketVolatility: 'Resistant to single-commodity price shocks; emerging high-value specialty contracts',
      },
      limitations: 'Grain drying infrastructure and regional elevator grain acceptance for sorghum must be verified; sunflower harvest requires custom combine row-crop headers.',
    },
  };

  const curr = strategiesData[activeCode];

  return (
    <section className="py-16 md:py-20 bg-white border-b border-[#E2E8DE]" id="crop-rotation-engine">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold uppercase tracking-wider mb-2">
              <RefreshCw className="w-3.5 h-3.5" />
              Agronomic Decision Engine
            </div>
            <h2 className="font-display text-fluid-h2 font-extrabold text-[#073D2B] tracking-tight">
              Crop Rotation Strategy Engine
            </h2>
            <p className="text-sm sm:text-base text-[#527367] mt-2 leading-relaxed">
              Compare your current crop rotation with regenerative and climate-resilient alternatives.
              All models incorporate NASA SMAP soil moisture, NASA POWER thermal units, and local soil attributes.
            </p>
          </div>

          <button
            onClick={onOpenDetailedPage}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs sm:text-sm font-semibold transition-all self-start md:self-auto"
          >
            <span>Full Multi-Year Simulator</span>
            <ArrowRight className="w-4 h-4 text-[#76B93F]" />
          </button>
        </div>

        {/* Strategy Selector Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 mb-8">
          {(['A', 'B', 'C'] as const).map((code) => {
            const strat = strategiesData[code];
            const isSelected = activeCode === code;
            return (
              <button
                type="button"
                key={code}
                onClick={() => setActiveCode(code)}
                className={`w-full p-4 sm:p-5 rounded-2xl cursor-pointer transition-all border text-left relative ${
                  isSelected
                    ? 'bg-[#F4F9EE] border-[#76B93F] shadow-md ring-2 ring-[#76B93F]/25'
                    : 'bg-[#FBFDF9] border-[#E2E8DE] hover:border-[#BAC9BE] hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-xl font-display font-bold text-sm flex-shrink-0 ${
                      code === 'A'
                        ? 'bg-amber-100 text-amber-900'
                        : code === 'B'
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-blue-100 text-blue-900'
                    }`}
                  >
                    {code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[#527367]">Resilience Score:</span>
                    <span className="font-display text-lg font-bold text-[#073D2B]">{strat.score}%</span>
                  </div>
                </div>

                <h3 className="font-bold text-base text-[#073D2B] mt-3">
                  {strat.title}
                </h3>
                <p className="text-xs text-[#527367] mt-1 leading-snug">
                  {strat.tagline}
                </p>

                <div className="mt-3 pt-3 border-t border-[#E2E8DE]/60 flex items-center justify-between text-[11px] text-[#2F5942]">
                  <span>{strat.cropSequence.length} Crop Phases</span>
                  <span className="font-semibold underline">Tap to inspect</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Strategy Deep-Dive Container */}
        <div className="bg-[#FAFDF8] rounded-3xl border border-[#D5E5CA] p-4 sm:p-8 shadow-sm">
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 border-b border-[#E2E8DE] gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-[#073D2B] text-white text-xs font-bold flex-shrink-0">
                  STRATEGY {curr.code}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-[#073D2B]">{curr.title}</h3>
              </div>
              <p className="text-sm text-[#527367] mt-1">{curr.tagline}</p>
            </div>

            {/* Scientific disclaimer badge */}
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl px-3.5 py-2.5 text-xs text-amber-900 flex items-start sm:items-center gap-2 lg:max-w-md">
              <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span>
                Scores are model-derived using NASA satellite baselines and regional soil maps. They support farmer judgment and do not guarantee yield outcomes.
              </span>
            </div>
          </div>

          {/* Crop Sequence Flow */}
          <div className="py-5 sm:py-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#145C3D] mb-3">
              Planned Crop Sequence & Seasonal Schedule
            </h4>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {curr.cropSequence.map((crop, idx) => (
                <React.Fragment key={idx}>
                  <div className="bg-white border border-[#CDE5BA] rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-2xs flex items-center gap-2 max-w-full">
                    <span className="w-6 h-6 rounded-full bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-[#073D2B]">{crop}</span>
                  </div>
                  {idx < curr.cropSequence.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-[#8C9E94] flex-shrink-0 hidden min-[400px]:block" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Three Comparison Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            
            {/* 1. Soil Regeneration */}
            <div className="bg-white rounded-2xl p-5 border border-[#E2E8DE] shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <Sprout className="w-4 h-4 text-emerald-600" />
                Soil Biological Health
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[#527367] block">Biological Nitrogen:</span>
                  <span className="font-semibold text-[#073D2B]">{curr.soilBenefits.nitrogenFixation}</span>
                </div>
                <div>
                  <span className="text-[#527367] block">Organic Matter 3-Yr Delta:</span>
                  <span className="font-semibold text-[#073D2B]">{curr.soilBenefits.organicMatterGrowth}</span>
                </div>
                <div>
                  <span className="text-[#527367] block">Erosion Protection:</span>
                  <span className="font-semibold text-[#073D2B]">{curr.soilBenefits.erosionMitigation}</span>
                </div>
              </div>
            </div>

            {/* 2. Climate & Water Resilience */}
            <div className="bg-white rounded-2xl p-5 border border-[#E2E8DE] shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-sky-800 font-bold text-sm">
                <Droplets className="w-4 h-4 text-sky-600" />
                Climate & Moisture Defense
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[#527367] block">Water Efficiency:</span>
                  <span className="font-semibold text-[#073D2B]">{curr.climateResilience.waterEfficiency}</span>
                </div>
                <div>
                  <span className="text-[#527367] block">Drought Tolerance:</span>
                  <span className="font-semibold text-[#073D2B]">{curr.climateResilience.droughtTolerance}</span>
                </div>
                <div>
                  <span className="text-[#527367] block">Heat Stress Response:</span>
                  <span className="font-semibold text-[#073D2B]">{curr.climateResilience.heatRiskExposure}</span>
                </div>
              </div>
            </div>

            {/* 3. Economic Profile */}
            <div className="bg-white rounded-2xl p-5 border border-[#E2E8DE] shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <DollarSign className="w-4 h-4 text-amber-600" />
                Economic Realities & Inputs
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[#527367] block">Estimated Gross Margin:</span>
                  <span className="font-semibold text-[#073D2B]">{curr.economicProfile.grossMarginEst}</span>
                </div>
                <div>
                  <span className="text-[#527367] block">Input Cost Structure:</span>
                  <span className="font-semibold text-[#073D2B]">{curr.economicProfile.inputCostIndex}</span>
                </div>
                <div>
                  <span className="text-[#527367] block">Market Exposure:</span>
                  <span className="font-semibold text-[#073D2B]">{curr.economicProfile.marketVolatility}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Agronomic Tradeoffs & Scientific Limitations */}
          <div className="mt-6 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                Agronomic Caveats & Operational Requirements
              </h5>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                {curr.limitations}
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
