import { getModisTimeoutMs } from '../env.js';
import { extractOpendapPointObservations, extractOpendapUrlFromCmrEntry } from './opendap.js';
import {
  DbObservationInsertRow,
  deduplicateObservationRows,
  fetchNasaJson,
  NasaUpstreamError,
  normalizeModisLstCelsius,
  normalizeModisScaledIndex,
  normalizePowerValue,
  validateCoordinates,
  validateDateRange,
} from './units-and-quality.js';

export const POWER_PARAMETERS = [
  { key: 'T2M', label: 'Mean Air Temp at 2m', unit: '°C' },
  { key: 'T2M_MAX', label: 'Max Air Temp at 2m', unit: '°C' },
  { key: 'T2M_MIN', label: 'Min Air Temp at 2m', unit: '°C' },
  { key: 'PRECTOTCORR', label: 'Bias-Corrected Precipitation', unit: 'mm/day' },
  { key: 'RH2M', label: 'Relative Humidity at 2m', unit: '%' },
  { key: 'ALLSKY_SFC_SW_DWN', label: 'All-Sky Surface Solar Irradiance', unit: 'MJ/m²/day' },
  { key: 'WS2M', label: 'Wind Speed at 2m', unit: 'm/s' },
] as const;

export type SupportedCmrDataset = 'smap' | 'gpm' | 'modis' | 'ecostress';

export const CMR_PRODUCT_MAP: Record<
  SupportedCmrDataset,
  {
    shortName: string;
    datasetName: string;
    provider: string;
    spatialResolution: string;
    temporalResolution: string;
    processingMethod: string;
    processingVersion: string;
    variable: string;
    unit: string;
    documentationUrl: string;
  }
> = {
  smap: {
    shortName: 'SPL4SMGP',
    datasetName: 'SMAP L4 Global 3-hourly 9 km Surface and Root Zone Soil Moisture',
    provider: 'NASA NSIDC DAAC / JPL',
    spatialResolution: '9 km EASE-Grid 2.0',
    temporalResolution: '3-hourly model assimilation',
    processingMethod: 'NASA Earthdata CMR granule discovery (HDF5 pixel extraction requires EARTHDATA_TOKEN + HDF5 reader)',
    processingVersion: 'SPL4SMGP V008',
    variable: 'SMAP_L4_GRANULE_COVERAGE',
    unit: 'm³/m³ (granule metadata)',
    documentationUrl: 'https://nsidc.org/data/smap',
  },
  gpm: {
    shortName: 'GPM_3IMERGDL',
    datasetName: 'GPM IMERG Late Precipitation L3 1 day 0.1° x 0.1°',
    provider: 'NASA GES DISC',
    spatialResolution: '0.1° x 0.1° (~10 km)',
    temporalResolution: 'Daily (Late Run ~14h latency)',
    processingMethod: 'NASA Earthdata CMR granule discovery (NetCDF4 pixel extraction requires EARTHDATA_TOKEN + NetCDF4 reader)',
    processingVersion: 'IMERG V07',
    variable: 'GPM_IMERG_LATE_GRANULE_COVERAGE',
    unit: 'mm/day (granule metadata)',
    documentationUrl: 'https://gpm.nasa.gov/data',
  },
  modis: {
    shortName: 'MOD13Q1',
    datasetName: 'MODIS/Terra Vegetation Indices 16-Day L3 Global 250m',
    provider: 'NASA LP DAAC / ORNL DAAC',
    spatialResolution: '250 m',
    temporalResolution: '16-day composite',
    processingMethod: 'MODIS ORNL DAAC Global Subsets REST API (NDVI/EVI/Reliability) + Earthdata CMR granule metadata',
    processingVersion: 'Collection 6.1 (v061)',
    variable: 'MOD13Q1_NDVI_GRANULE_COVERAGE',
    unit: 'NDVI/EVI (-1.0 to +1.0)',
    documentationUrl: 'https://modis.gsfc.nasa.gov/data/',
  },
  ecostress: {
    shortName: 'ECO_L3T_JET',
    datasetName: 'ECOSTRESS Tiled Ancillary Evapotranspiration L3 Global 70m',
    provider: 'NASA LP DAAC / JPL',
    spatialResolution: '70 m',
    temporalResolution: 'Variable ISS orbit (1-5 days)',
    processingMethod: 'NASA Earthdata CMR granule discovery (GeoTIFF/HDF5 download requires EARTHDATA_TOKEN)',
    processingVersion: 'Collection 3 (v003)',
    variable: 'ECOSTRESS_ET_GRANULE_COVERAGE',
    unit: 'W/m² & ESI (granule metadata)',
    documentationUrl: 'https://ecostress.jpl.nasa.gov/',
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

export function resolvePowerDateRange(options?: { startDate?: string; endDate?: string; days?: number }): {
  startDate: string;
  endDate: string;
} {
  const days = Math.min(90, Math.max(1, options?.days || 30));
  if (options?.startDate && options?.endDate) {
    const check = validateDateRange(options.startDate, options.endDate, 366);
    if (!check.valid) {
      throw new NasaUpstreamError(check.error || 'Invalid date range', 400, 'INVALID_DATE_RANGE', false);
    }
    return { startDate: options.startDate, endDate: options.endDate };
  }
  if (options?.startDate || options?.endDate) {
    throw new NasaUpstreamError('Both startDate and endDate must be provided together.', 400, 'INVALID_DATE_RANGE', false);
  }
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 5);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return {
    startDate: formatDateYmd(start),
    endDate: formatDateYmd(end),
  };
}

export async function fetchNasaPowerSeries(params: {
  farmId: string;
  userId: string | null;
  longitude: number;
  latitude: number;
  resolution?: 'daily' | 'monthly';
  startDate?: string;
  endDate?: string;
  days?: number;
  spatialMethod?: 'point_centroid_approximation' | 'polygon_boundary';
  fetchImpl?: typeof globalThis.fetch;
}) {
  const coord = validateCoordinates(params.longitude, params.latitude);
  if (!coord.valid) {
    throw new NasaUpstreamError(coord.error || 'Invalid coordinates', 400, 'INVALID_COORDINATES', false);
  }

  const resolution = params.resolution === 'monthly' ? 'monthly' : 'daily';
  const { startDate, endDate } = resolvePowerDateRange({
    startDate: params.startDate,
    endDate: params.endDate,
    days: params.days,
  });

  const paramsList = POWER_PARAMETERS.map((p) => p.key).join(',');
  const sourceUrl =
    resolution === 'monthly'
      ? `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${paramsList}` +
        `&community=AG&longitude=${coord.longitude}&latitude=${coord.latitude}&start=${startDate.slice(0, 4)}&end=${endDate.slice(0, 4)}&format=JSON`
      : `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${paramsList}` +
        `&community=AG&longitude=${coord.longitude}&latitude=${coord.latitude}&start=${toCompactYmd(startDate)}&end=${toCompactYmd(endDate)}&format=JSON`;

  const payload = await fetchNasaJson<any>(sourceUrl, {
    timeoutMs: 12000,
    maxRetries: 2,
    fetchImpl: params.fetchImpl,
  });

  const paramMap = payload?.properties?.parameter;
  if (!paramMap || typeof paramMap !== 'object') {
    throw new NasaUpstreamError('NASA POWER response missing properties.parameter block', 502, 'NASA_MALFORMED_RESPONSE', false);
  }

  const elevationMeters = Array.isArray(payload?.geometry?.coordinates)
    ? Number(payload.geometry.coordinates[2])
    : null;
  const fillValue = Number(payload?.header?.fill_value ?? -999);
  const apiVersion = String(payload?.header?.api?.version || 'v2');
  const retrievedAt = new Date().toISOString();
  const productId = resolution === 'monthly' ? 'NASA_POWER_AG_MONTHLY' : 'NASA_POWER_AG_DAILY';

  const rawRows: DbObservationInsertRow[] = [];
  for (const paramDef of POWER_PARAMETERS) {
    const series = paramMap[paramDef.key];
    if (!series || typeof series !== 'object') continue;

    for (const [dateKey, rawVal] of Object.entries(series)) {
      let isoDate: string | null = null;
      if (resolution === 'daily' && /^\d{8}$/.test(dateKey)) {
        isoDate = `${fromCompactYmd(dateKey)}T00:00:00.000Z`;
      } else if (resolution === 'monthly' && /^\d{6}$/.test(dateKey)) {
        const monthPart = dateKey.slice(4, 6);
        if (monthPart >= '01' && monthPart <= '12') {
          isoDate = `${dateKey.slice(0, 4)}-${monthPart}-01T00:00:00.000Z`;
        }
      }
      if (!isoDate) continue;

      const normalized = normalizePowerValue(rawVal, fillValue);
      rawRows.push({
        farm_id: params.farmId,
        user_id: params.userId,
        scope_owner_id: params.userId || 'public',
        provider: 'NASA Langley Research Center (LaRC)',
        dataset_id: 'nasa-power',
        dataset_name:
          resolution === 'monthly'
            ? 'NASA POWER Monthly Agroclimatology'
            : 'NASA POWER Daily Agroclimatology',
        product_id: productId,
        variable: paramDef.key,
        value: normalized.value,
        unit: paramDef.unit,
        latitude: coord.latitude,
        longitude: coord.longitude,
        observed_at: isoDate,
        retrieved_at: retrievedAt,
        spatial_resolution: '0.5° x 0.5° (~50 km)',
        temporal_resolution: resolution === 'monthly' ? 'Monthly' : 'Daily',
        quality_flag: normalized.qualityFlag,
        processing_method: `GEOS atmospheric assimilation + CERES satellite radiation (Community: AG, ${resolution})`,
        processing_version: `POWER API ${apiVersion}`,
        source_url: sourceUrl,
        is_missing: normalized.isMissing,
        provenance: 'live_api_nasa_power',
        raw_metadata: {
          parameterLabel: paramDef.label,
          qualityStatus: normalized.qualityStatus,
          elevationMeters,
          fillValue,
          spatialMethod: params.spatialMethod || 'point_centroid_approximation',
          uncertainty: '0.5° (~50 km) meteorological assimilation grid; not a parcel weather station.',
        },
      });
    }
  }

  return {
    sourceUrl,
    startDate,
    endDate,
    resolution,
    elevationMeters,
    apiVersion,
    retrievedAt,
    rows: deduplicateObservationRows(rawRows),
  };
}

export async function fetchModisOrnlData(params: {
  farmId: string;
  userId: string | null;
  longitude: number;
  latitude: number;
  maxComposites?: number;
  startDate?: string;
  endDate?: string;
  requestedWindowKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  totalBudgetMs?: number;
  spatialMethod?: 'point_centroid_approximation' | 'polygon_boundary';
  fetchImpl?: typeof globalThis.fetch;
}) {
  const coord = validateCoordinates(params.longitude, params.latitude);
  if (!coord.valid) {
    throw new NasaUpstreamError(coord.error || 'Invalid coordinates', 400, 'INVALID_COORDINATES', false, {
      category: 'validation',
    });
  }

  if (params.startDate || params.endDate) {
    const check = validateDateRange(params.startDate, params.endDate, 730);
    if (!check.valid) {
      throw new NasaUpstreamError(check.error || 'Invalid MODIS date range', 400, 'INVALID_DATE_RANGE', false, {
        category: 'validation',
      });
    }
  }

  const startedAt = Date.now();
  const timeoutMs =
    typeof params.timeoutMs === 'number' && Number.isFinite(params.timeoutMs) && params.timeoutMs > 0
      ? Math.floor(params.timeoutMs)
      : getModisTimeoutMs();
  const maxRetries = Math.min(2, Math.max(0, params.maxRetries ?? 2));
  const explicitBudget =
    typeof params.totalBudgetMs === 'number' && Number.isFinite(params.totalBudgetMs) && params.totalBudgetMs > 0
      ? Math.floor(params.totalBudgetMs)
      : null;
  const envBudgetRaw = Number(process.env.MODIS_TOTAL_BUDGET_MS);
  const defaultVercelBudget =
    Number.isFinite(envBudgetRaw) && envBudgetRaw > 0
      ? Math.floor(envBudgetRaw)
      : process.env.VERCEL
      ? Math.min(44000, Math.max(timeoutMs + 2000, 40000))
      : null;
  const totalBudgetMs = explicitBudget ?? defaultVercelBudget;
  const deadlineMs = totalBudgetMs !== null ? startedAt + totalBudgetMs : undefined;
  const maxComposites = Math.min(10, Math.max(1, params.maxComposites || 8));
  const spatialMethod = params.spatialMethod || 'point_centroid_approximation';
  const spatialDisclosure =
    spatialMethod === 'polygon_boundary'
      ? 'Derived from surveyed GeoJSON field polygon centroid against 250 m / 1 km MODIS sinusoidal pixel.'
      : 'Point-centroid coordinate approximation (250 m / 1 km pixel centered on parcel point; not a polygon-wide zonal mean).';
  const requestedWindowKey =
    params.requestedWindowKey ||
    (params.startDate && params.endDate ? `${params.startDate}_${params.endDate}` : `latest_${maxComposites}`);

  const retrievedAt = new Date().toISOString();
  const rows: DbObservationInsertRow[] = [];

  // Verified NASA LP DAAC / ORNL DAAC product scaling constants
  const MOD13Q1_SCALE_FACTOR = 0.0001;
  const MOD13Q1_FILL_VALUE = -3000;
  const MOD11A2_SCALE_FACTOR = 0.02;
  const MOD11A2_FILL_VALUE = 0;

  // 1. Fetch MOD13Q1 (250m 16-day NDVI, EVI & Pixel Reliability) from open NASA ORNL DAAC Subsets REST API
  const datesUrl = `https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates?latitude=${coord.latitude}&longitude=${coord.longitude}`;
  const datesPayload = await fetchNasaJson<any>(datesUrl, {
    timeoutMs,
    maxRetries,
    baseBackoffMs: params.baseBackoffMs,
    deadlineMs,
    fetchImpl: params.fetchImpl,
  });

  const availableDates: Array<{ modis_date: string; calendar_date: string }> = Array.isArray(datesPayload?.dates)
    ? datesPayload.dates
    : [];

  let latestTile: string | null = null;
  let cellSizeMeters: number | null = 231.66;
  let subsetUrls: string[] = [];

  const selectedDates =
    params.startDate && params.endDate
      ? availableDates
          .filter((d) => d.calendar_date >= params.startDate! && d.calendar_date <= params.endDate!)
          .slice(-maxComposites)
      : availableDates.slice(-maxComposites);

  if (selectedDates.length > 0) {
    const startModis = selectedDates[0].modis_date;
    const endModis = selectedDates[selectedDates.length - 1].modis_date;
    const subsetBase =
      `https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=${coord.latitude}&longitude=${coord.longitude}` +
      `&startDate=${encodeURIComponent(startModis)}&endDate=${encodeURIComponent(endModis)}&kmAboveBelow=0&kmLeftRight=0`;

    const ndviUrl = `${subsetBase}&band=250m_16_days_NDVI`;
    const eviUrl = `${subsetBase}&band=250m_16_days_EVI`;
    const relUrl = `${subsetBase}&band=250m_16_days_pixel_reliability`;
    subsetUrls = [ndviUrl, eviUrl, relUrl];

    const [ndviRes, eviRes, relRes] = await Promise.all([
      fetchNasaJson<any>(ndviUrl, { timeoutMs, maxRetries, baseBackoffMs: params.baseBackoffMs, deadlineMs, fetchImpl: params.fetchImpl }),
      fetchNasaJson<any>(eviUrl, { timeoutMs, maxRetries, baseBackoffMs: params.baseBackoffMs, deadlineMs, fetchImpl: params.fetchImpl }),
      fetchNasaJson<any>(relUrl, { timeoutMs, maxRetries, baseBackoffMs: params.baseBackoffMs, deadlineMs, fetchImpl: params.fetchImpl }),
    ]);

    cellSizeMeters = typeof ndviRes?.cellsize === 'number' ? Number(ndviRes.cellsize.toFixed(2)) : cellSizeMeters;

    const reliabilityByDate = new Map<string, number>();
    for (const item of Array.isArray(relRes?.subset) ? relRes.subset : []) {
      const code = Array.isArray(item.data) ? Number(item.data[0]) : undefined;
      if (item.calendar_date && Number.isFinite(code)) {
        reliabilityByDate.set(item.calendar_date, code as number);
      }
    }

    for (const [bandKey, bandLabel, subsetList] of [
      ['NDVI', '250m 16-Day NDVI', Array.isArray(ndviRes?.subset) ? ndviRes.subset : []],
      ['EVI', '250m 16-Day EVI', Array.isArray(eviRes?.subset) ? eviRes.subset : []],
    ] as const) {
      for (const item of subsetList) {
        if (!item?.calendar_date) continue;
        if (!latestTile && item.tile) latestTile = String(item.tile);
        const relCode = reliabilityByDate.get(item.calendar_date);
        const rawVal = Array.isArray(item.data) ? item.data[0] : undefined;
        const norm = normalizeModisScaledIndex(rawVal, relCode, MOD13Q1_FILL_VALUE, MOD13Q1_SCALE_FACTOR);

        rows.push({
          farm_id: params.farmId,
          user_id: params.userId,
          scope_owner_id: params.userId || 'public',
          provider: 'NASA LP DAAC / ORNL DAAC',
          dataset_id: 'modis',
          dataset_name: 'MODIS/Terra Vegetation Indices 16-Day L3 Global 250m (MOD13Q1)',
          product_id: 'MOD13Q1',
          variable: bandKey,
          value: norm.value,
          unit: 'index (-1.0 to +1.0)',
          latitude: coord.latitude,
          longitude: coord.longitude,
          observed_at: `${item.calendar_date}T00:00:00.000Z`,
          retrieved_at: retrievedAt,
          spatial_resolution: `${cellSizeMeters ?? 250} m sinusoidal pixel`,
          temporal_resolution: '16-day composite',
          quality_flag: norm.qualityFlag,
          processing_method: 'Constrained View Angle Maximum Value Composite (CV-MVC) via ORNL DAAC Subsets API',
          processing_version: 'Collection 6.1 (v061)',
          source_url: `${subsetBase}&band=250m_16_days_${bandKey}`,
          is_missing: norm.isMissing,
          provenance: 'live_api_nasa_ornl_modis',
          raw_metadata: {
            bandLabel,
            modisDate: item.modis_date,
            tile: item.tile || null,
            procDate: item.proc_date || null,
            pixelReliabilityCode: relCode ?? null,
            scaleFactor: MOD13Q1_SCALE_FACTOR,
            fillValue: MOD13Q1_FILL_VALUE,
            requestedWindowKey,
            qualityStatus: norm.qualityStatus,
            spatialMethod,
            uncertainty: `${spatialDisclosure} Adjacent field edges may blend; cloud/snow/fill pixels are masked.`,
          },
        });
      }
    }
  }

  // 2. Optionally fetch MOD11A2 (1km 8-day Land Surface Temperature) — graceful if unavailable or budget low
  if (!deadlineMs || deadlineMs - Date.now() >= 4000) try {
    const lstDatesUrl = `https://modis.ornl.gov/rst/api/v1/MOD11A2/dates?latitude=${coord.latitude}&longitude=${coord.longitude}`;
    const lstDatesPayload = await fetchNasaJson<any>(lstDatesUrl, {
      timeoutMs,
      maxRetries: Math.min(1, maxRetries),
      baseBackoffMs: params.baseBackoffMs,
      deadlineMs,
      fetchImpl: params.fetchImpl,
    });
    const lstDates: Array<{ modis_date: string; calendar_date: string }> = Array.isArray(lstDatesPayload?.dates)
      ? lstDatesPayload.dates
      : [];
    const selectedLstDates =
      params.startDate && params.endDate
        ? lstDates.filter((d) => d.calendar_date >= params.startDate! && d.calendar_date <= params.endDate!).slice(-3)
        : lstDates.slice(-3);

    if (selectedLstDates.length > 0 && (!deadlineMs || deadlineMs - Date.now() >= 2500)) {
      const lstUrl =
        `https://modis.ornl.gov/rst/api/v1/MOD11A2/subset?latitude=${coord.latitude}&longitude=${coord.longitude}` +
        `&startDate=${encodeURIComponent(selectedLstDates[0].modis_date)}&endDate=${encodeURIComponent(selectedLstDates[selectedLstDates.length - 1].modis_date)}&band=LST_Day_1km&kmAboveBelow=0&kmLeftRight=0`;
      const lstRes = await fetchNasaJson<any>(lstUrl, {
        timeoutMs,
        maxRetries: Math.min(1, maxRetries),
        baseBackoffMs: params.baseBackoffMs,
        deadlineMs,
        fetchImpl: params.fetchImpl,
      });
      for (const item of Array.isArray(lstRes?.subset) ? lstRes.subset : []) {
        if (!item?.calendar_date) continue;
        const rawVal = Array.isArray(item.data) ? item.data[0] : undefined;
        const norm = normalizeModisLstCelsius(rawVal, MOD11A2_FILL_VALUE, MOD11A2_SCALE_FACTOR);
        rows.push({
          farm_id: params.farmId,
          user_id: params.userId,
          scope_owner_id: params.userId || 'public',
          provider: 'NASA LP DAAC / ORNL DAAC',
          dataset_id: 'modis',
          dataset_name: 'MODIS/Terra Land Surface Temperature 8-Day L3 Global 1 km (MOD11A2)',
          product_id: 'MOD11A2',
          variable: 'LST_Day_1km',
          value: norm.value,
          unit: '°C',
          latitude: coord.latitude,
          longitude: coord.longitude,
          observed_at: `${item.calendar_date}T00:00:00.000Z`,
          retrieved_at: retrievedAt,
          spatial_resolution: '1 km sinusoidal pixel',
          temporal_resolution: '8-day composite',
          quality_flag: norm.qualityFlag,
          processing_method: 'Clear-sky thermal infrared split-window retrieval (0.02 K -> °C explicit conversion)',
          processing_version: 'Collection 6.1 (v061)',
          source_url: lstUrl,
          is_missing: norm.isMissing,
          provenance: 'live_api_nasa_ornl_modis',
          raw_metadata: {
            bandLabel: 'MOD11A2 Daytime Land Surface Temperature',
            modisDate: item.modis_date,
            tile: item.tile || null,
            scaleFactor: MOD11A2_SCALE_FACTOR,
            fillValue: MOD11A2_FILL_VALUE,
            requestedWindowKey,
            qualityStatus: norm.qualityStatus,
            spatialMethod,
            uncertainty: `1 km thermal skin temperature (${spatialMethod === 'polygon_boundary' ? 'polygon centroid' : 'point-centroid approximation'}); reflects composite clear-sky surface temperature, not 2m air temp.`,
          },
        });
      }
    }
  } catch {
    // MOD11A2 optional enrichment must never fail MOD13Q1 ingestion
  }

  const dedupedRows = deduplicateObservationRows(rows);
  const validNumericCount = dedupedRows.filter((r) => !r.is_missing && r.value !== null).length;
  const maskedCount = dedupedRows.length - validNumericCount;
  const latestObservedDate = dedupedRows
    .filter((r) => !r.is_missing && r.value !== null)
    .map((r) => r.observed_at.slice(0, 10))
    .sort()
    .pop() || null;

  return {
    retrievedAt,
    latestTile,
    cellSizeMeters,
    rows: dedupedRows,
    validNumericCount,
    maskedCount,
    latestObservedDate,
    requestedWindowKey,
    diagnostics: {
      timeoutMs,
      maxRetries,
      durationMs: Date.now() - startedAt,
      datesUrl,
      subsetUrls,
      compositesFound: selectedDates.length,
      availableDatesCount: availableDates.length,
      isEmptyUpstream: selectedDates.length === 0 || dedupedRows.length === 0,
    },
  };
}

export async function fetchEarthdataCmrGranules(params: {
  farmId: string;
  userId: string | null;
  longitude: number;
  latitude: number;
  dataset: SupportedCmrDataset;
  boundingBox?: [number, number, number, number];
  spatialMethod?: 'point_centroid_approximation' | 'polygon_boundary';
  earthdataToken?: string;
  fetchImpl?: typeof globalThis.fetch;
}) {
  const coord = validateCoordinates(params.longitude, params.latitude);
  if (!coord.valid) {
    throw new NasaUpstreamError(coord.error || 'Invalid coordinates', 400, 'INVALID_COORDINATES', false);
  }

  const cfg = CMR_PRODUCT_MAP[params.dataset];
  const bbox = params.boundingBox || [
    Number((coord.longitude - 0.15).toFixed(4)),
    Number((coord.latitude - 0.15).toFixed(4)),
    Number((coord.longitude + 0.15).toFixed(4)),
    Number((coord.latitude + 0.15).toFixed(4)),
  ];
  const bboxStr = bbox.join(',');

  const sourceUrl =
    `https://cmr.earthdata.nasa.gov/search/granules.json?short_name=${encodeURIComponent(cfg.shortName)}` +
    `&bounding_box=${bboxStr}&page_size=5&sort_key=-start_date`;

  const headers: Record<string, string> = {};
  const token = (params.earthdataToken || process.env.EARTHDATA_TOKEN || '').trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let payload: any;
  let earthdataTokenRejected = false;
  try {
    payload = await fetchNasaJson<any>(sourceUrl, {
      timeoutMs: 12000,
      maxRetries: 2,
      headers,
      fetchImpl: params.fetchImpl,
    });
  } catch (err: any) {
    // Public CMR collection search returns 401 when an expired/invalid Bearer token is attached;
    // retry once unauthenticated for public granule metadata so CMR discovery does not break.
    if (token && err instanceof NasaUpstreamError && (err.status === 401 || err.status === 403)) {
      earthdataTokenRejected = true;
      payload = await fetchNasaJson<any>(sourceUrl, {
        timeoutMs: 12000,
        maxRetries: 2,
        fetchImpl: params.fetchImpl,
      });
    } else {
      throw err;
    }
  }

  const entries = Array.isArray(payload?.feed?.entry) ? payload.feed.entry : [];
  const retrievedAt = new Date().toISOString();
  const hasValidEarthdataToken = Boolean(token) && !earthdataTokenRejected;

  const rawRows: DbObservationInsertRow[] = entries.map((entry: any): DbObservationInsertRow => {
    const observedAt = entry.time_start ? new Date(entry.time_start).toISOString() : retrievedAt;
    const opendapUrl = extractOpendapUrlFromCmrEntry(entry);
    const dataLink = Array.isArray(entry.links)
      ? entry.links.find((l: any) => typeof l.href === 'string' && l.href.startsWith('http'))?.href
      : undefined;

    return {
      farm_id: params.farmId,
      user_id: params.userId,
      scope_owner_id: params.userId || 'public',
      provider: cfg.provider,
      dataset_id: params.dataset,
      dataset_name: cfg.datasetName,
      product_id: cfg.shortName,
      variable: cfg.variable,
      // Strict scientific integrity: never fabricate numeric satellite pixels without verified OPeNDAP/HDF5/NetCDF extraction
      value: null,
      unit: cfg.unit,
      latitude: coord.latitude,
      longitude: coord.longitude,
      observed_at: observedAt,
      retrieved_at: retrievedAt,
      spatial_resolution: cfg.spatialResolution,
      temporal_resolution: cfg.temporalResolution,
      quality_flag: hasValidEarthdataToken
        ? 'granule_discovered_opendap_ready'
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
        opendapUrl,
        earthdataTokenRejected,
        qualityStatus: earthdataTokenRejected
          ? 'Granule verified via public CMR (configured EARTHDATA_TOKEN was rejected with 401/403 during OPeNDAP/CMR auth)'
          : hasValidEarthdataToken
          ? 'Granule verified via CMR (EARTHDATA_TOKEN present; ready for Earthdata Cloud OPeNDAP extraction)'
          : 'Granule coverage verified via CMR (EARTHDATA_TOKEN required for Earthdata Cloud OPeNDAP pixel extraction)',
        spatialMethod: params.spatialMethod || 'point_centroid_approximation',
        uncertainty: `${cfg.spatialResolution} satellite footprint; metadata-only coverage record.`,
        earthdataAuthRequiredForPixelExtraction: true,
      },
    };
  });

  return {
    sourceUrl,
    bbox: bboxStr,
    retrievedAt,
    entriesCount: entries.length,
    entries,
    earthdataTokenConfigured: Boolean(token),
    earthdataTokenRejected,
    rows: deduplicateObservationRows(rawRows),
  };
}

export async function extractPixelsFromCmrEntriesViaOpendap(params: {
  dataset: 'smap' | 'gpm' | 'modis';
  farmId: string;
  userId: string | null;
  latitude: number;
  longitude: number;
  spatialMethod?: 'point_centroid_approximation' | 'polygon_boundary';
  entries: any[];
  maxGranules?: number;
  earthdataToken?: string;
  timeoutMs?: number;
  fetchImpl?: typeof globalThis.fetch;
}) {
  const token = (params.earthdataToken ?? process.env.EARTHDATA_TOKEN ?? '').trim();
  if (!token) {
    return {
      attempted: false,
      authStatus: 'missing_token' as const,
      rows: [] as DbObservationInsertRow[],
      validNumericCount: 0,
      maskedCount: 0,
      error: 'EARTHDATA_TOKEN is not configured in server environment.',
      errorCategory: 'auth' as const,
    };
  }

  const candidates = (params.entries || [])
    .filter((entry) => Boolean(extractOpendapUrlFromCmrEntry(entry)))
    .slice(0, Math.max(1, params.maxGranules || 3));

  if (candidates.length === 0) {
    return {
      attempted: false,
      authStatus: 'no_opendap_links' as const,
      rows: [] as DbObservationInsertRow[],
      validNumericCount: 0,
      maskedCount: 0,
      error: 'No NASA Earthdata Cloud OPeNDAP service URLs found on discovered CMR granules.',
      errorCategory: 'validation' as const,
    };
  }

  const allRows: DbObservationInsertRow[] = [];
  let lastErr: any = null;
  let successCount = 0;

  for (const entry of candidates) {
    try {
      const res = await extractOpendapPointObservations({
        dataset: params.dataset,
        farmId: params.farmId,
        userId: params.userId,
        latitude: params.latitude,
        longitude: params.longitude,
        spatialMethod: params.spatialMethod,
        granuleEntry: entry,
        earthdataToken: token,
        timeoutMs: params.timeoutMs,
        fetchImpl: params.fetchImpl,
      });
      allRows.push(...res.rows);
      successCount++;
    } catch (err: any) {
      lastErr = err;
      // Auth failure (401/403) must fail fast without spamming remaining granules
      if (err instanceof NasaUpstreamError && (err.status === 401 || err.status === 403)) {
        return {
          attempted: true,
          authStatus: 'auth_rejected' as const,
          rows: [] as DbObservationInsertRow[],
          validNumericCount: 0,
          maskedCount: 0,
          error: err.message,
          errorCategory: 'auth' as const,
        };
      }
    }
  }

  if (successCount === 0 && lastErr) {
    return {
      attempted: true,
      authStatus: 'extraction_failed' as const,
      rows: [] as DbObservationInsertRow[],
      validNumericCount: 0,
      maskedCount: 0,
      error: lastErr instanceof Error ? lastErr.message : String(lastErr),
      errorCategory: lastErr instanceof NasaUpstreamError ? lastErr.category : ('network' as const),
    };
  }

  const deduped = deduplicateObservationRows(allRows);
  const validNumericCount = deduped.filter((r) => !r.is_missing && r.value !== null).length;
  return {
    attempted: true,
    authStatus: 'authenticated' as const,
    rows: deduped,
    validNumericCount,
    maskedCount: deduped.length - validNumericCount,
    error: null,
    errorCategory: null,
  };
}
