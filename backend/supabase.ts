import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
import { Farm } from '../src/types';
import { logEvent } from './logger';

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

let cachedAuthClient: SupabaseClient | null = null;
let cachedPublicClient: SupabaseClient | null = null;
let cachedAdminClient: SupabaseClient | null = null;

/**
 * Public Supabase client using publishable/anon key (no session persistence).
 * Used for auth endpoints (signInWithPassword, signUp, verifyOtp, resetPasswordForEmail)
 * and public read-only catalog queries under RLS.
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
 * Admin client reserved strictly for server health checks / auth token fallback checks.
 * NEVER used to bypass user ownership checks on private tables.
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

export async function resolveRequestUser(req: Request): Promise<AuthenticatedUser | null> {
  const token = extractRequestToken(req);
  if (!token || token.split('.').length !== 3) {
    return null;
  }

  const client = getSupabaseAuthClient() || getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) {
      return null;
    }
    const metaName = data.user.user_metadata?.full_name;
    return {
      id: data.user.id,
      email: data.user.email || '',
      fullName:
        typeof metaName === 'string' && metaName.trim()
          ? metaName.trim()
          : data.user.email?.split('@')[0] || 'Farmer',
      verified: Boolean(data.user.email_confirmed_at),
      accessToken: token,
    };
  } catch (err: any) {
    logEvent('Auth', 'JWT_VERIFY_ERROR', { message: err?.message || 'Unknown JWT error' });
    return null;
  }
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const userClient = getSupabaseUserClient(user.accessToken);
  if (!userClient) {
    res.status(503).json({ error: 'Supabase authentication service is not configured.' });
    return;
  }
  req.authUser = user;
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
