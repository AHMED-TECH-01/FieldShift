import test from 'node:test';
import assert from 'node:assert/strict';
import {
  celsiusToFahrenheit,
  deduplicateObservationRows,
  fetchNasaJson,
  kelvinToCelsius,
  mapDbObservationToCanonical,
  mmToInches,
  mpsToMph,
  mjToKwh,
  NasaTtlCache,
  NasaUpstreamError,
  normalizeModisLstCelsius,
  normalizeModisScaledIndex,
  normalizePowerValue,
  resolveFarmGeometry,
  validateCoordinates,
  validateDateRange,
} from '../backend/nasa/units-and-quality.js';
import {
  fetchEarthdataCmrGranules,
  fetchModisOrnlData,
  fetchNasaPowerSeries,
} from '../backend/nasa/providers.js';

function jsonResponse(body: any, status = 200): globalThis.Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('validateCoordinates enforces WGS84 longitude/latitude bounds', () => {
  assert.deepEqual(validateCoordinates(-93.621234, 42.034567), {
    valid: true,
    longitude: -93.62123,
    latitude: 42.03457,
  });
  assert.equal(validateCoordinates(181, 42).valid, false);
  assert.equal(validateCoordinates(-93, -95).valid, false);
  assert.equal(validateCoordinates(Number.NaN, 42).valid, false);
});

test('resolveFarmGeometry distinguishes centroid approximation from GeoJSON polygons', () => {
  const pointGeom = resolveFarmGeometry({ coordinates: [-93.62, 42.03] });
  assert.equal(pointGeom.spatialMethod, 'point_centroid_approximation');
  assert.equal(pointGeom.hasPolygonBoundary, false);
  assert.equal(pointGeom.longitude, -93.62);
  assert.equal(pointGeom.latitude, 42.03);

  const polyGeom = resolveFarmGeometry({
    boundaryGeoJson: {
      type: 'Polygon',
      coordinates: [[
        [-93.64, 42.02],
        [-93.60, 42.02],
        [-93.60, 42.04],
        [-93.64, 42.04],
      ]],
    },
  });
  assert.equal(polyGeom.spatialMethod, 'polygon_boundary');
  assert.equal(polyGeom.hasPolygonBoundary, true);
  assert.equal(polyGeom.longitude, -93.62);
  assert.equal(polyGeom.latitude, 42.03);
  assert.deepEqual(polyGeom.boundingBox, [-93.64, 42.02, -93.6, 42.04]);
});

test('validateDateRange validates YYYY-MM-DD pairs and span limits', () => {
  assert.equal(validateDateRange('2026-04-01', '2026-04-15').valid, true);
  assert.equal(validateDateRange('2026-04-15', '2026-04-01').valid, false);
  assert.equal(validateDateRange('2026-04-01', undefined).valid, false);
  assert.equal(validateDateRange('2024-01-01', '2026-04-01', 366).valid, false);
  assert.equal(validateDateRange('2026/04/01', '2026/04/15').valid, false);
});

test('Explicit unit conversion helpers compute accurate scientific values', () => {
  assert.equal(celsiusToFahrenheit(20), 68);
  assert.equal(kelvinToCelsius(298.15), 25);
  assert.equal(mmToInches(25.4), 1);
  assert.equal(mpsToMph(10), 22.37);
  assert.equal(mjToKwh(10), 2.778);
});

test('Quality normalizers isolate fill values and cloudy MODIS pixels', () => {
  const missingPower = normalizePowerValue(-999.0);
  assert.equal(missingPower.value, null);
  assert.equal(missingPower.isMissing, true);

  const validPower = normalizePowerValue(18.4567);
  assert.equal(validPower.value, 18.457);
  assert.equal(validPower.isMissing, false);

  const goodNdvi = normalizeModisScaledIndex(6160, 0);
  assert.equal(goodNdvi.value, 0.616);
  assert.equal(goodNdvi.qualityFlag, 'good_data');
  assert.equal(goodNdvi.isMissing, false);

  const cloudyNdvi = normalizeModisScaledIndex(5400, 3);
  assert.equal(cloudyNdvi.value, null);
  assert.equal(cloudyNdvi.qualityFlag, 'cloudy');
  assert.equal(cloudyNdvi.isMissing, true);

  const snowNdvi = normalizeModisScaledIndex(1200, 2);
  assert.equal(snowNdvi.value, null);
  assert.equal(snowNdvi.qualityFlag, 'snow_ice');
  assert.equal(snowNdvi.isMissing, true);

  const validLst = normalizeModisLstCelsius(14800, 0, 0.02); // 296.0 K => 22.85 C
  assert.equal(validLst.value, 22.85);
  assert.equal(validLst.isMissing, false);

  const fillLst = normalizeModisLstCelsius(0, 0, 0.02);
  assert.equal(fillLst.value, null);
  assert.equal(fillLst.isMissing, true);
});

test('deduplicateObservationRows prevents batch upsert collisions', () => {
  const rows = [
    { product_id: 'ECO_L3T_JET', variable: 'ECO_ET', observed_at: '2026-04-01T12:00:00Z', seq: 1 },
    { product_id: 'ECO_L3T_JET', variable: 'ECO_ET', observed_at: '2026-04-01T12:00:00Z', seq: 2 },
    { product_id: 'MOD13Q1', variable: 'NDVI', observed_at: '2026-04-01T00:00:00Z', seq: 3 },
  ];
  const deduped = deduplicateObservationRows(rows);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].seq, 1);
});

test('NasaTtlCache supports set, get, expiration, and prefix invalidation', async () => {
  const cache = new NasaTtlCache<number>(50, 10);
  cache.set('farm-1:a', 42);
  cache.set('farm-2:a', 99);
  assert.equal(cache.get('farm-1:a'), 42);
  cache.invalidatePrefix('farm-1:');
  assert.equal(cache.get('farm-1:a'), null);
  assert.equal(cache.get('farm-2:a'), 99);
  await new Promise((r) => setTimeout(r, 65));
  assert.equal(cache.get('farm-2:a'), null);
});

test('fetchNasaJson short-circuits 401/403 without retries and retries 429', async () => {
  let authAttempts = 0;
  await assert.rejects(
    () =>
      fetchNasaJson('https://example.nasa.gov/protected', {
        maxRetries: 2,
        fetchImpl: async () => {
          authAttempts++;
          return jsonResponse({ error: 'Unauthorized' }, 401);
        },
      }),
    (err: any) => err instanceof NasaUpstreamError && err.status === 401 && err.code === 'NASA_AUTH_REJECTED'
  );
  assert.equal(authAttempts, 1);

  let rateLimitAttempts = 0;
  const recovered = await fetchNasaJson<{ ok: boolean }>('https://example.nasa.gov/retry', {
    maxRetries: 2,
    fetchImpl: async () => {
      rateLimitAttempts++;
      if (rateLimitAttempts === 1) {
        return jsonResponse({ error: 'Too many requests' }, 429);
      }
      return jsonResponse({ ok: true }, 200);
    },
  });
  assert.equal(recovered.ok, true);
  assert.equal(rateLimitAttempts, 2);

  await assert.rejects(
    () =>
      fetchNasaJson('https://example.nasa.gov/malformed', {
        maxRetries: 0,
        fetchImpl: async () => new Response('not-valid-json{', { status: 200 }),
      }),
    (err: any) => err instanceof NasaUpstreamError && err.code === 'NASA_MALFORMED_JSON'
  );
});

test('fetchNasaPowerSeries handles daily + monthly resolutions, WS2M, -999 fills, and YYYY13', async () => {
  const monthlyRes = await fetchNasaPowerSeries({
    farmId: 'farm-test',
    userId: 'user-test',
    longitude: -93.62,
    latitude: 42.03,
    resolution: 'monthly',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    fetchImpl: async (url) => {
      assert.match(String(url), /\/temporal\/monthly\/point/);
      assert.match(String(url), /WS2M/);
      return jsonResponse({
        header: { fill_value: -999, api: { version: 'v2.6' } },
        geometry: { coordinates: [-93.62, 42.03, 290.5] },
        properties: {
          parameter: {
            T2M: { '202501': -5.2, '202507': 23.4, '202513': 9.8 },
            PRECTOTCORR: { '202501': 1.2, '202507': -999.0, '202513': 2.5 },
            WS2M: { '202501': 4.3, '202507': 3.1, '202513': 3.8 },
          },
        },
      });
    },
  });

  assert.equal(monthlyRes.resolution, 'monthly');
  assert.equal(monthlyRes.elevationMeters, 290.5);
  // 2 months * 3 parameters = 6 rows (annual summary 202513 must be excluded)
  assert.equal(monthlyRes.rows.length, 6);
  const julPrecip = monthlyRes.rows.find((r) => r.variable === 'PRECTOTCORR' && r.observed_at === '2025-07-01T00:00:00.000Z');
  assert.ok(julPrecip);
  assert.equal(julPrecip.value, null);
  assert.equal(julPrecip.is_missing, true);

  await assert.rejects(
    () =>
      fetchNasaPowerSeries({
        farmId: 'farm-test',
        userId: 'user-test',
        longitude: 999,
        latitude: 42,
      }),
    (err: any) => err instanceof NasaUpstreamError && err.status === 400
  );
});

test('fetchModisOrnlData parses MOD13Q1 NDVI/EVI + MOD11A2 LST and filters cloudy pixels', async () => {
  const result = await fetchModisOrnlData({
    farmId: 'farm-test',
    userId: 'user-test',
    longitude: -93.62,
    latitude: 42.03,
    maxComposites: 2,
    fetchImpl: async (url) => {
      const u = String(url);
      if (u.includes('/MOD13Q1/dates')) {
        return jsonResponse({
          dates: [
            { modis_date: 'A2026065', calendar_date: '2026-03-06' },
            { modis_date: 'A2026081', calendar_date: '2026-03-22' },
          ],
        });
      }
      if (u.includes('band=250m_16_days_NDVI')) {
        return jsonResponse({
          cellsize: 231.656,
          subset: [
            { modis_date: 'A2026065', calendar_date: '2026-03-06', tile: 'h10v04', data: [4200] },
            { modis_date: 'A2026081', calendar_date: '2026-03-22', tile: 'h10v04', data: [6160] },
          ],
        });
      }
      if (u.includes('band=250m_16_days_EVI')) {
        return jsonResponse({
          subset: [
            { modis_date: 'A2026065', calendar_date: '2026-03-06', tile: 'h10v04', data: [2100] },
            { modis_date: 'A2026081', calendar_date: '2026-03-22', tile: 'h10v04', data: [3008] },
          ],
        });
      }
      if (u.includes('band=250m_16_days_pixel_reliability')) {
        return jsonResponse({
          subset: [
            { modis_date: 'A2026065', calendar_date: '2026-03-06', data: [3] }, // cloudy -> must exclude value!
            { modis_date: 'A2026081', calendar_date: '2026-03-22', data: [0] }, // good
          ],
        });
      }
      if (u.includes('/MOD11A2/dates')) {
        return jsonResponse({ dates: [{ modis_date: 'A2026081', calendar_date: '2026-03-22' }] });
      }
      if (u.includes('/MOD11A2/subset')) {
        return jsonResponse({
          subset: [{ modis_date: 'A2026081', calendar_date: '2026-03-22', tile: 'h10v04', data: [14800] }],
        });
      }
      throw new Error(`Unexpected mock URL: ${u}`);
    },
  });

  assert.equal(result.latestTile, 'h10v04');
  assert.equal(result.rows.length, 5); // 2 NDVI + 2 EVI + 1 LST
  const mar06Ndvi = result.rows.find((r) => r.variable === 'NDVI' && r.observed_at.startsWith('2026-03-06'));
  const mar22Ndvi = result.rows.find((r) => r.variable === 'NDVI' && r.observed_at.startsWith('2026-03-22'));
  const mar22Lst = result.rows.find((r) => r.variable === 'LST_Day_1km');
  assert.ok(mar06Ndvi);
  assert.ok(mar22Ndvi);
  assert.ok(mar22Lst);
  assert.equal(mar06Ndvi.value, null);
  assert.equal(mar06Ndvi.is_missing, true);
  assert.equal(mar06Ndvi.quality_flag, 'cloudy');
  assert.equal(mar22Ndvi.value, 0.616);
  assert.equal(mar22Ndvi.is_missing, false);
  assert.equal(mar22Lst.value, 22.85);
});

test('fetchEarthdataCmrGranules attaches optional token only when provided and keeps pixels null', async () => {
  let capturedAuthHeader: string | undefined;
  const smap = await fetchEarthdataCmrGranules({
    farmId: 'farm-test',
    userId: 'user-test',
    longitude: -93.62,
    latitude: 42.03,
    dataset: 'smap',
    earthdataToken: 'test-token-value',
    fetchImpl: async (_url, init) => {
      const hdrs = (init?.headers || {}) as Record<string, string>;
      capturedAuthHeader = hdrs.Authorization;
      return jsonResponse({
        feed: {
          entry: [
            {
              id: 'G12345-NSIDC',
              producer_granule_id: 'SMAP_L4_SM_gph_20260401',
              time_start: '2026-04-01T00:00:00.000Z',
              time_end: '2026-04-01T03:00:00.000Z',
              data_center: 'NSIDC_ECS',
              links: [{ href: 'https://n5eil01u.ecs.nsidc.org/DP4/SMAP/file.h5' }],
            },
          ],
        },
      });
    },
  });

  assert.equal(capturedAuthHeader, 'Bearer test-token-value');
  assert.equal(smap.entriesCount, 1);
  assert.equal(smap.rows[0].value, null);
  assert.equal(smap.rows[0].is_missing, true);

  const canonical = mapDbObservationToCanonical({ id: 'obs-1', ...smap.rows[0] });
  assert.equal(canonical.status, 'unavailable');
  assert.equal(canonical.value, null);

  // Empty feed handling
  const emptyGpm = await fetchEarthdataCmrGranules({
    farmId: 'farm-test',
    userId: 'user-test',
    longitude: -93.62,
    latitude: 42.03,
    dataset: 'gpm',
    fetchImpl: async () => jsonResponse({ feed: { entry: [] } }),
  });
  assert.equal(emptyGpm.entriesCount, 0);
  assert.equal(emptyGpm.rows.length, 0);
});
