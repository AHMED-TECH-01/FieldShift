import React from 'react';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { ShieldCheck, FileText, Lock, Globe, Scale } from 'lucide-react';

interface LegalPageProps {
  onNavigate: (path: string) => void;
}

/* ==========================================================================
   1. PRIVACY POLICY (/privacy-policy)
   ========================================================================== */
export const PrivacyPolicyPage: React.FC<LegalPageProps> = ({ onNavigate }) => {
  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        <div>
          <Breadcrumbs
            items={[
              { label: 'Legal' },
              { label: 'Privacy Policy' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
              Data Protection & Producer Sovereignty
            </span>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B] mt-1">
              Field Shift Privacy Policy
            </h1>
            <p className="text-xs text-[#527367] mt-2">Effective Date: January 1, 2026 | Version 2.4</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#D5E5CA] shadow-sm space-y-6 text-xs sm:text-sm text-[#2A4D3E] leading-relaxed">
          
          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">1. Our Agricultural Privacy Pledge</h2>
            <p>
              Field Shift Technologies (“Field Shift,” “we,” “our,” or “us”) operates with a fundamental commitment to
              farmer data sovereignty. We recognize that agricultural field boundaries, soil chemistry reports, and crop
              histories represent valuable intellectual and business assets. We do not sell, rent, license, or broker
              user farm data to agricultural input conglomerates, commodity trading desks, or speculative third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">2. Information We Collect</h2>
            <p>We collect information you explicitly provide to deliver agronomic decision support:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li><strong>Account Credentials:</strong> Full name, verified email address, and encrypted passwords.</li>
              <li><strong>Farm Property Details:</strong> Farm names, acreage, approximate latitude/longitude coordinates, and historical crop rotations.</li>
              <li><strong>Soil Attributes:</strong> Laboratory assay inputs including pH, organic matter percentage, cation exchange capacity (CEC), and N-P-K levels.</li>
              <li><strong>Farmer Priorities:</strong> Relative weighting inputs for water conservation, profitability, and soil health.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">3. How Your Data Is Used</h2>
            <p>Your information is processed strictly for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>Querying open NASA Earth observation archives (SMAP, GPM IMERG, MODIS) corresponding to your geographic coordinates.</li>
              <li>Computing comparative crop rotation suitability scores and bare-field exposure calendars.</li>
              <li>Providing personalized, grounded agricultural advisory sessions via our Gemini 3.8 Flash copilot.</li>
              <li>Generating downloadable agronomic compliance and conservation dossiers for your personal records.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">4. Public NASA Observation Integration</h2>
            <p>
              Field Shift ingests publicly available, non-classified Earth observation streams provided by NASA and its
              partner distributed active archive centers (DAACs). No proprietary farmer data is transmitted to or stored
              in public government archives during standard query operations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">5. Data Security & Storage</h2>
            <p>
              All data transmissions are encrypted using standard Transport Layer Security (TLS 1.3). Sensitive user
              sessions are safeguarded via secure, salted password hashing and role-gated API tokens.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">6. Account Erasure & Data Portability</h2>
            <p>
              You maintain the absolute right to export your complete farm profiles, soil tests, and rotation plans at
              any time. Upon written account closure or deletion request, all associated farm geometries and private
              telemetry records are permanently expunged from our active production databases.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">7. Contact Our Privacy Office</h2>
            <p>
              If you have inquiries regarding our data handling or wish to exercise data rights, contact us at:
              <br />
              <strong className="text-[#073D2B]">privacy@fieldshift.tech</strong> — Field Shift Technologies, Ames, IA.
            </p>
          </section>

        </div>

      </div>
    </div>
  );
};

/* ==========================================================================
   2. TERMS OF SERVICE (/terms-of-service)
   ========================================================================== */
export const TermsOfServicePage: React.FC<LegalPageProps> = ({ onNavigate }) => {
  return (
    <div className="py-10 md:py-16 bg-[#F8F7ED] min-h-screen text-[#102A24]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        <div>
          <Breadcrumbs
            items={[
              { label: 'Legal' },
              { label: 'Terms of Service' },
            ]}
            onNavigate={onNavigate}
          />
          <div className="mt-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
              Platform Agreement
            </span>
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#073D2B] mt-1">
              Field Shift Terms of Service
            </h1>
            <p className="text-xs text-[#527367] mt-2">Effective Date: January 1, 2026 | Version 2.4</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#D5E5CA] shadow-sm space-y-6 text-xs sm:text-sm text-[#2A4D3E] leading-relaxed">
          
          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">1. Acceptance of Terms</h2>
            <p>
              By accessing, browsing, registering for, or using the Field Shift agricultural intelligence platform,
              web applications, APIs, or associated services (collectively, the “Platform”), you agree to be bound
              by these Terms of Service. If you do not agree to these terms, you must discontinue use immediately.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">2. Permitted Agricultural Use</h2>
            <p>
              Field Shift is provided to assist farmers, agricultural producers, land managers, and certified crop advisors
              in evaluating crop rotation strategies, analyzing environmental hazards, and interpreting public Earth observation
              data. You agree to use the platform solely for lawful agricultural management, educational, and research purposes.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">3. Agronomic Disclaimer & Limitation of Liability</h2>
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 font-medium">
              CRITICAL NOTICE: Field Shift provides predictive simulations and educational decision support based on
              mathematical models and open satellite observations. Field Shift does not provide certified agronomic,
              pesticide application, financial, or legal advice. Real-world crop emergence, moisture availability, and
              economic yields depend on localized microclimates, seed varieties, biological variability, and equipment
              operation outside of our control. Field Shift Technologies disclaims all liability for crop failure, yield
              losses, or financial damages arising from operational farm decisions.
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">4. NASA Open Science Data Compliance</h2>
            <p>
              Data products derived from NASA Earth science missions (including SMAP, GPM IMERG, MODIS, and NASA POWER)
              are provided in accordance with NASA Open Science policies. Field Shift is an independent application
              developed for agricultural intelligence; reference to NASA data products does not constitute an official
              endorsement, commercial partnership, or sponsorship by NASA or the United States Government.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">5. Intellectual Property Rights</h2>
            <p>
              The Field Shift platform, proprietary algorithms, visual branding, Three.js 3D Earth shaders, software code,
              and documentation are the property of Field Shift Technologies. Users retain full proprietary ownership of
              their uploaded field boundaries, soil laboratory tests, and operational harvest logs.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">6. Account Security & Verification</h2>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and for all activities
              undertaken through your authenticated account. You agree to notify us immediately of any unauthorized account
              access or security compromise.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-xl font-bold text-[#073D2B]">7. Governing Law & Jurisdiction</h2>
            <p>
              These Terms of Service are governed by and construed in accordance with the laws of the State of Iowa,
              without regard to its conflict of law provisions. Any legal proceedings arising from these terms shall be
              instituted exclusively in the state or federal courts situated in Story County, Iowa.
            </p>
          </section>

        </div>

      </div>
    </div>
  );
};
