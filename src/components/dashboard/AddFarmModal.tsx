import React, { useEffect, useState } from 'react';
import {
  Plus,
  X,
  AlertTriangle,
  Sprout,
  Sliders,
  Info,
  CheckCircle2,
  MapPin,
  Tractor,
} from 'lucide-react';
import { Farm, FarmAreaUnit, FarmerPriorities, CropCharacteristics } from '../../types';
import { FarmLocationPicker } from './FarmLocationPicker';
import { apiClient } from '../../services/apiClient';

const DEFAULT_PRIORITIES: FarmerPriorities = {
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
};

const SOIL_HEALTH_PRESET: FarmerPriorities = {
  waterConservation: 5,
  profitability: 3,
  forageValue: 3,
  nitrogenFixing: 5,
  soilOrganicMatter: 5,
  erosionReduction: 5,
  soilInfiltration: 4,
  marketSuitability: 3,
  droughtResilience: 4,
  cropDiversity: 4,
  equipmentCompatibility: 3,
  plantingHarvestConstraints: 3,
};

const DROUGHT_PRESET: FarmerPriorities = {
  waterConservation: 5,
  profitability: 4,
  forageValue: 2,
  nitrogenFixing: 3,
  soilOrganicMatter: 4,
  erosionReduction: 4,
  soilInfiltration: 4,
  marketSuitability: 4,
  droughtResilience: 5,
  cropDiversity: 4,
  equipmentCompatibility: 3,
  plantingHarvestConstraints: 4,
};

const PRIORITY_LABELS: Array<{ key: keyof FarmerPriorities; label: string }> = [
  { key: 'waterConservation', label: 'Water Conservation' },
  { key: 'soilOrganicMatter', label: 'Soil Organic Matter' },
  { key: 'nitrogenFixing', label: 'Biological Nitrogen' },
  { key: 'erosionReduction', label: 'Erosion Reduction' },
  { key: 'droughtResilience', label: 'Drought Resilience' },
  { key: 'profitability', label: 'Cash Profitability' },
  { key: 'soilInfiltration', label: 'Soil Infiltration' },
  { key: 'cropDiversity', label: 'Crop Diversity' },
  { key: 'marketSuitability', label: 'Market Access' },
  { key: 'forageValue', label: 'Forage Value' },
  { key: 'equipmentCompatibility', label: 'Equipment Fit' },
  { key: 'plantingHarvestConstraints', label: 'Window Flexibility' },
];

const FARM_TYPES = [
  'Row Crop Commercial',
  'Regenerative / Mixed Crop-Livestock',
  'Organic Certified Arable',
  'Pasture & Forage Operation',
  'Specialty Horticulture / Orchard',
  'Research & Cover Crop Trial',
];

const OPERATING_STATUSES = [
  'Active',
  'Transitioning to Regenerative',
  'Fallow / Soil Resting',
  'Seasonal Cover',
  'Planned Acquisition',
];

const IRRIGATION_TYPES = [
  'Rainfed (Dryland)',
  'Center Pivot Overhead',
  'Drip / Micro-Irrigation',
  'Furrow / Surface Flood',
  'Subsurface Tile Managed',
];

const FALLBACK_CROP_NAMES = [
  'Corn (Maize)',
  'Soybeans (Glycine max)',
  'Winter Cereal Rye',
  'Hairy Vetch',
  'Grain Sorghum (Milo)',
  'Confectionery & Oilseed Sunflower',
  'Alfalfa (Lucerne)',
  'Field Peas (Dry Peas)',
  'Winter Wheat',
];

interface AddFarmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFarmCreated: (farm: Farm) => void;
  defaultAreaUnit?: FarmAreaUnit;
}

export const AddFarmModal: React.FC<AddFarmModalProps> = ({
  isOpen,
  onClose,
  onFarmCreated,
  defaultAreaUnit = 'acres',
}) => {
  // Crop catalog loaded from existing /api/crops database
  const [cropOptions, setCropOptions] = useState<string[]>(FALLBACK_CROP_NAMES);

  // Section A: Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [area, setArea] = useState('');
  const [areaUnit, setAreaUnit] = useState<FarmAreaUnit>(defaultAreaUnit);

  // Section B: Geographic Info (NO fake coordinate defaults!)
  const [country, setCountry] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  // Section C: Agricultural Info
  const [farmType, setFarmType] = useState('Row Crop Commercial');
  const [operatingStatus, setOperatingStatus] = useState('Active');
  const [primaryCropSelect, setPrimaryCropSelect] = useState('Corn (Maize)');
  const [customCrop, setCustomCrop] = useState('');
  const [previousCrop, setPreviousCrop] = useState('');
  const [irrigationType, setIrrigationType] = useState('Rainfed (Dryland)');
  const [plantingSeason, setPlantingSeason] = useState('Spring 2026');
  const [harvestSeason, setHarvestSeason] = useState('Autumn 2026');

  // Optional farmer-provided soil baseline (explicitly nullable — never prefilled with fake lab numbers)
  const [showOptionalSoil, setShowOptionalSoil] = useState(false);
  const [soilType, setSoilType] = useState('');
  const [soilPH, setSoilPH] = useState('');
  const [organicMatter, setOrganicMatter] = useState('');
  const [drainage, setDrainage] = useState('');
  const [nitrogen, setNitrogen] = useState('');
  const [phosphorus, setPhosphorus] = useState('');
  const [potassium, setPotassium] = useState('');
  const [lastSoilTest, setLastSoilTest] = useState('');

  // Section D: Farmer Priorities
  const [priorityMode, setPriorityMode] = useState<'default' | 'soil_health' | 'drought' | 'custom'>('default');
  const [priorities, setPriorities] = useState<FarmerPriorities>(DEFAULT_PRIORITIES);

  // UI Status
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setAreaUnit(defaultAreaUnit);
  }, [defaultAreaUnit]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    apiClient
      .get('/api/crops')
      .then((res) => {
        if (!active || !Array.isArray(res?.crops)) return;
        const names = res.crops.map((c: CropCharacteristics) => c.name).filter(Boolean);
        if (names.length > 0) {
          setCropOptions(Array.from(new Set([...names, 'Winter Wheat'])));
        }
      })
      .catch(() => {
        // Keep fallback crop names cleanly
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const resetForm = () => {
    setName('');
    setDescription('');
    setArea('');
    setAreaUnit(defaultAreaUnit);
    setCountry('');
    setStateRegion('');
    setCity('');
    setLatitude('');
    setLongitude('');
    setFarmType('Row Crop Commercial');
    setOperatingStatus('Active');
    setPrimaryCropSelect(cropOptions[0] || 'Corn (Maize)');
    setCustomCrop('');
    setPreviousCrop('');
    setIrrigationType('Rainfed (Dryland)');
    setPlantingSeason('Spring 2026');
    setHarvestSeason('Autumn 2026');
    setShowOptionalSoil(false);
    setSoilType('');
    setSoilPH('');
    setOrganicMatter('');
    setDrainage('');
    setNitrogen('');
    setPhosphorus('');
    setPotassium('');
    setLastSoilTest('');
    setPriorityMode('default');
    setPriorities(DEFAULT_PRIORITIES);
    setFieldErrors({});
    setSubmitError(null);
  };

  const applyPriorityMode = (mode: 'default' | 'soil_health' | 'drought' | 'custom') => {
    setPriorityMode(mode);
    if (mode === 'default') setPriorities(DEFAULT_PRIORITIES);
    else if (mode === 'soil_health') setPriorities(SOIL_HEALTH_PRESET);
    else if (mode === 'drought') setPriorities(DROUGHT_PRESET);
  };

  const validateClient = (): boolean => {
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Farm name must be at least 2 characters.';

    const parsedArea = Number(area);
    if (!area.trim() || !Number.isFinite(parsedArea) || parsedArea <= 0) {
      errs.area = 'Enter a farm area greater than 0.';
    }

    if (country.trim().length < 2) errs.country = 'Country is required.';
    if (stateRegion.trim().length < 1) errs.state = 'State or province is required.';
    if (city.trim().length < 1) errs.city = 'City or town is required.';

    const latNum = Number(latitude);
    const lonNum = Number(longitude);
    if (latitude.trim() === '' || !Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
      errs.latitude = 'Enter or pick a valid latitude between -90 and 90.';
    }
    if (longitude.trim() === '' || !Number.isFinite(lonNum) || lonNum < -180 || lonNum > 180) {
      errs.longitude = 'Enter or pick a valid longitude between -180 and 180.';
    }

    const effectiveCrop = primaryCropSelect === '__custom__' ? customCrop.trim() : primaryCropSelect.trim();
    if (!effectiveCrop) {
      errs.currentCrop = 'Primary crop is required.';
    }

    if (soilPH.trim() !== '') {
      const ph = Number(soilPH);
      if (!Number.isFinite(ph) || ph < 0 || ph > 14) {
        errs.soilPH = 'Soil pH must be between 0 and 14.';
      }
    }

    if (organicMatter.trim() !== '') {
      const om = Number(organicMatter);
      if (!Number.isFinite(om) || om < 0 || om > 100) {
        errs.organicMatter = 'Organic matter must be between 0% and 100%.';
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    if (!validateClient()) {
      setSubmitError('Please fix the highlighted fields before registering the farm.');
      return;
    }

    const latNum = Number(latitude);
    const lonNum = Number(longitude);
    const parsedArea = Number(area);
    const effectiveCrop = primaryCropSelect === '__custom__' ? customCrop.trim() : primaryCropSelect.trim();
    const composedLocation = [city.trim(), stateRegion.trim(), country.trim()].filter(Boolean).join(', ');

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        country: country.trim(),
        state: stateRegion.trim(),
        city: city.trim(),
        location: composedLocation,
        latitude: latNum,
        longitude: lonNum,
        coordinates: [lonNum, latNum] as [number, number],
        area: parsedArea,
        areaUnit,
        farmType: farmType || null,
        operatingStatus: operatingStatus || 'Active',
        currentCrop: effectiveCrop,
        previousCrop: previousCrop.trim() || null,
        irrigationType: irrigationType || null,
        plantingSeason: plantingSeason.trim() || 'Spring 2026',
        harvestSeason: harvestSeason.trim() || null,
        soilType: soilType.trim() || null,
        soilPH: soilPH.trim() !== '' ? Number(soilPH) : null,
        organicMatter: organicMatter.trim() !== '' ? Number(organicMatter) : null,
        drainage: drainage.trim() || null,
        nitrogen: nitrogen.trim() || null,
        phosphorus: phosphorus.trim() || null,
        potassium: potassium.trim() || null,
        lastSoilTest: lastSoilTest.trim() || null,
        farmerPriorities: priorities,
      };

      const res = await apiClient.post('/api/farms', payload);
      if (res?.success && res?.farm) {
        resetForm();
        onFarmCreated(res.farm);
      } else {
        setSubmitError(res?.error || 'Unexpected response while saving farm property.');
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to register farm right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const parsedAreaNum = Number(area);
  const convertedLabel =
    area.trim() !== '' && Number.isFinite(parsedAreaNum) && parsedAreaNum > 0
      ? areaUnit === 'hectares'
        ? `≈ ${(parsedAreaNum * 2.47105381).toFixed(1)} acres`
        : `≈ ${(parsedAreaNum / 2.47105381).toFixed(1)} hectares`
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-farm-modal-title"
    >
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[94dvh] flex flex-col border border-[#D5E5CA] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 sm:px-7 py-4 bg-[#073D2B] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9BD85A] flex items-center gap-1.5">
              <Tractor className="w-3.5 h-3.5" />
              Operation Registry
            </span>
            <h2 id="add-farm-modal-title" className="font-display text-lg sm:text-xl font-bold text-white">
              Add Farm Property
            </h2>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Close Add Farm modal"
            className="w-10 h-10 rounded-full hover:bg-white/10 text-white flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-6 text-xs">
          {submitError && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs font-medium"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Section A: Basic Information */}
          <section className="space-y-4">
            <div className="border-b border-[#E2E8DE] pb-2 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-[#073D2B]">1. Basic Information</h3>
              <span className="text-[11px] text-[#527367]">* Required fields</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7">
                <label htmlFor="add-farm-name" className="block font-bold text-[#073D2B] mb-1">
                  Farm Property Name *
                </label>
                <input
                  id="add-farm-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: '' }));
                  }}
                  placeholder="e.g., North Creek Loam Field"
                  className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border bg-white text-sm sm:text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] ${
                    fieldErrors.name ? 'border-rose-400' : 'border-[#D5E5CA]'
                  }`}
                />
                {fieldErrors.name && <p className="text-[11px] text-rose-700 mt-1">{fieldErrors.name}</p>}
              </div>

              <div className="md:col-span-5">
                <label htmlFor="add-farm-area" className="block font-bold text-[#073D2B] mb-1">
                  Total Area *
                </label>
                <div className="flex gap-2">
                  <input
                    id="add-farm-area"
                    type="number"
                    required
                    min="0.1"
                    step="0.1"
                    value={area}
                    onChange={(e) => {
                      setArea(e.target.value);
                      if (fieldErrors.area) setFieldErrors((p) => ({ ...p, area: '' }));
                    }}
                    placeholder="e.g., 240"
                    className={`flex-1 min-w-0 min-h-[42px] px-3.5 py-2 rounded-xl border bg-white text-sm sm:text-xs text-[#073D2B] tabular-nums focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] ${
                      fieldErrors.area ? 'border-rose-400' : 'border-[#D5E5CA]'
                    }`}
                  />
                  <div className="inline-flex rounded-xl border border-[#D5E5CA] bg-[#FAFDF8] p-0.5 shrink-0">
                    {(['acres', 'hectares'] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setAreaUnit(u)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold capitalize transition-colors ${
                          areaUnit === u
                            ? 'bg-[#073D2B] text-white'
                            : 'text-[#527367] hover:text-[#073D2B]'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  {fieldErrors.area ? (
                    <p className="text-[11px] text-rose-700">{fieldErrors.area}</p>
                  ) : (
                    <span className="text-[11px] text-[#527367] tabular-nums">
                      {convertedLabel || 'Normalized to acres for strategy modeling'}
                    </span>
                  )}
                </div>
              </div>

              <div className="md:col-span-12">
                <label htmlFor="add-farm-desc" className="block font-bold text-[#073D2B] mb-1">
                  Description / Field Notes <span className="font-normal text-[#527367]">(Optional)</span>
                </label>
                <textarea
                  id="add-farm-desc"
                  rows={2}
                  maxLength={600}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional watershed notes, slope observations, or management history..."
                  className="w-full px-3.5 py-2 rounded-xl border border-[#D5E5CA] bg-white text-sm sm:text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F]"
                />
              </div>
            </div>
          </section>

          {/* Section B: Geographic Information */}
          <section className="space-y-4">
            <div className="border-b border-[#E2E8DE] pb-2 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-[#073D2B] flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#76B93F]" />
                <span>2. Geographic Location &amp; Satellite Coordinates</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="add-farm-country" className="block font-bold text-[#073D2B] mb-1">
                  Country *
                </label>
                <input
                  id="add-farm-country"
                  type="text"
                  required
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    if (fieldErrors.country) setFieldErrors((p) => ({ ...p, country: '' }));
                  }}
                  placeholder="e.g., United States"
                  className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border bg-white text-sm sm:text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] ${
                    fieldErrors.country ? 'border-rose-400' : 'border-[#D5E5CA]'
                  }`}
                />
                {fieldErrors.country && <p className="text-[11px] text-rose-700 mt-1">{fieldErrors.country}</p>}
              </div>

              <div>
                <label htmlFor="add-farm-state" className="block font-bold text-[#073D2B] mb-1">
                  State / Province *
                </label>
                <input
                  id="add-farm-state"
                  type="text"
                  required
                  value={stateRegion}
                  onChange={(e) => {
                    setStateRegion(e.target.value);
                    if (fieldErrors.state) setFieldErrors((p) => ({ ...p, state: '' }));
                  }}
                  placeholder="e.g., Iowa"
                  className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border bg-white text-sm sm:text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] ${
                    fieldErrors.state ? 'border-rose-400' : 'border-[#D5E5CA]'
                  }`}
                />
                {fieldErrors.state && <p className="text-[11px] text-rose-700 mt-1">{fieldErrors.state}</p>}
              </div>

              <div>
                <label htmlFor="add-farm-city" className="block font-bold text-[#073D2B] mb-1">
                  City / Town / County *
                </label>
                <input
                  id="add-farm-city"
                  type="text"
                  required
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    if (fieldErrors.city) setFieldErrors((p) => ({ ...p, city: '' }));
                  }}
                  placeholder="e.g., Boone"
                  className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border bg-white text-sm sm:text-xs text-[#073D2B] focus:outline-hidden focus:ring-2 focus:ring-[#76B93F] ${
                    fieldErrors.city ? 'border-rose-400' : 'border-[#D5E5CA]'
                  }`}
                />
                {fieldErrors.city && <p className="text-[11px] text-rose-700 mt-1">{fieldErrors.city}</p>}
              </div>
            </div>

            <FarmLocationPicker
              latitude={latitude}
              longitude={longitude}
              latError={fieldErrors.latitude}
              lonError={fieldErrors.longitude}
              onChange={(lat, lon) => {
                setLatitude(lat);
                setLongitude(lon);
                if (fieldErrors.latitude || fieldErrors.longitude) {
                  setFieldErrors((p) => ({ ...p, latitude: '', longitude: '' }));
                }
              }}
            />
          </section>

          {/* Section C: Agricultural Information */}
          <section className="space-y-4">
            <div className="border-b border-[#E2E8DE] pb-2 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-[#073D2B] flex items-center gap-1.5">
                <Sprout className="w-4 h-4 text-[#76B93F]" />
                <span>3. Agricultural Profile</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <div>
                <label htmlFor="add-farm-type" className="block font-bold text-[#073D2B] mb-1">
                  Farm Type
                </label>
                <select
                  id="add-farm-type"
                  value={farmType}
                  onChange={(e) => setFarmType(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                >
                  {FARM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="add-farm-status" className="block font-bold text-[#073D2B] mb-1">
                  Operating Status
                </label>
                <select
                  id="add-farm-status"
                  value={operatingStatus}
                  onChange={(e) => setOperatingStatus(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                >
                  {OPERATING_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="add-farm-irrigation" className="block font-bold text-[#073D2B] mb-1">
                  Irrigation Type
                </label>
                <select
                  id="add-farm-irrigation"
                  value={irrigationType}
                  onChange={(e) => setIrrigationType(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                >
                  {IRRIGATION_TYPES.map((ir) => (
                    <option key={ir} value={ir}>
                      {ir}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="add-farm-crop" className="block font-bold text-[#073D2B] mb-1">
                  Primary Crop *
                </label>
                <select
                  id="add-farm-crop"
                  value={primaryCropSelect}
                  onChange={(e) => setPrimaryCropSelect(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                >
                  {cropOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__custom__">Other crop (specify)...</option>
                </select>
                {primaryCropSelect === '__custom__' && (
                  <input
                    type="text"
                    value={customCrop}
                    onChange={(e) => setCustomCrop(e.target.value)}
                    placeholder="Enter crop name"
                    className="mt-2 w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                  />
                )}
                {fieldErrors.currentCrop && <p className="text-[11px] text-rose-700 mt-1">{fieldErrors.currentCrop}</p>}
              </div>

              <div>
                <label htmlFor="add-farm-prev-crop" className="block font-bold text-[#073D2B] mb-1">
                  Previous Crop <span className="font-normal text-[#527367]">(Optional)</span>
                </label>
                <input
                  id="add-farm-prev-crop"
                  type="text"
                  value={previousCrop}
                  onChange={(e) => setPreviousCrop(e.target.value)}
                  placeholder="e.g., Soybeans (2025)"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="add-farm-plant-season" className="block font-bold text-[#073D2B] mb-1">
                    Planting
                  </label>
                  <input
                    id="add-farm-plant-season"
                    type="text"
                    value={plantingSeason}
                    onChange={(e) => setPlantingSeason(e.target.value)}
                    placeholder="Spring 2026"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                  />
                </div>
                <div>
                  <label htmlFor="add-farm-harvest-season" className="block font-bold text-[#073D2B] mb-1">
                    Harvest
                  </label>
                  <input
                    id="add-farm-harvest-season"
                    type="text"
                    value={harvestSeason}
                    onChange={(e) => setHarvestSeason(e.target.value)}
                    placeholder="Autumn 2026"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                  />
                </div>
              </div>
            </div>

            {/* Optional Soil Attributes Drawer (Nullable — no invented values) */}
            <div className="rounded-2xl border border-[#D5E5CA] bg-[#FAFDF8] p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#145C3D] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#073D2B] block">
                      Optional Soil Lab Baseline (Farmer-Provided)
                    </span>
                    <span className="text-[11px] text-[#527367]">
                      Leave blank if untested; FieldShift never fabricates missing pH, organic matter, or nutrient values.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOptionalSoil((v) => !v)}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#D5E5CA] text-[11px] font-bold text-[#073D2B] hover:bg-[#EAF5DF]"
                >
                  {showOptionalSoil ? 'Hide Soil Inputs' : 'Enter Soil Lab Data'}
                </button>
              </div>

              {showOptionalSoil && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#E2E8DE]">
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Soil Texture / Series</label>
                    <input
                      type="text"
                      value={soilType}
                      onChange={(e) => setSoilType(e.target.value)}
                      placeholder="e.g., Silt Loam"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Soil pH (0-14)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="14"
                      value={soilPH}
                      onChange={(e) => setSoilPH(e.target.value)}
                      placeholder="Not provided"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B] tabular-nums"
                    />
                    {fieldErrors.soilPH && <p className="text-[11px] text-rose-700 mt-1">{fieldErrors.soilPH}</p>}
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Organic Matter (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={organicMatter}
                      onChange={(e) => setOrganicMatter(e.target.value)}
                      placeholder="Not provided"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B] tabular-nums"
                    />
                    {fieldErrors.organicMatter && (
                      <p className="text-[11px] text-rose-700 mt-1">{fieldErrors.organicMatter}</p>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Drainage Class</label>
                    <input
                      type="text"
                      value={drainage}
                      onChange={(e) => setDrainage(e.target.value)}
                      placeholder="e.g., Well Drained"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Nitrogen (N)</label>
                    <input
                      type="text"
                      value={nitrogen}
                      onChange={(e) => setNitrogen(e.target.value)}
                      placeholder="e.g., 18 ppm"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Phosphorus (P)</label>
                    <input
                      type="text"
                      value={phosphorus}
                      onChange={(e) => setPhosphorus(e.target.value)}
                      placeholder="e.g., Moderate"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Potassium (K)</label>
                    <input
                      type="text"
                      value={potassium}
                      onChange={(e) => setPotassium(e.target.value)}
                      placeholder="e.g., 160 ppm"
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#073D2B] mb-1">Last Soil Test Date</label>
                    <input
                      type="date"
                      value={lastSoilTest}
                      onChange={(e) => setLastSoilTest(e.target.value)}
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D5E5CA] bg-white text-xs text-[#073D2B]"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Section D: Farmer Priorities Integration */}
          <section className="space-y-3">
            <div className="border-b border-[#E2E8DE] pb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold text-[#073D2B] flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[#76B93F]" />
                <span>4. Farmer Priorities Integration</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'default', label: 'Balanced Defaults' },
                  { id: 'soil_health', label: 'Soil Regeneration' },
                  { id: 'drought', label: 'Water & Drought' },
                  { id: 'custom', label: 'Customize 12 Weights' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => applyPriorityMode(opt.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      priorityMode === opt.id
                        ? 'bg-[#073D2B] text-white'
                        : 'bg-[#FAFDF8] border border-[#D5E5CA] text-[#2A4D3E] hover:bg-[#EAF5DF]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {priorityMode !== 'custom' ? (
              <div className="p-3 rounded-xl bg-[#FAFDF8] border border-[#D5E5CA] text-[11px] text-[#2A4D3E] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#145C3D] shrink-0" />
                <span>
                  Initialized with{' '}
                  <strong>
                    {priorityMode === 'default'
                      ? 'Balanced FieldShift Priorities'
                      : priorityMode === 'soil_health'
                      ? 'Soil Regeneration Preset'
                      : 'Water & Drought Defense Preset'}
                  </strong>
                  . You can adjust any of the 12 weights after creation in the Priorities Engine.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-[#FAFDF8] border border-[#D5E5CA]">
                {PRIORITY_LABELS.map((item) => (
                  <div key={item.key} className="bg-white p-2.5 rounded-xl border border-[#E2E8DE] space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#073D2B]">{item.label}</span>
                      <span className="font-mono font-bold text-[#145C3D] tabular-nums">
                        {priorities[item.key]}/5
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      value={priorities[item.key]}
                      onChange={(e) =>
                        setPriorities((prev) => ({ ...prev, [item.key]: Number(e.target.value) }))
                      }
                      className="w-full accent-[#073D2B] cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#E2E8DE] flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 sticky bottom-0 bg-white pb-1">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="min-h-[44px] px-5 py-2.5 rounded-full border border-[#D5E5CA] text-[#527367] hover:bg-[#FAFDF8] text-xs font-bold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] px-6 py-2.5 rounded-full bg-[#073D2B] hover:bg-[#145C3D] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
            >
              <Plus className="w-4 h-4 text-[#76B93F]" />
              <span>{submitting ? 'Registering Farm Property...' : 'Create Farm Property'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
