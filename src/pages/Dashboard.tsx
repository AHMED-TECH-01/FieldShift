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
  Menu,
  X,
  Pencil,
  Trash2,
  CloudDownload,
  BookmarkCheck,
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
import { apiClient } from '../services/apiClient';

interface DashboardProps {
  currentUser: User;
  activeSubPage: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onUserUpdated?: (user: User) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  activeSubPage,
  onNavigate,
  onLogout,
  onUserUpdated,
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

  // Non-blocking status banners
  const [farmCreateStatus, setFarmCreateStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  // Mobile Dashboard Drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Lock body & root scroll when mobile navigation drawer is open
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

  // New Farm form state
  const [newFarmName, setNewFarmName] = useState('');
  const [newFarmLocation, setNewFarmLocation] = useState('');
  const [newFarmLat, setNewFarmLat] = useState('');
  const [newFarmLon, setNewFarmLon] = useState('');
  const [newFarmAcreage, setNewFarmAcreage] = useState('320');
  const [newFarmCrop, setNewFarmCrop] = useState('Corn (Maize)');
  const [newFarmSoilType, setNewFarmSoilType] = useState('Silt Loam');
  const [newFarmPH, setNewFarmPH] = useState('6.5');
  const [newFarmOM, setNewFarmOM] = useState('3.4');

  // Edit / Delete Farm state
  const [editingFarmId, setEditingFarmId] = useState<string | null>(null);
  const [editFarmName, setEditFarmName] = useState('');
  const [editFarmLocation, setEditFarmLocation] = useState('');
  const [editFarmAcreage, setEditFarmAcreage] = useState('');
  const [editFarmCrop, setEditFarmCrop] = useState('');
  const [editFarmPH, setEditFarmPH] = useState('');
  const [editFarmOM, setEditFarmOM] = useState('');
  const [savingEditFarm, setSavingEditFarm] = useState(false);
  const [confirmDeleteFarmId, setConfirmDeleteFarmId] = useState<string | null>(null);

  // Real NASA Telemetry, Climate, Soil, Risk & Rotation Assessments state
  const [nasaTelemetry, setNasaTelemetry] = useState<any>(null);
  const [nasaLoading, setNasaLoading] = useState<boolean>(false);
  const [nasaError, setNasaError] = useState<string | null>(null);
  const [syncingPower, setSyncingPower] = useState<boolean>(false);
  const [syncingCmr, setSyncingCmr] = useState<boolean>(false);
  const [syncingAll, setSyncingAll] = useState<boolean>(false);
  const [syncBanner, setSyncBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [climateTimeline, setClimateTimeline] = useState<any[]>([]);
  const [climateProvenance, setClimateProvenance] = useState<string>('');
  const [soilProfileData, setSoilProfileData] = useState<any>(null);
  const [fieldRiskIndicators, setFieldRiskIndicators] = useState<any[]>([]);
  const [fieldRiskNotice, setFieldRiskNotice] = useState<string>('');
  const [savedRotations, setSavedRotations] = useState<any[]>([]);
  const [savingRotation, setSavingRotation] = useState<boolean>(false);
  const [rotationSaveFeedback, setRotationSaveFeedback] = useState<string | null>(null);

  // Settings / Profile state
  const [profileFullName, setProfileFullName] = useState<string>(currentUser.fullName || '');
  const [measurementUnits, setMeasurementUnits] = useState<'imperial' | 'metric'>('imperial');
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // AI Advisor state
  const buildWelcomeMessage = (farmName?: string) => ({
    sender: 'ai' as const,
    text: `Hello ${currentUser.fullName || 'Farmer'}! I am your FieldShift Agronomic Advisor powered by Google Gemini.\nResponses for ${farmName || 'your active farm'} are grounded in your persisted farm soil profile, farmer priorities, and synced NASA POWER / Earthdata CMR observations.\n\nHow can I help evaluate your crop rotation strategies or climate risks today?`,
    source: 'gemini-4-hydrogen',
    isFallback: false,
  });

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
  >([buildWelcomeMessage()]);
  const [aiLoading, setAiLoading] = useState(false);

  // Load farms & user profile on mount
  useEffect(() => {
    fetchFarms();
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const res = await apiClient.get('/api/profile');
      if (res?.profile) {
        setProfileFullName(res.profile.fullName || currentUser.fullName || '');
        if (res.profile.measurementUnits === 'metric' || res.profile.measurementUnits === 'imperial') {
          setMeasurementUnits(res.profile.measurementUnits);
        }
      }
    } catch {
      // Keep optimistic defaults from currentUser
    }
  };

  const fetchNasaAndFarmAnalytics = async (farmId: string) => {
    setNasaLoading(true);
    setNasaError(null);
    try {
      const [obsRes, climateRes, soilRes, riskRes, rotRes, aiHistRes] = await Promise.allSettled([
        apiClient.get('/api/nasa/observations', { params: { farmId } }),
        apiClient.get('/api/climate/timeline', { params: { farmId } }),
        apiClient.get('/api/soil/profiles', { params: { farmId } }),
        apiClient.get('/api/risk/field-analysis', { params: { farmId } }),
        apiClient.get('/api/rotations', { params: { farmId } }),
        apiClient.get('/api/ai/history', { params: { farmId } }),
      ]);

      if (obsRes.status === 'fulfilled') {
        setNasaTelemetry(obsRes.value);
      } else {
        setNasaError('Unable to load NASA observation summary for this parcel.');
      }

      if (climateRes.status === 'fulfilled') {
        setClimateTimeline(Array.isArray(climateRes.value.timeline) ? climateRes.value.timeline : []);
        setClimateProvenance(climateRes.value.provenance || '');
      }

      if (soilRes.status === 'fulfilled') {
        setSoilProfileData(soilRes.value);
      }

      if (riskRes.status === 'fulfilled') {
        setFieldRiskIndicators(Array.isArray(riskRes.value.indicators) ? riskRes.value.indicators : []);
        setFieldRiskNotice(riskRes.value.scientificNotice || '');
      }

      if (rotRes.status === 'fulfilled') {
        setSavedRotations(Array.isArray(rotRes.value.rotations) ? rotRes.value.rotations : []);
      }

      if (aiHistRes.status === 'fulfilled' && Array.isArray(aiHistRes.value.history)) {
        const persisted = [...aiHistRes.value.history].reverse();
        const turns: typeof aiChatHistory = [buildWelcomeMessage()];
        for (const item of persisted) {
          if (item.prompt) turns.push({ sender: 'user', text: item.prompt });
          if (item.reply) {
            turns.push({
              sender: 'ai',
              text: item.reply,
              source: item.model_source || 'gemini-4-hydrogen',
              isFallback: Boolean(item.is_fallback),
              fallbackReason: item.fallback_reason || undefined,
              latencyMs: item.latency_ms || undefined,
              originalPrompt: item.prompt,
            });
          }
        }
        setAiChatHistory(turns);
      }
    } finally {
      setNasaLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const syncFarmPrioritiesAndStrategies = async () => {
      let effectivePriorities = priorities;
      try {
        const res = await apiClient.get('/api/priorities', { params: { farmId: selectedFarmId } });
        if (active && res?.priorities) {
          effectivePriorities = res.priorities;
          setPriorities(res.priorities);
        }
      } catch {
        // Keep current priorities if endpoint unavailable
      }
      if (active) {
        recalculateStrategies(effectivePriorities, activeScenario);
        fetchNasaAndFarmAnalytics(selectedFarmId);
      }
    };
    syncFarmPrioritiesAndStrategies();
    return () => {
      active = false;
    };
  }, [selectedFarmId]);

  const fetchFarms = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get('/api/farms');
      if (data.farms && data.farms.length > 0) {
        setFarms(data.farms);
        setSelectedFarmId((prev) =>
          data.farms.some((f: Farm) => f.id === prev) ? prev : data.farms[0].id
        );
      }
    } catch (e) {
      console.error('Failed to load farms', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNasaPower = async () => {
    setSyncingPower(true);
    setSyncBanner(null);
    try {
      const res = await apiClient.post('/api/datasets/nasa-power/sync', {
        farmId: selectedFarmId,
        days: 30,
      });
      setSyncBanner({
        type: 'success',
        message: `Synced ${res.recordsSaved || 0} live NASA POWER records (${res.startDate} to ${res.endDate}).`,
      });
      await fetchNasaAndFarmAnalytics(selectedFarmId);
      await recalculateStrategies(priorities, activeScenario);
    } catch (err: any) {
      setSyncBanner({
        type: 'error',
        message: err?.message || 'Failed to sync NASA POWER agroclimatology.',
      });
    } finally {
      setSyncingPower(false);
    }
  };

  const handleDiscoverCmrGranules = async () => {
    setSyncingCmr(true);
    setSyncBanner(null);
    try {
      const targets: Array<'smap' | 'gpm' | 'modis' | 'ecostress'> = ['smap', 'gpm', 'modis', 'ecostress'];
      const results = await Promise.allSettled(
        targets.map((ds) => apiClient.post(`/api/datasets/${ds}/sync`, { farmId: selectedFarmId }))
      );
      const totalGranules = results.reduce((sum, r) => {
        if (r.status === 'fulfilled') {
          return sum + (r.value.granulesFound ?? r.value.recordsSaved ?? 0);
        }
        return sum;
      }, 0);
      setSyncBanner({
        type: 'success',
        message: `Synced MODIS 250m numeric pixels and indexed ${totalGranules} NASA Earthdata CMR granules across SMAP, GPM, MODIS & ECOSTRESS.`,
      });
      await fetchNasaAndFarmAnalytics(selectedFarmId);
      await recalculateStrategies(priorities, activeScenario);
    } catch (err: any) {
      setSyncBanner({
        type: 'error',
        message: err?.message || 'Failed to query NASA Earthdata CMR granules.',
      });
    } finally {
      setSyncingCmr(false);
    }
  };

  const handleIngestAllNasa = async () => {
    setSyncingAll(true);
    setSyncBanner(null);
    try {
      const res = await apiClient.post(`/api/nasa/ingest/${selectedFarmId}`, { days: 30 });
      const outcomes = res?.outcomes || {};
      const powerSaved = outcomes['nasa-power']?.recordsSaved || 0;
      const modisPixels = outcomes.modis?.numericPixelCount || 0;
      const cmrTotal = ['smap', 'gpm', 'modis', 'ecostress'].reduce(
        (sum, k) => sum + Number(outcomes[k]?.granulesFound || 0),
        0
      );
      setSyncBanner({
        type: 'success',
        message: `Ingested ${powerSaved} NASA POWER rows, ${modisPixels} MODIS 250m/1km pixel records, and ${cmrTotal} Earthdata CMR granule metadata entries.`,
      });
      await fetchNasaAndFarmAnalytics(selectedFarmId);
      await recalculateStrategies(priorities, activeScenario);
    } catch (err: any) {
      setSyncBanner({
        type: 'error',
        message: err?.message || 'Failed to ingest NASA Earth observation feeds.',
      });
    } finally {
      setSyncingAll(false);
    }
  };

  const recalculateStrategies = async (prio: FarmerPriorities, scen?: WhatIfScenario | null) => {
    setRecalculating(true);
    try {
      const data = await apiClient.post('/api/rotations/recalculate', {
        farmId: selectedFarmId,
        priorities: prio,
        scenario: scen || null,
      });
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

  const handleSaveRotationAssessment = async () => {
    setSavingRotation(true);
    setRotationSaveFeedback(null);
    try {
      const label = activeScenario
        ? `${activeFarm.name} (What-If Scenario)`
        : `${activeFarm.name} Baseline Assessment`;
      await apiClient.post('/api/rotations', {
        farmId: selectedFarmId,
        name: label,
        priorities,
        scenario: activeScenario || null,
      });
      setRotationSaveFeedback('Rotation strategy assessment saved to PostgreSQL.');
      const rotRes = await apiClient.get('/api/rotations', { params: { farmId: selectedFarmId } });
      if (Array.isArray(rotRes?.rotations)) {
        setSavedRotations(rotRes.rotations);
      }
    } catch (err: any) {
      setRotationSaveFeedback(err?.message || 'Could not save assessment right now.');
    } finally {
      setSavingRotation(false);
    }
  };

  const handleApplyPriorities = (newPrio: FarmerPriorities) => {
    setPriorities(newPrio);
    apiClient.put('/api/priorities', { farmId: selectedFarmId, priorities: newPrio }).catch((err) => {
      console.warn('Could not persist priorities:', err);
    });
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
    if (!newFarmName.trim() || !newFarmLocation.trim()) {
      setFarmCreateStatus({ type: 'error', message: 'Please enter both a farm property name and location.' });
      return;
    }

    const latParsed = newFarmLat.trim() ? Number(newFarmLat) : 42.03;
    const lonParsed = newFarmLon.trim() ? Number(newFarmLon) : -93.62;
    if (!Number.isFinite(latParsed) || latParsed < -90 || latParsed > 90 || !Number.isFinite(lonParsed) || lonParsed < -180 || lonParsed > 180) {
      setFarmCreateStatus({ type: 'error', message: 'Coordinates must be valid Latitude (-90..90) and Longitude (-180..180).' });
      return;
    }

    try {
      const data = await apiClient.post('/api/farms', {
        name: newFarmName.trim(),
        location: newFarmLocation.trim(),
        coordinates: [lonParsed, latParsed],
        acreage: Number(newFarmAcreage) || 320,
        currentCrop: newFarmCrop,
        soilType: newFarmSoilType,
        soilPH: Number(newFarmPH) || 6.5,
        organicMatter: Number(newFarmOM) || 3.4,
      });
      if (data.success && data.farm) {
        setFarms((prev) => [data.farm, ...prev]);
        setSelectedFarmId(data.farm.id);
        setNewFarmName('');
        setNewFarmLocation('');
        setNewFarmLat('');
        setNewFarmLon('');
        setFarmCreateStatus({
          type: 'success',
          message: `${data.farm.name} has been registered in Supabase PostgreSQL and set as your active farm.`,
        });
        onNavigate('/dashboard/farms');
      }
    } catch (e: any) {
      console.error('Failed to create farm', e);
      setFarmCreateStatus({ type: 'error', message: e?.message || 'Could not save farm property right now. Please try again.' });
    }
  };

  const startEditFarm = (farm: Farm) => {
    setEditingFarmId(farm.id);
    setEditFarmName(farm.name);
    setEditFarmLocation(farm.location);
    setEditFarmAcreage(String(farm.acreage));
    setEditFarmCrop(farm.currentCrop);
    setEditFarmPH(String(farm.soilPH));
    setEditFarmOM(String(farm.organicMatter));
  };

  const handleSaveEditFarm = async (farmId: string) => {
    setSavingEditFarm(true);
    setFarmCreateStatus(null);
    try {
      const res = await apiClient.patch(`/api/farms/${farmId}`, {
        name: editFarmName.trim(),
        location: editFarmLocation.trim(),
        acreage: Number(editFarmAcreage) || 100,
        currentCrop: editFarmCrop.trim(),
        soilPH: Number(editFarmPH) || 6.5,
        organicMatter: Number(editFarmOM) || 3.0,
      });
      if (res?.farm) {
        setFarms((prev) => prev.map((f) => (f.id === farmId ? res.farm : f)));
        setEditingFarmId(null);
        setFarmCreateStatus({ type: 'success', message: `Updated ${res.farm.name}.` });
      }
    } catch (err: any) {
      setFarmCreateStatus({ type: 'error', message: err?.message || 'Failed to update farm property.' });
    } finally {
      setSavingEditFarm(false);
    }
  };

  const handleDeleteFarm = async (farmId: string) => {
    setFarmCreateStatus(null);
    try {
      await apiClient.delete(`/api/farms/${farmId}`);
      const remaining = farms.filter((f) => f.id !== farmId);
      setFarms(remaining);
      setConfirmDeleteFarmId(null);
      if (selectedFarmId === farmId && remaining.length > 0) {
        setSelectedFarmId(remaining[0].id);
      }
      setFarmCreateStatus({ type: 'success', message: 'Farm property removed.' });
    } catch (err: any) {
      setFarmCreateStatus({ type: 'error', message: err?.message || 'Unable to delete farm property.' });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileFeedback(null);
    try {
      const res = await apiClient.patch('/api/profile', {
        fullName: profileFullName.trim(),
        measurementUnits,
      });
      if (res?.profile) {
        setProfileFeedback({ type: 'success', message: 'Profile and measurement preferences saved.' });
        onUserUpdated?.({
          email: currentUser.email,
          fullName: res.profile.fullName || profileFullName.trim(),
          verified: currentUser.verified,
        });
      }
    } catch (err: any) {
      setProfileFeedback({ type: 'error', message: err?.message || 'Failed to save profile settings.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleExportReport = (reportType: 'csp' | 'nasa') => {
    const isCsp = reportType === 'csp';
    const fileName = isCsp
      ? `fieldshift-csp-brief-${activeFarm.id}.json`
      : `fieldshift-nasa-moisture-audit-${activeFarm.id}.json`;
    const payload = {
      report: isCsp
        ? 'USDA Conservation Stewardship Program (CSP) Living Cover Brief'
        : 'NASA Earth Observations Agroclimatology & Granule Audit',
      generatedAt: new Date().toISOString(),
      farm: {
        name: activeFarm.name,
        location: activeFarm.location,
        coordinates: activeFarm.coordinates,
        acreage: activeFarm.acreage,
        soilType: activeFarm.soilType,
        soilPH: activeFarm.soilPH,
        organicMatter: activeFarm.organicMatter,
      },
      strategies: strategies.map((s) => ({
        code: s.code,
        title: s.title,
        score: s.score,
        cropSequence: s.cropSequence,
      })),
      nasaTelemetry: nasaTelemetry?.realTimeMetrics || {
        status: 'not_synced',
        notice: 'No persisted NASA observations synced yet for this parcel.',
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setReportFeedback(
      isCsp
        ? `Exported USDA CSP Brief for ${activeFarm.name} (${fileName}).`
        : `Exported NASA Telemetry Audit for ${activeFarm.name} (${fileName}).`
    );
  };

  const handleSendAiPrompt = async (promptToSend?: string) => {
    const text = (promptToSend || aiPrompt).trim();
    if (!text || aiLoading) return;

    const newHistory = [...aiChatHistory, { sender: 'user' as const, text }];
    setAiChatHistory(newHistory);
    setAiPrompt('');
    setAiLoading(true);

    try {
      const data = await apiClient.post('/api/ai/advisor', {
        prompt: text,
        farmId: selectedFarmId,
        priorities,
        scenario: activeScenario,
      });
      setAiChatHistory([
        ...newHistory,
        {
          sender: 'ai',
          text: data.reply || 'Agronomic assessment completed.',
          source: data.source || 'gemini-4-hydrogen',
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
          text: e?.message || 'Unable to reach the agricultural advisor server. Please check network connectivity.',
          isFallback: true,
          fallbackReason: e?.status === 401 ? 'Session expired — please sign in again' : 'Request failed',
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
      
      {/* ================= MOBILE TOP APP BAR (< md) ================= */}
      <div className="md:hidden bg-[#073D2B] text-white px-3 py-2.5 pt-safe flex items-center justify-between gap-2 border-b border-[#145C3D] sticky top-0 z-40">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="flex items-center gap-2 min-w-0 min-h-[44px] cursor-pointer text-left"
        >
          <div className="w-8 h-8 rounded-full bg-white p-0.5 overflow-hidden flex-shrink-0">
            <img
              src="/assets/aistudio/Eco-Tech_Globe_Branding_Logo__1__5456db76.png"
              alt="Field Shift Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <span className="font-display text-base font-bold tracking-tight block leading-tight">
              Field<span className="text-[#76B93F]">Shift</span>
            </span>
            <span className="text-[10px] text-[#9BD85A] font-semibold block leading-none">Dashboard</span>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Active Farm Quick Badge */}
          <span className="hidden min-[360px]:inline-block px-2 py-1 rounded-lg text-[10px] font-bold bg-white/10 text-white/90 max-w-[100px] truncate">
            {activeFarm.name}
          </span>
          {/* Hamburger Drawer Toggle (44px touch target) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label={mobileMenuOpen ? 'Close dashboard menu' : 'Open dashboard menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-[#9BD85A]" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ================= MOBILE QUICK SCROLL PILLS (< md) ================= */}
      <div className="md:hidden bg-white/95 backdrop-blur-md border-b border-[#E2E8DE] px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none z-30 sticky top-[65px]">
        {[
          { id: '/dashboard', label: 'Overview' },
          { id: '/dashboard/farms', label: 'Farms' },
          { id: '/dashboard/crop-rotation', label: 'Rotations' },
          { id: '/dashboard/priorities', label: 'Priorities' },
          { id: '/dashboard/farm-map', label: 'Farm Map' },
          { id: '/dashboard/scenarios', label: 'What-If' },
          { id: '/dashboard/bare-field', label: 'Bare Soil' },
          { id: '/dashboard/pest-cycles', label: 'Pests' },
          { id: '/dashboard/ai-advisor', label: 'AI Advisor' },
        ].map((pill) => {
          const isActive = activeSubPage === pill.id;
          return (
            <button
              type="button"
              key={pill.id}
              onClick={() => onNavigate(pill.id)}
              className={`min-h-[40px] px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                isActive
                  ? 'bg-[#073D2B] text-white shadow-2xs font-bold'
                  : 'bg-[#F4F6EA] text-[#527367] hover:bg-[#EAF5DF] hover:text-[#073D2B]'
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* ================= MOBILE SLIDE-OVER DRAWER (< md) ================= */}
      <div
        className={`fixed inset-0 z-50 md:hidden flex transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        {/* Backdrop overlay */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />

        {/* Drawer content */}
        <div
          className={`relative w-[82vw] max-w-xs bg-[#073D2B] text-white h-dvh flex flex-col justify-between shadow-2xl z-10 transition-transform duration-300 ease-out ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white p-0.5 overflow-hidden flex-shrink-0">
                <img
                  src="/assets/aistudio/Eco-Tech_Globe_Branding_Logo__1__5456db76.png"
                  alt="Field Shift Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <span className="font-display text-base font-bold">
                  Field<span className="text-[#76B93F]">Shift</span>
                </span>
                <p className="text-[10px] text-[#9BD85A]">Navigation Drawer</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/10 text-white"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Farm Selector inside Drawer */}
          <div className="p-3.5 border-b border-white/10 flex-shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9BD85A] block mb-1.5">
              Active Farm Property
            </span>
            <select
              value={selectedFarmId}
              onChange={(e) => {
                setSelectedFarmId(e.target.value);
                setMobileMenuOpen(false);
              }}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white/10 text-white text-sm sm:text-xs font-semibold border border-white/20 focus:outline-hidden"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id} className="bg-[#073D2B] text-white">
                  {f.name} ({f.acreage} ac)
                </option>
              ))}
            </select>
          </div>

          {/* Navigation Links inside Drawer */}
          <nav className="flex-1 min-h-0 p-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSubPage === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#145C3D] text-[#9BD85A] font-bold shadow-xs'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#76B93F]' : 'text-white/70'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-[#76B93F] text-[#073D2B] font-bold flex-shrink-0">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Info & Logout inside Drawer */}
          <div className="p-3.5 border-t border-white/10 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#76B93F] text-[#073D2B] flex items-center justify-center font-bold text-xs flex-shrink-0">
                {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{currentUser.fullName || 'Farmer'}</p>
                <p className="text-[10px] text-white/60 truncate">{currentUser.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors flex-shrink-0"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= DESKTOP SIDEBAR (>= md only) ================= */}
      <aside className="hidden md:flex md:w-64 md:h-dvh md:sticky md:top-0 bg-[#073D2B] text-white flex-shrink-0 flex-col justify-between border-r border-[#145C3D]">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand */}
          <div
            onClick={() => onNavigate('/')}
            className="p-5 border-b border-white/10 flex items-center gap-3 cursor-pointer group flex-shrink-0"
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
          <div className="p-4 border-b border-white/10 flex-shrink-0">
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
          <nav className="flex-1 min-h-0 p-2.5 space-y-0.5 overflow-y-auto">
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
        <div className="p-4 border-t border-white/10 flex items-center justify-between flex-shrink-0">
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
      <main className="flex-1 flex flex-col min-w-0 md:h-dvh md:overflow-y-auto">
        
        {/* Top Header Bar */}
        <header className="bg-white border-b border-[#E2E8DE] px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:sticky md:top-0 z-20">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-semibold text-[#527367]">Current Operation:</span>
              <span className="text-sm font-bold text-[#073D2B] break-words">{activeFarm.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EAF5DF] text-[#145C3D] shrink-0">
                {activeFarm.acreage} Acres
              </span>
              {activeScenario && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
                  Scenario Simulated
                </span>
              )}
            </div>
            <p className="text-xs text-[#527367] mt-0.5 flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 text-[#76B93F] shrink-0" />
              <span className="truncate">{activeFarm.location} (Soil: {activeFarm.soilType})</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIncomeModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] md:min-h-0 px-3.5 py-2 rounded-full bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-all border border-emerald-200"
            >
              <DollarSign className="w-3.5 h-3.5 shrink-0" />
              <span>Income</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/priorities')}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] md:min-h-0 px-3.5 py-2 rounded-full bg-[#EAF5DF] text-[#145C3D] hover:bg-[#D8ECC8] text-xs font-bold transition-all"
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>Priorities</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/ai-advisor')}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] md:min-h-0 px-4 py-2 rounded-full bg-[#073D2B] text-white hover:bg-[#145C3D] text-xs font-bold transition-all shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#76B93F] shrink-0" />
              <span>AI Advisor</span>
            </button>
          </div>
        </header>

        {/* Dashboard Body Dynamic Switch */}
        <div className="p-3 sm:p-6 md:p-8 space-y-6">

          {/* 1. OVERVIEW PAGE */}
          {activeSubPage === '/dashboard' && (() => {
            const rt = nasaTelemetry?.realTimeMetrics;
            const power = rt?.solarInsolationPOWER;
            const smap = rt?.soilMoistureSMAP;
            const gpm = rt?.precipitationGPM;
            const modis = rt?.vegetationNDVI;
            const topStrategy = [...strategies].sort((a, b) => b.score - a.score)[0];

            return (
            <div className="space-y-6">
              
              {/* Live NASA Telemetry Sync Action Bar */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#D5E5CA] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#145C3D] flex items-center gap-1.5">
                      <Satellite className="w-3.5 h-3.5 text-[#76B93F]" />
                      Parcel Earth Observation Link &bull; {activeFarm.coordinates[1].toFixed(2)}°N, {activeFarm.coordinates[0].toFixed(2)}°
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-[#FAFDF8] border border-[#D5E5CA] text-[10px] font-semibold text-[#527367]">
                      {nasaTelemetry?.geometry?.spatialMethod === 'polygon_boundary'
                        ? 'GeoJSON Boundary'
                        : 'Point Centroid Approximation'}
                    </span>
                  </div>
                  <p className="text-xs text-[#527367] mt-0.5">
                    {power?.status === 'synced' || modis?.status === 'synced'
                      ? `${power?.status === 'synced' ? `POWER ${power.daysObserved}d synced` : 'POWER not synced'} • ${
                          modis?.status === 'synced' ? `MODIS 250m NDVI (${modis.observedAt})` : 'MODIS not synced'
                        }.`
                      : 'Ingest live NASA POWER agroclimatology, MODIS 250m vegetation indices, and Earthdata CMR granule metadata.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={syncingPower || syncingCmr || syncingAll}
                    onClick={handleIngestAllNasa}
                    className="min-h-[42px] px-4 py-2 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-xs"
                  >
                    <CloudDownload className={`w-3.5 h-3.5 text-[#76B93F] ${syncingAll ? 'animate-pulse' : ''}`} />
                    <span>{syncingAll ? 'Ingesting All...' : 'Ingest All NASA Data'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={syncingPower || syncingCmr || syncingAll}
                    onClick={handleSyncNasaPower}
                    className="min-h-[42px] px-3.5 py-2 rounded-full bg-[#EAF5DF] hover:bg-[#D8ECC8] text-[#145C3D] text-xs font-bold inline-flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingPower ? 'animate-spin' : ''}`} />
                    <span>{syncingPower ? 'Syncing POWER...' : 'Sync POWER'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={syncingPower || syncingCmr || syncingAll}
                    onClick={handleDiscoverCmrGranules}
                    className="min-h-[42px] px-3.5 py-2 rounded-full bg-white border border-[#D5E5CA] hover:bg-[#FAFDF8] text-[#073D2B] text-xs font-bold inline-flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <Satellite className={`w-3.5 h-3.5 text-sky-700 ${syncingCmr ? 'animate-spin' : ''}`} />
                    <span>{syncingCmr ? 'Querying MODIS/CMR...' : 'Sync MODIS & CMR'}</span>
                  </button>
                </div>
              </div>

              {syncBanner && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-medium flex items-center justify-between gap-2 border ${
                    syncBanner.type === 'success'
                      ? 'bg-[#EAF5DF] border-[#76B93F] text-[#073D2B]'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {syncBanner.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#145C3D] shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    {syncBanner.message}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSyncBanner(null)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5"
                    aria-label="Dismiss notice"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {nasaError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-3">
                  <span>{nasaError}</span>
                  <button
                    type="button"
                    onClick={() => fetchNasaAndFarmAnalytics(selectedFarmId)}
                    className="px-3 py-1.5 rounded-full bg-rose-700 text-white font-bold text-[11px] shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* NASA Live Telemetry Strip (Honest Persisted Values Only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Card 1: NASA POWER Solar & GDD */}
                <div className="bg-white p-5 rounded-2xl border border-[#D5E5CA] shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#527367]">
                    <span className="flex items-center gap-1">
                      <Thermometer className="w-3.5 h-3.5 text-amber-600" />
                      NASA POWER
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold">
                      {power?.status === 'synced' ? 'LIVE 0.5°' : 'NOT SYNCED'}
                    </span>
                  </div>
                  <div className="font-display text-2xl font-bold text-[#073D2B]">
                    {nasaLoading
                      ? 'Loading...'
                      : power?.dailyRadiation !== null && power?.dailyRadiation !== undefined
                      ? `${power.dailyRadiation} MJ/m²`
                      : 'Unavailable'}
                  </div>
                  <p className="text-[11px] text-[#2A4D3E]">
                    {power?.status === 'synced'
                      ? `GDD(10°C): ${power.growingDegreeDays ?? '—'} • ${power.meanTempC ?? '—'}°C • Wind: ${power.meanWindSpeedMps ?? '—'} m/s`
                      : 'Click "Ingest All NASA Data" above to retrieve daily insolation, temp & wind'}
                  </p>
                </div>

                {/* Card 2: NASA POWER / GPM Precip */}
                <div className="bg-white p-5 rounded-2xl border border-[#D5E5CA] shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#527367]">
                    <span className="flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5 text-blue-600" />
                      Precip (POWER/GPM)
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold">
                      {gpm?.value30DayTotal !== null && gpm?.value30DayTotal !== undefined
                        ? 'LIVE MM'
                        : gpm?.latestGranuleId
                        ? 'CMR INDEXED'
                        : 'NOT SYNCED'}
                    </span>
                  </div>
                  <div className="font-display text-2xl font-bold text-[#073D2B]">
                    {nasaLoading
                      ? 'Loading...'
                      : gpm?.value30DayTotal !== null && gpm?.value30DayTotal !== undefined
                      ? `${gpm.value30DayTotal} mm`
                      : gpm?.latestGranuleId
                      ? 'Granule Only'
                      : 'Unavailable'}
                  </div>
                  <p className="text-[11px] text-[#2A4D3E]">
                    {gpm?.value30DayTotal !== null && gpm?.value30DayTotal !== undefined
                      ? `Observed Window Total (${power?.daysObserved || 30}d)${gpm?.latestGranuleId ? ` • GPM: ${gpm.latestGranuleId.slice(0, 14)}...` : ''}`
                      : 'Sync NASA POWER for cumulative daily PRECTOTCORR precipitation'}
                  </p>
                </div>

                {/* Card 3: NASA SMAP CMR */}
                <div className="bg-white p-5 rounded-2xl border border-[#D5E5CA] shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#527367]">
                    <span className="flex items-center gap-1">
                      <Satellite className="w-3.5 h-3.5 text-sky-600" />
                      NASA SMAP L4
                    </span>
                    <span className="text-[10px] font-mono text-sky-700 font-bold">
                      {smap?.latestGranuleId ? '9km CMR' : 'NOT SYNCED'}
                    </span>
                  </div>
                  <div className="font-display text-xl sm:text-2xl font-bold text-[#073D2B]">
                    {nasaLoading
                      ? 'Loading...'
                      : smap?.latestGranuleId
                      ? 'Granule Indexed'
                      : 'Not Synced'}
                  </div>
                  <p className="text-[11px] text-[#2A4D3E] break-words">
                    {smap?.latestGranuleId
                      ? `Pass: ${smap.granuleTimestamp ? new Date(smap.granuleTimestamp).toLocaleDateString() : 'Indexed'} • Pixel HDF5 requires Earthdata token`
                      : 'Index CMR granules to verify SMAP L4 orbital overpass availability'}
                  </p>
                </div>

                {/* Card 4: NASA MODIS 250m Live NDVI / EVI / LST */}
                <div className="bg-white p-5 rounded-2xl border border-[#D5E5CA] shadow-2xs space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#527367]">
                    <span className="flex items-center gap-1">
                      <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                      NASA MODIS
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 font-bold">
                      {modis?.status === 'synced'
                        ? 'LIVE 250m'
                        : modis?.latestGranuleId
                        ? '250m CMR'
                        : 'NOT SYNCED'}
                    </span>
                  </div>
                  <div className="font-display text-xl sm:text-2xl font-bold text-[#073D2B]">
                    {nasaLoading
                      ? 'Loading...'
                      : modis?.status === 'synced' && modis?.currentNDVI !== null && modis?.currentNDVI !== undefined
                      ? `${modis.currentNDVI} NDVI`
                      : modis?.latestGranuleId
                      ? 'Granule Only'
                      : 'Unavailable'}
                  </div>
                  <p className="text-[11px] text-[#2A4D3E] break-words">
                    {modis?.status === 'synced'
                      ? `EVI: ${modis.currentEVI ?? '—'}${modis.lstDayC !== null && modis.lstDayC !== undefined ? ` • LST: ${modis.lstDayC}°C` : ''} • ${modis.observedAt}`
                      : modis?.latestGranuleId
                      ? `Granule indexed (${modis.granuleTimestamp ? new Date(modis.granuleTimestamp).toLocaleDateString() : 'CMR'}) • Run Sync MODIS for pixel NDVI`
                      : 'Ingest MODIS 250m to retrieve live ORNL DAAC NDVI, EVI & quality flag'}
                  </p>
                </div>

              </div>

              {/* Middle Section: Recommended Rotation Strategy Callout */}
              <div className="bg-gradient-to-br from-white to-[#FAFDF8] p-4 sm:p-8 rounded-3xl border border-[#D5E5CA] shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
                <div className="lg:col-span-8 space-y-3 min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Top-Ranked Strategy for Your Priorities
                  </div>
                  <h3 className="font-display text-fluid-h2 font-extrabold text-[#073D2B]">
                    {topStrategy ? `Strategy ${topStrategy.code}: ${topStrategy.title}` : 'Strategy B: Soil Restoration & Living Root Cover'}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#527367] leading-relaxed">
                    {topStrategy?.explainability?.whySuggested ||
                      `By introducing a winter cover sequence following ${activeFarm.currentCrop}, this strategy aligns with your active farmer priorities and soil parameters (${activeFarm.soilType}, OM ${activeFarm.organicMatter}%).`}
                  </p>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard/crop-rotation')}
                      className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#073D2B] text-white text-xs font-bold hover:bg-[#145C3D] transition-all flex items-center justify-center gap-2 shadow-xs"
                    >
                      <span>Explore 3-Strategy Comparison</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#76B93F]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard/priorities')}
                      className="min-h-[44px] px-5 py-2.5 rounded-full bg-white border border-[#D5E5CA] text-[#073D2B] text-xs font-bold hover:bg-[#F0F5EE] transition-all"
                    >
                      Calibrate Farmer Priorities
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('/dashboard/farm-map')}
                      className="min-h-[44px] px-5 py-2.5 rounded-full bg-white border border-[#D5E5CA] text-[#073D2B] text-xs font-bold hover:bg-[#F0F5EE] transition-all"
                    >
                      Inspect Satellite Map
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-[#FAFDF8] border border-[#D5E5CA] p-4 sm:p-5 rounded-2xl space-y-3">
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
                  <p className="text-[11px] text-[#527367] italic pt-1">
                    *Model-derived ranking from your 12 priority inputs, soil record &amp; persisted NASA POWER data.
                  </p>
                </div>
              </div>

              {/* Quick Challenge Features Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <button
                  type="button"
                  onClick={() => onNavigate('/dashboard/crop-database')}
                  className="text-left p-4 sm:p-5 rounded-2xl bg-white border border-[#D5E5CA] hover:border-[#76B93F] cursor-pointer transition-all shadow-2xs space-y-2"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-[#073D2B]">Crop Database</h4>
                  <p className="text-[11px] text-[#527367]">Explore 16 agronomic parameters across 8+ crops.</p>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('/dashboard/scenarios')}
                  className="text-left p-4 sm:p-5 rounded-2xl bg-white border border-[#D5E5CA] hover:border-[#76B93F] cursor-pointer transition-all shadow-2xs space-y-2"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-[#073D2B]">What-If Simulator</h4>
                  <p className="text-[11px] text-[#527367]">Test rainfall drops, heat spells, and late planting.</p>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('/dashboard/bare-field')}
                  className="text-left p-4 sm:p-5 rounded-2xl bg-white border border-[#D5E5CA] hover:border-[#76B93F] cursor-pointer transition-all shadow-2xs space-y-2"
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-800 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-[#073D2B]">Bare-Field Detector</h4>
                  <p className="text-[11px] text-[#527367]">Evaluate 135-day winter fallow & erosion hazard.</p>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('/dashboard/pest-cycles')}
                  className="text-left p-4 sm:p-5 rounded-2xl bg-white border border-[#D5E5CA] hover:border-[#76B93F] cursor-pointer transition-all shadow-2xs space-y-2"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                    <Bug className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-[#073D2B]">Pest Host Tracker</h4>
                  <p className="text-[11px] text-[#527367]">Break corn rootworm and soybean nematode cycles.</p>
                </button>

              </div>

            </div>
            );
          })()}

          {/* 1B. FARM PROPERTIES MANAGEMENT */}
          {activeSubPage === '/dashboard/farms' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-4 sm:p-8 border border-[#D5E5CA] shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8DE] pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
                      Operation Registry
                    </span>
                    <h2 className="font-display text-fluid-h2 font-bold text-[#073D2B] mt-1">
                      Registered Farm Properties
                    </h2>
                    <p className="text-xs text-[#527367] mt-1">
                      Select an active farm parcel for NASA telemetry binding or register a new field property below.
                    </p>
                  </div>
                  <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold">
                    {farms.length} Active {farms.length === 1 ? 'Property' : 'Properties'}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {farms.map((farm) => {
                    const isSelected = farm.id === activeFarm.id;
                    const isEditingThis = editingFarmId === farm.id;
                    const canManage = !farm.isDemo;
                    return (
                      <div
                        key={farm.id}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 ${
                          isSelected
                            ? 'bg-[#F4F9EE] border-[#76B93F] ring-2 ring-[#76B93F]/20 shadow-xs'
                            : 'bg-[#FAFDF8] border-[#E2E8DE]'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-base text-[#073D2B]">{farm.name}</h3>
                              {isSelected && (
                                <span className="px-2 py-0.5 rounded-full bg-[#073D2B] text-[#9BD85A] text-[10px] font-bold">
                                  ACTIVE
                                </span>
                              )}
                              {farm.isDemo && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                                  DEMO PARCEL
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#527367] flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-[#76B93F] flex-shrink-0" />
                              <span>{farm.location} ({farm.coordinates[1].toFixed(2)}°, {farm.coordinates[0].toFixed(2)}°)</span>
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-white border border-[#D5E5CA] text-xs font-bold text-[#073D2B]">
                            {farm.acreage} ac
                          </span>
                        </div>

                        {isEditingThis ? (
                          <div className="p-3 bg-white rounded-xl border border-[#76B93F]/50 space-y-3 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label className="block font-bold text-[#073D2B] mb-1">Name</label>
                                <input
                                  type="text"
                                  value={editFarmName}
                                  onChange={(e) => setEditFarmName(e.target.value)}
                                  className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#D5E5CA] text-xs text-[#073D2B]"
                                />
                              </div>
                              <div>
                                <label className="block font-bold text-[#073D2B] mb-1">Location</label>
                                <input
                                  type="text"
                                  value={editFarmLocation}
                                  onChange={(e) => setEditFarmLocation(e.target.value)}
                                  className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#D5E5CA] text-xs text-[#073D2B]"
                                />
                              </div>
                              <div>
                                <label className="block font-bold text-[#073D2B] mb-1">Acreage</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={editFarmAcreage}
                                  onChange={(e) => setEditFarmAcreage(e.target.value)}
                                  className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#D5E5CA] text-xs text-[#073D2B]"
                                />
                              </div>
                              <div>
                                <label className="block font-bold text-[#073D2B] mb-1">Current Crop</label>
                                <input
                                  type="text"
                                  value={editFarmCrop}
                                  onChange={(e) => setEditFarmCrop(e.target.value)}
                                  className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#D5E5CA] text-xs text-[#073D2B]"
                                />
                              </div>
                              <div>
                                <label className="block font-bold text-[#073D2B] mb-1">Soil pH</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editFarmPH}
                                  onChange={(e) => setEditFarmPH(e.target.value)}
                                  className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#D5E5CA] text-xs text-[#073D2B]"
                                />
                              </div>
                              <div>
                                <label className="block font-bold text-[#073D2B] mb-1">OM %</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={editFarmOM}
                                  onChange={(e) => setEditFarmOM(e.target.value)}
                                  className="w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border border-[#D5E5CA] text-xs text-[#073D2B]"
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingFarmId(null)}
                                className="px-3.5 py-1.5 rounded-full border border-[#D5E5CA] text-xs font-bold text-[#527367]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={savingEditFarm}
                                onClick={() => handleSaveEditFarm(farm.id)}
                                className="px-4 py-1.5 rounded-full bg-[#073D2B] text-white text-xs font-bold disabled:opacity-50"
                              >
                                {savingEditFarm ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="p-2.5 bg-white rounded-xl border border-[#E2E8DE]">
                              <span className="text-[10px] text-[#527367] block">Current Crop</span>
                              <span className="font-bold text-[#073D2B]">{farm.currentCrop}</span>
                            </div>
                            <div className="p-2.5 bg-white rounded-xl border border-[#E2E8DE]">
                              <span className="text-[10px] text-[#527367] block">Soil Series</span>
                              <span className="font-bold text-[#073D2B]">{farm.soilType}</span>
                            </div>
                            <div className="p-2.5 bg-white rounded-xl border border-[#E2E8DE]">
                              <span className="text-[10px] text-[#527367] block">Soil pH</span>
                              <span className="font-bold text-[#073D2B]">{farm.soilPH}</span>
                            </div>
                            <div className="p-2.5 bg-white rounded-xl border border-[#E2E8DE]">
                              <span className="text-[10px] text-[#527367] block">Organic Matter</span>
                              <span className="font-bold text-[#073D2B]">{farm.organicMatter}%</span>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#E2E8DE]">
                          <span className="text-[11px] text-[#527367]">
                            Drainage: <strong className="text-[#073D2B]">{farm.drainage}</strong>
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            {canManage && !isEditingThis && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditFarm(farm)}
                                  className="min-h-[40px] px-3 py-1.5 rounded-full border border-[#D5E5CA] bg-white hover:bg-[#F0F5EE] text-[#073D2B] text-xs font-bold inline-flex items-center gap-1"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                {confirmDeleteFarmId === farm.id ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteFarm(farm.id)}
                                      className="min-h-[40px] px-3 py-1.5 rounded-full bg-rose-700 text-white text-xs font-bold"
                                    >
                                      Confirm Delete
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteFarmId(null)}
                                      className="min-h-[40px] px-3 py-1.5 rounded-full border border-[#D5E5CA] text-xs font-bold text-[#527367]"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteFarmId(farm.id)}
                                    className="min-h-[40px] px-3 py-1.5 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold inline-flex items-center gap-1"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedFarmId(farm.id)}
                              disabled={isSelected}
                              className={`min-h-[42px] px-4 py-2 rounded-full text-xs font-bold transition-all ${
                                isSelected
                                  ? 'bg-[#EAF5DF] text-[#145C3D] cursor-default'
                                  : 'bg-[#073D2B] hover:bg-[#145C3D] text-white'
                              }`}
                            >
                              {isSelected ? 'Selected Active Farm' : 'Set as Active Farm'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Register New Farm Property Form */}
              <form
                onSubmit={handleCreateFarm}
                className="bg-white rounded-3xl p-4 sm:p-8 border border-[#D5E5CA] shadow-sm space-y-5"
              >
                <div>
                  <h3 className="font-display text-xl font-bold text-[#073D2B] flex items-center gap-2">
                    <Plus className="w-5 h-5 text-[#76B93F]" />
                    Register New Farm Property
                  </h3>
                  <p className="text-xs text-[#527367] mt-1">
                    Add parcel coordinates and baseline soil lab attributes for live NASA ingestion &amp; rotation simulation.
                  </p>
                </div>

                {farmCreateStatus && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 border ${
                      farmCreateStatus.type === 'success'
                        ? 'bg-[#EAF5DF] border-[#76B93F] text-[#073D2B]'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span>{farmCreateStatus.message}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Property Name *</label>
                    <input
                      type="text"
                      required
                      value={newFarmName}
                      onChange={(e) => setNewFarmName(e.target.value)}
                      placeholder="e.g., North Creek Loam Field"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D5E5CA] text-sm sm:text-xs text-[#073D2B] focus:ring-2 focus:ring-[#76B93F] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Location (City, State) *</label>
                    <input
                      type="text"
                      required
                      value={newFarmLocation}
                      onChange={(e) => setNewFarmLocation(e.target.value)}
                      placeholder="e.g., Boone, Iowa"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D5E5CA] text-sm sm:text-xs text-[#073D2B] focus:ring-2 focus:ring-[#76B93F] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Acreage</label>
                    <input
                      type="number"
                      min={1}
                      value={newFarmAcreage}
                      onChange={(e) => setNewFarmAcreage(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D5E5CA] text-sm sm:text-xs text-[#073D2B] focus:ring-2 focus:ring-[#76B93F] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Current Standing Crop</label>
                    <select
                      value={newFarmCrop}
                      onChange={(e) => setNewFarmCrop(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D5E5CA] bg-white text-sm sm:text-xs text-[#073D2B] focus:ring-2 focus:ring-[#76B93F] focus:outline-hidden"
                    >
                      <option value="Corn (Maize)">Corn (Maize)</option>
                      <option value="Soybeans">Soybeans</option>
                      <option value="Grain Sorghum">Grain Sorghum</option>
                      <option value="Winter Wheat / Rye">Winter Wheat / Rye</option>
                      <option value="Alfalfa Forage">Alfalfa Forage</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Soil Texture Class</label>
                    <select
                      value={newFarmSoilType}
                      onChange={(e) => setNewFarmSoilType(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D5E5CA] bg-white text-sm sm:text-xs text-[#073D2B] focus:ring-2 focus:ring-[#76B93F] focus:outline-hidden"
                    >
                      <option value="Silt Loam">Silt Loam</option>
                      <option value="Clarion-Nicollet Loam">Clarion-Nicollet Loam</option>
                      <option value="Clay Loam">Clay Loam</option>
                      <option value="Sandy Loam">Sandy Loam</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-[#073D2B] mb-1">Soil pH</label>
                      <input
                        type="number"
                        step="0.1"
                        min="4.0"
                        max="9.0"
                        value={newFarmPH}
                        onChange={(e) => setNewFarmPH(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#D5E5CA] text-sm sm:text-xs text-[#073D2B] focus:ring-2 focus:ring-[#76B93F] focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-[#073D2B] mb-1">OM %</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="15.0"
                        value={newFarmOM}
                        onChange={(e) => setNewFarmOM(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#D5E5CA] text-sm sm:text-xs text-[#073D2B] focus:ring-2 focus:ring-[#76B93F] focus:outline-hidden"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Latitude (Optional)</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="-90"
                      max="90"
                      value={newFarmLat}
                      onChange={(e) => setNewFarmLat(e.target.value)}
                      placeholder="42.0300"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D5E5CA] text-sm sm:text-xs text-[#073D2B] focus:ring-2 focus:ring-[#76B93F] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Longitude (Optional)</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="-180"
                      max="180"
                      value={newFarmLon}
                      onChange={(e) => setNewFarmLon(e.target.value)}
                      placeholder="-93.6200"
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#D5E5CA] text-sm sm:text-xs text-[#073D2B] focus:ring-2 focus:ring-[#76B93F] focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4 text-[#76B93F]" />
                    <span>Register Farm Property</span>
                  </button>
                </div>
              </form>
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
          {activeSubPage === '/dashboard/crop-rotation' && (() => {
            const stratA = strategies.find((s) => s.code === 'A');
            const stratB = strategies.find((s) => s.code === 'B');
            const stratC = strategies.find((s) => s.code === 'C');

            return (
            <div className="space-y-6">
              
              {/* Mandatory 3-Strategy Comparison Table & Mobile Cards */}
              <div className="bg-white rounded-3xl p-4 sm:p-8 border border-[#D5E5CA] shadow-sm space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E2E8DE] pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#76B93F]">
                      Requirement J: Mandatory Three-Strategy Comparison
                    </span>
                    <h2 className="font-display text-fluid-h2 font-bold text-[#073D2B] mt-1">
                      Multi-Year Crop Sequence Comparison Matrix
                    </h2>
                    <p className="text-xs text-[#527367] mt-1">
                      Comparing baseline operation against restorative cover cropping and climate-resilient pulses for {activeFarm.name}.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={savingRotation}
                      onClick={handleSaveRotationAssessment}
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs font-bold disabled:opacity-50"
                    >
                      <BookmarkCheck className="w-4 h-4 text-[#76B93F]" />
                      <span>{savingRotation ? 'Saving...' : 'Save Assessment Snapshot'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIncomeModalOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-full bg-[#EAF5DF] text-[#145C3D] text-xs font-bold"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Supplemental Income</span>
                    </button>
                  </div>
                </div>

                {rotationSaveFeedback && (
                  <div className="p-3 rounded-xl bg-[#EAF5DF] border border-[#76B93F] text-xs font-medium text-[#073D2B] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#145C3D] shrink-0" />
                    <span>{rotationSaveFeedback}</span>
                  </div>
                )}

                {/* Mobile Stacked Strategy Comparison Cards (< md) */}
                <div className="md:hidden space-y-4">
                  {[
                    { s: stratA, badgeClass: 'bg-amber-100 text-amber-900', cardClass: 'bg-amber-50/30 border-amber-200', code: 'A' },
                    { s: stratB, badgeClass: 'bg-emerald-100 text-emerald-900', cardClass: 'bg-emerald-50/40 border-emerald-300', code: 'B' },
                    { s: stratC, badgeClass: 'bg-blue-100 text-blue-900', cardClass: 'bg-blue-50/30 border-blue-200', code: 'C' },
                  ].map(({ s, badgeClass, cardClass, code }) => (
                    <div key={code} className={`p-4 rounded-2xl border space-y-3 text-xs ${cardClass}`}>
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-black/5">
                        <span className={`px-2.5 py-1 rounded-lg font-bold ${badgeClass}`}>
                          Strategy {code}: {s?.title || ''}
                        </span>
                        <span className="font-display font-extrabold text-base text-[#073D2B]">
                          {s ? `${s.score}%` : '—'}
                        </span>
                      </div>
                      <dl className="space-y-2 text-[#2A4D3E]">
                        <div>
                          <dt className="text-[11px] font-bold text-[#073D2B]">Crop Sequence</dt>
                          <dd>{s?.cropSequence?.join(' → ') || 'Loading...'}</dd>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <dt className="text-[11px] font-bold text-[#073D2B]">Erosion Mitigation</dt>
                            <dd className="font-semibold">{s?.soilBenefits?.erosionMitigation || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-bold text-[#073D2B]">Biological N Fix</dt>
                            <dd className="font-semibold">{s?.soilBenefits?.nitrogenFixation || '—'}</dd>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <dt className="text-[11px] font-bold text-[#073D2B]">Water Efficiency</dt>
                            <dd>{s?.climateResilience?.waterEfficiency || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-bold text-[#073D2B]">Gross Margin Est.</dt>
                            <dd>{s?.economicProfile?.grossMarginEst || '—'}</dd>
                          </div>
                        </div>
                      </dl>
                    </div>
                  ))}
                </div>

                {/* Desktop Comparative Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[680px]">
                    <thead>
                      <tr className="border-b border-[#E2E8DE] text-[#073D2B]">
                        <th className="py-3 px-4 font-bold">Criteria</th>
                        <th className="py-3 px-4 font-bold text-amber-900 bg-amber-50/50">
                          Strategy A: {stratA?.title || 'Baseline'}
                        </th>
                        <th className="py-3 px-4 font-bold text-emerald-900 bg-emerald-50/50">
                          Strategy B: {stratB?.title || 'Soil Restoration'}
                        </th>
                        <th className="py-3 px-4 font-bold text-blue-900 bg-blue-50/50">
                          Strategy C: {stratC?.title || 'Climate Resilient'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8DE] text-[#2A4D3E]">
                      <tr>
                        <td className="py-3 px-4 font-bold text-[#073D2B]">Current Model Score</td>
                        <td className="py-3 px-4 font-bold text-amber-800 bg-amber-50/20">{stratA ? `${stratA.score}%` : '—'}</td>
                        <td className="py-3 px-4 font-bold text-emerald-800 bg-emerald-50/20">{stratB ? `${stratB.score}%` : '—'}</td>
                        <td className="py-3 px-4 font-bold text-blue-800 bg-blue-50/20">{stratC ? `${stratC.score}%` : '—'}</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold text-[#073D2B]">Crop Sequence</td>
                        <td className="py-3 px-4 bg-amber-50/20">{stratA?.cropSequence?.join(' → ') || '—'}</td>
                        <td className="py-3 px-4 bg-emerald-50/20">{stratB?.cropSequence?.join(' → ') || '—'}</td>
                        <td className="py-3 px-4 bg-blue-50/20">{stratC?.cropSequence?.join(' → ') || '—'}</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold text-[#073D2B]">Erosion Mitigation</td>
                        <td className="py-3 px-4 bg-amber-50/20 text-rose-700 font-semibold">{stratA?.soilBenefits?.erosionMitigation || '—'}</td>
                        <td className="py-3 px-4 bg-emerald-50/20 text-emerald-700 font-semibold">{stratB?.soilBenefits?.erosionMitigation || '—'}</td>
                        <td className="py-3 px-4 bg-blue-50/20 text-blue-700 font-semibold">{stratC?.soilBenefits?.erosionMitigation || '—'}</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold text-[#073D2B]">Biological Nitrogen Fix</td>
                        <td className="py-3 px-4 bg-amber-50/20">{stratA?.soilBenefits?.nitrogenFixation || '—'}</td>
                        <td className="py-3 px-4 bg-emerald-50/20 font-bold text-emerald-700">{stratB?.soilBenefits?.nitrogenFixation || '—'}</td>
                        <td className="py-3 px-4 bg-blue-50/20">{stratC?.soilBenefits?.nitrogenFixation || '—'}</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold text-[#073D2B]">Water Efficiency</td>
                        <td className="py-3 px-4 bg-amber-50/20">{stratA?.climateResilience?.waterEfficiency || '—'}</td>
                        <td className="py-3 px-4 bg-emerald-50/20">{stratB?.climateResilience?.waterEfficiency || '—'}</td>
                        <td className="py-3 px-4 bg-blue-50/20 font-bold text-blue-700">{stratC?.climateResilience?.waterEfficiency || '—'}</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold text-[#073D2B]">Estimated Gross Margin</td>
                        <td className="py-3 px-4 bg-amber-50/20">{stratA?.economicProfile?.grossMarginEst || '—'}</td>
                        <td className="py-3 px-4 bg-emerald-50/20">{stratB?.economicProfile?.grossMarginEst || '—'}</td>
                        <td className="py-3 px-4 bg-blue-50/20 font-bold text-blue-700">{stratC?.economicProfile?.grossMarginEst || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {savedRotations.length > 0 && (
                  <div className="pt-4 border-t border-[#E2E8DE] space-y-2">
                    <span className="text-[11px] font-bold uppercase text-[#527367] block">
                      Saved Rotation Assessments ({savedRotations.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                      {savedRotations.slice(0, 6).map((rot: any) => (
                        <div key={rot.id} className="p-3 rounded-xl bg-[#FAFDF8] border border-[#E2E8DE] space-y-1">
                          <div className="font-bold text-[#073D2B] truncate">
                            {rot.rotation_scenarios?.name || 'Saved Assessment'}
                          </div>
                          <div className="text-[11px] text-[#527367]">
                            {rot.rotation_scenarios?.is_hypothetical ? 'Hypothetical Scenario' : 'Baseline Evaluation'} &bull;{' '}
                            {new Date(rot.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 10-Point Explainability Explorer (Requirement I) */}
              {strategies.length > 0 && <ExplainabilityExplorer strategies={strategies} />}

            </div>
            );
          })()}

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
            <NasaRoadmapExplorer
              farmId={selectedFarmId}
              farmName={activeFarm.name}
              onSynced={() => fetchNasaAndFarmAnalytics(selectedFarmId)}
            />
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
                <h2 className="font-display text-fluid-h2 font-bold text-[#073D2B]">Soil Chemistry & Biological Intelligence</h2>
                <p className="text-xs text-[#527367]">
                  Laboratory test metrics coupled with NRCS physical survey data for {activeFarm.name}.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
                  <span className="text-xs font-bold text-[#145C3D] uppercase">Soil pH Index</span>
                  <div className="font-display text-3xl font-extrabold text-[#073D2B]">{activeFarm.soilPH}</div>
                  <p className="text-xs text-[#527367]">
                    Target band: 6.2 – 6.8. Favorable for legume nodulation and phosphorus uptake.
                  </p>
                </div>

                <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
                  <span className="text-xs font-bold text-[#145C3D] uppercase">Soil Organic Matter</span>
                  <div className="font-display text-3xl font-extrabold text-[#073D2B]">{activeFarm.organicMatter}%</div>
                  <p className="text-xs text-[#527367]">
                    Holds an estimated 80,000+ gallons of available pore water per acre.
                  </p>
                </div>

                <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-3">
                  <span className="text-xs font-bold text-[#145C3D] uppercase">Nutrient Balance</span>
                  <div className="font-display text-lg font-bold text-[#073D2B]">
                    N: {activeFarm.nitrogen}
                  </div>
                  <p className="text-xs text-[#527367] break-words">
                    P: {activeFarm.phosphorus} | K: {activeFarm.potassium}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-4 sm:p-6 border border-[#D5E5CA] space-y-3">
                <h3 className="font-bold text-base text-[#073D2B]">Agronomic Soil Limitations &amp; Provenance</h3>
                {soilProfileData?.provenance && (
                  <p className="text-[11px] font-semibold text-[#145C3D]">{soilProfileData.provenance}</p>
                )}
                <ul className="space-y-2 text-xs text-[#2A4D3E]">
                  {(soilProfileData?.limitations || [
                    'Satellite radiometry cannot measure soil pH, phosphorus, potassium, or field-tile drainage.',
                    'Periodic laboratory soil cores remain mandatory for nutrient prescription accuracy.',
                  ]).map((lim: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span>{lim}</span>
                    </li>
                  ))}
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#76B93F] flex-shrink-0 mt-0.5" />
                    <span>Last Laboratory Soil Test: <strong>{activeFarm.lastSoilTest}</strong> &bull; Drainage: <strong>{activeFarm.drainage}</strong></span>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* 11. FIELD RISK ANALYSIS */}
          {activeSubPage === '/dashboard/field-risk' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-fluid-h2 font-bold text-[#073D2B]">Geospatial Field Risk Diagnostics</h2>
                  <p className="text-xs text-[#527367]">
                    Vulnerability indices grounded in persisted farm soil records and synced NASA POWER agroclimatology.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={syncingPower}
                  onClick={handleSyncNasaPower}
                  className="min-h-[42px] px-4 py-2 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <CloudDownload className="w-3.5 h-3.5 text-[#76B93F]" />
                  <span>{syncingPower ? 'Syncing NASA POWER...' : 'Refresh NASA Climate Risk'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#D5E5CA] space-y-4">
                  <h3 className="font-bold text-base text-[#073D2B]">Persisted Parcel Risk Indicators</h3>
                  <div className="space-y-4 text-xs">
                    {fieldRiskIndicators.map((ind: any, idx: number) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex flex-wrap justify-between gap-1">
                          <span className="font-semibold text-[#073D2B]">{ind.name}</span>
                          {ind.score !== null && ind.score !== undefined ? (
                            <span
                              className={`font-bold ${
                                ind.level === 'HIGH'
                                  ? 'text-rose-700'
                                  : ind.level === 'MODERATE'
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {ind.level} ({ind.score}%)
                            </span>
                          ) : (
                            <span className="font-bold text-slate-600">NOT SYNCED</span>
                          )}
                        </div>
                        {ind.score !== null && ind.score !== undefined && (
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, Math.max(0, ind.score))}%` }}
                              className={`h-full ${
                                ind.level === 'HIGH'
                                  ? 'bg-rose-500'
                                  : ind.level === 'MODERATE'
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                            />
                          </div>
                        )}
                        <p className="text-[11px] text-[#527367]">{ind.observation}</p>
                        <p className="text-[10px] font-mono text-[#145C3D]">{ind.dataSource}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#D5E5CA] space-y-3">
                  <h3 className="font-bold text-base text-[#073D2B]">Mitigation &amp; Scientific Notice</h3>
                  <p className="text-xs text-[#527367]">
                    {fieldRiskNotice || 'NASA POWER grid cells (~50 km) do not capture field-level frost pockets or tile drainage variations.'}
                  </p>
                  <div className="space-y-2 text-xs text-[#2A4D3E]">
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                      <strong>Winter Living Cover:</strong> Strategy B cereal rye + hairy vetch reduces winter runoff and improves spring infiltration in {activeFarm.soilType}.
                    </div>
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <strong>Staggered Pollination Window:</strong> Diversifying planting maturities spreads heat exposure across July-August reproductive stages.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 12. CLIMATE TIMELINE */}
          {activeSubPage === '/dashboard/climate-timeline' && (() => {
            const maxRain = Math.max(25, ...climateTimeline.map((d) => Number(d.rainfallMm || 0)));
            const recentPoints = climateTimeline.slice(-24);

            return (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-fluid-h2 font-bold text-[#073D2B]">Historical Climate &amp; Precipitation Timeline</h2>
                  <p className="text-xs text-[#527367]">
                    {climateProvenance || 'Daily agroclimatology time series from NASA POWER API for your parcel coordinates.'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={syncingPower}
                  onClick={handleSyncNasaPower}
                  className="min-h-[42px] px-4 py-2 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs font-bold inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <CloudDownload className="w-3.5 h-3.5 text-[#76B93F]" />
                  <span>{syncingPower ? 'Syncing NASA POWER...' : 'Sync 30-Day NASA POWER'}</span>
                </button>
              </div>

              <div className="bg-white p-4 sm:p-8 rounded-3xl border border-[#D5E5CA] shadow-2xs space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-[#145C3D] uppercase">Real Persisted Daily Series</span>
                    <h3 className="text-lg sm:text-xl font-bold text-[#073D2B]">Daily Precipitation (PRECTOTCORR, mm)</h3>
                  </div>
                  <span className="text-xs bg-[#EAF5DF] text-[#145C3D] font-bold px-3 py-1 rounded-full">
                    {recentPoints.length > 0 ? `${recentPoints.length} Observed Days` : 'Awaiting Sync'}
                  </span>
                </div>

                {recentPoints.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-[#FAFDF8] border border-[#E2E8DE] text-center space-y-3">
                    <p className="text-sm font-bold text-[#073D2B]">No NASA POWER Observations Synced Yet</p>
                    <p className="text-xs text-[#527367] max-w-md mx-auto">
                      Click "Sync 30-Day NASA POWER" to fetch live daily precipitation, solar irradiance, and temperature series for {activeFarm.name}.
                    </p>
                    <button
                      type="button"
                      disabled={syncingPower}
                      onClick={handleSyncNasaPower}
                      className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#073D2B] text-white text-xs font-bold inline-flex items-center gap-2"
                    >
                      <CloudDownload className="w-4 h-4 text-[#76B93F]" />
                      <span>{syncingPower ? 'Syncing...' : 'Sync NASA POWER Now'}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto pb-2">
                      <div className="min-w-[540px] flex items-end gap-3 pt-4">
                        <div className="h-44 flex flex-col justify-between text-[10px] font-mono text-[#8C9E94] pb-6 pr-1 border-r border-[#E2E8DE] shrink-0">
                          <span>{Math.round(maxRain)}mm</span>
                          <span>{Math.round(maxRain / 2)}mm</span>
                          <span>0mm</span>
                        </div>
                        <div
                          style={{ gridTemplateColumns: `repeat(${recentPoints.length}, minmax(16px, 1fr))` }}
                          className="flex-1 grid gap-1.5 items-end h-44 border-b border-[#E2E8DE] pb-2"
                        >
                          {recentPoints.map((pt: any) => {
                            const rain = Number(pt.rainfallMm ?? 0);
                            const pct = Math.max(rain > 0 ? 6 : 2, Math.round((rain / maxRain) * 100));
                            return (
                              <div
                                key={pt.date}
                                title={`${pt.date}: ${rain.toFixed(1)} mm rain | ${pt.tempMeanC ?? '—'}°C mean`}
                                className="flex flex-col items-center gap-1 h-full justify-end group"
                              >
                                <span className="text-[9px] font-semibold text-[#527367] tabular-nums">
                                  {rain > 0 ? rain.toFixed(0) : ''}
                                </span>
                                <div
                                  style={{ height: `${pct}%` }}
                                  className={`w-full max-w-[20px] rounded-t-md transition-all ${
                                    rain >= 15 ? 'bg-[#76B93F]' : 'bg-[#145C3D]/85 group-hover:bg-[#145C3D]'
                                  }`}
                                />
                                <span className="text-[9px] font-bold text-[#073D2B] -rotate-45 origin-top-left whitespace-nowrap">
                                  {String(pt.date).slice(5)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-[#527367] pt-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-[#145C3D]" />
                        <span>Daily NASA POWER Rainfall (mm)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-[#76B93F]" />
                        <span>Heavy Rain Event (&ge; 15 mm/day)</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            );
          })()}

          {/* 13. AI AGRICULTURAL ADVISOR */}
          {activeSubPage === '/dashboard/ai-advisor' && (
            <div className="space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Bot className="w-6 h-6 text-[#145C3D]" />
                  <h2 className="font-display text-fluid-h2 font-bold text-[#073D2B]">AI Agricultural Advisor</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EAF5DF] text-[#145C3D]">
                    GEMINI GROUNDED
                  </span>
                </div>
                <p className="text-xs text-[#527367] mt-1">
                  Persisted agronomic advisory grounded in your farm telemetry, farmer priorities, and synced NASA Earth observations.
                </p>
              </div>

              {/* Chat Container */}
              <div className="bg-white rounded-3xl border border-[#D5E5CA] shadow-sm flex flex-col h-[65dvh] min-h-[380px] max-h-[560px] overflow-hidden">
                
                {/* Chat Message List */}
                <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto space-y-4">
                  {aiChatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-2.5 sm:gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.sender === 'ai' && (
                        <div className="w-8 h-8 rounded-full bg-[#073D2B] text-[#76B93F] flex items-center justify-center flex-shrink-0 text-xs font-bold">
                          <Bot className="w-4 h-4" />
                        </div>
                      )}
                      <div
                        className={`max-w-[88%] sm:max-w-xl min-w-0 break-words p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
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
                                <span>{msg.source || 'Gemini Grounded'} • NASA Telemetry {msg.latencyMs ? `(${Math.round(msg.latencyMs / 100) / 10}s)` : ''}</span>
                              </div>
                            )}

                            {msg.isFallback && msg.originalPrompt && (
                              <button
                                type="button"
                                onClick={() => handleSendAiPrompt(msg.originalPrompt)}
                                disabled={aiLoading}
                                className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-1 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
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
                      <span>Synthesizing NASA telemetry with Gemini Advisor...</span>
                    </div>
                  )}
                </div>

                {/* Pre-canned Prompts */}
                <div className="px-3.5 sm:px-6 py-2 bg-[#FAFDF8] border-t border-[#E2E8DE] flex items-center gap-2 overflow-x-auto scrollbar-none">
                  <span className="text-[10px] font-bold text-[#527367] uppercase whitespace-nowrap">Suggested:</span>
                  <button
                    type="button"
                    onClick={() => handleSendAiPrompt('How do my current priorities affect Strategy B vs Strategy C in drought?')}
                    className="min-h-[38px] px-3 py-1.5 rounded-full bg-white border border-[#D5E5CA] text-[11px] text-[#073D2B] hover:bg-[#EAF5DF] whitespace-nowrap"
                  >
                    Priorities & Drought
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendAiPrompt('How does continuous cover cropping disrupt Western Corn Rootworm beetles?')}
                    className="min-h-[38px] px-3 py-1.5 rounded-full bg-white border border-[#D5E5CA] text-[11px] text-[#073D2B] hover:bg-[#EAF5DF] whitespace-nowrap"
                  >
                    Pest Host Cycle Break
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendAiPrompt('Explain the 135-day bare field period erosion risk under GPM storm events.')}
                    className="min-h-[38px] px-3 py-1.5 rounded-full bg-white border border-[#D5E5CA] text-[11px] text-[#073D2B] hover:bg-[#EAF5DF] whitespace-nowrap"
                  >
                    Bare Soil Risk
                  </button>
                </div>

                {/* Input Bar */}
                <div className="p-3 sm:p-4 bg-white border-t border-[#E2E8DE] flex items-center gap-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendAiPrompt();
                    }}
                    placeholder="Ask about crop rotations, priorities, or soil..."
                    className="flex-1 min-w-0 min-h-[44px] px-4 py-2 rounded-full border border-[#D5E5CA] text-sm sm:text-xs text-[#073D2B] focus:ring-2 focus:ring-[#76B93F] focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendAiPrompt()}
                    disabled={!aiPrompt.trim() || aiLoading}
                    className="min-h-[44px] px-4 sm:px-5 py-2 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 flex-shrink-0"
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
              <div>
                <h2 className="font-display text-fluid-h2 font-bold text-[#073D2B]">Agronomic Compliance & Extension Reports</h2>
                <p className="text-xs text-[#527367]">Generate formal briefs for USDA-NRCS, insurance, and certified crop advisors.</p>
              </div>

              {reportFeedback && (
                <div className="p-3.5 rounded-2xl bg-[#EAF5DF] border border-[#76B93F] text-xs font-medium text-[#073D2B] flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#145C3D] flex-shrink-0" />
                    {reportFeedback}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReportFeedback(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/60 text-[#073D2B]"
                    aria-label="Dismiss message"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#D5E5CA] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8DE] pb-4">
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-[#073D2B]">USDA Conservation Stewardship Program (CSP) Brief</h4>
                    <p className="text-xs text-[#527367]">Documentation of Strategy B continuous winter living cover.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExportReport('csp')}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-[#073D2B] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#145C3D] flex-shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Report</span>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-[#073D2B]">NASA Earth Observations Seasonal Moisture Audit</h4>
                    <p className="text-xs text-[#527367]">SMAP L4 root-zone and GPM precipitation anomaly archive.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExportReport('nasa')}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-[#073D2B] text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#145C3D] flex-shrink-0"
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
            <form onSubmit={handleSaveSettings} className="max-w-2xl bg-white rounded-3xl p-4 sm:p-8 border border-[#D5E5CA] space-y-6">
              <div>
                <h2 className="font-display text-fluid-h2 font-bold text-[#073D2B]">Account &amp; System Settings</h2>
                <p className="text-xs text-[#527367]">Manage your profile details and measurement unit preferences persisted in Supabase.</p>
              </div>

              {profileFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 border ${
                    profileFeedback.type === 'success'
                      ? 'bg-[#EAF5DF] border-[#76B93F] text-[#073D2B]'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{profileFeedback.message}</span>
                </div>
              )}

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-[#073D2B] mb-1">Account Holder</label>
                  <input
                    type="text"
                    required
                    value={profileFullName}
                    onChange={(e) => setProfileFullName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#D5E5CA] bg-white text-sm sm:text-xs text-[#073D2B] focus:ring-2 focus:ring-[#76B93F] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#073D2B] mb-1">Email Address</label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.email}
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm sm:text-xs text-slate-700"
                  />
                </div>
                <div className="p-4 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA] space-y-2">
                  <span className="font-bold text-[#073D2B] block">Measurement Units</span>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                    <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
                      <input
                        type="radio"
                        name="units"
                        value="imperial"
                        checked={measurementUnits === 'imperial'}
                        onChange={() => setMeasurementUnits('imperial')}
                        className="w-4 h-4 text-[#073D2B]"
                      />
                      <span>Imperial (Acres, Gallons, mm/in)</span>
                    </label>
                    <label className="flex items-center gap-2.5 min-h-[44px] cursor-pointer">
                      <input
                        type="radio"
                        name="units"
                        value="metric"
                        checked={measurementUnits === 'metric'}
                        onChange={() => setMeasurementUnits('metric')}
                        className="w-4 h-4 text-[#073D2B]"
                      />
                      <span>Metric (Hectares, Litres, mm)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs sm:text-sm font-bold transition-all disabled:opacity-50"
                >
                  {savingProfile ? 'Saving Settings...' : 'Save Settings'}
                </button>
              </div>
            </form>
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
