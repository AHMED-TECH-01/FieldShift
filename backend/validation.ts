import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().trim().email('Valid email address is required').max(254),
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Valid email address is required').max(254),
  password: z.string().min(1, 'Password is required').max(128),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().email('Valid email address is required').max(254),
  code: z.string().trim().regex(/^\d{6}$/, 'Verification code must be exactly 6 numeric digits'),
});

export const resendOtpSchema = z.object({
  email: z.string().trim().email('Valid email address is required').max(254),
});

export const passwordResetSchema = z.object({
  email: z.string().trim().email('Valid email address is required').max(254),
});

const weightField = z.coerce.number().int().min(1).max(5);

export const prioritiesSchema = z.object({
  waterConservation: weightField.default(4),
  profitability: weightField.default(4),
  forageValue: weightField.default(2),
  nitrogenFixing: weightField.default(5),
  soilOrganicMatter: weightField.default(5),
  erosionReduction: weightField.default(4),
  soilInfiltration: weightField.default(4),
  marketSuitability: weightField.default(4),
  droughtResilience: weightField.default(4),
  cropDiversity: weightField.default(3),
  equipmentCompatibility: weightField.default(3),
  plantingHarvestConstraints: weightField.default(3),
});

function emptyStringToNull(val: unknown): unknown {
  if (val === undefined) return undefined;
  if (val === null) return null;
  if (typeof val === 'string' && val.trim() === '') return null;
  return val;
}

const optionalNullableString = (maxLen: number) =>
  z.preprocess(emptyStringToNull, z.string().trim().max(maxLen).nullable().optional());

const optionalNullableSoilPh = z.preprocess(
  emptyStringToNull,
  z.union([
    z.null(),
    z.coerce.number().finite('Soil pH must be a valid number').min(0, 'Soil pH must be >= 0').max(14, 'Soil pH must be <= 14'),
  ]).optional()
);

const optionalNullableOrganicMatter = z.preprocess(
  emptyStringToNull,
  z.union([
    z.null(),
    z.coerce.number().finite('Organic matter must be a valid number').min(0, 'Organic matter must be >= 0').max(100, 'Organic matter must be <= 100'),
  ]).optional()
);

export const coordinatesSchema = z.tuple([
  z.number().finite('Longitude must be finite').min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  z.number().finite('Latitude must be finite').min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
]);

const optionalLatSchema = z.preprocess(
  emptyStringToNull,
  z.coerce.number().finite('Latitude must be a valid number').min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90').optional()
);

const optionalLonSchema = z.preprocess(
  emptyStringToNull,
  z.coerce.number().finite('Longitude must be a valid number').min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180').optional()
);

const optionalPositiveNumber = (label: string) =>
  z.preprocess(
    emptyStringToNull,
    z.coerce.number().finite(`${label} must be a valid number`).positive(`${label} must be greater than 0`).max(1000000).optional()
  );

export const farmFieldsBaseSchema = z.object({
  name: z.string().trim().min(2, 'Farm name must be at least 2 characters').max(120),
  description: optionalNullableString(600),
  location: z.string().trim().min(2, 'Farm location is required').max(180).optional(),
  country: z.string().trim().min(2, 'Country is required').max(100).optional(),
  state: z.string().trim().min(1, 'State or province is required').max(100).optional(),
  city: z.string().trim().min(1, 'City or town is required').max(100).optional(),
  latitude: optionalLatSchema,
  longitude: optionalLonSchema,
  coordinates: coordinatesSchema.optional(),
  area: optionalPositiveNumber('Farm area'),
  areaUnit: z.enum(['acres', 'hectares']).optional(),
  acreage: optionalPositiveNumber('Farm area'),
  farmType: optionalNullableString(80),
  operatingStatus: optionalNullableString(60),
  currentCrop: z.string().trim().min(1, 'Primary crop is required').max(100).optional(),
  primaryCrop: z.string().trim().min(1, 'Primary crop is required').max(100).optional(),
  previousCrop: optionalNullableString(100),
  irrigationType: optionalNullableString(80),
  plantingSeason: optionalNullableString(100),
  harvestSeason: optionalNullableString(100),
  rotationHistory: z.array(z.string().trim().max(100)).max(20).optional(),
  soilType: optionalNullableString(120),
  soilPH: optionalNullableSoilPh,
  organicMatter: optionalNullableOrganicMatter,
  nitrogen: optionalNullableString(80),
  phosphorus: optionalNullableString(80),
  potassium: optionalNullableString(80),
  drainage: optionalNullableString(120),
  lastSoilTest: optionalNullableString(40),
  farmerPriorities: prioritiesSchema.nullable().optional(),
});

export const createFarmSchema = farmFieldsBaseSchema.superRefine((data, ctx) => {
  const hasStructuredGeo = Boolean(data.country?.trim() && data.state?.trim() && data.city?.trim());
  const hasLocationStr = Boolean(data.location?.trim());
  if (!hasStructuredGeo && !hasLocationStr) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['location'],
      message: 'Farm geographic location (country, state/province, city) is required.',
    });
  }

  const hasLatLon = typeof data.latitude === 'number' && typeof data.longitude === 'number';
  const hasCoordsTuple = Array.isArray(data.coordinates) && data.coordinates.length === 2;
  if (!hasLatLon && !hasCoordsTuple) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['latitude'],
      message: 'Valid farm coordinates (latitude and longitude) must be selected or entered.',
    });
  }

  const hasArea = typeof data.area === 'number' || typeof data.acreage === 'number';
  if (!hasArea) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['area'],
      message: 'Farm area must be provided and greater than 0.',
    });
  }

  const hasCrop = Boolean(data.currentCrop?.trim() || data.primaryCrop?.trim());
  if (!hasCrop) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['currentCrop'],
      message: 'Primary crop is required.',
    });
  }
});

export const updateFarmSchema = farmFieldsBaseSchema.partial().superRefine((obj, ctx) => {
  if (Object.keys(obj).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one farm field must be provided for update',
    });
  }
  if ((obj.latitude !== undefined && obj.longitude === undefined) || (obj.longitude !== undefined && obj.latitude === undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['latitude'],
      message: 'Both latitude and longitude must be provided together when updating coordinates.',
    });
  }
});

export const scenarioSchema = z.object({
  rainfallChangePercent: z.coerce.number().min(-80).max(100).default(0),
  temperatureChangeCelsius: z.coerce.number().min(-10).max(15).default(0),
  extendedDrySeasonWeeks: z.coerce.number().min(0).max(26).default(0),
  irrigationRestricted: z.boolean().default(false),
  plantingDateOffsetDays: z.coerce.number().min(-60).max(60).default(0),
});

export const datasetSyncSchema = z.object({
  farmId: z.string().trim().min(1, 'farmId is required').max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD').optional(),
  days: z.coerce.number().int().min(1).max(90).optional(),
  resolution: z.enum(['daily', 'monthly']).optional(),
  force: z.boolean().optional(),
  maxComposites: z.coerce.number().int().min(1).max(10).optional(),
});

export const rotationCreateSchema = z.object({
  farmId: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2).max(140).default('Custom Rotation Assessment'),
  priorities: prioritiesSchema.optional(),
  scenario: scenarioSchema.nullable().optional(),
  save: z.boolean().optional(),
});

export const advisorRequestSchema = z.object({
  prompt: z.string().trim().min(2, 'Prompt must be at least 2 characters').max(2000),
  farmId: z.string().trim().min(1).max(120).optional(),
  priorities: prioritiesSchema.optional(),
  scenario: scenarioSchema.nullable().optional(),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120).optional(),
  measurementUnits: z.enum(['imperial', 'metric']).optional(),
}).refine(
  (obj) => obj.fullName !== undefined || obj.measurementUnits !== undefined,
  { message: 'At least one profile field must be provided' }
);

export function parseBody<T>(schema: z.ZodType<T>, input: unknown): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const issues = result.error.issues.map((i) => {
    const path = i.path.length > 0 ? `${i.path.join('.')}: ` : '';
    return `${path}${i.message}`;
  });
  return { ok: false, error: issues[0] || 'Invalid request payload' };
}
