import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { resetSupabaseClientsForTesting } from '../backend/supabase.js';

function createFarmManagementSupabaseHarness() {
  const ANON_KEY = 'test-fm-anon-key';
  const SECRET_KEY = 'test-fm-secret-key';

  const users = new Map<string, { id: string; email: string; fullName: string }>();
  const tokens = new Map<string, { userId: string; exp: number }>();

  const db = {
    nasa_datasets: [
      { id: 'nasa-power', name: 'NASA POWER Agro' },
      { id: 'modis', name: 'MODIS MOD13Q1' },
      { id: 'smap', name: 'SMAP L4' },
      { id: 'gpm', name: 'GPM IMERG' },
      { id: 'ecostress', name: 'ECOSTRESS L3T JET' },
    ],
    profiles: [] as any[],
    farms: [
      {
        id: 'farm-1',
        user_id: null,
        is_demo: true,
        name: 'Prairie Ridge Valley Farm',
        description: 'Seeded Midwest corn-soybean demonstration parcel.',
        location: 'Ames, IA, United States',
        country: 'United States',
        state: 'IA',
        city: 'Ames',
        latitude: 42.03,
        longitude: -93.62,
        coordinates: [-93.62, 42.03],
        area: 420,
        area_unit: 'acres',
        acreage: 420,
        farm_type: 'Row Crop',
        operating_status: 'Active',
        current_crop: 'Field Corn (Maize)',
        previous_crop: 'Soybeans',
        irrigation_type: 'Rainfed',
        planting_season: 'Spring 2026',
        harvest_season: 'Fall 2026',
        rotation_history: ['Soybeans', 'Field Corn (Maize)'],
        soil_type: 'Clarion Silt Loam',
        soil_ph: 6.4,
        organic_matter: 3.8,
        nitrogen: 'Medium',
        phosphorus: 'Optimal',
        potassium: 'High',
        drainage: 'Moderately Well Drained',
        last_soil_test: '2026-02-15',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'farm-2',
        user_id: null,
        is_demo: true,
        name: 'Cedar Creek Sustainable Acres',
        description: 'Great Plains dryland grain demonstration parcel.',
        location: 'Manhattan, KS, United States',
        country: 'United States',
        state: 'KS',
        city: 'Manhattan',
        latitude: 39.18,
        longitude: -96.57,
        coordinates: [-96.57, 39.18],
        area: 310,
        area_unit: 'acres',
        acreage: 310,
        farm_type: 'Dryland Grain',
        operating_status: 'Active',
        current_crop: 'Grain Sorghum',
        previous_crop: 'Winter Wheat',
        irrigation_type: 'Dryland',
        planting_season: 'Spring 2026',
        harvest_season: 'Fall 2026',
        rotation_history: ['Winter Wheat', 'Grain Sorghum'],
        soil_type: 'Smolan Silty Clay Loam',
        soil_ph: 6.6,
        organic_matter: 2.9,
        nitrogen: 'Low-Medium',
        phosphorus: 'Medium',
        potassium: 'Optimal',
        drainage: 'Well Drained',
        last_soil_test: '2026-02-10',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'farm-3',
        user_id: null,
        is_demo: true,
        name: 'Green River Basin Organics',
        description: 'California irrigated organic oilseed demonstration parcel.',
        location: 'Davis, CA, United States',
        country: 'United States',
        state: 'CA',
        city: 'Davis',
        latitude: 38.54,
        longitude: -121.74,
        coordinates: [-121.74, 38.54],
        area: 260,
        area_unit: 'acres',
        acreage: 260,
        farm_type: 'Certified Organic',
        operating_status: 'Active',
        current_crop: 'Sunflower',
        previous_crop: 'Alfalfa',
        irrigation_type: 'Drip Irrigated',
        planting_season: 'Spring 2026',
        harvest_season: 'Fall 2026',
        rotation_history: ['Alfalfa', 'Sunflower'],
        soil_type: 'Yolo Silt Loam',
        soil_ph: 6.9,
        organic_matter: 3.4,
        nitrogen: 'Medium',
        phosphorus: 'High',
        potassium: 'High',
        drainage: 'Well Drained',
        last_soil_test: '2026-02-20',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ] as any[],
    farmer_priorities: [] as any[],
    soil_records: [] as any[],
    nasa_observations: [] as any[],
    ingestion_jobs: [] as any[],
    crop_rotation_assessments: [] as any[],
    ai_advisor_messages: [] as any[],
  };

  function seedUser(id: string, email: string, fullName: string): string {
    users.set(id, { id, email, fullName });
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: id, role: 'authenticated' })).toString('base64url');
    const sig = crypto.randomBytes(16).toString('base64url');
    const jwt = `${header}.${payload}.${sig}`;
    tokens.set(jwt, { userId: id, exp: Date.now() + 3600_000 });
    return jwt;
  }

  function resolveCaller(req: http.IncomingMessage) {
    const authHdr = String(req.headers.authorization || '');
    const apiKeyHdr = String(req.headers.apikey || '');
    const bearer = authHdr.startsWith('Bearer ') ? authHdr.slice(7).trim() : '';
    if (bearer === SECRET_KEY || apiKeyHdr === SECRET_KEY) {
      return { role: 'service_role' as const, userId: null };
    }
    if (bearer && bearer !== ANON_KEY) {
      const rec = tokens.get(bearer);
      if (rec && rec.exp > Date.now()) {
        return { role: 'authenticated' as const, userId: rec.userId };
      }
    }
    return { role: 'anon' as const, userId: null };
  }

  function filterRowsByRls(table: keyof typeof db, rows: any[], caller: ReturnType<typeof resolveCaller>): any[] {
    if (caller.role === 'service_role') return rows;
    if (table === 'nasa_datasets') return rows;
    if (table === 'farms') {
      if (caller.role === 'authenticated') {
        return rows.filter((r) => (r.is_demo === true && r.user_id === null) || r.user_id === caller.userId);
      }
      return rows.filter((r) => r.is_demo === true && r.user_id === null);
    }
    if (table === 'profiles') {
      return caller.role === 'authenticated' ? rows.filter((r) => r.id === caller.userId) : [];
    }
    return caller.role === 'authenticated' ? rows.filter((r) => r.user_id === caller.userId) : [];
  }

  function applyPostgrestFilters(rows: any[], searchParams: URLSearchParams): any[] {
    let out = [...rows];
    for (const [col, rawExpr] of searchParams.entries()) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(col)) continue;
      if (rawExpr.startsWith('eq.')) {
        const expected = rawExpr.slice(3);
        out = out.filter((r) => String(r[col]) === expected);
      } else if (rawExpr.startsWith('in.(') && rawExpr.endsWith(')')) {
        const items = rawExpr
          .slice(4, -1)
          .split(',')
          .map((s) => s.trim().replace(/^"|"$/g, ''));
        out = out.filter((r) => items.includes(String(r[col])));
      } else if (rawExpr.startsWith('gte.')) {
        const minVal = rawExpr.slice(4);
        out = out.filter((r) => String(r[col]) >= minVal);
      } else if (rawExpr.startsWith('lte.')) {
        const maxVal = rawExpr.slice(4);
        out = out.filter((r) => String(r[col]) <= maxVal);
      }
    }

    const orderParam = searchParams.get('order');
    if (orderParam) {
      const orders = orderParam.split(',').map((part) => {
        const [col, dir] = part.split('.');
        return { col, desc: dir === 'desc' };
      });
      out.sort((a, b) => {
        for (const o of orders) {
          const av = a[o.col];
          const bv = b[o.col];
          if (av === bv) continue;
          if (av === null || av === undefined) return o.desc ? 1 : -1;
          if (bv === null || bv === undefined) return o.desc ? -1 : 1;
          if (typeof av === 'boolean' && typeof bv === 'boolean') {
            return o.desc ? (av ? -1 : 1) : (av ? 1 : -1);
          }
          const cmp = String(av).localeCompare(String(bv));
          if (cmp !== 0) return o.desc ? -cmp : cmp;
        }
        return 0;
      });
    }

    return out;
  }

  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const ch of req) chunks.push(ch as Buffer);
    const bodyText = Buffer.concat(chunks).toString('utf8');
    const body = bodyText ? JSON.parse(bodyText) : {};

    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = url.pathname;
    const sendJson = (status: number, data: any, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
      res.end(JSON.stringify(data));
    };

    if (pathname === '/auth/v1/user' && req.method === 'GET') {
      const authHdr = String(req.headers.authorization || '');
      const jwt = authHdr.startsWith('Bearer ') ? authHdr.slice(7).trim() : '';
      const rec = tokens.get(jwt);
      if (!rec || rec.exp <= Date.now()) {
        return sendJson(401, { msg: 'Invalid JWT' });
      }
      const user = users.get(rec.userId);
      if (!user) return sendJson(401, { msg: 'User not found' });
      return sendJson(200, {
        id: user.id,
        email: user.email,
        email_confirmed_at: '2026-01-01T00:00:00.000Z',
        user_metadata: { full_name: user.fullName },
      });
    }

    if (pathname.startsWith('/rest/v1/')) {
      const tableName = pathname.slice('/rest/v1/'.length) as keyof typeof db;
      if (!(tableName in db)) {
        return sendJson(404, { message: `Table ${tableName} not found` });
      }
      const caller = resolveCaller(req);
      const acceptHdr = String(req.headers.accept || '');
      const wantsSingle = acceptHdr.includes('application/vnd.pgrst.object+json');

      if (req.method === 'GET') {
        const visible = filterRowsByRls(tableName, db[tableName], caller);
        const filtered = applyPostgrestFilters(visible, url.searchParams);
        const limitParam = url.searchParams.get('limit');
        const sliced = limitParam ? filtered.slice(0, Number(limitParam)) : filtered;
        if (wantsSingle) {
          if (sliced.length !== 1) return sendJson(406, { code: 'PGRST116', message: 'Expected 1 row' });
          return sendJson(200, sliced[0]);
        }
        return sendJson(200, sliced);
      }

      if (req.method === 'POST') {
        if (caller.role === 'anon') {
          return sendJson(403, { code: '42501', message: 'RLS violation' });
        }
        const incomingRows = Array.isArray(body) ? body : [body];
        if (caller.role === 'authenticated') {
          for (const row of incomingRows) {
            if (tableName === 'farms' && (row.user_id !== caller.userId || row.is_demo !== false)) {
              return sendJson(403, { code: '42501', message: 'RLS violation: farms insert requires auth.uid() = user_id AND is_demo = false' });
            }
            if (tableName !== 'profiles' && tableName !== 'farms' && row.user_id !== caller.userId) {
              return sendJson(403, { code: '42501', message: `RLS violation on ${tableName}` });
            }
          }
        }

        // Enforce partial unique constraint idx_farms_user_name_unique (per owner, lower(trim(name)))
        if (tableName === 'farms') {
          for (const row of incomingRows) {
            if (row.is_demo === false && row.user_id) {
              const norm = String(row.name || '').trim().toLowerCase();
              const dup = db.farms.some(
                (existing) =>
                  existing.user_id === row.user_id &&
                  existing.is_demo === false &&
                  String(existing.name || '').trim().toLowerCase() === norm
              );
              if (dup) {
                return sendJson(409, { code: '23505', message: 'duplicate key value violates unique constraint "idx_farms_user_name_unique"' });
              }
            }
          }
        }

        const onConflict = url.searchParams.get('on_conflict');
        const conflictCols = onConflict ? onConflict.split(',').map((s) => s.trim()) : [];
        const inserted: any[] = [];
        for (const raw of incomingRows) {
          const row = {
            id: raw.id || crypto.randomUUID(),
            created_at: raw.created_at || new Date().toISOString(),
            ...raw,
          };
          if (conflictCols.length > 0) {
            const idx = db[tableName].findIndex((ex) => conflictCols.every((c) => String(ex[c] ?? '') === String(row[c] ?? '')));
            if (idx >= 0) {
              db[tableName][idx] = { ...db[tableName][idx], ...row };
              inserted.push(db[tableName][idx]);
              continue;
            }
          }
          db[tableName].push(row);
          inserted.push(row);
        }
        return sendJson(201, wantsSingle ? inserted[0] : inserted);
      }

      if (req.method === 'PATCH') {
        if (caller.role === 'anon') return sendJson(403, { code: '42501', message: 'RLS violation' });
        const visible = filterRowsByRls(tableName, db[tableName], caller);
        const matches = applyPostgrestFilters(visible, url.searchParams);
        for (const m of matches) {
          if (caller.role === 'authenticated' && tableName === 'farms' && (m.is_demo || m.user_id !== caller.userId)) {
            return sendJson(403, { code: '42501', message: 'Cannot mutate demo or foreign farm' });
          }
          Object.assign(m, body);
        }
        if (wantsSingle) {
          if (matches.length !== 1) return sendJson(406, { code: 'PGRST116', message: 'Expected single row' });
          return sendJson(200, matches[0]);
        }
        return sendJson(200, matches);
      }

      if (req.method === 'DELETE') {
        if (caller.role === 'anon') return sendJson(403, { code: '42501', message: 'RLS violation' });
        const visible = filterRowsByRls(tableName, db[tableName], caller);
        const matches = applyPostgrestFilters(visible, url.searchParams);

        if (tableName === 'farms' && caller.role === 'authenticated') {
          for (const m of matches) {
            if (m.is_demo || m.user_id !== caller.userId) {
              return sendJson(403, { code: '42501', message: 'Cannot delete demo or foreign farm' });
            }
          }
        }

        const matchSet = new Set(matches);
        db[tableName] = db[tableName].filter((r) => !matchSet.has(r));

        // Simulate PostgreSQL ON DELETE CASCADE when deleting a farm
        if (tableName === 'farms') {
          const deletedIds = new Set(matches.map((m) => m.id));
          db.farmer_priorities = db.farmer_priorities.filter((r) => !deletedIds.has(r.farm_id));
          db.soil_records = db.soil_records.filter((r) => !deletedIds.has(r.farm_id));
          db.crop_rotation_assessments = db.crop_rotation_assessments.filter((r) => !deletedIds.has(r.farm_id));
          db.nasa_observations = db.nasa_observations.filter((r) => !deletedIds.has(r.farm_id));
          db.ai_advisor_messages = db.ai_advisor_messages.filter((r) => !deletedIds.has(r.farm_id));
          db.ingestion_jobs = db.ingestion_jobs.filter((r) => !deletedIds.has(r.farm_id));
        }

        return sendJson(200, matches);
      }
    }

    sendJson(404, { error: 'Not found' });
  });

  return {
    ANON_KEY,
    SECRET_KEY,
    db,
    seedUser,
    async start() {
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      const addr = server.address() as any;
      return `http://127.0.0.1:${addr.port}`;
    },
    async stop() {
      const closed = new Promise<void>((r) => server.close(() => r()));
      server.closeAllConnections?.();
      await closed;
    },
  };
}

test('Add Farm Management System: CRUD, Validation, RLS Isolation, Null Soil Safety, Area Units & NASA Sync', async (t) => {
  const savedEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  };

  const supa = createFarmManagementSupabaseHarness();
  const supaUrl = await supa.start();
  process.env.SUPABASE_URL = supaUrl;
  process.env.VITE_SUPABASE_URL = supaUrl;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = supa.ANON_KEY;
  process.env.SUPABASE_SECRET_KEY = supa.SECRET_KEY;
  resetSupabaseClientsForTesting();

  const userAId = '11111111-1111-4111-8111-11111111111a';
  const userBId = '22222222-2222-4222-8222-22222222222b';
  const tokenA = supa.seedUser(userAId, 'owner.a@fieldshift.test', 'Owner A');
  const tokenB = supa.seedUser(userBId, 'owner.b@fieldshift.test', 'Owner B');

  const capturedUpstreamUrls: string[] = [];
  let failPowerUpstream = false;
  const origFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (u.startsWith('http://127.0.0.1:')) {
      return origFetch(input, init);
    }

    capturedUpstreamUrls.push(u);

    if (u.includes('power.larc.nasa.gov')) {
      if (failPowerUpstream) {
        return new Response('Upstream error', { status: 502 });
      }
      return new Response(
        JSON.stringify({
          header: { fill_value: -999, api: { version: 'v2.6' } },
          geometry: { coordinates: [14.4378, 50.0755, 220] },
          properties: {
            parameter: {
              T2M: { '20260601': 18.2 },
              PRECTOTCORR: { '20260601': 3.5 },
              ALLSKY_SFC_SW_DWN: { '20260601': 19.4 },
              RH2M: { '20260601': 61.0 },
              WS2M: { '20260601': 2.8 },
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (u.includes('modis.ornl.gov')) {
      if (u.includes('/MOD13Q1/dates')) {
        return new Response(JSON.stringify({ dates: [{ modis_date: 'A2026145', calendar_date: '2026-05-25' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (u.includes('band=250m_16_days_NDVI')) {
        return new Response(
          JSON.stringify({ cellsize: 250, subset: [{ modis_date: 'A2026145', calendar_date: '2026-05-25', tile: 'h19v03', data: [6890] }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (u.includes('band=250m_16_days_EVI')) {
        return new Response(
          JSON.stringify({ subset: [{ modis_date: 'A2026145', calendar_date: '2026-05-25', tile: 'h19v03', data: [4120] }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (u.includes('band=250m_16_days_pixel_reliability')) {
        return new Response(
          JSON.stringify({ subset: [{ modis_date: 'A2026145', calendar_date: '2026-05-25', data: [0] }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (u.includes('/MOD11A2/dates')) {
        return new Response(JSON.stringify({ dates: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (u.includes('cmr.earthdata.nasa.gov')) {
      return new Response(
        JSON.stringify({
          feed: {
            entry: [
              {
                id: 'G-EU-BOHEMIA-1',
                producer_granule_id: 'BOHEMIA_GRANULE_1',
                time_start: '2026-05-25T00:00:00.000Z',
                data_center: 'LPDAAC_ECS',
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return origFetch(input, init);
  }) as typeof fetch;

  const { default: app } = await import('../api/index.js');
  const apiServer = http.createServer(app);
  await new Promise<void>((r) => apiServer.listen(0, '127.0.0.1', r));
  const baseUrl = `http://127.0.0.1:${(apiServer.address() as any).port}`;

  let bohemiaFarmId = '';

  try {
    await t.test('1. Initial seeded list returns 3 demo farms; unauthenticated CRUD is blocked with 401', async () => {
      const listRes = await origFetch(`${baseUrl}/api/farms`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(listRes.status, 200);
      const listJson: any = await listRes.json();
      assert.equal(listJson.farms.length, 3);
      assert.ok(listJson.farms.every((f: any) => f.isDemo === true && f.userId === null));

      for (const [method, path, body] of [
        ['POST', '/api/farms', { name: 'Unauth Farm' }],
        ['PATCH', '/api/farms/farm-1', { name: 'Hacked' }],
        ['DELETE', '/api/farms/farm-1', undefined],
      ] as const) {
        const res = await origFetch(`${baseUrl}${path}`, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        assert.equal(res.status, 401);
        assert.equal(((await res.json()) as any).code, 'AUTH_REQUIRED');
      }
    });

    await t.test('2. Strict validation rejects missing/invalid fields without fabricating coordinates or soil', async () => {
      const invalidPayloads = [
        // Missing name
        { city: 'Prague', country: 'Czechia', latitude: 50.0755, longitude: 14.4378, area: 100, currentCrop: 'Wheat' },
        // Missing coordinates (must NOT default to [-93.62, 42.03])
        { name: 'No Coords Farm', city: 'Prague', country: 'Czechia', area: 100, currentCrop: 'Wheat' },
        // Latitude out of range
        { name: 'Bad Lat Farm', city: 'Prague', country: 'Czechia', latitude: 91, longitude: 14.4, area: 100, currentCrop: 'Wheat' },
        // Longitude out of range
        { name: 'Bad Lon Farm', city: 'Prague', country: 'Czechia', latitude: 50, longitude: -181, area: 100, currentCrop: 'Wheat' },
        // Zero / negative area
        { name: 'Zero Area Farm', city: 'Prague', country: 'Czechia', latitude: 50, longitude: 14, area: 0, currentCrop: 'Wheat' },
        // Invalid pH
        { name: 'Bad pH Farm', city: 'Prague', country: 'Czechia', latitude: 50, longitude: 14, area: 50, currentCrop: 'Wheat', soilPH: 15 },
      ];

      for (const payload of invalidPayloads) {
        const res = await origFetch(`${baseUrl}/api/farms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
          body: JSON.stringify(payload),
        });
        assert.equal(res.status, 400, `Expected 400 for payload ${JSON.stringify(payload)}`);
        const json: any = await res.json();
        assert.equal(json.code, 'VALIDATION_ERROR');
      }
    });

    await t.test('3. Create private farm in hectares with null soil, custom priorities, and server-side ownership override', async () => {
      const createRes = await origFetch(`${baseUrl}/api/farms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          // Attacker tries spoofing isDemo / userId
          isDemo: true,
          userId: userBId,
          name: 'Elbe River Organic Fields',
          description: 'Transitioning to winter rye + cover polyculture.',
          country: 'Czechia',
          state: 'Central Bohemia',
          city: 'Nymburk',
          latitude: 50.186,
          longitude: 15.0417,
          area: 100,
          areaUnit: 'hectares',
          farmType: 'Certified Organic',
          operatingStatus: 'Active',
          currentCrop: 'Winter Wheat',
          previousCrop: 'Field Pea',
          irrigationType: 'Rainfed',
          plantingSeason: 'Fall 2026',
          harvestSeason: 'Summer 2027',
          // Omit soil details -> MUST remain null rather than fabricated 6.5 / 3.2
          farmerPriorities: {
            waterConservation: 5,
            profitability: 4,
            forageValue: 2,
            nitrogenFixing: 5,
            soilOrganicMatter: 5,
            erosionReduction: 5,
            soilInfiltration: 4,
            marketSuitability: 3,
            droughtResilience: 5,
            cropDiversity: 4,
            equipmentCompatibility: 3,
            plantingHarvestConstraints: 3,
          },
        }),
      });
      assert.equal(createRes.status, 201);
      const createJson: any = await createRes.json();
      const farm = createJson.farm;
      bohemiaFarmId = farm.id;

      // Ownership and demo flags strictly enforced server-side
      assert.equal(farm.isDemo, false);
      assert.equal(farm.userId, userAId);
      // Area converted cleanly: 100 hectares -> ~247.11 acres
      assert.equal(farm.area, 100);
      assert.equal(farm.areaUnit, 'hectares');
      assert.equal(farm.acreage, 247.11);
      assert.deepEqual(farm.coordinates, [15.0417, 50.186]);
      // Null soil parameters MUST remain null (never coerced to 6.5 or 3.2)
      assert.equal(farm.soilPH, null);
      assert.equal(farm.organicMatter, null);
      assert.equal(farm.soilType, null);
      assert.equal(farm.drainage, null);
      assert.equal(farm.soilProvenance, null);

      // Priorities persisted to normalized farmer_priorities table for new farm
      assert.ok(supa.db.farmer_priorities.some((p) => p.farm_id === bohemiaFarmId && p.user_id === userAId && p.water_conservation === 5));

      // Dashboard farm selector immediately receives 4 farms (3 demo + 1 new private farm)
      const afterList = await (await origFetch(`${baseUrl}/api/farms`, { headers: { Authorization: `Bearer ${tokenA}` } })).json() as any;
      assert.equal(afterList.farms.length, 4);
      assert.ok(afterList.farms.some((f: any) => f.id === bohemiaFarmId));

      // Duplicate farm name for same owner -> 409 FARM_DUPLICATE_NAME
      const dupRes = await origFetch(`${baseUrl}/api/farms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          name: '  elbe river organic fields ',
          country: 'Czechia',
          state: 'Central Bohemia',
          city: 'Nymburk',
          latitude: 50.186,
          longitude: 15.0417,
          area: 50,
          currentCrop: 'Winter Wheat',
        }),
      });
      assert.equal(dupRes.status, 409);
      assert.equal(((await dupRes.json()) as any).code, 'FARM_DUPLICATE_NAME');

      // Another owner (User B) CAN register a farm with that name independently
      const userBDupOk = await origFetch(`${baseUrl}/api/farms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({
          name: 'Elbe River Organic Fields',
          country: 'Czechia',
          state: 'Central Bohemia',
          city: 'Nymburk',
          latitude: 50.2,
          longitude: 15.1,
          area: 80,
          currentCrop: 'Soybeans',
        }),
      });
      assert.equal(userBDupOk.status, 201);
      const userBFarmJson: any = await userBDupOk.json();
      assert.equal(userBFarmJson.farm.userId, userBId);
    });

    await t.test('4. Nullable soil parameters remain null in /api/soil/profiles and /api/risk/field-analysis', async () => {
      const soilJson = (await (
        await origFetch(`${baseUrl}/api/soil/profiles?farmId=${encodeURIComponent(bohemiaFarmId)}`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        })
      ).json()) as any;
      assert.equal(soilJson.soilType, null);
      assert.equal(soilJson.metrics.pH.value, null);
      assert.equal(soilJson.metrics.pH.status, 'Not Provided');
      assert.equal(soilJson.metrics.organicMatter.value, null);
      assert.equal(soilJson.metrics.organicMatter.status, 'Not Provided');

      const riskJson = (await (
        await origFetch(`${baseUrl}/api/risk/field-analysis?farmId=${encodeURIComponent(bohemiaFarmId)}`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        })
      ).json()) as any;
      const omFactor = riskJson.indicators.find((f: any) => f.name === 'Organic Matter Moisture Buffer');
      assert.ok(omFactor);
      assert.equal(omFactor.score, null);
      assert.equal(omFactor.dataSource, 'Farmer Soil Record (Not Provided)');
    });

    await t.test('5. Partial PATCH preserves areaUnit=hectares and blocks demo or cross-user edits', async () => {
      // Partial PATCH changing only operatingStatus must NOT reset hectares -> acres
      const patchRes = await origFetch(`${baseUrl}/api/farms/${bohemiaFarmId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ operatingStatus: 'Fallow Transition' }),
      });
      assert.equal(patchRes.status, 200);
      const patchedFarm = ((await patchRes.json()) as any).farm;
      assert.equal(patchedFarm.operatingStatus, 'Fallow Transition');
      assert.equal(patchedFarm.areaUnit, 'hectares');
      assert.equal(patchedFarm.area, 100);
      assert.equal(patchedFarm.acreage, 247.11);

      // User B cannot view, edit, or delete User A's private farm
      const bGet = await origFetch(`${baseUrl}/api/farms/${bohemiaFarmId}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert.equal(bGet.status, 403);
      assert.equal(((await bGet.json()) as any).code, 'FARM_ACCESS_DENIED');

      const bPatch = await origFetch(`${baseUrl}/api/farms/${bohemiaFarmId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ name: 'Hijacked' }),
      });
      assert.equal(bPatch.status, 403);
      assert.equal(((await bPatch.json()) as any).code, 'FARM_ACCESS_DENIED');

      // Demo farms cannot be mutated or deleted
      const demoPatch = await origFetch(`${baseUrl}/api/farms/farm-1`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ name: 'Mutated Demo' }),
      });
      assert.equal(demoPatch.status, 403);
      assert.equal(((await demoPatch.json()) as any).code, 'FARM_ACCESS_DENIED');

      const demoDelete = await origFetch(`${baseUrl}/api/farms/farm-1`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(demoDelete.status, 403);
      assert.equal(((await demoDelete.json()) as any).code, 'FARM_ACCESS_DENIED');
    });

    await t.test('6. Newly created farm NASA ingest uses exact lat/lon, isolates telemetry, and reports failures honestly', async () => {
      // Seed unrelated observations on farm-1 to ensure new farm NEVER inherits them
      supa.db.nasa_observations.push({
        id: crypto.randomUUID(),
        farm_id: 'farm-1',
        user_id: userAId,
        scope_owner_id: userAId,
        dataset_id: 'nasa-power',
        product_id: 'NASA_POWER_AG_DAILY',
        variable: 'T2M',
        unit: '°C',
        value: 29.9,
        is_missing: false,
        quality_flag: 'valid',
        provenance: 'live_api_nasa_power',
        observed_at: '2026-06-01T00:00:00.000Z',
        retrieved_at: new Date().toISOString(),
        raw_metadata: {},
      });

      const beforeObs = (await (
        await origFetch(`${baseUrl}/api/nasa/observations/${bohemiaFarmId}`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        })
      ).json()) as any;
      assert.equal(beforeObs.observations.length, 0);

      capturedUpstreamUrls.length = 0;
      const ingestRes = await origFetch(`${baseUrl}/api/nasa/ingest/${bohemiaFarmId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ days: 7 }),
      });
      assert.equal(ingestRes.status, 200);
      const ingestJson: any = await ingestRes.json();
      assert.equal(ingestJson.accessMode, 'authenticated_owner');
      assert.equal(ingestJson.summary.hasPowerData, true);
      assert.equal(ingestJson.summary.hasModisNumericData, true);
      assert.equal(ingestJson.summary.latestModisNdvi, 0.689);

      // Verify exact coordinates of the new Czechia farm (50.186, 15.0417) were queried
      const powerCall = capturedUpstreamUrls.find((u) => u.includes('power.larc.nasa.gov'));
      const modisCall = capturedUpstreamUrls.find((u) => u.includes('modis.ornl.gov'));
      assert.ok(powerCall && powerCall.includes('latitude=50.186') && powerCall.includes('longitude=15.0417'));
      assert.ok(modisCall && modisCall.includes('latitude=50.186') && modisCall.includes('longitude=15.0417'));

      // Verify persisted observations are scoped strictly to the newly created farm
      const afterObs = (await (
        await origFetch(`${baseUrl}/api/nasa/observations/${bohemiaFarmId}`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        })
      ).json()) as any;
      assert.ok(afterObs.observations.length > 0);
      assert.ok(afterObs.observations.every((o: any) => o.farmId === bohemiaFarmId));
    });

    await t.test('7. Delete private farm cascades child records and respects authorization', async () => {
      // User B cannot delete User A's farm
      const bDel = await origFetch(`${baseUrl}/api/farms/${bohemiaFarmId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert.equal(bDel.status, 403);
      assert.equal(((await bDel.json()) as any).code, 'FARM_ACCESS_DENIED');

      // User A deletes their farm
      const aDel = await origFetch(`${baseUrl}/api/farms/${bohemiaFarmId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(aDel.status, 200);
      const delJson: any = await aDel.json();
      assert.equal(delJson.success, true);
      assert.equal(delJson.id, bohemiaFarmId);

      // Farm and all cascaded child records removed
      assert.equal(supa.db.farms.some((f) => f.id === bohemiaFarmId), false);
      assert.equal(supa.db.farmer_priorities.some((p) => p.farm_id === bohemiaFarmId), false);
      assert.equal(supa.db.nasa_observations.some((o) => o.farm_id === bohemiaFarmId), false);

      // Remaining list for User A returns cleanly to the 3 baseline demo farms
      const finalList = (await (await origFetch(`${baseUrl}/api/farms`, { headers: { Authorization: `Bearer ${tokenA}` } })).json()) as any;
      assert.equal(finalList.farms.length, 3);
    });
  } finally {
    globalThis.fetch = origFetch;
    const apiClosed = new Promise<void>((r) => apiServer.close(() => r()));
    apiServer.closeAllConnections?.();
    await apiClosed;
    await supa.stop();
    resetSupabaseClientsForTesting();
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
