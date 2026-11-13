import type { NASAObservation } from '../../src/types.js';

export class NasaUpstreamError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(message: string, status = 502, code = 'NASA_UPSTREAM_ERROR', retryable = false) {
    super(message);
    this.name = 'NasaUpstreamError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

/* ==========================================================================
   1. SPATIAL & DATE VALIDATION
   ========================================================================== */

export function validateCoordinates(longitude: number, latitude: number): {
  valid: boolean;
  longitude: number;
  latitude: number;
  error?: string;
} {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return { valid: false, longitude, latitude, error: 'Coordinates must be finite numeric longitude and latitude.' };
  }
  if (longitude < -180 || longitude > 180) {
    return { valid: false, longitude, latitude, error: 'Longitude must be between -180 and 180 degrees.' };
  }
  if (latitude < -90 || latitude > 90) {
    return { valid: false, longitude, latitude, error: 'Latitude must be between -90 and 90 degrees.' };
  }
  return { valid: true, longitude: Number(longitude.toFixed(5)), latitude: Number(latitude.toFixed(5)) };
}

export interface GeoJsonPolygon {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: any;
}

export function resolveFarmGeometry(input: {
  coordinates?: [number, number];
  boundaryGeoJson?: GeoJsonPolygon | null;
}): {
  longitude: number;
  latitude: number;
  spatialMethod: 'point_centroid_approximation' | 'polygon_boundary';
  hasPolygonBoundary: boolean;
  boundingBox: [number, number, number, number];
  disclosure: string;
} {
  if (
    input.boundaryGeoJson &&
    (input.boundaryGeoJson.type === 'Polygon' || input.boundaryGeoJson.type === 'MultiPolygon') &&
    Array.isArray(input.boundaryGeoJson.coordinates)
  ) {
    const ring: Array<[number, number]> =
      input.boundaryGeoJson.type === 'Polygon'
        ? input.boundaryGeoJson.coordinates[0] || []
        : input.boundaryGeoJson.coordinates[0]?.[0] || [];

    const validPts = ring.filter(
      (pt) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])
    );

    if (validPts.length >= 3) {
      const lons = validPts.map((p) => p[0]);
      const lats = validPts.map((p) => p[1]);
      const centroidLon = Number((lons.reduce((s, v) => s + v, 0) / lons.length).toFixed(5));
      const centroidLat = Number((lats.reduce((s, v) => s + v, 0) / lats.length).toFixed(5));
      return {
        longitude: centroidLon,
        latitude: centroidLat,
        spatialMethod: 'polygon_boundary',
        hasPolygonBoundary: true,
        boundingBox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
        disclosure: 'Derived from persisted GeoJSON field boundary centroid and bounding box.',
      };
    }
  }

  const [lon = -93.62, lat = 42.03] = input.coordinates || [];
  const checked = validateCoordinates(lon, lat);
  if (!checked.valid) {
    throw new NasaUpstreamError(checked.error || 'Invalid farm coordinates', 400, 'INVALID_COORDINATES', false);
  }
  return {
    longitude: checked.longitude,
    latitude: checked.latitude,
    spatialMethod: 'point_centroid_approximation',
    hasPolygonBoundary: false,
    boundingBox: [
      Number((checked.longitude - 0.15).toFixed(4)),
      Number((checked.latitude - 0.15).toFixed(4)),
      Number((checked.longitude + 0.15).toFixed(4)),
      Number((checked.latitude + 0.15).toFixed(4)),
    ],
    disclosure:
      'No surveyed GeoJSON boundary polygon uploaded; parcel centroid coordinate approximation used against grid footprint.',
  };
}

export function validateDateRange(startDate?: string, endDate?: string, maxDays = 366): {
  valid: boolean;
  startDate?: string;
  endDate?: string;
  error?: string;
} {
  if (!startDate && !endDate) {
    return { valid: true };
  }
  if ((startDate && !endDate) || (!startDate && endDate)) {
    return { valid: false, error: 'Both startDate and endDate must be supplied together.' };
  }
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoPattern.test(startDate!) || !isoPattern.test(endDate!)) {
    return { valid: false, error: 'Dates must follow YYYY-MM-DD format.' };
  }
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return { valid: false, error: 'Invalid calendar date supplied.' };
  }
  if (startMs > endMs) {
    return { valid: false, error: 'startDate cannot be after endDate.' };
  }
  const spanDays = Math.round((endMs - startMs) / 86_400_000) + 1;
  if (spanDays > maxDays) {
    return { valid: false, error: `Requested range (${spanDays} days) exceeds maximum window of ${maxDays} days.` };
  }
  return { valid: true, startDate, endDate };
}

/* ==========================================================================
   2. EXPLICIT UNIT CONVERSIONS (Raw SI units preserved in database)
   ========================================================================== */

export function celsiusToFahrenheit(c: number): number {
  return Number(((c * 9) / 5 + 32).toFixed(2));
}

export function kelvinToCelsius(k: number): number {
  return Number((k - 273.15).toFixed(2));
}

export function mmToInches(mm: number): number {
  return Number((mm / 25.4).toFixed(3));
}

export function mpsToMph(mps: number): number {
  return Number((mps * 2.236936).toFixed(2));
}

export function mjToKwh(mj: number): number {
  return Number((mj * 0.277778).toFixed(3));
}

/* ==========================================================================
   3. QUALITY FILTERING & MISSING-VALUE NORMALIZATION
   ========================================================================== */

export function normalizePowerValue(
  rawVal: unknown,
  fillValue = -999
): { value: number | null; isMissing: boolean; qualityFlag: string; qualityStatus: string } {
  const numVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);
  if (!Number.isFinite(numVal) || numVal === fillValue || numVal <= -990) {
    return {
      value: null,
      isMissing: true,
      qualityFlag: 'fill_value_missing',
      qualityStatus: 'Missing / Fill Value (-999)',
    };
  }
  return {
    value: Number(numVal.toFixed(3)),
    isMissing: false,
    qualityFlag: 'valid',
    qualityStatus: 'Valid Assimilated Value',
  };
}

export function mapModisReliabilityFlag(reliabilityCode: number | null | undefined): {
  qualityFlag: string;
  qualityStatus: string;
  usable: boolean;
} {
  switch (reliabilityCode) {
    case 0:
      return { qualityFlag: 'good_data', qualityStatus: 'Good data (clear sky pixel)', usable: true };
    case 1:
      return { qualityFlag: 'marginal_data', qualityStatus: 'Marginal data (use with caution)', usable: true };
    case 2:
      return { qualityFlag: 'snow_ice', qualityStatus: 'Snow/Ice detected — vegetation obscured', usable: false };
    case 3:
      return { qualityFlag: 'cloudy', qualityStatus: 'Cloud contaminated — optical pixel unreliable', usable: false };
    default:
      return { qualityFlag: 'fill_or_unverified', qualityStatus: 'No data / Unverified reliability', usable: false };
  }
}

export function normalizeModisScaledIndex(
  rawValue: unknown,
  reliabilityCode: number | null | undefined,
  fillValue = -3000,
  scaleFactor = 0.0001
): { value: number | null; isMissing: boolean; qualityFlag: string; qualityStatus: string } {
  const rel = mapModisReliabilityFlag(reliabilityCode);
  const numVal = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(numVal) || numVal === fillValue || numVal < -2000 || numVal > 10000) {
    return {
      value: null,
      isMissing: true,
      qualityFlag: 'fill_value_missing',
      qualityStatus: 'Missing / Sensor Fill Value',
    };
  }
  // Exclude cloudy / snow-covered optical pixels from usable numeric metrics while keeping flag
  if (reliabilityCode === 3 || reliabilityCode === 2) {
    return {
      value: null,
      isMissing: true,
      qualityFlag: rel.qualityFlag,
      qualityStatus: rel.qualityStatus,
    };
  }
  return {
    value: Number((numVal * scaleFactor).toFixed(4)),
    isMissing: false,
    qualityFlag: rel.qualityFlag,
    qualityStatus: rel.qualityStatus,
  };
}

export function normalizeModisLstCelsius(
  rawValue: unknown,
  fillValue = 0,
  scaleFactor = 0.02
): { value: number | null; isMissing: boolean; qualityFlag: string; qualityStatus: string } {
  const numVal = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(numVal) || numVal === fillValue || numVal < 7500 || numVal > 65535) {
    return {
      value: null,
      isMissing: true,
      qualityFlag: 'fill_value_missing',
      qualityStatus: 'Missing / Cloud-masked thermal pixel',
    };
  }
  const kelvin = numVal * scaleFactor;
  return {
    value: kelvinToCelsius(kelvin),
    isMissing: false,
    qualityFlag: 'good_data',
    qualityStatus: 'Valid MODIS Clear-Sky Land Surface Temperature',
  };
}

export interface DbObservationInsertRow {
  farm_id: string;
  user_id: string;
  scope_owner_id: string;
  provider: string;
  dataset_id: string;
  dataset_name: string;
  product_id: string;
  variable: string;
  value: number | null;
  unit: string;
  latitude: number;
  longitude: number;
  observed_at: string;
  retrieved_at: string;
  spatial_resolution: string;
  temporal_resolution: string;
  quality_flag: string;
  processing_method: string;
  processing_version: string;
  source_url: string;
  is_missing: boolean;
  provenance: string;
  raw_metadata: Record<string, any>;
}

export function deduplicateObservationRows<
  T extends { product_id: string; variable: string; observed_at: string }
>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) {
    const key = `${row.product_id}|${row.variable}|${row.observed_at}`;
    if (!seen.has(key)) {
      seen.set(key, row);
    }
  }
  return Array.from(seen.values());
}

/* ==========================================================================
   4. RESILIENT HTTP FETCH (Timeout, Exponential Backoff, Auth Short-Circuit)
   ========================================================================== */

export async function fetchNasaJson<T = any>(
  url: string,
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
    headers?: Record<string, string>;
    fetchImpl?: typeof globalThis.fetch;
  }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 12000;
  const maxRetries = options?.maxRetries ?? 2;
  const doFetch = options?.fetchImpl ?? globalThis.fetch;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'FieldShift-Agronomic-Platform/2.6',
          ...(options?.headers || {}),
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      // Never retry auth failures (401/403) or client validation errors (400/404)
      if (response.status === 401 || response.status === 403) {
        throw new NasaUpstreamError(
          `NASA service rejected authentication (${response.status}). Check credentials.`,
          response.status,
          'NASA_AUTH_REJECTED',
          false
        );
      }
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const text = await response.text().catch(() => '');
        throw new NasaUpstreamError(
          `NASA API client error HTTP ${response.status}${text ? `: ${text.slice(0, 180)}` : ''}`,
          response.status,
          'NASA_CLIENT_ERROR',
          false
        );
      }
      if (response.status === 429 || response.status >= 500) {
        lastError = new NasaUpstreamError(
          `NASA API transient HTTP ${response.status}`,
          response.status,
          response.status === 429 ? 'NASA_RATE_LIMITED' : 'NASA_SERVER_ERROR',
          true
        );
      } else if (response.ok) {
        try {
          return (await response.json()) as T;
        } catch {
          throw new NasaUpstreamError('NASA upstream returned malformed JSON payload.', 502, 'NASA_MALFORMED_JSON', false);
        }
      }
    } catch (err: any) {
      clearTimeout(timer);
      if (err instanceof NasaUpstreamError && !err.retryable) {
        throw err;
      }
      if (err?.name === 'AbortError') {
        lastError = new NasaUpstreamError(`NASA upstream request timed out after ${timeoutMs}ms`, 504, 'NASA_TIMEOUT', true);
      } else {
        lastError = err;
      }
    }

    if (attempt < maxRetries) {
      const backoffMs = Math.min(3000, 450 * Math.pow(2, attempt)) + Math.floor(Math.random() * 120);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  if (lastError instanceof NasaUpstreamError) {
    throw lastError;
  }
  throw new NasaUpstreamError(
    lastError instanceof Error ? lastError.message : 'NASA upstream request failed',
    502,
    'NASA_UPSTREAM_FAILED',
    false
  );
}

/* ==========================================================================
   5. IN-MEMORY TTL RESPONSE CACHE (Bounded, Cold-Start Safe)
   ========================================================================== */

export class NasaTtlCache<T = any> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();
  private readonly maxEntries: number;
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 15 * 60_000, maxEntries = 200) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string): T | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.now() > hit.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidatePrefix(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
      }
    }
  }

  stats() {
    return { entries: this.store.size, maxEntries: this.maxEntries, ttlMs: this.defaultTtlMs };
  }
}

export function mapDbObservationToCanonical(row: any): NASAObservation {
  const isMissing = Boolean(row.is_missing || row.value === null);
  const dataset = String(row.dataset_id || '');
  const provenance = String(row.provenance || '');
  const status: NASAObservation['status'] = isMissing
    ? 'unavailable'
    : provenance.includes('simulated')
    ? 'simulated'
    : dataset === 'nasa-power' || dataset === 'smap'
    ? 'estimated'
    : 'observed';

  return {
    id: String(row.id),
    farmId: row.farm_id || undefined,
    provider: String(row.provider),
    dataset,
    productId: row.product_id || undefined,
    parameter: String(row.variable),
    value: isMissing ? null : Number(row.value),
    unit: String(row.unit),
    latitude: typeof row.latitude === 'number' ? row.latitude : undefined,
    longitude: typeof row.longitude === 'number' ? row.longitude : undefined,
    observationStart: String(row.observed_at),
    observationEnd: row.raw_metadata?.timeEnd ? String(row.raw_metadata.timeEnd) : undefined,
    retrievedAt: String(row.retrieved_at),
    spatialResolution: row.spatial_resolution || undefined,
    temporalResolution: row.temporal_resolution || undefined,
    spatialMethod: 'point_centroid_approximation',
    qualityFlag: row.quality_flag || undefined,
    qualityStatus:
      row.raw_metadata?.qualityStatus ||
      (isMissing ? 'Unavailable / Missing Data' : 'Verified Quality'),
    sourceUrl: row.source_url || undefined,
    processingMethod: row.processing_method || undefined,
    uncertainty:
      row.raw_metadata?.uncertainty ||
      (dataset === 'nasa-power'
        ? '0.5° (~50 km) meteorological assimilation grid; not a parcel weather station.'
        : dataset === 'modis'
        ? '250 m / 1 km composite pixel centered on farm coordinate; adjacent land covers may blend.'
        : 'Satellite granule coverage metadata; sub-field pixel extraction requires Earthdata binary parsing.'),
    status,
  };
}
