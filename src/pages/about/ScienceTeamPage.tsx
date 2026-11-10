import React from 'react';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Globe2,
  GraduationCap,
  Layers,
  Satellite,
  ShieldCheck,
  Sparkles,
  Sprout,
  ArrowRight,
} from 'lucide-react';

interface ScienceTeamPageProps {
  onNavigate: (path: string) => void;
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
}

export const ScienceTeamPage: React.FC<ScienceTeamPageProps> = ({ onNavigate, onOpenAuth }) => {
  const teamMembers = [
    {
      name: 'Dr. Elena Vance, PhD',
      role: 'Principal Remote Sensing Scientist & Soil Physicist',
      initials: 'EV',
      bio: 'Former research hydrologist at USDA-ARS Hydrology & Remote Sensing Laboratory (Beltsville, MD). Specialist in L-band microwave radiative transfer modeling and SMAP satellite calibration across agricultural till plains.',
      publications: '18 peer-reviewed papers on soil moisture disaggregation and multi-scale dielectric permittivity.',
    },
    {
      name: 'Marcus Kowalski, CCA',
      role: 'Chief Agronomist & Midwest Crop Rotation Lead',
      initials: 'MK',
      bio: 'Certified Crop Advisor (CCA) with 25+ years directing crop protection and rotational fertility across 180,000+ Midwestern acres. Pioneer in high-residue strip-till management and biological cover crop integration.',
      publications: 'Co-author of Practical Farmers of Iowa Cover Crop Establishment Guidelines.',
    },
    {
      name: 'Ahmed Raza, MSc',
      role: 'Lead Geospatial Software Architect & AI Engineering Lead',
      initials: 'AR',
      bio: 'Specialist in planetary-scale geospatial pipelines, distributed PostGIS indexing, and Google Gemini server-side generative architectures grounded in telemetry.',
      publications: 'Lead architect of the Field Shift dynamic crop rotation and explainability inference engine.',
    },
    {
      name: 'Dr. Samuel Chen, PhD',
      role: 'Catchment Hydrologist & Precipitation Specialist',
      initials: 'SC',
      bio: 'Hydrological modeler focusing on NASA GPM IMERG 30-minute extreme rainfall anomalies, hill-slope rill erosion kinetics, and sub-basin sediment delivery ratios.',
      publications: 'Contributor to NASA Precipitation Measurement Missions (PMM) Applied Sciences working group.',
    },
    {
      name: 'Maya Al-Mansoor, MS',
      role: 'Soil Microbiome & Nitrogen Cycling Director',
      initials: 'MA',
      bio: 'Agronomic researcher studying rhizobial symbiosis, legume biological nitrogen fixation kinetics, and mycorrhizal fungal network preservation under zero-till management.',
      publications: 'Lead researcher on biological N-credit allowances in Midwestern silt loam soils.',
    },
  ];

  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Breadcrumb Header */}
        <div>
          <Breadcrumbs
            items={[
              { label: 'About', path: '/about' },
              { label: 'Our Science Team' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold uppercase tracking-wider mb-2">
                <GraduationCap className="w-3.5 h-3.5" />
                Interdisciplinary Research Council
              </div>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B]">
                The Field Shift Science Team
              </h1>
              <p className="text-sm sm:text-base text-[#527367] mt-2 max-w-2xl leading-relaxed">
                We bridge the gap between orbital astrophysics and muddy-boot field reality. Meet the scientists,
                certified crop advisors, and engineers powering our agricultural intelligence platform.
              </p>
            </div>
            <button
              onClick={() => onNavigate('/resources/scientific-ethics')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#073D2B] text-white text-xs sm:text-sm font-semibold hover:bg-[#145C3D] transition-all shadow-md self-start md:self-auto"
            >
              <span>Scientific Ethics & Disclaimer</span>
              <ArrowRight className="w-4 h-4 text-[#76B93F]" />
            </button>
          </div>
        </div>

        {/* Core Guiding Principle Banner */}
        <div className="bg-white rounded-3xl p-8 border border-[#D5E5CA] shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">Our Research Creed</span>
            <h2 className="font-display text-2xl font-bold text-[#073D2B]">
              Supporting Farmer Judgment, Never Overriding It
            </h2>
            <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
              We reject the Silicon Valley premise that software algorithms can replace generations of farming experience.
              Our mission is to arm producers with transparent satellite data, clear uncertainty bounds, and unbiased
              crop rotation models free from chemical or seed sponsor kickbacks.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#073D2B] text-white space-y-3">
            <h4 className="font-bold text-sm text-[#9BD85A] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Open Science Commitment
            </h4>
            <p className="text-xs text-white/80 leading-relaxed">
              All Field Shift remote sensing layers reference documented NASA DAAC archives (GES DISC, LP DAAC,
              PPS). We publish our formulas openly and invite peer critique from university extension services.
            </p>
          </div>
        </div>

        {/* Team Members Grid */}
        <div className="space-y-6">
          <div className="text-center max-w-2xl mx-auto">
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#073D2B]">
              Scientific Advisory Council
            </h3>
            <p className="text-xs sm:text-sm text-[#527367] mt-1">
              Agronomy, soil physics, remote sensing, and machine learning leadership.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamMembers.map((member, idx) => (
              <div
                key={idx}
                className="bg-white p-6 sm:p-7 rounded-3xl border border-[#D5E5CA] hover:border-[#76B93F] transition-all shadow-2xs space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#EAF5DF] text-[#145C3D] font-display font-bold text-base flex items-center justify-center">
                      {member.initials}
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-[#073D2B] leading-tight">{member.name}</h4>
                      <p className="text-xs text-[#76B93F] font-semibold mt-0.5">{member.role}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#527367] leading-relaxed">{member.bio}</p>
                </div>

                <div className="pt-4 border-t border-[#E2E8DE] text-[11px] text-[#2A4D3E]">
                  <strong className="text-[#073D2B] block mb-0.5">Focus:</strong>
                  {member.publications}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* University & Extension Collaborations */}
        <div className="p-8 rounded-3xl bg-white border border-[#D5E5CA] shadow-2xs space-y-4">
          <div className="flex items-center gap-2 text-[#073D2B] font-bold text-lg">
            <BookOpen className="w-5 h-5 text-[#76B93F]" />
            <h3>Institutional & Extension Collaborations</h3>
          </div>
          <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
            Field Shift engages with leading agricultural extension universities and conservation networks to ground-truth
            our crop sequence algorithms against verified multi-year trial plots in Iowa, Illinois, Minnesota, and Indiana.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs text-[#2A4D3E] font-semibold">
            <div className="p-3 bg-[#FAFDF8] rounded-xl border border-[#E2E8DE] text-center">
              USDA-ARS Hydrology Lab
            </div>
            <div className="p-3 bg-[#FAFDF8] rounded-xl border border-[#E2E8DE] text-center">
              Iowa State Extension
            </div>
            <div className="p-3 bg-[#FAFDF8] rounded-xl border border-[#E2E8DE] text-center">
              Purdue Center for Crops
            </div>
            <div className="p-3 bg-[#FAFDF8] rounded-xl border border-[#E2E8DE] text-center">
              Practical Farmers of Iowa
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
