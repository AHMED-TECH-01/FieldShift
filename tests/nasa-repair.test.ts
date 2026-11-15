import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  NasaUpstreamError,
  fetchNasaJson,
  normalizeGpmPrecipitation,
  normalizeModisScaledIndex,
  normalizeSmapSoilMoisture,
  deduplicateObservationRows,
} from '../backend/nasa/units-and-quality.js';
import {
  computeGpmGridIndex,
  computeModisSinusoidalPixelIndex,
  computeSmapEase2GridIndex,
  extractOpendapPointObservations,
  parseDmrXml,
  parseOpendapAsciiNumeric,
} from '../backend/nasa/opendap.js';
import { fetchModisOrnlData } from '../backend/nasa/providers.js';
import { resetSupabaseClientsForTesting } from '../backend/supabase.js';
import { getModisTimeoutMs, getServerEnv } from '../backend/env.js';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(body: string, status = 200, contentType = 'text/plain'): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': contentType },
  });
}

function fakeJwt(sub: string): string {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  return `${h}.${p}.sig`;
}

function startMockSupabaseServer() {
  const USER_ID = '00000000-0000-4000-8000-000000000077';
  const db: Record<string, any[]> = {
    farms: [
      {
        id: 'farm-repair-1',
        user_id: USER_ID,
        name: 'Boone Creek Research Parcel',
        location: 'Ames, IA',
        coordinates: [-93.62, 42.03],
        acreage: 320,
        current_crop: 'Corn',
        planting_season: 'Spring 2026',
        rotation_history: ['Soybeans', 'Corn'],
        soil_type: 'Clarion Loam',
        soil_ph: 6.5,
        organic_matter: 3.9,
        nitrogen: 'Medium',
        phosphorus: 'Medium',
        potassium: 'High',
        drainage: 'Well Drained',
        last_soil_test: '2026-03-01',
      },
      {
        id: 'farm-bad-coords',
        user_id: USER_ID,
        name: 'Corrupt Geometry Parcel',
        location: 'Invalid',
        coordinates: [250, -95],
        acreage: 100,
        current_crop: 'Wheat',
        planting_season: 'Spring 2026',
        rotation_history: [],
        soil_type: 'Loam',
        soil_ph: 6.5,
        organic_matter: 3.0,
        nitrogen: 'Medium',
        phosphorus: 'Medium',
        potassium: 'Medium',
        drainage: 'Moderate',
        last_soil_test: '2026-01-01',
      },
    ],
    nasa_observations: [],
    ingestion_jobs: [],
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c);
    const bodyText = Buffer.concat(chunks).toString('utf8');
    const body = bodyText ? JSON.parse(bodyText) : null;

    if (url.pathname === '/auth/v1/user') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: USER_ID,
          email: 'repair@fieldshift.test',
          user_metadata: { full_name: 'Repair QA' },
          email_confirmed_at: '2026-01-01T00:00:00Z',
        })
      );
      return;
    }

    const match = url.pathname.match(/^\/rest\/v1\/([a-z0-9_]+)$/);
    if (!match) {
      res.writeHead(404);
      res.end('{}');
      return;
    }
    const table = match[1];
    const rows = db[table] || [];

    if (req.method === 'GET') {
      let filtered = [...rows];
      for (const [k, v] of url.searchParams.entries()) {
        if (['select', 'order', 'limit', 'offset'].includes(k)) continue;
        if (v.startsWith('eq.')) filtered = filtered.filter((r) => String(r[k]) === v.slice(3));
        if (v.startsWith('in.(') && v.endsWith(')')) {
          const vals = v.slice(4, -1).split(',');
          filtered = filtered.filter((r) => vals.includes(String(r[k])));
        }
      }
      const order = url.searchParams.get('order');
      if (order) {
        const [col, dir] = order.split('.');
        filtered.sort((a, b) =>
          dir === 'desc' ? String(b[col]).localeCompare(String(a[col])) : String(a[col]).localeCompare(String(b[col]))
        );
      }
      const limit = Number(url.searchParams.get('limit') || '1000');
      filtered = filtered.slice(0, limit);
      const accept = String(req.headers.accept || '');
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Range': `0-${Math.max(0, filtered.length - 1)}/${filtered.length}`,
      });
      res.end(JSON.stringify(accept.includes('vnd.pgrst.object+json') ? filtered[0] || null : filtered));
      return;
    }

    if (req.method === 'POST') {
      const list = Array.isArray(body) ? body : [body];
      const inserted = list.map((item) => {
        const rec = { id: item.id || crypto.randomUUID(), created_at: new Date().toISOString(), ...item };
        if (table === 'nasa_observations') {
          const idx = rows.findIndex(
            (e) =>
              e.farm_id === rec.farm_id &&
              e.scope_owner_id === rec.scope_owner_id &&
              e.product_id === rec.product_id &&
              e.variable === rec.variable &&
              e.observed_at === rec.observed_at
          );
          if (idx >= 0) {
            rows[idx] = { ...rows[idx], ...rec };
            return rows[idx];
          }
        }
        rows.push(rec);
        return rec;
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      const accept = String(req.headers.accept || '');
      res.end(JSON.stringify(accept.includes('vnd.pgrst.object+json') ? inserted[0] : inserted));
      return;
    }

    if (req.method === 'PATCH') {
      const idFilter = url.searchParams.get('id')?.slice(3);
      for (const r of rows) {
        if (!idFilter || r.id === idFilter) Object.assign(r, body);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
      return;
    }
  });

  return { db, server, USER_ID };
}

test('Scenario 1: Valid MODIS retrieval via ORNL DAAC & Earthdata OPeNDAP MOD13Q1 fallback', async () => {
  const ornlCalls: string[] = [];
  const resOrnl = await fetchModisOrnlData({
    farmId: 'farm-repair-1',
    userId: null,
    longitude: -93.62,
    latitude: 42.03,
    fetchImpl: async (input) => {
      const u = String(input);
      ornlCalls.push(u);
      if (u.includes('/MOD13Q1/dates')) {
        return jsonResponse({ dates: [{ modis_date: 'A2026097', calendar_date: '2026-04-07' }] });
      }
      if (u.includes('band=250m_16_days_NDVI')) {
        return jsonResponse({ cellsize: 250, subset: [{ modis_date: 'A2026097', calendar_date: '2026-04-07', tile: 'h10v04', data: [6480] }] });
      }
      if (u.includes('band=250m_16_days_EVI')) {
        return jsonResponse({ subset: [{ modis_date: 'A2026097', calendar_date: '2026-04-07', tile: 'h10v04', data: [3910] }] });
      }
      if (u.includes('band=250m_16_days_pixel_reliability')) {
        return jsonResponse({ subset: [{ modis_date: 'A2026097', calendar_date: '2026-04-07', tile: 'h10v04', data: [0] }] });
      }
      if (u.includes('/MOD11A2/dates')) {
        return jsonResponse({ dates: [{ modis_date: 'A2026097', calendar_date: '2026-04-07' }] });
      }
      if (u.includes('/MOD11A2/subset')) {
        return jsonResponse({ subset: [{ modis_date: 'A2026097', calendar_date: '2026-04-07', tile: 'h10v04', data: [14650] }] });
      }
      return jsonResponse({}, 404);
    },
  });

  assert.equal(resOrnl.validNumericCount, 3);
  const ndviRow = resOrnl.rows.find((r) => r.variable === 'NDVI');
  const eviRow = resOrnl.rows.find((r) => r.variable === 'EVI');
  assert.equal(ndviRow?.value, 0.648);
  assert.equal(eviRow?.value, 0.391);
  assert.equal(resOrnl.latestTile, 'h10v04');
  assert.ok(ornlCalls.some((u) => u.includes('/MOD13Q1/dates')));

  // Earthdata OPeNDAP MODIS fallback verification
  const modisDmr = `<Dataset name="MOD13Q1.hdf">
    <Int16 name="250m_16_days_NDVI"><Dim name="YDim" size="4800"/><Dim name="XDim" size="4800"/><Attribute name="_FillValue" type="Int16"><Value>-3000</Value></Attribute></Int16>
    <Int16 name="250m_16_days_EVI"><Dim name="YDim" size="4800"/><Dim name="XDim" size="4800"/><Attribute name="_FillValue" type="Int16"><Value>-3000</Value></Attribute></Int16>
    <Int8 name="250m_16_days_pixel_reliability"><Dim name="YDim" size="4800"/><Dim name="XDim" size="4800"/></Int8>
  </Dataset>`;
  const opendapModis = await extractOpendapPointObservations({
    dataset: 'modis',
    farmId: 'farm-repair-1',
    userId: null,
    latitude: 42.03,
    longitude: -93.62,
    earthdataToken: 'test-token',
    granuleEntry: {
      producer_granule_id: 'MOD13Q1.A2026097.h10v04.061.hdf',
      time_start: '2026-04-07T00:00:00.000Z',
      links: [{ href: 'https://opendap.earthdata.nasa.gov/collections/MOD13Q1/granules/MOD13Q1.A2026097.h10v04.061.hdf' }],
    },
    fetchImpl: async (input) => {
      const u = String(input);
      if (u.endsWith('.dmr')) return textResponse(modisDmr, 200, 'application/xml');
      return textResponse(
        `250m_16_days_NDVI[0][0] = 6120;\n250m_16_days_EVI[0][0] = 3810;\n250m_16_days_pixel_reliability[0][0] = 0;`
      );
    },
  });
  assert.equal(opendapModis.validNumericCount, 2);
  assert.equal(opendapModis.rows[0].value, 0.612);
  assert.equal(opendapModis.rows[0].provenance, 'live_api_nasa_opendap');
});

test('Scenario 2: Invalid farm coordinates rejected with 400 INVALID_COORDINATES', async () => {
  await assert.rejects(
    () =>
      fetchModisOrnlData({
        farmId: 'farm-bad-coords',
        userId: null,
        longitude: 250,
        latitude: -95,
      }),
    (err: any) => err instanceof NasaUpstreamError && err.status === 400 && err.code === 'INVALID_COORDINATES'
  );
});

test('Scenario 3: Missing or rejected EARTHDATA_TOKEN prevents fabricated SMAP/GPM pixels and marks auth stage honestly', async () => {
  const { server, USER_ID } = startMockSupabaseServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const supaPort = (server.address() as any).port;
  const origFetch = globalThis.fetch;
  const prevEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    EARTHDATA_TOKEN: process.env.EARTHDATA_TOKEN,
  };

  let apiServer: http.Server | null = null;
  try {
    process.env.SUPABASE_URL = `http://127.0.0.1:${supaPort}`;
    process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
    process.env.SUPABASE_SECRET_KEY = 'secret-test';
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'anon-test';
    delete process.env.EARTHDATA_TOKEN;
    resetSupabaseClientsForTesting();

    let rejectToken401 = false;
    globalThis.fetch = async (input, init) => {
      const u = String(input);
      if (u.startsWith(`http://127.0.0.1:${supaPort}`) || u.startsWith('http://127.0.0.1:')) {
        return origFetch(input, init);
      }
      if (u.includes('cmr.earthdata.nasa.gov')) {
        return jsonResponse({
          feed: {
            entry: [
              {
                id: 'G-SMAP-1',
                producer_granule_id: 'SMAP_L4_SM_gph_20260410T000000_Vv8011_001.h5',
                time_start: '2026-04-10T00:00:00.000Z',
                links: [
                  {
                    rel: 'http://esipfed.org/ns/fedsearch/1.1/service#',
                    href: 'https://opendap.earthdata.nasa.gov/collections/SPL4SMGP/granules/SMAP_1',
                  },
                ],
              },
            ],
          },
        });
      }
      if (u.includes('opendap.earthdata.nasa.gov')) {
        if (rejectToken401) {
          return textResponse('Unauthorized Bearer token', 401);
        }
        throw new Error('OPeNDAP should NOT be called when token is missing');
      }
      throw new Error(`Unexpected upstream call: ${u}`);
    };

    const { app } = await import('../app.js');
    apiServer = http.createServer(app);
    await new Promise<void>((r) => apiServer!.listen(0, '127.0.0.1', r));
    const apiBase = `http://127.0.0.1:${(apiServer.address() as any).port}`;
    const token = fakeJwt(USER_ID);

    // 3a) Missing EARTHDATA_TOKEN
    const smapMissing = await origFetch(`${apiBase}/api/datasets/smap/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ farmId: 'farm-repair-1' }),
    });
    assert.equal(smapMissing.status, 200);
    const smapMissingJson: any = await smapMissing.json();
    assert.equal(smapMissingJson.success, false);
    assert.equal(smapMissingJson.metadataOnly, true);
    assert.equal(smapMissingJson.numericPixelCount, 0);
    assert.equal(smapMissingJson.stages.cmrDiscovery.status, 'indexed');
    assert.equal(smapMissingJson.stages.granuleDownload.status, 'auth_required');

    const obsMissing: any = await (
      await origFetch(`${apiBase}/api/nasa/observations?farmId=farm-repair-1`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    assert.equal(obsMissing.realTimeMetrics.soilMoistureSMAP.value, null);
    assert.equal(obsMissing.realTimeMetrics.soilMoistureSMAP.pixelValuesAvailable, false);
    assert.equal(obsMissing.realTimeMetrics.soilMoistureSMAP.status, 'granule_metadata_only');

    // 3b) Rejected Bearer token (401 -> auth_failed)
    process.env.EARTHDATA_TOKEN = 'invalid-bearer-token';
    rejectToken401 = true;
    const smapRejected = await origFetch(`${apiBase}/api/datasets/smap/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ farmId: 'farm-repair-1' }),
    });
    const smapRejectedJson: any = await smapRejected.json();
    assert.equal(smapRejectedJson.stages.granuleDownload.status, 'auth_failed');
    assert.equal(smapRejectedJson.persisted, false);
  } finally {
    globalThis.fetch = origFetch;
    if (apiServer) {
      apiServer.closeAllConnections?.();
      await new Promise((r) => apiServer!.close(r));
    }
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    resetSupabaseClientsForTesting();
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('Scenario 4: Simulated upstream hang triggers budget-aware multi-attempt timeout message with endpoint & timing diagnostics', async () => {
  await assert.rejects(
    () =>
      fetchNasaJson('https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates?latitude=42.03&longitude=-93.62', {
        timeoutMs: 1700,
        deadlineMs: Date.now() + 3350,
        maxRetries: 1,
        baseBackoffMs: 10,
        fetchImpl: (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
            });
          }),
      }),
    (err: any) => {
      assert.ok(err instanceof NasaUpstreamError);
      assert.equal(err.status, 504);
      assert.equal(err.code, 'NASA_TIMEOUT');
      assert.match(err.message, /across 2 attempts/i);
      assert.match(err.message, /configured 1700ms\/attempt/i);
      assert.match(err.message, /modis\.ornl\.gov/);
      assert.equal(err.details?.configuredTimeoutMs, 1700);
      assert.ok(err.details?.finalAttemptTimeoutMs < 1700);
      assert.ok(Array.isArray(err.details?.attemptDetails) && err.details.attemptDetails.length === 2);
      return true;
    }
  );
});

test('Scenario 5: Retry succeeds after transient upstream 503 failure', async () => {
  let attempts = 0;
  const data = await fetchNasaJson<{ ok: boolean }>('https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates', {
    timeoutMs: 500,
    maxRetries: 2,
    baseBackoffMs: 5,
    fetchImpl: async () => {
      attempts++;
      if (attempts < 2) {
        return textResponse('Service Temporarily Unavailable', 503);
      }
      return jsonResponse({ ok: true });
    },
  });
  assert.equal(attempts, 2);
  assert.deepEqual(data, { ok: true });
});

test('Scenario 6: Empty ORNL response classifies pixelExtraction as empty (not quality_masked) and persisted=false', async () => {
  const { server, USER_ID } = startMockSupabaseServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const supaPort = (server.address() as any).port;
  const origFetch = globalThis.fetch;
  const prevEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    EARTHDATA_TOKEN: process.env.EARTHDATA_TOKEN,
  };

  let apiServer: http.Server | null = null;
  try {
    process.env.SUPABASE_URL = `http://127.0.0.1:${supaPort}`;
    process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
    process.env.SUPABASE_SECRET_KEY = 'secret-test';
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'anon-test';
    delete process.env.EARTHDATA_TOKEN;
    resetSupabaseClientsForTesting();

    globalThis.fetch = async (input, init) => {
      const u = String(input);
      if (u.startsWith(`http://127.0.0.1:${supaPort}`) || u.startsWith('http://127.0.0.1:')) {
        return origFetch(input, init);
      }
      if (u.includes('cmr.earthdata.nasa.gov')) {
        return jsonResponse({
          feed: { entry: [{ id: 'G-MOD-EMPTY', producer_granule_id: 'MOD13Q1.empty.hdf', time_start: '2026-04-07T00:00:00Z' }] },
        });
      }
      if (u.includes('modis.ornl.gov')) {
        return jsonResponse({ dates: [] });
      }
      throw new Error(`Unexpected upstream call: ${u}`);
    };

    const { app } = await import('../app.js');
    apiServer = http.createServer(app);
    await new Promise<void>((r) => apiServer!.listen(0, '127.0.0.1', r));
    const apiBase = `http://127.0.0.1:${(apiServer.address() as any).port}`;

    const res = await origFetch(`${apiBase}/api/datasets/modis/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fakeJwt(USER_ID)}` },
      body: JSON.stringify({ farmId: 'farm-repair-1' }),
    });
    const json: any = await res.json();
    assert.equal(json.stages.pixelExtraction.status, 'empty');
    assert.equal(json.persisted, false);
    assert.equal(json.numericPixelCount, 0);
  } finally {
    globalThis.fetch = origFetch;
    if (apiServer) {
      apiServer.closeAllConnections?.();
      await new Promise((r) => apiServer!.close(r));
    }
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    resetSupabaseClientsForTesting();
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('Scenario 7: Invalid/fill/cloud/snow pixel values are masked cleanly across MODIS, SMAP, and GPM', () => {
  // MODIS: cloudy (3), snow (2), fill (-3000)
  assert.equal(normalizeModisScaledIndex(7200, 3).value, null);
  assert.equal(normalizeModisScaledIndex(7200, 3).qualityFlag, 'cloudy');
  assert.equal(normalizeModisScaledIndex(7200, 2).qualityFlag, 'snow_ice');
  assert.equal(normalizeModisScaledIndex(-3000, 0).value, null);
  assert.equal(normalizeModisScaledIndex(-3000, 0).isMissing, true);

  // SMAP: out of physical bounds [0, 1] or -9999 fill
  assert.equal(normalizeSmapSoilMoisture(-9999).value, null);
  assert.equal(normalizeSmapSoilMoisture(1.45).value, null);
  assert.equal(normalizeSmapSoilMoisture(-0.2).isMissing, true);
  assert.equal(normalizeSmapSoilMoisture(0.3125).value, 0.3125);

  // GPM: negative, > 2000 mm/day, or -9999.9 fill
  assert.equal(normalizeGpmPrecipitation(-9999.9).value, null);
  assert.equal(normalizeGpmPrecipitation(-1).value, null);
  assert.equal(normalizeGpmPrecipitation(2500).isMissing, true);
  assert.equal(normalizeGpmPrecipitation(18.42).value, 18.42);
});

test('Scenario 8: Full 5-stage DB persistence for SMAP & GPM OPeNDAP extraction and /api/nasa/observations reporting', async () => {
  const { server, USER_ID } = startMockSupabaseServer();
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const supaPort = (server.address() as any).port;
  const origFetch = globalThis.fetch;
  const prevEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    EARTHDATA_TOKEN: process.env.EARTHDATA_TOKEN,
  };

  let apiServer: http.Server | null = null;
  try {
    process.env.SUPABASE_URL = `http://127.0.0.1:${supaPort}`;
    process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
    process.env.SUPABASE_SECRET_KEY = 'secret-test';
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'anon-test';
    process.env.EARTHDATA_TOKEN = 'valid-earthdata-token';
    resetSupabaseClientsForTesting();

    const smapDmr = `<Dataset name="SMAP_L4">
      <Float32 name="sm_surface"><Dim name="y" size="1624"/><Dim name="x" size="3856"/><Attribute name="_FillValue" type="Float32"><Value>-9999.0</Value></Attribute></Float32>
      <Float32 name="sm_rootzone"><Dim name="y" size="1624"/><Dim name="x" size="3856"/><Attribute name="_FillValue" type="Float32"><Value>-9999.0</Value></Attribute></Float32>
    </Dataset>`;
    const gpmDmr = `<Dataset name="GPM_3IMERGDL">
      <Float32 name="precipitation"><Dim name="time" size="1"/><Dim name="lon" size="3600"/><Dim name="lat" size="1800"/><Attribute name="_FillValue" type="Float32"><Value>-9999.9</Value></Attribute></Float32>
    </Dataset>`;

    globalThis.fetch = async (input, init) => {
      const u = String(input);
      if (u.startsWith(`http://127.0.0.1:${supaPort}`) || u.startsWith('http://127.0.0.1:')) {
        return origFetch(input, init);
      }
      if (u.includes('cmr.earthdata.nasa.gov') && u.includes('SPL4SMGP')) {
        return jsonResponse({
          feed: {
            entry: [
              {
                id: 'G-SMAP-OK',
                producer_granule_id: 'SMAP_L4_SM_gph_20260412.h5',
                time_start: '2026-04-12T01:30:00.000Z',
                links: [{ href: 'https://opendap.earthdata.nasa.gov/collections/SPL4SMGP/granules/SMAP_OK' }],
              },
            ],
          },
        });
      }
      if (u.includes('cmr.earthdata.nasa.gov') && u.includes('GPM_3IMERGDL')) {
        return jsonResponse({
          feed: {
            entry: [
              {
                id: 'G-GPM-OK',
                producer_granule_id: '3B-DAY-L.MS.MRG.3IMERG.20260412.V07B.nc4',
                time_start: '2026-04-12T00:00:00.000Z',
                links: [{ href: 'https://opendap.earthdata.nasa.gov/collections/GPM_3IMERGDL/granules/GPM_OK' }],
              },
            ],
          },
        });
      }
      if (u.includes('SMAP_OK.dmr')) return textResponse(smapDmr, 200, 'application/xml');
      if (u.includes('SMAP_OK.ascii')) {
        return textResponse('sm_surface[0][0] = 0.294;\nsm_rootzone[0][0] = 0.341;');
      }
      if (u.includes('GPM_OK.dmr')) return textResponse(gpmDmr, 200, 'application/xml');
      if (u.includes('GPM_OK.ascii')) {
        return textResponse('precipitation[0][0][0] = 12.65;');
      }
      throw new Error(`Unexpected upstream call: ${u}`);
    };

    const { app } = await import('../app.js');
    apiServer = http.createServer(app);
    await new Promise<void>((r) => apiServer!.listen(0, '127.0.0.1', r));
    const apiBase = `http://127.0.0.1:${(apiServer.address() as any).port}`;
    const token = fakeJwt(USER_ID);

    const smapSync: any = await (
      await origFetch(`${apiBase}/api/datasets/smap/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ farmId: 'farm-repair-1' }),
      })
    ).json();
    assert.equal(smapSync.success, true);
    assert.equal(smapSync.persisted, true);
    assert.equal(smapSync.numericPixelCount, 2);
    assert.equal(smapSync.stages.cmrDiscovery.status, 'indexed');
    assert.equal(smapSync.stages.granuleDownload.status, 'completed');
    assert.equal(smapSync.stages.pixelExtraction.status, 'extracted');
    assert.equal(smapSync.stages.observationValidation.status, 'validated');
    assert.equal(smapSync.stages.databasePersistence.status, 'persisted');
    assert.ok(smapSync.stages.lastAttemptAt);

    const gpmSync: any = await (
      await origFetch(`${apiBase}/api/datasets/gpm/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ farmId: 'farm-repair-1' }),
      })
    ).json();
    assert.equal(gpmSync.success, true);
    assert.equal(gpmSync.numericPixelCount, 1);

    const obs: any = await (
      await origFetch(`${apiBase}/api/nasa/observations?farmId=farm-repair-1`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    assert.equal(obs.realTimeMetrics.soilMoistureSMAP.status, 'synced');
    assert.equal(obs.realTimeMetrics.soilMoistureSMAP.persisted, true);
    assert.equal(obs.realTimeMetrics.soilMoistureSMAP.surfaceMoisture, 0.294);
    assert.equal(obs.realTimeMetrics.soilMoistureSMAP.rootZoneMoisture, 0.341);
    assert.equal(obs.realTimeMetrics.precipitationGPM.status, 'synced');
    assert.equal(obs.realTimeMetrics.precipitationGPM.value, 12.65);
    assert.equal(obs.datasetPipelines.smap.stages.databasePersistence.status, 'persisted');
    assert.equal(obs.datasetPipelines.gpm.stages.pixelExtraction.status, 'extracted');
  } finally {
    globalThis.fetch = origFetch;
    if (apiServer) {
      apiServer.closeAllConnections?.();
      await new Promise((r) => apiServer!.close(r));
    }
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
    resetSupabaseClientsForTesting();
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

test('Scenario 9: Duplicate observation rows and coordinate grid calculators are deterministic and deduplicated', () => {
  const deduped = deduplicateObservationRows([
    { product_id: 'SPL4SMGP', variable: 'sm_surface', observed_at: '2026-04-12T00:00:00Z', val: 0.25 },
    { product_id: 'SPL4SMGP', variable: 'sm_surface', observed_at: '2026-04-12T00:00:00Z', val: 0.25 },
    { product_id: 'SPL4SMGP', variable: 'sm_rootzone', observed_at: '2026-04-12T00:00:00Z', val: 0.31 },
  ]);
  assert.equal(deduped.length, 2);

  const gpmIdx = computeGpmGridIndex(42.03, -93.62);
  assert.ok(gpmIdx.latIdx >= 0 && gpmIdx.latIdx < 1800);
  assert.ok(gpmIdx.lonIdx >= 0 && gpmIdx.lonIdx < 3600);

  const smapIdx = computeSmapEase2GridIndex(42.03, -93.62);
  assert.ok(smapIdx.row >= 0 && smapIdx.row < 1624);
  assert.ok(smapIdx.col >= 0 && smapIdx.col < 3856);

  const modisIdx = computeModisSinusoidalPixelIndex(42.03, -93.62);
  assert.equal(modisIdx.tile, 'h11v04');

  const dmr = parseDmrXml('<Dataset><Dimension name="lat" size="1800"/><Float32 name="precipitation"><Dim name="lat"/></Float32></Dataset>');
  assert.equal(dmr.variables[0].dims[0].size, 1800);
  assert.equal(parseOpendapAsciiNumeric('precipitation[0] = 7.45;', 'precipitation'), 7.45);
});

test('Scenario 10: Vercel config maxDuration=60 and MODIS_TIMEOUT_MS / health metadata alignment', async () => {
  const vercelRaw = fs.readFileSync(path.resolve(process.cwd(), 'vercel.json'), 'utf8');
  const vercelJson = JSON.parse(vercelRaw);
  assert.equal(vercelJson.functions['api/index.ts'].maxDuration, 60);

  const prev = process.env.MODIS_TIMEOUT_MS;
  try {
    process.env.MODIS_TIMEOUT_MS = '32000';
    assert.equal(getModisTimeoutMs(), 32000);
    const envSummary = getServerEnv();
    assert.equal(envSummary.modisTimeoutMs, 32000);
    assert.equal(envSummary.modisTimeoutSource, 'env');
  } finally {
    if (prev === undefined) delete process.env.MODIS_TIMEOUT_MS;
    else process.env.MODIS_TIMEOUT_MS = prev;
  }
});
