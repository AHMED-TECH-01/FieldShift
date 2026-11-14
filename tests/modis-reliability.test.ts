import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { getModisTimeoutMs } from '../backend/env.js';
import {
  fetchNasaJson,
  NasaUpstreamError,
  normalizeModisLstCelsius,
  normalizeModisScaledIndex,
  parseRetryAfterMs,
} from '../backend/nasa/units-and-quality.js';
import { fetchModisOrnlData } from '../backend/nasa/providers.js';
import { syncModisForFarm } from '../backend/nasa.js';
import { resetSupabaseClientsForTesting } from '../backend/supabase.js';

function jsonResponse(body: any, status = 200, headers?: Record<string, string>): globalThis.Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  });
}

function makeMockOrnlFetch(options?: {
  ndviRaw?: number;
  eviRaw?: number;
  reliability?: number;
  lstRaw?: number;
  failOrnl?: boolean;
}) {
  const ndviRaw = options?.ndviRaw ?? 6420;
  const eviRaw = options?.eviRaw ?? 3910;
  const reliability = options?.reliability ?? 0;
  const lstRaw = options?.lstRaw ?? 14800; // 296.0 K => 22.85 C
  let upstreamCalls = 0;

  const fetchImpl: typeof globalThis.fetch = async (url) => {
    const u = String(url);
    upstreamCalls++;
    if (u.includes('cmr.earthdata.nasa.gov')) {
      return jsonResponse({
        feed: {
          entry: [
            {
              id: 'G-MODIS-REL-1',
              producer_granule_id: 'MOD13Q1.A2026097.h10v04.061.hdf',
              time_start: '2026-04-07T00:00:00.000Z',
              time_end: '2026-04-22T23:59:59.000Z',
              data_center: 'LPDAAC_ECS',
              links: [{ href: 'https://e4ftl01.cr.usgs.gov/MOLT/MOD13Q1.061/2026.04.07/file.hdf' }],
            },
          ],
        },
      });
    }
    if (options?.failOrnl) {
      throw Object.assign(new Error('Request aborted due to timeout'), { name: 'AbortError' });
    }
    if (u.includes('/MOD13Q1/dates')) {
      return jsonResponse({ dates: [{ modis_date: 'A2026097', calendar_date: '2026-04-07' }] });
    }
    if (u.includes('band=250m_16_days_NDVI')) {
      return jsonResponse({
        cellsize: 250,
        subset: [{ modis_date: 'A2026097', calendar_date: '2026-04-07', tile: 'h10v04', data: [ndviRaw] }],
      });
    }
    if (u.includes('band=250m_16_days_EVI')) {
      return jsonResponse({
        subset: [{ modis_date: 'A2026097', calendar_date: '2026-04-07', tile: 'h10v04', data: [eviRaw] }],
      });
    }
    if (u.includes('band=250m_16_days_pixel_reliability')) {
      return jsonResponse({
        subset: [{ modis_date: 'A2026097', calendar_date: '2026-04-07', tile: 'h10v04', data: [reliability] }],
      });
    }
    if (u.includes('/MOD11A2/dates')) {
      return jsonResponse({ dates: [{ modis_date: 'A2026097', calendar_date: '2026-04-07' }] });
    }
    if (u.includes('/MOD11A2/subset')) {
      return jsonResponse({
        subset: [{ modis_date: 'A2026097', calendar_date: '2026-04-07', tile: 'h10v04', data: [lstRaw] }],
      });
    }
    throw new Error(`Unexpected URL in mock: ${u}`);
  };

  return { fetchImpl, getUpstreamCalls: () => upstreamCalls };
}

function createInMemorySupabaseStub(options?: { failObservationUpsert?: boolean }) {
  const obsRows: any[] = [];
  const jobRows: any[] = [];

  const applyFilters = (rows: any[], filters: Array<{ col: string; val: any; type: 'eq' | 'in' }>) =>
    rows.filter((r) =>
      filters.every((f) => (f.type === 'eq' ? r[f.col] === f.val : Array.isArray(f.val) && f.val.includes(r[f.col])))
    );

  const client: any = {
    obsRows,
    jobRows,
    from(table: string) {
      const state: {
        filters: Array<{ col: string; val: any; type: 'eq' | 'in' }>;
        limitNum?: number;
        orderCol?: string;
        ascending?: boolean;
      } = { filters: [] };

      const store = table === 'nasa_observations' ? obsRows : jobRows;

      const builder: any = {
        select() {
          return builder;
        },
        eq(col: string, val: any) {
          state.filters.push({ col, val, type: 'eq' });
          return builder;
        },
        in(col: string, val: any[]) {
          state.filters.push({ col, val, type: 'in' });
          return builder;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          state.orderCol = col;
          state.ascending = opts?.ascending !== false;
          return builder;
        },
        limit(n: number) {
          state.limitNum = n;
          return builder;
        },
        async maybeSingle() {
          const rows = applyFilters(store, state.filters);
          if (state.orderCol) {
            rows.sort((a, b) =>
              state.ascending
                ? String(a[state.orderCol!]).localeCompare(String(b[state.orderCol!]))
                : String(b[state.orderCol!]).localeCompare(String(a[state.orderCol!]))
            );
          }
          return { data: rows[0] || null, error: null };
        },
        then(onFulfilled: any, onRejected: any) {
          const rows = applyFilters(store, state.filters);
          if (state.orderCol) {
            rows.sort((a, b) =>
              state.ascending
                ? String(a[state.orderCol!]).localeCompare(String(b[state.orderCol!]))
                : String(b[state.orderCol!]).localeCompare(String(a[state.orderCol!]))
            );
          }
          const sliced = typeof state.limitNum === 'number' ? rows.slice(0, state.limitNum) : rows;
          return Promise.resolve({ data: sliced, error: null }).then(onFulfilled, onRejected);
        },
        insert(payload: any) {
          const items = Array.isArray(payload) ? payload : [payload];
          const created = items.map((item) => ({
            id: item.id || crypto.randomUUID(),
            created_at: new Date().toISOString(),
            ...item,
          }));
          store.push(...created);
          return {
            select() {
              return {
                async single() {
                  return { data: created[0], error: null };
                },
              };
            },
          };
        },
        update(updates: any) {
          return {
            eq(col: string, val: any) {
              for (const row of store) {
                if (row[col] === val) {
                  Object.assign(row, updates);
                }
              }
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        async upsert(rows: any[]) {
          if (table === 'nasa_observations' && options?.failObservationUpsert) {
            return { data: null, error: { message: 'connection refused by Supabase PostgREST' } };
          }
          for (const row of rows) {
            const idx = store.findIndex(
              (existing) =>
                existing.farm_id === row.farm_id &&
                existing.scope_owner_id === row.scope_owner_id &&
                existing.product_id === row.product_id &&
                existing.variable === row.variable &&
                existing.observed_at === row.observed_at
            );
            if (idx >= 0) {
              store[idx] = { ...store[idx], ...row };
            } else {
              store.push({ id: crypto.randomUUID(), ...row });
            }
          }
          return { data: rows, error: null };
        },
      };
      return builder;
    },
  };
  return client;
}

const sampleFarm: any = {
  id: 'farm-modis-test',
  userId: 'user-modis-test',
  isDemo: false,
  name: 'Story County Test Parcel',
  location: 'Ames, IA',
  coordinates: [-93.62, 42.03] as [number, number],
  acreage: 320,
  currentCrop: 'Corn',
  plantingSeason: 'Spring 2026',
  rotationHistory: ['Soybeans', 'Corn'],
  soilType: 'Clarion Loam',
  soilPH: 6.4,
  organicMatter: 3.6,
  nitrogen: 'Medium',
  phosphorus: 'Medium',
  potassium: 'High',
  drainage: 'Well Drained',
  lastSoilTest: '2026-03-01',
};

test('1. MODIS scaling verification and separate observation vs acquisition dates', async () => {
  const { fetchImpl } = makeMockOrnlFetch({ ndviRaw: 7150, eviRaw: 4210, reliability: 1, lstRaw: 14900 });
  const res = await fetchModisOrnlData({
    farmId: sampleFarm.id,
    userId: sampleFarm.userId,
    longitude: -93.62,
    latitude: 42.03,
    maxComposites: 1,
    fetchImpl,
  });

  const ndvi = res.rows.find((r) => r.variable === 'NDVI');
  const evi = res.rows.find((r) => r.variable === 'EVI');
  const lst = res.rows.find((r) => r.variable === 'LST_Day_1km');
  assert.ok(ndvi && evi && lst);
  assert.equal(ndvi.value, 0.715); // 7150 * 0.0001
  assert.equal(evi.value, 0.421); // 4210 * 0.0001
  assert.equal(lst.value, 24.85); // 14900 * 0.02 - 273.15 = 298 - 273.15 = 24.85 C
  assert.equal(ndvi.observed_at, '2026-04-07T00:00:00.000Z');
  assert.ok(ndvi.retrieved_at !== ndvi.observed_at);
  assert.equal(ndvi.raw_metadata.scaleFactor, 0.0001);
  assert.equal(ndvi.raw_metadata.spatialMethod, 'point_centroid_approximation');
  assert.equal(res.validNumericCount, 3);
  assert.equal(res.maskedCount, 0);
});

test('2. MODIS_TIMEOUT_MS configures upstream timeout and rejects cleanly as NASA_TIMEOUT', async () => {
  const prev = process.env.MODIS_TIMEOUT_MS;
  try {
    process.env.MODIS_TIMEOUT_MS = '31250';
    assert.equal(getModisTimeoutMs(), 31250);
    process.env.MODIS_TIMEOUT_MS = 'invalid';
    assert.equal(getModisTimeoutMs(), 25000);
  } finally {
    if (prev === undefined) delete process.env.MODIS_TIMEOUT_MS;
    else process.env.MODIS_TIMEOUT_MS = prev;
  }

  let attempts = 0;
  await assert.rejects(
    () =>
      fetchNasaJson('https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates', {
        timeoutMs: 35,
        maxRetries: 1,
        baseBackoffMs: 5,
        fetchImpl: async (_url, init) => {
          attempts++;
          return new Promise<globalThis.Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            });
          });
        },
      }),
    (err: any) =>
      err instanceof NasaUpstreamError &&
      err.status === 504 &&
      err.code === 'NASA_TIMEOUT' &&
      err.category === 'timeout'
  );
  assert.equal(attempts, 2); // 1 initial + 1 bounded retry
});

test('3. Bounded retry recovery respects Retry-After on 429 and retries transient 5xx/network errors', async () => {
  assert.equal(parseRetryAfterMs('1'), 1000);
  assert.equal(parseRetryAfterMs('invalid'), null);

  let rateAttempts = 0;
  const start = Date.now();
  const recovered429 = await fetchNasaJson<{ ok: boolean }>('https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates', {
    maxRetries: 2,
    baseBackoffMs: 5,
    maxBackoffMs: 20,
    fetchImpl: async () => {
      rateAttempts++;
      if (rateAttempts === 1) {
        return jsonResponse({ error: 'rate limited' }, 429, { 'Retry-After': '0' });
      }
      return jsonResponse({ ok: true }, 200);
    },
  });
  assert.equal(recovered429.ok, true);
  assert.equal(rateAttempts, 2);
  assert.ok(Date.now() - start >= 0);

  let netAttempts = 0;
  const recovered503ThenNet = await fetchNasaJson<{ ok: boolean }>('https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset', {
    maxRetries: 5, // Must still be capped at max 2 retries (3 total attempts)
    baseBackoffMs: 5,
    maxBackoffMs: 10,
    fetchImpl: async () => {
      netAttempts++;
      if (netAttempts === 1) return jsonResponse({ error: 'bad gateway' }, 503);
      if (netAttempts === 2) throw new TypeError('fetch failed: ECONNRESET');
      return jsonResponse({ ok: true }, 200);
    },
  });
  assert.equal(recovered503ThenNet.ok, true);
  assert.equal(netAttempts, 3);
});

test('4. Retry exhaustion caps at 2 retries while permanent 4xx errors never retry', async () => {
  let server502Attempts = 0;
  await assert.rejects(
    () =>
      fetchNasaJson('https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset', {
        maxRetries: 5, // enforced cap = 2 retries -> max 3 total calls
        baseBackoffMs: 5,
        maxBackoffMs: 10,
        fetchImpl: async () => {
          server502Attempts++;
          return jsonResponse({ error: 'upstream 502' }, 502);
        },
      }),
    (err: any) => err instanceof NasaUpstreamError && err.category === 'server_error' && err.retryable === true
  );
  assert.equal(server502Attempts, 3);

  let client400Attempts = 0;
  await assert.rejects(
    () =>
      fetchNasaJson('https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset', {
        maxRetries: 2,
        baseBackoffMs: 5,
        fetchImpl: async () => {
          client400Attempts++;
          return jsonResponse({ error: 'Invalid latitude' }, 400);
        },
      }),
    (err: any) =>
      err instanceof NasaUpstreamError &&
      err.status === 400 &&
      err.code === 'NASA_CLIENT_ERROR' &&
      err.retryable === false &&
      err.category === 'client_error'
  );
  assert.equal(client400Attempts, 1);
});

test('5. Pixel quality masking excludes cloud, snow, unverified (-1/255/undefined), fill (-3000), and LST bad QC pixels', () => {
  assert.equal(normalizeModisScaledIndex(5000, -1).isMissing, true);
  assert.equal(normalizeModisScaledIndex(5000, 255).isMissing, true);
  assert.equal(normalizeModisScaledIndex(5000, undefined).isMissing, true);
  assert.equal(normalizeModisScaledIndex(5000, 3).isMissing, true); // cloudy
  assert.equal(normalizeModisScaledIndex(5000, 2).isMissing, true); // snow/ice
  assert.equal(normalizeModisScaledIndex(-3000, 0).isMissing, true); // fill value
  assert.equal(normalizeModisScaledIndex(5000, 1).isMissing, false); // marginal but usable
  assert.equal(normalizeModisScaledIndex(5000, 1).value, 0.5);

  assert.equal(normalizeModisLstCelsius(14800, 0, 0.02, 2).isMissing, true); // QC_Day bits 0b10 -> not produced/unusable
  assert.equal(normalizeModisLstCelsius(14800, 0, 0.02, 0).isMissing, false);
});

test('6 & 8. Duplicate concurrent request coalescing + Supabase valid observation cache reuse', async () => {
  const stub = createInMemorySupabaseStub();
  const { fetchImpl, getUpstreamCalls } = makeMockOrnlFetch({ ndviRaw: 6840 });

  // Fire two concurrent requests for the exact same farm, product, date window, and coordinates
  const [r1, r2] = await Promise.all([
    syncModisForFarm(stub, sampleFarm.userId, sampleFarm, {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      fetchImpl,
      timeoutMs: 5000,
    }),
    syncModisForFarm(stub, sampleFarm.userId, sampleFarm, {
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      fetchImpl,
      timeoutMs: 5000,
    }),
  ]);

  const callsAfterConcurrent = getUpstreamCalls();
  assert.equal(r1.status, 'completed');
  assert.equal(r1.persisted, true);
  assert.equal(r2.deduplicatedInFlight, true);
  assert.ok(callsAfterConcurrent > 0 && callsAfterConcurrent <= 7, `Expected 1 upstream set of calls, got ${callsAfterConcurrent}`);

  // Third sequential request for same parameters must reuse persisted Supabase observations with ZERO ORNL calls
  const r3 = await syncModisForFarm(stub, sampleFarm.userId, sampleFarm, {
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    fetchImpl,
    timeoutMs: 5000,
  });
  assert.equal(r3.status, 'cached');
  assert.equal(r3.cacheHit, true);
  assert.equal(r3.cacheSource, 'supabase');
  assert.equal(r3.persisted, true);
  assert.equal(r3.lastSuccessfulObservedAt, '2026-04-07');
  assert.equal(getUpstreamCalls(), callsAfterConcurrent, 'Cached reuse must not call ORNL DAAC upstream');
});

test('7. Supabase persistence failure surfaces separated pixel vs persistence stages and is never cached', async () => {
  const failingStub = createInMemorySupabaseStub({ failObservationUpsert: true });
  const { fetchImpl } = makeMockOrnlFetch({ ndviRaw: 6200 });

  await assert.rejects(
    () =>
      syncModisForFarm(failingStub, sampleFarm.userId, sampleFarm, {
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        fetchImpl,
      }),
    (err: any) =>
      err instanceof NasaUpstreamError &&
      err.status === 503 &&
      err.code === 'SUPABASE_PERSISTENCE_FAILED' &&
      err.details?.stages?.pixelRetrieval?.status === 'extracted' &&
      err.details?.stages?.persistence?.status === 'failed'
  );

  // Confirm nothing valid was cached in nasa_observations
  assert.equal(failingStub.obsRows.length, 0);
  // Confirm failed job recorded honest failure status
  assert.equal(failingStub.jobRows[0]?.status, 'failed');
});

test('9. Dashboard status mapping via HTTP routes distinguishes Granule Indexed / Failed / Extracted / Persisted cleanly', async () => {
  // Spin up minimal PostgREST + Auth harness reusing app.ts in isolation
  const ANON = 'modis-rel-anon';
  const SECRET = 'modis-rel-secret';
  const USER_ID = 'user-modis-e2e';
  const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLW1vZGlzLWUyZSJ9.modis-e2e-sig';
  const db: Record<string, any[]> = {
    nasa_datasets: [{ id: 'modis', name: 'MODIS' }, { id: 'nasa-power', name: 'NASA POWER' }],
    farms: [
      {
        id: 'farm-1',
        user_id: null,
        is_demo: true,
        name: 'Prairie Ridge Valley Farm',
        location: 'Ames, IA',
        coordinates: [-93.62, 42.03],
        acreage: 420,
        current_crop: 'Corn',
        planting_season: 'Spring 2026',
        rotation_history: ['Soybeans', 'Corn'],
        soil_type: 'Loam',
        soil_ph: 6.4,
        organic_matter: 3.8,
        nitrogen: 'Medium',
        phosphorus: 'Medium',
        potassium: 'High',
        drainage: 'Well Drained',
        last_soil_test: '2026-02-01',
      },
    ],
    nasa_observations: [],
    ingestion_jobs: [],
  };

  let failUpsert = false;
  let modisScenario: 'timeout' | 'good' = 'timeout';

  const supaServer = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c);
    const bodyText = Buffer.concat(chunks).toString('utf8');
    const body = bodyText ? JSON.parse(bodyText) : null;

    if (url.pathname === '/auth/v1/user') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: USER_ID, email: 'farmer@example.com', user_metadata: { full_name: 'Test' }, email_confirmed_at: '2026-01-01T00:00:00Z' }));
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
        filtered.sort((a, b) => (dir === 'desc' ? String(b[col]).localeCompare(String(a[col])) : String(a[col]).localeCompare(String(b[col]))));
      }
      const limit = Number(url.searchParams.get('limit') || '1000');
      filtered = filtered.slice(0, limit);
      const accept = String(req.headers.accept || '');
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Range': `0-${Math.max(0, filtered.length - 1)}/${filtered.length}` });
      if (accept.includes('vnd.pgrst.object+json')) {
        res.end(JSON.stringify(filtered[0] || null));
      } else {
        res.end(JSON.stringify(filtered));
      }
      return;
    }

    if (req.method === 'POST') {
      if (table === 'nasa_observations' && failUpsert) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Simulated database write outage' }));
        return;
      }
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

  await new Promise<void>((r) => supaServer.listen(0, '127.0.0.1', r));
  const supaPort = (supaServer.address() as any).port;
  const origFetch = globalThis.fetch;
  const prevEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    MODIS_TIMEOUT_MS: process.env.MODIS_TIMEOUT_MS,
  };

  let apiServer: http.Server | null = null;
  try {
    process.env.SUPABASE_URL = `http://127.0.0.1:${supaPort}`;
    process.env.VITE_SUPABASE_URL = process.env.SUPABASE_URL;
    process.env.SUPABASE_SECRET_KEY = SECRET;
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = ANON;
    process.env.MODIS_TIMEOUT_MS = '25000';

    resetSupabaseClientsForTesting();

    globalThis.fetch = async (input: any, init?: any) => {
      const u = String(input);
      if (u.startsWith(`http://127.0.0.1:${supaPort}`) || u.startsWith('http://127.0.0.1:')) {
        return origFetch(input, init);
      }
      if (u.includes('cmr.earthdata.nasa.gov')) {
        return jsonResponse({
          feed: {
            entry: [
              {
                id: 'G-CMR-99',
                producer_granule_id: 'MOD13Q1.A2026097.h10v04.061.hdf',
                time_start: '2026-04-07T00:00:00.000Z',
                time_end: '2026-04-22T23:59:59.000Z',
                data_center: 'LPDAAC_ECS',
              },
            ],
          },
        });
      }
      if (u.includes('modis.ornl.gov')) {
        if (modisScenario === 'timeout') {
          throw Object.assign(new Error('ETIMEDOUT waiting on modis.ornl.gov'), { name: 'AbortError' });
        }
        if (u.includes('/MOD13Q1/dates')) return jsonResponse({ dates: [{ modis_date: 'A2026097', calendar_date: '2026-04-07' }] });
        if (u.includes('band=250m_16_days_NDVI')) return jsonResponse({ cellsize: 250, subset: [{ modis_date: 'A2026097', calendar_date: '2026-04-07', tile: 'h10v04', data: [7210] }] });
        if (u.includes('band=250m_16_days_EVI')) return jsonResponse({ subset: [{ modis_date: 'A2026097', calendar_date: '2026-04-07', tile: 'h10v04', data: [4120] }] });
        if (u.includes('band=250m_16_days_pixel_reliability')) return jsonResponse({ subset: [{ modis_date: 'A2026097', calendar_date: '2026-04-07', tile: 'h10v04', data: [0] }] });
        if (u.includes('/MOD11A2/dates')) return jsonResponse({ dates: [{ modis_date: 'A2026097', calendar_date: '2026-04-07' }] });
        if (u.includes('/MOD11A2/subset')) return jsonResponse({ subset: [{ modis_date: 'A2026097', calendar_date: '2026-04-07', tile: 'h10v04', data: [14700] }] });
      }
      if (u.includes('power.larc.nasa.gov')) {
        return jsonResponse({
          header: { fill_value: -999, api: { version: 'v2.6' } },
          geometry: { coordinates: [-93.62, 42.03, 280] },
          properties: { parameter: { T2M: { '20260407': 16.5 }, PRECTOTCORR: { '20260407': 4.2 } } },
        });
      }
      throw new Error(`Unexpected live call: ${u}`);
    };

    const { app } = await import('../app.js');
    apiServer = http.createServer(app);
    await new Promise<void>((r) => apiServer!.listen(0, '127.0.0.1', r));
    const apiBase = `http://127.0.0.1:${(apiServer.address() as any).port}`;
    // Verify /api/nasa/health reports configurable modisTimeoutMs
    const healthRes = await origFetch(`${apiBase}/api/nasa/health`);
    const healthJson: any = await healthRes.json();
    assert.equal(healthJson.environment.modisTimeoutMs, 25000);

    // Sync NASA POWER and confirm it works normally
    const powerRes = await origFetch(`${apiBase}/api/datasets/nasa-power/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ farmId: 'farm-1', days: 7 }),
    });
    assert.equal(powerRes.status, 200);

    // 1) CMR succeeds + ORNL times out -> Granule Indexed = true, Pixels Extracted = false, Persisted = false, NOT 'synced'
    modisScenario = 'timeout';
    const partialRes = await origFetch(`${apiBase}/api/datasets/modis/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ farmId: 'farm-1' }),
    });
    assert.equal(partialRes.status, 200);
    const partialJson: any = await partialRes.json();
    assert.equal(partialJson.persisted, false);
    assert.equal(partialJson.stages.cmrDiscovery.status, 'indexed');
    assert.equal(partialJson.stages.pixelRetrieval.status, 'failed');

    const obsAfterTimeout: any = await (
      await origFetch(`${apiBase}/api/nasa/observations?farmId=farm-1`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      })
    ).json();
    assert.equal(obsAfterTimeout.realTimeMetrics.solarInsolationPOWER.status, 'synced');
    const vegTimeout = obsAfterTimeout.realTimeMetrics.vegetationNDVI;
    assert.equal(vegTimeout.status, 'granule_metadata_only');
    assert.equal(vegTimeout.granuleIndexed, true);
    assert.equal(vegTimeout.pixelsExtracted, false);
    assert.equal(vegTimeout.pixelRetrievalStatus, 'failed');
    assert.equal(vegTimeout.persisted, false);
    assert.ok(vegTimeout.failureExplanation);

    // 2) Live ORNL succeeds -> Pixels Extracted = true, Persisted = true, status = 'synced', lastSuccessfulObservationDate set
    modisScenario = 'good';
    const okRes = await origFetch(`${apiBase}/api/datasets/modis/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ farmId: 'farm-1', force: true }),
    });
    assert.equal(okRes.status, 200);
    const okJson: any = await okRes.json();
    assert.equal(okJson.persisted, true);
    assert.equal(okJson.numericPixelCount, 3);

    const obsAfterSuccess: any = await (
      await origFetch(`${apiBase}/api/nasa/observations?farmId=farm-1`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      })
    ).json();
    const vegOk = obsAfterSuccess.realTimeMetrics.vegetationNDVI;
    assert.equal(vegOk.status, 'synced');
    assert.equal(vegOk.granuleIndexed, true);
    assert.equal(vegOk.pixelsExtracted, true);
    assert.equal(vegOk.persisted, true);
    assert.equal(vegOk.lastSuccessfulObservationDate, '2026-04-07');
    assert.equal(vegOk.spatialMethod, 'point_centroid_approximation');

    // 3) Supabase persistence outage returns 503 SUPABASE_PERSISTENCE_FAILED with persisted: false
    failUpsert = true;
    const persistFailRes = await origFetch(`${apiBase}/api/datasets/modis/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ farmId: 'farm-1', force: true }),
    });
    assert.equal(persistFailRes.status, 503);
    const persistFailJson: any = await persistFailRes.json();
    assert.equal(persistFailJson.code, 'SUPABASE_PERSISTENCE_FAILED');
    assert.equal(persistFailJson.persisted, false);
    assert.equal(persistFailJson.stages.pixelRetrieval.status, 'extracted');
    assert.equal(persistFailJson.stages.persistence.status, 'failed');
  } finally {
    globalThis.fetch = origFetch;
    if (apiServer) {
      apiServer.closeAllConnections?.();
      await new Promise((r) => apiServer!.close(r));
    }
    supaServer.closeAllConnections?.();
    await new Promise((r) => supaServer.close(r));
    resetSupabaseClientsForTesting();
    for (const [k, v] of Object.entries(prevEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
