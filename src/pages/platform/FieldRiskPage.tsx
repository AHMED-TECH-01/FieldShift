import React, { useState } from 'react';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import {
  AlertTriangle,
  ShieldAlert,
  Droplets,
  Thermometer,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Activity,
  Layers,
  MapPin,
} from 'lucide-react';

interface FieldRiskPageProps {
  onNavigate: (path: string) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
}

export const FieldRiskPage: React.FC<FieldRiskPageProps> = ({ onNavigate, onOpenAuth }) => {
  const [selectedHazard, setSelectedHazard] = useState<'drought' | 'heat' | 'erosion' | 'frost'>('erosion');

  const hazardDetails = {
    drought: {
      title: 'Root-Zone Drought & Soil Moisture Deficit',
      sensor: 'NASA SMAP L4 (9 km) + Catchment Model',
      riskScore: 'Moderate (28%)',
      statusColor: 'text-amber-700 bg-amber-50 border-amber-200',
      description:
        'Tracks volumetric soil moisture content in the 0–100 cm root profile. A drop below 0.22 m³/m³ during silking/tasseling triggers immediate yield reduction penalties in our predictive models.',
      mitigation:
        'Incorporate cereal rye cover crops to establish living surface residue that reduces soil surface evaporation by up to 40% during July dry spells.',
    },
    heat: {
      title: 'Pollination Window Thermal Stress',
      sensor: 'NASA POWER Agroclimatology (0.5° Daily)',
      riskScore: 'High (52%)',
      statusColor: 'text-rose-700 bg-rose-50 border-rose-200',
      description:
        'Monitors consecutive days with maximum ambient temperatures exceeding 33°C (91.4°F) during peak flowering, which dessicates corn silks and renders pollen non-viable.',
      mitigation:
        'Split planting maturities between 104-day and 111-day hybrids to stagger pollination across separate two-week intervals, avoiding total crop exposure.',
    },
    erosion: {
      title: 'Slope Runoff & Sheet/Rill Soil Loss',
      sensor: 'NASA SRTM 30m DEM + GPM IMERG 30-min Rain',
      riskScore: 'Severe (68% on 2.3% slopes)',
      statusColor: 'text-rose-700 bg-rose-50 border-rose-200',
      description:
        'Calculates localized water velocity across field topography. High-intensity rainfall events exceeding 25 mm/hr on bare ground detach topsoil particles and wash away applied fertilizer.',
      mitigation:
        'Maintain continuous winter vegetative cover and install 15-foot perennial grass contour buffer strips along critical slope breaks identified by SRTM elevation.',
    },
    frost: {
      title: 'Early Autumn / Late Spring Freeze Hazard',
      sensor: 'NASA POWER Minimum Temperature Climatology',
      riskScore: 'Low (14%)',
      statusColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      description:
        'Assesses the statistical probability of freezing air temperatures (<0°C) before physiological crop maturity (black layer in corn, brown pod in soybeans).',
      mitigation:
        'Verify Growing Degree Day (GDD) accumulation curves before selecting full-season cover crop blends to ensure establishment prior to the first killing frost.',
    },
  };

  const current = hazardDetails[selectedHazard];

  return (
    <div className="py-8 sm:py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        
        {/* Breadcrumb Header */}
        <div>
          <Breadcrumbs
            items={[
              { label: 'Platform', path: '/features' },
              { label: 'Field Risk Diagnostic' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
                Geospatial Vulnerability Assessment
              </span>
              <h1 className="font-display text-fluid-h1 font-extrabold text-[#073D2B] mt-1">
                Field Risk & Multi-Hazard Diagnostic
              </h1>
              <p className="text-fluid-lead text-[#527367] mt-2 max-w-2xl leading-relaxed">
                Anticipate environmental risks before they impact harvest margins using NASA SRTM topography,
                GPM IMERG storm intensity, and NASA POWER agroclimatology.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/field-risk')}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] text-white text-xs sm:text-sm font-semibold hover:bg-[#145C3D] transition-all shadow-md self-start md:self-auto shrink-0"
            >
              <span>View Field Risk in Dashboard</span>
              <ArrowRight className="w-4 h-4 text-[#76B93F] shrink-0" />
            </button>
          </div>
        </div>

        {/* Multi-Hazard Risk Matrix Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { id: 'erosion', label: 'Erosion & Runoff', icon: AlertTriangle, score: '68%', color: 'border-rose-300 text-rose-700' },
            { id: 'heat', label: 'Thermal Heat Waves', icon: Thermometer, score: '52%', color: 'border-rose-300 text-rose-700' },
            { id: 'drought', label: 'Root-Zone Moisture', icon: Droplets, score: '28%', color: 'border-amber-300 text-amber-700' },
            { id: 'frost', label: 'Early Frost Exposure', icon: ShieldAlert, score: '14%', color: 'border-emerald-300 text-emerald-700' },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = selectedHazard === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setSelectedHazard(item.id as any)}
                className={`text-left w-full p-4 sm:p-5 rounded-3xl cursor-pointer border transition-all min-w-0 ${
                  isSelected
                    ? 'bg-white border-[#76B93F] ring-2 ring-[#76B93F]/30 shadow-md'
                    : 'bg-white/80 border-[#D5E5CA] hover:border-[#76B93F]/50 shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${item.color} bg-white shrink-0`}>
                    {item.score}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-[#073D2B]">{item.label}</h3>
                <p className="text-[11px] text-[#527367] mt-0.5">Tap to view NASA diagnostic</p>
              </button>
            );
          })}
        </div>

        {/* Active Hazard Detailed Deep-Dive */}
        <div className="p-5 sm:p-8 rounded-3xl bg-white border border-[#D5E5CA] shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-[#E2E8DE] pb-4">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
                Active Hazard Diagnostic
              </span>
              <h2 className="font-display text-fluid-h2 font-bold text-[#073D2B] mt-1">
                {current.title}
              </h2>
            </div>
            <div className={`self-start sm:self-auto px-4 py-1.5 rounded-full text-xs font-bold border ${current.statusColor} shrink-0`}>
              Model Index: {current.riskScore}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div className="space-y-4 min-w-0">
              <h3 className="font-bold text-base text-[#073D2B]">Detection Architecture</h3>
              <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
                {current.description}
              </p>
              <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#E2E8DE] space-y-2 text-xs text-[#2A4D3E]">
                <div className="font-bold text-[#073D2B]">Primary NASA Observation Stream:</div>
                <p className="font-mono text-xs text-[#145C3D] break-words">{current.sensor}</p>
                <p className="text-[#527367]">
                  Processed continuously against your digital field boundary coordinates.
                </p>
              </div>
            </div>

            <div className="space-y-4 min-w-0">
              <h3 className="font-bold text-base text-[#073D2B]">Recommended Agronomic Mitigation</h3>
              <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
                {current.mitigation}
              </p>
              <div className="p-4 rounded-2xl bg-[#EAF5DF] border border-[#CDE5BA] space-y-2 text-xs text-[#145C3D]">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#76B93F] shrink-0" />
                  <span>Integrated Crop Sequence Solution</span>
                </div>
                <p>
                  Our crop rotation simulator factors this specific hazard index into Strategy B and Strategy C
                  rankings, automatically elevating practices that protect vulnerable field zones.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scientific Humility & Disclaimer */}
        <div className="p-4 sm:p-6 rounded-3xl bg-amber-50/70 border border-amber-200 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <h3>Spatial Resolution & Scientific Disclosure</h3>
          </div>
          <p className="text-xs text-amber-900/90 leading-relaxed">
            Satellite observations provide broad-area environmental indicators (SMAP 9km, GPM 10km, MODIS 250m).
            While digital elevation models (SRTM 30m) map surface slopes, localized soil compaction, underground
            tile drainage performance, and micro-climate pockets must always be verified with on-site field inspection
            and certified agronomic expertise.
          </p>
        </div>

      </div>
    </div>
  );
};
