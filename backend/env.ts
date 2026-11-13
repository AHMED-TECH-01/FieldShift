import dotenv from 'dotenv';
import { logEvent } from './logger.js';

dotenv.config();

export interface IntegrationCapability {
  configured: boolean;
  available: boolean;
  mode: 'live_public_api' | 'live_with_optional_token' | 'granule_metadata_only' | 'configured' | 'unavailable';
  requiresAuth: boolean;
  hasCredential: boolean;
  documentationUrl: string;
  notes: string;
}

export interface ServerEnvironmentSummary {
  nodeEnv: string;
  isVercel: boolean;
  supabaseConfigured: boolean;
  supabaseAdminConfigured: boolean;
  geminiConfigured: boolean;
  geminiTimeoutMs: number;
  nasaApiKeyConfigured: boolean;
  earthdataTokenConfigured: boolean;
  appUrl: string | null;
}

let bootLogged = false;

export function getServerEnv(): ServerEnvironmentSummary {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  const supabasePublicKey = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();
  const supabaseSecretKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  const nasaApiKey = (process.env.NASA_API_KEY || '').trim();
  const earthdataToken = (process.env.EARTHDATA_TOKEN || '').trim();
  const timeoutRaw = Number(process.env.GEMINI_TIMEOUT_MS);

  const summary: ServerEnvironmentSummary = {
    nodeEnv: process.env.NODE_ENV || 'development',
    isVercel: Boolean(process.env.VERCEL),
    supabaseConfigured: Boolean(supabaseUrl && supabasePublicKey),
    supabaseAdminConfigured: Boolean(supabaseUrl && supabaseSecretKey),
    geminiConfigured: Boolean(geminiKey),
    geminiTimeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 25000,
    nasaApiKeyConfigured: Boolean(nasaApiKey),
    earthdataTokenConfigured: Boolean(earthdataToken),
    appUrl: (process.env.APP_URL || process.env.APP_URI || '').trim() || null,
  };

  if (!bootLogged) {
    bootLogged = true;
    logEvent('EnvConfig', 'ENVIRONMENT_VALIDATED', {
      nodeEnv: summary.nodeEnv,
      isVercel: summary.isVercel,
      supabaseConfigured: summary.supabaseConfigured,
      supabaseAdminConfigured: summary.supabaseAdminConfigured,
      geminiConfigured: summary.geminiConfigured,
      nasaApiKeyConfigured: summary.nasaApiKeyConfigured,
      earthdataTokenConfigured: summary.earthdataTokenConfigured,
    });
  }

  return summary;
}

export function getNasaIntegrationCapabilities(): Record<string, IntegrationCapability> {
  const env = getServerEnv();
  return {
    'nasa-power': {
      configured: true,
      available: true,
      mode: 'live_public_api',
      requiresAuth: false,
      hasCredential: true,
      documentationUrl: 'https://power.larc.nasa.gov/docs/',
      notes: 'Live NASA POWER Daily & Monthly Point API (no API key required; 0.5° assimilated grid).',
    },
    modis: {
      configured: true,
      available: true,
      mode: 'live_public_api',
      requiresAuth: false,
      hasCredential: true,
      documentationUrl: 'https://modis.gsfc.nasa.gov/data/',
      notes: 'Live 250m MOD13Q1 NDVI/EVI + pixel reliability & 1km MOD11A2 LST via NASA ORNL DAAC Subsets REST API + Earthdata CMR.',
    },
    gpm: {
      configured: true,
      available: true,
      mode: env.earthdataTokenConfigured ? 'live_with_optional_token' : 'granule_metadata_only',
      requiresAuth: true,
      hasCredential: env.earthdataTokenConfigured,
      documentationUrl: 'https://gpm.nasa.gov/data',
      notes: env.earthdataTokenConfigured
        ? 'Earthdata CMR granule discovery active with EARTHDATA_TOKEN configured; NetCDF4 raster parsing requires external binary decoder.'
        : 'Live Earthdata CMR granule discovery active. Numeric GPM IMERG grid extraction requires EARTHDATA_TOKEN + NetCDF4 reader.',
    },
    smap: {
      configured: true,
      available: true,
      mode: env.earthdataTokenConfigured ? 'live_with_optional_token' : 'granule_metadata_only',
      requiresAuth: true,
      hasCredential: env.earthdataTokenConfigured,
      documentationUrl: 'https://nsidc.org/data/smap',
      notes: env.earthdataTokenConfigured
        ? 'Earthdata CMR granule discovery active with EARTHDATA_TOKEN configured; 9km EASE-Grid HDF5 parsing requires external binary decoder.'
        : 'Live Earthdata CMR granule discovery active. Numeric SMAP L4 m³/m³ moisture extraction requires EARTHDATA_TOKEN + HDF5 reader.',
    },
    ecostress: {
      configured: true,
      available: true,
      mode: env.earthdataTokenConfigured ? 'live_with_optional_token' : 'granule_metadata_only',
      requiresAuth: true,
      hasCredential: env.earthdataTokenConfigured,
      documentationUrl: 'https://ecostress.jpl.nasa.gov/',
      notes: env.earthdataTokenConfigured
        ? 'Earthdata CMR granule discovery active with EARTHDATA_TOKEN configured (variable 1-5 day ISS orbit).'
        : 'Live Earthdata CMR granule discovery active (variable 1-5 day ISS orbit). Numeric 70m ET GeoTIFF extraction requires EARTHDATA_TOKEN.',
    },
  };
}
