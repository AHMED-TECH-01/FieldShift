import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Menu,
  X,
  User as UserIcon,
  Globe,
  Leaf,
  Layers,
  BarChart3,
  Bot,
  ExternalLink,
  BookOpen,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { User } from '../../types';

interface NavbarProps {
  currentUser: User | null;
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenAuth: (initialMode?: 'signin' | 'signup') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentPath,
  onNavigate,
  onOpenAuth,
  onLogout,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const solutionsRef = useRef<HTMLDivElement>(null);
  const resourcesRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Handle escape key and outside click to close menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (solutionsRef.current && !solutionsRef.current.contains(e.target as Node)) {
        setSolutionsOpen(false);
      }
      if (resourcesRef.current && !resourcesRef.current.contains(e.target as Node)) {
        setResourcesOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setSolutionsOpen(false);
        setResourcesOpen(false);
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const navItemClass = (path: string) =>
    `px-3 py-2 min-h-[40px] text-sm font-medium transition-all rounded-full inline-flex items-center ${
      currentPath === path
        ? 'text-[#073D2B] bg-[#E7EFE6] font-semibold'
        : 'text-[#204033] hover:text-[#073D2B] hover:bg-[#F0F5EE]'
    }`;

  const mobileNavItemClass = (path: string) =>
    `w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium min-h-[44px] flex items-center justify-between transition-colors ${
      currentPath === path
        ? 'text-[#073D2B] bg-[#E7EFE6] font-bold border-l-4 border-[#76B93F]'
        : 'text-[#204033] hover:bg-[#F8F7ED]'
    }`;

  return (
    <header className="sticky top-0 z-50 w-full bg-[#F8F7ED]/95 backdrop-blur-md border-b border-[#E2E8DE]/80 transition-all pt-safe">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
        
        {/* Brand Logo & Tagline */}
        <button
          type="button"
          onClick={() => {
            onNavigate('/');
            setMobileMenuOpen(false);
          }}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group select-none min-w-0 text-left min-h-[44px] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] rounded-xl pr-1"
        >
          <div className="relative w-9 h-9 sm:w-11 sm:h-11 flex-shrink-0">
            <img
              src="/assets/aistudio/Eco-Tech_Globe_Branding_Logo__1__5456db76.png"
              alt="Field Shift Logo"
              className="w-full h-full object-contain rounded-full shadow-sm group-hover:scale-105 transition-transform"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#073D2B] truncate">
                Field<span className="text-[#76B93F]">Shift</span>
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#EAF5DF] text-[#145C3D] border border-[#CDE5BA] shrink-0">
                NASA DATA
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#527367] tracking-wide hidden sm:block truncate">
              Smarter Decisions. Greener Tomorrow.
            </span>
          </div>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1.5 bg-[#FFFFFF]/80 px-3 py-1.5 rounded-full border border-[#E2E8DE] shadow-xs">
          <button onClick={() => onNavigate('/')} className={navItemClass('/')}>
            Home
          </button>
          <button onClick={() => onNavigate('/about')} className={navItemClass('/about')}>
            About
          </button>
          <button onClick={() => onNavigate('/features')} className={navItemClass('/features')}>
            Features
          </button>
          <button onClick={() => onNavigate('/nasa-data')} className={navItemClass('/nasa-data')}>
            NASA Data
          </button>

          {/* Solutions Dropdown */}
          <div className="relative" ref={solutionsRef}>
            <button
              onClick={() => setSolutionsOpen(!solutionsOpen)}
              className={`flex items-center gap-1 px-3 py-2 min-h-[40px] text-sm font-medium rounded-full transition-all ${
                solutionsOpen || currentPath === '/solutions'
                  ? 'text-[#073D2B] bg-[#E7EFE6]'
                  : 'text-[#204033] hover:text-[#073D2B] hover:bg-[#F0F5EE]'
              }`}
            >
              Solutions
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${solutionsOpen ? 'rotate-180' : ''}`} />
            </button>

            {solutionsOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[#E2E8DE] p-2 animate-fs-fade z-50">
                <div
                  onClick={() => {
                    onNavigate('/solutions');
                    setSolutionsOpen(false);
                  }}
                  className="p-2.5 rounded-xl hover:bg-[#F8F7ED] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-[#073D2B]">
                    <Layers className="w-4 h-4 text-[#76B93F]" />
                    Row-Crop Producers
                  </div>
                  <p className="text-[11px] text-[#527367] mt-0.5 ml-6">
                    Commercial corn, soybean, wheat & sorghum rotation planning
                  </p>
                </div>
                <div
                  onClick={() => {
                    onNavigate('/solutions');
                    setSolutionsOpen(false);
                  }}
                  className="p-2.5 rounded-xl hover:bg-[#F8F7ED] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-[#073D2B]">
                    <Leaf className="w-4 h-4 text-[#76B93F]" />
                    Regenerative Co-ops
                  </div>
                  <p className="text-[11px] text-[#527367] mt-0.5 ml-6">
                    Multi-species cover crop mixtures & carbon sequestration credits
                  </p>
                </div>
                <div
                  onClick={() => {
                    onNavigate('/solutions');
                    setSolutionsOpen(false);
                  }}
                  className="p-2.5 rounded-xl hover:bg-[#F8F7ED] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-[#073D2B]">
                    <BarChart3 className="w-4 h-4 text-[#76B93F]" />
                    Watershed & Conservation
                  </div>
                  <p className="text-[11px] text-[#527367] mt-0.5 ml-6">
                    Erosion modeling with SRTM & GPM precipitation indices
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Resources Dropdown */}
          <div className="relative" ref={resourcesRef}>
            <button
              onClick={() => setResourcesOpen(!resourcesOpen)}
              className={`flex items-center gap-1 px-3 py-2 min-h-[40px] text-sm font-medium rounded-full transition-all ${
                resourcesOpen || currentPath === '/resources'
                  ? 'text-[#073D2B] bg-[#E7EFE6]'
                  : 'text-[#204033] hover:text-[#073D2B] hover:bg-[#F0F5EE]'
              }`}
            >
              Resources
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${resourcesOpen ? 'rotate-180' : ''}`} />
            </button>

            {resourcesOpen && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[#E2E8DE] p-2 animate-fs-fade z-50">
                <div
                  onClick={() => {
                    onNavigate('/resources');
                    setResourcesOpen(false);
                  }}
                  className="p-2.5 rounded-xl hover:bg-[#F8F7ED] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-[#073D2B]">
                    <Globe className="w-4 h-4 text-[#76B93F]" />
                    NASA Earthdata Guide
                  </div>
                  <p className="text-[11px] text-[#527367] mt-0.5 ml-6">
                    Documentation on SMAP, GPM, MODIS, and POWER sensors
                  </p>
                </div>
                <div
                  onClick={() => {
                    onNavigate('/resources');
                    setResourcesOpen(false);
                  }}
                  className="p-2.5 rounded-xl hover:bg-[#F8F7ED] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-[#073D2B]">
                    <BookOpen className="w-4 h-4 text-[#76B93F]" />
                    Scientific Methodology
                  </div>
                  <p className="text-[11px] text-[#527367] mt-0.5 ml-6">
                    Soil health models, crop water use algorithms & caveats
                  </p>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {currentUser ? (
            <div className="relative" ref={userRef}>
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 min-h-[44px] rounded-full bg-white border border-[#E2E8DE] shadow-xs hover:border-[#76B93F] transition-all"
                aria-label="Account menu"
              >
                <div className="w-7 h-7 rounded-full bg-[#073D2B] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {currentUser.fullName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-[#073D2B] max-w-[120px] truncate hidden md:inline">
                  {currentUser.fullName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#527367] shrink-0" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-xl border border-[#E2E8DE] p-2 z-50 animate-fs-fade">
                  <div className="px-3 py-2 border-b border-[#F0F5EE] mb-1">
                    <p className="text-xs font-bold text-[#073D2B] truncate">{currentUser.fullName}</p>
                    <p className="text-[11px] text-[#527367] truncate">{currentUser.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      onNavigate('/dashboard');
                      setUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 min-h-[44px] text-xs font-medium text-[#073D2B] hover:bg-[#F0F5EE] rounded-xl text-left"
                  >
                    <BarChart3 className="w-4 h-4 text-[#76B93F]" />
                    Farmer Dashboard
                  </button>
                  <button
                    onClick={() => {
                      onNavigate('/dashboard/ai-advisor');
                      setUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 min-h-[44px] text-xs font-medium text-[#073D2B] hover:bg-[#F0F5EE] rounded-xl text-left"
                  >
                    <Bot className="w-4 h-4 text-[#76B93F]" />
                    AI Agricultural Advisor
                  </button>
                  <div className="h-px bg-[#F0F5EE] my-1" />
                  <button
                    onClick={() => {
                      onLogout();
                      setUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 min-h-[44px] text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => onOpenAuth('signin')}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-[#073D2B] hover:bg-white/80 rounded-full border border-transparent hover:border-[#E2E8DE] transition-all whitespace-nowrap"
              >
                <UserIcon className="w-4 h-4 shrink-0" />
                <span>Sign In</span>
              </button>
              <button
                onClick={() => onOpenAuth('signup')}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 min-h-[44px] text-xs sm:text-sm font-semibold text-white bg-[#073D2B] hover:bg-[#145C3D] rounded-full shadow-md hover:shadow-lg transition-all whitespace-nowrap"
              >
                <span>Get Started</span>
                <Sparkles className="w-3.5 h-3.5 text-[#76B93F]" />
              </button>
            </div>
          )}

          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#073D2B] hover:bg-[#E7EFE6] transition-colors focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
            aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Backdrop & Smooth Animated Drawer */}
      <div
        className={`lg:hidden fixed inset-0 top-16 sm:top-20 z-40 flex flex-col justify-start transition-all duration-300 ease-out ${
          mobileMenuOpen
            ? 'opacity-100 pointer-events-auto visible'
            : 'opacity-0 pointer-events-none invisible'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <div
          className={`fixed inset-0 top-16 sm:top-20 bg-black/50 backdrop-blur-xs transition-opacity duration-300 ${
            mobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />

        <div
          ref={mobileMenuRef}
          className={`relative z-10 bg-white border-b border-[#E2E8DE] px-4 pt-3 pb-6 space-y-1.5 max-h-[calc(100dvh-4rem)] sm:max-h-[calc(100dvh-5rem)] overflow-y-auto shadow-2xl transform transition-transform duration-300 ease-out ${
            mobileMenuOpen ? 'translate-y-0' : '-translate-y-4'
          }`}
        >
          <div className="space-y-1">
            <button
              onClick={() => {
                onNavigate('/');
                setMobileMenuOpen(false);
              }}
              className={mobileNavItemClass('/')}
            >
              <span>Home</span>
              {currentPath === '/' && <span className="text-[10px] font-bold text-[#76B93F]">Active</span>}
            </button>
            <button
              onClick={() => {
                onNavigate('/about');
                setMobileMenuOpen(false);
              }}
              className={mobileNavItemClass('/about')}
            >
              <span>About Field Shift</span>
              {currentPath === '/about' && <span className="text-[10px] font-bold text-[#76B93F]">Active</span>}
            </button>
            <button
              onClick={() => {
                onNavigate('/features');
                setMobileMenuOpen(false);
              }}
              className={mobileNavItemClass('/features')}
            >
              <span>Core Features</span>
              {currentPath === '/features' && <span className="text-[10px] font-bold text-[#76B93F]">Active</span>}
            </button>
            <button
              onClick={() => {
                onNavigate('/nasa-data');
                setMobileMenuOpen(false);
              }}
              className={mobileNavItemClass('/nasa-data')}
            >
              <span>NASA Earth Observations</span>
              {currentPath === '/nasa-data' && <span className="text-[10px] font-bold text-[#76B93F]">Active</span>}
            </button>
            <button
              onClick={() => {
                onNavigate('/crop-rotation');
                setMobileMenuOpen(false);
              }}
              className={mobileNavItemClass('/crop-rotation')}
            >
              <span>Crop Rotation Simulator</span>
              {currentPath === '/crop-rotation' && <span className="text-[10px] font-bold text-[#76B93F]">Active</span>}
            </button>
            <button
              onClick={() => {
                onNavigate('/soil-intelligence');
                setMobileMenuOpen(false);
              }}
              className={mobileNavItemClass('/soil-intelligence')}
            >
              <span>Soil Intelligence & Moisture</span>
              {currentPath === '/soil-intelligence' && <span className="text-[10px] font-bold text-[#76B93F]">Active</span>}
            </button>
            <button
              onClick={() => {
                onNavigate('/field-risk');
                setMobileMenuOpen(false);
              }}
              className={mobileNavItemClass('/field-risk')}
            >
              <span>Field Risk Assessment</span>
              {currentPath === '/field-risk' && <span className="text-[10px] font-bold text-[#76B93F]">Active</span>}
            </button>
            <button
              onClick={() => {
                onNavigate('/solutions');
                setMobileMenuOpen(false);
              }}
              className={mobileNavItemClass('/solutions')}
            >
              <span>Agricultural Solutions</span>
              {currentPath === '/solutions' && <span className="text-[10px] font-bold text-[#76B93F]">Active</span>}
            </button>
            <button
              onClick={() => {
                onNavigate('/resources');
                setMobileMenuOpen(false);
              }}
              className={mobileNavItemClass('/resources')}
            >
              <span>Resources & Science</span>
              {currentPath === '/resources' && <span className="text-[10px] font-bold text-[#76B93F]">Active</span>}
            </button>
            <button
              onClick={() => {
                onNavigate('/ai-advisor');
                setMobileMenuOpen(false);
              }}
              className={mobileNavItemClass('/ai-advisor')}
            >
              <span>AI Agricultural Advisor</span>
              {currentPath === '/ai-advisor' && <span className="text-[10px] font-bold text-[#76B93F]">Active</span>}
            </button>
          </div>

          <div className="pt-3 border-t border-[#E2E8DE] flex flex-col sm:flex-row gap-2.5">
            {currentUser ? (
              <>
                <button
                  onClick={() => {
                    onNavigate('/dashboard');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full sm:flex-1 min-h-[48px] bg-[#073D2B] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform"
                >
                  <BarChart3 className="w-4 h-4 text-[#76B93F]" />
                  <span>Farmer Dashboard</span>
                </button>
                <button
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full sm:w-auto px-4 min-h-[48px] bg-red-50 text-red-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border border-red-200"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    onOpenAuth('signin');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full sm:flex-1 min-h-[48px] bg-[#F0F5EE] text-[#073D2B] rounded-xl font-bold text-sm flex items-center justify-center transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    onOpenAuth('signup');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full sm:flex-1 min-h-[48px] bg-[#073D2B] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 shadow-md active:scale-[0.98] transition-transform"
                >
                  <span>Create Account</span>
                  <Sparkles className="w-3.5 h-3.5 text-[#76B93F]" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
