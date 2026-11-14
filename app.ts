import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  authenticateRequestContext,
  AuthenticatedRequest,
  authorizeNasaFarmAccess,
  extractRequestToken,
  getAccessibleFarmById,
  getAuthorizedIngestionJob,
  getSupabaseAdminClient,
  getSupabaseAuthClient,
  getSupabasePublishableKey,
  getSupabasePublicClient,
  getSupabaseUrl,
  getSupabaseUserClient,
  isSupabaseConfigured,
  listAccessibleFarms,
  mapDbFarmRow,
  requireAccessibleFarm,
  requireAuth,
} from './backend/supabase.js';
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
} from './backend/validation.js';
import {
  buildBareFieldAnalysis,
  buildPestCycles,
  calculateStrategyEvaluations,
  cropDatabase,
  DEFAULT_PRIORITIES,
  scientificMethods,
  supplementalIncomeOpportunities,
} from './backend/agronomy.js';
import {
  celsiusToFahrenheit,
  getFarmNasaObservationsSummary,
  getNasaCacheStats,
  ingestAllAvailableForFarm,
  mapDbObservationToCanonical,
  mmToInches,
  mpsToMph,
  nasaHarmonizedRoadmap,
  resolveFarmGeometry,
  SUPPORTED_SYNC_DATASETS,
  SupportedSyncDataset,
  syncEarthdataCmrForFarm,
  syncModisForFarm,
  syncNasaPowerForFarm,
} from './backend/nasa.js';
import { CMR_PRODUCT_MAP, POWER_PARAMETERS, SupportedCmrDataset } from './backend/nasa/providers.js';
import { NasaUpstreamError, validateDateRange } from './backend/nasa/units-and-quality.js';
import { getNasaIntegrationCapabilities, getServerEnv } from './backend/env.js';
import { getGeminiClient, runGroundedAdvisor } from './backend/gemini.js';
import { logEvent, logGeminiEvent } from './backend/logger.js';

dotenv.config();
getServerEnv();

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
  if (/^https:\/\/[a-z0-9.-]+\.run\.app$/i.test(origin)) return true;
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

  const envSummary = getServerEnv();
  const nasaCapabilities = getNasaIntegrationCapabilities();

  res.json({
    status: !envSummary.supabaseConfigured || supabaseReachable ? 'healthy' : 'degraded',
    platform: 'FieldShift Agricultural Intelligence Platform',
    version: '2.7.0',
    runtime: process.env.VERCEL ? 'vercel-serverless' : 'node-express',
    supabaseConfigured: envSummary.supabaseConfigured,
    supabaseReachable,
    geminiConfigured: Boolean(getGeminiClient()),
    nasaApiKeyConfigured: envSummary.nasaApiKeyConfigured,
    earthdataTokenConfigured: envSummary.earthdataTokenConfigured,
    nasaCapabilities,
    nasaCacheStats: getNasaCacheStats(),
    nasaPowerEndpoint: 'https://power.larc.nasa.gov/api/temporal/daily/point',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/nasa/health', async (_req: Request, res: Response) => {
  const envSummary = getServerEnv();
  const capabilities = getNasaIntegrationCapabilities();
  const missingCredentials: string[] = [];
  if (!envSummary.earthdataTokenConfigured) {
    missingCredentials.push('EARTHDATA_TOKEN (optional; needed only for authenticated HDF5/NetCDF4 binary pixel downloads on SMAP/GPM/ECOSTRESS)');
  }
  if (!envSummary.nasaApiKeyConfigured) {
    missingCredentials.push('NASA_API_KEY (optional; not required by NASA POWER, ORNL DAAC MODIS, or Earthdata CMR)');
  }

  res.json({
    status: 'operational',
    providers: capabilities,
    cacheStats: getNasaCacheStats(),
    environment: {
      supabaseConfigured: envSummary.supabaseConfigured,
      geminiConfigured: envSummary.geminiConfigured,
      nasaApiKeyConfigured: envSummary.nasaApiKeyConfigured,
      earthdataTokenConfigured: envSummary.earthdataTokenConfigured,
    },
    missingOptionalCredentials: missingCredentials,
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

app.get(['/api/datasets', '/api/nasa/roadmap', '/api/nasa/sources'], async (_req: Request, res: Response) => {
  const pubClient = getSupabasePublicClient();
  let dbDatasets: any[] | null = null;
  if (pubClient) {
    const { data, error } = await pubClient.from('nasa_datasets').select('*').order('id');
    if (!error && data && data.length > 0) {
      dbDatasets = data;
    }
  }

  const capabilities = getNasaIntegrationCapabilities();

  res.json({
    totalMissions: nasaHarmonizedRoadmap.length,
    datasets: nasaHarmonizedRoadmap,
    capabilities,
    powerParameters: POWER_PARAMETERS,
    cmrProducts: CMR_PRODUCT_MAP,
    persistedCatalog: dbDatasets || [],
    supportedSyncEndpoints: SUPPORTED_SYNC_DATASETS.map((ds) => ({
      id: ds,
      syncPath: `/api/datasets/${ds}/sync`,
      observationsPath: `/api/datasets/${ds}/observations`,
      accessMode: capabilities[ds]?.mode || (ds === 'nasa-power' || ds === 'modis' ? 'live_public_api' : 'granule_metadata_only'),
    })),
    harmonizationArchitecture: {
      spatialResampling: 'Coarse grids (50km POWER, 10km GPM, 9km SMAP, 250m MODIS) are explicitly labeled and never claimed as sub-field measurements.',
      temporalAlignment: 'Daily/Monthly NASA POWER series, 16-day MODIS composites, and CMR granule timestamps preserved in UTC ISO-8601.',
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

  const supaAuth = isSupabaseConfigured() ? getSupabaseAuthClient() : null;
  if (!supaAuth) {
    res.status(503).json({
      error: 'Supabase authentication service is not configured.',
      code: 'SUPABASE_UNCONFIGURED',
    });
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
      const isDuplicate = /already registered|already exists/i.test(error.message);
      res.status(isDuplicate ? 409 : 400).json({
        error: isDuplicate
          ? 'An account with this email already exists. Please sign in instead.'
          : error.message,
        code: isDuplicate ? 'USER_ALREADY_EXISTS' : 'SIGNUP_FAILED',
      });
      return;
    }

    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      res.status(409).json({
        error: 'An account with this email already exists. Please sign in instead.',
        code: 'USER_ALREADY_EXISTS',
      });
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
      message: 'We sent a 6-digit verification code to your email address.',
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

  const supaAuth = isSupabaseConfigured() ? getSupabaseAuthClient() : null;
  if (!supaAuth) {
    res.status(503).json({
      error: 'Supabase authentication service is not configured.',
      code: 'SUPABASE_UNCONFIGURED',
    });
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
        verified: Boolean(data.user.email_confirmed_at),
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

  const supaAuth = isSupabaseConfigured() ? getSupabaseAuthClient() : null;
  if (!supaAuth) {
    res.status(503).json({
      error: 'Supabase authentication service is not configured.',
      code: 'SUPABASE_UNCONFIGURED',
    });
    return;
  }

  try {
    const { error } = await supaAuth.auth.resend({
      type: 'signup',
      email: parsed.data.email.toLowerCase(),
    });
    if (error) {
      const isRateLimit =
        (error as any).status === 429 ||
        /rate limit|security purposes|only request this after/i.test(error.message);
      res.status(isRateLimit ? 429 : 400).json({
        error: error.message,
        code: isRateLimit ? 'RATE_LIMITED' : 'RESEND_FAILED',
      });
      return;
    }
    res.json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email address.',
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

  const supaAuth = isSupabaseConfigured() ? getSupabaseAuthClient() : null;
  if (!supaAuth) {
    res.status(503).json({
      error: 'Supabase authentication service is not configured.',
      code: 'SUPABASE_UNCONFIGURED',
    });
    return;
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  try {
    const { data, error } = await supaAuth.auth.signInWithPassword({
      email: normalizedEmail,
      password: parsed.data.password,
    });

    if (error || !data?.session || !data?.user) {
      const msg = error?.message || 'Invalid login credentials.';
      const isUnconfirmed = /email not confirmed|confirm your email/i.test(msg);
      res.status(isUnconfirmed ? 403 : 401).json({
        error: isUnconfirmed
          ? 'Your email address has not been verified yet. Please enter your 6-digit verification code or request a new code.'
          : msg,
        code: isUnconfirmed ? 'EMAIL_NOT_CONFIRMED' : 'INVALID_CREDENTIALS',
      });
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
  if (!isSupabaseConfigured()) {
    res.status(503).json({
      error: 'Supabase authentication service is not configured.',
      code: 'SUPABASE_UNCONFIGURED',
    });
    return;
  }

  const authCtx = await authenticateRequestContext(req);
  if (!authCtx.user) {
    res.status(401).json({
      error: authCtx.tokenInvalid
        ? 'Invalid or expired authentication token. Please sign in again.'
        : 'No active valid session.',
      code: authCtx.tokenInvalid ? 'AUTH_INVALID_TOKEN' : 'AUTH_REQUIRED',
    });
    return;
  }

  res.json({
    success: true,
    user: {
      id: authCtx.user.id,
      email: authCtx.user.email,
      fullName: authCtx.user.fullName,
      verified: authCtx.user.verified,
    },
  });
});

const authLogoutPaths = ['/api/auth/logout', '/api/v1/auth/logout', '/auth/logout', '/api/logout', '/logout'];
app.post(authLogoutPaths, async (req: Request, res: Response) => {
  const token = extractRequestToken(req);
  const supaUrl = (getSupabaseUrl() || '').replace(/\/$/, '');
  const pubKey = getSupabasePublishableKey() || '';

  if (token && supaUrl && pubKey) {
    try {
      await fetch(`${supaUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: pubKey,
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Cookie clearing below still completes logout cleanly
    }
  }
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

  const supaAuth = isSupabaseConfigured() ? getSupabaseAuthClient() : null;
  if (!supaAuth) {
    res.status(503).json({
      error: 'Supabase authentication service is not configured.',
      code: 'SUPABASE_UNCONFIGURED',
    });
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
  const farm = await requireAccessibleFarm(res, req.params.id, req.authUser!);
  if (!farm) return;
  res.json({ farm });
});

app.patch('/api/farms/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = parseBody(updateFarmSchema, req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const existing = await requireAccessibleFarm(res, req.params.id, user);
  if (!existing) return;

  if (existing.isDemo || existing.userId !== user.id) {
    res.status(403).json({ error: 'Only your own registered farm properties can be edited.', code: 'FARM_ACCESS_DENIED' });
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
  const existing = await requireAccessibleFarm(res, req.params.id, user);
  if (!existing) return;

  if (existing.isDemo || existing.userId !== user.id) {
    res.status(403).json({
      error: 'Baseline demonstration farms and farms owned by other users cannot be deleted.',
      code: 'FARM_ACCESS_DENIED',
    });
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

  const farm = await requireAccessibleFarm(res, farmId, user);
  if (!farm) return;

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
  const farm = await requireAccessibleFarm(res, farmId.trim(), user);
  if (!farm) return;

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
   6. NASA DATASET INGESTION & OBSERVATION ROUTES
      (Authenticated User Farms OR Explicitly Verified Baseline Demo Farms)
   ========================================================================== */

app.get('/api/datasets/status', async (req: Request, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const auth = await authorizeNasaFarmAccess(req, res, farmId);
  if (!auth) return;

  const [summary, jobsRes] = await Promise.all([
    getFarmNasaObservationsSummary(auth.readClient, auth.farm.id, auth.cacheScope),
    auth.readClient
      .from('ingestion_jobs')
      .select('*')
      .eq('farm_id', auth.farm.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  res.json({
    farmId: auth.farm.id,
    farmName: auth.farm.name,
    accessMode: auth.mode,
    coordinates: auth.farm.coordinates,
    summary,
    recentJobs: jobsRes.data || [],
  });
});

app.post('/api/datasets/:dataset/sync', nasaSyncRateLimit, async (req: Request, res: Response) => {
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

  const auth = await authorizeNasaFarmAccess(req, res, parsed.data.farmId);
  if (!auth) return;

  try {
    if (dataset === 'nasa-power') {
      const result = await syncNasaPowerForFarm(auth.writeClient, auth.ownerUserId, auth.farm, {
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        days: parsed.data.days,
        resolution: parsed.data.resolution,
      });
      res.json({ success: true, metadataOnly: false, accessMode: auth.mode, ...result });
      return;
    }

    if (dataset === 'modis') {
      const result = await syncModisForFarm(auth.writeClient, auth.ownerUserId, auth.farm);
      const hasNumeric = Number(result.numericPixelCount || 0) > 0;
      res.json({
        success: hasNumeric,
        metadataOnly: !hasNumeric,
        accessMode: auth.mode,
        ...result,
      });
      return;
    }

    const result = await syncEarthdataCmrForFarm(
      auth.writeClient,
      auth.ownerUserId,
      auth.farm,
      dataset as SupportedCmrDataset
    );
    res.json({
      success: false,
      discoverySuccess: true,
      metadataOnly: true,
      numericObservationsPersisted: false,
      accessMode: auth.mode,
      ...result,
    });
  } catch (err: any) {
    const status = err instanceof NasaUpstreamError ? err.status : 502;
    res.status(status).json({
      error: `Failed to sync ${dataset}: ${err?.message || 'Upstream NASA request failed'}`,
      code: err instanceof NasaUpstreamError ? err.code : 'NASA_SYNC_FAILED',
    });
  }
});

app.get('/api/datasets/:dataset/observations', async (req: Request, res: Response) => {
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

  const auth = await authorizeNasaFarmAccess(req, res, farmId);
  if (!auth) return;

  const { data, count, error } = await auth.readClient
    .from('nasa_observations')
    .select('*', { count: 'exact' })
    .eq('farm_id', auth.farm.id)
    .eq('dataset_id', dataset)
    .order('observed_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    res.status(500).json({ error: 'Failed to retrieve NASA observations.' });
    return;
  }

  res.json({
    farmId: auth.farm.id,
    dataset,
    accessMode: auth.mode,
    totalCount: count || 0,
    limit,
    offset,
    observations: data || [],
    canonicalObservations: (data || []).map(mapDbObservationToCanonical),
  });
});

// Unified per-farm NASA observation query endpoint with date & dataset filtering
app.get('/api/nasa/observations/:farmId', async (req: Request, res: Response) => {
  const farmId = req.params.farmId?.trim() || '';
  if (!farmId) {
    res.status(400).json({ error: 'farmId path parameter is required.' });
    return;
  }

  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined;
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined;
  if (startDate || endDate) {
    const check = validateDateRange(startDate, endDate, 730);
    if (!check.valid) {
      res.status(400).json({ error: check.error });
      return;
    }
  }

  const dataset = typeof req.query.dataset === 'string' ? req.query.dataset.trim() : undefined;
  const parameter = typeof req.query.parameter === 'string' ? req.query.parameter.trim() : undefined;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);

  const auth = await authorizeNasaFarmAccess(req, res, farmId);
  if (!auth) return;

  let query = auth.readClient
    .from('nasa_observations')
    .select('*', { count: 'exact' })
    .eq('farm_id', auth.farm.id)
    .order('observed_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (dataset) query = query.eq('dataset_id', dataset);
  if (parameter) query = query.eq('variable', parameter);
  if (startDate) query = query.gte('observed_at', `${startDate}T00:00:00.000Z`);
  if (endDate) query = query.lte('observed_at', `${endDate}T23:59:59.999Z`);

  const { data, count, error } = await query;
  if (error) {
    res.status(500).json({ error: 'Failed to query persisted NASA observations.' });
    return;
  }

  const geometry = resolveFarmGeometry({ coordinates: auth.farm.coordinates });
  res.json({
    farmId: auth.farm.id,
    farmName: auth.farm.name,
    accessMode: auth.mode,
    geometry,
    totalCount: count || 0,
    limit,
    offset,
    observations: (data || []).map(mapDbObservationToCanonical),
  });
});

// Unified full-ingestion endpoint across NASA POWER, MODIS ORNL DAAC, SMAP, GPM & ECOSTRESS CMR
app.post('/api/nasa/ingest/:farmId', nasaSyncRateLimit, async (req: Request, res: Response) => {
  const farmId = req.params.farmId?.trim() || '';
  if (!farmId) {
    res.status(400).json({ error: 'farmId is required.' });
    return;
  }

  const daysRaw = req.body?.days !== undefined ? Number(req.body.days) : 30;
  if (!Number.isInteger(daysRaw) || daysRaw < 1 || daysRaw > 90) {
    res.status(400).json({ error: 'days must be an integer between 1 and 90.' });
    return;
  }

  const auth = await authorizeNasaFarmAccess(req, res, farmId);
  if (!auth) return;

  const geometry = resolveFarmGeometry({ coordinates: auth.farm.coordinates });
  const { data: parentJobRow } = await auth.writeClient
    .from('ingestion_jobs')
    .insert({
      farm_id: auth.farm.id,
      user_id: auth.ownerUserId,
      dataset_id: 'all-nasa',
      source_code: 'NASA MULTI-MISSION INGEST',
      status: 'running',
      metadata: {
        days: daysRaw,
        latitude: geometry.latitude,
        longitude: geometry.longitude,
        spatialMethod: geometry.spatialMethod,
        accessMode: auth.mode,
      },
    })
    .select('*')
    .single();

  const outcomes = await ingestAllAvailableForFarm(auth.writeClient, auth.ownerUserId, auth.farm, {
    days: daysRaw,
  });
  const summary = await getFarmNasaObservationsSummary(auth.readClient, auth.farm.id, auth.cacheScope);

  const outcomeList = Object.entries(outcomes);
  const powerSaved = outcomes['nasa-power']?.ok ? Number(outcomes['nasa-power']?.recordsSaved || 0) : 0;
  const modisPixels = Number(outcomes.modis?.numericPixelCount || 0);
  const numericRecordsSaved = powerSaved + modisPixels;
  const metadataGranulesFound = ['smap', 'gpm', 'modis', 'ecostress'].reduce(
    (sum, ds) => sum + Number(outcomes[ds]?.granulesFound || 0),
    0
  );
  const totalSaved = outcomeList.reduce((sum, [, v]) => sum + Number(v?.recordsSaved || 0), 0);
  const totalReceived = outcomeList.reduce((sum, [, v]) => sum + Number(v?.recordsReceived || 0), 0);
  const failedDatasets = outcomeList
    .filter(([, v]) => !v?.ok)
    .map(([k, v]) => ({ dataset: k, status: v?.status || 'failed', error: v?.error || v?.ornlError || 'Sync failed' }));
  const jobIds = Object.fromEntries(
    outcomeList.map(([k, v]) => [k, v?.jobId || null])
  );

  // Never report successful ingestion when only metadata was discovered and zero numeric observations were persisted
  if (numericRecordsSaved === 0) {
    const metadataOnly = metadataGranulesFound > 0;
    const jobStatus = metadataOnly ? 'partial' : 'failed';
    const errorMessage = metadataOnly
      ? 'No numeric NASA observations were retrieved; only Earthdata CMR granule metadata was discovered.'
      : 'All NASA upstream ingestion requests failed.';

    if (parentJobRow?.id) {
      await auth.writeClient
        .from('ingestion_jobs')
        .update({
          status: jobStatus,
          records_received: totalReceived,
          records_saved: totalSaved,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
          metadata: {
            days: daysRaw,
            numericRecordsSaved,
            metadataGranulesFound,
            jobIds,
            failedDatasets,
          },
        })
        .eq('id', parentJobRow.id);
    }

    res.status(502).json({
      success: false,
      metadataOnly,
      error: errorMessage,
      code: metadataOnly ? 'NASA_METADATA_ONLY_NO_OBSERVATIONS' : 'NASA_ALL_INGEST_FAILED',
      farmId: auth.farm.id,
      farmName: auth.farm.name,
      accessMode: auth.mode,
      jobId: parentJobRow?.id || null,
      jobStatus,
      jobIds,
      numericRecordsSaved: 0,
      metadataGranulesFound,
      failedDatasets,
      outcomes,
      summary,
    });
    return;
  }

  const jobStatus = failedDatasets.length > 0 ? 'partial' : 'completed';
  if (parentJobRow?.id) {
    await auth.writeClient
      .from('ingestion_jobs')
      .update({
        status: jobStatus,
        records_received: totalReceived,
        records_saved: totalSaved,
        error_message: failedDatasets.length > 0 ? failedDatasets.map((d) => `${d.dataset}: ${d.error}`).join('; ') : null,
        completed_at: new Date().toISOString(),
        metadata: {
          days: daysRaw,
          numericRecordsSaved,
          metadataGranulesFound,
          jobIds,
          failedDatasets,
        },
      })
      .eq('id', parentJobRow.id);
  }

  res.json({
    success: true,
    metadataOnly: false,
    farmId: auth.farm.id,
    farmName: auth.farm.name,
    accessMode: auth.mode,
    geometry,
    jobId: parentJobRow?.id || null,
    jobStatus,
    jobIds,
    numericRecordsSaved,
    metadataGranulesFound,
    partialFailures: failedDatasets,
    outcomes,
    summary,
  });
});

app.get('/api/nasa/ingestion/:jobId', async (req: Request, res: Response) => {
  const jobId = req.params.jobId?.trim() || '';
  const job = await getAuthorizedIngestionJob(req, res, jobId);
  if (!job) return;
  res.json({ job });
});

// Provider-specific NASA endpoints (POWER daily/monthly, MODIS live NDVI/EVI/LST, GPM, SMAP, ECOSTRESS)
app.get('/api/nasa/power', async (req: Request, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const resolution = req.query.resolution === 'monthly' ? 'monthly' : 'daily';
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.trim() : undefined;
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.trim() : undefined;
  const refresh = req.query.refresh === 'true';
  const days = req.query.days ? Math.min(90, Math.max(1, Number(req.query.days))) : 30;

  if (startDate || endDate) {
    const check = validateDateRange(startDate, endDate, 366);
    if (!check.valid) {
      res.status(400).json({ error: check.error });
      return;
    }
  }

  const auth = await authorizeNasaFarmAccess(req, res, farmId);
  if (!auth) return;

  try {
    let syncMeta: any = null;
    if (refresh) {
      syncMeta = await syncNasaPowerForFarm(auth.writeClient, auth.ownerUserId, auth.farm, {
        resolution,
        startDate,
        endDate,
        days,
      });
    }

    const summary = await getFarmNasaObservationsSummary(auth.readClient, auth.farm.id, auth.cacheScope);
    const { data: powerRows } = await auth.readClient
      .from('nasa_observations')
      .select('*')
      .eq('farm_id', auth.farm.id)
      .eq('dataset_id', 'nasa-power')
      .eq('product_id', resolution === 'monthly' ? 'NASA_POWER_AG_MONTHLY' : 'NASA_POWER_AG_DAILY')
      .order('observed_at', { ascending: false })
      .limit(200);

    res.json({
      farmId: auth.farm.id,
      farmName: auth.farm.name,
      accessMode: auth.mode,
      resolution,
      geometry: resolveFarmGeometry({ coordinates: auth.farm.coordinates }),
      capability: getNasaIntegrationCapabilities()['nasa-power'],
      syncMeta,
      metrics: {
        meanTempC: summary.meanTempC,
        meanTempF: summary.meanTempC !== null ? celsiusToFahrenheit(summary.meanTempC) : null,
        precipTotalMm: summary.precipTotalMm,
        precipTotalInches: summary.precipTotalMm !== null ? mmToInches(summary.precipTotalMm) : null,
        meanSolarRadiationMj: summary.meanSolarRadiationMj,
        meanHumidityPct: summary.meanHumidityPct,
        meanWindSpeedMps: summary.meanWindSpeedMps,
        meanWindSpeedMph: summary.meanWindSpeedMps !== null ? mpsToMph(summary.meanWindSpeedMps) : null,
        growingDegreeDaysBase10C: summary.growingDegreeDaysBase10C,
      },
      observations: (powerRows || []).map(mapDbObservationToCanonical),
    });
  } catch (err: any) {
    const status = err instanceof NasaUpstreamError ? err.status : 502;
    res.status(status).json({ error: err?.message || 'Failed to query NASA POWER data.' });
  }
});

app.get('/api/nasa/:provider(modis|gpm|smap|ecostress)', async (req: Request, res: Response) => {
  const provider = req.params.provider as SupportedCmrDataset;
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const refresh = req.query.refresh === 'true';

  const auth = await authorizeNasaFarmAccess(req, res, farmId);
  if (!auth) return;

  try {
    let syncMeta: any = null;
    if (refresh) {
      syncMeta = provider === 'modis'
        ? await syncModisForFarm(auth.writeClient, auth.ownerUserId, auth.farm)
        : await syncEarthdataCmrForFarm(auth.writeClient, auth.ownerUserId, auth.farm, provider);
    }

    const { data: rows, error } = await auth.readClient
      .from('nasa_observations')
      .select('*')
      .eq('farm_id', auth.farm.id)
      .eq('dataset_id', provider)
      .order('observed_at', { ascending: false })
      .limit(60);

    if (error) {
      res.status(500).json({ error: `Failed to retrieve ${provider.toUpperCase()} observations.` });
      return;
    }

    const capabilities = getNasaIntegrationCapabilities();
    const summary = await getFarmNasaObservationsSummary(auth.readClient, auth.farm.id, auth.cacheScope);

    res.json({
      farmId: auth.farm.id,
      farmName: auth.farm.name,
      accessMode: auth.mode,
      provider,
      geometry: resolveFarmGeometry({ coordinates: auth.farm.coordinates }),
      capability: capabilities[provider],
      syncMeta,
      numericSummary:
        provider === 'modis'
          ? {
              hasModisNumericData: summary.hasModisNumericData,
              hasModisMaskedOnly: summary.hasModisMaskedOnly,
              latestNdvi: summary.latestModisNdvi,
              latestEvi: summary.latestModisEvi,
              latestNdviDate: summary.latestModisNdviDate,
              latestQuality: summary.latestModisQuality,
              latestTile: summary.latestModisTile,
              latestLstC: summary.latestModisLstC,
              latestLstDate: summary.latestModisLstDate,
              latestMaskedDate: summary.latestModisMaskedDate,
              latestMaskedQuality: summary.latestModisMaskedQuality,
              latestJobStatus: summary.latestModisJobStatus,
              latestJobError: summary.latestModisJobError,
            }
          : {
              pixelValuesAvailable: false,
              granuleSummary: summary.cmrGranulesByDataset[provider] || null,
              reason:
                capabilities[provider]?.notes ||
                'Numeric raster pixel decoding requires authenticated Earthdata binary download + HDF5/NetCDF4 worker.',
            },
      observations: (rows || []).map(mapDbObservationToCanonical),
    });
  } catch (err: any) {
    const status = err instanceof NasaUpstreamError ? err.status : 502;
    res.status(status).json({ error: err?.message || `Failed to query ${provider.toUpperCase()} data.` });
  }
});

// Dashboard compatibility observation & climate routes (Real persisted data — NO fake static numbers)
app.get('/api/nasa/observations', async (req: Request, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const auth = await authorizeNasaFarmAccess(req, res, farmId);
  if (!auth) return;

  const summary = await getFarmNasaObservationsSummary(auth.readClient, auth.farm.id, auth.cacheScope);
  const geometry = resolveFarmGeometry({ coordinates: auth.farm.coordinates });
  const smap = summary.cmrGranulesByDataset.smap;
  const gpm = summary.cmrGranulesByDataset.gpm;
  const modis = summary.cmrGranulesByDataset.modis;
  const ecostress = summary.cmrGranulesByDataset.ecostress;

  const vegetationNDVI = summary.hasModisNumericData
    ? {
        status: 'synced',
        currentNDVI: summary.latestModisNdvi,
        currentEVI: summary.latestModisEvi,
        lstDayC: summary.latestModisLstC,
        lstDate: summary.latestModisLstDate,
        observedAt: summary.latestModisNdviDate,
        retrievedAt: summary.latestModisRetrievedAt,
        tile: summary.latestModisTile,
        qualityStatus: summary.latestModisQuality,
        spatialResolution: '250 m NDVI/EVI & 1 km LST',
        latestGranuleId: modis?.latestGranuleId || null,
        granuleTimestamp: modis?.latestTimeStart || null,
        sensor: 'MODIS MOD13Q1 (250m) & MOD11A2 (1km) via NASA ORNL DAAC',
      }
    : summary.hasModisMaskedOnly
    ? {
        status: 'quality_masked',
        currentNDVI: null,
        currentEVI: null,
        lstDayC: summary.latestModisLstC,
        lstDate: summary.latestModisLstDate,
        observedAt: summary.latestModisMaskedDate,
        tile: summary.latestModisTile,
        qualityStatus: summary.latestModisMaskedQuality,
        latestGranuleId: modis?.latestGranuleId || null,
        granuleTimestamp: modis?.latestTimeStart || null,
        sensor: 'MODIS MOD13Q1 (250m) via NASA ORNL DAAC',
        notice: `ORNL DAAC composites retrieved (${summary.latestModisMaskedDate}), but pixels were quality-masked (${summary.latestModisMaskedQuality}).`,
      }
    : modis?.latestGranuleId
    ? {
        status: 'granule_metadata_only',
        currentNDVI: null,
        currentEVI: null,
        lstDayC: null,
        latestGranuleId: modis.latestGranuleId,
        granuleTimestamp: modis.latestTimeStart || null,
        ornlError: summary.latestModisJobError || null,
        sensor: 'MODIS MOD13Q1 (250m)',
        notice: summary.latestModisJobError
          ? `Earthdata CMR granule indexed; ORNL DAAC pixel subset unavailable (${summary.latestModisJobError}).`
          : 'Earthdata CMR granule indexed. Run Sync MODIS 250m to retrieve ORNL DAAC numeric NDVI pixels.',
      }
    : summary.latestModisJobStatus === 'failed'
    ? {
        status: 'ingestion_failed',
        currentNDVI: null,
        currentEVI: null,
        lstDayC: null,
        latestGranuleId: null,
        error: summary.latestModisJobError || 'MODIS ORNL DAAC upstream request failed.',
        sensor: 'MODIS MOD13Q1 (250m)',
        notice: summary.latestModisJobError || 'MODIS ingestion failed during last sync attempt.',
      }
    : {
        status: 'not_synced',
        currentNDVI: null,
        currentEVI: null,
        lstDayC: null,
        latestGranuleId: null,
        granuleTimestamp: null,
        sensor: 'MODIS MOD13Q1 (250m)',
        notice: 'Click "Sync MODIS & CMR" or "Ingest All NASA Data" to retrieve live ORNL DAAC NDVI, EVI & pixel reliability.',
      };

  res.json({
    farmId: auth.farm.id,
    farmName: auth.farm.name,
    accessMode: auth.mode,
    coordinates: auth.farm.coordinates,
    geometry,
    capabilities: getNasaIntegrationCapabilities(),
    catalog: nasaHarmonizedRoadmap,
    summary,
    realTimeMetrics: {
      solarInsolationPOWER: summary.hasPowerData
        ? {
            status: 'synced',
            dailyRadiation: summary.meanSolarRadiationMj,
            unit: 'MJ/m²/day',
            meanTempC: summary.meanTempC,
            meanTempF: summary.meanTempC !== null ? celsiusToFahrenheit(summary.meanTempC) : null,
            precipTotalMm: summary.precipTotalMm,
            precipTotalInches: summary.precipTotalMm !== null ? mmToInches(summary.precipTotalMm) : null,
            meanWindSpeedMps: summary.meanWindSpeedMps,
            meanWindSpeedMph: summary.meanWindSpeedMps !== null ? mpsToMph(summary.meanWindSpeedMps) : null,
            growingDegreeDays: summary.growingDegreeDaysBase10C,
            daysObserved: summary.dailyTimeline.length,
            sensor: 'NASA POWER Agroclimatology (0.5°)',
            timestamp: summary.powerLastRetrievedAt,
          }
        : {
            status: 'not_synced',
            dailyRadiation: null,
            unit: 'MJ/m²/day',
            meanWindSpeedMps: null,
            growingDegreeDays: null,
            sensor: 'NASA POWER Agroclimatology (0.5°)',
            notice: 'Click "Sync NASA POWER" or "Ingest All NASA Data" to fetch live daily agroclimatology for this parcel.',
          },
      soilMoistureSMAP: {
        status: smap?.latestGranuleId ? 'granule_metadata_only' : 'not_synced',
        value: null,
        unit: 'm³/m³',
        latestGranuleId: smap?.latestGranuleId || null,
        granuleTimestamp: smap?.latestTimeStart || null,
        sensor: 'SMAP L4 (9km EASE-Grid 2.0)',
        notice: 'Numeric HDF5 moisture pixel extraction requires EARTHDATA_TOKEN + binary decoder.',
      },
      precipitationGPM: {
        status: summary.hasPowerData ? 'power_precip_available' : gpm?.latestGranuleId ? 'granule_metadata_only' : 'not_synced',
        value30DayTotal: summary.precipTotalMm,
        unit: 'mm',
        latestGranuleId: gpm?.latestGranuleId || null,
        sensor: summary.hasPowerData ? 'NASA POWER PRECTOTCORR + GPM CMR' : 'GPM IMERG Late (0.1°)',
        timestamp: summary.powerLastRetrievedAt || gpm?.retrievedAt || null,
      },
      vegetationNDVI,
      evapotranspirationECOSTRESS: {
        status: ecostress?.latestGranuleId ? 'granule_metadata_only' : 'not_synced',
        waterStressIndex: null,
        latestGranuleId: ecostress?.latestGranuleId || null,
        granuleTimestamp: ecostress?.latestTimeStart || null,
        sensor: 'ECOSTRESS ISS (70m)',
        notice: 'Numeric thermal ET GeoTIFF extraction requires EARTHDATA_TOKEN + binary decoder.',
      },
    },
  });
});

app.get('/api/climate/timeline', async (req: Request, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const auth = await authorizeNasaFarmAccess(req, res, farmId);
  if (!auth) return;

  const summary = await getFarmNasaObservationsSummary(auth.readClient, auth.farm.id, auth.cacheScope);

  res.json({
    farmId: auth.farm.id,
    farmName: auth.farm.name,
    accessMode: auth.mode,
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
      windSpeedMps: d.windSpeedMps,
    })),
    provenance: summary.hasPowerData
      ? 'NASA Langley POWER Agroclimatology Daily Point API (0.5° grid)'
      : 'No NASA POWER records synced yet for this parcel.',
  });
});

app.get('/api/soil/profiles', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const user = req.authUser!;
  const farm = await requireAccessibleFarm(res, farmId, user);
  if (!farm) return;

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
  const farm = await requireAccessibleFarm(res, farmId, user);
  if (!farm) return;

  const summary = await getFarmNasaObservationsSummary(client, farm.id, user.id);
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

  if (summary.hasModisNumericData && summary.latestModisNdvi !== null) {
    const ndviRisk = summary.latestModisNdvi < 0.28 ? 64 : summary.latestModisNdvi < 0.45 ? 38 : 18;
    indicators.push({
      name: 'Canopy Vigor / Bare Soil Exposure (MODIS 250m)',
      level: ndviRisk >= 60 ? 'HIGH' : ndviRisk >= 35 ? 'MODERATE' : 'LOW',
      score: ndviRisk,
      dataSource: `NASA MODIS MOD13Q1 (${summary.latestModisQuality || 'Synced'})`,
      observation: `Observed NDVI: ${summary.latestModisNdvi}${summary.latestModisEvi !== null ? `, EVI: ${summary.latestModisEvi}` : ''} (${summary.latestModisNdviDate}).`,
    });
  } else {
    indicators.push({
      name: 'Canopy Vigor / Bare Soil Exposure (MODIS 250m)',
      level: 'MODERATE',
      score: null,
      dataSource: 'NASA MODIS MOD13Q1 (Not Yet Synced)',
      observation: 'Ingest MODIS 250m data to compute parcel canopy greenness and bare-soil exposure.',
    });
  }

  if (summary.hasPowerData && summary.meanWindSpeedMps !== null) {
    const windRisk = summary.meanWindSpeedMps >= 5.5 ? 62 : summary.meanWindSpeedMps >= 3.8 ? 36 : 18;
    indicators.push({
      name: 'Surface Wind Erosion Exposure (WS2M)',
      level: windRisk >= 60 ? 'HIGH' : windRisk >= 35 ? 'MODERATE' : 'LOW',
      score: windRisk,
      dataSource: 'NASA POWER WS2M (Synced)',
      observation: `Observed mean 2m wind speed: ${summary.meanWindSpeedMps} m/s (${mpsToMph(summary.meanWindSpeedMps)} mph).`,
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
    hasModisNumericData: summary.hasModisNumericData,
    indicators,
    scientificNotice:
      'NASA POWER grid cells (~50 km) do not capture field-level frost pockets or tile drainage variations; MODIS 250 m pixels blend adjacent field edges.',
  });
});

app.get('/api/analysis/bare-field', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const farmId = typeof req.query.farmId === 'string' && req.query.farmId.trim() ? req.query.farmId.trim() : 'farm-1';
  const user = req.authUser!;
  const client = req.supabaseUserClient!;
  const farm = await requireAccessibleFarm(res, farmId, user);
  if (!farm) return;

  const summary = await getFarmNasaObservationsSummary(client, farm.id, user.id);
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
  const farm = await requireAccessibleFarm(res, farmId, user);
  if (!farm) return;

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
  const farm = await requireAccessibleFarm(res, parsed.data.farmId, user);
  if (!farm) return;

  const effectivePriorities = parsed.data.priorities || DEFAULT_PRIORITIES;
  const scenario = parsed.data.scenario || null;
  const nasaSummary = await getFarmNasaObservationsSummary(client, farm.id, user.id);
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
  const farm = await requireAccessibleFarm(res, farmId, user);
  if (!farm) return;

  const nasaSummary = await getFarmNasaObservationsSummary(client, farm.id, user.id);
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

  const farm = await requireAccessibleFarm(res, targetFarmId, user);
  if (!farm) return;

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

  const nasaSummary = await getFarmNasaObservationsSummary(client, farm.id, user.id);
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

  const farm = await requireAccessibleFarm(res, targetFarmId, user);
  if (!farm) return;

  const nasaSummary = await getFarmNasaObservationsSummary(client, farm.id, user.id);
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
