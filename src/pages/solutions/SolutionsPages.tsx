import React from 'react';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import {
  Tractor,
  Sprout,
  Droplets,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Award,
  Layers,
  Sparkles,
  Users,
  Compass,
} from 'lucide-react';

interface SolutionPageProps {
  onNavigate: (path: string) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
}

/* ==========================================================================
   1. ROW-CROP PRODUCERS PAGE (/solutions/row-crop-producers)
   ========================================================================== */
export const RowCropProducersPage: React.FC<SolutionPageProps> = ({ onNavigate, onOpenAuth }) => {
  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Breadcrumb Header */}
        <div>
          <Breadcrumbs
            items={[
              { label: 'Solutions', path: '/solutions' },
              { label: 'Row-Crop Producers' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
                Family & Commercial Grain Operations
              </span>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B] mt-1">
                Field Shift for Row-Crop Producers
              </h1>
              <p className="text-sm sm:text-base text-[#527367] mt-2 max-w-2xl leading-relaxed">
                Practical, profit-first crop rotation pathways engineered for corn, soybean, wheat, and cotton
                growers facing escalating synthetic fertilizer costs and tight seasonal windows.
              </p>
            </div>
            <button
              onClick={() => onOpenAuth('signup')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] text-white text-xs sm:text-sm font-semibold hover:bg-[#145C3D] transition-all shadow-md self-start md:self-auto"
            >
              <span>Build Farm Profile</span>
              <ArrowRight className="w-4 h-4 text-[#76B93F]" />
            </button>
          </div>
        </div>

        {/* 3 Core Value Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-[#073D2B]">Cut Synthetic Nitrogen Costs</h3>
            <p className="text-xs text-[#527367] leading-relaxed">
              Biological fixation from winter legume cover crops (hairy vetch, crimson clover) provides
              an estimated 75–95 lbs of bio-available nitrogen per acre, reducing synthetic purchases by 25–35%.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center">
              <Tractor className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-[#073D2B]">Equipment Compatibility</h3>
            <p className="text-xs text-[#527367] leading-relaxed">
              Designed around your existing equipment. Whether you run a no-till drill, a high-clearance interseeder,
              or a roller-crimper toolbar, our schedules specify ideal planting dates and termination heights.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center">
              <Droplets className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-[#073D2B]">Drought Buffer Capacity</h3>
            <p className="text-xs text-[#527367] leading-relaxed">
              Each 1% increase in soil organic matter holds an extra 20,000+ gallons of pore water per acre,
              extending crop survivability during critical mid-summer dry spells tracked by NASA SMAP.
            </p>
          </div>
        </div>

        {/* Real Farm Scenario Case Study */}
        <div className="bg-white rounded-3xl p-8 border border-[#D5E5CA] shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">Real-World Application</span>
            <h2 className="font-display text-2xl font-bold text-[#073D2B]">
              Transitioning 1,200 Acres in Story County, Iowa
            </h2>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              By shifting from a continuous 2-year corn/soybean rotation to a 3-year sequence with an overwintering
              cereal rye cover crop, the operation eliminated 135 days of bare-ground winter exposure. Soil loss
              dropped from 5.4 tons/acre/year to under 1.1 tons, while corn yields following the cover crop remained steady.
            </p>
            <div className="space-y-2 pt-2 text-xs">
              <div className="flex items-center gap-2 text-[#2A4D3E]">
                <CheckCircle2 className="w-4 h-4 text-[#76B93F]" />
                <span>$42/acre net savings on synthetic chemical fertilizer</span>
              </div>
              <div className="flex items-center gap-2 text-[#2A4D3E]">
                <CheckCircle2 className="w-4 h-4 text-[#76B93F]" />
                <span>NDVI canopy persistence validated by NASA MODIS</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA] space-y-3">
            <h4 className="font-bold text-sm text-[#073D2B]">Featured Producer Features</h4>
            <div className="space-y-2 text-xs">
              <button
                onClick={() => onNavigate('/crop-rotation')}
                className="w-full text-left p-3 rounded-xl bg-white border border-[#E2E8DE] hover:border-[#76B93F] transition-all flex items-center justify-between"
              >
                <span className="font-semibold text-[#073D2B]">Crop Rotation Engine (3-Strategy Comparison)</span>
                <ArrowRight className="w-4 h-4 text-[#76B93F]" />
              </button>
              <button
                onClick={() => onNavigate('/soil-intelligence')}
                className="w-full text-left p-3 rounded-xl bg-white border border-[#E2E8DE] hover:border-[#76B93F] transition-all flex items-center justify-between"
              >
                <span className="font-semibold text-[#073D2B]">Soil Chemistry & Moisture Buffer Explorer</span>
                <ArrowRight className="w-4 h-4 text-[#76B93F]" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

/* ==========================================================================
   2. REGENERATIVE AGRICULTURE CO-OPS (/solutions/regenerative-agriculture)
   ========================================================================== */
export const RegenerativeAgPage: React.FC<SolutionPageProps> = ({ onNavigate, onOpenAuth }) => {
  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div>
          <Breadcrumbs
            items={[
              { label: 'Solutions', path: '/solutions' },
              { label: 'Regenerative Agriculture Co-ops' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
                Cooperative & Enterprise Land Stewards
              </span>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B] mt-1">
                Verified Regenerative Intelligence
              </h1>
              <p className="text-sm sm:text-base text-[#527367] mt-2 max-w-2xl leading-relaxed">
                Provide objective, satellite-verified proof of continuous living root cover, soil organic carbon
                gains, and reduced bare-field fallow periods to grain buyers and premium sustainability markets.
              </p>
            </div>
            <button
              onClick={() => onOpenAuth('signup')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] text-white text-xs sm:text-sm font-semibold hover:bg-[#145C3D] transition-all shadow-md self-start md:self-auto"
            >
              <span>Connect Your Co-op</span>
              <ArrowRight className="w-4 h-4 text-[#76B93F]" />
            </button>
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-[#073D2B]">Proof Without Greenwashing</h3>
            <p className="text-xs text-[#527367] leading-relaxed">
              MODIS 250m NDVI and Landsat reflectance track field-level canopy persistence through the winter,
              producing cryptographically timestamped records of soil armor.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-[#073D2B]">Co-op Seed Aggregation</h3>
            <p className="text-xs text-[#527367] leading-relaxed">
              Aggregate rotation plans across 40+ member farms to negotiate bulk discounts on multi-species
              cover crop seed blends (rye, vetch, clover, radish).
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-[#073D2B]">Carbon Credit Readiness</h3>
            <p className="text-xs text-[#527367] leading-relaxed">
              Export verified practice-change datasets complying with USDA COMET-Farm and Verra VM0042 standards
              without cumbersome manual paperwork.
            </p>
          </div>
        </div>

        {/* Co-op Quote Banner */}
        <div className="p-8 rounded-3xl bg-[#073D2B] text-white space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[#9BD85A]">
            Cooperative Member Testimony
          </span>
          <p className="font-display text-xl sm:text-2xl font-bold leading-snug">
            “Field Shift gave our 42 member farms the objective satellite verification our premium oat and food-grade
            soybean buyers demanded — without putting intrusive hardware in our cabs.”
          </p>
          <div className="text-xs text-white/70">
            — Heartland Regenerative Grain Collective (34,000 enrolled acres)
          </div>
        </div>

      </div>
    </div>
  );
};

/* ==========================================================================
   3. WATERSHED & SOIL CONSERVATION (/solutions/watershed-conservation)
   ========================================================================== */
export const WatershedConservationPage: React.FC<SolutionPageProps> = ({ onNavigate, onOpenAuth }) => {
  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div>
          <Breadcrumbs
            items={[
              { label: 'Solutions', path: '/solutions' },
              { label: 'Watershed & Soil Conservation' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
                Conservation Districts & Water Quality Authorities
              </span>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B] mt-1">
                Watershed & Soil Conservation
              </h1>
              <p className="text-sm sm:text-base text-[#527367] mt-2 max-w-2xl leading-relaxed">
                Landscape-scale hydrological modeling to pinpoint critical runoff source areas, reduce agricultural
                nutrient loading, and protect municipal water supply basins.
              </p>
            </div>
            <button
              onClick={() => onNavigate('/dashboard')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] text-white text-xs sm:text-sm font-semibold hover:bg-[#145C3D] transition-all shadow-md self-start md:self-auto"
            >
              <span>Explore Watershed Tools</span>
              <ArrowRight className="w-4 h-4 text-[#76B93F]" />
            </button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-8 rounded-3xl bg-white border border-[#D5E5CA] shadow-2xs space-y-4">
            <h3 className="font-bold text-xl text-[#073D2B]">Critical Source Area (CSA) Mapping</h3>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              Combining NASA SRTM 30m topographic slope gradients with NASA GPM IMERG 30-minute precipitation
              intensity curves allows conservation technicians to identify the 10% of field parcels causing
              70% of downstream sediment and phosphorus export.
            </p>
            <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#E2E8DE] space-y-2 text-xs text-[#2A4D3E]">
              <div className="font-bold text-[#073D2B]">Conservation District Benefits:</div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li>Targeted cost-share allocation for EQIP and CSP funds</li>
                <li>Hydrological flow routing along 2–5% slope contours</li>
                <li>Continuous watershed nutrient reduction tracking</li>
              </ul>
            </div>
          </div>

          <div className="p-8 rounded-3xl bg-white border border-[#D5E5CA] shadow-2xs space-y-4">
            <h3 className="font-bold text-xl text-[#073D2B]">Regional Fallow Period Reduction</h3>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              Monitor regional cover crop adoption percentages across entire HUC-8 and HUC-12 hydrologic units.
              Identify sub-basins with prolonged bare-soil windows between harvest and planting, and target
              producer outreach programs where erosion hazards are highest.
            </p>
            <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#E2E8DE] space-y-2 text-xs text-[#2A4D3E]">
              <div className="font-bold text-[#073D2B]">Open Science Assurance:</div>
              <ul className="space-y-1.5 list-disc list-inside">
                <li>All hydrological indices reference published USDA-ARS formulas</li>
                <li>Zero proprietary black-box calculations</li>
                <li>Compatible with municipal water board compliance reports</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

/* ==========================================================================
   4. CERTIFIED CROP ADVISORS (/solutions/crop-advisors)
   ========================================================================== */
export const CropAdvisorsPage: React.FC<SolutionPageProps> = ({ onNavigate, onOpenAuth }) => {
  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div>
          <Breadcrumbs
            items={[
              { label: 'Solutions', path: '/solutions' },
              { label: 'Certified Crop Advisors (CCA)' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
                Agronomists & Independent Crop Consultants
              </span>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B] mt-1">
                Field Shift for Certified Crop Advisors
              </h1>
              <p className="text-sm sm:text-base text-[#527367] mt-2 max-w-2xl leading-relaxed">
                Equip your advisory practice with objective orbital telemetry, repeatable multi-year rotation
                modeling, and transparent grower presentation dossiers.
              </p>
            </div>
            <button
              onClick={() => onOpenAuth('signup')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] text-white text-xs sm:text-sm font-semibold hover:bg-[#145C3D] transition-all shadow-md self-start md:self-auto"
            >
              <span>Request CCA Practice License</span>
              <ArrowRight className="w-4 h-4 text-[#76B93F]" />
            </button>
          </div>
        </div>

        {/* CCA Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center">
              <Compass className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-[#073D2B]">Multi-Farm Portfolio Triage</h3>
            <p className="text-xs text-[#527367] leading-relaxed">
              Scan across 200+ managed fields in minutes. Rank client fields by SMAP root-zone moisture stress
              and anomalous MODIS vegetative drop-offs before dispatching scouting trucks.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-[#073D2B]">Unbiased Agronomic Evidence</h3>
            <p className="text-xs text-[#527367] leading-relaxed">
              Show growers clear, unassailable data comparing conventional 2-year corn/soybean economics with
              living root cover, backed by peer-reviewed extension research and NASA telemetry.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#EAF5DF] text-[#145C3D] flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg text-[#073D2B]">The Agronomist-in-the-Loop</h3>
            <p className="text-xs text-[#527367] leading-relaxed">
              Field Shift provides the computational modeling and remote sensing baseline; you provide the
              essential local diagnostic context, tissue testing, and final grower sign-off.
            </p>
          </div>
        </div>

        {/* Callout */}
        <div className="p-6 rounded-3xl bg-white border border-[#D5E5CA] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-base text-[#073D2B]">Looking for Technical Methodologies?</h4>
            <p className="text-xs text-[#527367] mt-0.5">Explore our mathematical formulations and scientific limits.</p>
          </div>
          <button
            onClick={() => onNavigate('/resources/agronomic-documentation')}
            className="px-5 py-2.5 rounded-full bg-[#073D2B] text-white text-xs font-semibold hover:bg-[#145C3D] transition-all"
          >
            Review Agronomic Documentation
          </button>
        </div>

      </div>
    </div>
  );
};
