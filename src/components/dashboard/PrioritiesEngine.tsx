import React, { useState, useEffect } from 'react';
import { Sliders, RefreshCw, Sparkles, CheckCircle2, Info, ArrowRight, Award } from 'lucide-react';
import { FarmerPriorities, CropRotationStrategy } from '../../types';

interface PrioritiesEngineProps {
  initialPriorities: FarmerPriorities;
  onApplyPriorities: (priorities: FarmerPriorities) => void;
  recalculating: boolean;
  rankingExplanation?: string;
}

function renderFormattedExplanation(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const PrioritiesEngine: React.FC<PrioritiesEngineProps> = ({
  initialPriorities,
  onApplyPriorities,
  recalculating,
  rankingExplanation,
}) => {
  const [priorities, setPriorities] = useState<FarmerPriorities>(initialPriorities);

  useEffect(() => {
    setPriorities(initialPriorities);
  }, [initialPriorities]);

  const priorityFields: Array<{
    key: keyof FarmerPriorities;
    label: string;
    description: string;
    category: 'Agronomic' | 'Economic' | 'Operational';
  }> = [
    {
      key: 'waterConservation',
      label: 'Water Conservation',
      description: 'Minimizes transpirational water demand and maximizes subsoil moisture bank retention.',
      category: 'Agronomic',
    },
    {
      key: 'soilOrganicMatter',
      label: 'Soil Organic Matter Improvement',
      description: 'Prioritizes high-biomass cover crops and living roots to increase topsoil organic carbon.',
      category: 'Agronomic',
    },
    {
      key: 'nitrogenFixing',
      label: 'Nitrogen-Fixing Potential',
      description: 'Maximizes biological atmospheric N fixation via leguminous nodules (vetch, clover, peas).',
      category: 'Agronomic',
    },
    {
      key: 'erosionReduction',
      label: 'Erosion Reduction',
      description: 'Eliminates bare-field periods to prevent sheet, rill, and wind erosion on sloped terrain.',
      category: 'Agronomic',
    },
    {
      key: 'soilInfiltration',
      label: 'Soil Infiltration & Aeration',
      description: 'Promotes deep taproots (sunflower, radish) to fracture subsoil hardpans and facilitate drainage.',
      category: 'Agronomic',
    },
    {
      key: 'droughtResilience',
      label: 'Drought Resilience',
      description: 'Prioritizes C4 photosynthesis crops (sorghum) capable of withstanding multi-week dry spells.',
      category: 'Agronomic',
    },
    {
      key: 'cropDiversity',
      label: 'Crop Family Diversity',
      description: 'Rotates across Poaceae, Fabaceae, and Asteraceae to break host pest and weed cycles.',
      category: 'Agronomic',
    },
    {
      key: 'profitability',
      label: 'Short-Term Cash Profitability',
      description: 'Emphasizes immediate gross margins and established high-volume regional market channels.',
      category: 'Economic',
    },
    {
      key: 'marketSuitability',
      label: 'Local Market & Elevator Access',
      description: 'Considers whether regional grain elevators accept specialty pulse and grain crops.',
      category: 'Economic',
    },
    {
      key: 'forageValue',
      label: 'Livestock Forage & Grazing Value',
      description: 'Generates dual-purpose grazing or silage contracts from winter rye or small grains.',
      category: 'Economic',
    },
    {
      key: 'equipmentCompatibility',
      label: 'Standard Machinery Compatibility',
      description: 'Favors rotations manageable with standard row-crop planters, combines, and sprayers.',
      category: 'Operational',
    },
    {
      key: 'plantingHarvestConstraints',
      label: 'Local Planting & Harvest Window Constraints',
      description: 'Adapts to wet spring workability constraints and early autumn freeze risks.',
      category: 'Operational',
    },
  ];

  const handleSliderChange = (key: keyof FarmerPriorities, val: number) => {
    const updated = { ...priorities, [key]: val };
    setPriorities(updated);
  };

  const handlePreset = (type: 'conservation' | 'profit' | 'drought') => {
    if (type === 'conservation') {
      const p: FarmerPriorities = {
        waterConservation: 5,
        profitability: 3,
        forageValue: 3,
        nitrogenFixing: 5,
        soilOrganicMatter: 5,
        erosionReduction: 5,
        soilInfiltration: 4,
        marketSuitability: 3,
        droughtResilience: 4,
        cropDiversity: 4,
        equipmentCompatibility: 3,
        plantingHarvestConstraints: 3,
      };
      setPriorities(p);
      onApplyPriorities(p);
    } else if (type === 'profit') {
      const p: FarmerPriorities = {
        waterConservation: 2,
        profitability: 5,
        forageValue: 2,
        nitrogenFixing: 2,
        soilOrganicMatter: 3,
        erosionReduction: 2,
        soilInfiltration: 2,
        marketSuitability: 5,
        droughtResilience: 3,
        cropDiversity: 2,
        equipmentCompatibility: 5,
        plantingHarvestConstraints: 4,
      };
      setPriorities(p);
      onApplyPriorities(p);
    } else if (type === 'drought') {
      const p: FarmerPriorities = {
        waterConservation: 5,
        profitability: 4,
        forageValue: 2,
        nitrogenFixing: 3,
        soilOrganicMatter: 4,
        erosionReduction: 4,
        soilInfiltration: 4,
        marketSuitability: 4,
        droughtResilience: 5,
        cropDiversity: 4,
        equipmentCompatibility: 3,
        plantingHarvestConstraints: 4,
      };
      setPriorities(p);
      onApplyPriorities(p);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-8 border border-[#D5E5CA] shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8DE] pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold uppercase tracking-wider mb-1.5">
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span>Requirement A: Farmer Priorities Engine</span>
          </div>
          <h3 className="font-display text-fluid-h2 font-bold text-[#073D2B]">
            Define & Calibrate Your Farm Objectives
          </h3>
          <p className="text-xs text-[#527367] mt-1 max-w-2xl">
            We do not assume every farmer has identical goals. Adjust the relative importance of these 12 priorities
            to recalculate strategy scoring and see how strategy rankings adapt to your operation.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-[#527367]">Presets:</span>
          <button
            type="button"
            onClick={() => handlePreset('conservation')}
            className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#FAFDF8] border border-[#CDE5BA] hover:bg-[#EAF5DF] text-xs font-semibold text-[#145C3D] transition-colors"
          >
            Soil Health
          </button>
          <button
            type="button"
            onClick={() => handlePreset('profit')}
            className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#FAFDF8] border border-[#CDE5BA] hover:bg-[#EAF5DF] text-xs font-semibold text-[#145C3D] transition-colors"
          >
            High Liquidity
          </button>
          <button
            type="button"
            onClick={() => handlePreset('drought')}
            className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#FAFDF8] border border-[#CDE5BA] hover:bg-[#EAF5DF] text-xs font-semibold text-[#145C3D] transition-colors"
          >
            Drought Defense
          </button>
        </div>
      </div>

      {/* Explanatory Narrative Box */}
      {rankingExplanation && (
        <div className="p-4 rounded-2xl bg-[#F4F9EE] border border-[#D5E8C8] text-xs text-[#1F4A34] flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-[#76B93F] flex-shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <h4 className="font-bold text-sm text-[#073D2B]">How Changing Priorities Influenced Your Rankings</h4>
            <div className="leading-relaxed">{renderFormattedExplanation(rankingExplanation)}</div>
          </div>
        </div>
      )}

      {/* 12 Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {priorityFields.map((field) => {
          const val = priorities[field.key];
          return (
            <div
              key={field.key}
              className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#E2E8DE] hover:border-[#76B93F]/60 transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-[#073D2B]">{field.label}</span>
                  <span className="w-8 h-7 shrink-0 rounded-lg bg-[#EAF5DF] text-[#145C3D] font-display font-bold text-xs flex items-center justify-center">
                    {val}/5
                  </span>
                </div>
                <p className="text-[11px] text-[#527367] leading-snug">
                  {field.description}
                </p>
              </div>

              <div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={val}
                  onChange={(e) => handleSliderChange(field.key, Number(e.target.value))}
                  className="w-full accent-[#073D2B] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#527367] mt-1 font-medium">
                  <span>Low Weight</span>
                  <span>Moderate</span>
                  <span>Critical</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Button */}
      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <span className="text-xs text-[#527367] flex items-center gap-1.5">
          <Info className="w-4 h-4 text-[#76B93F] shrink-0" />
          <span>Adjusting sliders feeds real-time inputs into the Crop Rotation Engine algorithms.</span>
        </span>

        <button
          type="button"
          disabled={recalculating}
          onClick={() => onApplyPriorities(priorities)}
          className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 shrink-0"
        >
          {recalculating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Recalculating Strategy Matrix...</span>
            </>
          ) : (
            <>
              <span>Recalculate Strategy Rankings</span>
              <ArrowRight className="w-4 h-4 text-[#76B93F]" />
            </>
          )}
        </button>
      </div>

    </div>
  );
};
