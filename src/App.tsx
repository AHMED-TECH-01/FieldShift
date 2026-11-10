/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { Hero } from './components/home/Hero';
import { FeatureBar } from './components/home/FeatureBar';
import { RotationSimulator } from './components/home/RotationSimulator';
import { NasaExplorerPreview } from './components/home/NasaExplorerPreview';
import { DemoModal } from './components/home/DemoModal';
import { AuthModal } from './components/auth/AuthModal';
import { AboutPage, FeaturesPage, NasaDataPage, SolutionsPage, ResourcesPage } from './pages/PublicPages';
import { CropRotationPage } from './pages/platform/CropRotationPage';
import { SoilIntelligencePage } from './pages/platform/SoilIntelligencePage';
import { FieldRiskPage } from './pages/platform/FieldRiskPage';
import {
  RowCropProducersPage,
  RegenerativeAgPage,
  WatershedConservationPage,
  CropAdvisorsPage,
} from './pages/solutions/SolutionsPages';
import { ScienceTeamPage } from './pages/about/ScienceTeamPage';
import {
  AgronomicDocsPage,
  NasaEarthdataGuidePage,
  SsurgoIntegrationPage,
  ScientificEthicsPage,
} from './pages/resources/ResourcePages';
import { AiAdvisorPage } from './pages/resources/AiAdvisorPage';
import { PrivacyPolicyPage, TermsOfServicePage } from './pages/legal/LegalPages';
import { Dashboard } from './pages/Dashboard';
import { User } from './types';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup' | 'verify'>('signin');
  const [demoModalOpen, setDemoModalOpen] = useState<boolean>(false);
  const [selectedStrategy, setSelectedStrategy] = useState<'A' | 'B' | 'C'>('B');

  // Sync with browser URL / history
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);

    // Initial path
    if (window.location.pathname && window.location.pathname !== '/') {
      setCurrentPath(window.location.pathname);
    }

    // Check localStorage for logged-in user session
    const storedUser = localStorage.getItem('fieldshift_user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        console.warn('Failed to parse cached user session');
      }
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, '', path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAuth = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthInitialMode(mode);
    setAuthModalOpen(true);
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setAuthModalOpen(false);
    navigateTo('/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('fieldshift_token');
    localStorage.removeItem('fieldshift_user');
    setCurrentUser(null);
    navigateTo('/');
  };

  const handleFeatureSelect = (featureId: string) => {
    if (featureId === 'rotation') {
      const el = document.getElementById('crop-rotation-engine');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigateTo('/dashboard/crop-rotation');
      }
    } else if (featureId === 'nasa') {
      navigateTo('/dashboard/earth-observation');
    } else if (featureId === 'soil') {
      navigateTo('/dashboard/soil-intelligence');
    } else if (featureId === 'risk') {
      navigateTo('/dashboard/field-risk');
    } else if (featureId === 'ai-advisor') {
      navigateTo('/dashboard/ai-advisor');
    }
  };

  // If on Dashboard routes, render the dedicated Dashboard view
  if (currentPath.startsWith('/dashboard')) {
    // If user is not logged in, provide a convenient default guest session or prompt
    const effectiveUser: User = currentUser || {
      email: 'ahmed@example.com',
      fullName: 'Ahmed Raza',
      verified: true,
    };

    return (
      <Dashboard
        currentUser={effectiveUser}
        activeSubPage={currentPath}
        onNavigate={navigateTo}
        onLogout={handleLogout}
      />
    );
  }

  // Handle direct auth routes if accessed directly
  if (currentPath === '/auth/sign-in') {
    return (
      <div className="min-h-screen bg-[#F8F7ED] flex flex-col justify-between">
        <Navbar
          currentUser={currentUser}
          currentPath={currentPath}
          onNavigate={navigateTo}
          onOpenAuth={handleOpenAuth}
          onLogout={handleLogout}
        />
        <div className="flex-1 flex items-center justify-center p-4">
          <AuthModal
            isOpen={true}
            initialMode="signin"
            onClose={() => navigateTo('/')}
            onSuccess={handleAuthSuccess}
          />
        </div>
        <Footer onNavigate={navigateTo} />
      </div>
    );
  }

  if (currentPath === '/auth/sign-up') {
    return (
      <div className="min-h-screen bg-[#F8F7ED] flex flex-col justify-between">
        <Navbar
          currentUser={currentUser}
          currentPath={currentPath}
          onNavigate={navigateTo}
          onOpenAuth={handleOpenAuth}
          onLogout={handleLogout}
        />
        <div className="flex-1 flex items-center justify-center p-4">
          <AuthModal
            isOpen={true}
            initialMode="signup"
            onClose={() => navigateTo('/')}
            onSuccess={handleAuthSuccess}
          />
        </div>
        <Footer onNavigate={navigateTo} />
      </div>
    );
  }

  // Render Public Website with exactly ONE instance of each component
  return (
    <div className="min-h-screen bg-[#F8F7ED] text-[#102A24] flex flex-col selection:bg-[#76B93F]/30 selection:text-[#073D2B]">
      
      {/* 1. Exactly ONE Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        currentPath={currentPath}
        onNavigate={navigateTo}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      {/* 2. Route Content */}
      <main className="flex-1">
        {currentPath === '/' && (
          <>
            {/* Exactly ONE Hero Section with Two-Column Grid */}
            <Hero
              onExplore={() => {
                if (currentUser) {
                  navigateTo('/dashboard');
                } else {
                  navigateTo('/dashboard');
                }
              }}
              onWatchDemo={() => setDemoModalOpen(true)}
              onSelectStrategy={(stratCode) => {
                setSelectedStrategy(stratCode);
                const el = document.getElementById('crop-rotation-engine');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              onViewDetailedAnalysis={() => navigateTo('/dashboard/crop-rotation')}
            />

            {/* Exactly ONE Feature Bar (Separate Layout Region, Not an Overlay) */}
            <FeatureBar onSelectFeature={handleFeatureSelect} />

            {/* Exactly ONE Interactive Crop Rotation Engine */}
            <RotationSimulator
              selectedStrategyCode={selectedStrategy}
              onOpenDetailedPage={() => navigateTo('/dashboard/crop-rotation')}
            />

            {/* Exactly ONE NASA Earth Observation Live Explorer Preview */}
            <NasaExplorerPreview onOpenExplorer={() => navigateTo('/dashboard/earth-observation')} />
          </>
        )}

        {currentPath === '/about' && (
          <AboutPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/about/science-team' && (
          <ScienceTeamPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/features' && (
          <FeaturesPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/nasa-data' && (
          <NasaDataPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {/* Platform Routes */}
        {currentPath === '/crop-rotation' && (
          <CropRotationPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/soil-intelligence' && (
          <SoilIntelligencePage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/field-risk' && (
          <FieldRiskPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {/* Solutions Routes */}
        {currentPath === '/solutions' && (
          <SolutionsPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/solutions/row-crop-producers' && (
          <RowCropProducersPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/solutions/regenerative-agriculture' && (
          <RegenerativeAgPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/solutions/watershed-conservation' && (
          <WatershedConservationPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/solutions/crop-advisors' && (
          <CropAdvisorsPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {/* Resources Routes */}
        {currentPath === '/resources' && (
          <ResourcesPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/resources/agronomic-documentation' && (
          <AgronomicDocsPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/resources/nasa-earthdata-guide' && (
          <NasaEarthdataGuidePage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/resources/ssurgo-integration' && (
          <SsurgoIntegrationPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/resources/scientific-ethics' && (
          <ScientificEthicsPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {currentPath === '/ai-advisor' && (
          <AiAdvisorPage onNavigate={navigateTo} onOpenAuth={handleOpenAuth} />
        )}

        {/* Legal Routes */}
        {currentPath === '/privacy-policy' && (
          <PrivacyPolicyPage onNavigate={navigateTo} />
        )}

        {currentPath === '/terms-of-service' && (
          <TermsOfServicePage onNavigate={navigateTo} />
        )}
      </main>

      {/* 3. Exactly ONE Footer */}
      <Footer onNavigate={navigateTo} />

      {/* 4. Modals */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authInitialMode}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      <DemoModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
        onExplore={() => {
          setDemoModalOpen(false);
          navigateTo('/dashboard');
        }}
      />

    </div>
  );
}
