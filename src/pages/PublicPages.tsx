import React from 'react';
import {
  Satellite,
  Sprout,
  RefreshCw,
  BarChart3,
  Bot,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Award,
  Layers,
  Sparkles,
  Info,
  Globe2,
} from 'lucide-react';

interface PublicPageProps {
  onNavigate: (path: string) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
}

/* ==========================================================================
   ABOUT PAGE
   ========================================================================== */
export const AboutPage: React.FC<PublicPageProps> = ({ onNavigate, onOpenAuth }) => {
  return (
    <div className="py-8 sm:py-12 md:py-20 bg-[#F8F7ED] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
        
        {/* Hero */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold uppercase tracking-wider">
            <Award className="w-3.5 h-3.5 shrink-0" />
            <span>NASA Earth Science Applied Agriculture</span>
          </div>
          <h1 className="font-display text-fluid-h1 font-extrabold text-[#073D2B] tracking-tight">
            Science-Backed Crop Intelligence for Lasting Land Resilience
          </h1>
          <p className="text-fluid-lead text-[#527367] leading-relaxed">
            Field Shift was born from a fundamental belief: farmers should have the same advanced
            remote sensing technologies used by climate scientists to protect their soil, water, and economic future.
          </p>
        </div>

        {/* Mission Card */}
        <div className="bg-white rounded-3xl p-5 sm:p-8 md:p-10 border border-[#D5E5CA] shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 items-center">
          <div className="space-y-4 min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">Our Core Philosophy</span>
            <h2 className="font-display text-fluid-h2 font-bold text-[#073D2B]">
              Supporting Farmer Judgment, Never Replacing It
            </h2>
            <p className="text-sm text-[#2A4D3E] leading-relaxed">
              We bridge the gap between orbital NASA satellites and hands-on ground reality. We do not
              invent artificial precision or offer black-box algorithms. Instead, every rotation score,
              water estimate, and soil recommendation provides transparent scientific provenance.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] text-white text-xs sm:text-sm font-semibold hover:bg-[#145C3D] transition-all shadow-md"
              >
                <span>Join the Field Shift Movement</span>
                <ArrowRight className="w-4 h-4 text-[#76B93F] shrink-0" />
              </button>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#073D2B] to-[#145C3D] p-5 sm:p-6 text-white space-y-4 min-w-0">
            <div className="flex items-center gap-2 text-[#9BD85A] text-xs font-bold uppercase">
              <ShieldCheck className="w-4 h-4" />
              Agronomic Integrity Code
            </div>
            <ul className="space-y-3 text-xs text-white/85">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#76B93F] flex-shrink-0 mt-0.5" />
                <span>Zero fabricated satellite readings — only authenticated open data from NASA archives.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#76B93F] flex-shrink-0 mt-0.5" />
                <span>Explicit resolution disclosure (SMAP 9km, GPM 10km, MODIS 250m, ECOSTRESS 70m).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#76B93F] flex-shrink-0 mt-0.5" />
                <span>No commercial pesticide or chemical fertilizer kickbacks influencing recommendations.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Scientific Advisory Team */}
        <div className="space-y-6">
          <div className="text-center">
            <h3 className="font-display text-2xl font-bold text-[#073D2B]">Agronomic & Remote Sensing Council</h3>
            <p className="text-xs text-[#527367] mt-1">Interdisciplinary research guiding our computational models.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-[#E2E8DE] text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-[#EAF5DF] text-[#145C3D] font-display font-bold text-lg flex items-center justify-center mx-auto">
                DR
              </div>
              <h4 className="font-bold text-sm text-[#073D2B]">Dr. Elena Vance, PhD</h4>
              <p className="text-xs text-[#76B93F] font-semibold">Remote Sensing & Soil Physics</p>
              <p className="text-[11px] text-[#527367]">Former research associate at USDA-ARS Hydrology & Remote Sensing Lab.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#E2E8DE] text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-[#EAF5DF] text-[#145C3D] font-display font-bold text-lg flex items-center justify-center mx-auto">
                MK
              </div>
              <h4 className="font-bold text-sm text-[#073D2B]">Marcus Kowalski, CCA</h4>
              <p className="text-xs text-[#76B93F] font-semibold">Chief Agronomist & Crop Rotation Lead</p>
              <p className="text-[11px] text-[#527367]">25+ years managing 180,000+ acres of Midwestern grain rotations.</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-[#E2E8DE] text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-[#EAF5DF] text-[#145C3D] font-display font-bold text-lg flex items-center justify-center mx-auto">
                AR
              </div>
              <h4 className="font-bold text-sm text-[#073D2B]">Ahmed Raza, MSc</h4>
              <p className="text-xs text-[#76B93F] font-semibold">Lead Geospatial Software Architect</p>
              <p className="text-[11px] text-[#527367]">Specialist in real-time geospatial pipelines, PostGIS, and Gemini integration.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

/* ==========================================================================
   FEATURES PAGE
   ========================================================================== */
export const FeaturesPage: React.FC<PublicPageProps> = ({ onNavigate, onOpenAuth }) => {
  const featureList = [
    {
      icon: Satellite,
      badge: 'PILLAR 1',
      title: 'NASA Earth Observations Integration',
      description:
        'Continuous ingestion of SMAP soil moisture, GPM precipitation anomalies, and MODIS vegetation vigor indexed directly to your farm boundaries.',
      specs: ['SMAP L4 (9km root zone)', 'GPM IMERG (10km 30-min rain)', 'MODIS MOD13Q1 (250m NDVI)'],
      color: 'text-sky-700 bg-sky-50',
    },
    {
      icon: Sprout,
      badge: 'PILLAR 2',
      title: 'Precision Soil Intelligence',
      description:
        'Combines laboratory core tests (pH, OM%, N-P-K, CEC) with NRCS drainage classes to calculate biological holding capacity and compaction risks.',
      specs: ['Water holding capacity equations', 'Biological nitrogen budgeting', 'Soil texture triangle integration'],
      color: 'text-emerald-700 bg-emerald-50',
    },
    {
      icon: RefreshCw,
      badge: 'PILLAR 3',
      title: 'Multi-Year Crop Rotation Engine',
      description:
        'Evaluates Strategy A (Baseline), Strategy B (Soil Restoration), and Strategy C (Climate Resilience) with transparent scoring and full agronomic caveats.',
      specs: ['Cover crop termination calendar', 'Continuous root calculations', 'Rootworm & pathogen break cycles'],
      color: 'text-amber-700 bg-amber-50',
    },
    {
      icon: BarChart3,
      badge: 'PILLAR 4',
      title: 'Field Risk & Hazard Diagnostic',
      description:
        'Multi-hazard vulnerability matrix tracking drought spells, heat spikes during pollination, flood runoff risks, and early frost exposures.',
      specs: ['SRTM 30m slope runoff hazards', 'NASA POWER thermal heat indices', 'Multi-tier risk radar matrix'],
      color: 'text-rose-700 bg-rose-50',
    },
    {
      icon: Bot,
      badge: 'PILLAR 5',
      title: 'Gemini AI Agricultural Advisor',
      description:
        'Server-side Gemini 3.8 Flash agronomic copilot grounded in your farm specific satellite metrics, explaining scientific terminology and trade-offs.',
      specs: ['Grounded in farm telemetry', 'Uncertainty-aware responses', 'Actionable agronomic guidance'],
      color: 'text-[#145C3D] bg-[#EAF5DF]',
    },
  ];

  return (
    <div className="py-8 sm:py-12 md:py-20 bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">Complete Platform Architecture</span>
          <h1 className="font-display text-fluid-h1 font-extrabold text-[#073D2B]">
            Engineered for Modern Agriculture
          </h1>
          <p className="text-fluid-lead text-[#527367]">
            Five interconnected technological pillars working together to maximize farm profitability, soil health, and climate durability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {featureList.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="p-5 sm:p-6 rounded-3xl bg-[#FAFDF8] border border-[#D5E5CA] hover:border-[#76B93F] transition-all shadow-2xs space-y-4 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className={`w-12 h-12 rounded-2xl ${f.color} flex items-center justify-center shrink-0`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-bold tracking-widest text-[#527367] bg-white px-2 py-1 rounded-md border border-[#E2E8DE]">
                      {f.badge}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-[#073D2B]">{f.title}</h3>
                  <p className="text-xs text-[#527367] mt-2 leading-relaxed">{f.description}</p>
                </div>

                <div className="pt-4 border-t border-[#E2E8DE]/80 space-y-1.5">
                  {f.specs.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[11px] text-[#2A4D3E]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#76B93F] flex-shrink-0" />
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-5 sm:p-8 rounded-3xl bg-[#073D2B] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
          <div className="min-w-0">
            <h3 className="font-display text-fluid-h2 font-bold">Ready to analyze your farm?</h3>
            <p className="text-xs sm:text-sm text-white/80 mt-1">Get instant access to NASA observations and crop rotation comparisons.</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenAuth('signup')}
            className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-full bg-[#76B93F] hover:bg-[#9BD85A] text-[#073D2B] font-bold text-sm shadow-md transition-all text-center shrink-0"
          >
            Create Free Account
          </button>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   NASA DATA PAGE
   ========================================================================== */
export const NasaDataPage: React.FC<PublicPageProps> = ({ onNavigate, onOpenAuth }) => {
  return (
    <div className="py-8 sm:py-12 md:py-20 bg-[#F8F7ED] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#CDE5BA] text-xs font-bold text-[#073D2B]">
            <span className="w-2 h-2 rounded-full bg-[#0B3D91] shrink-0" />
            <span>NASA Earth Science Division Missions</span>
          </div>
          <h1 className="font-display text-fluid-h1 font-extrabold text-[#073D2B]">
            NASA Earth Science Applied to Agriculture
          </h1>
          <p className="text-fluid-lead text-[#527367]">
            Understanding the orbital satellites, atmospheric models, and ground radars that power the Field Shift intelligence platform.
          </p>
        </div>

        <div className="space-y-5 sm:space-y-6">
          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#D5E5CA] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Satellite className="w-5 h-5 text-sky-600 shrink-0" />
                <h3 className="font-bold text-base sm:text-lg text-[#073D2B]">SMAP — Soil Moisture Active Passive</h3>
              </div>
              <span className="self-start sm:self-auto text-xs bg-sky-50 text-sky-800 px-3 py-1 rounded-full font-semibold shrink-0">L-Band Microwave</span>
            </div>
            <p className="text-xs text-[#2A4D3E] leading-relaxed">
              NASA’s SMAP spacecraft utilizes an L-band microwave radiometer to detect changes in the dielectric constant of topsoil,
              which varies dramatically with water content. By coupling these surface measurements with the NASA Catchment Land Surface Model,
              SMAP produces the L4 root-zone product (0–100 cm depth) essential for calculating crop drought stress.
            </p>
            <div className="p-3 bg-[#FAFDF8] rounded-xl border border-[#E2E8DE] text-[11px] text-[#527367] grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-2">
              <div><strong className="text-[#073D2B]">Resolution:</strong> 9 km grid</div>
              <div><strong className="text-[#073D2B]">Revisit:</strong> 2–3 days</div>
              <div><strong className="text-[#073D2B]">Depth:</strong> 0-5cm & 0-100cm</div>
              <div><strong className="text-[#073D2B]">Archive:</strong> GES DISC</div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#D5E5CA] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Satellite className="w-5 h-5 text-emerald-600 shrink-0" />
                <h3 className="font-bold text-base sm:text-lg text-[#073D2B]">GPM IMERG — Global Precipitation Measurement</h3>
              </div>
              <span className="self-start sm:self-auto text-xs bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full font-semibold shrink-0">Dual Radar + Constellation</span>
            </div>
            <p className="text-xs text-[#2A4D3E] leading-relaxed">
              IMERG (Integrated Multi-satellite Retrievals for GPM) unifies precipitation data from a constellation of 10+ international satellites.
              It tracks extreme rainfall events, continuous rain deficits, and localized storm cells, providing historical anomalies essential for erosion prevention.
            </p>
            <div className="p-3 bg-[#FAFDF8] rounded-xl border border-[#E2E8DE] text-[11px] text-[#527367] grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-2">
              <div><strong className="text-[#073D2B]">Resolution:</strong> 0.1° (~10 km)</div>
              <div><strong className="text-[#073D2B]">Frequency:</strong> Every 30 minutes</div>
              <div><strong className="text-[#073D2B]">Calibration:</strong> GPCC Surface Gauges</div>
              <div><strong className="text-[#073D2B]">Archive:</strong> NASA PPS</div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 sm:p-8 border border-[#D5E5CA] shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Satellite className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="font-bold text-base sm:text-lg text-[#073D2B]">MODIS MOD13Q1 — Terra & Aqua Reflectance</h3>
              </div>
              <span className="self-start sm:self-auto text-xs bg-amber-50 text-amber-800 px-3 py-1 rounded-full font-semibold shrink-0">250m Multispectral</span>
            </div>
            <p className="text-xs text-[#2A4D3E] leading-relaxed">
              Provides continuity of global vegetation index measurements (NDVI and Enhanced Vegetation Index - EVI).
              Used by Field Shift to verify vegetative canopy cover during winter months, proving whether cover crops have successfully established.
            </p>
            <div className="p-3 bg-[#FAFDF8] rounded-xl border border-[#E2E8DE] text-[11px] text-[#527367] grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-4 gap-2">
              <div><strong className="text-[#073D2B]">Resolution:</strong> 250 meters</div>
              <div><strong className="text-[#073D2B]">Cadence:</strong> 16-day composited</div>
              <div><strong className="text-[#073D2B]">Spectrum:</strong> Red & Near-Infrared</div>
              <div><strong className="text-[#073D2B]">Archive:</strong> LP DAAC</div>
            </div>
          </div>
        </div>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard/earth-observation')}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] text-white text-xs sm:text-sm font-semibold hover:bg-[#145C3D] transition-all shadow-md"
          >
            <span>Launch Live NASA Telemetry Dashboard</span>
            <ArrowRight className="w-4 h-4 text-[#76B93F] shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   SOLUTIONS PAGE
   ========================================================================== */
export const SolutionsPage: React.FC<PublicPageProps> = ({ onNavigate, onOpenAuth }) => {
  return (
    <div className="py-8 sm:py-12 md:py-20 bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">Agricultural Sectors</span>
          <h1 className="font-display text-fluid-h1 font-extrabold text-[#073D2B]">
            Tailored Solutions for Every Farm Scale
          </h1>
          <p className="text-fluid-lead text-[#527367]">
            Whether you manage a 400-acre family operation or coordinate a 50,000-acre watershed district, Field Shift provides dedicated intelligence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          <div className="p-5 sm:p-8 rounded-3xl bg-[#FAFDF8] border border-[#D5E5CA] space-y-4">
            <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">Family & Row-Crop Farms</span>
            <h3 className="font-bold text-xl sm:text-2xl text-[#073D2B]">Cut Synthetic Inputs Without Sacrificing Margins</h3>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              Transition smoothly away from vulnerable monocultures. Model the real nitrogen contribution of winter hairy vetch and crimson clover,
              and reduce synthetic N purchases by up to 35% within 3 seasons.
            </p>
            <ul className="space-y-2 text-xs text-[#2A4D3E] pt-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#76B93F] shrink-0 mt-0.5" />
                <span>Field-specific planting & termination calendars</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#76B93F] shrink-0 mt-0.5" />
                <span>Rootworm life-cycle disruption timelines</span>
              </li>
            </ul>
          </div>

          <div className="p-5 sm:p-8 rounded-3xl bg-[#FAFDF8] border border-[#D5E5CA] space-y-4">
            <span className="inline-block px-3 py-1 rounded-full bg-sky-100 text-sky-800 text-xs font-bold">Regenerative Co-operatives</span>
            <h3 className="font-bold text-xl sm:text-2xl text-[#073D2B]">Verified Carbon & Soil Health Documentation</h3>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              Provide satellite-verified proof of continuous living root cover to premium grain buyers, regenerative certification bodies,
              and ecosystem service markets.
            </p>
            <ul className="space-y-2 text-xs text-[#2A4D3E] pt-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#76B93F] shrink-0 mt-0.5" />
                <span>Independent MODIS canopy persistence audits</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#76B93F] shrink-0 mt-0.5" />
                <span>Multi-farm aggregation & collective seed purchasing models</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => onOpenAuth('signup')}
            className="w-full sm:w-auto min-h-[44px] px-8 py-3.5 rounded-full bg-[#073D2B] text-white text-sm font-bold hover:bg-[#145C3D] transition-all shadow-md"
          >
            Start Farm Profile Setup
          </button>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   RESOURCES PAGE
   ========================================================================== */
export const ResourcesPage: React.FC<PublicPageProps> = ({ onNavigate }) => {
  return (
    <div className="py-8 sm:py-12 md:py-20 bg-[#F8F7ED] min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">Knowledge Base & Research</span>
          <h1 className="font-display text-fluid-h1 font-extrabold text-[#073D2B]">
            Scientific Resources & Documentation
          </h1>
          <p className="text-fluid-lead text-[#527367]">
            Peer-reviewed agronomic papers, open-source datasets, and step-by-step guides for crop rotation design.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-[#D5E5CA] shadow-2xs flex items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-[10px] font-bold text-[#76B93F] uppercase">Technical Brief</span>
              <h4 className="font-bold text-sm sm:text-base text-[#073D2B]">
                Soil Moisture Active Passive (SMAP) Root-Zone Calibration for Midwest Loams
              </h4>
              <p className="text-xs text-[#527367]">NASA Goddard Space Flight Center & Iowa State Extension joint methodology note.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/nasa-data')}
              aria-label="Open SMAP calibration technical brief"
              className="w-11 h-11 shrink-0 rounded-xl bg-[#F0F5EE] hover:bg-[#EAF5DF] text-[#073D2B] transition-colors flex items-center justify-center"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-[#D5E5CA] shadow-2xs flex items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-[10px] font-bold text-[#76B93F] uppercase">Agronomic Guide</span>
              <h4 className="font-bold text-sm sm:text-base text-[#073D2B]">
                Biological Nitrogen Fixation in Multi-Species Cover Mixtures (Vetch + Clover + Rye)
              </h4>
              <p className="text-xs text-[#527367]">Calculating credit allowances against standard USDA commercial recommendations.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/features')}
              aria-label="Open biological nitrogen fixation guide"
              className="w-11 h-11 shrink-0 rounded-xl bg-[#F0F5EE] hover:bg-[#EAF5DF] text-[#073D2B] transition-colors flex items-center justify-center"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-[#D5E5CA] shadow-2xs flex items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1 min-w-0 flex-1">
              <span className="text-[10px] font-bold text-[#76B93F] uppercase">Data Provenance Manual</span>
              <h4 className="font-bold text-sm sm:text-base text-[#073D2B]">
                Field Shift Uncertainty Framework & Spatial Resolution Disclosures
              </h4>
              <p className="text-xs text-[#527367]">How we guard against overconfidence in coarse-resolution remote sensing data.</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/about')}
              aria-label="Open uncertainty framework manual"
              className="w-11 h-11 shrink-0 rounded-xl bg-[#F0F5EE] hover:bg-[#EAF5DF] text-[#073D2B] transition-colors flex items-center justify-center"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
