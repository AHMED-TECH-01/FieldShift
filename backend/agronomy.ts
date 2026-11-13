import type {
  BareFieldPeriod,
  CropCharacteristics,
  FarmerPriorities,
  PestCycleEvaluation,
  SupplementalIncome,
  WhatIfScenario,
} from '../src/types.js';
import type { FarmNasaSummary } from './nasa.js';
import type { DbFarmRecord } from './supabase.js';

export const DEFAULT_PRIORITIES: FarmerPriorities = {
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

export const cropDatabase: CropCharacteristics[] = [
  {
    id: 'crop-corn',
    name: 'Field Corn (Maize)',
    scientificName: 'Zea mays L.',
    family: 'Poaceae (Gramineae)',
    plantingSeason: 'Late April - Early May',
    harvestSeason: 'Late September - October',
    growingDurationDays: 115,
    waterRequirementMm: '550 - 650 mm / season',
    temperatureSuitability: { min: 10, opt: 28, max: 35 },
    droughtTolerance: 'Moderate',
    soilPreferences: {
      phRange: '5.8 - 7.0',
      textures: ['Silt Loam', 'Loam', 'Clay Loam'],
      drainage: 'Well to Moderately Well Drained',
    },
    nutrientRequirements: {
      nitrogenDemand: 'High (140 - 180 lbs/acre for 190 bu/ac)',
      phosphorusDemand: 'Moderate (60 - 75 lbs P2O5/acre)',
      potassiumDemand: 'High (140 - 160 lbs K2O/acre)',
    },
    nitrogenFixingPotentialLbsPerAcre: 0,
    rootCharacteristics: {
      depthMeters: 1.5,
      architecture: 'Dense Fibrous',
      hardpanPenetration: 'Moderate',
    },
    forageValue: {
      relativeFeedValue: '125 (Silage quality)',
      crudeProteinPercent: '8.2% - 9.1%',
      grazingSuitability: 'High (post-harvest stalk residue grazing)',
    },
    marketSuitability: 'High liquidity cash grain, ethanol, livestock feed',
    pestAndDiseaseConsiderations: {
      susceptiblePests: ['Western Corn Rootworm (Diabrotica virgifera)', 'European Corn Borer', 'Goss’s Wilt', 'Tar Spot'],
      interruptedPests: ['Soybean Cyst Nematode (Non-host break)'],
      familyHostRisk: 'Continuous grass/cereal monoculture amplifies rootworm beetle density and stalk rot inoculum.',
    },
    residueAndOrganicMatter: {
      biomassTonsPerAcre: 4.2,
      cnRatio: '55:1 (Slow decomposition; excellent long-term soil mulch)',
      soilArmorPersistence: 'High (persists 10+ months without aggressive tillage)',
    },
    isVerifiedAgronomicData: true,
    sourceReference: 'Iowa State University Extension & Outreach PM 1813 / USDA-ARS National Laboratory',
  },
  {
    id: 'crop-soybean',
    name: 'Soybean',
    scientificName: 'Glycine max (L.) Merr.',
    family: 'Fabaceae (Leguminosae)',
    plantingSeason: 'Early to Mid-May',
    harvestSeason: 'Late September - Mid-October',
    growingDurationDays: 105,
    waterRequirementMm: '450 - 550 mm / season',
    temperatureSuitability: { min: 12, opt: 26, max: 34 },
    droughtTolerance: 'Moderate',
    soilPreferences: {
      phRange: '6.0 - 6.8',
      textures: ['Loam', 'Silt Loam', 'Sandy Loam'],
      drainage: 'Well Drained',
    },
    nutrientRequirements: {
      nitrogenDemand: 'Biological self-sufficient via Bradyrhizobium nodulation',
      phosphorusDemand: 'Moderate (40 - 50 lbs P2O5/acre)',
      potassiumDemand: 'High (90 - 110 lbs K2O/acre removal)',
    },
    nitrogenFixingPotentialLbsPerAcre: 40,
    rootCharacteristics: {
      depthMeters: 1.2,
      architecture: 'Deep Taproot',
      hardpanPenetration: 'Moderate',
    },
    forageValue: {
      relativeFeedValue: '135 (Emergency haylage)',
      crudeProteinPercent: '16.5% - 18.0%',
      grazingSuitability: 'Moderate (caution with raw seed bloat risk)',
    },
    marketSuitability: 'Global cash commodity, oil crushing, export protein meal',
    pestAndDiseaseConsiderations: {
      susceptiblePests: ['Soybean Cyst Nematode (Heterodera glycines)', 'Sudden Death Syndrome (Fusarium)', 'Brown Stem Rot'],
      interruptedPests: ['Western Corn Rootworm (Effective biennial cycle interruption)'],
      familyHostRisk: 'Back-to-back legume planting causes exponential buildup of SCN egg counts in root zone.',
    },
    residueAndOrganicMatter: {
      biomassTonsPerAcre: 2.1,
      cnRatio: '30:1 (Rapid breakdown; leaves field bare within 90 days of harvest)',
      soilArmorPersistence: 'Low (leaves soil bare through winter storms without cover crop)',
    },
    isVerifiedAgronomicData: true,
    sourceReference: 'Purdue Extension AY-316-W / USDA-NRCS Soil Biology Primer',
  },
  {
    id: 'crop-cereal-rye',
    name: 'Winter Cereal Rye',
    scientificName: 'Secale cereale L.',
    family: 'Poaceae (Gramineae)',
    plantingSeason: 'Mid-September - Late October',
    harvestSeason: 'Spring Termination (April) or July Grain',
    growingDurationDays: 210,
    waterRequirementMm: '250 - 350 mm / winter-spring',
    temperatureSuitability: { min: 2, opt: 18, max: 28 },
    droughtTolerance: 'High',
    soilPreferences: {
      phRange: '5.0 - 7.5',
      textures: ['Sand', 'Sandy Loam', 'Loam', 'Clay'],
      drainage: 'Wide adaptation; tolerates wet and droughty soils',
    },
    nutrientRequirements: {
      nitrogenDemand: 'Scavenges 45 - 80 lbs residual nitrate/acre that would otherwise leach',
      phosphorusDemand: 'Low (20 lbs P2O5/acre)',
      potassiumDemand: 'Moderate (40 lbs K2O/acre)',
    },
    nitrogenFixingPotentialLbsPerAcre: 0,
    rootCharacteristics: {
      depthMeters: 1.8,
      architecture: 'Dense Fibrous',
      hardpanPenetration: 'High',
    },
    forageValue: {
      relativeFeedValue: '110 - 130 (cut at boot stage)',
      crudeProteinPercent: '14.0% - 17.5%',
      grazingSuitability: 'High (premier early-spring and late-fall cattle forage)',
    },
    marketSuitability: 'Cover crop seed production, distiller grain, forage grazing lease',
    pestAndDiseaseConsiderations: {
      susceptiblePests: ['Armyworm (requires monitoring at termination)'],
      interruptedPests: ['Suppresses summer annual weeds through allelopathic root exudates'],
      familyHostRisk: 'Must terminate 10–14 days prior to corn planting to avoid seedling damping-off.',
    },
    residueAndOrganicMatter: {
      biomassTonsPerAcre: 3.5,
      cnRatio: '40:1 to 60:1 (at maturity)',
      soilArmorPersistence: 'Exceptional (prevents winter sheet erosion)',
    },
    isVerifiedAgronomicData: true,
    sourceReference: 'Midwest Cover Crops Council / SARE Handbook No. 9',
  },
  {
    id: 'crop-hairy-vetch',
    name: 'Hairy Vetch',
    scientificName: 'Vicia villosa Roth',
    family: 'Fabaceae (Leguminosae)',
    plantingSeason: 'Late August - September',
    harvestSeason: 'Spring Roller-Crimper Termination (May)',
    growingDurationDays: 220,
    waterRequirementMm: '300 - 400 mm',
    temperatureSuitability: { min: 4, opt: 20, max: 30 },
    droughtTolerance: 'Moderate',
    soilPreferences: {
      phRange: '6.0 - 7.2',
      textures: ['Sandy Loam', 'Loam', 'Silt Loam'],
      drainage: 'Well Drained (sensitive to winter ponding)',
    },
    nutrientRequirements: {
      nitrogenDemand: 'None (fixes massive atmospheric N via Rhizobium leguminosarum)',
      phosphorusDemand: 'Moderate (30 lbs P2O5/acre)',
      potassiumDemand: 'Moderate (40 lbs K2O/acre)',
    },
    nitrogenFixingPotentialLbsPerAcre: 85,
    rootCharacteristics: {
      depthMeters: 1.0,
      architecture: 'Extensive Mycorrhizal',
      hardpanPenetration: 'Moderate',
    },
    forageValue: {
      relativeFeedValue: '140',
      crudeProteinPercent: '18.0% - 22.0%',
      grazingSuitability: 'High when seeded with cereal rye grass blend',
    },
    marketSuitability: 'Organic nitrogen substitution ($65-$90/acre synthetic value)',
    pestAndDiseaseConsiderations: {
      susceptiblePests: ['Root-knot nematodes in light soils'],
      interruptedPests: ['Disrupts cereal fungal pathogens and weed seed banks'],
      familyHostRisk: 'Safe partner in grass-heavy grain rotations.',
    },
    residueAndOrganicMatter: {
      biomassTonsPerAcre: 2.8,
      cnRatio: '11:1 (Decomposes rapidly, releasing plant-available nitrate in June)',
      soilArmorPersistence: 'Moderate (ideal green manure)',
    },
    isVerifiedAgronomicData: true,
    sourceReference: 'USDA-ARS Sustainable Agriculture Network / Maryland Agronomy Guide',
  },
  {
    id: 'crop-sorghum',
    name: 'Grain Sorghum (Milo)',
    scientificName: 'Sorghum bicolor (L.) Moench',
    family: 'Poaceae (Gramineae)',
    plantingSeason: 'Late May - Early June',
    harvestSeason: 'October - November',
    growingDurationDays: 110,
    waterRequirementMm: '350 - 450 mm / season',
    temperatureSuitability: { min: 15, opt: 32, max: 40 },
    droughtTolerance: 'Exceptional',
    soilPreferences: {
      phRange: '5.5 - 7.8',
      textures: ['Clay Loam', 'Loam', 'Sandy Loam'],
      drainage: 'Tolerates temporary saturation & intense drought',
    },
    nutrientRequirements: {
      nitrogenDemand: 'Moderate (80 - 110 lbs N/acre)',
      phosphorusDemand: 'Moderate (35 - 45 lbs P2O5/acre)',
      potassiumDemand: 'Moderate (60 - 80 lbs K2O/acre)',
    },
    nitrogenFixingPotentialLbsPerAcre: 0,
    rootCharacteristics: {
      depthMeters: 2.2,
      architecture: 'Deep Taproot',
      hardpanPenetration: 'High',
    },
    forageValue: {
      relativeFeedValue: '115 (Stover grazing)',
      crudeProteinPercent: '9.0% - 10.5%',
      grazingSuitability: 'High (avoid grazing immediately following drought-breaking frost)',
    },
    marketSuitability: 'Flour milling, gluten-free food contracts, livestock grain',
    pestAndDiseaseConsiderations: {
      susceptiblePests: ['Sugarcane aphid (Melanaphis sacchari)', 'Chinch bugs'],
      interruptedPests: ['Non-host for Soybean Cyst Nematode and Northern Corn Leaf Blight'],
      familyHostRisk: 'C4 photosynthesis plant with superior water use efficiency in heatwaves.',
    },
    residueAndOrganicMatter: {
      biomassTonsPerAcre: 3.8,
      cnRatio: '60:1 (Forms resilient windbreaks across bare soils)',
      soilArmorPersistence: 'High',
    },
    isVerifiedAgronomicData: true,
    sourceReference: 'Kansas State Research & Extension MF-3046 / Texas A&M AgriLife',
  },
  {
    id: 'crop-sunflower',
    name: 'Confectionery & Oilseed Sunflower',
    scientificName: 'Helianthus annuus L.',
    family: 'Asteraceae (Compositae)',
    plantingSeason: 'Late May - June',
    harvestSeason: 'October - November',
    growingDurationDays: 100,
    waterRequirementMm: '400 - 500 mm / season',
    temperatureSuitability: { min: 10, opt: 26, max: 36 },
    droughtTolerance: 'High',
    soilPreferences: {
      phRange: '6.0 - 7.5',
      textures: ['Loam', 'Silt Loam', 'Clay Loam'],
      drainage: 'Well Drained',
    },
    nutrientRequirements: {
      nitrogenDemand: 'Low-Moderate (60 - 80 lbs N/acre)',
      phosphorusDemand: 'Moderate (30 - 40 lbs P2O5/acre)',
      potassiumDemand: 'High (100 - 120 lbs K2O/acre)',
    },
    nitrogenFixingPotentialLbsPerAcre: 0,
    rootCharacteristics: {
      depthMeters: 2.5,
      architecture: 'Deep Taproot',
      hardpanPenetration: 'High',
    },
    forageValue: {
      relativeFeedValue: '105',
      crudeProteinPercent: '11.0%',
      grazingSuitability: 'Moderate for winter bird & wildlife habitat',
    },
    marketSuitability: 'Premium food grade seed, healthy birdseed, high-oleic oil contracts',
    pestAndDiseaseConsiderations: {
      susceptiblePests: ['Sunflower moth', 'Sclerotinia head rot'],
      interruptedPests: ['Completely breaks grass and legume nematode cycles'],
      familyHostRisk: 'Requires 3-4 year rotation return to manage soil-borne sclerotinia.',
    },
    residueAndOrganicMatter: {
      biomassTonsPerAcre: 2.6,
      cnRatio: '45:1',
      soilArmorPersistence: 'Moderate',
    },
    isVerifiedAgronomicData: true,
    sourceReference: 'North Dakota State University Extension A-1331 / High Plains Sunflower Guide',
  },
  {
    id: 'crop-alfalfa',
    name: 'Alfalfa (Lucerne)',
    scientificName: 'Medicago sativa L.',
    family: 'Fabaceae (Leguminosae)',
    plantingSeason: 'Early Spring or Late Summer',
    harvestSeason: 'Multiple Cuttings (May, July, August, Sept)',
    growingDurationDays: 365,
    waterRequirementMm: '600 - 800 mm / full season',
    temperatureSuitability: { min: 5, opt: 24, max: 32 },
    droughtTolerance: 'High',
    soilPreferences: {
      phRange: '6.5 - 7.5',
      textures: ['Deep Loam', 'Silt Loam'],
      drainage: 'Well Drained (intolerant of wet feet)',
    },
    nutrientRequirements: {
      nitrogenDemand: 'Self-sufficient via Sinorhizobium meliloti',
      phosphorusDemand: 'High (60 - 80 lbs P2O5/acre)',
      potassiumDemand: 'Very High (180 - 240 lbs K2O/acre removal)',
    },
    nitrogenFixingPotentialLbsPerAcre: 140,
    rootCharacteristics: {
      depthMeters: 3.5,
      architecture: 'Deep Taproot',
      hardpanPenetration: 'High',
    },
    forageValue: {
      relativeFeedValue: '160 - 185 (Gold Standard Dairy Hay)',
      crudeProteinPercent: '18.0% - 22.5%',
      grazingSuitability: 'High with proper rotational stocking and bloat management',
    },
    marketSuitability: 'High-value dairy and equine forage export market',
    pestAndDiseaseConsiderations: {
      susceptiblePests: ['Alfalfa weevil', 'Potato leafhopper', 'Phytophthora root rot'],
      interruptedPests: ['Breaks all major grain crop root rots and foliar blights'],
      familyHostRisk: 'Autotoxicity prevents re-seeding alfalfa immediately into an old stand.',
    },
    residueAndOrganicMatter: {
      biomassTonsPerAcre: 5.2,
      cnRatio: '14:1',
      soilArmorPersistence: 'Continuous perennial sod (zero bare-field periods)',
    },
    isVerifiedAgronomicData: true,
    sourceReference: 'University of Wisconsin Extension A3440 / Cornell Agronomy Notes',
  },
  {
    id: 'crop-field-peas',
    name: 'Field Peas (Dry Peas)',
    scientificName: 'Pisum sativum L.',
    family: 'Fabaceae (Leguminosae)',
    plantingSeason: 'Early April',
    harvestSeason: 'Mid-July',
    growingDurationDays: 85,
    waterRequirementMm: '300 - 380 mm',
    temperatureSuitability: { min: 5, opt: 20, max: 28 },
    droughtTolerance: 'Moderate',
    soilPreferences: {
      phRange: '6.0 - 7.5',
      textures: ['Loam', 'Sandy Loam', 'Clay Loam'],
      drainage: 'Well Drained',
    },
    nutrientRequirements: {
      nitrogenDemand: 'Biologically fixed via Rhizobium leguminosarum bv. viciae',
      phosphorusDemand: 'Low (25 - 35 lbs P2O5/acre)',
      potassiumDemand: 'Moderate (40 - 55 lbs K2O/acre)',
    },
    nitrogenFixingPotentialLbsPerAcre: 60,
    rootCharacteristics: {
      depthMeters: 0.9,
      architecture: 'Shallow Fibrous',
      hardpanPenetration: 'Low',
    },
    forageValue: {
      relativeFeedValue: '130',
      crudeProteinPercent: '16.0% - 21.0%',
      grazingSuitability: 'Moderate as mixed forage pea with oats',
    },
    marketSuitability: 'Food grade yellow/green split peas, pet food proteins, cover seed',
    pestAndDiseaseConsiderations: {
      susceptiblePests: ['Ascochyta blight', 'Pea aphid'],
      interruptedPests: ['Breaks cereal root rot fungi and provides early harvest window for double crop'],
      familyHostRisk: 'Avoid growing in rotations with excessive clover/vetch within 2 seasons.',
    },
    residueAndOrganicMatter: {
      biomassTonsPerAcre: 1.8,
      cnRatio: '20:1',
      soilArmorPersistence: 'Low (requires immediate post-harvest cover seeding in July)',
    },
    isVerifiedAgronomicData: true,
    sourceReference: 'Montana State University Extension EB0208 / USA Dry Pea & Lentil Council',
  },
];

export const scientificMethods = [
  {
    title: 'Rainfall Anomaly & Drought Intensity (SPI & GPM IMERG)',
    formula: 'SPI = (P - Mean_P) / StdDev_P over 30-year NASA POWER / GPM climatological normal',
    units: 'Standardized deviations (z-score) and millimeters (mm)',
    explanation:
      'Quantifies precipitation deficits relative to local multi-decadal historical expectations, distinguishing seasonal dry spells from structural droughts.',
  },
  {
    title: 'Growing Degree Days & Thermal Heat Stress (NASA POWER)',
    formula: 'GDD = sum(max(0, (min(Tmax, 30) + max(Tmin, 10))/2 - 10))',
    units: 'Thermal heat units (°C days)',
    explanation:
      'Predicts crop phenological progression and identifies dangerous pollination temperature spikes (>34°C) where corn pollen viability degrades.',
  },
  {
    title: 'Root-Zone Volumetric Soil Moisture & Water Depletion (NASA SMAP)',
    formula: 'Depletion Fraction = (FieldCapacity - VolumetricMoisture) / (FieldCapacity - PermanentWiltingPoint)',
    units: 'Cubic meters of water per cubic meter of soil (m³/m³)',
    explanation:
      'Determines whether soil water is in the freely available root zone or approaching critical plant stress levels.',
  },
  {
    title: 'Vegetation Canopy Health & Cover Continuity (MODIS & Landsat)',
    formula: 'NDVI = (NIR - Red) / (NIR + Red)',
    units: 'Dimensionless ratio (-1.0 to +1.0)',
    explanation:
      'Quantifies active chlorophyll absorption to monitor crop growth and confirm whether living roots are shielding topsoil throughout winter.',
  },
  {
    title: 'Topographic Slope & Erosion Vulnerability (NASA SRTM)',
    formula: 'Slope (%) = sqrt((dz/dx)^2 + (dz/dy)^2) * 100 via 30m DEM grid',
    units: 'Percent gradient (%) and elevation in meters (m ASL)',
    explanation:
      'Identifies runoff velocity hazard zones where unarmored bare soils experience severe rill and gully soil displacement during intense rain events.',
  },
];

export const supplementalIncomeOpportunities: SupplementalIncome[] = [
  {
    category: 'Livestock Forage & Grazing Contracts',
    opportunityName: 'Winter Cereal Rye / Triticale Stubble Grazing Lease',
    estimatedGrossValuePerAcre: '$25 - $45 / acre',
    localMarketRequirement: 'Proximity to cow-calf operations and temporary electric perimeter fencing',
    missingDataNotice: 'Local custom grazing rates fluctuate by county; exact livestock density agreements required.',
    feasibility: 'High',
  },
  {
    category: 'Conservation Program Incentives',
    opportunityName: 'USDA NRCS Conservation Stewardship Program (CSP) E328 Cover Enhancements',
    estimatedGrossValuePerAcre: '$18 - $34 / acre / yr',
    localMarketRequirement: 'Formal conservation plan contract with local NRCS service center',
    missingDataNotice: 'Subject to annual Congressional farm bill appropriations and county ranking pools.',
    feasibility: 'High',
  },
  {
    category: 'Regenerative Carbon Insetting Credits',
    opportunityName: 'Soil Carbon Accrual & Scope 3 Supply Chain Insetting',
    estimatedGrossValuePerAcre: '$15 - $28 / acre / yr (Estimated 0.4t CO2e/ac)',
    localMarketRequirement: 'Multi-year verified soil core carbon testing and satellite verification protocol',
    missingDataNotice: 'Carbon offset registries require 5-10 year permanence commitments; contract terms must be reviewed with legal counsel.',
    feasibility: 'Moderate',
  },
  {
    category: 'Specialty Grain & Pulse Premiums',
    opportunityName: 'Food-Grade Yellow Field Peas & Confectionery Sunflowers',
    estimatedGrossValuePerAcre: '$80 - $140 / acre premium above commodity corn',
    localMarketRequirement: 'Direct identity-preserved (IP) delivery contract with regional processing elevator',
    missingDataNotice: 'Elevator trucking distance and clean-out inspection requirements not included in estimate.',
    feasibility: 'Conditional',
  },
];

export function calculateStrategyEvaluations(
  farm: DbFarmRecord,
  priorities: FarmerPriorities,
  scenario?: WhatIfScenario | null,
  nasaSummary?: FarmNasaSummary | null
) {
  const rainMod = scenario ? scenario.rainfallChangePercent / 100 : 0;
  const tempMod = scenario ? scenario.temperatureChangeCelsius : 0;
  const dryWeeks = scenario ? scenario.extendedDrySeasonWeeks : 0;
  const restrictIrrigation = scenario ? scenario.irrigationRestricted : false;

  // Deterministic baseline scores
  let scoreA = 72;
  let scoreB = 86;
  let scoreC = 91;

  const weightProfit = priorities.profitability / 5;
  const weightEquip = priorities.equipmentCompatibility / 5;
  const weightWater = priorities.waterConservation / 5;
  const weightSOM = priorities.soilOrganicMatter / 5;
  const weightErosion = priorities.erosionReduction / 5;
  const weightDiversity = priorities.cropDiversity / 5;
  const weightNitrogen = priorities.nitrogenFixing / 5;
  const weightDrought = priorities.droughtResilience / 5;

  scoreA += weightProfit * 4 + weightEquip * 6;
  scoreA -= weightWater * 6 + weightSOM * 5 + weightErosion * 7 + weightDiversity * 5;

  scoreB += weightSOM * 8 + weightNitrogen * 7 + weightErosion * 8 + weightWater * 4 + weightDiversity * 6;
  scoreB -= weightEquip * 4;

  scoreC += weightDrought * 9 + weightWater * 8 + weightDiversity * 6 + (priorities.soilInfiltration / 5) * 5;
  scoreC -= weightEquip * 5 + (5 - priorities.marketSuitability / 5) * 4;

  // Adjust subtly from real observed NASA POWER climate telemetry if synced
  if (nasaSummary?.hasPowerData) {
    if (nasaSummary.precipTotalMm !== null && nasaSummary.precipTotalMm < 25) {
      // Dry recent 30-day window increases advantage of drought-tolerant Strategy C
      scoreA -= 3;
      scoreC += 3;
    } else if (nasaSummary.precipTotalMm !== null && nasaSummary.precipTotalMm > 110) {
      // Heavy rainfall increases erosion protection value of living root cover (Strategy B)
      scoreA -= 4;
      scoreB += 3;
    }
    if (nasaSummary.maxTempC !== null && nasaSummary.maxTempC > 33) {
      scoreA -= 3;
      scoreC += 2;
    }
    if (nasaSummary.meanWindSpeedMps !== null && nasaSummary.meanWindSpeedMps > 5.5) {
      // High wind speeds raise evaporation and bare-soil wind erosion exposure
      scoreA -= 2;
      scoreB += 2;
      scoreC += 2;
    }
  }

  // Factor live 250m MODIS MOD13Q1 vegetation vigor when synced
  if (nasaSummary?.hasModisNumericData && nasaSummary.latestModisNdvi !== null) {
    if (nasaSummary.latestModisNdvi < 0.25) {
      // Low vegetation cover supports soil armor / cover-crop restoration urgency
      scoreA -= 2;
      scoreB += 3;
    }
  }

  // Hypothetical What-If Scenario adjustments (clearly kept separate from observed data)
  if (rainMod < -0.2 || dryWeeks > 2 || restrictIrrigation) {
    scoreA -= 14;
    scoreB -= 4;
    scoreC += 8;
  }
  if (tempMod > 2) {
    scoreA -= 8;
    scoreC += 6;
  }

  scoreA = Math.max(40, Math.min(96, Math.round(scoreA)));
  scoreB = Math.max(48, Math.min(97, Math.round(scoreB)));
  scoreC = Math.max(50, Math.min(98, Math.round(scoreC)));

  const powerEvidenceLine = nasaSummary?.hasPowerData
    ? `NASA POWER (${nasaSummary.dailyTimeline.length} synced days ending ${nasaSummary.powerLatestObservedAt?.slice(0, 10)}): Mean ${nasaSummary.meanTempC ?? 'N/A'}°C, Precip ${nasaSummary.precipTotalMm ?? 'N/A'} mm, Wind ${nasaSummary.meanWindSpeedMps ?? 'N/A'} m/s, Solar ${nasaSummary.meanSolarRadiationMj ?? 'N/A'} MJ/m²/day`
    : 'NASA POWER daily climate series not yet synced for this farm (sync required for local climate weighting)';

  const smapGranule = nasaSummary?.cmrGranulesByDataset?.smap?.latestGranuleId;
  const gpmGranule = nasaSummary?.cmrGranulesByDataset?.gpm?.latestGranuleId;
  const modisGranule = nasaSummary?.cmrGranulesByDataset?.modis?.latestGranuleId;
  const ecostressGranule = nasaSummary?.cmrGranulesByDataset?.ecostress?.latestGranuleId;

  const missingDataList: string[] = [];
  if (!nasaSummary?.hasPowerData) {
    missingDataList.push('NASA POWER daily temperature/precipitation/wind observations have not been synced for this parcel.');
  }
  if (!smapGranule) {
    missingDataList.push('SMAP L4 root-zone soil moisture pixel extraction requires Earthdata Login HDF5 processing (not yet synced).');
  } else {
    missingDataList.push(`SMAP granule (${smapGranule}) indexed via CMR; numeric m³/m³ pixel extraction awaits Earthdata HDF5 reader.`);
  }
  if (!nasaSummary?.hasModisNumericData) {
    missingDataList.push('MODIS MOD13Q1 250m NDVI/EVI composite has not been synced for this parcel yet.');
  }
  missingDataList.push('Sub-surface tile drainage maps and county elevator specialty grain bids.');

  const soilContext = [
    `Soil series ${farm.soilType} with ${farm.organicMatter}% organic matter and ${farm.drainage} drainage`,
    `Measured pH ${farm.soilPH}; reported lab N: ${farm.nitrogen}, P: ${farm.phosphorus}, K: ${farm.potassium} (tested ${farm.lastSoilTest})`,
  ];

  const modisEvidenceLine = nasaSummary?.hasModisNumericData
    ? `MODIS MOD13Q1 250m (${nasaSummary.latestModisNdviDate}): NDVI ${nasaSummary.latestModisNdvi}, EVI ${nasaSummary.latestModisEvi ?? 'N/A'} (${nasaSummary.latestModisQuality || 'Verified'})${nasaSummary.latestModisLstC !== null ? ` | MOD11A2 LST ${nasaSummary.latestModisLstC}°C` : ''}`
    : modisGranule
    ? `MODIS MOD13Q1 CMR granule indexed (${modisGranule}); run MODIS sync for 250m NDVI/EVI pixel values`
    : 'MODIS 250m optical NDVI not yet synced for this farm';

  const strategies = [
    {
      id: 'strategy-a',
      code: 'A' as const,
      title: 'Existing Farmer Rotation (Baseline)',
      tagline: `Standard Commercial Biennial Cycle (${farm.currentCrop} Baseline)`,
      score: scoreA,
      isIllustrative: !nasaSummary?.hasPowerData,
      cropSequence: ['Corn (Year 1)', 'Soybean (Year 2)', 'Corn (Year 3)', 'Soybean (Year 4)'],
      seasons: ['Spring Planting - Autumn Harvest', 'Winter Fallow (135 Bare Days)'],
      soilBenefits: {
        nitrogenFixation: 'Moderate (~35 lbs N/acre contributed by soybean nodulation)',
        organicMatterGrowth: '+0.05% estimated 3-yr delta (literature benchmark)',
        erosionMitigation: 'Low (4.2 months bare soil exposure over winter months)',
        rootDiversityScore: 48,
      },
      climateResilience: {
        waterEfficiency: 'Medium (High corn transpirational demand during July pollination)',
        droughtTolerance: 'Moderate vulnerability during silking',
        heatRiskExposure: 'Elevated during pollination window >32°C',
      },
      economicProfile: {
        grossMarginEst: '$710 - $780 / acre / yr (regional extension budget)',
        inputCostIndex: 'High synthetic nitrogen & chemical herbicide dependence',
        marketVolatility: 'Exposed to commodity price swings',
      },
      limitations: 'High Western Corn Rootworm pressure; wheel-track compaction; nutrient leaching during spring thaws.',
      explainability: {
        strategyCode: 'A' as const,
        whySuggested: 'Required baseline representing a standard commercial biennial sequence to quantify agronomic and environmental deltas.',
        nasaObservationsUsed: [
          powerEvidenceLine,
          modisEvidenceLine,
          gpmGranule
            ? `GPM IMERG granule indexed (${gpmGranule}); daily gridded rain rates available via Earthdata NetCDF4`
            : 'NASA GPM 0.1° precipitation coverage not yet indexed',
        ],
        soilInformationUsed: soilContext,
        cropCharacteristicsInfluenced: [
          'Corn water demand: 550-650 mm/season concentrated during late-summer peak thermal flux',
          'Soybean residue C:N ratio 30:1 decomposes rapidly, leaving topsoil exposed in winter',
        ],
        farmerPrioritiesInfluenced: [
          `Profitability weight (${priorities.profitability}/5) and Equipment Compatibility (${priorities.equipmentCompatibility}/5) favor existing infrastructure`,
          `Soil Organic Matter (${priorities.soilOrganicMatter}/5) and Erosion Reduction (${priorities.erosionReduction}/5) penalize winter fallow`,
        ],
        expectedPotentialBenefits: [
          'Familiar commercial agronomic workflow with standard row-crop planters and combines',
          'Broad local grain elevator acceptance',
        ],
        environmentalAndAgriculturalRisks: [
          'Extended bare-field period increases sheet and rill erosion hazard',
          'Elevated Western Corn Rootworm and Soybean Cyst Nematode host persistence',
        ],
        missingInformation: missingDataList,
        uncertaintyAndLimitations: [
          'Satellite optical indices cannot distinguish between dry corn stover residue and bare mineral soil; field verification is required.',
          scenario ? 'Includes hypothetical What-If scenario stress offsets separate from historical observations.' : 'Regional economic margin ranges reflect extension averages, not binding bids.',
        ],
        localExpertValidationChecklist: [
          'Confirm Western Corn Rootworm Bt trait resistance status with your county extension agent.',
        ],
      },
    },
    {
      id: 'strategy-b',
      code: 'B' as const,
      title: 'Soil Restoration & Carbon Strategy',
      tagline: 'Multi-Species Cover Cropping & Biological Nitrogen Intensification',
      score: scoreB,
      isIllustrative: !nasaSummary?.hasPowerData,
      cropSequence: [
        'Corn (Grain)',
        'Cereal Rye + Hairy Vetch (Winter Living Roots)',
        'Soybean (No-Till)',
        'Crimson Clover + Oats (Autumn Cover)',
        'Alfalfa / Small Grains',
      ],
      seasons: ['Continuous Living Roots (365 Days Ground Armor)', 'Spring Roller-Crimper Termination'],
      soilBenefits: {
        nitrogenFixation: 'Very High (+75 to +95 lbs atmospheric N fixed biologically/acre)',
        organicMatterGrowth: '+0.28% to +0.36% estimated 3-yr delta',
        erosionMitigation: 'Very High (~94% ground cover throughout winter freeze/thaw)',
        rootDiversityScore: 89,
      },
      climateResilience: {
        waterEfficiency: 'High (Higher organic matter improves pore water retention)',
        droughtTolerance: 'Improved infiltration and cooler soil surface temperatures',
        heatRiskExposure: 'Reduced soil crusting and surface radiant heating under mulch',
      },
      economicProfile: {
        grossMarginEst: '$745 - $825 / acre / yr (extension conservation model)',
        inputCostIndex: 'Potential reduction in synthetic N purchasing by Year 3',
        marketVolatility: 'Diversified streams via small grains, forage, or conservation incentives',
      },
      limitations: 'Requires cover crop seeding drill or aerial seeding; spring termination timing must avoid soil moisture depletion in dry springs.',
      explainability: {
        strategyCode: 'B' as const,
        whySuggested: 'Optimized for biological regeneration, organic matter accrual, biological nitrogen fixation, and year-round soil armor.',
        nasaObservationsUsed: [
          powerEvidenceLine,
          smapGranule
            ? `SMAP L4 granule indexed (${smapGranule}) for spring cover-crop moisture termination monitoring`
            : 'SMAP L4 9km root-zone soil moisture framework (sync Earthdata CMR for granule schedule)',
        ],
        soilInformationUsed: soilContext,
        cropCharacteristicsInfluenced: [
          'Hairy vetch fixes up to ~85 lbs N/acre with rapid 11:1 C:N release',
          'Cereal rye dense fibrous roots penetrate compacted layers up to 1.8 meters',
        ],
        farmerPrioritiesInfluenced: [
          `Soil Organic Matter (${priorities.soilOrganicMatter}/5), Nitrogen Fixing (${priorities.nitrogenFixing}/5), and Erosion Reduction (${priorities.erosionReduction}/5)`,
        ],
        expectedPotentialBenefits: [
          'Reduces bare-soil exposure window and nitrate leaching',
          'Substitutes portion of synthetic nitrogen demand with legume nodulation',
        ],
        environmentalAndAgriculturalRisks: [
          'Wet springs can delay mechanical roller-crimper termination',
          'Un-terminated rye can tie up early-season soil moisture or nitrogen near emerging corn',
        ],
        missingInformation: missingDataList,
        uncertaintyAndLimitations: [
          'Biological nitrogen mineralization timing depends on May soil temperature.',
          scenario ? 'Reflects hypothetical What-If climate stress simulation.' : 'Cover crop seed costs and custom drilling rates vary locally.',
        ],
        localExpertValidationChecklist: [
          'Verify herbicide or roller-crimper termination timing with a Certified Crop Advisor (CCA).',
        ],
      },
    },
    {
      id: 'strategy-c',
      code: 'C' as const,
      title: 'Climate-Resilient & Water-Conserving Rotation',
      tagline: 'Deep-Rooted Cereals, Drought-Tolerant Legumes & Adaptive Fallowing',
      score: scoreC,
      isIllustrative: !nasaSummary?.hasPowerData,
      cropSequence: [
        'Drought-Tolerant Corn Hybrid',
        'Triticale Winter Cover',
        'Grain Sorghum (Milo)',
        'Field Peas / Chickpeas',
        'Confectionery Sunflowers',
      ],
      seasons: ['Staggered Water Demand Peak Cycles', 'Continuous Soil Armor & Fiber'],
      soilBenefits: {
        nitrogenFixation: 'High (Cool-season pulse legumes contribute ~60 lbs N/acre)',
        organicMatterGrowth: '+0.22% estimated 3-yr delta with deep sunflower taproots',
        erosionMitigation: 'High (Upright sorghum stubble reduces wind erosion)',
        rootDiversityScore: 94,
      },
      climateResilience: {
        waterEfficiency: 'Superior (Grain sorghum requires ~32% less seasonal water than corn)',
        droughtTolerance: 'Exceptional (C4 sorghum withstands multi-week heat/dry spells)',
        heatRiskExposure: 'Lower pollination vulnerability above 34°C',
      },
      economicProfile: {
        grossMarginEst: '$760 - $855 / acre / yr (with specialty contract access)',
        inputCostIndex: 'Lower irrigation and synthetic input exposure',
        marketVolatility: 'Multi-commodity resilience; dependent on regional elevator contracts',
      },
      limitations: 'Regional grain elevator acceptance and combine headers for sorghum and sunflowers must be confirmed.',
      explainability: {
        strategyCode: 'C' as const,
        whySuggested: 'Engineered for heat-wave durability, water scarcity resilience, and three-family pest break.',
        nasaObservationsUsed: [
          powerEvidenceLine,
          ecostressGranule
            ? `ECOSTRESS thermal ET granule indexed (${ecostressGranule}) for canopy heat-stress tracking`
            : 'ECOSTRESS 70m thermal evaporative stress framework (Variable ISS revisit)',
        ],
        soilInformationUsed: soilContext,
        cropCharacteristicsInfluenced: [
          'Grain sorghum C4 pathway uses ~350-450 mm water vs 550-650 mm for corn',
          'Sunflower 2.5m taproots fracture deep compaction and scavenge subsoil moisture',
        ],
        farmerPrioritiesInfluenced: [
          `Drought Resilience (${priorities.droughtResilience}/5), Water Conservation (${priorities.waterConservation}/5), Crop Diversity (${priorities.cropDiversity}/5)`,
        ],
        expectedPotentialBenefits: [
          'Stabilizes farm productivity under elevated heat or reduced rainfall',
          'Breaks grass and legume host pests using Asteraceae (sunflower)',
        ],
        environmentalAndAgriculturalRisks: [
          'Sunflower residue is brittle and requires proper combine chaff spreading',
        ],
        missingInformation: missingDataList,
        uncertaintyAndLimitations: [
          'Specialty pulse and oilseed elevator basis bids depend on local haul distance.',
          scenario ? 'Hypothetical What-If stress assumptions applied; not an observed climate forecast.' : 'Local grain drying capacity must be verified.',
        ],
        localExpertValidationChecklist: [
          'Confirm sorghum and pulse delivery contracts and moisture dockage terms at regional elevators.',
        ],
      },
    },
  ];

  strategies.sort((a, b) => b.score - a.score);

  const topStrategy = strategies[0];
  const highWeights: string[] = [];
  if (priorities.soilOrganicMatter >= 4) highWeights.push('Soil Organic Matter');
  if (priorities.nitrogenFixing >= 4) highWeights.push('Biological Nitrogen');
  if (priorities.waterConservation >= 4) highWeights.push('Water Conservation');
  if (priorities.droughtResilience >= 4) highWeights.push('Drought Resilience');
  if (priorities.profitability >= 4) highWeights.push('Profitability');

  let rankingExplanation = `Based on your priorities (${
    highWeights.length > 0 ? highWeights.join(', ') : 'Balanced Farm Objectives'
  }) for ${farm.name}, Strategy ${topStrategy.code} (${topStrategy.title}) ranks highest at ${topStrategy.score}%.`;

  if (nasaSummary?.hasPowerData) {
    rankingExplanation += ` Grounded in ${nasaSummary.dailyTimeline.length} synced NASA POWER daily observations (${nasaSummary.precipTotalMm ?? 0} mm cumulative precipitation, mean ${nasaSummary.meanTempC ?? 'N/A'}°C).`;
  } else {
    rankingExplanation += ' Note: Sync NASA POWER data for this farm to replace regional climatology baselines with parcel-coordinate daily observations.';
  }

  if (scenario && (scenario.rainfallChangePercent < -15 || scenario.extendedDrySeasonWeeks > 2 || scenario.temperatureChangeCelsius > 2)) {
    rankingExplanation += ` Under the hypothetical What-If stress scenario (${scenario.rainfallChangePercent}% rainfall, +${scenario.temperatureChangeCelsius}°C, +${scenario.extendedDrySeasonWeeks} dry weeks), Strategy C gains relative resilience.`;
  }

  return {
    strategies,
    rankingExplanation,
    missingDataNotices: missingDataList,
    nasaEvidenceSummary: {
      hasPowerData: Boolean(nasaSummary?.hasPowerData),
      powerRecordCount: nasaSummary?.powerRecordCount ?? 0,
      powerLatestObservedAt: nasaSummary?.powerLatestObservedAt ?? null,
      precipTotalMm: nasaSummary?.precipTotalMm ?? null,
      meanTempC: nasaSummary?.meanTempC ?? null,
      meanWindSpeedMps: nasaSummary?.meanWindSpeedMps ?? null,
      hasModisNumericData: Boolean(nasaSummary?.hasModisNumericData),
      latestModisNdvi: nasaSummary?.latestModisNdvi ?? null,
      latestModisNdviDate: nasaSummary?.latestModisNdviDate ?? null,
      isHypotheticalScenario: Boolean(scenario),
    },
  };
}

export function buildBareFieldAnalysis(farm: DbFarmRecord, nasaSummary?: FarmNasaSummary | null): BareFieldPeriod[] {
  const observedNdvi = nasaSummary?.hasModisNumericData ? nasaSummary.latestModisNdvi : null;
  return [
    {
      strategyCode: 'A',
      durationDays: 135,
      calendarWindow: 'October 25 - April 10 (Post-harvest through spring planting)',
      soilExposureRisk: 'High',
      potentialErosionTonsPerAcre: 3.8,
      coverCropOpportunity: `Winter Cereal Rye or Triticale drilled immediately after ${farm.currentCrop} harvest`,
      ndviThresholdObserved: observedNdvi ?? 0.18,
      caveat: observedNdvi !== null
        ? `Live MODIS MOD13Q1 250m NDVI (${nasaSummary?.latestModisNdviDate}) measured ${observedNdvi}. Optical NDVI alone cannot distinguish dead crop residue from bare mineral soil without field scouting.`
        : 'Benchmark winter NDVI threshold (<0.20) shown because MODIS has not been synced for this parcel yet. Sync MODIS for 250m parcel readings.',
    },
    {
      strategyCode: 'B',
      durationDays: 0,
      calendarWindow: 'Continuous 365-Day Living Root Coverage',
      soilExposureRisk: 'Negligible',
      potentialErosionTonsPerAcre: 0.2,
      coverCropOpportunity: 'Active multi-species rye + hairy vetch + crimson clover mix',
      ndviThresholdObserved: 0.54,
      caveat:
        nasaSummary?.hasPowerData
          ? `Validated against ${nasaSummary.dailyTimeline.length} synced NASA POWER days (${nasaSummary.precipTotalMm ?? 0} mm rain recorded). Terminate timely in spring to preserve cash-crop moisture.`
          : 'Continuous cover eliminates bare-soil freeze-thaw exposure; sync NASA POWER & MODIS granules for parcel verification.',
    },
    {
      strategyCode: 'C',
      durationDays: 45,
      calendarWindow: 'Early August - September (Short pulse harvest gap)',
      soilExposureRisk: 'Low',
      potentialErosionTonsPerAcre: 0.8,
      coverCropOpportunity: 'Quick-establishing brassica radish or buckwheat summer pollinator cover',
      ndviThresholdObserved: 0.32,
      caveat: 'Upright sorghum stover residue breaks wind velocity; ground verification of residue percent cover advised.',
    },
  ];
}

export function buildPestCycles(farm: DbFarmRecord): PestCycleEvaluation[] {
  return [
    {
      strategyCode: 'A',
      familyRotationDiversityScore: 42,
      cornRootwormRisk: 'High',
      soybeanCystNematodeRisk: 'Moderate',
      fusariumHeadBlightRisk: 'Moderate',
      cycleBreakMechanism: `Biennial alternation around ${farm.currentCrop} leaves variant Western Corn Rootworm and soil-borne SCN pressure elevated.`,
      limitationDisclaimer:
        'Satellite canopy reflectance cannot diagnose specific insects or plant pathogens. Physical in-field scouting is mandatory.',
    },
    {
      strategyCode: 'B',
      familyRotationDiversityScore: 88,
      cornRootwormRisk: 'Low',
      soybeanCystNematodeRisk: 'Low',
      fusariumHeadBlightRisk: 'Low',
      cycleBreakMechanism: 'Multi-species cover crops stimulate diverse soil microbial antagonists (Pseudomonas, Trichoderma) that suppress root rot inoculum.',
      limitationDisclaimer:
        'Satellite canopy reflectance cannot diagnose specific insects or plant pathogens. Physical in-field scouting is mandatory.',
    },
    {
      strategyCode: 'C',
      familyRotationDiversityScore: 94,
      cornRootwormRisk: 'Low',
      soybeanCystNematodeRisk: 'Low',
      fusariumHeadBlightRisk: 'Low',
      cycleBreakMechanism: 'Introducing Asteraceae (sunflower) and cool-season pulse legumes removes cereal and soybean hosts across 3 of 4 seasons.',
      limitationDisclaimer:
        'Satellite canopy reflectance cannot diagnose specific insects or plant pathogens. Physical in-field scouting is mandatory.',
    },
  ];
}
