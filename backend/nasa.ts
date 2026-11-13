import { SupabaseClient } from '@supabase/supabase-js';
import { NasaHarmonizedDataset } from '../src/types';
import { logEvent } from './logger';
import { DbFarmRecord } from './supabase';

export type SupportedSyncDataset = 'nasa-power' | 'smap' | 'gpm' | 'modis' | 'ecostress';

export const SUPPORTED_SYNC_DATASETS: SupportedSyncDataset[] = [
  'nasa-power',
  'smap',
  'gpm',
  'modis',
  'ecostress',
];

export const nasaHarmonizedRoadmap: NasaHarmonizedDataset[] = [
  {
    id: 'nasa-power',
    code: 'NASA POWER Agro',
    name: 'Prediction Of Worldwide Energy Resources (POWER) Daily Agroclimatology',
    source: 'NASA Langley Research Center Atmospheric Science Data Center',
    spatialResolution: '0.5° latitude x 0.5° longitude (~50 km)',
    temporalResolution: 'Daily (1981-present; ~4-5 day archive latency)',
    observationPeriod: '1981-present (40+ year climatology baseline)',
    units: 'Solar flux (MJ/m²/day), T2M/Tmax/Tmin (°C), PRECTOTCORR (mm/day), RH2M (%)',
    processingMethod: 'Goddard Earth Observing System (GEOS) atmospheric assimilation coupled with CERES satellite radiation',
    analyticalPurpose: 'Calculates thermal heat units, solar radiation fluxes, precipitation totals, and frost exposure risks.',
    limitations: 'Assimilated meteorological grid (~50 km); not a field-level weather station.',
    lastRetrievedTimestamp: 'Live Public API',
    dataCategory: 'Model Assimilated',
  },
  {
    id: 'smap',
    code: 'SMAP L4_SM_gph',
    name: 'Soil Moisture Active Passive (SMAP) L4 Surface & Root-Zone',
    source: 'NASA Jet Propulsion Laboratory & NSIDC DAAC',
    spatialResolution: '9 km EASE-Grid 2.0 assimilated',
    temporalResolution: '3-hour model assimilation (daily archive)',
    observationPeriod: '2015-present (continuous)',
    units: 'Volumetric soil moisture (m³/m³)',
    processingMethod: 'Kalman filtering assimilation of L-band brightness temperature with Catchment Land Surface Model',
    analyticalPurpose: 'Quantifies root-zone available water capacity to evaluate plant stress and irrigation timing.',
    limitations: '9 km spatial cell aggregates localized topography; HDF5 pixel extraction requires Earthdata Login Bearer token.',
    lastRetrievedTimestamp: 'NASA Earthdata CMR Discovery',
    dataCategory: 'Model Assimilated',
  },
  {
    id: 'gpm',
    code: 'GPM 3IMERGDL',
    name: 'Global Precipitation Measurement (GPM) IMERG Late Daily Run',
    source: 'NASA Goddard Earth Sciences / GES DISC',
    spatialResolution: '0.1° x 0.1° (~10 km at equator)',
    temporalResolution: 'Daily Late Run (~14h latency) / Final Run (~3.5 mo gauge calibrated)',
    observationPeriod: '2000-present (continuous)',
    units: 'Precipitation accumulation (mm/day)',
    processingMethod: 'Combined passive microwave sensor gridding with infrared motion vector morphing',
    analyticalPurpose: 'Tracks rainfall accumulation, storm intensity, and prolonged drought intervals.',
    limitations: 'Near-real-time Late Run differs from Final gauge-calibrated research run; NetCDF4 pixel extraction requires Earthdata Login.',
    lastRetrievedTimestamp: 'NASA Earthdata CMR Discovery',
    dataCategory: 'Ground Truth Calibrated',
  },
  {
    id: 'modis',
    code: 'MOD13Q1 v061',
    name: 'MODIS Terra Vegetation Indices 16-Day L3 Global 250m',
    source: 'NASA Land Processes Distributed Active Archive Center (LP DAAC)',
    spatialResolution: '250 m multispectral',
    temporalResolution: '16-day composite',
    observationPeriod: '2000-present (continuous)',
    units: 'NDVI & EVI (-1.0 to +1.0)',
    processingMethod: 'Constrained View Angle Maximum Value Composite (CV-MVC) minimizing cloud effects',
    analyticalPurpose: 'Measures photosynthetic activity, biomass density, and seasonal crop emergence.',
    limitations: '250 m composite may blend adjacent parcels and cannot confirm pests; HDF-EOS pixel extraction requires Earthdata Login.',
    lastRetrievedTimestamp: 'NASA Earthdata CMR Discovery',
    dataCategory: 'Satellite Derived',
  },
  {
    id: 'ecostress',
    code: 'ECOSTRESS L3T JET',
    name: 'ECOsystem Spaceborne Thermal Radiometer Experiment on Space Station',
    source: 'NASA JPL / International Space Station Orbit Payload',
    spatialResolution: '70 m x 70 m multispectral thermal',
    temporalResolution: 'Variable 1 to 5 days (ISS precessing orbit track)',
    observationPeriod: '2018-present',
    units: 'Actual ET (W/m²) & Evaporative Stress Index (dimensionless)',
    processingMethod: 'Surface energy balance model (PT-JPL) driven by thermal infrared bands (8–12.5 µm)',
    analyticalPurpose: 'Detects plant water stress before visible wilting occurs by measuring thermal canopy emission.',
    limitations: 'Variable ISS orbit precludes fixed revisit cadence; GeoTIFF/HDF5 download requires Earthdata Login.',
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

const POWER_PARAMETERS = [
  { key: 'T2M', label: 'Mean Air Temp at 2m', unit: '°C' },
  { key: 'T2M_MAX', label: 'Max Air Temp at 2m', unit: '°C' },
  { key: 'T2M_MIN', label: 'Min Air Temp at 2m', unit: '°C' },
  { key: 'PRECTOTCORR', label: 'Bias-Corrected Precipitation', unit: 'mm/day' },
  { key: 'RH2M', label: 'Relative Humidity at 2m', unit: '%' },
  { key: 'ALLSKY_SFC_SW_DWN', label: 'All-Sky Surface Solar Irradiance', unit: 'MJ/m²/day' },
] as const;

const CMR_PRODUCT_MAP: Record<Exclude<SupportedSyncDataset, 'nasa-power'>, {
  shortName: string;
  datasetName: string;
  provider: string;
  spatialResolution: string;
  temporalResolution: string;
  processingMethod: string;
  processingVersion: string;
  variable: string;
  unit: string;
}> = {
  smap: {
    shortName: 'SPL4SMGP',
    datasetName: 'SMAP L4 Global 3-hourly 9 km Surface and Root Zone Soil Moisture',
    provider: 'NASA NSIDC DAAC / JPL',
    spatialResolution: '9 km EASE-Grid 2.0',
    temporalResolution: '3-hourly',
    processingMethod: 'NASA Earthdata CMR granule search (HDF5 pixel extraction requires EARTHDATA_TOKEN)',
    processingVersion: 'SPL4SMGP V008',
    variable: 'SMAP_L4_GRANULE_COVERAGE',
    unit: 'm³/m³ (granule index)',
  },
  gpm: {
    shortName: 'GPM_3IMERGDL',
    datasetName: 'GPM IMERG Late Precipitation L3 1 day 0.1° x 0.1°',
    provider: 'NASA GES DISC',
    spatialResolution: '0.1° x 0.1° (~10 km)',
    temporalResolution: 'Daily (Late Run)',
    processingMethod: 'NASA Earthdata CMR granule search (NetCDF4 pixel extraction requires EARTHDATA_TOKEN)',
    processingVersion: 'IMERG V07',
    variable: 'GPM_IMERG_LATE_GRANULE_COVERAGE',
    unit: 'mm/day (granule index)',
  },
  modis: {
    shortName: 'MOD13Q1',
    datasetName: 'MODIS/Terra Vegetation Indices 16-Day L3 Global 250m',
    provider: 'NASA LP DAAC',
    spatialResolution: '250 m',
    temporalResolution: '16-day composite',
    processingMethod: 'NASA Earthdata CMR granule search (HDF-EOS pixel extraction requires EARTHDATA_TOKEN)',
    processingVersion: 'Collection 6.1 (v061)',
    variable: 'MOD13Q1_NDVI_GRANULE_COVERAGE',
    unit: 'NDVI -1..1 (granule index)',
  },
  ecostress: {
    shortName: 'ECO_L3T_JET',
    datasetName: 'ECOSTRESS Tiled Ancillary Evapotranspiration L3 Global 70m',
    provider: 'NASA LP DAAC / JPL',
    spatialResolution: '70 m',
    temporalResolution: 'Variable ISS orbit (1-5 days)',
    processingMethod: 'NASA Earthdata CMR granule search (GeoTIFF/HDF5 download requires EARTHDATA_TOKEN)',
    processingVersion: 'Collection 3 (v003)',
    variable: 'ECOSTRESS_ET_GRANULE_COVERAGE',
    unit: 'W/m² & ESI (granule index)',
  },
};

function formatDateYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toCompactYmd(ymd: string): string {
  return ymd.replace(/-/g, '');
}

function fromCompactYmd(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

async function fetchWithTimeoutRetry(url: string, timeoutMs = 12000, maxRetries = 1): Promise<globalThis.Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'FieldShift-Agronomic-Platform/2.5',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }
      lastError = new Error(`Upstream HTTP ${response.status}`);
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
    }
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('NASA upstream request failed');
}

export function resolvePowerDateRange(options?: { startDate?: string; endDate?: string; days?: number }): {
  startDate: string;
  endDate: string;
} {
  const days = Math.min(90, Math.max(1, options?.days || 30));
  if (options?.startDate && options?.endDate) {
    return { startDate: options.startDate, endDate: options.endDate };
  }
  // NASA POWER daily AG archive typically lags 4-5 days behind UTC calendar date
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 5);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    startDate: formatDateYmd(start),
    endDate: formatDateYmd(end),
  };
}

export async function syncNasaPowerForFarm(
  userClient: SupabaseClient,
  userId: string,
  farm: DbFarmRecord,
  options?: { startDate?: string; endDate?: string; days?: number }
) {
  const [lon, lat] = farm.coordinates;
  const { startDate, endDate } = resolvePowerDateRange(options);
  const paramsList = POWER_PARAMETERS.map((p) => p.key).join(',');
  const sourceUrl =
    `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${paramsList}` +
    `&community=AG&longitude=${lon}&latitude=${lat}&start=${toCompactYmd(startDate)}&end=${toCompactYmd(endDate)}&format=JSON`;

  // Create audit job record
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
      metadata: { latitude: lat, longitude: lon, community: 'AG', sourceUrl },
    })
    .select('*')
    .single();

  if (jobCreateErr) {
    logEvent('NasaSync', 'INGESTION_JOB_CREATE_ERROR', { farmId: farm.id, error: jobCreateErr.message });
  }

  try {
    const response = await fetchWithTimeoutRetry(sourceUrl, 12000, 1);
    if (!response.ok) {
      throw new Error(`NASA POWER API returned HTTP ${response.status}`);
    }
    const payload = await response.json();
    const paramMap = payload?.properties?.parameter;
    if (!paramMap || typeof paramMap !== 'object') {
      throw new Error('NASA POWER API response missing properties.parameter block');
    }

    const elevationMeters = Array.isArray(payload?.geometry?.coordinates)
      ? Number(payload.geometry.coordinates[2])
      : null;
    const fillValue = Number(payload?.header?.fill_value ?? -999);
    const apiVersion = String(payload?.header?.api?.version || 'v2');
    const retrievedAt = new Date().toISOString();

    const rowsToUpsert: any[] = [];
    for (const paramDef of POWER_PARAMETERS) {
      const series = paramMap[paramDef.key];
      if (!series || typeof series !== 'object') continue;

      for (const [compactDate, rawVal] of Object.entries(series)) {
        if (!/^\d{8}$/.test(compactDate)) continue;
        const numVal = typeof rawVal === 'number' ? rawVal : Number(rawVal);
        const isMissing = !Number.isFinite(numVal) || numVal === fillValue || numVal <= -990;
        const isoDate = `${fromCompactYmd(compactDate)}T00:00:00.000Z`;

        rowsToUpsert.push({
          farm_id: farm.id,
          user_id: userId,
          scope_owner_id: userId,
          provider: 'NASA Langley Research Center (LaRC)',
          dataset_id: 'nasa-power',
          dataset_name: 'NASA POWER Daily Agroclimatology',
          product_id: 'NASA_POWER_AG_DAILY',
          variable: paramDef.key,
          value: isMissing ? null : Number(numVal.toFixed(3)),
          unit: paramDef.unit,
          latitude: lat,
          longitude: lon,
          observed_at: isoDate,
          retrieved_at: retrievedAt,
          spatial_resolution: '0.5° x 0.5° (~50 km)',
          temporal_resolution: 'Daily',
          quality_flag: isMissing ? 'fill_value_missing' : 'valid',
          processing_method: 'GEOS atmospheric assimilation + CERES satellite solar flux (Community: AG)',
          processing_version: `POWER API ${apiVersion}`,
          source_url: sourceUrl,
          is_missing: isMissing,
          provenance: 'live_api_nasa_power',
          raw_metadata: {
            parameterLabel: paramDef.label,
            elevationMeters,
            fillValue,
          },
        });
      }
    }

    let savedCount = 0;
    // Chunk upserts cleanly (max 250 rows per call)
    for (let i = 0; i < rowsToUpsert.length; i += 250) {
      const chunk = rowsToUpsert.slice(i, i + 250);
      const { error: upsertErr } = await userClient
        .from('nasa_observations')
        .upsert(chunk, { onConflict: 'farm_id,scope_owner_id,product_id,variable,observed_at' });
      if (upsertErr) {
        throw new Error(`Failed saving NASA POWER observations: ${upsertErr.message}`);
      }
      savedCount += chunk.length;
    }

    if (jobRow?.id) {
      await userClient
        .from('ingestion_jobs')
        .update({
          status: 'completed',
          records_received: rowsToUpsert.length,
          records_saved: savedCount,
          completed_at: new Date().toISOString(),
          metadata: { latitude: lat, longitude: lon, elevationMeters, apiVersion },
        })
        .eq('id', jobRow.id);
    }

    logEvent('NasaSync', 'NASA_POWER_SYNC_COMPLETED', {
      farmId: farm.id,
      recordsReceived: rowsToUpsert.length,
      recordsSaved: savedCount,
      startDate,
      endDate,
    });

    return {
      dataset: 'nasa-power',
      status: 'completed' as const,
      farmId: farm.id,
      startDate,
      endDate,
      recordsReceived: rowsToUpsert.length,
      recordsSaved: savedCount,
      elevationMeters,
      retrievedAt,
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

export async function syncEarthdataCmrForFarm(
  userClient: SupabaseClient,
  userId: string,
  farm: DbFarmRecord,
  dataset: Exclude<SupportedSyncDataset, 'nasa-power'>
) {
  const cfg = CMR_PRODUCT_MAP[dataset];
  const [lon, lat] = farm.coordinates;
  const minLon = Number((lon - 0.15).toFixed(4));
  const minLat = Number((lat - 0.15).toFixed(4));
  const maxLon = Number((lon + 0.15).toFixed(4));
  const maxLat = Number((lat + 0.15).toFixed(4));
  const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;

  const sourceUrl =
    `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=${encodeURIComponent(cfg.shortName)}` +
    `&bounding_box=${bbox}&page_size=5&sort_key=-start_date`;

  const { data: jobRow } = await userClient
    .from('ingestion_jobs')
    .insert({
      farm_id: farm.id,
      user_id: userId,
      dataset_id: dataset,
      source_code: cfg.shortName,
      status: 'running',
      metadata: { boundingBox: bbox, sourceUrl },
    })
    .select('*')
    .single();

  try {
    const response = await fetchWithTimeoutRetry(sourceUrl, 12000, 1);
    if (!response.ok) {
      throw new Error(`NASA CMR API returned HTTP ${response.status}`);
    }
    const payload = await response.json();
    const entries = Array.isArray(payload?.feed?.entry) ? payload.feed.entry : [];
    const retrievedAt = new Date().toISOString();
    const hasEarthdataToken = Boolean(process.env.EARTHDATA_TOKEN);

    const dedupMap = new Map<string, any>();
    for (const entry of entries) {
      const observedAt = entry.time_start ? new Date(entry.time_start).toISOString() : retrievedAt;
      const dataLink = Array.isArray(entry.links)
        ? entry.links.find((l: any) => typeof l.href === 'string' && l.href.startsWith('http'))?.href
        : undefined;

      const conflictKey = `${cfg.shortName}|${cfg.variable}|${observedAt}`;
      if (dedupMap.has(conflictKey)) {
        continue;
      }

      dedupMap.set(conflictKey, {
        farm_id: farm.id,
        user_id: userId,
        scope_owner_id: userId,
        provider: cfg.provider,
        dataset_id: dataset,
        dataset_name: cfg.datasetName,
        product_id: cfg.shortName,
        variable: cfg.variable,
        // Never fabricate numeric satellite moisture/NDVI/precip pixels without verified binary granule parsing
        value: null,
        unit: cfg.unit,
        latitude: lat,
        longitude: lon,
        observed_at: observedAt,
        retrieved_at: retrievedAt,
        spatial_resolution: cfg.spatialResolution,
        temporal_resolution: cfg.temporalResolution,
        quality_flag: hasEarthdataToken
          ? 'granule_discovered_hdf5_extractor_pending'
          : 'granule_metadata_only_earthdata_auth_required',
        processing_method: cfg.processingMethod,
        processing_version: cfg.processingVersion,
        source_url: dataLink || sourceUrl,
        is_missing: true,
        provenance: 'live_api_nasa_earthdata_cmr',
        raw_metadata: {
          granuleId: entry.producer_granule_id || entry.title || entry.id,
          cmrConceptId: entry.id,
          timeStart: entry.time_start,
          timeEnd: entry.time_end,
          dataCenter: entry.data_center,
          granuleSizeMb: entry.granule_size ? Number(entry.granule_size) : null,
          earthdataAuthRequiredForPixelExtraction: true,
        },
      });
    }
    const rowsToUpsert = Array.from(dedupMap.values());

    if (rowsToUpsert.length > 0) {
      const { error: upsertErr } = await userClient
        .from('nasa_observations')
        .upsert(rowsToUpsert, { onConflict: 'farm_id,scope_owner_id,product_id,variable,observed_at' });
      if (upsertErr) {
        throw new Error(`Failed saving ${dataset.toUpperCase()} granule metadata: ${upsertErr.message}`);
      }
    }

    const status = rowsToUpsert.length > 0 ? 'partial' : 'completed';
    if (jobRow?.id) {
      await userClient
        .from('ingestion_jobs')
        .update({
          status,
          records_received: entries.length,
          records_saved: rowsToUpsert.length,
          completed_at: new Date().toISOString(),
          metadata: {
            boundingBox: bbox,
            latestGranuleId: rowsToUpsert[0]?.raw_metadata?.granuleId || null,
            note: 'Granule discovery verified via NASA CMR. Numeric pixel extraction from HDF5/NetCDF4 granules requires authenticated Earthdata Login download and binary reader.',
          },
        })
        .eq('id', jobRow.id);
    }

    logEvent('NasaSync', 'NASA_CMR_SYNC_COMPLETED', {
      dataset,
      farmId: farm.id,
      granulesFound: entries.length,
    });

    return {
      dataset,
      status,
      farmId: farm.id,
      recordsReceived: entries.length,
      recordsSaved: rowsToUpsert.length,
      retrievedAt,
      latestGranule: rowsToUpsert[0]?.raw_metadata || null,
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
  growingDegreeDaysBase10C: number | null;
  missingPowerPointsCount: number;
  cmrGranulesByDataset: Record<string, {
    granuleCount: number;
    latestGranuleId: string | null;
    latestTimeStart: string | null;
    retrievedAt: string | null;
    pixelValuesAvailable: false;
  }>;
  dailyTimeline: Array<{
    date: string;
    t2m: number | null;
    t2mMax: number | null;
    t2mMin: number | null;
    precipMm: number | null;
    rh2m: number | null;
    solarMj: number | null;
  }>;
}

export async function getFarmNasaObservationsSummary(
  client: SupabaseClient,
  farmId: string
): Promise<FarmNasaSummary> {
  const { data: obsRows, error } = await client
    .from('nasa_observations')
    .select('*')
    .eq('farm_id', farmId)
    .order('observed_at', { ascending: false })
    .limit(500);

  if (error) {
    logEvent('NasaRead', 'OBSERVATIONS_QUERY_ERROR', { farmId, error: error.message });
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
      growingDegreeDaysBase10C: null,
      missingPowerPointsCount: 0,
      cmrGranulesByDataset: {},
      dailyTimeline: [],
    };
  }

  const rows = obsRows || [];
  const powerRows = rows.filter((r: any) => r.dataset_id === 'nasa-power');

  const dayMap = new Map<string, {
    date: string;
    t2m: number | null;
    t2mMax: number | null;
    t2mMin: number | null;
    precipMm: number | null;
    rh2m: number | null;
    solarMj: number | null;
  }>();

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
    };

    const val = r.is_missing || r.value === null ? null : Number(r.value);
    if (r.variable === 'T2M') entry.t2m = val;
    else if (r.variable === 'T2M_MAX') entry.t2mMax = val;
    else if (r.variable === 'T2M_MIN') entry.t2mMin = val;
    else if (r.variable === 'PRECTOTCORR') entry.precipMm = val;
    else if (r.variable === 'RH2M') entry.rh2m = val;
    else if (r.variable === 'ALLSKY_SFC_SW_DWN') entry.solarMj = val;

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

  // Growing Degree Days (base 10C, cutoff 30C) calculated strictly from real POWER observations
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

  const cmrGranulesByDataset: FarmNasaSummary['cmrGranulesByDataset'] = {};
  for (const ds of ['smap', 'gpm', 'modis', 'ecostress'] as const) {
    const dsRows = rows.filter((r: any) => r.dataset_id === ds);
    const latest = dsRows[0];
    cmrGranulesByDataset[ds] = {
      granuleCount: dsRows.length,
      latestGranuleId: latest?.raw_metadata?.granuleId || null,
      latestTimeStart: latest?.raw_metadata?.timeStart || latest?.observed_at || null,
      retrievedAt: latest?.retrieved_at || null,
      pixelValuesAvailable: false,
    };
  }

  return {
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
    growingDegreeDaysBase10C: gddDays > 0 ? Number(gddSum.toFixed(1)) : null,
    missingPowerPointsCount: missingCount,
    cmrGranulesByDataset,
    dailyTimeline: timeline,
  };
}
