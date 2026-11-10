import React from 'react';
import { ArrowRight, Satellite, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';

export interface FooterProps {
  onNavigate: (path: string) => void;
  className?: string;
}

export interface FooterLinkItem {
  label: string;
  path: string;
}

export interface FooterColumnConfig {
  title: string;
  links: FooterLinkItem[];
}

export const FOOTER_NAV_CONFIG: {
  platform: FooterColumnConfig;
  solutions: FooterColumnConfig;
  resources: FooterColumnConfig;
  legal: FooterLinkItem[];
} = {
  platform: {
    title: 'Platform',
    links: [
      { label: 'Home Overview', path: '/' },
      { label: 'Core Features', path: '/features' },
      { label: 'NASA Data Catalog', path: '/nasa-data' },
      { label: 'Crop Rotation Engine', path: '/crop-rotation' },
      { label: 'Soil Intelligence', path: '/soil-intelligence' },
      { label: 'Field Risk Diagnostic', path: '/field-risk' },
    ],
  },
  solutions: {
    title: 'Solutions',
    links: [
      { label: 'Row-Crop Producers', path: '/solutions/row-crop-producers' },
      { label: 'Regenerative Agriculture Co-ops', path: '/solutions/regenerative-agriculture' },
      { label: 'Watershed & Soil Conservation', path: '/solutions/watershed-conservation' },
      { label: 'Certified Crop Advisors (CCA)', path: '/solutions/crop-advisors' },
      { label: 'About Our Science Team', path: '/about/science-team' },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { label: 'Agronomic Documentation', path: '/resources/agronomic-documentation' },
      { label: 'NASA Earthdata API Guide', path: '/resources/nasa-earthdata-guide' },
      { label: 'USDA SSURGO Integration', path: '/resources/ssurgo-integration' },
      { label: 'AI Agricultural Advisor', path: '/ai-advisor' },
      { label: 'Scientific Ethics & Disclaimer', path: '/resources/scientific-ethics' },
    ],
  },
  legal: [
    { label: 'Privacy Policy', path: '/privacy-policy' },
    { label: 'Terms of Service', path: '/terms-of-service' },
  ],
};

export const Footer: React.FC<FooterProps> = ({ onNavigate, className = '' }) => {
  return (
    <footer
      className={`bg-[#073D2B] text-white pt-16 pb-12 border-t border-[#145C3D] selection:bg-[#76B93F]/30 selection:text-white ${className}`}
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Grid: Brand Column + 3 Navigation Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 pb-12 border-b border-white/10">
          
          {/* ================= 1. BRAND COLUMN ================= */}
          <div className="md:col-span-2 lg:col-span-4 space-y-5">
            {/* Clickable Brand Header */}
            <button
              onClick={() => onNavigate('/')}
              className="group text-left inline-flex items-center gap-3.5 focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] rounded-2xl p-1 -m-1 transition-transform"
              aria-label="FieldShift Homepage"
            >
              <div className="w-12 h-12 rounded-full bg-white p-0.5 overflow-hidden flex-shrink-0 shadow-md group-hover:scale-105 transition-transform">
                <img
                  src="/assets/aistudio/Eco-Tech_Globe_Branding_Logo__1__5456db76.png"
                  alt="Field Shift Logo"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
              <div>
                <span className="font-display text-2xl font-bold tracking-tight text-white block">
                  Field<span className="text-[#76B93F]">Shift</span>
                </span>
                <p className="text-xs text-[#9BD85A] font-semibold tracking-wide">
                  Smarter Decisions. Greener Tomorrow.
                </p>
              </div>
            </button>

            {/* Official Description */}
            <p className="text-xs sm:text-sm text-white/80 leading-relaxed max-w-sm">
              Empowering agricultural producers with NASA Earth observation satellites, local soil
              intelligence, and agronomic crop rotation science for lasting land resilience.
            </p>

            {/* NASA Open Science Commitment Box */}
            <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/15 text-xs text-white/85 max-w-sm space-y-2 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-[#76B93F] font-bold uppercase tracking-wider text-[11px]">
                <Satellite className="w-4 h-4 flex-shrink-0" />
                <span>NASA Open Science Commitment</span>
              </div>
              <p className="text-[11px] text-white/75 leading-relaxed">
                Field Shift utilizes open data streams from SMAP, GPM IMERG, MODIS, and NASA POWER.
                All data products reference verified mission archives.
              </p>
              <div className="pt-1">
                <button
                  onClick={() => onNavigate('/nasa-data')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#76B93F] hover:text-[#9BD85A] hover:underline transition-colors focus:outline-hidden focus:ring-1 focus:ring-[#76B93F] rounded-xs"
                >
                  <span>Explore NASA Data</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* ================= 2. PLATFORM COLUMN ================= */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#76B93F]">
              {FOOTER_NAV_CONFIG.platform.title}
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-white/80" role="list">
              {FOOTER_NAV_CONFIG.platform.links.map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => onNavigate(link.path)}
                    className="text-left py-1 hover:text-[#76B93F] hover:translate-x-1 transition-all duration-150 focus:outline-hidden focus:ring-1 focus:ring-[#76B93F] rounded-xs inline-block"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* ================= 3. SOLUTIONS COLUMN ================= */}
          <div className="lg:col-span-3 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#76B93F]">
              {FOOTER_NAV_CONFIG.solutions.title}
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-white/80" role="list">
              {FOOTER_NAV_CONFIG.solutions.links.map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => onNavigate(link.path)}
                    className="text-left py-1 hover:text-[#76B93F] hover:translate-x-1 transition-all duration-150 focus:outline-hidden focus:ring-1 focus:ring-[#76B93F] rounded-xs inline-block"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* ================= 4. RESOURCES COLUMN ================= */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-[#76B93F]">
              {FOOTER_NAV_CONFIG.resources.title}
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm text-white/80" role="list">
              {FOOTER_NAV_CONFIG.resources.links.map((link) => (
                <li key={link.path}>
                  <button
                    onClick={() => onNavigate(link.path)}
                    className="text-left py-1 hover:text-[#76B93F] hover:translate-x-1 transition-all duration-150 focus:outline-hidden focus:ring-1 focus:ring-[#76B93F] rounded-xs inline-block"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* ================= COPYRIGHT AND LEGAL SECTION ================= */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/60">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
            <span>© 2026 Field Shift Technologies. All rights reserved.</span>
            <span className="hidden sm:inline text-white/30">•</span>
            <span className="text-[#9BD85A]/90 font-medium">
              NASA Space Apps & Earth Observation Hackathon Initiative
            </span>
          </div>

          <div className="flex items-center gap-6">
            {FOOTER_NAV_CONFIG.legal.map((item) => (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                className="text-white/70 hover:text-[#76B93F] hover:underline transition-colors focus:outline-hidden focus:ring-1 focus:ring-[#76B93F] rounded-xs py-1"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </footer>
  );
};
