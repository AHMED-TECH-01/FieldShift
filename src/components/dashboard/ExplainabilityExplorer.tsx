import React, { useState } from 'react';
import {
  FileCheck2,
  Satellite,
  Sprout,
  BookOpen,
  Sliders,
  TrendingUp,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CropRotationStrategy } from '../../types';

interface ExplainabilityExplorerProps {
  strategies: CropRotationStrategy[];
}

export const ExplainabilityExplorer: React.FC<ExplainabilityExplorerProps> = ({ strategies }) => {
  const [selectedCode, setSelectedCode] = useState<'A' | 'B' | 'C'>('B');
  const [openSection, setOpenSection] = useState<string | null>('nasa');

  const strat = strategies.find((s) => s.code === selectedCode) || strategies[0];
  const exp = strat?.explainability || {
    strategyCode: selectedCode,
    whySuggested: 'Recommended based on persisted farm soil characteristics and regional climate baselines.',
    nasaObservationsUsed: ['Sync NASA observations to view parcel-grounded telemetry'],
    soilInformationUsed: ['Persisted farm soil profile and lab test metrics'],
    cropCharacteristicsInfluenced: ['Water requirements and root architecture'],
    farmerPrioritiesInfluenced: ['Calibrated based on your 12 priority settings'],
    expectedPotentialBenefits: ['Optimized rotational yield and soil biological health'],
    environmentalAndAgriculturalRisks: ['Seasonal weather fluctuations and weed management'],
    missingInformation: ['Subsurface drainage tile telemetry'],
    uncertaintyAndLimitations: ['Coarse satellite spatial resolution (0.5° POWER / 9 km SMAP / 250 m MODIS)'],
    localExpertValidationChecklist: ['Verify with local County Extension Educator'],
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-8 border border-[#D5E5CA] shadow-sm space-y-6">
      
      {/* Header */}
      <div className="border-b border-[#E2E8DE] pb-5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold uppercase tracking-wider mb-2">
          <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
          <span>Requirements I & J: Recommendation Audit</span>
        </div>
        <h3 className="font-display text-fluid-h2 font-bold text-[#073D2B]">
          Transparent 10-Point Agronomic Recommendation Audit
        </h3>
        <p className="text-xs text-[#527367] mt-1 max-w-2xl">
          Every generated strategy discloses the specific NASA observations, soil measurements,
          crop characteristics, and farmer priorities that produced the scores, along with known uncertainties.
        </p>
      </div>

      {/* Strategy Switcher */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {(['A', 'B', 'C'] as const).map((code) => {
          const s = strategies.find((st) => st.code === code);
          const isSelected = selectedCode === code;
          return (
            <button
              type="button"
              key={code}
              onClick={() => setSelectedCode(code)}
              className={`w-full min-h-[56px] p-3 sm:p-3.5 rounded-2xl border text-left transition-all ${
                isSelected
                  ? 'bg-[#F2F8ED] border-[#76B93F] ring-2 ring-[#76B93F]/20'
                  : 'bg-white border-[#E2E8DE] hover:border-[#BAC9BE]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-display font-bold text-xs text-[#073D2B]">Strategy {code}</span>
                <span className="font-bold text-xs text-[#145C3D]">{s?.score}%</span>
              </div>
              <p className="text-[11px] text-[#527367] leading-snug">{s?.title}</p>
            </button>
          );
        })}
      </div>

      {/* 10 Explainability Panels */}
      <div className="space-y-3">
        
        {/* 1. Why Suggested */}
        <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA]">
          <h4 className="font-bold text-xs text-[#073D2B] uppercase tracking-wider mb-1.5 flex items-center gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-[#073D2B] text-white flex items-center justify-center text-[10px]">1</span>
            <span>Why This Strategy Was Suggested</span>
          </h4>
          <p className="text-xs text-[#2A4D3E] pl-3 sm:pl-7 leading-relaxed">{exp.whySuggested}</p>
        </div>

        {/* 2. NASA Observations Used */}
        <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA]">
          <h4 className="font-bold text-xs text-[#073D2B] uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-sky-700 text-white flex items-center justify-center text-[10px]">2</span>
            <span>NASA Earth Observations Grounding</span>
          </h4>
          <ul className="space-y-1.5 pl-6 sm:pl-7 text-xs text-[#2A4D3E]">
            {exp.nasaObservationsUsed.map((obs, i) => (
              <li key={i} className="list-disc">{obs}</li>
            ))}
          </ul>
        </div>

        {/* 3. Soil Information Used */}
        <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA]">
          <h4 className="font-bold text-xs text-[#073D2B] uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">3</span>
            <span>Local Soil Information Inputs</span>
          </h4>
          <ul className="space-y-1.5 pl-6 sm:pl-7 text-xs text-[#2A4D3E]">
            {exp.soilInformationUsed.map((soil, i) => (
              <li key={i} className="list-disc">{soil}</li>
            ))}
          </ul>
        </div>

        {/* 4. Crop Characteristics */}
        <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA]">
          <h4 className="font-bold text-xs text-[#073D2B] uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-amber-700 text-white flex items-center justify-center text-[10px]">4</span>
            <span>Crop Characteristics That Influenced The Recommendation</span>
          </h4>
          <ul className="space-y-1.5 pl-6 sm:pl-7 text-xs text-[#2A4D3E]">
            {exp.cropCharacteristicsInfluenced.map((crop, i) => (
              <li key={i} className="list-disc">{crop}</li>
            ))}
          </ul>
        </div>

        {/* 5. Farmer Priorities */}
        <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA]">
          <h4 className="font-bold text-xs text-[#073D2B] uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-indigo-700 text-white flex items-center justify-center text-[10px]">5</span>
            <span>Farmer Priorities That Influenced The Ranking</span>
          </h4>
          <ul className="space-y-1.5 pl-6 sm:pl-7 text-xs text-[#2A4D3E]">
            {exp.farmerPrioritiesInfluenced.map((prio, i) => (
              <li key={i} className="list-disc">{prio}</li>
            ))}
          </ul>
        </div>

        {/* 6. Potential Benefits */}
        <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA]">
          <h4 className="font-bold text-xs text-[#073D2B] uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px]">6</span>
            <span>Expected Potential Agronomic & Financial Benefits</span>
          </h4>
          <ul className="space-y-1.5 pl-6 sm:pl-7 text-xs text-emerald-900 font-medium">
            {exp.expectedPotentialBenefits.map((ben, i) => (
              <li key={i} className="list-disc">{ben}</li>
            ))}
          </ul>
        </div>

        {/* 7. Risks & Hazards */}
        <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA]">
          <h4 className="font-bold text-xs text-rose-900 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-rose-700 text-white flex items-center justify-center text-[10px]">7</span>
            <span>Environmental & Agricultural Risks</span>
          </h4>
          <ul className="space-y-1.5 pl-6 sm:pl-7 text-xs text-rose-800">
            {exp.environmentalAndAgriculturalRisks.map((risk, i) => (
              <li key={i} className="list-disc">{risk}</li>
            ))}
          </ul>
        </div>

        {/* 8. Missing Information */}
        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
          <h4 className="font-bold text-xs text-amber-900 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">8</span>
            <span>Missing Information Identified</span>
          </h4>
          <ul className="space-y-1.5 pl-6 sm:pl-7 text-xs text-amber-900">
            {exp.missingInformation.map((miss, i) => (
              <li key={i} className="list-disc">{miss}</li>
            ))}
          </ul>
        </div>

        {/* 9. Uncertainty & Limitations */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-slate-600 text-white flex items-center justify-center text-[10px]">9</span>
            <span>Uncertainty & Spatial Resolution Disclosures</span>
          </h4>
          <ul className="space-y-1.5 pl-6 sm:pl-7 text-xs text-slate-700">
            {exp.uncertaintyAndLimitations.map((unc, i) => (
              <li key={i} className="list-disc">{unc}</li>
            ))}
          </ul>
        </div>

        {/* 10. Local Expert Validation Checklist */}
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300">
          <h4 className="font-bold text-xs text-emerald-950 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 shrink-0 rounded-full bg-emerald-800 text-white flex items-center justify-center text-[10px]">10</span>
            <span>What Should Be Checked With Local Agricultural Experts</span>
          </h4>
          <ul className="space-y-1.5 pl-6 sm:pl-7 text-xs text-emerald-900 font-semibold">
            {exp.localExpertValidationChecklist.map((chk, i) => (
              <li key={i} className="list-disc">{chk}</li>
            ))}
          </ul>
        </div>

      </div>

    </div>
  );
};
