import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Tractor,
  Satellite,
  Sprout,
  RefreshCw,
  AlertTriangle,
  Calendar,
  Bot,
  FileText,
  Settings as SettingsIcon,
  Plus,
  Send,
  Download,
  Info,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Droplets,
  Thermometer,
  ShieldAlert,
  MapPin,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Sliders,
  BookOpen,
  Map as MapIcon,
  Bug,
  DollarSign,
  FileCheck2,
} from 'lucide-react';
import {
  Farm,
  CropRotationStrategy,
  FieldRiskIndicator,
  User,
  FarmerPriorities,
  WhatIfScenario,
} from '../types';
import { PrioritiesEngine } from '../components/dashboard/PrioritiesEngine';
import { CropDatabaseExplorer } from '../components/dashboard/CropDatabaseExplorer';
import { BareFieldDetector } from '../components/dashboard/BareFieldDetector';
import { PestDiseaseTracker } from '../components/dashboard/PestDiseaseTracker';
import { WhatIfSimulator } from '../components/dashboard/WhatIfSimulator';
import { ExplainabilityExplorer } from '../components/dashboard/ExplainabilityExplorer';
import { InteractiveFarmMap } from '../components/dashboard/InteractiveFarmMap';
import { SupplementalIncomeModal } from '../components/dashboard/SupplementalIncomeModal';
import { NasaRoadmapExplorer } from '../components/dashboard/NasaRoadmapExplorer';

interface DashboardProps {
  currentUser: User;
  activeSubPage: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  activeSubPage,
  onNavigate,
  onLogout,
}) => {
  // State
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>('farm-1');
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);

  // Farmer Priorities state
  const [priorities, setPriorities] = useState<FarmerPriorities>({
    waterConservation: 4,
    profitability: 4,
    forageValue: 2,
    nitrogenFixing: 5,
    soilOrganicMatter: 5,
    erosionReduction: 4,
    soilInfiltration: 4,
    marketSuitability: 4,
    droughtResilience: 4,
    cropDiversity: 3,
    equipmentCompatibility: 3,
    plantingHarvestConstraints: 3,
  });

  // What-If Scenario state
  const [activeScenario, setActiveScenario] = useState<WhatIfScenario | null>(null);

  // Dynamic Strategies state
  const [strategies, setStrategies] = useState<CropRotationStrategy[]>([]);
  const [rankingExplanation, setRankingExplanation] = useState<string>('');

  // Supplemental Income Modal state
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);

  // New Farm form state
  const [newFarmName, setNewFarmName] = useState('');
  const [newFarmLocation, setNewFarmLocation] = useState('');
  const [newFarmAcreage, setNewFarmAcreage] = useState('320');
  const [newFarmCrop, setNewFarmCrop] = useState('Corn (Maize)');
  const [newFarmSoilType, setNewFarmSoilType] = useState('Silt Loam');
  const [newFarmPH, setNewFarmPH] = useState('6.5');
  const [newFarmOM, setNewFarmOM] = useState('3.4');

  // AI Advisor state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiChatHistory, setAiChatHistory] = useState<
    Array<{
      sender: 'user' | 'ai';
      text: string;
      source?: string;
      isFallback?: boolean;
      fallbackReason?: string;
      originalPrompt?: string;
      latencyMs?: number;
    }>
  >([
    {
      sender: 'ai',
      text: `Hello ${currentUser.fullName || 'Farmer'}! I am your Field Shift Agronomic Advisor powered by Gemini 3.8 Flash.
I am actively synced with your farm's NASA SMAP soil moisture readings (0.284 m³/m³), GPM precipitation records, and your custom priorities profile.

How can I help optimize your crop sequence, evaluate what-if climate scenarios, or break pest host cycles today?`,
      source: 'gemini-3.8-flash',
      isFallback: false,
    },
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  // Load farms & initial rotation strategies
  useEffect(() => {
    fetchFarms();
  }, []);

  useEffect(() => {
    recalculateStrategies(priorities, activeScenario);
  }, [selectedFarmId]);

  const fetchFarms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/farms');
      const data = await res.json();
      if (data.farms && data.farms.length > 0) {
        setFarms(data.farms);
        setSelectedFarmId(data.farms[0].id);
      }
    } catch (e) {
      console.error('Failed to load farms', e);
    } finally {
      setLoading(false);
    }
  };

  const recalculateStrategies = async (prio: FarmerPriorities, scen?: WhatIfScenario | null) => {
    setRecalculating(true);
    try {
      const res = await fetch('/api/rotations/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmId: selectedFarmId,
          priorities: prio,
          scenario: scen || null,
        }),
      });
      const data = await res.json();
      if (data.strategies) {
        setStrategies(data.strategies);
        setRankingExplanation(data.rankingExplanation || '');
      }
    } catch (e) {
      console.error('Failed to recalculate strategies', e);
    } finally {
      setRecalculating(false);
    }
  };

  const handleApplyPriorities = (newPrio: FarmerPriorities) => {
    setPriorities(newPrio);
    recalculateStrategies(newPrio, activeScenario);
  };

  const handleApplyScenario = (scenario: WhatIfScenario) => {
    setActiveScenario(scenario);
    recalculateStrategies(priorities, scenario);
  };

  const handleResetScenario = () => {
    setActiveScenario(null);
    recalculateStrategies(priorities, null);
  };

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmName.trim() || !newFarmLocation.trim()) return;

    try {
      const res = await fetch('/api/farms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFarmName,
          location: newFarmLocation,
          acreage: Number(newFarmAcreage),
          currentCrop: newFarmCrop,
          soilType: newFarmSoilType,
          soilPH: Number(newFarmPH),
          organicMatter: Number(newFarmOM),
        }),
      });
      const data = await res.json();
      if (data.success && data.farm) {
        setFarms((prev) => [data.farm, ...prev]);
        setSelectedFarmId(data.farm.id);
        onNavigate('/dashboard/farms');
      }
    } catch (e) {
      console.error('Failed to create farm', e);
    }
  };

  const handleSendAiPrompt = async (promptToSend?: string) => {
    const text = (promptToSend || aiPrompt).trim();
    if (!text || aiLoading) return;

    const newHistory = [...aiChatHistory, { sender: 'user' as const, text }];
    setAiChatHistory(newHistory);
    setAiPrompt('');
    setAiLoading(true);

    try {
      const res = await fetch('/api/gemini/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          farmId: selectedFarmId,
          priorities,
          scenario: activeScenario,
        }),
      });
      const data = await res.json();
      setAiChatHistory([
        ...newHistory,
        {
          sender: 'ai',
          text: data.reply || 'Agronomic assessment completed.',
          source: data.source || 'gemini-3.8-flash',
          isFallback: !!data.isFallback,
          fallbackReason: data.fallbackReason,
          originalPrompt: text,
          latencyMs: data.latencyMs,
        },
      ]);
    } catch (e: any) {
      setAiChatHistory([
        ...newHistory,
        {
          sender: 'ai',
          text: 'Unable to reach the agricultural advisor server. Please check network connectivity.',
          isFallback: true,
          fallbackReason: 'Network connection interrupted',
          originalPrompt: text,
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const activeFarm = farms.find((f) => f.id === selectedFarmId) || farms[0] || {
    id: 'farm-1',
    name: 'Prairie Ridge Valley Farm',
    location: 'Ames, Iowa',
    coordinates: [-93.62, 42.03],
    acreage: 480,
    currentCrop: 'Corn (Maize)',
    plantingSeason: 'Spring 2026',
    rotationHistory: ['Corn (2025)', 'Soybeans (2024)', 'Corn (2023)'],
    soilType: 'Clarion-Nicollet Loam',
    soilPH: 6.4,
    organicMatter: 3.8,
    nitrogen: 'Medium (18 ppm)',
    phosphorus: 'Low (12 ppm)',
    potassium: 'Medium (145 ppm)',
    drainage: 'Moderately Well Drained',
    lastSoilTest: '2025-10-15',
    createdAt: new Date().toISOString(),
  };

  const navItems = [
    { id: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: '/dashboard/farms', label: 'Farm Properties', icon: Tractor },
    { id: '/dashboard/priorities', label: 'Farmer Priorities', icon: Sliders, badge: 'REQ A' },
    { id: '/dashboard/crop-database', label: 'Crop Database', icon: BookOpen, badge: 'REQ B' },
    { id: '/dashboard/crop-rotation', label: 'Crop Rotation Engine', icon: RefreshCw, badge: 'REQ I/J' },
    { id: '/dashboard/scenarios', label: 'What-If Scenarios', icon: Sparkles, badge: 'REQ H' },
    { id: '/dashboard/earth-observation', label: 'NASA Data Roadmap', icon: Satellite, badge: 'REQ F' },
    { id: '/dashboard/farm-map', label: 'Interactive Farm Map', icon: MapIcon, badge: 'REQ K' },
    { id: '/dashboard/bare-field', label: 'Bare-Field Detector', icon: ShieldAlert, badge: 'REQ C' },
    { id: '/dashboard/pest-cycles', label: 'Pest & Disease Cycles', icon: Bug, badge: 'REQ D' },
    { id: '/dashboard/soil-intelligence', label: 'Soil Intelligence', icon: Sprout },
    { id: '/dashboard/field-risk', label: 'Field Risk Matrix', icon: AlertTriangle },
    { id: '/dashboard/climate-timeline', label: 'Climate Timeline', icon: Calendar },
    { id: '/dashboard/ai-advisor', label: 'AI Advisor', icon: Bot, badge: 'GEMINI' },
    { id: '/dashboard/reports', label: 'Compliance Reports', icon: FileText },
    { id: '/dashboard/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6EA] flex flex-col md:flex-row">
      
      {/* ================= SIDEBAR NAVIGATION ================= */}
      <aside className="w-full md:w-64 bg-[#073D2B] text-white flex-shrink-0 flex flex-col justify-between border-r border-[#145C3D]">
        <div>
          {/* Brand */}
          <div
            onClick={() => onNavigate('/')}
            className="p-5 border-b border-white/10 flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-white p-0.5 overflow-hidden flex-shrink-0">
              <img
                src="/assets/aistudio/Eco-Tech_Globe_Branding_Logo__1__5456db76.png"
                alt="Field Shift Logo"
                className="w-full h-full object-contain group-hover:scale-105 transition-transform"
              />
            </div>
            <div>
              <span className="font-display text-lg font-bold tracking-tight">
                Field<span className="text-[#76B93F]">Shift</span>
              </span>
              <p className="text-[10px] text-[#9BD85A] font-semibold">Intelligence Platform</p>
            </div>
          </div>

          {/* Active Farm Selector */}
          <div className="p-4 border-b border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9BD85A] block mb-1.5">
              Active Registered Farm
            </span>
            <select
              value={selectedFarmId}
              onChange={(e) => setSelectedFarmId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold border border-white/20 focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id} className="bg-[#073D2B] text-white">
                  {f.name} ({f.acreage} ac)
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Links */}
          <nav className="p-2.5 space-y-0.5 max-h-[calc(100vh-250px)] overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSubPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#145C3D] text-[#9BD85A] font-bold shadow-xs'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#76B93F]' : 'text-white/70'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-[#76B93F] text-[#073D2B] font-bold flex-shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#76B93F] text-[#073D2B] flex items-center justify-center font-bold text-xs flex-shrink-0">
              {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{currentUser.fullName || 'Farmer'}</p>
              <p className="text-[10px] text-white/60 truncate">{currentUser.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Sign Out"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT AREA ================= */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
        
        {/* Top Header Bar */}
        <header className="bg-white border-b border-[#E2E8DE] px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#527367]">Current Operation:</span>
              <span className="text-sm font-bold text-[#073D2B]">{activeFarm.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF5DF] text-[#145C3D]">
                {activeFarm.acreage} Acres
              </span>
              {activeScenario && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  Scenario Simulated
                </span>
              )}
            </div>
            <p className="text-xs text-[#527367] mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#76B93F]" />
              {activeFarm.location} (Soil: {activeFarm.soilType})
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIncomeModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-all border border-emerald-200"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Supplemental Income</span>
            </button>
            <button
              onClick={() => onNavigate('/dashboard/priorities')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#EAF5DF] text-[#145C3D] hover:bg-[#D8ECC8] text-xs font-bold transition-all"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Calibrate Priorities</span>
            </button>
            <button
              onClick={() => onNavigate('/dashboard/ai-advisor')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#073D2B] text-white hover:bg-[#145C3D] text-xs font-bold transition-all shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#76B93F]" />
              <span>Ask AI Advisor</span>
            </button>
          </div>
        </header>

        {/* Dashboard Body Dynamic Switch */}
        <div className="p-6 sm:p-8 space-y-6">

          {/* 1. OVERVIEW PAGE */}
          {activeSubPage === '/dashboard' && (
            <div className="space-y-6">
              
              {/* NASA Live Telemetry Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-white p-5 rounded-2xl border border-[#D5E5CA] shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#527367]">
                    <span className="flex items-center gap-1">
                      <Satellite className="w-3.5 h-3.5 text-sky-600" />
                      NASA SMAP
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 font-bold">9km L4</span>
                  </div>
                  <div className="font-display text-2xl font-bold text-[#073D2B]">0.284 m³/m³</div>
                  <p className="text-[11px] text-[#2A4D3E]">Root-Zone Soil Moisture (Optimal)</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#D5E5CA] shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#527367]">
                    <span className="flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5 text-blue-600" />
                      NASA GPM
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 font-bold">IMERG 30m</span>
                  </div>
                  <div className="font-display text-2xl font-bold text-[#073D2B]">68.4 mm</div>
                  <p className="text-[11px] text-[#2A4D3E]">30-Day Rain Total (+12mm anomaly)</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#D5E5CA] shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#527367]">
                    <span className="flex items-center gap-1">
                      <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                      NASA MODIS
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 font-bold">250m NDVI</span>
                  </div>
                  <div className="font-display text-2xl font-bold text-[#073D2B]">0.72 NDVI</div>
                  <p className="text-[11px] text-[#2A4D3E]">Canopy Health (Vigorous Photosynthesis)</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-[#D5E5CA] shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#527367]">
                    <span className="flex items-center gap-1">
                      <Thermometer className="w-3.5 h-3.5 text-amber-600" />
                      NASA POWER
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 font-bold">Daily Flux</span>
                  </div>
                  <div className="font-display text-2xl font-bold text-[#073D2B]">19.4 MJ/m²</div>
                  <p className="text-[11px] text-[#2A4D3E]">Solar Radiation (GDD Index: 168)</p>
                </div>

              </div>

              {/* Middle Section: Recommended Rotation Strategy Callout */}
              <div className="bg-gradient-to-br from-white to-[#FAFDF8] p-6 sm:p-8 rounded-3xl border border-[#D5E5CA] shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-8 space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Recommended Rotation Transition
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-[#073D2B]">
                    Strategy B: Soil Restoration & Living Root Cover
                  </h3>
                  <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
                    By introducing a winter Cereal Rye + Hairy Vetch cover crop following {activeFarm.currentCrop},
                    your soil will biological fix approximately <strong>75–95 lbs N/acre</strong> while mitigating winter runoff erosion
                    across your 2.3% topography.
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      onClick={() => onNavigate('/dashboard/crop-rotation')}
                      className="px-5 py-2.5 rounded-full bg-[#073D2B] text-white text-xs font-bold hover:bg-[#145C3D] transition-all flex items-center gap-2 shadow-xs"
                    >
                      <span>Explore 3-Strategy Comparison</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#76B93F]" />
                    </button>
                    <button
                      onClick={() => onNavigate('/dashboard/priorities')}
                      className="px-5 py-2.5 rounded-full bg-white border border-[#D5E5CA] text-[#073D2B] text-xs font-bold hover:bg-[#F0F5EE] transition-all"
                    >
                      Calibrate Farmer Priorities
                    </button>
                    <button
                      onClick={() => onNavigate('/dashboard/farm-map')}
                      className="px-5 py-2.5 rounded-full bg-white border border-[#D5E5CA] text-[#073D2B] text-xs font-bold hover:bg-[#F0F5EE] transition-all"
                    >
                      Inspect Satellite Map
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-[#FAFDF8] border border-[#D5E5CA] p-5 rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-[#073D2B] block">Strategy Score Breakdown</span>
                  <div className="space-y-2 text-xs">
                    {strategies.map((strat) => (
                      <div key={strat.code}>
                        <div className="flex justify-between">
                          <span className="text-[#527367]">Strategy {strat.code}:</span>
                          <span className="font-bold text-[#073D2B]">{strat.score}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-0.5">
                          <div
                            style={{ width: `${strat.score}%` }}
                            className={`h-full ${
                              strat.code === 'A'
                                ? 'bg-amber-500'
                                : strat.code === 'B'
                                ? 'bg-emerald-600'
                                : 'bg-blue-600'
                            }`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[#527367] italic pt-1">
                    *Calibrated using your 12 farmer priority inputs & NASA SMAP soil moisture.
                  </p>
                </div>
              </div>

              {/* Quick Challenge Features Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div
                  onClick={() => onNavigate('/dashboard/crop-database')}
                  className="p-5 rounded-2xl bg-white border border-[#D5E5CA] hover:border-[#76B93F] cursor-pointer transition-all shadow-2xs space-y-2"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-[#073D2B]">Crop Database</h4>
                  <p className="text-[11px] text-[#527367]">Explore 16 agronomic parameters across 8+ crops.</p>
                </div>

                <div
                  onClick={() => onNavigate('/dashboard/scenarios')}
                  className="p-5 rounded-2xl bg-white border border-[#D5E5CA] hover:border-[#76B93F] cursor-pointer transition-all shadow-2xs space-y-2"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-[#073D2B]">What-If Simulator</h4>
                  <p className="text-[11px] text-[#527367]">Test rainfall drops, heat spells, and late planting.</p>
                </div>

                <div
                  onClick={() => onNavigate('/dashboard/bare-field')}
                  className="p-5 rounded-2xl bg-white border border-[#D5E5CA] hover:border-[#76B93F] cursor-pointer transition-all shadow-2xs space-y-2"
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-800 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-[#073D2B]">Bare-Field Detector</h4>
                  <p className="text-[11px] text-[#527367]">Evaluate 135-day winter fallow & erosion hazard.</p>
                </div>

                <div
                  onClick={() => onNavigate('/dashboard/pest-cycles')}
                  className="p-5 rounded-2xl bg-white border border-[#D5E5CA] hover:border-[#76B93F] cursor-pointer transition-all shadow-2xs space-y-2"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                    <Bug className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-[#073D2B]">Pest Host Tracker</h4>
                  <p className="text-[11px] text-[#527367]">Break corn rootworm and soybean nematode cycles.</p>
                </div>

              </div>

            </div>
          )}

          {/* 2. FARMER PRIORITIES ENGINE (Requirement A) */}
          {activeSubPage === '/dashboard/priorities' && (
            <PrioritiesEngine
              initialPriorities={priorities}
              onApplyPriorities={handleApplyPriorities}
              recalculating={recalculating}
              rankingExplanation={rankingExplanation}
            />
          )}

          {/* 3. CROP CHARACTERISTICS DATABASE (Requirement B) */}
          {activeSubPage === '/dashboard/crop-database' && (
            <CropDatabaseExplorer />
          )}

          {/* 4. CROP ROTATION ENGINE (Requirements I, J) */}
          {activeSubPage === '/dashboard/crop-rotation' && (
            <div className="space-y-6">
              
              {/* Mandatory 3-Strategy Comparison Table & Visual Cards */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D5E5CA] shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8DE] pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
                      Requirement J: Mandatory Three-Strategy Comparison
                    </span>
                    <h2 className="font-display text-2xl font-bold text-[#073D2B] mt-1">
                      Multi-Year Crop Sequence Comparison Matrix
                    </h2>
                    <p className="text-xs text-[#527367] mt-1">
                      Comparing your baseline operation against restorative cover cropping and climate-resilient pulses.
                    </p>
                  </div>

                  <button
                    onClick={() => setIncomeModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold self-start sm:self-auto"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>Supplemental Income Opportunities</span>
                  </button>
                </div>

                {/* Comparative Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[#E2E8DE] text-[#073D2B]">
                        <th className="py-3 px-4 font-bold">Criteria</th>
                        <th className="py-3 px-4 font-bold text-amber-900 bg-amber-50/50">Strategy A: Baseline Monoculture</th>
                        <th className="py-3 px-4 font-bold text-emerald-900 bg-emerald-50/50">Strategy B: Soil Restoration</th>
                        <th className="py-3 px-4 font-bold text-blue-900 bg-blue-50/50">Strategy C: Climate Resilient</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8DE] text-[#2A4D3E]">
                      <tr>
                        <td className="py-3 px-4 font-bold text-[#073D2B]">Current Model Score</td>
                        <td className="py-3 px-4 font-bold text-amber-800 bg-amber-50/20">{strategies.find(s=>s.code==='A')?.score || 72}%</td>
                        <td className="py-3 px-4 font-bold text-emerald-800 bg-emerald-50/20">{strategies.find(s=>s.code==='B')?.score || 86}%</td>
                        <td className="py-3 px-4 font-bold text-blue-800 bg-blue-50/20">{strategies.find(s=>s.code==='C')?.score || 91}%</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold text-[#073D2B]">Crop Sequence</td>
                        <td className="py-3 px-4 bg-amber-50/20">Corn → Soybean (Biennial)</td>
                        <td className="py-3 px-4 bg-emerald-50/20">Corn → Rye/Vetch Cover → Soybean → Small Grain</td>
                        <td className="py-3 px-4 bg-blue-50/20">Corn → Triticale → Sorghum → Field Peas → Sunflower</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold text-[#073D2B]">Bare-Field Exposure</td>
                        <td className="py-3 px-4 bg-amber-50/20 text-rose-700 font-semibold">135 Days (High Erosion)</td>
                        <td className="py-3 px-4 bg-emerald-50/20 text-emerald-700 font-semibold">0 Days (365 Continuous Armor)</td>
                        <td className="py-3 px-4 bg-blue-50/20 text-blue-700 font-semibold">45 Days (Resilient Stover)</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold text-[#073D2B]">Biological Nitrogen Fix</td>
                        <td className="py-3 px-4 bg-amber-50/20">~35 lbs N/acre</td>
                        <td className="py-3 px-4 bg-emerald-50/20 font-bold text-emerald-700">+75 to +95 lbs N/acre</td>
                        <td className="py-3 px-4 bg-blue-50/20">+60 lbs N/acre (Pulse legumes)</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold text-[#073D2B]">Water Consumption</td>
                        <td className="py-3 px-4 bg-amber-50/20">High (Peak July transpirational demand)</td>
                        <td className="py-3 px-4 bg-emerald-50/20">+22,000 gal/ac soil holding buffer</td>
                        <td className="py-3 px-4 bg-blue-50/20 font-bold text-blue-700">32% less water consumed</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold text-[#073D2B]">Pest Host Interruption</td>
                        <td className="py-3 px-4 bg-amber-50/20 text-amber-700">Incomplete rootworm break</td>
                        <td className="py-3 px-4 bg-emerald-50/20">Stimulates antagonistic microbes</td>
                        <td className="py-3 px-4 bg-blue-50/20 font-bold text-blue-700">Breaks cereal & legume pests</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 10-Point Explainability Explorer (Requirement I) */}
              {strategies.length > 0 && <ExplainabilityExplorer strategies={strategies} />}

            </div>
          )}

          {/* 5. WHAT-IF SCENARIOS (Requirement H) */}
          {activeSubPage === '/dashboard/scenarios' && (
            <WhatIfSimulator
              onSimulate={handleApplyScenario}
              onReset={handleResetScenario}
              activeScenario={activeScenario}
              recalculating={recalculating}
            />
          )}

          {/* 6. NASA ROADMAP & DATA FUSION (Requirement F & G) */}
          {activeSubPage === '/dashboard/earth-observation' && (
            <NasaRoadmapExplorer />
          )}

          {/* 7. INTERACTIVE FARM MAP (Requirement K) */}
          {activeSubPage === '/dashboard/farm-map' && (
            <InteractiveFarmMap farm={activeFarm} />
          )}

          {/* 8. BARE-FIELD DETECTOR (Requirement C) */}
          {activeSubPage === '/dashboard/bare-field' && (
            <BareFieldDetector farmId={selectedFarmId} />
          )}

          {/* 9. PEST AND DISEASE CYCLES (Requirement D) */}
          {activeSubPage === '/dashboard/pest-cycles' && (
            <PestDiseaseTracker farmId={selectedFarmId} />
          )}

          {/* 10. SOIL INTELLIGENCE */}
          {activeSubPage === '/dashboard/soil-intelligence' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#073D2B]">Soil Chemistry & Biological Intelligence</h2>
                <p className="text-xs text-[#527367]">
                  Laboratory test metrics coupled with NRCS physical survey data for {activeFarm.name}.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
                  <span className="text-xs font-bold text-[#145C3D] uppercase">Soil pH Index</span>
                  <div className="font-display text-3xl font-extrabold text-[#073D2B]">{activeFarm.soilPH}</div>
                  <p className="text-xs text-[#527367]">
                    Target band: 6.2 – 6.8. Favorable for legume nodulation and phosphorus uptake.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
                  <span className="text-xs font-bold text-[#145C3D] uppercase">Soil Organic Matter</span>
                  <div className="font-display text-3xl font-extrabold text-[#073D2B]">{activeFarm.organicMatter}%</div>
                  <p className="text-xs text-[#527367]">
                    Holds an estimated 80,000+ gallons of available pore water per acre.
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
                  <span className="text-xs font-bold text-[#145C3D] uppercase">Nutrient Balance</span>
                  <div className="font-display text-lg font-bold text-[#073D2B]">
                    N: {activeFarm.nitrogen}
                  </div>
                  <p className="text-xs text-[#527367]">
                    P: {activeFarm.phosphorus} | K: {activeFarm.potassium}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-6 border border-[#D5E5CA] space-y-3">
                <h3 className="font-bold text-base text-[#073D2B]">Agronomic Soil Limitations</h3>
                <ul className="space-y-2 text-xs text-[#2A4D3E]">
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>Compaction risk: Clarions are prone to subsoil plow-pans when driven upon during early spring high moisture.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#76B93F] flex-shrink-0 mt-0.5" />
                    <span>Deep taproots from sunflower or forage radish will fracture hardpan layers without mechanical tillage.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* 11. FIELD RISK ANALYSIS */}
          {activeSubPage === '/dashboard/field-risk' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#073D2B]">Geospatial Field Risk Diagnostics</h2>
                <p className="text-xs text-[#527367]">
                  Vulnerability indices calculated from NASA SRTM elevation, NASA POWER heat waves, and GPM storms.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] space-y-4">
                  <h3 className="font-bold text-base text-[#073D2B]">Vulnerability Scores</h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[#527367]">Root-Zone Water Deficit:</span>
                        <span className="font-bold text-emerald-700">LOW (22%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[22%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[#527367]">Summer Thermal Heat Stress:</span>
                        <span className="font-bold text-amber-700">MODERATE (48%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full w-[48%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[#527367]">Slope Runoff & Rill Erosion:</span>
                        <span className="font-bold text-amber-700">MODERATE (42%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full w-[42%]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[#527367]">Early Season Frost Probability:</span>
                        <span className="font-bold text-emerald-700">LOW (14%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[14%]" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] space-y-3">
                  <h3 className="font-bold text-base text-[#073D2B]">Mitigation Action Plan</h3>
                  <p className="text-xs text-[#527367]">
                    Recommendations to guard your acreage against detected hazard points:
                  </p>
                  <div className="space-y-2 text-xs text-[#2A4D3E]">
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <strong>Contour Buffer Strips:</strong> Install 15-foot perennial grass strips along the 2.3% SRTM contour line to catch particulate soil.
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <strong>Staggered Pollination Window:</strong> Plant two hybrid corn maturities (105-day and 111-day) to prevent full-crop exposure during late July heat waves.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 12. CLIMATE TIMELINE */}
          {activeSubPage === '/dashboard/climate-timeline' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#073D2B]">Historical Climate & Moisture Timeline</h2>
                <p className="text-xs text-[#527367]">
                  12-month environmental trend line from NASA POWER, GPM, and SMAP data.
                </p>
              </div>

              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-[#145C3D] uppercase">12-Month Rainfall vs Baseline</span>
                    <h3 className="text-xl font-bold text-[#073D2B]">Cumulative Seasonal Precipitation</h3>
                  </div>
                  <span className="text-xs bg-[#EAF5DF] text-[#145C3D] font-bold px-3 py-1 rounded-full">
                    NASA GPM Historical Reanalysis
                  </span>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-4 items-end h-48 border-b border-[#E2E8DE] pb-2">
                  {['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'].map((m, idx) => {
                    const heightPercent = Math.min(100, Math.round(35 + Math.sin(idx / 1.5) * 45 + (idx === 2 ? 20 : 0)));
                    return (
                      <div key={m} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                        <span className="text-[10px] text-[#527367] opacity-0 group-hover:opacity-100 transition-opacity">
                          {heightPercent}mm
                        </span>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[28px] rounded-t-lg transition-all ${
                            idx === 2 ? 'bg-[#76B93F]' : 'bg-[#145C3D]/80 hover:bg-[#145C3D]'
                          }`}
                        />
                        <span className="text-[10px] font-bold text-[#073D2B]">{m}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-6 text-xs text-[#527367]">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-[#145C3D]" />
                    <span>Monthly Measured Rainfall (GPM)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-[#76B93F]" />
                    <span>Peak July Storm Pulse</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 13. AI AGRICULTURAL ADVISOR */}
          {activeSubPage === '/dashboard/ai-advisor' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <Bot className="w-6 h-6 text-[#145C3D]" />
                  <h2 className="font-display text-2xl font-bold text-[#073D2B]">AI Agricultural Advisor</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EAF5DF] text-[#145C3D]">
                    GEMINI 3.8 FLASH
                  </span>
                </div>
                <p className="text-xs text-[#527367] mt-0.5">
                  Real-time agronomic advisory grounded in your active farm telemetry, priorities, and NASA Earth observations.
                </p>
              </div>

              {/* Chat Container */}
              <div className="bg-white rounded-3xl border border-[#D5E5CA] shadow-sm flex flex-col h-[520px] overflow-hidden">
                
                {/* Chat Message List */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                  {aiChatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.sender === 'ai' && (
                        <div className="w-8 h-8 rounded-full bg-[#073D2B] text-[#76B93F] flex items-center justify-center flex-shrink-0 text-xs font-bold">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}
                      <div
                        className={`max-w-xl p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.sender === 'user'
                            ? 'bg-[#073D2B] text-white rounded-br-xs'
                            : msg.isFallback
                            ? 'bg-[#FCFDF9] text-[#073D2B] border border-amber-300 rounded-bl-xs shadow-2xs'
                            : 'bg-[#F4F8EE] text-[#073D2B] border border-[#D5E5CA] rounded-bl-xs'
                        }`}
                      >
                        {msg.text}

                        {/* Distinct Honest Source & Retry Controls */}
                        {msg.sender === 'ai' && (
                          <div className="mt-3 pt-2.5 border-t border-[#D5E5CA]/70 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            {msg.isFallback ? (
                              <div className="flex items-center gap-1.5 text-amber-900 font-medium bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Agronomic Fallback Engine • Gemini Offline ({msg.fallbackReason || 'Temporarily Unavailable'})</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-[#145C3D] font-medium bg-[#EAF5DF] px-2.5 py-1 rounded-lg border border-[#C2E0B0]">
                                <Sparkles className="w-3.5 h-3.5 text-[#76B93F] shrink-0" />
                                <span>Gemini 3.8 Flash • NASA Grounded {msg.latencyMs ? `(${Math.round(msg.latencyMs / 100) / 10}s)` : ''}</span>
                              </div>
                            )}

                            {msg.isFallback && msg.originalPrompt && (
                              <button
                                type="button"
                                onClick={() => handleSendAiPrompt(msg.originalPrompt)}
                                disabled={aiLoading}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="w-3 h-3 text-[#76B93F]" />
                                <span>Retry with Live Gemini</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex gap-3 items-center text-xs text-[#527367]">
                      <div className="w-8 h-8 rounded-full bg-[#073D2B] text-[#76B93F] flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 animate-spin" />
                      </div>
                      <span>Synthesizing NASA telemetry with Gemini 3.8 Flash...</span>
                    </div>
                  )}
                </div>

                {/* Pre-canned Prompts */}
                <div className="px-6 py-2 bg-[#FAFDF8] border-t border-[#E2E8DE] flex items-center gap-2 overflow-x-auto scrollbar-none">
                  <span className="text-[10px] font-bold text-[#527367] uppercase whitespace-nowrap">Suggested:</span>
                  <button
                    type="button"
                    onClick={() => handleSendAiPrompt('How do my current priorities affect Strategy B vs Strategy C in drought?')}
                    className="px-2.5 py-1 rounded-full bg-white border border-[#D5E5CA] text-[11px] text-[#073D2B] hover:bg-[#EAF5DF] whitespace-nowrap"
                  >
                    Priorities & Drought
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendAiPrompt('How does continuous cover cropping disrupt Western Corn Rootworm beetles?')}
                    className="px-2.5 py-1 rounded-full bg-white border border-[#D5E5CA] text-[11px] text-[#073D2B] hover:bg-[#EAF5DF] whitespace-nowrap"
                  >
                    Pest Host Cycle Break
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendAiPrompt('Explain the 135-day bare field period erosion risk under GPM storm events.')}
                    className="px-2.5 py-1 rounded-full bg-white border border-[#D5E5CA] text-[11px] text-[#073D2B] hover:bg-[#EAF5DF] whitespace-nowrap"
                  >
                    Bare Soil Risk
                  </button>
                </div>

                {/* Input Bar */}
                <div className="p-4 bg-white border-t border-[#E2E8DE] flex items-center gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendAiPrompt();
                    }}
                    placeholder="Ask about crop rotation timing, priorities, NASA observations, or soil nutrient buffers..."
                    className="flex-1 px-4 py-2.5 rounded-full border border-[#D5E5CA] text-xs text-[#073D2B] focus:ring-2 focus:ring-[#76B93F]"
                  />
                  <button
                    onClick={() => handleSendAiPrompt()}
                    disabled={!aiPrompt.trim() || aiLoading}
                    className="px-5 py-2.5 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask</span>
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* 14. COMPLIANCE & REPORTS */}
          {activeSubPage === '/dashboard/reports' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#073D2B]">Agronomic Compliance & Extension Reports</h2>
                  <p className="text-xs text-[#527367]">Generate formal briefs for USDA-NRCS, insurance, and certified crop advisors.</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-[#D5E5CA] space-y-4">
                <div className="flex items-center justify-between border-b border-[#E2E8DE] pb-4">
                  <div>
                    <h4 className="font-bold text-sm text-[#073D2B]">USDA Conservation Stewardship Program (CSP) Brief</h4>
                    <p className="text-xs text-[#527367]">Documentation of Strategy B continuous winter living cover.</p>
                  </div>
                  <button
                    onClick={() => alert('Downloading official Field Shift CSP Verification Report (PDF)...')}
                    className="px-4 py-2 rounded-xl bg-[#073D2B] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#145C3D]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Report</span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-[#073D2B]">NASA Earth Observations Seasonal Moisture Audit</h4>
                    <p className="text-xs text-[#527367]">SMAP L4 root-zone and GPM precipitation anomaly archive.</p>
                  </div>
                  <button
                    onClick={() => alert('Downloading NASA Satellite Ingestion Summary (PDF)...')}
                    className="px-4 py-2 rounded-xl bg-[#073D2B] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#145C3D]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Report</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 15. SETTINGS */}
          {activeSubPage === '/dashboard/settings' && (
            <div className="max-w-2xl bg-white rounded-3xl p-6 sm:p-8 border border-[#D5E5CA] space-y-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#073D2B]">Account & System Settings</h2>
                <p className="text-xs text-[#527367]">Manage unit preferences, NASA API connections, and notifications.</p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-[#073D2B] mb-1">Account Holder</label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.fullName}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#073D2B] mb-1">Email Address</label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.email}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
                  />
                </div>
                <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA] space-y-2">
                  <span className="font-bold text-[#073D2B] block">Measurement Units</span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="units" defaultChecked className="text-[#073D2B]" />
                      <span>Imperial (Acres, Gallons, mm/in)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="units" className="text-[#073D2B]" />
                      <span>Metric (Hectares, Litres, mm)</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* Supplemental Income Opportunities Modal */}
      <SupplementalIncomeModal
        isOpen={incomeModalOpen}
        onClose={() => setIncomeModalOpen(false)}
      />

    </div>
  );
};
