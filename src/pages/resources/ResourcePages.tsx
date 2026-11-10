import React from 'react';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import {
  BookOpen,
  Code2,
  Database,
  FileCode,
  FileText,
  Layers,
  Satellite,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sprout,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Terminal,
} from 'lucide-react';

interface ResourcePageProps {
  onNavigate: (path: string) => void;
  onOpenAuth?: (mode?: 'signin' | 'signup') => void;
}

/* ==========================================================================
   1. AGRONOMIC DOCUMENTATION (/resources/agronomic-documentation)
   ========================================================================== */
export const AgronomicDocsPage: React.FC<ResourcePageProps> = ({ onNavigate }) => {
  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div>
          <Breadcrumbs
            items={[
              { label: 'Resources', path: '/resources' },
              { label: 'Agronomic Documentation' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
              Technical Methodology & Formulations
            </span>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B] mt-1">
              Agronomic Documentation
            </h1>
            <p className="text-sm sm:text-base text-[#527367] mt-2 max-w-2xl leading-relaxed">
              Mathematical formulations, biological assumptions, and peer-reviewed agronomic models
              driving the Field Shift crop rotation scoring and bare-field hazard engines.
            </p>
          </div>
        </div>

        {/* Core Mathematical Formulations */}
        <div className="space-y-6">
          
          {/* Formulation 1: Biological Nitrogen Fixation */}
          <div className="bg-white p-7 sm:p-8 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#073D2B]">
                1. Biological Nitrogen Fixation (BNF) Allocation Model
              </h3>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#EAF5DF] text-[#145C3D]">
                Fabaceae Symbiosis
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              Field Shift calculates bio-available nitrogen credits contributed to succeeding cash crops using
              the USDA-NRCS legume nodulation coefficient adjusted for soil temperature and residual mineral nitrate:
            </p>
            <div className="p-4 rounded-2xl bg-[#073D2B] text-white font-mono text-xs sm:text-sm overflow-x-auto">
              N_credit (lbs/ac) = DryBiomass_ton * %N_tissue * %N_fixed * SoilTemp_factor * (1 - NO3_suppression)
            </div>
            <div className="text-xs text-[#2A4D3E] space-y-1.5">
              <p><strong>Baseline Parameters:</strong> Hairy vetch produces ~2.5 tons dry matter/ac at 3.5% tissue N, with 70% derived from the atmosphere (Ndfa), yielding 85–105 lbs N credit when terminated at early flowering.</p>
              <p><strong>Limitation:</strong> High residual synthetic soil nitrogen (&gt;25 ppm NO3-N) triggers nitrate suppression, reducing rhizobial nodulation efficiency by up to 40%.</p>
            </div>
          </div>

          {/* Formulation 2: Bare-Field Exposure Index */}
          <div className="bg-white p-7 sm:p-8 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#073D2B]">
                2. Bare-Field Exposure & Erosion Vulnerability Index (BFEI)
              </h3>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                RUSLE-2 Derivative
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              Quantifies vulnerability to wind and sheet/rill water erosion between crop harvest and succeeding canopy closure:
            </p>
            <div className="p-4 rounded-2xl bg-[#073D2B] text-white font-mono text-xs sm:text-sm overflow-x-auto">
              BFEI = Σ [Days(NDVI &lt; 0.28) * RainfallIntensity_GPM * SRTM_SlopeFactor * (1 - StoverCover%)]
            </div>
            <div className="text-xs text-[#2A4D3E] space-y-1.5">
              <p><strong>Fallow Threshold:</strong> Any parcel exhibiting NDVI &lt; 0.28 for more than 45 days on slopes exceeding 2.0% receives an automatic elevated erosion warning.</p>
              <p><strong>Mitigation Credit:</strong> Planting overwinter cereal rye drops BFEI to near-zero by maintaining a minimum 0.55 NDVI living carpet throughout the vulnerable March–April rain season.</p>
            </div>
          </div>

          {/* Formulation 3: Pest Cycle Disruption Coefficient */}
          <div className="bg-white p-7 sm:p-8 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-[#073D2B]">
                3. Taxonomic Host Break & Pest Disruption Matrix
              </h3>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-900 border border-sky-200">
                Entomological Taxonomy
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              Evaluates phylogenetic distance between sequential crops to predict host-interruption effectiveness for key agricultural pests:
            </p>
            <ul className="space-y-2 text-xs text-[#2A4D3E] list-disc list-inside">
              <li><strong>Western Corn Rootworm (<em>Diabrotica virgifera</em>):</strong> Larval mortality reaches 95%+ when corn is followed by a non-grass broadleaf (soybean, sunflower, or pea).</li>
              <li><strong>Soybean Cyst Nematode (<em>Heterodera glycines</em>):</strong> Soil egg densities decline by 40–55% after one non-host grass year (corn or triticale).</li>
              <li><strong>Host Risk Flag:</strong> Planting continuous Poaceae (corn → corn or corn → wheat) compounds rootworm and crown rot pressures, triggering rotational score deductions.</li>
            </ul>
          </div>

        </div>

      </div>
    </div>
  );
};

/* ==========================================================================
   2. NASA EARTHDATA GUIDE (/resources/nasa-earthdata-guide)
   ========================================================================== */
export const NasaEarthdataGuidePage: React.FC<ResourcePageProps> = ({ onNavigate }) => {
  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div>
          <Breadcrumbs
            items={[
              { label: 'Resources', path: '/resources' },
              { label: 'NASA Earthdata Guide' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
              Open Science Data Architecture
            </span>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B] mt-1">
              NASA Earthdata API Integration Guide
            </h1>
            <p className="text-sm sm:text-base text-[#527367] mt-2 max-w-2xl leading-relaxed">
              How Field Shift discovers, queries, extracts, and spatializes planetary observations from NASA
              Distributed Active Archive Centers (DAACs) to deliver sub-field telemetry.
            </p>
          </div>
        </div>

        {/* Mission Catalog Table */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D5E5CA] shadow-2xs space-y-6">
          <h3 className="font-bold text-lg text-[#073D2B]">Active NASA Mission Ingestion Feeds</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8DE] text-[#073D2B]">
                  <th className="py-3 px-3 font-bold">Mission & Short Name</th>
                  <th className="py-3 px-3 font-bold">DAAC Archive</th>
                  <th className="py-3 px-3 font-bold">Resolution</th>
                  <th className="py-3 px-3 font-bold">Measured Parameter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8DE] text-[#2A4D3E]">
                <tr>
                  <td className="py-3 px-3 font-semibold text-[#073D2B]">SMAP L4 (SPL4SMGP)</td>
                  <td className="py-3 px-3">NASA GES DISC</td>
                  <td className="py-3 px-3 font-mono">9 km grid</td>
                  <td className="py-3 px-3">Root-Zone Soil Moisture (0–100 cm depth)</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-[#073D2B]">GPM IMERG (GPM_3IMERGM)</td>
                  <td className="py-3 px-3">NASA PPS</td>
                  <td className="py-3 px-3 font-mono">0.1° (~10 km)</td>
                  <td className="py-3 px-3">Precipitation Accumulation & Storm Intensity</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-[#073D2B]">MODIS (MOD13Q1)</td>
                  <td className="py-3 px-3">NASA LP DAAC</td>
                  <td className="py-3 px-3 font-mono">250 meters</td>
                  <td className="py-3 px-3">16-day Composite NDVI & EVI Vegetation Health</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-[#073D2B]">NASA POWER Agroclimatology</td>
                  <td className="py-3 px-3">NASA Langley</td>
                  <td className="py-3 px-3 font-mono">0.5° Daily</td>
                  <td className="py-3 px-3">Solar Radiation, Daily Max/Min Temp, GDD</td>
                </tr>
                <tr>
                  <td className="py-3 px-3 font-semibold text-[#073D2B]">SRTM GL1</td>
                  <td className="py-3 px-3">NASA LP DAAC</td>
                  <td className="py-3 px-3 font-mono">30 meters</td>
                  <td className="py-3 px-3">Digital Elevation Model (DEM), Slope & Aspect</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Integration Architecture */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-[#145C3D] font-bold text-base">
            <Terminal className="w-5 h-5 text-[#76B93F]" />
            <h3>Server-Side Geospatial Query Workflow</h3>
          </div>
          <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
            When a farmer registers a field polygon or coordinates in Field Shift, the server executes a bounded
            spatial query against the NASA Common Metadata Repository (CMR) API to identify intersecting granules.
          </p>
          <div className="p-4 rounded-2xl bg-[#073D2B] text-white font-mono text-xs overflow-x-auto space-y-1">
            <p className="text-white/60"># 1. Discover intersecting SMAP HDF5 granules via NASA CMR</p>
            <p>GET https://cmr.earthdata.nasa.gov/search/granules.json?short_name=SPL4SMGP&bounding_box=-94.0,41.5,-93.0,42.5</p>
            <p className="text-white/60 pt-2"># 2. Extract root-zone volumetric soil moisture layer (sm_rootzone)</p>
            <p>POST /api/nasa/telemetry-extract &#123; coordinates: [-93.62, 42.03], variables: ['sm_rootzone', 'NDVI'] &#125;</p>
          </div>
          <p className="text-xs text-[#527367]">
            Values are cached in our database with a 24-hour time-to-live (TTL) to respect NASA bandwidth while ensuring
            farmers have low-latency access to the latest orbital pass.
          </p>
        </div>

      </div>
    </div>
  );
};

/* ==========================================================================
   3. USDA SSURGO INTEGRATION (/resources/ssurgo-integration)
   ========================================================================== */
export const SsurgoIntegrationPage: React.FC<ResourcePageProps> = ({ onNavigate }) => {
  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div>
          <Breadcrumbs
            items={[
              { label: 'Resources', path: '/resources' },
              { label: 'USDA SSURGO Integration' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
              Federal Soil Database Connection
            </span>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B] mt-1">
              USDA SSURGO Soil Survey Integration
            </h1>
            <p className="text-sm sm:text-base text-[#527367] mt-2 max-w-2xl leading-relaxed">
              How Field Shift pairs satellite remote sensing with the USDA Natural Resources Conservation Service
              (NRCS) Soil Survey Geographic Database (SSURGO).
            </p>
          </div>
        </div>

        {/* Real Status Disclosure */}
        <div className="p-6 rounded-3xl bg-white border border-[#D5E5CA] shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-[#073D2B]">Integration Status & Implementation Scope</h3>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              Operational Regional Profiles
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
            In accordance with our strict scientific honesty guidelines, we disclose that Field Shift currently operates
            calibrated regional SSURGO soil series profiles (Clarion, Nicollet, Webster, Tama, and Sparta loams) directly
            integrated into our farm property forms and rotation models. Automated real-time polygon queries via the
            NRCS Soil Data Access (SDA) REST API are currently in active staging development.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
            <div className="p-4 bg-[#FAFDF8] rounded-2xl border border-[#E2E8DE] space-y-1">
              <strong className="text-[#073D2B] block">Available Water Capacity (AWC)</strong>
              <p className="text-[#527367]">Inches of available water per foot of soil depth based on horizon texture.</p>
            </div>
            <div className="p-4 bg-[#FAFDF8] rounded-2xl border border-[#E2E8DE] space-y-1">
              <strong className="text-[#073D2B] block">Drainage Class & Hydric Status</strong>
              <p className="text-[#527367]">Identifies wet foot zones requiring tile drainage or water-tolerant cover species.</p>
            </div>
            <div className="p-4 bg-[#FAFDF8] rounded-2xl border border-[#E2E8DE] space-y-1">
              <strong className="text-[#073D2B] block">K-Factor Soil Erodibility</strong>
              <p className="text-[#527367]">Inherent susceptibility of soil particles to detachment by raindrop impact.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

/* ==========================================================================
   4. SCIENTIFIC ETHICS & DISCLAIMER (/resources/scientific-ethics)
   ========================================================================== */
export const ScientificEthicsPage: React.FC<ResourcePageProps> = ({ onNavigate }) => {
  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div>
          <Breadcrumbs
            items={[
              { label: 'Resources', path: '/resources' },
              { label: 'Scientific Ethics & Disclaimer' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
              Foundational Principles
            </span>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B] mt-1">
              Scientific Ethics, Transparency & Agricultural Disclaimer
            </h1>
            <p className="text-sm sm:text-base text-[#527367] mt-2 max-w-2xl leading-relaxed">
              Our non-negotiable commitments to agricultural producers: algorithmic transparency, data sovereignty,
              unbiased recommendations, and ground-truth humility.
            </p>
          </div>
        </div>

        {/* 4 Ethical Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-white border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-[#073D2B] font-bold text-base">
              <ShieldCheck className="w-5 h-5 text-[#76B93F]" />
              <h3>1. Zero Fabricated Precision</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              We never interpolate coarse satellite pixels (e.g. 9 km SMAP or 10 km GPM) into false sub-meter certainty.
              Every remote sensing reading displayed in Field Shift explicitly states its original sensor resolution,
              revisit frequency, and underlying scientific uncertainties.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-[#073D2B] font-bold text-base">
              <ShieldCheck className="w-5 h-5 text-[#76B93F]" />
              <h3>2. Unbiased Independence</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              Field Shift accepts zero commercial sponsorship, affiliate revenue, or promotional commissions from
              pesticide manufacturers, synthetic fertilizer brokers, or seed conglomerates. All crop rotation rankings
              are derived strictly from agronomic science and your personal priorities.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-[#073D2B] font-bold text-base">
              <ShieldCheck className="w-5 h-5 text-[#76B93F]" />
              <h3>3. Farmer Data Sovereignty</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              Your field boundaries, soil test results, and crop yield goals belong exclusively to you. We never sell,
              broker, or aggregate farmer data for commodity market speculation or third-party corporate marketing.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-[#073D2B] font-bold text-base">
              <ShieldCheck className="w-5 h-5 text-[#76B93F]" />
              <h3>4. Ground-Truth Humility</h3>
            </div>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              Satellite observations cannot detect subterranean nematode populations, subsoil plow-pans, or micronutrient
              deficiencies without in-field verification. Field Shift serves to inform farmer judgment, never to replace it.
            </p>
          </div>
        </div>

        {/* Legal & Professional Disclaimer Box */}
        <div className="p-7 sm:p-8 rounded-3xl bg-[#073D2B] text-white space-y-4">
          <div className="flex items-center gap-2 text-[#9BD85A] font-bold text-sm uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-[#76B93F]" />
            Official Agronomic Disclaimer
          </div>
          <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
            The crop rotation models, water retention estimates, and financial projections provided by Field Shift are
            simulations intended solely for planning and educational purposes. Actual agricultural outcomes depend on
            uncontrollable weather events, seed emergence rates, equipment operation, and local soil conditions.
            Field Shift Technologies does not provide certified legal, financial, or pesticide application warranties.
            Producers are urged to consult certified crop advisors, extension specialists, and local agronomic professionals
            before executing significant crop sequence or fertility modifications.
          </p>
        </div>

      </div>
    </div>
  );
};
