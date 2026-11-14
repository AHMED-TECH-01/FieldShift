import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import type { Farm } from '../src/types.js';
import { logEvent } from './logger.js';

export const VERIFIED_DEMO_FARM_IDS = new Set(['farm-1', 'farm-2', 'farm-3']);

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  verified: boolean;
  accessToken: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
  supabaseUserClient?: SupabaseClient;
}

export function getSupabaseUrl(): string | undefined {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.trim();
}

export function getSupabasePublishableKey(): string | undefined {
  return (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )?.trim();
}

export function getSupabaseSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )?.trim();
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

let cachedAuthClient: SupabaseClient | null = null;
let cachedPublicClient: SupabaseClient | null = null;
let cachedAdminClient: SupabaseClient | null = null;

/**
 * Public Supabase client using publishable/anon key (no session persistence).
 * Used for auth endpoints (signInWithPassword, signUp, verifyOtp, resetPasswordForEmail)
 * and public read-only catalog / verified demo queries under RLS.
 */
export function getSupabaseAuthClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) return null;
  if (!cachedAuthClient) {
    cachedAuthClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cachedAuthClient;
}

export function getSupabasePublicClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) return null;
  if (!cachedPublicClient) {
    cachedPublicClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cachedPublicClient;
}

/**
 * Admin client reserved strictly for server health checks and persisting public environmental
 * observations on verified baseline demo farms (where user_id IS NULL and is_demo = true).
 * NEVER used to bypass user ownership checks on private tables or user-owned farms.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const secretKey = getSupabaseSecretKey();
  if (!url || !secretKey) return null;
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cachedAdminClient;
}

/**
 * Creates a per-request Supabase client bound to the authenticated user's JWT
 * so PostgreSQL Row Level Security (auth.uid()) enforces ownership on every query.
 */
export function getSupabaseUserClient(accessToken: string): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key || !accessToken) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export function extractRequestToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/fieldshift_session=([^;]+)/);
    if (match) {
      try {
        token = decodeURIComponent(match[1]);
      } catch {
        token = match[1];
      }
    }
  }
  return token || undefined;
}

export interface RequestAuthContext {
  user: AuthenticatedUser | null;
  hasToken: boolean;
  tokenInvalid: boolean;
  supabaseConfigured: boolean;
}

export async function authenticateRequestContext(req: Request): Promise<RequestAuthContext> {
  const token = extractRequestToken(req);
  const configured = isSupabaseConfigured();

  if (!token) {
    return { user: null, hasToken: false, tokenInvalid: false, supabaseConfigured: configured };
  }

  if (!configured) {
    return { user: null, hasToken: true, tokenInvalid: true, supabaseConfigured: false };
  }

  if (token.split('.').length !== 3) {
    return { user: null, hasToken: true, tokenInvalid: true, supabaseConfigured: true };
  }

  const client = getSupabaseAuthClient() || getSupabaseAdminClient();
  if (!client) {
    return { user: null, hasToken: true, tokenInvalid: true, supabaseConfigured: false };
  }

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) {
      return { user: null, hasToken: true, tokenInvalid: true, supabaseConfigured: true };
    }
    const metaName = data.user.user_metadata?.full_name;
    return {
      user: {
        id: data.user.id,
        email: data.user.email || '',
        fullName:
          typeof metaName === 'string' && metaName.trim()
            ? metaName.trim()
            : data.user.email?.split('@')[0] || 'Farmer',
        verified: Boolean(data.user.email_confirmed_at),
        accessToken: token,
      },
      hasToken: true,
      tokenInvalid: false,
      supabaseConfigured: true,
    };
  } catch (err: any) {
    logEvent('Auth', 'JWT_VERIFY_ERROR', { message: err?.message || 'Unknown JWT error' });
    return { user: null, hasToken: true, tokenInvalid: true, supabaseConfigured: true };
  }
}

export async function resolveRequestUser(req: Request): Promise<AuthenticatedUser | null> {
  const ctx = await authenticateRequestContext(req);
  return ctx.user;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
        : 'Authentication required. Please sign in.',
      code: authCtx.tokenInvalid ? 'AUTH_INVALID_TOKEN' : 'AUTH_REQUIRED',
    });
    return;
  }

  const userClient = getSupabaseUserClient(authCtx.user.accessToken);
  if (!userClient) {
    res.status(503).json({
      error: 'Supabase authentication service is not configured.',
      code: 'SUPABASE_UNCONFIGURED',
    });
    return;
  }

  req.authUser = authCtx.user;
  req.supabaseUserClient = userClient;
  next();
}

export interface DbFarmRecord extends Farm {
  userId?: string | null;
  isDemo?: boolean;
}

export function mapDbFarmRow(row: any): DbFarmRecord {
  const coords = Array.isArray(row.coordinates) && row.coordinates.length === 2
    ? [Number(row.coordinates[0]), Number(row.coordinates[1])] as [number, number]
    : [-93.62, 42.03] as [number, number];

  return {
    id: String(row.id),
    userId: row.user_id || null,
    isDemo: Boolean(row.is_demo),
    name: String(row.name),
    location: String(row.location),
    coordinates: coords,
    acreage: Number(row.acreage) || 250,
    currentCrop: String(row.current_crop || 'Corn (Maize)'),
    plantingSeason: String(row.planting_season || 'Spring 2026'),
    rotationHistory: Array.isArray(row.rotation_history) ? row.rotation_history.map(String) : [],
    soilType: String(row.soil_type || 'Silt Loam'),
    soilPH: Number(row.soil_ph) || 6.5,
    organicMatter: Number(row.organic_matter) || 3.2,
    nitrogen: String(row.nitrogen || 'Medium'),
    phosphorus: String(row.phosphorus || 'Medium'),
    potassium: String(row.potassium || 'Medium'),
    drainage: String(row.drainage || 'Well Drained'),
    lastSoilTest: String(row.last_soil_test || '2026-01-01'),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
  };
}

/**
 * Fetches farms visible to the current request under strict RLS.
 * - Authenticated user sees their own farms + baseline demonstration farms (`is_demo = true`).
 * - Unauthenticated caller only ever sees public demo farms (`is_demo = true`) via publishable client.
 */
export async function listAccessibleFarms(user?: AuthenticatedUser | null): Promise<DbFarmRecord[]> {
  const client = user ? getSupabaseUserClient(user.accessToken) : getSupabasePublicClient();
  if (!client) {
    throw new Error('Supabase database client is not configured.');
  }

  const { data, error } = await client
    .from('farms')
    .select('*')
    .order('is_demo', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    logEvent('Database', 'FARMS_LIST_ERROR', { code: error.code, message: error.message });
    throw new Error('Failed to fetch farms from database.');
  }

  return (data || []).map(mapDbFarmRow);
}

/**
 * Looks up a specific farm strictly via RLS client.
 * Returns null if farm doesn't exist or belongs to another user.
 */
export async function getAccessibleFarmById(
  farmId: string,
  user?: AuthenticatedUser | null
): Promise<DbFarmRecord | null> {
  const client = user ? getSupabaseUserClient(user.accessToken) : getSupabasePublicClient();
  if (!client) {
    throw new Error('Supabase database client is not configured.');
  }

  const { data, error } = await client
    .from('farms')
    .select('*')
    .eq('id', farmId)
    .maybeSingle();

  if (error) {
    logEvent('Database', 'FARM_LOOKUP_ERROR', { farmId, code: error.code, message: error.message });
    throw new Error('Failed to verify farm access.');
  }

  return data ? mapDbFarmRow(data) : null;
}

/**
 * Checks whether a farm ID exists in the database (read-only ID check) solely to
 * distinguish HTTP 403 (exists, belongs to another user) from HTTP 404 (not found).
 * Never exposes any farm fields or rows.
 */
export async function doesFarmExistInDb(farmId: string): Promise<boolean> {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return false;
  try {
    const { data, error } = await adminClient
      .from('farms')
      .select('id')
      .eq('id', farmId)
      .maybeSingle();
    return !error && Boolean(data?.id);
  } catch {
    return false;
  }
}

export async function doesIngestionJobExistInDb(jobId: string): Promise<boolean> {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) return false;
  try {
    const { data, error } = await adminClient
      .from('ingestion_jobs')
      .select('id')
      .eq('id', jobId)
      .maybeSingle();
    return !error && Boolean(data?.id);
  } catch {
    return false;
  }
}

/**
 * Helper for authenticated routes: verifies farm visibility under RLS and returns
 * HTTP 403 when the farm exists under another owner vs HTTP 404 when not found.
 */
export async function requireAccessibleFarm(
  res: Response,
  farmId: string,
  user: AuthenticatedUser
): Promise<DbFarmRecord | null> {
  const cleanFarmId = farmId.trim();
  if (!cleanFarmId) {
    res.status(400).json({ error: 'farmId is required.', code: 'INVALID_FARM_ID' });
    return null;
  }

  let farm: DbFarmRecord | null = null;
  try {
    farm = await getAccessibleFarmById(cleanFarmId, user);
  } catch {
    res.status(500).json({ error: 'Failed to verify farm access.', code: 'FARM_LOOKUP_FAILED' });
    return null;
  }

  if (!farm) {
    const exists = await doesFarmExistInDb(cleanFarmId);
    if (exists) {
      res.status(403).json({
        error: 'Unauthorized farm access. You do not have permission to access this farm.',
        code: 'FARM_ACCESS_DENIED',
      });
    } else {
      res.status(404).json({ error: 'Farm not found.', code: 'FARM_NOT_FOUND' });
    }
    return null;
  }

  return farm;
}

export interface NasaFarmAuthorization {
  mode: 'authenticated_owner' | 'authenticated_demo';
  user: AuthenticatedUser;
  farm: DbFarmRecord;
  readClient: SupabaseClient;
  writeClient: SupabaseClient;
  ownerUserId: string;
  cacheScope: string;
}

/**
 * Authenticates the caller via Supabase JWT and enforces explicit farm authorization:
 * 1. Missing credentials -> 401 AUTH_REQUIRED.
 * 2. Invalid/expired credentials -> 401 AUTH_INVALID_TOKEN.
 * 3. Private farm owned by another user -> 403 FARM_ACCESS_DENIED.
 * 4. Nonexistent farm -> 404 FARM_NOT_FOUND.
 * 5. Owned farm (`!isDemo && userId === user.id`) OR verified DB demo farm (`VERIFIED_DEMO_FARM_IDS && isDemo && userId === null`)
 *    -> Authorized via user-scoped RLS client (`ownerUserId = user.id`, `cacheScope = user.id`).
 * Never trusts client-supplied `isDemo` or `userId`.
 */
export async function authorizeNasaFarmAccess(
  req: Request,
  res: Response,
  farmId: string
): Promise<NasaFarmAuthorization | null> {
  const cleanFarmId = farmId.trim();
  if (!cleanFarmId) {
    res.status(400).json({ error: 'farmId is required.', code: 'INVALID_FARM_ID' });
    return null;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({
      error: 'Supabase authentication and database service is not configured.',
      code: 'SUPABASE_UNCONFIGURED',
    });
    return null;
  }

  const authCtx = await authenticateRequestContext(req);
  if (!authCtx.user) {
    res.status(401).json({
      error: authCtx.tokenInvalid
        ? 'Invalid or expired authentication token. Please sign in again.'
        : 'Authentication required. Please sign in.',
      code: authCtx.tokenInvalid ? 'AUTH_INVALID_TOKEN' : 'AUTH_REQUIRED',
    });
    return null;
  }

  const userClient = getSupabaseUserClient(authCtx.user.accessToken);
  if (!userClient) {
    res.status(503).json({
      error: 'Supabase database client is not configured.',
      code: 'SUPABASE_UNCONFIGURED',
    });
    return null;
  }

  const farm = await requireAccessibleFarm(res, cleanFarmId, authCtx.user);
  if (!farm) return null;

  const isOwnedFarm = !farm.isDemo && farm.userId === authCtx.user.id;
  const isVerifiedDemoFarm = VERIFIED_DEMO_FARM_IDS.has(farm.id) && farm.isDemo === true && farm.userId === null;
  if (!isOwnedFarm && !isVerifiedDemoFarm) {
    res.status(403).json({ error: 'Unauthorized farm access.', code: 'FARM_ACCESS_DENIED' });
    return null;
  }

  return {
    mode: isOwnedFarm ? 'authenticated_owner' : 'authenticated_demo',
    user: authCtx.user,
    farm,
    readClient: userClient,
    writeClient: userClient,
    ownerUserId: authCtx.user.id,
    cacheScope: authCtx.user.id,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getAuthorizedIngestionJob(
  req: Request,
  res: Response,
  jobId: string
): Promise<any | null> {
  const cleanJobId = jobId.trim();
  if (!cleanJobId) {
    res.status(400).json({ error: 'jobId is required.', code: 'INVALID_JOB_ID' });
    return null;
  }
  if (!UUID_REGEX.test(cleanJobId)) {
    res.status(400).json({ error: 'Invalid ingestion job ID format.', code: 'INVALID_JOB_ID' });
    return null;
  }

  if (!isSupabaseConfigured()) {
    res.status(503).json({
      error: 'Supabase database service is not configured.',
      code: 'SUPABASE_UNCONFIGURED',
    });
    return null;
  }

  const authCtx = await authenticateRequestContext(req);
  if (!authCtx.user) {
    res.status(401).json({
      error: authCtx.tokenInvalid
        ? 'Invalid or expired authentication token. Please sign in again.'
        : 'Authentication required. Please sign in.',
      code: authCtx.tokenInvalid ? 'AUTH_INVALID_TOKEN' : 'AUTH_REQUIRED',
    });
    return null;
  }

  const userClient = getSupabaseUserClient(authCtx.user.accessToken);
  if (!userClient) {
    res.status(503).json({
      error: 'Supabase database client is not configured.',
      code: 'SUPABASE_UNCONFIGURED',
    });
    return null;
  }

  const { data, error } = await userClient
    .from('ingestion_jobs')
    .select('*')
    .eq('id', cleanJobId)
    .eq('user_id', authCtx.user.id)
    .maybeSingle();

  if (error) {
    logEvent('Database', 'INGESTION_JOB_LOOKUP_ERROR', { jobId: cleanJobId, code: error.code, message: error.message });
    res.status(500).json({ error: 'Failed to retrieve ingestion job status.' });
    return null;
  }

  if (!data) {
    const exists = await doesIngestionJobExistInDb(cleanJobId);
    if (exists) {
      res.status(403).json({
        error: 'Unauthorized access to ingestion job.',
        code: 'JOB_ACCESS_DENIED',
      });
    } else {
      res.status(404).json({ error: 'Ingestion job not found.', code: 'JOB_NOT_FOUND' });
    }
    return null;
  }

  return data;
}
