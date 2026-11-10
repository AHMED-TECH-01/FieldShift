export interface Farm {
  id: string;
  name: string;
  location: string;
  coordinates: [number, number];
  acreage: number;
  currentCrop: string;
  plantingSeason: string;
  rotationHistory: string[];
  soilType: string;
  soilPH: number;
  organicMatter: number;
  nitrogen: string;
  phosphorus: string;
  potassium: string;
  drainage: string;
  lastSoilTest: string;
  createdAt: string;
}

export interface FarmerPriorities {
  waterConservation: number; // 1-5 or 0-100 scale
  profitability: number;
  forageValue: number;
  nitrogenFixing: number;
  soilOrganicMatter: number;
  erosionReduction: number;
  soilInfiltration: number;
  marketSuitability: number;
  droughtResilience: number;
  cropDiversity: number;
  equipmentCompatibility: number;
  plantingHarvestConstraints: number;
}

export interface CropCharacteristics {
  id: string;
  name: string;
  scientificName: string;
  family: string;
  plantingSeason: string;
  harvestSeason: string;
  growingDurationDays: number;
  waterRequirementMm: string;
  temperatureSuitability: { min: number; opt: number; max: number };
  droughtTolerance: 'Low' | 'Moderate' | 'High' | 'Exceptional';
  soilPreferences: {
    phRange: string;
    textures: string[];
    drainage: string;
  };
  nutrientRequirements: {
    nitrogenDemand: string;
    phosphorusDemand: string;
    potassiumDemand: string;
  };
  nitrogenFixingPotentialLbsPerAcre: number;
  rootCharacteristics: {
    depthMeters: number;
    architecture: 'Deep Taproot' | 'Dense Fibrous' | 'Extensive Mycorrhizal' | 'Shallow Fibrous';
    hardpanPenetration: 'High' | 'Moderate' | 'Low';
  };
  forageValue: {
    relativeFeedValue: string;
    crudeProteinPercent: string;
    grazingSuitability: string;
  };
  marketSuitability: string;
  pestAndDiseaseConsiderations: {
    susceptiblePests: string[];
    interruptedPests: string[];
    familyHostRisk: string;
  };
  residueAndOrganicMatter: {
    biomassTonsPerAcre: number;
    cnRatio: string;
    soilArmorPersistence: string;
  };
  isVerifiedAgronomicData: boolean;
  sourceReference: string;
}

export interface BareFieldPeriod {
  strategyCode: 'A' | 'B' | 'C';
  durationDays: number;
  calendarWindow: string;
  soilExposureRisk: 'High' | 'Moderate' | 'Low' | 'Negligible';
  potentialErosionTonsPerAcre: number;
  coverCropOpportunity: string;
  ndviThresholdObserved: number;
  caveat: string;
}

export interface PestCycleEvaluation {
  strategyCode: 'A' | 'B' | 'C';
  familyRotationDiversityScore: number;
  cornRootwormRisk: 'High' | 'Moderate' | 'Low';
  soybeanCystNematodeRisk: 'High' | 'Moderate' | 'Low';
  fusariumHeadBlightRisk: 'High' | 'Moderate' | 'Low';
  cycleBreakMechanism: string;
  limitationDisclaimer: string;
}

export interface SupplementalIncome {
  category: string;
  opportunityName: string;
  estimatedGrossValuePerAcre: string;
  localMarketRequirement: string;
  missingDataNotice: string;
  feasibility: 'High' | 'Moderate' | 'Conditional';
}

export interface NasaHarmonizedDataset {
  id: string;
  code: string;
  name: string;
  source: string;
  spatialResolution: string;
  temporalResolution: string;
  observationPeriod: string;
  units: string;
  processingMethod: string;
  analyticalPurpose: string;
  limitations: string;
  lastRetrievedTimestamp: string;
  dataCategory: 'Satellite Derived' | 'Ground Truth Calibrated' | 'Model Assimilated';
}

export interface WhatIfScenario {
  rainfallChangePercent: number; // -40% to +40%
  temperatureChangeCelsius: number; // -2 to +5 °C
  extendedDrySeasonWeeks: number; // 0 to 6 weeks
  irrigationRestricted: boolean;
  plantingDateOffsetDays: number; // -21 to +21 days
}

export interface ExplainabilityReport {
  strategyCode: 'A' | 'B' | 'C';
  whySuggested: string;
  nasaObservationsUsed: string[];
  soilInformationUsed: string[];
  cropCharacteristicsInfluenced: string[];
  farmerPrioritiesInfluenced: string[];
  expectedPotentialBenefits: string[];
  environmentalAndAgriculturalRisks: string[];
  missingInformation: string[];
  uncertaintyAndLimitations: string[];
  localExpertValidationChecklist: string[];
}

export interface CropRotationStrategy {
  id: string;
  code: 'A' | 'B' | 'C';
  title: string;
  tagline: string;
  score: number;
  isIllustrative: boolean;
  cropSequence: string[];
  seasons: string[];
  soilBenefits: {
    nitrogenFixation: string;
    organicMatterGrowth: string;
    erosionMitigation: string;
    rootDiversityScore: number;
  };
  climateResilience: {
    waterEfficiency: string;
    droughtTolerance: string;
    heatRiskExposure: string;
  };
  economicProfile: {
    grossMarginEst: string;
    inputCostIndex: string;
    marketVolatility: string;
  };
  limitations: string;
  explainability?: ExplainabilityReport;
}

export interface FieldRiskIndicator {
  name: string;
  level: 'LOW' | 'MODERATE' | 'HIGH';
  score: number;
  dataSource: string;
  observation: string;
}

export interface User {
  email: string;
  fullName: string;
  verified: boolean;
}
