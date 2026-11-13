import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  AuthenticatedRequest,
  getAccessibleFarmById,
  getSupabaseAdminClient,
  getSupabaseAuthClient,
  getSupabasePublicClient,
  listAccessibleFarms,
  mapDbFarmRow,
  requireAuth,
  resolveRequestUser,
} from './backend/supabase';
import {
  advisorRequestSchema,
  createFarmSchema,
  datasetSyncSchema,
  loginSchema,
  parseBody,
  passwordResetSchema,
  prioritiesSchema,
  profileUpdateSchema,
  registerSchema,
  resendOtpSchema,
  rotationCreateSchema,
  scenarioSchema,
  updateFarmSchema,
  verifyOtpSchema,
} from './backend/validation';
import {
  buildBareFieldAnalysis,
  buildPestCycles,
  calculateStrategyEvaluations,
  cropDatabase,
  DEFAULT_PRIORITIES,
  scientificMethods,
  supplementalIncomeOpportunities,
} from './backend/agronomy';
import {
  getFarmNasaObservationsSummary,
  nasaHarmonizedRoadmap,
  SUPPORTED_SYNC_DATASETS,
  SupportedSyncDataset,
  syncEarthdataCmrForFarm,
  syncNasaPowerForFarm,
} from './backend/nasa';
import { getGeminiClient, runGroundedAdvisor } from './backend/gemini';
import { logEvent, logGeminiEvent } from './backend/logger';

dotenv.config();

export { logGeminiEvent };

export const app = express();

// Trust Vercel / reverse-proxy headers for accurate protocol & rate-limit IP resolution
app.set('trust proxy', 1);

// Request body limits (prevent oversized payload abuse)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Security headers & CORS middleware
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  const configuredAppUrl = (process.env.APP_URL || process.env.APP_URI || '').trim().replace(/\/$/, '');
  if (configuredAppUrl && origin === configuredAppUrl) return true;
  return false;
}

app.use((req: Request, res: Response, next: NextFunction) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Credentials', 'true');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Malformed JSON error handler
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON request body.' });
    return;
  }
  next(err);
});

// Bounded in-memory sliding-window rate limiter for abuse protection
const rateLimitBuckets = new Map<string, number[]>();
function createRateLimiter(bucketName: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${bucketName}:${req.ip || 'unknown'}`;
    const now = Date.now();
    const cutoff = now - windowMs;
    const recent = (rateLimitBuckets.get(key) || []).filter((ts) => ts > cutoff);
    if (recent.length >= maxRequests) {
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait briefly before retrying.',
      });
      return;
    }
    recent.push(now);
    rateLimitBuckets.set(key, recent);
    // Keep map bounded in warm serverless memory
    if (rateLimitBuckets.size > 1000) {
      const oldestKey = rateLimitBuckets.keys().next().value;
      if (oldestKey) rateLimitBuckets.delete(oldestKey);
    }
    next();
  };
}

const authRateLimit = createRateLimiter('auth', 25, 60_000);
const nasaSyncRateLimit = createRateLimiter('nasa_sync', 20, 60_000);
const aiAdvisorRateLimit = createRateLimiter('ai_advisor', 15, 60_000);

function buildSessionCookie(token: string): string {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  return `fieldshift_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${
    isProd ? '; Secure' : ''
  }`;
}

function clearSessionCookie(): string {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  return `fieldshift_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? '; Secure' : ''}`;
}

/* ==========================================================================
   1. HEALTH & PUBLIC CATALOG ROUTES
   ========================================================================== */

app.get('/api/health', async (_req: Request, res: Response) => {
  let supabaseReachable = false;
  const pubClient = getSupabasePublicClient() || getSupabaseAdminClient();
  if (pubClient) {
    try {
      const { error } = await pubClient.from('nasa_datasets').select('id').limit(1);
      supabaseReachable = !error;
    } catch {
      supabaseReachable = false;
    }
  }

  res.json({
    status: supabaseReachable ? 'healthy' : 'degraded',
    platform: 'FieldShift Agricultural Intelligence Platform',
    version: '2.6.0',
    runtime: process.env.VERCEL ? 'vercel-serverless' : 'node-express',
    supabaseConfigured: Boolean(getSupabaseAuthClient()),
    supabaseReachable,
    geminiConfigured: Boolean(getGeminiClient()),
    nasaPowerEndpoint: 'https://power.larc.nasa.gov/api/temporal/daily/point',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/crops', (req: Request, res: Response) => {
  const familyFilter = typeof req.query.family === 'string' ? req.query.family.trim() : '';
  const crops = familyFilter
    ? cropDatabase.filter((c) => c.family.toLowerCase().includes(familyFilter.toLowerCase()))
    : cropDatabase;

  res.json({
    totalCrops: crops.length,
    crops,
    verifiedSourceNotice:
      'All agronomic profiles are cataloged from peer-reviewed university extension services and USDA-ARS datasets.',
  });
});

app.get('/api/scientific-methods', (_req: Request, res: Response) => {
  res.json({
    framework: 'FieldShift Agricultural Science and Geospatial Modeling Protocols',
    methods: scientificMethods,
    scientificEthicsStatement:
      'Correlation does not prove causation. Remote sensing indices support agronomic decision-making and never replace field scouting or laboratory soil testing.',
  });
});

app.get(['/api/datasets', '/api/nasa/roadmap'], async (_req: Request, res: Response) => {
  const pubClient = getSupabasePublicClient();
  let dbDatasets: any[] | null = null;
  if (pubClient) {
    const { data, error } = await pubClient.from('nasa_datasets').select('*').order('id');
    if (!error && data && data.length > 0) {
      dbDatasets = data;
    }
  }

  res.json({
    totalMissions: nasaHarmonizedRoadmap.length,
    datasets: nasaHarmonizedRoadmap,
    persistedCatalog: dbDatasets || [],
    supportedSyncEndpoints: SUPPORTED_SYNC_DATASETS.map((ds) => ({
      id: ds,
      syncPath: `/api/datasets/${ds}/sync`,
      observationsPath: `/api/datasets/${ds}/observations`,
      accessMode: ds === 'nasa-power' ? 'live_public_api' : 'cmr_granule_discovery',
    })),
    harmonizationArchitecture: {
      spatialResampling: 'Coarse grids (50km POWER, 10km GPM, 9km SMAP) are explicitly labeled and never claimed as sub-field measurements.',
      temporalAlignment: 'Daily NASA POWER series and CMR granule timestamps preserved in UTC ISO-8601.',
      crsStandardization: 'Geographic WGS84 (EPSG:4326) farm coordinates queried natively.',
      dataProvenanceRule: 'Raw NASA observations are strictly segregated from soil tests, farmer logs, and deterministic strategy outputs.',
    },
  });
});

app.get('/api/analysis/supplemental-income', (_req: Request, res: Response) => {
  res.json({
    opportunities: supplementalIncomeOpportunities,
    disclaimer:
      'FieldShift identifies potential economic avenues based on published agronomic extension budgets. Market prices fluctuate; treat estimates as illustrative.',
  });
});

/* ==========================================================================
   2. AUTHENTICATION ROUTES (Supabase Auth Only — Zero In-Memory Fallbacks)
   ========================================================================== */

const authRegisterPaths = ['/api/auth/register', '/api/v1/auth/register', '/auth/register', '/api/register', '/api/auth/signup', '/auth/signup'];
app.post(authRegisterPaths, authRateLimit, async (req: Request, res: Response) => {
  const parsed = parseBody(registerSchema, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const supaAuth = getSupabaseAuthClient();
  if (!supaAuth) {
    res.status(503).json({ error: 'Authentication service is not configured.' });
    return;
  }

  const { email, fullName, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  try {
    const { data, error } = await supaAuth.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (data.session && data.user) {
      res.set('Set-Cookie', buildSessionCookie(data.session.access_token));
      res.status(201).json({
        success: true,
        autoConfirmed: true,
        message: 'Account created and verified.',
        user: {
          email: data.user.email || normalizedEmail,
          fullName,
          verified: Boolean(data.user.email_confirmed_at),
        },
        token: data.session.access_token,
      });
      return;
    }

    res.status(201).json({
      success: true,
      autoConfirmed: false,
      message: 'Verification email/code sent to your email address.',
      email: normalizedEmail,
    });
  } catch (err: any) {
    logEvent('Auth', 'REGISTER_EXCEPTION', { message: err?.message });
    res.status(500).json({ error: 'Registration failed due to an upstream authentication error.' });
  }
});

const authVerifyPaths = ['/api/auth/verify-otp', '/api/v1/auth/verify-otp', '/auth/verify-otp', '/api/verify-otp'];
app.post(authVerifyPaths, authRateLimit, async (req: Request, res: Response) => {
  const parsed = parseBody(verifyOtpSchema, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const supaAuth = getSupabaseAuthClient();
  if (!supaAuth) {
    res.status(503).json({ error: 'Authentication service is not configured.' });
    return;
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  try {
    const { data, error } = await supaAuth.auth.verifyOtp({
      email: normalizedEmail,
      token: parsed.data.code,
      type: 'signup',
    });

    if (error || !data.session || !data.user) {
      res.status(400).json({ error: error?.message || 'Invalid or expired verification code.' });
      return;
    }

    const metaName = data.user.user_metadata?.full_name || normalizedEmail.split('@')[0];
    res.set('Set-Cookie', buildSessionCookie(data.session.access_token));
    res.json({
      success: true,
      user: {
        email: data.user.email || normalizedEmail,
        fullName: String(metaName),
        verified: true,
      },
      token: data.session.access_token,
    });
  } catch (err: any) {
    logEvent('Auth', 'VERIFY_OTP_EXCEPTION', { message: err?.message });
    res.status(500).json({ error: 'Verification failed due to an upstream error.' });
  }
});

const authResendPaths = ['/api/auth/resend-otp', '/api/v1/auth/resend-otp', '/auth/resend-otp', '/api/resend-otp'];
app.post(authResendPaths, authRateLimit, async (req: Request, res: Response) => {
  const parsed = parseBody(resendOtpSchema, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const supaAuth = getSupabaseAuthClient();
  if (!supaAuth) {
    res.status(503).json({ error: 'Authentication service is not configured.' });
    return;
  }

  try {
    const { error } = await supaAuth.auth.resend({
      type: 'signup',
      email: parsed.data.email.toLowerCase(),
    });
    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.json({
      success: true,
      message: 'A new verification email/code has been dispatched.',
    });
  } catch (err: any) {
    logEvent('Auth', 'RESEND_OTP_EXCEPTION', { message: err?.message });
    res.status(500).json({ error: 'Unable to resend verification email.' });
  }
});

const authLoginPaths = ['/api/auth/login', '/api/v1/auth/login', '/auth/login', '/api/login', '/login', '/api/auth/signin', '/auth/signin'];
app.get(authLoginPaths, (_req: Request, res: Response) => {
  res.set('Allow', 'POST, OPTIONS');
  res.status(405).json({ error: 'Method Not Allowed. Use POST to authenticate.', status: 405 });
});

app.post(authLoginPaths, authRateLimit, async (req: Request, res: Response) => {
  const parsed = parseBody(loginSchema, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const supaAuth = getSupabaseAuthClient();
  if (!supaAuth) {
    res.status(503).json({ error: 'Authentication service is not configured.' });
    return;
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  try {
    const { data, error } = await supaAuth.auth.signInWithPassword({
      email: normalizedEmail,
      password: parsed.data.password,
    });

    if (error || !data?.session || !data?.user) {
      res.status(401).json({ error: error?.message || 'Invalid login credentials.' });
      return;
    }

    const metaName = data.user.user_metadata?.full_name || normalizedEmail.split('@')[0];
    res.set('Set-Cookie', buildSessionCookie(data.session.access_token));
    res.json({
      success: true,
      user: {
        email: data.user.email || normalizedEmail,
        fullName: String(metaName),
        verified: Boolean(data.user.email_confirmed_at),
      },
      token: data.session.access_token,
    });
  } catch (err: any) {
    logEvent('Auth', 'LOGIN_EXCEPTION', { message: err?.message });
    res.status(500).json({ error: 'An internal error occurred during authentication.' });
  }
});

const authSessionPaths = ['/api/auth/session', '/api/v1/auth/session', '/auth/session', '/api/auth/me', '/auth/me', '/api/auth/user', '/auth/user'];
app.get(authSessionPaths, async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json({ error: 'No active valid session.' });
    return;
  }
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      verified: user.verified,
    },
  });
});

const authLogoutPaths = ['/api/auth/logout', '/api/v1/auth/logout', '/auth/logout', '/api/logout', '/logout'];
app.post(authLogoutPaths, (_req: Request, res: Response) => {
  res.set('Set-Cookie', clearSessionCookie());
  res.json({ success: true, message: 'Logged out successfully.' });
});

const authResetPaths = ['/api/auth/password-reset', '/api/auth/forgot-password', '/auth/forgot-password', '/api/auth/reset-password', '/auth/reset-password'];
app.post(authResetPaths, authRateLimit, async (req: Request, res: Response) => {
  const parsed = parseBody(passwordResetSchema, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const supaAuth = getSupabaseAuthClient();
  if (!supaAuth) {
    res.status(503).json({ error: 'Authentication service is not configured.' });
    return;
  }

  try {
    const redirectTo = process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, '')}/auth/sign-in` : undefined;
    await supaAuth.auth.resetPasswordForEmail(
      parsed.data.email.toLowerCase(),
      redirectTo ? { redirectTo } : undefined
    );
  } catch {
    // Intentionally suppress user enumeration errors
  }

  res.json({
    success: true,
    message: 'If an account matches this email, password reset instructions have been sent.',
  });
});

/* ==========================================================================
   3. PROFILE ROUTES (Protected)
   ========================================================================== */

app.get('/api/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.authUser!;
  const client = req.supabaseUserClient!;

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    logEvent('Profile', 'PROFILE_FETCH_ERROR', { error: error.message });
    res.status(500).json({ error: 'Failed to load profile.' });
    return;
  }

  if (!data) {
    const { data: inserted, error: insertErr } = await client
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        measurement_units: 'imperial',
      })
      .select('*')
      .single();

    if (insertErr) {
      res.status(500).json({ error: 'Failed to initialize user profile.' });
      return;
    }

    res.json({
      profile: {
        id: inserted.id,
        email: inserted.email,
        fullName: inserted.full_name,
        measurementUnits: inserted.measurement_units,
        updatedAt: inserted.updated_at,
      },
    });
    return;
  }

  res.json({
    profile: {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      measurementUnits: data.measurement_units,
      updatedAt: data.updated_at,
    },
  });
});

app.patch('/api/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = parseBody(profileUpdateSchema, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.fullName !== undefined) updates.full_name = parsed.data.fullName;
  if (parsed.data.measurementUnits !== undefined) updates.measurement_units = parsed.data.measurementUnits;

  const { data, error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('*')
    .single();

  if (error || !data) {
    logEvent('Profile', 'PROFILE_UPDATE_ERROR', { error: error?.message });
    res.status(500).json({ error: 'Failed to update user profile.' });
    return;
  }

  res.json({
    success: true,
    profile: {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      measurementUnits: data.measurement_units,
      updatedAt: data.updated_at,
    },
  });
});

/* ==========================================================================
   4. FARM MANAGEMENT ROUTES (Protected & Ownership-Verified via RLS)
   ========================================================================== */

app.get('/api/farms', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farms = await listAccessibleFarms(req.authUser!);
    res.json({
      farms,
      totalCount: farms.length,
      source: 'supabase',
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unable to load farms.' });
  }
});

app.post('/api/farms', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = parseBody(createFarmSchema, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farmId = `farm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();
  const payload = parsed.data;

  const { data, error } = await client
    .from('farms')
    .insert({
      id: farmId,
      user_id: user.id,
      is_demo: false,
      name: payload.name,
      location: payload.location,
      coordinates: payload.coordinates || [-93.62, 42.03],
      acreage: payload.acreage,
      current_crop: payload.currentCrop,
      planting_season: payload.plantingSeason,
      rotation_history: payload.rotationHistory && payload.rotationHistory.length > 0
        ? payload.rotationHistory
        : [payload.currentCrop],
      soil_type: payload.soilType,
      soil_ph: payload.soilPH,
      organic_matter: payload.organicMatter,
      nitrogen: payload.nitrogen,
      phosphorus: payload.phosphorus,
      potassium: payload.potassium,
      drainage: payload.drainage,
      last_soil_test: payload.lastSoilTest || nowIso.slice(0, 10),
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select('*')
    .single();

  if (error || !data) {
    logEvent('Farms', 'FARM_CREATE_ERROR', { error: error?.message });
    res.status(500).json({ error: 'Failed to persist farm property.' });
    return;
  }

  res.status(201).json({
    success: true,
    farm: mapDbFarmRow(data),
    source: 'supabase',
  });
});

app.get('/api/farms/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const farm = await getAccessibleFarmById(req.params.id, req.authUser!);
    if (!farm) {
      res.status(404).json({ error: 'Farm not found or access denied.' });
      return;
    }
    res.json({ farm });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to retrieve farm.' });
  }
});

app.patch('/api/farms/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = parseBody(updateFarmSchema, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const existing = await getAccessibleFarmById(req.params.id, user);

  if (!existing) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }
  if (existing.isDemo || existing.userId !== user.id) {
    res.status(403).json({ error: 'Only your own registered farm properties can be edited.' });
    return;
  }

  const p = parsed.data;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.name !== undefined) updates.name = p.name;
  if (p.location !== undefined) updates.location = p.location;
  if (p.coordinates !== undefined) updates.coordinates = p.coordinates;
  if (p.acreage !== undefined) updates.acreage = p.acreage;
  if (p.currentCrop !== undefined) updates.current_crop = p.currentCrop;
  if (p.plantingSeason !== undefined) updates.planting_season = p.plantingSeason;
  if (p.rotationHistory !== undefined) updates.rotation_history = p.rotationHistory;
  if (p.soilType !== undefined) updates.soil_type = p.soilType;
  if (p.soilPH !== undefined) updates.soil_ph = p.soilPH;
  if (p.organicMatter !== undefined) updates.organic_matter = p.organicMatter;
  if (p.nitrogen !== undefined) updates.nitrogen = p.nitrogen;
  if (p.phosphorus !== undefined) updates.phosphorus = p.phosphorus;
  if (p.potassium !== undefined) updates.potassium = p.potassium;
  if (p.drainage !== undefined) updates.drainage = p.drainage;
  if (p.lastSoilTest !== undefined) updates.last_soil_test = p.lastSoilTest;

  const { data, error } = await client
    .from('farms')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (error || !data) {
    logEvent('Farms', 'FARM_UPDATE_ERROR', { farmId: req.params.id, error: error?.message });
    res.status(500).json({ error: 'Failed to update farm property.' });
    return;
  }

  res.json({ success: true, farm: mapDbFarmRow(data) });
});

app.delete('/api/farms/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const existing = await getAccessibleFarmById(req.params.id, user);

  if (!existing) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }
  if (existing.isDemo || existing.userId !== user.id) {
    res.status(403).json({ error: 'Baseline demonstration farms and farms owned by other users cannot be deleted.' });
    return;
  }

  const { error } = await client
    .from('farms')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', user.id);

  if (error) {
    logEvent('Farms', 'FARM_DELETE_ERROR', { farmId: req.params.id, error: error.message });
    res.status(500).json({ error: 'Failed to delete farm property.' });
    return;
  }

  res.json({ success: true, id: req.params.id });
});

/* ==========================================================================
   5. FARMER PRIORITIES ROUTES (Protected & Scoped per User+Farm)
   ========================================================================== */

app.get('/api/priorities', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const user = req.authUser!;
  const client = req.supabaseUserClient!;

  const farm = await getAccessibleFarmById(farmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  const { data, error } = await client
    .from('farmer_priorities')
    .select('*')
    .eq('farm_id', farmId)
    .eq('owner_scope', user.id)
    .maybeSingle();

  if (error) {
    res.status(500).json({ error: 'Failed to retrieve priorities.' });
    return;
  }

  if (!data) {
    res.json({ success: true, source: 'default', priorities: null });
    return;
  }

  res.json({
    success: true,
    source: 'supabase',
    priorities: {
      waterConservation: data.water_conservation,
      profitability: data.profitability,
      forageValue: data.forage_value,
      nitrogenFixing: data.nitrogen_fixing,
      soilOrganicMatter: data.soil_organic_matter,
      erosionReduction: data.erosion_reduction,
      soilInfiltration: data.soil_infiltration,
      marketSuitability: data.market_suitability,
      droughtResilience: data.drought_resilience,
      cropDiversity: data.crop_diversity,
      equipmentCompatibility: data.equipment_compatibility,
      plantingHarvestConstraints: data.planting_harvest_constraints,
    },
  });
});

app.put('/api/priorities', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { farmId, priorities } = req.body || {};
  if (!farmId || typeof farmId !== 'string') {
    res.status(400).json({ error: 'farmId is required.' });
    return;
  }
  const parsedPrio = parseBody(prioritiesSchema, priorities);
  if (!parsedPrio.ok) {
    res.status(400).json({ error: parsedPrio.error });
    return;
  }

  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farm = await getAccessibleFarmById(farmId.trim(), user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  const p = parsedPrio.data;
  const { error } = await client
    .from('farmer_priorities')
    .upsert(
      {
        farm_id: farm.id,
        user_id: user.id,
        owner_scope: user.id,
        water_conservation: p.waterConservation,
        profitability: p.profitability,
        forage_value: p.forageValue,
        nitrogen_fixing: p.nitrogenFixing,
        soil_organic_matter: p.soilOrganicMatter,
        erosion_reduction: p.erosionReduction,
        soil_infiltration: p.soilInfiltration,
        market_suitability: p.marketSuitability,
        drought_resilience: p.droughtResilience,
        crop_diversity: p.cropDiversity,
        equipment_compatibility: p.equipmentCompatibility,
        planting_harvest_constraints: p.plantingHarvestConstraints,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'farm_id,owner_scope' }
    );

  if (error) {
    logEvent('Priorities', 'UPSERT_ERROR', { farmId: farm.id, error: error.message });
    res.status(500).json({ error: 'Failed to save priorities.' });
    return;
  }

  res.json({ success: true, source: 'supabase' });
});

/* ==========================================================================
   6. NASA DATASET INGESTION & OBSERVATION ROUTES (Protected & Ownership Verified)
   ========================================================================== */

app.get('/api/datasets/status', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const user = req.authUser!;
  const client = req.supabaseUserClient!;

  const farm = await getAccessibleFarmById(farmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  const [summary, jobsRes] = await Promise.all([
    getFarmNasaObservationsSummary(client, farm.id),
    client
      .from('ingestion_jobs')
      .select('*')
      .eq('farm_id', farm.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  res.json({
    farmId: farm.id,
    farmName: farm.name,
    coordinates: farm.coordinates,
    summary,
    recentJobs: jobsRes.data || [],
  });
});

app.post('/api/datasets/:dataset/sync', requireAuth, nasaSyncRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  const dataset = req.params.dataset as SupportedSyncDataset;
  if (!SUPPORTED_SYNC_DATASETS.includes(dataset)) {
    res.status(400).json({
      error: `Unsupported dataset '${req.params.dataset}'. Supported datasets: ${SUPPORTED_SYNC_DATASETS.join(', ')}`,
    });
    return;
  }

  const parsed = parseBody(datasetSyncSchema, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farm = await getAccessibleFarmById(parsed.data.farmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  try {
    if (dataset === 'nasa-power') {
      const result = await syncNasaPowerForFarm(client, user.id, farm, {
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        days: parsed.data.days,
      });
      res.json({ success: true, ...result });
      return;
    }

    const result = await syncEarthdataCmrForFarm(client, user.id, farm, dataset);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(502).json({
      error: `Failed to sync ${dataset}: ${err?.message || 'Upstream NASA request failed'}`,
    });
  }
});

app.get('/api/datasets/:dataset/observations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const dataset = req.params.dataset as SupportedSyncDataset;
  if (!SUPPORTED_SYNC_DATASETS.includes(dataset)) {
    res.status(400).json({
      error: `Unsupported dataset '${req.params.dataset}'. Supported datasets: ${SUPPORTED_SYNC_DATASETS.join(', ')}`,
    });
    return;
  }

  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : '';
  if (!farmId) {
    res.status(400).json({ error: 'farmId query parameter is required.' });
    return;
  }

  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farm = await getAccessibleFarmById(farmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  const { data, count, error } = await client
    .from('nasa_observations')
    .select('*', { count: 'exact' })
    .eq('farm_id', farm.id)
    .eq('dataset_id', dataset)
    .order('observed_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    res.status(500).json({ error: 'Failed to retrieve NASA observations.' });
    return;
  }

  res.json({
    farmId: farm.id,
    dataset,
    totalCount: count || 0,
    limit,
    offset,
    observations: data || [],
  });
});

// Dashboard compatibility observation & climate routes (Real persisted data — NO fake static numbers)
app.get('/api/nasa/observations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farm = await getAccessibleFarmById(farmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  const summary = await getFarmNasaObservationsSummary(client, farm.id);
  const smap = summary.cmrGranulesByDataset.smap;
  const gpm = summary.cmrGranulesByDataset.gpm;
  const modis = summary.cmrGranulesByDataset.modis;
  const ecostress = summary.cmrGranulesByDataset.ecostress;

  res.json({
    farmId: farm.id,
    farmName: farm.name,
    coordinates: farm.coordinates,
    catalog: nasaHarmonizedRoadmap,
    summary,
    realTimeMetrics: {
      solarInsolationPOWER: summary.hasPowerData
        ? {
            status: 'synced',
            dailyRadiation: summary.meanSolarRadiationMj,
            unit: 'MJ/m²/day',
            meanTempC: summary.meanTempC,
            precipTotalMm: summary.precipTotalMm,
            growingDegreeDays: summary.growingDegreeDaysBase10C,
            daysObserved: summary.dailyTimeline.length,
            sensor: 'NASA POWER Agroclimatology (0.5°)',
            timestamp: summary.powerLastRetrievedAt,
          }
        : {
            status: 'not_synced',
            dailyRadiation: null,
            unit: 'MJ/m²/day',
            growingDegreeDays: null,
            sensor: 'NASA POWER Agroclimatology (0.5°)',
            notice: 'Click "Sync NASA POWER" to fetch live daily agroclimatology for this parcel.',
          },
      soilMoistureSMAP: {
        status: smap?.latestGranuleId ? 'granule_metadata_only' : 'not_synced',
        value: null,
        unit: 'm³/m³',
        latestGranuleId: smap?.latestGranuleId || null,
        granuleTimestamp: smap?.latestTimeStart || null,
        sensor: 'SMAP L4 (9km EASE-Grid 2.0)',
        notice: 'Numeric HDF5 moisture pixel extraction requires Earthdata Login token.',
      },
      precipitationGPM: {
        status: summary.hasPowerData ? 'power_precip_available' : gpm?.latestGranuleId ? 'granule_metadata_only' : 'not_synced',
        value30DayTotal: summary.precipTotalMm,
        unit: 'mm',
        latestGranuleId: gpm?.latestGranuleId || null,
        sensor: summary.hasPowerData ? 'NASA POWER PRECTOTCORR + GPM CMR' : 'GPM IMERG Late (0.1°)',
        timestamp: summary.powerLastRetrievedAt || gpm?.retrievedAt || null,
      },
      vegetationNDVI: {
        status: modis?.latestGranuleId ? 'granule_metadata_only' : 'not_synced',
        currentNDVI: null,
        latestGranuleId: modis?.latestGranuleId || null,
        granuleTimestamp: modis?.latestTimeStart || null,
        sensor: 'MODIS MOD13Q1 (250m)',
        notice: 'Numeric NDVI raster extraction requires Earthdata Login HDF-EOS reader.',
      },
      evapotranspirationECOSTRESS: {
        status: ecostress?.latestGranuleId ? 'granule_metadata_only' : 'not_synced',
        waterStressIndex: null,
        latestGranuleId: ecostress?.latestGranuleId || null,
        granuleTimestamp: ecostress?.latestTimeStart || null,
        sensor: 'ECOSTRESS ISS (70m)',
        notice: 'Numeric thermal ET GeoTIFF extraction requires Earthdata Login token.',
      },
    },
  });
});

app.get('/api/climate/timeline', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farm = await getAccessibleFarmById(farmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  const summary = await getFarmNasaObservationsSummary(client, farm.id);

  res.json({
    farmId: farm.id,
    farmName: farm.name,
    hasLivePowerData: summary.hasPowerData,
    lastRetrievedAt: summary.powerLastRetrievedAt,
    timeline: summary.dailyTimeline.map((d) => ({
      date: d.date,
      rainfallMm: d.precipMm,
      tempMeanC: d.t2m,
      tempMaxC: d.t2mMax,
      tempMinC: d.t2mMin,
      humidityPct: d.rh2m,
      solarRadiationMj: d.solarMj,
    })),
    provenance: summary.hasPowerData
      ? 'NASA Langley POWER Agroclimatology Daily Point API (0.5° grid)'
      : 'No NASA POWER records synced yet for this parcel.',
  });
});

app.get('/api/soil/profiles', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const user = req.authUser!;
  const farm = await getAccessibleFarmById(farmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  res.json({
    farmId: farm.id,
    soilType: farm.soilType,
    metrics: {
      pH: { value: farm.soilPH, targetRange: '6.2 - 6.8', status: farm.soilPH >= 6.0 && farm.soilPH <= 7.2 ? 'Optimal' : 'Needs Calibration' },
      organicMatter: { value: farm.organicMatter, unit: '%', status: farm.organicMatter >= 3.5 ? 'Good' : 'Building' },
      nitrogen: { value: farm.nitrogen, recommendation: 'Supplement with winter legume green manure if below 20 ppm' },
      phosphorus: { value: farm.phosphorus, recommendation: 'Verify banded P fertility rates with local soil lab' },
      potassium: { value: farm.potassium, recommendation: 'Monitor K removal under high-biomass forage harvests' },
      drainageClass: farm.drainage,
      lastTestDate: farm.lastSoilTest,
    },
    provenance: 'Farmer-entered & laboratory soil test record (segregated from satellite data)',
    limitations: [
      'Satellite radiometry (SMAP 9km) cannot measure soil pH, phosphorus, potassium, or field-tile drainage.',
      'Periodic laboratory soil cores remain mandatory for nutrient prescription accuracy.',
    ],
  });
});

app.get('/api/risk/field-analysis', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farm = await getAccessibleFarmById(farmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  const summary = await getFarmNasaObservationsSummary(client, farm.id);
  const indicators = [];

  if (summary.hasPowerData && summary.maxTempC !== null) {
    const heatScore = summary.maxTempC >= 34 ? 72 : summary.maxTempC >= 28 ? 44 : 20;
    indicators.push({
      name: 'Observed Thermal Heat Exposure',
      level: heatScore >= 65 ? 'HIGH' : heatScore >= 40 ? 'MODERATE' : 'LOW',
      score: heatScore,
      dataSource: 'NASA POWER Daily Agroclimatology (Synced)',
      observation: `Synced window peak temperature: ${summary.maxTempC}°C (mean ${summary.meanTempC}°C).`,
    });
  } else {
    indicators.push({
      name: 'Observed Thermal Heat Exposure',
      level: 'MODERATE',
      score: null,
      dataSource: 'NASA POWER (Not Yet Synced)',
      observation: 'Sync NASA POWER observations to calculate parcel thermal stress from live daily temperatures.',
    });
  }

  if (summary.hasPowerData && summary.precipTotalMm !== null) {
    const rainRisk = summary.precipTotalMm < 15 ? 65 : summary.precipTotalMm > 140 ? 55 : 25;
    indicators.push({
      name: 'Precipitation Deficit / Excess Runoff Risk',
      level: rainRisk >= 60 ? 'HIGH' : rainRisk >= 40 ? 'MODERATE' : 'LOW',
      score: rainRisk,
      dataSource: 'NASA POWER PRECTOTCORR (Synced)',
      observation: `Cumulative ${summary.dailyTimeline.length}-day precipitation: ${summary.precipTotalMm} mm.`,
    });
  } else {
    indicators.push({
      name: 'Precipitation Deficit / Excess Runoff Risk',
      level: 'MODERATE',
      score: null,
      dataSource: 'NASA POWER / GPM (Not Yet Synced)',
      observation: 'Sync NASA POWER to inspect cumulative precipitation over the recent window.',
    });
  }

  indicators.push({
    name: 'Organic Matter Moisture Buffer',
    level: farm.organicMatter < 2.5 ? 'HIGH' : farm.organicMatter < 3.5 ? 'MODERATE' : 'LOW',
    score: farm.organicMatter < 2.5 ? 68 : farm.organicMatter < 3.5 ? 42 : 22,
    dataSource: `Persisted Farm Soil Record (${farm.soilType})`,
    observation: `Measured soil organic matter of ${farm.organicMatter}% with ${farm.drainage} hydrology.`,
  });

  res.json({
    farmId: farm.id,
    hasLivePowerData: summary.hasPowerData,
    indicators,
    scientificNotice:
      'NASA POWER grid cells (~50 km) do not capture field-level frost pockets or tile drainage variations.',
  });
});

app.get('/api/analysis/bare-field', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farm = await getAccessibleFarmById(farmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  const summary = await getFarmNasaObservationsSummary(client, farm.id);
  res.json({
    farmId: farm.id,
    farmName: farm.name,
    analysis: buildBareFieldAnalysis(farm, summary),
    scientificMethodology:
      'Bare-field windows combine crop calendar residue persistence benchmarks with synced NASA climate records.',
  });
});

app.get('/api/analysis/pest-cycles', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const user = req.authUser!;
  const farm = await getAccessibleFarmById(farmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  res.json({
    farmId: farm.id,
    evaluations: buildPestCycles(farm),
    botanicalFamiliesUtilized: [
      { family: 'Poaceae', commonName: 'Grasses / Cereals', crops: ['Corn', 'Cereal Rye', 'Sorghum', 'Triticale'] },
      { family: 'Fabaceae', commonName: 'Legumes / Pulses', crops: ['Soybeans', 'Hairy Vetch', 'Crimson Clover', 'Field Peas', 'Alfalfa'] },
      { family: 'Asteraceae', commonName: 'Composites', crops: ['Sunflowers'] },
    ],
  });
});

/* ==========================================================================
   7. CROP ROTATION ENGINE & PERSISTED ASSESSMENTS (Protected)
   ========================================================================== */

app.get('/api/rotations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : undefined;

  let query = client
    .from('rotation_assessments')
    .select('*, rotation_scenarios(id, name, priorities, scenario_params, is_hypothetical, created_at)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (farmId) {
    query = query.eq('farm_id', farmId);
  }

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: 'Failed to retrieve saved rotation assessments.' });
    return;
  }

  res.json({ rotations: data || [] });
});

app.post('/api/rotations', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = parseBody(rotationCreateSchema, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farm = await getAccessibleFarmById(parsed.data.farmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  const effectivePriorities = parsed.data.priorities || DEFAULT_PRIORITIES;
  const scenario = parsed.data.scenario || null;
  const nasaSummary = await getFarmNasaObservationsSummary(client, farm.id);
  const evaluation = calculateStrategyEvaluations(farm, effectivePriorities, scenario, nasaSummary);

  const { data: scenarioRow, error: scenErr } = await client
    .from('rotation_scenarios')
    .insert({
      farm_id: farm.id,
      user_id: user.id,
      name: parsed.data.name,
      priorities: effectivePriorities,
      scenario_params: scenario,
      is_hypothetical: Boolean(scenario),
    })
    .select('*')
    .single();

  if (scenErr || !scenarioRow) {
    logEvent('Rotations', 'SCENARIO_INSERT_ERROR', { error: scenErr?.message });
    res.status(500).json({ error: 'Failed to save rotation scenario.' });
    return;
  }

  const { data: assessmentRow, error: assessErr } = await client
    .from('rotation_assessments')
    .insert({
      scenario_id: scenarioRow.id,
      farm_id: farm.id,
      user_id: user.id,
      strategies: evaluation.strategies,
      ranking_explanation: evaluation.rankingExplanation,
      nasa_evidence_summary: evaluation.nasaEvidenceSummary,
      missing_data_notices: evaluation.missingDataNotices,
    })
    .select('*')
    .single();

  if (assessErr || !assessmentRow) {
    logEvent('Rotations', 'ASSESSMENT_INSERT_ERROR', { error: assessErr?.message });
    res.status(500).json({ error: 'Failed to save rotation assessment.' });
    return;
  }

  res.status(201).json({
    success: true,
    scenario: scenarioRow,
    assessment: assessmentRow,
    ...evaluation,
  });
});

app.get('/api/rotations/strategies', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farm = await getAccessibleFarmById(farmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  const nasaSummary = await getFarmNasaObservationsSummary(client, farm.id);
  const evaluation = calculateStrategyEvaluations(farm, DEFAULT_PRIORITIES, null, nasaSummary);

  res.json({
    farmId: farm.id,
    currentCrop: farm.currentCrop,
    soilType: farm.soilType,
    ...evaluation,
    disclaimer:
      'Percentage scores are model-derived indicators based on persisted NASA observations, soil records, and farmer priorities. They do not guarantee field-scale yields.',
  });
});

app.get('/api/rotations/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.authUser!;
  const client = req.supabaseUserClient!;

  const { data, error } = await client
    .from('rotation_assessments')
    .select('*, rotation_scenarios(*)')
    .eq('id', req.params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) {
    res.status(404).json({ error: 'Saved rotation assessment not found.' });
    return;
  }

  res.json({ rotation: data });
});

app.post(['/api/rotations/recalculate', '/api/rotations/compare', '/api/rotations/assess'], requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { farmId, priorities, scenario, save, name } = req.body || {};
  const targetFarmId = typeof farmId === 'string' && farmId.trim() ? farmId.trim() : 'farm-1';
  const user = req.authUser!;
  const client = req.supabaseUserClient!;

  const farm = await getAccessibleFarmById(targetFarmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  const parsedPrio = priorities ? parseBody(prioritiesSchema, priorities) : { ok: true as const, data: DEFAULT_PRIORITIES };
  if (!parsedPrio.ok) {
    res.status(400).json({ error: parsedPrio.error });
    return;
  }

  let parsedScen = null;
  if (scenario) {
    const sRes = parseBody(scenarioSchema, scenario);
    if (!sRes.ok) {
      res.status(400).json({ error: sRes.error });
      return;
    }
    parsedScen = sRes.data;
  }

  const nasaSummary = await getFarmNasaObservationsSummary(client, farm.id);
  const evaluation = calculateStrategyEvaluations(farm, parsedPrio.data, parsedScen, nasaSummary);

  let savedAssessmentId: string | null = null;
  if (save || req.path.endsWith('/assess')) {
    const { data: scenRow } = await client
      .from('rotation_scenarios')
      .insert({
        farm_id: farm.id,
        user_id: user.id,
        name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 140) : 'Rotation Assessment',
        priorities: parsedPrio.data,
        scenario_params: parsedScen,
        is_hypothetical: Boolean(parsedScen),
      })
      .select('id')
      .single();

    const { data: assessRow } = await client
      .from('rotation_assessments')
      .insert({
        scenario_id: scenRow?.id || null,
        farm_id: farm.id,
        user_id: user.id,
        strategies: evaluation.strategies,
        ranking_explanation: evaluation.rankingExplanation,
        nasa_evidence_summary: evaluation.nasaEvidenceSummary,
        missing_data_notices: evaluation.missingDataNotices,
      })
      .select('id')
      .single();

    savedAssessmentId = assessRow?.id || null;
  }

  res.json({
    farmId: farm.id,
    priorities: parsedPrio.data,
    scenarioApplied: parsedScen,
    savedAssessmentId,
    ...evaluation,
    disclaimer:
      'Rankings reflect deterministic multi-criteria decision analysis based on farmer inputs and persisted NASA observations.',
  });
});

/* ==========================================================================
   8. AI AGRICULTURAL ADVISOR ROUTES (Protected + History Persisted)
   ========================================================================== */

app.post(['/api/ai/advisor', '/api/gemini/advisor', '/api/advisor'], requireAuth, aiAdvisorRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = parseBody(advisorRequestSchema, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const targetFarmId = parsed.data.farmId || 'farm-1';

  const farm = await getAccessibleFarmById(targetFarmId, user);
  if (!farm) {
    res.status(404).json({ error: 'Farm not found or access denied.' });
    return;
  }

  const nasaSummary = await getFarmNasaObservationsSummary(client, farm.id);
  const result = await runGroundedAdvisor({
    farm,
    prompt: parsed.data.prompt,
    priorities: parsed.data.priorities,
    scenario: parsed.data.scenario,
    nasaSummary,
    userClient: client,
    userId: user.id,
  });

  res.json(result);
});

app.get('/api/ai/history', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : undefined;

  let query = client
    .from('ai_advisor_history')
    .select('id, farm_id, prompt, reply, model_source, is_fallback, fallback_reason, latency_ms, grounding_summary, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (farmId) {
    query = query.eq('farm_id', farmId);
  }

  const { data, error } = await query;
  if (error) {
    res.status(500).json({ error: 'Failed to retrieve AI advisor history.' });
    return;
  }

  res.json({ history: data || [] });
});

/* ==========================================================================
   9. SEO & CATCH-ALL JSON 404 + CENTRAL ERROR HANDLER
   ========================================================================== */

app.get('/robots.txt', (_req: Request, res: Response) => {
  const robotsPath = path.resolve(process.cwd(), 'public', 'robots.txt');
  if (fs.existsSync(robotsPath)) {
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(robotsPath);
  } else {
    res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /dashboard\n');
  }
});

app.get('/sitemap.xml', (_req: Request, res: Response) => {
  const sitemapPath = path.resolve(process.cwd(), 'public', 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.sendFile(sitemapPath);
  } else {
    res.status(404).send('Sitemap not found');
  }
});

app.all(['/api', '/api/*'], (req: Request, res: Response) => {
  res.status(404).json({
    error: `API endpoint '${req.method} ${req.path}' not found.`,
    status: 404,
  });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logEvent('Express', 'UNHANDLED_ERROR', { message: err?.message || 'Unexpected error' });
  res.status(500).json({
    error: 'Internal server error.',
  });
});

export default app;
