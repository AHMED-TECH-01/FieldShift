import React, { useState } from 'react';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import {
  Sprout,
  Droplets,
  Layers,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Beaker,
  Thermometer,
  Info,
} from 'lucide-react';

interface SoilIntelligencePageProps {
  onNavigate: (path: string) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
}

export const SoilIntelligencePage: React.FC<SoilIntelligencePageProps> = ({
  onNavigate,
  onOpenAuth,
}) => {
  const [selectedSoilType, setSelectedSoilType] = useState<'silt-loam' | 'clay-loam' | 'sandy-loam'>('silt-loam');

  const soilData = {
    'silt-loam': {
      name: 'Clarion-Nicollet Silt Loam',
      location: 'Midwest Glacial Till / Loess',
      ph: 6.4,
      om: '3.8%',
      cec: '22 meq/100g',
      waterCapacity: '2.2 in / ft',
      drainage: 'Moderately Well Drained',
      holdingGallons: '92,000 gal/ac',
      compactionRisk: 'Moderate to High in Early Spring',
      strengths: ['High natural fertility', 'Excellent capillary rise', 'Responds rapidly to cover crops'],
      vulnerabilities: ['Subsoil plow pans from heavy axle loads', 'Crusting under bare winter exposure'],
    },
    'clay-loam': {
      name: 'Webster Silty Clay Loam',
      location: 'Depressional Swales & Potholes',
      ph: 6.8,
      om: '4.6%',
      cec: '34 meq/100g',
      waterCapacity: '2.0 in / ft',
      drainage: 'Poorly Drained (Requires Tile)',
      holdingGallons: '110,000 gal/ac',
      compactionRisk: 'Severe when soil moisture exceeds plastic limit',
      strengths: ['Massive nutrient buffering', 'Exceptional organic matter ceiling', 'Drought-proof deep moisture'],
      vulnerabilities: ['Delayed spring field access', 'Denitrification during standing ponding'],
    },
    'sandy-loam': {
      name: 'Sparta Alluvial Sandy Loam',
      location: 'River Valleys & Outwash Plains',
      ph: 5.9,
      om: '1.9%',
      cec: '11 meq/100g',
      waterCapacity: '1.1 in / ft',
      drainage: 'Excessively Drained',
      holdingGallons: '44,000 gal/ac',
      compactionRisk: 'Low (Rapid aggregate drainage)',
      strengths: ['Warm spring soil temperatures', 'Early planting window', 'No ponding risk'],
      vulnerabilities: ['Rapid nitrate leaching', 'Frequent mid-summer drought stress'],
    },
  };

  const active = soilData[selectedSoilType];

  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Breadcrumb Header */}
        <div>
          <Breadcrumbs
            items={[
              { label: 'Platform', path: '/features' },
              { label: 'Soil Intelligence' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
                Ground Chemistry & Physical Physics
              </span>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B] mt-1">
                Precision Soil Intelligence
              </h1>
              <p className="text-sm sm:text-base text-[#527367] mt-2 max-w-2xl leading-relaxed">
                Fusing certified laboratory soil core assays with USDA NRCS SSURGO digital surveys and
                NASA SMAP microwave root-zone telemetry for deep agronomic clarity.
              </p>
            </div>
            <button
              onClick={() => onNavigate('/dashboard/soil-intelligence')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] text-white text-xs sm:text-sm font-semibold hover:bg-[#145C3D] transition-all shadow-md self-start md:self-auto"
            >
              <span>Explore Farm Soil in Dashboard</span>
              <ArrowRight className="w-4 h-4 text-[#76B93F]" />
            </button>
          </div>
        </div>

        {/* Soil Selector Switcher */}
        <div className="p-6 rounded-3xl bg-white border border-[#D5E5CA] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8DE] pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#145C3D]" />
              <h2 className="font-bold text-base text-[#073D2B]">Select Soil Texture Profile</h2>
            </div>
            <span className="text-xs text-[#527367]">
              Compare physical hydraulic capacity across distinct agricultural soils
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {[
              { id: 'silt-loam', label: 'Silt Loam (Clarion Series)', badge: 'Predominant Midwest' },
              { id: 'clay-loam', label: 'Clay Loam (Webster Series)', badge: 'High OM / Swale' },
              { id: 'sandy-loam', label: 'Sandy Loam (Sparta Series)', badge: 'Rapid Drainage' },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setSelectedSoilType(btn.id as any)}
                className={`p-4 rounded-2xl text-left border transition-all ${
                  selectedSoilType === btn.id
                    ? 'bg-[#EAF5DF] border-[#76B93F] text-[#073D2B] font-bold shadow-xs'
                    : 'bg-white border-[#E2E8DE] text-[#527367] hover:border-[#76B93F]/50'
                }`}
              >
                <div className="text-xs uppercase tracking-wider font-semibold text-[#145C3D]">
                  {btn.badge}
                </div>
                <div className="text-sm font-bold mt-1 text-[#073D2B]">{btn.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Active Profile Telemetry Display */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-1">
            <span className="text-xs font-bold text-[#145C3D] uppercase">Soil pH Index</span>
            <div className="font-display text-3xl font-extrabold text-[#073D2B]">{active.ph}</div>
            <p className="text-[11px] text-[#527367]">Target: 6.2 – 6.8 for optimal N nodulation.</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-1">
            <span className="text-xs font-bold text-[#145C3D] uppercase">Soil Organic Matter</span>
            <div className="font-display text-3xl font-extrabold text-[#073D2B]">{active.om}</div>
            <p className="text-[11px] text-[#527367]">Buffers ~{active.holdingGallons} available moisture.</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-1">
            <span className="text-xs font-bold text-[#145C3D] uppercase">Cation Exchange (CEC)</span>
            <div className="font-display text-3xl font-extrabold text-[#073D2B]">{active.cec}</div>
            <p className="text-[11px] text-[#527367]">Measures calcium, magnesium & potassium retention.</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-1">
            <span className="text-xs font-bold text-[#145C3D] uppercase">Available Water Cap.</span>
            <div className="font-display text-3xl font-extrabold text-[#073D2B]">{active.waterCapacity}</div>
            <p className="text-[11px] text-[#527367]">Pore moisture available to crop root hairs.</p>
          </div>
        </div>

        {/* Scientific Soil Dynamics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-[#D5E5CA] shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#145C3D] font-bold text-base">
              <Sprout className="w-5 h-5 text-[#76B93F]" />
              <h3>Biological Holding Capacity & Soil Armor</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              Every 1% increase in Soil Organic Matter (SOM) allows the top 12 inches of soil to retain an
              additional <strong>20,000 to 27,000 gallons of water per acre</strong>. In Field Shift, our rotation
              algorithms evaluate the residue decomposition rates (C:N ratio) of multi-species cover crops to
              calculate active carbon sequestration without tying up available spring nitrogen.
            </p>
            <div className="space-y-2 pt-2 text-xs">
              {active.strengths.map((str, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[#2A4D3E]">
                  <CheckCircle2 className="w-4 h-4 text-[#76B93F] flex-shrink-0" />
                  <span>{str}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-[#D5E5CA] shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#073D2B] font-bold text-base">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h3>Compaction Hazards & Plow-Pan Mitigation</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              Heavy equipment axle traffic (combines and grain carts exceeding 10 tons per axle) drives physical
              compaction down into the 25–40 cm subsoil horizon, creating an impermeable barrier that stunts taproot
              growth and promotes horizontal root bending.
            </p>
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs text-amber-900">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Biological Remediation Strategy</span>
              </div>
              <p>
                Rather than burning costly diesel on mechanical subsoilers, rotating in deep-root brassicas
                (Daikon / Forage Radish) generates natural bio-drilling channels that fracture hardpans while
                scavenging residual nitrate from deep subsoil layers.
              </p>
            </div>
          </div>
        </div>

        {/* NASA SMAP Microwave Ingestion Note */}
        <div className="p-6 rounded-3xl bg-[#073D2B] text-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2 text-[#9BD85A] text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              NASA SMAP L4 Microwave Soil Ingestion
            </div>
            <h3 className="font-display text-xl font-bold">
              Root-Zone Moisture Calibration
            </h3>
            <p className="text-xs text-white/80 leading-relaxed">
              NASA’s Soil Moisture Active Passive (SMAP) satellite measures L-band surface radiation (0–5 cm)
              and pairs it with the Catchment Land Surface Model to infer root-zone moisture (0–100 cm),
              alerting you when soil deficits threaten pollination windows.
            </p>
          </div>
          <button
            onClick={() => onNavigate('/resources/ssurgo-integration')}
            className="px-6 py-3 rounded-full bg-[#76B93F] hover:bg-[#9BD85A] text-[#073D2B] font-bold text-xs sm:text-sm whitespace-nowrap shadow-md transition-all"
          >
            Read SSURGO & SMAP Guide
          </button>
        </div>

      </div>
    </div>
  );
};
