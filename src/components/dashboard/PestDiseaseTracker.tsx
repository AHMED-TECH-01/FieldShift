import React, { useState, useEffect } from 'react';
import { Bug, AlertOctagon, ShieldCheck, CheckCircle2, AlertTriangle, Layers, Info } from 'lucide-react';
import { PestCycleEvaluation } from '../../types';
import { apiClient } from '../../services/apiClient';

interface PestDiseaseTrackerProps {
  farmId: string;
}

export const PestDiseaseTracker: React.FC<PestDiseaseTrackerProps> = ({ farmId }) => {
  const [evaluations, setEvaluations] = useState<PestCycleEvaluation[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPestData();
  }, [farmId]);

  const fetchPestData = async () => {
    try {
      const json = await apiClient.get('/api/analysis/pest-cycles', { params: { farmId } });
      if (json.evaluations) {
        setEvaluations(json.evaluations);
        setFamilies(json.botanicalFamiliesUtilized || []);
      }
    } catch (e) {
      console.error('Failed to load pest cycle data', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-8 border border-[#D5E5CA] shadow-sm space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E2E8DE] pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-900 text-xs font-bold uppercase tracking-wider mb-2">
            <Bug className="w-3.5 h-3.5 shrink-0" />
            <span>Requirement D: Pest & Disease Cycle Engine</span>
          </div>
          <h3 className="font-display text-fluid-h2 font-bold text-[#073D2B]">
            Crop Family Host Disruption & Pathogen Suppression
          </h3>
          <p className="text-xs text-[#527367] mt-1 max-w-2xl">
            Evaluates botanical family succession across Poaceae (grasses), Fabaceae (legumes), and Asteraceae (composites)
            to break pest reproduction cycles and suppress soil-borne fungal pathogens.
          </p>
        </div>

        {/* Satellite Disclaimer */}
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 lg:max-w-xs text-[11px] text-rose-900 flex items-start gap-2">
          <AlertOctagon className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Mandatory Scientific Notice:</strong> Satellite observations alone CANNOT confirm insect or disease presence.
            Spectral stress indicates canopy decline; in-field physical scouting is required.
          </span>
        </div>
      </div>

      {/* Botanical Families Utilized Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {families.map((fam: any) => (
          <div key={fam.family} className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#E2E8DE] space-y-1">
            <span className="text-[10px] font-bold text-[#76B93F] uppercase tracking-wider">Botanical Family</span>
            <h4 className="font-bold text-sm text-[#073D2B]">{fam.family} ({fam.commonName})</h4>
            <p className="text-[11px] text-[#527367]">Rotated Crops: {fam.crops.join(', ')}</p>
          </div>
        ))}
      </div>

      {/* Comparative Evaluation Across Strategies */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {evaluations.map((evalItem) => {
          const isA = evalItem.strategyCode === 'A';
          const isB = evalItem.strategyCode === 'B';

          return (
            <div
              key={evalItem.strategyCode}
              className={`p-4 sm:p-6 rounded-3xl border space-y-4 flex flex-col justify-between ${
                isB
                  ? 'bg-[#FAFDF8] border-[#76B93F] ring-2 ring-[#76B93F]/20 shadow-xs'
                  : 'bg-white border-[#E2E8DE]'
              }`}
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-bold ${
                      isA
                        ? 'bg-amber-100 text-amber-900'
                        : isB
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-blue-100 text-blue-900'
                    }`}
                  >
                    STRATEGY {evalItem.strategyCode}
                  </span>
                  <span className="text-xs font-bold text-[#073D2B]">
                    Family Diversity: {evalItem.familyRotationDiversityScore}%
                  </span>
                </div>

                <h4 className="font-bold text-base text-[#073D2B]">
                  {isA
                    ? 'Monoculture Risk Profile'
                    : isB
                    ? 'Microbial Antagonism Profile'
                    : 'Multi-Family Interruption'}
                </h4>

                <div className="mt-4 pt-3 border-t border-[#E2E8DE] space-y-2 text-xs">
                  <div className="flex flex-wrap justify-between items-center gap-1">
                    <span className="text-[#527367]">Western Corn Rootworm:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        evalItem.cornRootwormRisk === 'High'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {evalItem.cornRootwormRisk} Risk
                    </span>
                  </div>

                  <div className="flex flex-wrap justify-between items-center gap-1">
                    <span className="text-[#527367]">Soybean Cyst Nematode:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        evalItem.soybeanCystNematodeRisk === 'High'
                          ? 'bg-rose-100 text-rose-800'
                          : evalItem.soybeanCystNematodeRisk === 'Moderate'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {evalItem.soybeanCystNematodeRisk} Risk
                    </span>
                  </div>

                  <div className="flex flex-wrap justify-between items-center gap-1">
                    <span className="text-[#527367]">Fusarium Soil Inoculum:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                        evalItem.fusariumHeadBlightRisk === 'Moderate'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {evalItem.fusariumHeadBlightRisk} Risk
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8DE] text-[11px] text-[#2A4D3E] leading-relaxed">
                <strong>Biological Mechanism:</strong> {evalItem.cycleBreakMechanism}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual Agroecological Intercropping Showcase */}
      <div className="rounded-2xl border border-[#D5E5CA] bg-[#FAFDF8] p-3.5 sm:p-5 space-y-3 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#76B93F] shrink-0" />
            <span className="text-xs font-bold text-[#073D2B]">Botanical Family Host Cycle Interruption in Action</span>
          </div>
          <span className="text-[10px] font-bold text-[#145C3D] bg-[#EAF5DF] px-2 py-0.5 rounded self-start sm:self-auto">
            Beneficial Predator Habitat &amp; Pathogen Disruption
          </span>
        </div>

        <div className="relative w-full h-56 sm:h-64 rounded-xl overflow-hidden border border-[#D5E5CA] shadow-2xs">
          <img
            src="/images/pest-crop-rotation.jpg"
            alt="Diversified crop rotation and intercropping field strips with sunflowers, legumes, and cereal grains attracting beneficial insect predators"
            width="1200"
            height="675"
            loading="lazy"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 right-2 bg-[#073D2B]/90 backdrop-blur-xs text-white p-2.5 rounded-lg text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
            <span><strong>Multi-Family Polyculture:</strong> Poaceae + Fabaceae + Asteraceae succession</span>
            <span className="text-[#76B93F]">Natural non-host interruption of rootworm &amp; nematode cycles</span>
          </div>
        </div>
      </div>

    </div>
  );
};
