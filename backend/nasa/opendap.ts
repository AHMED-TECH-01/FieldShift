import {
  DbObservationInsertRow,
  fetchNasaText,
  NasaUpstreamError,
  normalizeGpmPrecipitation,
  normalizeModisScaledIndex,
  normalizeSmapSoilMoisture,
} from './units-and-quality.js';

export interface DmrVariableMeta {
  name: string;
  fullPath: string;
  dims: Array<{ name: string; size: number }>;
  fillValue: number | null;
  scaleFactor: number | null;
  addOffset: number | null;
  units: string | null;
}

export interface DmrMetadata {
  dimensions: Map<string, number>;
  variables: DmrVariableMeta[];
}

export function extractOpendapUrlFromCmrEntry(entry: any): string | null {
  const links = Array.isArray(entry?.links) ? entry.links : [];
  for (const link of links) {
    const href = typeof link?.href === 'string' ? link.href.trim() : '';
    if (!href) continue;
    if (
      href.includes('opendap.earthdata.nasa.gov') ||
      (typeof link?.rel === 'string' && link.rel.includes('service#') && href.includes('/opendap'))
    ) {
      return href.replace(/\.(dmr|das|dds|ddx|ascii|nc4?|dods)(\?.*)?$/i, '');
    }
  }
  return null;
}

export function parseDmrXml(xmlText: string): DmrMetadata {
  const dimensions = new Map<string, number>();
  const dimTagRe = /<Dimension\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = dimTagRe.exec(xmlText)) !== null) {
    const attrs = m[1];
    const nameMatch = attrs.match(/\bname="([^"]+)"/i);
    const sizeMatch = attrs.match(/\bsize="(\d+)"/i);
    if (nameMatch && sizeMatch) {
      dimensions.set(nameMatch[1], Number(sizeMatch[1]));
    }
  }

  const variables: DmrVariableMeta[] = [];
  const varRe = /<(Float32|Float64|Int8|Int16|Int32|Int64|UInt8|UInt16|UInt32|Byte)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = varRe.exec(xmlText)) !== null) {
    const attrs = m[2];
    const body = m[3];
    const nameMatch = attrs.match(/\bname="([^"]+)"/i);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    const dims: Array<{ name: string; size: number }> = [];
    const dimRefRe = /<Dim\b([^>]*)\/?>/gi;
    let dm: RegExpExecArray | null;
    while ((dm = dimRefRe.exec(body)) !== null) {
      const dimAttrs = dm[1];
      const dimNameMatch = dimAttrs.match(/\bname="([^"]+)"/i);
      const dimSizeMatch = dimAttrs.match(/\bsize="(\d+)"/i);
      if (dimNameMatch) {
        const cleanName = dimNameMatch[1].split('/').pop() || dimNameMatch[1];
        const size = dimSizeMatch ? Number(dimSizeMatch[1]) : (dimensions.get(cleanName) ?? dimensions.get(dimNameMatch[1]) ?? 0);
        dims.push({ name: cleanName, size });
      } else if (dimSizeMatch) {
        dims.push({ name: `dim_${dims.length}`, size: Number(dimSizeMatch[1]) });
      }
    }

    const getAttrNumber = (attrName: string): number | null => {
      const attrRe = new RegExp(`<Attribute\\b[^>]*name="${attrName}"[^>]*>[\\s\\S]*?<Value>([^<]+)<\\/Value>`, 'i');
      const am = body.match(attrRe);
      if (!am) return null;
      const parsed = Number(am[1].trim());
      return Number.isFinite(parsed) ? parsed : null;
    };

    const getAttrString = (attrName: string): string | null => {
      const attrRe = new RegExp(`<Attribute\\b[^>]*name="${attrName}"[^>]*>[\\s\\S]*?<Value>([^<]+)<\\/Value>`, 'i');
      const am = body.match(attrRe);
      return am ? am[1].trim() : null;
    };

    variables.push({
      name,
      fullPath: name,
      dims,
      fillValue: getAttrNumber('_FillValue'),
      scaleFactor: getAttrNumber('scale_factor'),
      addOffset: getAttrNumber('add_offset'),
      units: getAttrString('units'),
    });
  }

  return { dimensions, variables };
}

/**
 * Parse DAP2/DAP4 ASCII numeric response for scalar / point subset.
 * Example DAP4/DAP2 ASCII:
 *   Dataset { ... }
 *   Float32 precipitation[time = 1][lon = 1][lat = 1] = {{{0.42}}};
 */
export function parseOpendapAsciiNumeric(asciiText: string, variableName: string): number | null {
  if (!asciiText || typeof asciiText !== 'string') return null;

  // Strip Dataset header before data separator if present
  const body = asciiText.includes('---------------------------------------------')
    ? asciiText.split('---------------------------------------------').slice(1).join('\n')
    : asciiText;

  const escapedName = variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineMatch = body.match(new RegExp(`${escapedName}[^=\\n]*=\\s*([^;\\n]+)`, 'i'));
  const targetChunk = lineMatch ? lineMatch[1] : body;

  // Extract first numeric value (excluding bracket indices)
  const cleaned = targetChunk.replace(/\[[^\]]*\]/g, ' ').replace(/[{}]/g, ' ');
  const numMatches = cleaned.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g);
  if (!numMatches || numMatches.length === 0) return null;

  const parsed = Number(numMatches[numMatches.length - 1]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * GPM IMERG 0.1 degree global grid index:
 * Grid centers: lon = -179.95 + 0.1 * i (0..3599), lat = -89.95 + 0.1 * j (0..1799)
 */
export function computeGpmGridIndex(latitude: number, longitude: number, latSize = 1800, lonSize = 3600) {
  const latIdx = Math.min(Math.max(0, Math.round((latitude + 89.95) / 0.1)), Math.max(0, latSize - 1));
  const lonIdx = Math.min(Math.max(0, Math.round((longitude + 179.95) / 0.1)), Math.max(0, lonSize - 1));
  return {
    latIdx,
    lonIdx,
    gridLat: Number((-89.95 + latIdx * 0.1).toFixed(2)),
    gridLon: Number((-179.95 + lonIdx * 0.1).toFixed(2)),
  };
}

/**
 * SMAP L4 EASE-Grid 2.0 Global 9km (M09): 1624 rows x 3856 cols.
 * Standard NSIDC EASE-Grid 2.0 equal-area parameters (WGS84):
 * R_earth = 6371228 m (or WGS84 a=6378137m cylindrical projection scaled at +/-30 deg)
 * map_scale_m = 9008.055210146, x0 = -17367530.445, y0 = 7314540.831
 */
export function computeSmapEase2GridIndex(latitude: number, longitude: number, ySize = 1624, xSize = 3856) {
  const cellSize = 9008.055210146;
  const xMin = -17367530.445161499;
  const yMax = 7314540.8306386;
  const a = 6378137.0;
  const e = 0.0818191908426215;
  const cos30 = Math.cos((30 * Math.PI) / 180);
  const k0 = cos30 / Math.sqrt(1 - e * e * Math.sin((30 * Math.PI) / 180) ** 2);

  const lam = (longitude * Math.PI) / 180;
  const phi = (latitude * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  const q =
    (1 - e * e) *
    (sinPhi / (1 - e * e * sinPhi * sinPhi) -
      (1 / (2 * e)) * Math.log((1 - e * sinPhi) / (1 + e * sinPhi)));
  const q90 =
    (1 - e * e) *
    (1 / (1 - e * e) - (1 / (2 * e)) * Math.log((1 - e) / (1 + e)));
  const sinBeta = Math.max(-1, Math.min(1, q / q90));

  const xMeters = a * k0 * lam;
  const yMeters = (a * q) / (2 * k0);
  void sinBeta;

  const col = Math.min(Math.max(0, Math.floor((xMeters - xMin) / cellSize)), Math.max(0, xSize - 1));
  const row = Math.min(Math.max(0, Math.floor((yMax - yMeters) / cellSize)), Math.max(0, ySize - 1));
  return { row, col };
}

/**
 * MODIS Sinusoidal 250m (4800x4800) / 1km (1200x1200) tile pixel index
 */
export function computeModisSinusoidalPixelIndex(latitude: number, longitude: number, tileDimSize = 4800) {
  const R = 6371007.181;
  const T = 1111950.519667;
  const xMin = -20015109.354;
  const yMax = 10007554.677;
  const phi = (latitude * Math.PI) / 180;
  const lam = (longitude * Math.PI) / 180;
  const y = R * phi;
  const x = R * lam * Math.cos(phi);

  const hFloat = (x - xMin) / T;
  const vFloat = (yMax - y) / T;
  const h = Math.min(35, Math.max(0, Math.floor(hFloat)));
  const v = Math.min(17, Math.max(0, Math.floor(vFloat)));

  const col = Math.min(tileDimSize - 1, Math.max(0, Math.floor((hFloat - h) * tileDimSize)));
  const row = Math.min(tileDimSize - 1, Math.max(0, Math.floor((vFloat - v) * tileDimSize)));
  const tile = `h${String(h).padStart(2, '0')}v${String(v).padStart(2, '0')}`;
  return { h, v, tile, row, col };
}

function buildAxisConstraint(
  dims: Array<{ name: string; size: number }>,
  axisResolver: (dimName: string, size: number) => number
): string {
  if (dims.length === 0) return '';
  return dims
    .map((d) => {
      const idx = Math.min(Math.max(0, axisResolver(d.name, d.size)), Math.max(0, d.size - 1));
      return `[${idx}]`;
    })
    .join('');
}

export interface OpendapExtractionResult {
  dataset: 'smap' | 'gpm' | 'modis';
  granuleId: string;
  opendapUrl: string;
  observedAt: string;
  retrievedAt: string;
  rows: DbObservationInsertRow[];
  validNumericCount: number;
  maskedCount: number;
  durationMs: number;
}

export async function extractOpendapPointObservations(params: {
  dataset: 'smap' | 'gpm' | 'modis';
  farmId: string;
  userId: string | null;
  latitude: number;
  longitude: number;
  spatialMethod?: 'point_centroid_approximation' | 'polygon_boundary';
  granuleEntry: any;
  earthdataToken: string;
  timeoutMs?: number;
  fetchImpl?: typeof globalThis.fetch;
}): Promise<OpendapExtractionResult> {
  const startedAt = Date.now();
  const opendapUrl = extractOpendapUrlFromCmrEntry(params.granuleEntry);
  if (!opendapUrl) {
    throw new NasaUpstreamError(
      `No NASA Earthdata Cloud OPeNDAP service URL found in CMR granule ${params.granuleEntry?.producer_granule_id || params.granuleEntry?.id || 'unknown'}.`,
      422,
      'OPENDAP_URL_UNAVAILABLE',
      false,
      { category: 'validation' }
    );
  }

  const token = params.earthdataToken.trim();
  if (!token) {
    throw new NasaUpstreamError(
      'EARTHDATA_TOKEN is not configured in server environment; cannot authenticate to NASA Earthdata OPeNDAP.',
      401,
      'EARTHDATA_TOKEN_MISSING',
      false,
      { category: 'auth' }
    );
  }

  const headers = { Authorization: `Bearer ${token}` };
  const timeoutMs = params.timeoutMs ?? 15000;
  const granuleId = String(params.granuleEntry?.producer_granule_id || params.granuleEntry?.title || params.granuleEntry?.id || 'unknown');
  const observedAt = params.granuleEntry?.time_start
    ? new Date(params.granuleEntry.time_start).toISOString()
    : new Date().toISOString();

  // 1. Validate authentication & inspect variable metadata via .dmr
  const dmrXml = await fetchNasaText(`${opendapUrl}.dmr`, {
    timeoutMs,
    maxRetries: 1,
    headers,
    fetchImpl: params.fetchImpl,
  });
  const dmr = parseDmrXml(dmrXml);
  const retrievedAt = new Date().toISOString();
  const rows: DbObservationInsertRow[] = [];
  const spatialMethod = params.spatialMethod || 'point_centroid_approximation';

  if (params.dataset === 'gpm') {
    const precipVar =
      dmr.variables.find((v) => v.name === 'precipitation') ||
      dmr.variables.find((v) => v.name === 'precipitationCal') ||
      dmr.variables.find((v) => /precip/i.test(v.name));
    if (!precipVar) {
      throw new NasaUpstreamError(
        `GPM OPeNDAP .dmr missing precipitation variable for granule ${granuleId}.`,
        502,
        'OPENDAP_VARIABLE_MISSING',
        false,
        { category: 'parse_error' }
      );
    }

    const latDim = precipVar.dims.find((d) => /^lat/i.test(d.name))?.size || 1800;
    const lonDim = precipVar.dims.find((d) => /^lon/i.test(d.name))?.size || 3600;
    const { latIdx, lonIdx, gridLat, gridLon } = computeGpmGridIndex(params.latitude, params.longitude, latDim, lonDim);
    const slice = buildAxisConstraint(precipVar.dims, (name) => {
      if (/^lat/i.test(name)) return latIdx;
      if (/^lon/i.test(name)) return lonIdx;
      return 0;
    });
    const asciiUrl = `${opendapUrl}.ascii?${encodeURIComponent(precipVar.name)}${slice}`;
    const ascii = await fetchNasaText(asciiUrl, { timeoutMs, maxRetries: 1, headers, fetchImpl: params.fetchImpl });
    const rawVal = parseOpendapAsciiNumeric(ascii, precipVar.name);
    const fill = precipVar.fillValue ?? -9999.9;
    const scaled =
      rawVal !== null && rawVal !== fill
        ? rawVal * (precipVar.scaleFactor ?? 1) + (precipVar.addOffset ?? 0)
        : rawVal;
    const norm = normalizeGpmPrecipitation(scaled, fill);

    rows.push({
      farm_id: params.farmId,
      user_id: params.userId,
      scope_owner_id: params.userId || 'public',
      provider: 'NASA GES DISC (Earthdata Cloud OPeNDAP)',
      dataset_id: 'gpm',
      dataset_name: 'GPM IMERG Late Precipitation L3 1 day 0.1° x 0.1°',
      product_id: 'GPM_3IMERGDL',
      variable: 'precipitation',
      value: norm.value,
      unit: 'mm/day',
      latitude: params.latitude,
      longitude: params.longitude,
      observed_at: observedAt,
      retrieved_at: retrievedAt,
      spatial_resolution: '0.1° x 0.1° (~10 km)',
      temporal_resolution: 'Daily (Late Run)',
      quality_flag: norm.qualityFlag,
      processing_method: 'NASA Earthdata Cloud OPeNDAP NetCDF4 grid subsetting',
      processing_version: 'IMERG V07',
      source_url: asciiUrl,
      is_missing: norm.isMissing,
      provenance: 'live_api_nasa_opendap',
      raw_metadata: {
        granuleId,
        opendapUrl,
        variablePath: precipVar.name,
        gridLat,
        gridLon,
        latIdx,
        lonIdx,
        qualityStatus: norm.qualityStatus,
        spatialMethod,
        uncertainty: '0.1° (~10 km) Late Run microwave/IR merged grid; gauge adjustment occurs in Final Run.',
      },
    });
  } else if (params.dataset === 'smap') {
    const surfaceVar =
      dmr.variables.find((v) => v.name === 'sm_surface') ||
      dmr.variables.find((v) => /sm_surface$/i.test(v.name));
    const rootVar =
      dmr.variables.find((v) => v.name === 'sm_rootzone') ||
      dmr.variables.find((v) => /sm_rootzone$/i.test(v.name));

    const targets = [
      surfaceVar ? { varMeta: surfaceVar, canonicalName: 'sm_surface', label: 'Surface Soil Moisture (0-5 cm)' } : null,
      rootVar ? { varMeta: rootVar, canonicalName: 'sm_rootzone', label: 'Root-Zone Soil Moisture (0-100 cm)' } : null,
    ].filter((x): x is { varMeta: DmrVariableMeta; canonicalName: string; label: string } => Boolean(x));

    if (targets.length === 0) {
      throw new NasaUpstreamError(
        `SMAP OPeNDAP .dmr missing sm_surface/sm_rootzone variables for granule ${granuleId}.`,
        502,
        'OPENDAP_VARIABLE_MISSING',
        false,
        { category: 'parse_error' }
      );
    }

    const firstDims = targets[0].varMeta.dims;
    const yDim = firstDims.find((d) => /^y|lat|row/i.test(d.name))?.size || 1624;
    const xDim = firstDims.find((d) => /^x|lon|col/i.test(d.name))?.size || 3856;
    const { row, col } = computeSmapEase2GridIndex(params.latitude, params.longitude, yDim, xDim);

    const queryExprs = targets.map((t) => {
      const slice = buildAxisConstraint(t.varMeta.dims, (name) => {
        if (/^y|lat|row/i.test(name)) return row;
        if (/^x|lon|col/i.test(name)) return col;
        return 0;
      });
      return `${encodeURIComponent(t.varMeta.name)}${slice}`;
    });
    const asciiUrl = `${opendapUrl}.ascii?${queryExprs.join(',')}`;
    const ascii = await fetchNasaText(asciiUrl, { timeoutMs, maxRetries: 1, headers, fetchImpl: params.fetchImpl });

    for (const t of targets) {
      const rawVal = parseOpendapAsciiNumeric(ascii, t.varMeta.name);
      const fill = t.varMeta.fillValue ?? -9999;
      const scaled =
        rawVal !== null && rawVal !== fill
          ? rawVal * (t.varMeta.scaleFactor ?? 1) + (t.varMeta.addOffset ?? 0)
          : rawVal;
      const norm = normalizeSmapSoilMoisture(scaled, fill);

      rows.push({
        farm_id: params.farmId,
        user_id: params.userId,
        scope_owner_id: params.userId || 'public',
        provider: 'NASA NSIDC DAAC (Earthdata Cloud OPeNDAP)',
        dataset_id: 'smap',
        dataset_name: 'SMAP L4 Global 3-hourly 9 km Surface and Root Zone Soil Moisture',
        product_id: 'SPL4SMGP',
        variable: t.canonicalName,
        value: norm.value,
        unit: 'm³/m³',
        latitude: params.latitude,
        longitude: params.longitude,
        observed_at: observedAt,
        retrieved_at: retrievedAt,
        spatial_resolution: '9 km EASE-Grid 2.0',
        temporal_resolution: '3-hourly model assimilation',
        quality_flag: norm.qualityFlag,
        processing_method: 'NASA Earthdata Cloud OPeNDAP HDF5 EASE-Grid 2.0 point subsetting',
        processing_version: 'SPL4SMGP V008',
        source_url: asciiUrl,
        is_missing: norm.isMissing,
        provenance: 'live_api_nasa_opendap',
        raw_metadata: {
          granuleId,
          bandLabel: t.label,
          opendapUrl,
          easeRow: row,
          easeCol: col,
          qualityStatus: norm.qualityStatus,
          spatialMethod,
          uncertainty: '9 km EASE-Grid 2.0 assimilated cell; aggregates local soil drainage heterogeneity.',
        },
      });
    }
  } else if (params.dataset === 'modis') {
    const ndviVar = dmr.variables.find((v) => /NDVI/i.test(v.name));
    const eviVar = dmr.variables.find((v) => /EVI/i.test(v.name));
    const relVar = dmr.variables.find((v) => /pixel_reliability|pixel reliability/i.test(v.name));
    if (!ndviVar) {
      throw new NasaUpstreamError(
        `MODIS OPeNDAP .dmr missing NDVI variable for granule ${granuleId}.`,
        502,
        'OPENDAP_VARIABLE_MISSING',
        false,
        { category: 'parse_error' }
      );
    }

    const tileDim = ndviVar.dims.find((d) => /YDim|lat/i.test(d.name))?.size || 4800;
    const { row, col, tile } = computeModisSinusoidalPixelIndex(params.latitude, params.longitude, tileDim);
    const varsToFetch = [
      { varMeta: ndviVar, key: 'NDVI' as const },
      eviVar ? { varMeta: eviVar, key: 'EVI' as const } : null,
      relVar ? { varMeta: relVar, key: 'REL' as const } : null,
    ].filter((x): x is { varMeta: DmrVariableMeta; key: 'NDVI' | 'EVI' | 'REL' } => Boolean(x));

    const queryExpr = varsToFetch
      .map((v) => {
        const slice = buildAxisConstraint(v.varMeta.dims, (name) => {
          if (/YDim|lat|row/i.test(name)) return row;
          if (/XDim|lon|col/i.test(name)) return col;
          return 0;
        });
        return `${encodeURIComponent(v.varMeta.name)}${slice}`;
      })
      .join(',');

    const asciiUrl = `${opendapUrl}.ascii?${queryExpr}`;
    const ascii = await fetchNasaText(asciiUrl, { timeoutMs, maxRetries: 1, headers, fetchImpl: params.fetchImpl });

    const relCode = relVar ? parseOpendapAsciiNumeric(ascii, relVar.name) : 0;
    for (const target of varsToFetch) {
      if (target.key === 'REL') continue;
      const rawVal = parseOpendapAsciiNumeric(ascii, target.varMeta.name);
      const fill = target.varMeta.fillValue ?? -3000;
      const norm = normalizeModisScaledIndex(rawVal, relCode, fill, 0.0001);

      rows.push({
        farm_id: params.farmId,
        user_id: params.userId,
        scope_owner_id: params.userId || 'public',
        provider: 'NASA LP DAAC (Earthdata Cloud OPeNDAP)',
        dataset_id: 'modis',
        dataset_name: 'MODIS/Terra Vegetation Indices 16-Day L3 Global 250m (MOD13Q1)',
        product_id: 'MOD13Q1',
        variable: target.key,
        value: norm.value,
        unit: 'index (-1.0 to +1.0)',
        latitude: params.latitude,
        longitude: params.longitude,
        observed_at: `${observedAt.slice(0, 10)}T00:00:00.000Z`,
        retrieved_at: retrievedAt,
        spatial_resolution: '250 m sinusoidal pixel',
        temporal_resolution: '16-day composite',
        quality_flag: norm.qualityFlag,
        processing_method: 'NASA Earthdata Cloud OPeNDAP sinusoidal pixel extraction',
        processing_version: 'Collection 6.1 (v061)',
        source_url: asciiUrl,
        is_missing: norm.isMissing,
        provenance: 'live_api_nasa_opendap',
        raw_metadata: {
          bandLabel: `250m 16-Day ${target.key}`,
          tile,
          sinusoidalRow: row,
          sinusoidalCol: col,
          granuleId,
          pixelReliabilityCode: relCode ?? null,
          scaleFactor: 0.0001,
          fillValue: fill,
          qualityStatus: norm.qualityStatus,
          spatialMethod,
          uncertainty: '250 m sinusoidal composite pixel centered on parcel point; cloud/snow pixels excluded.',
        },
      });
    }
  }

  const validNumericCount = rows.filter((r) => !r.is_missing && r.value !== null).length;
  return {
    dataset: params.dataset,
    granuleId,
    opendapUrl,
    observedAt,
    retrievedAt,
    rows,
    validNumericCount,
    maskedCount: rows.length - validNumericCount,
    durationMs: Date.now() - startedAt,
  };
}
