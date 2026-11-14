import { SupabaseClient } from '@supabase/supabase-js';
import type { NasaHarmonizedDataset, NASAObservation } from '../src/types.js';
import { getModisTimeoutMs } from './env.js';
import { logEvent } from './logger.js';
import type { DbFarmRecord } from './supabase.js';
import {
  fetchEarthdataCmrGranules,
  fetchModisOrnlData,
  fetchNasaPowerSeries,
  resolvePowerDateRange,
  SupportedCmrDataset,
} from './nasa/providers.js';
import {
  celsiusToFahrenheit,
  deduplicateObservationRows,
  mapDbObservationToCanonical,
  mmToInches,
  mpsToMph,
  NasaTtlCache,
  NasaUpstreamError,
  resolveFarmGeometry,
} from './nasa/units-and-quality.js';

export {
  celsiusToFahrenheit,
  deduplicateObservationRows,
  mapDbObservationToCanonical,
  mmToInches,
  mpsToMph,
  resolveFarmGeometry,
  resolvePowerDateRange,
};

export type SupportedSyncDataset = 'nasa-power' | 'smap' | 'gpm' | 'modis' | 'ecostress';

export const SUPPORTED_SYNC_DATASETS: SupportedSyncDataset[] = [
  'nasa-power',
  'smap',
  'gpm',
  'modis',
  'ecostress',
];

const summaryCache = new NasaTtlCache<FarmNasaSummary>(5 * 60_000, 150);
const inFlightModisRequests = new Map<string, Promise<ModisSyncResult>>();
const DEFAULT_MODIS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function getNasaCacheStats() {
  return {
    ...summaryCache.stats(),
    modisInFlightCount: inFlightModisRequests.size,
  };
}

export interface ModisPipelineStages {
  cmrDiscovery: {
    status: 'pending' | 'indexed' | 'empty' | 'failed';
    granulesFound: number;
    latestGranuleId: string | null;
    latestTimeStart: string | null;
    error: string | null;
  };
  pixelRetrieval: {
    status: 'pending' | 'extracted' | 'quality_masked' | 'cached' | 'failed';
    source: 'ornl_daac_live' | 'supabase_cache' | 'none';
    durationMs: number | null;
    timeoutMs: number;
    error: string | null;
    errorCategory: string | null;
  };
  normalization: {
    status: 'pending' | 'completed' | 'quality_masked' | 'failed' | 'skipped';
    totalRows: number;
    validNumericCount: number;
    maskedCount: number;
    error: string | null;
  };
  persistence: {
    status: 'pending' | 'persisted' | 'cached' | 'failed' | 'skipped';
    recordsSaved: number;
    error: string | null;
  };
}

export interface ModisSyncOptions {
  startDate?: string;
  endDate?: string;
  maxComposites?: number;
  forceRefresh?: boolean;
  cacheTtlMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  fetchImpl?: typeof globalThis.fetch;
}

export interface ModisSyncResult {
  dataset: 'modis';
  status: 'completed' | 'partial' | 'cached' | 'failed';
  farmId: string;
  recordsReceived: number;
  recordsSaved: number;
  numericPixelCount: number;
  maskedPixelCount: number;
  granulesFound: number;
  tile: string | null;
  spatialResolution: string;
  spatialMethod: 'point_centroid_approximation' | 'polygon_boundary';
  spatialDisclosure: string;
  retrievedAt: string;
  lastSuccessfulObservedAt: string | null;
  ornlError: string | null;
  cacheHit: boolean;
  cacheSource: 'supabase' | 'live';
  deduplicatedInFlight: boolean;
  persisted: boolean;
  stages: ModisPipelineStages;
  jobId: string | null;
}

export function buildModisRequestKey(params: {
  ownerScope: string;
  farmId: string;
  product: string;
  windowKey: string;
  latitude: number;
  longitude: number;
}): string {
  return [
    params.ownerScope,
    params.farmId,
    params.product,
    params.windowKey,
    params.latitude.toFixed(4),
    params.longitude.toFixed(4),
  ].join('|');
}

export function summarizeModisFailureReason(rawError: string | null | undefined, persistenceFailed = false): string | null {
  if (!rawError) return null;
  const msg = String(rawError).trim();
  if (!msg) return null;
  if (persistenceFailed || /persist|supabase|row-level security|database/i.test(msg)) {
    return `MODIS pixels could not be saved to Supabase (${msg.slice(0, 140)}).`;
  }
  if (/timed out|timeout|AbortError/i.test(msg)) {
    return `ORNL DAAC Subsets REST API timed out waiting for pixel data (${msg.slice(0, 120)}).`;
  }
  if (/429|rate limit/i.test(msg)) {
    return 'ORNL DAAC API rate-limited requests (HTTP 429) after bounded retries.';
  }
  if (/502|503|504|transient HTTP 5/i.test(msg)) {
    return `ORNL DAAC upstream server returned a transient error (${msg.slice(0, 120)}).`;
  }
  if (/network error|fetch failed|ECONN|ENOTFOUND|EAI_AGAIN/i.test(msg)) {
    return `Network connectivity issue reaching ORNL DAAC (${msg.slice(0, 120)}).`;
  }
  return msg.slice(0, 160);
}

export const nasaHarmonizedRoadmap: NasaHarmonizedDataset[] = [
  {
    id: 'nasa-power',
    code: 'NASA POWER Agro',
    name: 'Prediction Of Worldwide Energy Resources (POWER) Daily & Monthly Agroclimatology',
    source: 'NASA Langley Research Center Atmospheric Science Data Center (https://power.larc.nasa.gov/docs/)',
    spatialResolution: '0.5° latitude x 0.5° longitude (~50 km)',
    temporalResolution: 'Daily & Monthly (1981-present; ~4-5 day archive latency)',
    observationPeriod: '1981-present (40+ year climatology baseline)',
    units: 'Solar flux (MJ/m²/day), T2M/Tmax/Tmin (°C), PRECTOTCORR (mm/day), RH2M (%), WS2M (m/s)',
    processingMethod: 'GEOS atmospheric assimilation coupled with CERES satellite radiation',
    analyticalPurpose: 'Calculates thermal heat units (GDD), solar radiation fluxes, wind speed, and precipitation totals.',
    limitations: 'Assimilated meteorological grid (~50 km); not a field-level weather station.',
    lastRetrievedTimestamp: 'Live Public API',
    dataCategory: 'Model Assimilated',
  },
  {
    id: 'modis',
    code: 'MOD13Q1 v061 & MOD11A2',
    name: 'MODIS Terra Vegetation Indices (250m) & Land Surface Temperature (1km)',
    source: 'NASA LP DAAC & ORNL DAAC Subsets API (https://modis.gsfc.nasa.gov/data/)',
    spatialResolution: '250 m NDVI/EVI (16-day) & 1 km LST (8-day)',
    temporalResolution: '16-day NDVI/EVI composite & 8-day thermal composite',
    observationPeriod: '2000-present (continuous)',
    units: 'NDVI & EVI (-1.0 to +1.0), LST_Day_1km (°C)',
    processingMethod: 'Constrained View Angle Maximum Value Composite (CV-MVC) with pixel reliability cloud masking via ORNL DAAC REST + Earthdata CMR',
    analyticalPurpose: 'Measures photosynthetic vigor, seasonal crop emergence, bare-field duration, and canopy thermal stress.',
    limitations: '250 m composite may blend adjacent parcels and cannot confirm pests; cloudy/snow pixels are flagged as unusable.',
    lastRetrievedTimestamp: 'Live Public API (ORNL DAAC + CMR)',
    dataCategory: 'Satellite Derived',
  },
  {
    id: 'smap',
    code: 'SMAP L4_SM_gph',
    name: 'Soil Moisture Active Passive (SMAP) L4 Surface & Root-Zone',
    source: 'NASA Jet Propulsion Laboratory & NSIDC DAAC (https://nsidc.org/data/smap)',
    spatialResolution: '9 km EASE-Grid 2.0 assimilated',
    temporalResolution: '3-hour model assimilation (daily archive)',
    observationPeriod: '2015-present (continuous)',
    units: 'Volumetric soil moisture (m³/m³)',
    processingMethod: 'Kalman filtering assimilation of L-band brightness temperature with Catchment Land Surface Model',
    analyticalPurpose: 'Quantifies root-zone available water capacity to evaluate plant stress and irrigation timing.',
    limitations: '9 km spatial cell aggregates localized topography; numeric pixel extraction requires EARTHDATA_TOKEN + HDF5 reader.',
    lastRetrievedTimestamp: 'NASA Earthdata CMR Discovery',
    dataCategory: 'Model Assimilated',
  },
  {
    id: 'gpm',
    code: 'GPM 3IMERGDL',
    name: 'Global Precipitation Measurement (GPM) IMERG Late Daily Run',
    source: 'NASA Goddard Earth Sciences / GES DISC (https://gpm.nasa.gov/data)',
    spatialResolution: '0.1° x 0.1° (~10 km at equator)',
    temporalResolution: 'Daily Late Run (~14h latency) / Final Run (~3.5 mo gauge calibrated)',
    observationPeriod: '2000-present (continuous)',
    units: 'Precipitation accumulation (mm/day)',
    processingMethod: 'Combined passive microwave sensor gridding with infrared motion vector morphing',
    analyticalPurpose: 'Tracks rainfall accumulation, storm intensity, and prolonged drought intervals.',
    limitations: 'Late Run differs from Final gauge-calibrated run; NetCDF4 grid extraction requires EARTHDATA_TOKEN + binary decoder.',
    lastRetrievedTimestamp: 'NASA Earthdata CMR Discovery',
    dataCategory: 'Ground Truth Calibrated',
  },
  {
    id: 'ecostress',
    code: 'ECOSTRESS L3T JET',
    name: 'ECOsystem Spaceborne Thermal Radiometer Experiment on Space Station',
    source: 'NASA JPL / International Space Station Orbit Payload (https://ecostress.jpl.nasa.gov/)',
    spatialResolution: '70 m x 70 m multispectral thermal',
    temporalResolution: 'Variable 1 to 5 days (ISS precessing orbit track)',
    observationPeriod: '2018-present',
    units: 'Actual ET (W/m²) & Evaporative Stress Index (dimensionless)',
    processingMethod: 'Surface energy balance model (PT-JPL) driven by thermal infrared bands (8–12.5 µm)',
    analyticalPurpose: 'Detects plant water stress before visible wilting occurs by measuring thermal canopy emission.',
    limitations: 'Variable ISS orbit precludes fixed revisit cadence; GeoTIFF/HDF5 download requires EARTHDATA_TOKEN.',
    lastRetrievedTimestamp: 'NASA Earthdata CMR Discovery',
    dataCategory: 'Satellite Derived',
  },
  {
    id: 'landsat',
    code: 'Landsat 8/9 C2 L2',
    name: 'Landsat 8-9 OLI/TIRS Surface Reflectance Collection 2',
    source: 'NASA / USGS EROS Center',
    spatialResolution: '30 m multispectral (15m panchromatic)',
    temporalResolution: '8-day repeat cadence (combined 8 + 9 constellation)',
    observationPeriod: '1982-present (Landsat legacy archive)',
    units: 'Surface reflectance (0.0 to 1.0)',
    processingMethod: 'Atmospheric correction via LaSRC with aerosol retrieval',
    analyticalPurpose: 'Sub-field parcel boundary verification and historic bare-soil response.',
    limitations: 'Cloud masking can obscure spring emergence windows.',
    lastRetrievedTimestamp: 'Catalog Reference',
    dataCategory: 'Satellite Derived',
  },
  {
    id: 'grace',
    code: 'GRACE-FO JPL Mascon',
    name: 'GRACE Follow-On Tellus Monthly Mass Grids (Deep Groundwater Storage)',
    source: 'NASA JPL / CSR',
    spatialResolution: '0.5° x 0.5° mascon grid (~300 km orbital gravimetry)',
    temporalResolution: 'Monthly',
    observationPeriod: '2002-present',
    units: 'Liquid Water Equivalent Thickness anomaly (cm)',
    processingMethod: 'Spherical harmonic / mascon inversion of K-band inter-satellite range rate',
    analyticalPurpose: 'Tracks multi-year regional deep aquifer trends.',
    limitations: 'Coarse ~300 km footprint cannot measure individual well drawdown.',
    lastRetrievedTimestamp: 'Catalog Reference',
    dataCategory: 'Satellite Derived',
  },
  {
    id: 'srtm',
    code: 'SRTMGL1 v003',
    name: 'Shuttle Radar Topography Mission 1 Arc-Second Global Elevation',
    source: 'NASA / NGA / USGS EROS',
    spatialResolution: '1 arc-second (~30 meters)',
    temporalResolution: 'Static baseline reference (Feb 2000)',
    observationPeriod: 'February 2000 mission baseline',
    units: 'Elevation (meters ASL) & Slope Gradient (%)',
    processingMethod: 'C-band Interferometric SAR with void filling',
    analyticalPurpose: 'Topographic slope gradient, rill erosion hazard, and contour buffer planning.',
    limitations: 'Static 2000 terrain surface; tree canopy tops can inflate surface heights.',
    lastRetrievedTimestamp: 'Catalog Reference',
    dataCategory: 'Ground Truth Calibrated',
  },
];

async function persistObservationRows(userClient: SupabaseClient, rows: any[]): Promise<number> {
  const deduped = deduplicateObservationRows(rows);
  let savedCount = 0;
  for (let i = 0; i < deduped.length; i += 250) {
    const chunk = deduped.slice(i, i + 250);
    const { error } = await userClient
      .from('nasa_observations')
      .upsert(chunk, { onConflict: 'farm_id,scope_owner_id,product_id,variable,observed_at' });
    if (error) {
      throw new Error(`Failed saving NASA observations: ${error.message}`);
    }
    savedCount += chunk.length;
  }
  return savedCount;
}

export async function syncNasaPowerForFarm(
  userClient: SupabaseClient,
  userId: string | null,
  farm: DbFarmRecord,
  options?: { startDate?: string; endDate?: string; days?: number; resolution?: 'daily' | 'monthly' }
) {
  const geom = resolveFarmGeometry({ coordinates: farm.coordinates });
  const resolution = options?.resolution === 'monthly' ? 'monthly' : 'daily';
  const { startDate, endDate } = resolvePowerDateRange(options);

  const { data: jobRow, error: jobCreateErr } = await userClient
    .from('ingestion_jobs')
    .insert({
      farm_id: farm.id,
      user_id: userId,
      dataset_id: 'nasa-power',
      source_code: 'NASA POWER Agro',
      status: 'running',
      start_date: startDate,
      end_date: endDate,
      metadata: {
        latitude: geom.latitude,
        longitude: geom.longitude,
        resolution,
        spatialMethod: geom.spatialMethod,
      },
    })
    .select('*')
    .single();

  if (jobCreateErr) {
    logEvent('NasaSync', 'INGESTION_JOB_CREATE_ERROR', { farmId: farm.id, error: jobCreateErr.message });
  }

  try {
    const fetched = await fetchNasaPowerSeries({
      farmId: farm.id,
      userId,
      longitude: geom.longitude,
      latitude: geom.latitude,
      resolution,
      startDate,
      endDate,
      days: options?.days,
      spatialMethod: geom.spatialMethod,
    });

    const savedCount = await persistObservationRows(userClient, fetched.rows);
    summaryCache.invalidatePrefix(`${farm.id}:`);

    if (jobRow?.id) {
      await userClient
        .from('ingestion_jobs')
        .update({
          status: 'completed',
          records_received: fetched.rows.length,
          records_saved: savedCount,
          completed_at: new Date().toISOString(),
          metadata: {
            latitude: geom.latitude,
            longitude: geom.longitude,
            elevationMeters: fetched.elevationMeters,
            apiVersion: fetched.apiVersion,
            resolution,
            spatialMethod: geom.spatialMethod,
          },
        })
        .eq('id', jobRow.id);
    }

    logEvent('NasaSync', 'NASA_POWER_SYNC_COMPLETED', {
      farmId: farm.id,
      resolution,
      recordsReceived: fetched.rows.length,
      recordsSaved: savedCount,
      startDate: fetched.startDate,
      endDate: fetched.endDate,
    });

    return {
      dataset: 'nasa-power',
      status: 'completed' as const,
      resolution,
      farmId: farm.id,
      startDate: fetched.startDate,
      endDate: fetched.endDate,
      recordsReceived: fetched.rows.length,
      recordsSaved: savedCount,
      elevationMeters: fetched.elevationMeters,
      spatialMethod: geom.spatialMethod,
      retrievedAt: fetched.retrievedAt,
      jobId: jobRow?.id || null,
    };
  } catch (err: any) {
    if (jobRow?.id) {
      await userClient
        .from('ingestion_jobs')
        .update({
          status: 'failed',
          error_message: err?.message || 'NASA POWER sync failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobRow.id);
    }
    logEvent('NasaSync', 'NASA_POWER_SYNC_FAILED', { farmId: farm.id, error: err?.message });
    throw err;
  }
}

async function findCachedModisObservations(
  userClient: SupabaseClient,
  farmId: string,
  latitude: number,
  longitude: number,
  windowKey: string,
  startDate?: string,
  endDate?: string,
  cacheTtlMs = DEFAULT_MODIS_CACHE_TTL_MS
) {
  const { data: obsRows, error } = await userClient
    .from('nasa_observations')
    .select('*')
    .eq('farm_id', farmId)
    .eq('dataset_id', 'modis')
    .order('observed_at', { ascending: false })
    .limit(80);

  if (error || !Array.isArray(obsRows) || obsRows.length === 0) {
    return null;
  }

  const nowMs = Date.now();
  const validNumericRows = obsRows.filter((r: any) => {
    if (r.provenance !== 'live_api_nasa_ornl_modis') return false;
    if (r.is_missing || r.value === null || r.value === undefined || !Number.isFinite(Number(r.value))) {
      return false;
    }
    if (typeof r.latitude === 'number' && Math.abs(r.latitude - latitude) > 0.0005) return false;
    if (typeof r.longitude === 'number' && Math.abs(r.longitude - longitude) > 0.0005) return false;
    const retrievedMs = Date.parse(String(r.retrieved_at || ''));
    if (!Number.isFinite(retrievedMs) || nowMs - retrievedMs > cacheTtlMs) return false;
    const obsDate = String(r.observed_at || '').slice(0, 10);
    if (startDate && endDate) {
      return obsDate >= startDate && obsDate <= endDate;
    }
    const rowWindowKey = r.raw_metadata?.requestedWindowKey;
    return !rowWindowKey || rowWindowKey === windowKey;
  });

  // Never treat non-numeric / failed / CMR-only rows as a successful pixel cache hit
  const validNdviRows = validNumericRows.filter((r: any) => r.variable === 'NDVI');
  if (validNdviRows.length === 0) {
    return null;
  }

  const cmrRows = obsRows.filter(
    (r: any) =>
      r.provenance === 'live_api_nasa_earthdata_cmr' &&
      String(r.variable || '').includes('GRANULE_COVERAGE')
  );
  const latestNdvi = validNdviRows[0];
  const latestCmr = cmrRows[0];

  return {
    validNumericRows,
    cmrRows,
    latestObservedAt: String(latestNdvi.observed_at).slice(0, 10),
    retrievedAt: String(latestNdvi.retrieved_at),
    tile: latestNdvi.raw_metadata?.tile || null,
    spatialResolution: String(latestNdvi.spatial_resolution || '250 m sinusoidal pixel'),
    latestGranuleId: latestCmr?.raw_metadata?.granuleId || null,
    latestGranuleTimeStart: latestCmr?.raw_metadata?.timeStart || latestCmr?.observed_at || null,
  };
}

export async function syncModisForFarm(
  userClient: SupabaseClient,
  userId: string | null,
  farm: DbFarmRecord,
  options?: ModisSyncOptions
): Promise<ModisSyncResult> {
  const geom = resolveFarmGeometry({ coordinates: farm.coordinates });
  const maxComposites = Math.min(10, Math.max(1, options?.maxComposites || 8));
  const windowKey =
    options?.startDate && options?.endDate
      ? `${options.startDate}_${options.endDate}`
      : `latest_${maxComposites}`;
  const dedupKey = buildModisRequestKey({
    ownerScope: userId || 'public',
    farmId: farm.id,
    product: 'MOD13Q1+MOD11A2',
    windowKey,
    latitude: geom.latitude,
    longitude: geom.longitude,
  });

  // Prevent duplicate concurrent requests for identical farm, product, date window, and coordinates
  const activePromise = inFlightModisRequests.get(dedupKey);
  if (activePromise) {
    logEvent('NasaSync', 'MODIS_REQUEST_COALESCED', {
      farmId: farm.id,
      windowKey,
      latitude: geom.latitude,
      longitude: geom.longitude,
    });
    const shared = await activePromise;
    return { ...shared, deduplicatedInFlight: true };
  }

  const timeoutMs =
    typeof options?.timeoutMs === 'number' && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? Math.floor(options.timeoutMs)
      : getModisTimeoutMs();
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_MODIS_CACHE_TTL_MS;

  const execute = async (): Promise<ModisSyncResult> => {
    // 1. Check Supabase cache for valid numeric MODIS observations before querying ORNL DAAC
    if (!options?.forceRefresh) {
      const cached = await findCachedModisObservations(
        userClient,
        farm.id,
        geom.latitude,
        geom.longitude,
        windowKey,
        options?.startDate,
        options?.endDate,
        cacheTtlMs
      ).catch(() => null);

      if (cached) {
        const stages: ModisPipelineStages = {
          cmrDiscovery: {
            status: cached.cmrRows.length > 0 ? 'indexed' : 'pending',
            granulesFound: cached.cmrRows.length,
            latestGranuleId: cached.latestGranuleId,
            latestTimeStart: cached.latestGranuleTimeStart,
            error: null,
          },
          pixelRetrieval: {
            status: 'cached',
            source: 'supabase_cache',
            durationMs: 0,
            timeoutMs,
            error: null,
            errorCategory: null,
          },
          normalization: {
            status: 'completed',
            totalRows: cached.validNumericRows.length,
            validNumericCount: cached.validNumericRows.length,
            maskedCount: 0,
            error: null,
          },
          persistence: {
            status: 'cached',
            recordsSaved: 0,
            error: null,
          },
        };

        logEvent('NasaSync', 'MODIS_CACHE_REUSED', {
          farmId: farm.id,
          windowKey,
          cachedRows: cached.validNumericRows.length,
          lastObservedAt: cached.latestObservedAt,
          retrievedAt: cached.retrievedAt,
        });

        return {
          dataset: 'modis',
          status: 'cached',
          farmId: farm.id,
          recordsReceived: cached.validNumericRows.length,
          recordsSaved: 0,
          numericPixelCount: cached.validNumericRows.length,
          maskedPixelCount: 0,
          granulesFound: cached.cmrRows.length,
          tile: cached.tile,
          spatialResolution: cached.spatialResolution,
          spatialMethod: geom.spatialMethod,
          spatialDisclosure: geom.disclosure,
          retrievedAt: cached.retrievedAt,
          lastSuccessfulObservedAt: cached.latestObservedAt,
          ornlError: null,
          cacheHit: true,
          cacheSource: 'supabase',
          deduplicatedInFlight: false,
          persisted: true,
          stages,
          jobId: null,
        };
      }
    }

    const { data: jobRow } = await userClient
      .from('ingestion_jobs')
      .insert({
        farm_id: farm.id,
        user_id: userId,
        dataset_id: 'modis',
        source_code: 'MOD13Q1 + MOD11A2',
        status: 'running',
        metadata: {
          latitude: geom.latitude,
          longitude: geom.longitude,
          boundingBox: geom.boundingBox,
          windowKey,
          spatialMethod: geom.spatialMethod,
          timeoutMs,
        },
      })
      .select('*')
      .single();

    const stages: ModisPipelineStages = {
      cmrDiscovery: {
        status: 'pending',
        granulesFound: 0,
        latestGranuleId: null,
        latestTimeStart: null,
        error: null,
      },
      pixelRetrieval: {
        status: 'pending',
        source: 'none',
        durationMs: null,
        timeoutMs,
        error: null,
        errorCategory: null,
      },
      normalization: {
        status: 'pending',
        totalRows: 0,
        validNumericCount: 0,
        maskedCount: 0,
        error: null,
      },
      persistence: {
        status: 'pending',
        recordsSaved: 0,
        error: null,
      },
    };

    try {
      const [ornlSettled, cmrSettled] = await Promise.allSettled([
        fetchModisOrnlData({
          farmId: farm.id,
          userId,
          longitude: geom.longitude,
          latitude: geom.latitude,
          maxComposites,
          startDate: options?.startDate,
          endDate: options?.endDate,
          requestedWindowKey: windowKey,
          timeoutMs,
          maxRetries: options?.maxRetries,
          baseBackoffMs: options?.baseBackoffMs,
          spatialMethod: geom.spatialMethod,
          fetchImpl: options?.fetchImpl,
        }),
        fetchEarthdataCmrGranules({
          farmId: farm.id,
          userId,
          longitude: geom.longitude,
          latitude: geom.latitude,
          dataset: 'modis',
          boundingBox: geom.boundingBox,
          spatialMethod: geom.spatialMethod,
          fetchImpl: options?.fetchImpl,
        }),
      ]);

      const ornlResult = ornlSettled.status === 'fulfilled' ? ornlSettled.value : null;
      const ornlError = ornlSettled.status === 'rejected' ? ornlSettled.reason : null;
      const cmrResult =
        cmrSettled.status === 'fulfilled'
          ? cmrSettled.value
          : { entriesCount: 0, rows: [] as any[], retrievedAt: new Date().toISOString() };
      const cmrError = cmrSettled.status === 'rejected' ? cmrSettled.reason : null;

      // Update CMR discovery stage independently
      if (cmrSettled.status === 'fulfilled') {
        const latestCmrRow = cmrResult.rows[0];
        stages.cmrDiscovery = {
          status: cmrResult.entriesCount > 0 ? 'indexed' : 'empty',
          granulesFound: cmrResult.entriesCount,
          latestGranuleId: latestCmrRow?.raw_metadata?.granuleId || null,
          latestTimeStart: latestCmrRow?.raw_metadata?.timeStart || latestCmrRow?.observed_at || null,
          error: null,
        };
      } else {
        stages.cmrDiscovery = {
          status: 'failed',
          granulesFound: 0,
          latestGranuleId: null,
          latestTimeStart: null,
          error: cmrError instanceof Error ? cmrError.message : String(cmrError || 'CMR lookup failed'),
        };
      }

      // Update pixel retrieval + normalization stages independently
      const ornlErrorMessage =
        ornlError instanceof Error ? ornlError.message : ornlError ? String(ornlError) : null;

      if (ornlResult) {
        stages.pixelRetrieval = {
          status: ornlResult.validNumericCount > 0 ? 'extracted' : 'quality_masked',
          source: 'ornl_daac_live',
          durationMs: ornlResult.diagnostics.durationMs,
          timeoutMs: ornlResult.diagnostics.timeoutMs,
          error: null,
          errorCategory: null,
        };
        stages.normalization = {
          status: ornlResult.validNumericCount > 0 ? 'completed' : 'quality_masked',
          totalRows: ornlResult.rows.length,
          validNumericCount: ornlResult.validNumericCount,
          maskedCount: ornlResult.maskedCount,
          error: null,
        };
      } else {
        stages.pixelRetrieval = {
          status: 'failed',
          source: 'none',
          durationMs: ornlError instanceof NasaUpstreamError ? (ornlError.durationMs ?? null) : null,
          timeoutMs,
          error: ornlErrorMessage || 'ORNL DAAC pixel request failed',
          errorCategory: ornlError instanceof NasaUpstreamError ? ornlError.category : 'network',
        };
        stages.normalization = {
          status: 'skipped',
          totalRows: 0,
          validNumericCount: 0,
          maskedCount: 0,
          error: null,
        };
      }

      if (!ornlResult && cmrResult.rows.length === 0) {
        stages.persistence = { status: 'skipped', recordsSaved: 0, error: null };
        const combinedErr =
          ornlError instanceof NasaUpstreamError
            ? ornlError
            : new NasaUpstreamError(
                ornlErrorMessage || 'Both MODIS ORNL DAAC and Earthdata CMR requests failed.',
                502,
                'MODIS_UPSTREAM_FAILED',
                false,
                { category: 'network', details: { stages } }
              );
        combinedErr.details = { ...(combinedErr.details || {}), stages };
        throw combinedErr;
      }

      const combinedRows = [...(ornlResult?.rows || []), ...cmrResult.rows];
      let savedCount = 0;
      try {
        savedCount = await persistObservationRows(userClient, combinedRows);
        stages.persistence = {
          status: 'persisted',
          recordsSaved: savedCount,
          error: null,
        };
        summaryCache.invalidatePrefix(`${farm.id}:`);
      } catch (persistErr: any) {
        const persistMessage = persistErr instanceof Error ? persistErr.message : String(persistErr || 'Supabase upsert failed');
        stages.persistence = {
          status: 'failed',
          recordsSaved: 0,
          error: persistMessage,
        };
        summaryCache.invalidatePrefix(`${farm.id}:`);
        if (jobRow?.id) {
          await userClient
            .from('ingestion_jobs')
            .update({
              status: 'failed',
              records_received: combinedRows.length,
              records_saved: 0,
              error_message: persistMessage,
              completed_at: new Date().toISOString(),
              metadata: {
                tile: ornlResult?.latestTile || null,
                cellSizeMeters: ornlResult?.cellSizeMeters || null,
                numericPixelRows: ornlResult?.validNumericCount || 0,
                maskedPixelRows: ornlResult?.maskedCount || 0,
                cmrGranuleRows: cmrResult.rows.length,
                ornlAvailable: Boolean(ornlResult),
                stages,
              },
            })
            .eq('id', jobRow.id)
            .then(() => undefined, () => undefined);
        }
        logEvent('NasaSync', 'MODIS_PERSISTENCE_FAILED', {
          farmId: farm.id,
          error: persistMessage,
          numericExtracted: ornlResult?.validNumericCount || 0,
        });
        throw new NasaUpstreamError(
          `MODIS persistence failed: ${persistMessage}`,
          503,
          'SUPABASE_PERSISTENCE_FAILED',
          false,
          {
            category: 'persistence',
            details: {
              stages,
              numericPixelCount: ornlResult?.validNumericCount || 0,
              granulesFound: cmrResult.entriesCount,
            },
          }
        );
      }

      const jobStatus: 'completed' | 'partial' = ornlResult ? 'completed' : 'partial';

      if (jobRow?.id) {
        await userClient
          .from('ingestion_jobs')
          .update({
            status: jobStatus,
            records_received: combinedRows.length,
            records_saved: savedCount,
            error_message: ornlErrorMessage,
            completed_at: new Date().toISOString(),
            metadata: {
              tile: ornlResult?.latestTile || null,
              cellSizeMeters: ornlResult?.cellSizeMeters || null,
              numericPixelRows: ornlResult?.validNumericCount || 0,
              maskedPixelRows: ornlResult?.maskedCount || 0,
              cmrGranuleRows: cmrResult.rows.length,
              ornlAvailable: Boolean(ornlResult),
              windowKey,
              stages,
            },
          })
          .eq('id', jobRow.id);
      }

      logEvent('NasaSync', ornlResult ? 'MODIS_SYNC_COMPLETED' : 'MODIS_SYNC_PARTIAL_CMR_ONLY', {
        farmId: farm.id,
        numericRows: ornlResult?.validNumericCount || 0,
        maskedRows: ornlResult?.maskedCount || 0,
        cmrGranules: cmrResult.rows.length,
        recordsSaved: savedCount,
        ornlError: ornlErrorMessage,
        durationMs: ornlResult?.diagnostics.durationMs ?? null,
      });

      const hasNumericOrMasked = Boolean(ornlResult);
      const validNumericCount = ornlResult?.validNumericCount || 0;

      return {
        dataset: 'modis',
        status: jobStatus,
        farmId: farm.id,
        recordsReceived: combinedRows.length,
        recordsSaved: savedCount,
        numericPixelCount: validNumericCount,
        maskedPixelCount: ornlResult?.maskedCount || 0,
        granulesFound: cmrResult.entriesCount,
        tile: ornlResult?.latestTile || null,
        spatialResolution: `${ornlResult?.cellSizeMeters ?? 250} m`,
        spatialMethod: geom.spatialMethod,
        spatialDisclosure: geom.disclosure,
        retrievedAt: ornlResult?.retrievedAt || cmrResult.retrievedAt,
        lastSuccessfulObservedAt: ornlResult?.latestObservedDate || null,
        ornlError: ornlErrorMessage,
        cacheHit: false,
        cacheSource: 'live',
        deduplicatedInFlight: false,
        persisted: hasNumericOrMasked && savedCount > 0 && validNumericCount > 0,
        stages,
        jobId: jobRow?.id || null,
      };
    } catch (err: any) {
      if (!(err instanceof NasaUpstreamError && err.code === 'SUPABASE_PERSISTENCE_FAILED')) {
        if (jobRow?.id) {
          await userClient
            .from('ingestion_jobs')
            .update({
              status: 'failed',
              error_message: err?.message || 'MODIS sync failed',
              completed_at: new Date().toISOString(),
              metadata: { stages },
            })
            .eq('id', jobRow.id)
            .then(() => undefined, () => undefined);
        }
        logEvent('NasaSync', 'MODIS_SYNC_FAILED', { farmId: farm.id, error: err?.message });
      }
      throw err;
    }
  };

  const promise = execute().finally(() => {
    inFlightModisRequests.delete(dedupKey);
  });
  inFlightModisRequests.set(dedupKey, promise);
  return promise;
}

export async function syncEarthdataCmrForFarm(
  userClient: SupabaseClient,
  userId: string | null,
  farm: DbFarmRecord,
  dataset: SupportedCmrDataset
) {
  if (dataset === 'modis') {
    return syncModisForFarm(userClient, userId, farm);
  }

  const geom = resolveFarmGeometry({ coordinates: farm.coordinates });

  const { data: jobRow } = await userClient
    .from('ingestion_jobs')
    .insert({
      farm_id: farm.id,
      user_id: userId,
      dataset_id: dataset,
      source_code: dataset.toUpperCase(),
      status: 'running',
      metadata: { boundingBox: geom.boundingBox.join(','), spatialMethod: geom.spatialMethod },
    })
    .select('*')
    .single();

  try {
    const cmrResult = await fetchEarthdataCmrGranules({
      farmId: farm.id,
      userId,
      longitude: geom.longitude,
      latitude: geom.latitude,
      dataset,
      boundingBox: geom.boundingBox,
      spatialMethod: geom.spatialMethod,
    });

    const savedCount = await persistObservationRows(userClient, cmrResult.rows);
    summaryCache.invalidatePrefix(`${farm.id}:`);

    const status = cmrResult.rows.length > 0 ? 'partial' : 'completed';
    if (jobRow?.id) {
      await userClient
        .from('ingestion_jobs')
        .update({
          status,
          records_received: cmrResult.entriesCount,
          records_saved: savedCount,
          completed_at: new Date().toISOString(),
          metadata: {
            boundingBox: cmrResult.bbox,
            latestGranuleId: cmrResult.rows[0]?.raw_metadata?.granuleId || null,
            note: 'Granule discovery verified via NASA CMR. Numeric HDF5/NetCDF4 pixel extraction requires Earthdata Login download and binary decoder.',
          },
        })
        .eq('id', jobRow.id);
    }

    logEvent('NasaSync', 'NASA_CMR_SYNC_COMPLETED', {
      dataset,
      farmId: farm.id,
      granulesFound: cmrResult.entriesCount,
    });

    return {
      dataset,
      status,
      farmId: farm.id,
      recordsReceived: cmrResult.entriesCount,
      recordsSaved: savedCount,
      granulesFound: cmrResult.entriesCount,
      retrievedAt: cmrResult.retrievedAt,
      latestGranule: cmrResult.rows[0]?.raw_metadata || null,
      limitationNotice:
        'NASA Earthdata CMR granule metadata was fetched live for this farm bounding box. Pixel-level numeric values remain null until authenticated Earthdata HDF5/NetCDF4 extraction is enabled.',
      jobId: jobRow?.id || null,
    };
  } catch (err: any) {
    if (jobRow?.id) {
      await userClient
        .from('ingestion_jobs')
        .update({
          status: 'failed',
          error_message: err?.message || 'NASA CMR query failed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobRow.id);
    }
    logEvent('NasaSync', 'NASA_CMR_SYNC_FAILED', { dataset, farmId: farm.id, error: err?.message });
    throw err;
  }
}

export async function ingestAllAvailableForFarm(
  userClient: SupabaseClient,
  userId: string | null,
  farm: DbFarmRecord,
  options?: { days?: number; forceRefresh?: boolean }
) {
  const outcomes: Record<string, any> = {};
  const tasks: Array<Promise<void>> = [
    syncNasaPowerForFarm(userClient, userId, farm, { days: options?.days || 30 })
      .then((r) => { outcomes['nasa-power'] = { ok: true, ...r }; })
      .catch((e) => { outcomes['nasa-power'] = { ok: false, error: e?.message, code: e?.code || 'NASA_POWER_FAILED' }; }),
    syncModisForFarm(userClient, userId, farm, { forceRefresh: options?.forceRefresh ?? true })
      .then((r) => {
        const extracted = r.status === 'completed' || r.status === 'cached';
        outcomes.modis = { ok: extracted, ...r };
      })
      .catch((e) => {
        outcomes.modis = {
          ok: false,
          error: e?.message,
          code: e?.code || 'MODIS_FAILED',
          stages: e?.details?.stages || null,
        };
      }),
    syncEarthdataCmrForFarm(userClient, userId, farm, 'smap')
      .then((r) => { outcomes.smap = { ok: true, ...r }; })
      .catch((e) => { outcomes.smap = { ok: false, error: e?.message, code: e?.code || 'SMAP_FAILED' }; }),
    syncEarthdataCmrForFarm(userClient, userId, farm, 'gpm')
      .then((r) => { outcomes.gpm = { ok: true, ...r }; })
      .catch((e) => { outcomes.gpm = { ok: false, error: e?.message, code: e?.code || 'GPM_FAILED' }; }),
    syncEarthdataCmrForFarm(userClient, userId, farm, 'ecostress')
      .then((r) => { outcomes.ecostress = { ok: true, ...r }; })
      .catch((e) => { outcomes.ecostress = { ok: false, error: e?.message, code: e?.code || 'ECOSTRESS_FAILED' }; }),
  ];

  await Promise.all(tasks);
  summaryCache.invalidatePrefix(`${farm.id}:`);
  return outcomes;
}

export interface FarmNasaSummary {
  farmId: string;
  hasPowerData: boolean;
  powerRecordCount: number;
  powerLatestObservedAt: string | null;
  powerLastRetrievedAt: string | null;
  meanTempC: number | null;
  maxTempC: number | null;
  minTempC: number | null;
  precipTotalMm: number | null;
  meanHumidityPct: number | null;
  meanSolarRadiationMj: number | null;
  meanWindSpeedMps: number | null;
  growingDegreeDaysBase10C: number | null;
  missingPowerPointsCount: number;
  hasModisNumericData: boolean;
  hasModisMaskedOnly: boolean;
  modisValidPixelCount: number;
  modisMaskedPixelCount: number;
  latestModisNdvi: number | null;
  latestModisEvi: number | null;
  latestModisNdviDate: string | null;
  latestModisQuality: string | null;
  latestModisTile: string | null;
  latestModisRetrievedAt: string | null;
  latestModisLstC: number | null;
  latestModisLstDate: string | null;
  latestModisMaskedDate: string | null;
  latestModisMaskedQuality: string | null;
  latestModisJobStatus: string | null;
  latestModisJobError: string | null;
  latestModisFailureExplanation: string | null;
  latestModisJobMetadata: Record<string, any> | null;
  modisStages: {
    granuleIndexed: boolean;
    pixelRetrievalStatus: 'pending' | 'failed' | 'extracted' | 'quality_masked';
    pixelsExtracted: boolean;
    persisted: boolean;
    latestPersistenceFailed: boolean;
    lastSuccessfulObservationDate: string | null;
  };
  cmrGranulesByDataset: Record<
    string,
    {
      granuleCount: number;
      latestGranuleId: string | null;
      latestTimeStart: string | null;
      retrievedAt: string | null;
      pixelValuesAvailable: boolean;
    }
  >;
  dailyTimeline: Array<{
    date: string;
    t2m: number | null;
    t2mMax: number | null;
    t2mMin: number | null;
    precipMm: number | null;
    rh2m: number | null;
    solarMj: number | null;
    windSpeedMps: number | null;
  }>;
  recentNormalizedObservations: NASAObservation[];
}

export async function getFarmNasaObservationsSummary(
  client: SupabaseClient,
  farmId: string,
  cacheOwnerScope = 'public'
): Promise<FarmNasaSummary> {
  const cacheKey = `${farmId}:${cacheOwnerScope}`;
  const cached = summaryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Query each dataset bucket separately so large daily POWER series never evict 16-day MODIS or CMR rows
  const [powerQueryRes, modisQueryRes, cmrQueryRes, modisJobRes] = await Promise.all([
    client
      .from('nasa_observations')
      .select('*')
      .eq('farm_id', farmId)
      .eq('dataset_id', 'nasa-power')
      .order('observed_at', { ascending: false })
      .limit(700),
    client
      .from('nasa_observations')
      .select('*')
      .eq('farm_id', farmId)
      .eq('dataset_id', 'modis')
      .order('observed_at', { ascending: false })
      .limit(120),
    client
      .from('nasa_observations')
      .select('*')
      .eq('farm_id', farmId)
      .in('dataset_id', ['smap', 'gpm', 'ecostress'])
      .order('observed_at', { ascending: false })
      .limit(60),
    client
      .from('ingestion_jobs')
      .select('status, error_message, metadata, created_at, completed_at')
      .eq('farm_id', farmId)
      .eq('dataset_id', 'modis')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (powerQueryRes.error && modisQueryRes.error && cmrQueryRes.error) {
    logEvent('NasaRead', 'OBSERVATIONS_QUERY_ERROR', { farmId, error: powerQueryRes.error.message });
    return {
      farmId,
      hasPowerData: false,
      powerRecordCount: 0,
      powerLatestObservedAt: null,
      powerLastRetrievedAt: null,
      meanTempC: null,
      maxTempC: null,
      minTempC: null,
      precipTotalMm: null,
      meanHumidityPct: null,
      meanSolarRadiationMj: null,
      meanWindSpeedMps: null,
      growingDegreeDaysBase10C: null,
      missingPowerPointsCount: 0,
      hasModisNumericData: false,
      hasModisMaskedOnly: false,
      modisValidPixelCount: 0,
      modisMaskedPixelCount: 0,
      latestModisNdvi: null,
      latestModisEvi: null,
      latestModisNdviDate: null,
      latestModisQuality: null,
      latestModisTile: null,
      latestModisRetrievedAt: null,
      latestModisLstC: null,
      latestModisLstDate: null,
      latestModisMaskedDate: null,
      latestModisMaskedQuality: null,
      latestModisJobStatus: null,
      latestModisJobError: null,
      latestModisFailureExplanation: null,
      latestModisJobMetadata: null,
      modisStages: {
        granuleIndexed: false,
        pixelRetrievalStatus: 'pending',
        pixelsExtracted: false,
        persisted: false,
        latestPersistenceFailed: false,
        lastSuccessfulObservationDate: null,
      },
      cmrGranulesByDataset: {},
      dailyTimeline: [],
      recentNormalizedObservations: [],
    };
  }

  const powerAllRows = powerQueryRes.data || [];
  const modisRows = modisQueryRes.data || [];
  const cmrOtherRows = cmrQueryRes.data || [];
  const combinedRecentRows = [...modisRows, ...cmrOtherRows, ...powerAllRows].sort((a: any, b: any) =>
    String(b.observed_at).localeCompare(String(a.observed_at))
  );

  const powerRows = powerAllRows.filter((r: any) => r.product_id !== 'NASA_POWER_AG_MONTHLY');

  const dayMap = new Map<
    string,
    {
      date: string;
      t2m: number | null;
      t2mMax: number | null;
      t2mMin: number | null;
      precipMm: number | null;
      rh2m: number | null;
      solarMj: number | null;
      windSpeedMps: number | null;
    }
  >();

  let missingCount = 0;
  let latestObsAt: string | null = null;
  let latestRetrievedAt: string | null = null;

  for (const r of powerRows) {
    const dateKey = String(r.observed_at).slice(0, 10);
    if (!latestObsAt || r.observed_at > latestObsAt) latestObsAt = r.observed_at;
    if (!latestRetrievedAt || r.retrieved_at > latestRetrievedAt) latestRetrievedAt = r.retrieved_at;
    if (r.is_missing || r.value === null) {
      missingCount++;
    }

    const entry = dayMap.get(dateKey) || {
      date: dateKey,
      t2m: null,
      t2mMax: null,
      t2mMin: null,
      precipMm: null,
      rh2m: null,
      solarMj: null,
      windSpeedMps: null,
    };

    const val = r.is_missing || r.value === null ? null : Number(r.value);
    if (r.variable === 'T2M') entry.t2m = val;
    else if (r.variable === 'T2M_MAX') entry.t2mMax = val;
    else if (r.variable === 'T2M_MIN') entry.t2mMin = val;
    else if (r.variable === 'PRECTOTCORR') entry.precipMm = val;
    else if (r.variable === 'RH2M') entry.rh2m = val;
    else if (r.variable === 'ALLSKY_SFC_SW_DWN') entry.solarMj = val;
    else if (r.variable === 'WS2M') entry.windSpeedMps = val;

    dayMap.set(dateKey, entry);
  }

  const timeline = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const avg = (vals: Array<number | null>): number | null => {
    const valid = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (valid.length === 0) return null;
    return Number((valid.reduce((s, v) => s + v, 0) / valid.length).toFixed(2));
  };

  const validPrecip = timeline.map((d) => d.precipMm).filter((v): v is number => typeof v === 'number');
  const precipTotalMm = validPrecip.length > 0 ? Number(validPrecip.reduce((s, v) => s + v, 0).toFixed(2)) : null;

  const validMax = timeline.map((d) => d.t2mMax).filter((v): v is number => typeof v === 'number');
  const validMin = timeline.map((d) => d.t2mMin).filter((v): v is number => typeof v === 'number');

  let gddSum = 0;
  let gddDays = 0;
  for (const d of timeline) {
    if (typeof d.t2mMax === 'number' && typeof d.t2mMin === 'number') {
      const tmaxCapped = Math.min(30, d.t2mMax);
      const tminFloor = Math.max(10, d.t2mMin);
      const meanT = (tmaxCapped + tminFloor) / 2;
      gddSum += Math.max(0, meanT - 10);
      gddDays++;
    }
  }

  // Extract live MODIS numeric NDVI / EVI / LST_Day_1km + quality-masked ORNL rows
  const modisNdviRows = modisRows.filter((r: any) => r.variable === 'NDVI' && !r.is_missing && r.value !== null);
  const modisEviRows = modisRows.filter((r: any) => r.variable === 'EVI' && !r.is_missing && r.value !== null);
  const modisLstRows = modisRows.filter((r: any) => r.variable === 'LST_Day_1km' && !r.is_missing && r.value !== null);
  const modisOrnlMaskedRows = modisRows.filter(
    (r: any) => r.provenance === 'live_api_nasa_ornl_modis' && (r.is_missing || r.value === null)
  );
  const latestNdviRow = modisNdviRows[0];
  const latestEviRow = modisEviRows[0];
  const latestLstRow = modisLstRows[0];
  const latestMaskedRow = modisOrnlMaskedRows[0];

  const cmrGranulesByDataset: FarmNasaSummary['cmrGranulesByDataset'] = {};
  for (const ds of ['smap', 'gpm', 'modis', 'ecostress'] as const) {
    const sourcePool = ds === 'modis' ? modisRows : cmrOtherRows;
    const dsRows = sourcePool.filter((r: any) => r.dataset_id === ds && String(r.variable).includes('GRANULE_COVERAGE'));
    const latest = dsRows[0];
    cmrGranulesByDataset[ds] = {
      granuleCount: dsRows.length,
      latestGranuleId: latest?.raw_metadata?.granuleId || null,
      latestTimeStart: latest?.raw_metadata?.timeStart || latest?.observed_at || null,
      retrievedAt: latest?.retrieved_at || null,
      pixelValuesAvailable: ds === 'modis' && Boolean(latestNdviRow),
    };
  }

  const latestModisJob = modisJobRes.data || null;
  const latestModisJobMetadata =
    latestModisJob?.metadata && typeof latestModisJob.metadata === 'object' ? latestModisJob.metadata : null;
  const jobStages = latestModisJobMetadata?.stages as ModisPipelineStages | undefined;
  const latestModisNdviDate = latestNdviRow ? String(latestNdviRow.observed_at).slice(0, 10) : null;
  const modisValidPixelCount = modisNdviRows.length + modisEviRows.length + modisLstRows.length;
  const modisMaskedPixelCount = modisOrnlMaskedRows.length;
  const granuleIndexed = Boolean(cmrGranulesByDataset.modis?.latestGranuleId);
  const latestPersistenceFailed = jobStages?.persistence?.status === 'failed';
  const latestJobPixelFailed =
    jobStages?.pixelRetrieval?.status === 'failed' ||
    latestModisJob?.status === 'failed' ||
    (latestModisJob?.status === 'partial' && Boolean(latestModisJob?.error_message));

  const pixelRetrievalStatus: FarmNasaSummary['modisStages']['pixelRetrievalStatus'] =
    latestModisJob?.status === 'running' || latestModisJob?.status === 'pending'
      ? 'pending'
      : latestJobPixelFailed
      ? 'failed'
      : latestNdviRow
      ? 'extracted'
      : modisOrnlMaskedRows.length > 0
      ? 'quality_masked'
      : 'pending';

  const latestModisFailureExplanation =
    latestJobPixelFailed || latestPersistenceFailed
      ? summarizeModisFailureReason(latestModisJob?.error_message, latestPersistenceFailed)
      : null;

  const summary: FarmNasaSummary = {
    farmId,
    hasPowerData: timeline.length > 0,
    powerRecordCount: powerRows.length,
    powerLatestObservedAt: latestObsAt,
    powerLastRetrievedAt: latestRetrievedAt,
    meanTempC: avg(timeline.map((d) => d.t2m)),
    maxTempC: validMax.length > 0 ? Number(Math.max(...validMax).toFixed(2)) : null,
    minTempC: validMin.length > 0 ? Number(Math.min(...validMin).toFixed(2)) : null,
    precipTotalMm,
    meanHumidityPct: avg(timeline.map((d) => d.rh2m)),
    meanSolarRadiationMj: avg(timeline.map((d) => d.solarMj)),
    meanWindSpeedMps: avg(timeline.map((d) => d.windSpeedMps)),
    growingDegreeDaysBase10C: gddDays > 0 ? Number(gddSum.toFixed(1)) : null,
    missingPowerPointsCount: missingCount,
    hasModisNumericData: Boolean(latestNdviRow),
    hasModisMaskedOnly: !latestNdviRow && modisOrnlMaskedRows.length > 0,
    modisValidPixelCount,
    modisMaskedPixelCount,
    latestModisNdvi: latestNdviRow ? Number(latestNdviRow.value) : null,
    latestModisEvi: latestEviRow ? Number(latestEviRow.value) : null,
    latestModisNdviDate,
    latestModisQuality: latestNdviRow?.raw_metadata?.qualityStatus || latestNdviRow?.quality_flag || null,
    latestModisTile: latestNdviRow?.raw_metadata?.tile || latestMaskedRow?.raw_metadata?.tile || null,
    latestModisRetrievedAt: latestNdviRow ? String(latestNdviRow.retrieved_at) : null,
    latestModisLstC: latestLstRow ? Number(latestLstRow.value) : null,
    latestModisLstDate: latestLstRow ? String(latestLstRow.observed_at).slice(0, 10) : null,
    latestModisMaskedDate: latestMaskedRow ? String(latestMaskedRow.observed_at).slice(0, 10) : null,
    latestModisMaskedQuality: latestMaskedRow?.raw_metadata?.qualityStatus || latestMaskedRow?.quality_flag || null,
    latestModisJobStatus: latestModisJob?.status || null,
    latestModisJobError: latestModisJob?.error_message || null,
    latestModisFailureExplanation,
    latestModisJobMetadata,
    modisStages: {
      granuleIndexed,
      pixelRetrievalStatus,
      pixelsExtracted: Boolean(latestNdviRow) || jobStages?.pixelRetrieval?.status === 'extracted',
      persisted: Boolean(latestNdviRow) && !latestPersistenceFailed,
      latestPersistenceFailed,
      lastSuccessfulObservationDate: latestModisNdviDate,
    },
    cmrGranulesByDataset,
    dailyTimeline: timeline,
    recentNormalizedObservations: combinedRecentRows.slice(0, 40).map(mapDbObservationToCanonical),
  };

  summaryCache.set(cacheKey, summary);
  return summary;
}
