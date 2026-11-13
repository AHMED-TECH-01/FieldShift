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
  code: z.string().trim().min(4, 'Verification code is required').max(12),
});

export const resendOtpSchema = z.object({
  email: z.string().trim().email('Valid email address is required').max(254),
});

export const passwordResetSchema = z.object({
  email: z.string().trim().email('Valid email address is required').max(254),
});

export const coordinatesSchema = z
  .tuple([
    z.number().min(-180, 'Longitude must be between -180 and 180').max(180),
    z.number().min(-90, 'Latitude must be between -90 and 90').max(90),
  ]);

export const createFarmSchema = z.object({
  name: z.string().trim().min(2, 'Farm name must be at least 2 characters').max(120),
  location: z.string().trim().min(2, 'Farm location is required').max(180),
  coordinates: coordinatesSchema.optional(),
  acreage: z.coerce.number().positive('Acreage must be positive').max(1000000).default(250),
  currentCrop: z.string().trim().min(1).max(100).default('Corn (Maize)'),
  plantingSeason: z.string().trim().min(1).max(100).default('Spring 2026'),
  rotationHistory: z.array(z.string().trim().max(100)).max(20).optional(),
  soilType: z.string().trim().min(1).max(120).default('Silt Loam'),
  soilPH: z.coerce.number().min(0, 'Soil pH must be >= 0').max(14, 'Soil pH must be <= 14').default(6.5),
  organicMatter: z.coerce.number().min(0).max(100).default(3.2),
  nitrogen: z.string().trim().max(80).default('Medium'),
  phosphorus: z.string().trim().max(80).default('Medium'),
  potassium: z.string().trim().max(80).default('Medium'),
  drainage: z.string().trim().max(120).default('Well Drained'),
  lastSoilTest: z.string().trim().max(40).optional(),
});

export const updateFarmSchema = createFarmSchema.partial().refine(
  (obj) => Object.keys(obj).length > 0,
  { message: 'At least one farm field must be provided for update' }
);

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
