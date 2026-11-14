import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { getFarmNasaObservationsSummary } from '../backend/nasa.js';

/**
 * Local GoTrue (/auth/v1/*) + PostgREST (/rest/v1/*) test server that mirrors
 * FieldShift's real Supabase schema and PostgreSQL RLS policies from migrations
 * 001, 002, and 003, allowing full end-to-end HTTP verification of api/index.ts.
 */
function createSupabaseTestHarness() {
  const ANON_KEY = 'test-publishable-key';
  const SECRET_KEY = 'test-secret-role-key';

  interface SimUser {
    id: string;
    email: string;
    password: string;
    fullName: string;
    emailConfirmedAt: string | null;
    otpCode: string;
  }

  const users = new Map<string, SimUser>();
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
        location: 'Ames, Story County, IA',
        coordinates: [-93.62, 42.03],
        acreage: 420,
        current_crop: 'Field Corn (Maize)',
        planting_season: 'Spring 2026',
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
        location: 'Manhattan, Riley County, KS',
        coordinates: [-96.57, 39.18],
        acreage: 310,
        current_crop: 'Grain Sorghum',
        planting_season: 'Spring 2026',
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
        location: 'Davis, Yolo County, CA',
        coordinates: [-121.74, 38.54],
        acreage: 260,
        current_crop: 'Sunflower',
        planting_season: 'Spring 2026',
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
      {
        // Spoofed/corrupted non-canonical demo row used to verify VERIFIED_DEMO_FARM_IDS + DB verification
        id: 'farm-999',
        user_id: null,
        is_demo: true,
        name: 'Non-Verified Spoof Farm',
        location: 'Nowhere, US',
        coordinates: [-95.0, 40.0],
        acreage: 100,
        current_crop: 'Corn',
        planting_season: 'Spring 2026',
        rotation_history: ['Corn'],
        soil_type: 'Loam',
        soil_ph: 6.5,
        organic_matter: 3.0,
        nitrogen: 'Medium',
        phosphorus: 'Medium',
        potassium: 'Medium',
        drainage: 'Well Drained',
        last_soil_test: '2026-01-01',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ] as any[],
    farmer_priorities: [] as any[],
    nasa_observations: [] as any[],
    ingestion_jobs: [] as any[],
    crop_rotation_assessments: [] as any[],
    ai_advisor_messages: [] as any[],
  };

  function issueJwtForUser(userId: string, expiresInSeconds = 3600): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: userId, role: 'authenticated', iat: Math.floor(Date.now() / 1000) })
    ).toString('base64url');
    const sig = crypto.randomBytes(16).toString('base64url');
    const jwt = `${header}.${payload}.${sig}`;
    tokens.set(jwt, { userId, exp: Date.now() + expiresInSeconds * 1000 });
    return jwt;
  }

  function resolveCaller(req: http.IncomingMessage): { role: 'service_role' | 'authenticated' | 'anon'; userId: string | null } {
    const authHdr = String(req.headers.authorization || '');
    const apiKeyHdr = String(req.headers.apikey || '');
    const bearer = authHdr.startsWith('Bearer ') ? authHdr.slice(7).trim() : '';

    if (bearer === SECRET_KEY || apiKeyHdr === SECRET_KEY) {
      return { role: 'service_role', userId: null };
    }
    if (bearer && bearer !== ANON_KEY) {
      const rec = tokens.get(bearer);
      if (rec && rec.exp > Date.now()) {
        return { role: 'authenticated', userId: rec.userId };
      }
      return { role: 'anon', userId: null };
    }
    return { role: 'anon', userId: null };
  }

  function isVerifiedDemoFarmInDb(farmId: string): boolean {
    return db.farms.some((f) => f.id === farmId && f.is_demo === true && f.user_id === null);
  }

  function filterRowsByRls(table: keyof typeof db, rows: any[], caller: ReturnType<typeof resolveCaller>): any[] {
    if (caller.role === 'service_role') return rows;
    if (table === 'nasa_datasets') return rows;
    if (table === 'farms') {
      if (caller.role === 'authenticated') {
        return rows.filter((r) => r.is_demo === true || r.user_id === caller.userId);
      }
      return rows.filter((r) => r.is_demo === true && r.user_id === null);
    }
    if (table === 'nasa_observations') {
      if (caller.role === 'authenticated') {
        return rows.filter((r) => r.user_id === caller.userId);
      }
      return [];
    }
    if (table === 'ingestion_jobs') {
      if (caller.role === 'authenticated') {
        return rows.filter((r) => r.user_id === caller.userId);
      }
      return [];
    }
    if (table === 'profiles') {
      return caller.role === 'authenticated' ? rows.filter((r) => r.id === caller.userId) : [];
    }
    if (
      table === 'farmer_priorities' ||
      table === 'crop_rotation_assessments' ||
      table === 'ai_advisor_messages'
    ) {
      return caller.role === 'authenticated' ? rows.filter((r) => r.user_id === caller.userId) : [];
    }
    return [];
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
    const sendJson = (status: number, data: any, extraHeaders: Record<string, string> = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...extraHeaders });
      res.end(JSON.stringify(data));
    };

    // --- GoTrue Auth Endpoints ---
    if (pathname === '/auth/v1/signup' && req.method === 'POST') {
      const email = String(body.email || '').toLowerCase();
      if (users.has(email)) {
        return sendJson(400, { msg: 'User already registered', error_description: 'User already registered' });
      }
      const user: SimUser = {
        id: crypto.randomUUID(),
        email,
        password: String(body.password || ''),
        fullName: String(body.data?.full_name || email.split('@')[0]),
        emailConfirmedAt: null,
        otpCode: '123456',
      };
      users.set(email, user);
      return sendJson(200, {
        user: {
          id: user.id,
          email: user.email,
          email_confirmed_at: null,
          user_metadata: { full_name: user.fullName },
        },
        session: null,
      });
    }

    if (pathname === '/auth/v1/verify' && req.method === 'POST') {
      const email = String(body.email || '').toLowerCase();
      const token = String(body.token || '');
      const user = users.get(email);
      if (!user || user.otpCode !== token) {
        return sendJson(400, { msg: 'Token has expired or is invalid', error_description: 'Invalid OTP' });
      }
      user.emailConfirmedAt = new Date().toISOString();
      const accessToken = issueJwtForUser(user.id);
      const userPayload = {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.emailConfirmedAt,
        user_metadata: { full_name: user.fullName },
      };
      return sendJson(200, {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: `refresh-${user.id}`,
        user: userPayload,
      });
    }

    if (pathname === '/auth/v1/token' && req.method === 'POST') {
      const email = String(body.email || '').toLowerCase();
      const password = String(body.password || '');
      const user = users.get(email);
      if (!user || user.password !== password) {
        return sendJson(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
      }
      if (!user.emailConfirmedAt) {
        return sendJson(400, { error: 'invalid_grant', error_description: 'Email not confirmed' });
      }
      const accessToken = issueJwtForUser(user.id);
      const userPayload = {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.emailConfirmedAt,
        user_metadata: { full_name: user.fullName },
      };
      return sendJson(200, {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: `refresh-${user.id}`,
        user: userPayload,
      });
    }

    if (pathname === '/auth/v1/user' && req.method === 'GET') {
      const authHdr = String(req.headers.authorization || '');
      const jwt = authHdr.startsWith('Bearer ') ? authHdr.slice(7).trim() : '';
      const rec = tokens.get(jwt);
      if (!rec || rec.exp <= Date.now()) {
        return sendJson(401, { msg: 'invalid JWT: token is expired or invalid' });
      }
      const user = Array.from(users.values()).find((u) => u.id === rec.userId);
      if (!user) return sendJson(401, { msg: 'User not found' });
      return sendJson(200, {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.emailConfirmedAt,
        user_metadata: { full_name: user.fullName },
      });
    }

    if (pathname === '/auth/v1/logout' && req.method === 'POST') {
      const authHdr = String(req.headers.authorization || '');
      const jwt = authHdr.startsWith('Bearer ') ? authHdr.slice(7).trim() : '';
      if (jwt) tokens.delete(jwt);
      res.writeHead(204);
      res.end();
      return;
    }

    // --- PostgREST Table Endpoints ---
    if (pathname.startsWith('/rest/v1/')) {
      const tableName = pathname.slice('/rest/v1/'.length) as keyof typeof db;
      if (!(tableName in db)) {
        return sendJson(404, { message: `Table ${tableName} not found` });
      }
      const caller = resolveCaller(req);
      const acceptHdr = String(req.headers.accept || '');
      const preferHdr = String(req.headers.prefer || '');
      const wantsSingleObj = acceptHdr.includes('application/vnd.pgrst.object+json');
      const wantsCount = preferHdr.includes('count=exact');

      if (req.method === 'GET') {
        const visible = filterRowsByRls(tableName, db[tableName], caller);
        const filtered = applyPostgrestFilters(visible, url.searchParams);
        const total = filtered.length;
        const limitParam = url.searchParams.get('limit');
        const offsetParam = url.searchParams.get('offset');
        const rangeHdr = String(req.headers.range || '');
        let start = offsetParam ? Number(offsetParam) : 0;
        let end = limitParam ? start + Number(limitParam) : filtered.length;
        if (rangeHdr) {
          const m = rangeHdr.match(/^(\d+)-(\d+)$/);
          if (m) {
            start = Number(m[1]);
            end = Number(m[2]) + 1;
          }
        }
        const sliced = filtered.slice(start, end);

        if (wantsSingleObj) {
          if (sliced.length !== 1) {
            return sendJson(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
          }
          return sendJson(200, sliced[0]);
        }

        const headers: Record<string, string> = {};
        if (wantsCount) {
          headers['Content-Range'] = sliced.length > 0 ? `${start}-${start + sliced.length - 1}/${total}` : `*/${total}`;
        }
        return sendJson(200, sliced, headers);
      }

      if (req.method === 'POST') {
        const incomingRows = Array.isArray(body) ? body : [body];
        if (caller.role === 'anon') {
          return sendJson(403, { code: '42501', message: 'new row violates row-level security policy' });
        }
        if (caller.role === 'authenticated') {
          for (const row of incomingRows) {
            if (tableName === 'profiles' && row.id !== caller.userId) {
              return sendJson(403, { code: '42501', message: 'RLS violation on profiles' });
            }
            if (tableName !== 'profiles' && tableName !== 'nasa_datasets' && row.user_id !== caller.userId) {
              return sendJson(403, { code: '42501', message: `RLS violation on ${tableName}` });
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
            const idx = db[tableName].findIndex((existing) =>
              conflictCols.every((c) => String(existing[c] ?? '') === String(row[c] ?? ''))
            );
            if (idx >= 0) {
              db[tableName][idx] = { ...db[tableName][idx], ...row };
              inserted.push(db[tableName][idx]);
              continue;
            }
          }
          db[tableName].push(row);
          inserted.push(row);
        }

        if (wantsSingleObj) return sendJson(201, inserted[0]);
        return sendJson(201, inserted);
      }

      if (req.method === 'PATCH') {
        if (caller.role === 'anon') {
          return sendJson(403, { code: '42501', message: 'RLS policy forbids update' });
        }
        const visible = filterRowsByRls(tableName, db[tableName], caller);
        const matches = applyPostgrestFilters(visible, url.searchParams);
        for (const m of matches) {
          if (caller.role === 'authenticated' && tableName === 'farms' && (m.is_demo || m.user_id !== caller.userId)) {
            return sendJson(403, { code: '42501', message: 'Cannot mutate demo or other user farm' });
          }
          Object.assign(m, body);
        }
        if (wantsSingleObj) {
          if (matches.length !== 1) return sendJson(406, { code: 'PGRST116', message: 'Not single row' });
          return sendJson(200, matches[0]);
        }
        return sendJson(200, matches);
      }

      if (req.method === 'DELETE') {
        if (caller.role === 'anon') {
          return sendJson(403, { code: '42501', message: 'RLS policy forbids delete' });
        }
        const visible = filterRowsByRls(tableName, db[tableName], caller);
        const matches = new Set(applyPostgrestFilters(visible, url.searchParams));
        db[tableName] = db[tableName].filter((r) => !matches.has(r));
        return sendJson(200, []);
      }
    }

    sendJson(404, { error: 'Not found in Supabase test server' });
  });

  return {
    ANON_KEY,
    SECRET_KEY,
    db,
    users,
    tokens,
    issueJwtForUser,
    async start() {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const addr = server.address();
      assert.ok(addr && typeof addr === 'object');
      return `http://127.0.0.1:${addr.port}`;
    },
    async stop() {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

test('End-to-end Auth, Authenticated Demo Farms, 403/404 Isolation, Honest Metadata-Only Failure, MODIS & Frontend Refresh Suite', async (t) => {
  const savedEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  delete process.env.SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const { default: app } = await import('../api/index.js');
  const expressServer = http.createServer(app);
  await new Promise<void>((resolve) => expressServer.listen(0, '127.0.0.1', resolve));
  const expressAddr = expressServer.address();
  assert.ok(expressAddr && typeof expressAddr === 'object');
  const baseUrl = `http://127.0.0.1:${expressAddr.port}`;

  await t.test('0. Unconfigured Supabase returns clean 503 with zero in-memory fallback', async () => {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'Password123!' }),
    });
    assert.equal(loginRes.status, 503);
    const body: any = await loginRes.json();
    assert.equal(body.code, 'SUPABASE_UNCONFIGURED');
  });

  const supa = createSupabaseTestHarness();
  const supaUrl = await supa.start();
  process.env.SUPABASE_URL = supaUrl;
  process.env.VITE_SUPABASE_URL = supaUrl;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = supa.ANON_KEY;
  process.env.SUPABASE_SECRET_KEY = supa.SECRET_KEY;

  const realFetch = globalThis.fetch;
  let modisMode: 'good' | 'cloudy_only' | 'ornl_timeout' = 'good';
  let powerMode: 'good' | 'fail' = 'good';

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    if (urlStr.startsWith(baseUrl) || urlStr.startsWith(supaUrl)) {
      return realFetch(input, init);
    }

    if (urlStr.startsWith('https://power.larc.nasa.gov/')) {
      if (powerMode === 'fail') {
        return new Response('POWER Upstream Error', { status: 502 });
      }
      return new Response(
        JSON.stringify({
          header: { fill_value: -999, api: { version: 'v2.6' } },
          geometry: { coordinates: [-93.62, 42.03, 290] },
          properties: {
            parameter: {
              T2M: { '20261101': 14.5, '20261102': 15.8 },
              T2M_MAX: { '20261101': 19.2, '20261102': 20.1 },
              T2M_MIN: { '20261101': 9.4, '20261102': 10.2 },
              PRECTOTCORR: { '20261101': 2.4, '20261102': 0.0 },
              RH2M: { '20261101': 66.0, '20261102': 62.5 },
              ALLSKY_SFC_SW_DWN: { '20261101': 11.4, '20261102': 12.1 },
              WS2M: { '20261101': 4.1, '20261102': 3.6 },
            },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (urlStr.startsWith('https://modis.ornl.gov/')) {
      if (modisMode === 'ornl_timeout') {
        return new Response('Gateway Timeout', { status: 504 });
      }
      if (urlStr.includes('/MOD13Q1/dates')) {
        return new Response(
          JSON.stringify({ dates: [{ modis_date: 'A2026289', calendar_date: '2026-10-16' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('band=250m_16_days_NDVI')) {
        return new Response(
          JSON.stringify({
            cellsize: 231.656,
            subset: [{ modis_date: 'A2026289', calendar_date: '2026-10-16', tile: 'h10v04', data: [6420] }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('band=250m_16_days_EVI')) {
        return new Response(
          JSON.stringify({
            subset: [{ modis_date: 'A2026289', calendar_date: '2026-10-16', tile: 'h10v04', data: [3810] }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('band=250m_16_days_pixel_reliability')) {
        const qualityVal = modisMode === 'cloudy_only' ? 3 : 0;
        return new Response(
          JSON.stringify({
            subset: [{ modis_date: 'A2026289', calendar_date: '2026-10-16', data: [qualityVal] }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('/MOD11A2/dates')) {
        return new Response(
          JSON.stringify({ dates: [{ modis_date: 'A2026289', calendar_date: '2026-10-16' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes('/MOD11A2/subset')) {
        return new Response(
          JSON.stringify({
            subset: [{ modis_date: 'A2026289', calendar_date: '2026-10-16', tile: 'h10v04', data: [14850] }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (urlStr.startsWith('https://cmr.earthdata.nasa.gov/')) {
      return new Response(
        JSON.stringify({
          feed: {
            entry: [
              {
                id: 'G999-CMR',
                producer_granule_id: 'TEST_GRANULE_20261101',
                time_start: '2026-11-01T00:00:00.000Z',
                time_end: '2026-11-01T23:59:59.000Z',
                data_center: 'LPDAAC_ECS',
                links: [{ href: 'https://data.lpdaac.earthdatacloud.nasa.gov/granule.hdf' }],
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return realFetch(input, init);
  }) as typeof fetch;

  let userAId = '';
  let userAToken = '';
  let userBToken = '';
  let userAFarmId = '';

  try {
    await t.test('1-2. Register -> verify OTP -> login -> restore session & Bearer authenticated request', async () => {
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'farmer.a@fieldshift.test',
          fullName: 'Farmer A',
          password: 'FieldShift_2026!',
        }),
      });
      assert.equal(regRes.status, 201);

      const otpRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'farmer.a@fieldshift.test', code: '123456' }),
      });
      assert.equal(otpRes.status, 200);

      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'farmer.a@fieldshift.test', password: 'FieldShift_2026!' }),
      });
      assert.equal(loginRes.status, 200);
      const loginJson: any = await loginRes.json();
      assert.ok(loginJson.token);
      assert.equal(loginJson.user.verified, true);
      userAToken = loginJson.token;
      userAId = supa.users.get('farmer.a@fieldshift.test')!.id;
      const setCookie = loginRes.headers.get('set-cookie') || '';
      assert.match(setCookie, /fieldshift_session=/);

      const sessionRes = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert.equal(sessionRes.status, 200);
      const sessionJson: any = await sessionRes.json();
      assert.equal(sessionJson.user.email, 'farmer.a@fieldshift.test');

      const profileRes = await fetch(`${baseUrl}/api/profile`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert.equal(profileRes.status, 200);

      // Also register/verify/login User B
      await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'farmer.b@fieldshift.test',
          fullName: 'Farmer B',
          password: 'FieldShift_2026!',
        }),
      });
      await fetch(`${baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'farmer.b@fieldshift.test', code: '123456' }),
      });
      const loginBRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'farmer.b@fieldshift.test', password: 'FieldShift_2026!' }),
      });
      userBToken = ((await loginBRes.json()) as any).token;
      assert.ok(userBToken);
    });

    await t.test('3. Invalid and expired tokens fail cleanly with 401 AUTH_INVALID_TOKEN', async () => {
      const badTokenRes = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: 'Bearer not.a.validjwt' },
      });
      assert.equal(badTokenRes.status, 401);
      assert.equal(((await badTokenRes.json()) as any).code, 'AUTH_INVALID_TOKEN');

      const expiredJwt = supa.issueJwtForUser(userAId, -60);
      const expiredIngestRes = await fetch(`${baseUrl}/api/nasa/ingest/farm-1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${expiredJwt}`,
        },
        body: JSON.stringify({ days: 7 }),
      });
      assert.equal(expiredIngestRes.status, 401);
      assert.equal(((await expiredIngestRes.json()) as any).code, 'AUTH_INVALID_TOKEN');
    });

    await t.test('4. Logout clears session cookie and revokes token', async () => {
      const tempLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'farmer.a@fieldshift.test', password: 'FieldShift_2026!' }),
      });
      const tempToken = ((await tempLogin.json()) as any).token;

      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tempToken}` },
      });
      assert.equal(logoutRes.status, 200);
      assert.match(logoutRes.headers.get('set-cookie') || '', /Max-Age=0/);

      const afterLogout = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Authorization: `Bearer ${tempToken}` },
      });
      assert.equal(afterLogout.status, 401);
    });

    await t.test('5. Unauthenticated requests (including signed-out farm-1 ingest) return 401 AUTH_REQUIRED', async () => {
      for (const [method, path, body] of [
        ['GET', '/api/profile'],
        ['GET', '/api/farms'],
        ['GET', '/api/rotations'],
        ['GET', '/api/ai/history'],
        ['POST', '/api/nasa/ingest/farm-1', { days: 7 }],
        ['GET', '/api/nasa/observations/farm-1'],
        ['POST', '/api/datasets/nasa-power/sync', { farmId: 'farm-1', days: 7 }],
        ['POST', '/api/ai/advisor', { prompt: 'Test', farmId: 'farm-1' }],
      ] as const) {
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        assert.equal(res.status, 401, `${method} ${path} must return 401 when signed out`);
        const json: any = await res.json();
        assert.equal(json.code, 'AUTH_REQUIRED');
      }
    });

    await t.test('6-9. Authenticated users ingest verified demo farms (farm-1..3) scoped by user_id; spoofed farm-999 returns 403; nonexistent returns 404', async () => {
      modisMode = 'good';
      powerMode = 'good';

      let lastDemoJobId = '';
      for (const demoId of ['farm-1', 'farm-2', 'farm-3']) {
        const ingestRes = await fetch(`${baseUrl}/api/nasa/ingest/${demoId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userAToken}`,
          },
          body: JSON.stringify({ days: 7 }),
        });
        assert.equal(ingestRes.status, 200, `${demoId} authenticated demo ingest must return 200`);
        const ingestJson: any = await ingestRes.json();
        assert.equal(ingestJson.accessMode, 'authenticated_demo');
        assert.ok(ingestJson.jobId, 'Parent ingestion jobId must be returned');
        assert.equal(ingestJson.summary.hasPowerData, true);
        assert.equal(ingestJson.summary.hasModisNumericData, true);
        assert.equal(ingestJson.summary.latestModisNdvi, 0.642);
        lastDemoJobId = ingestJson.jobId;
      }

      // Persisted rows for farm-1 must belong strictly to User A (user_id = userAId, scope_owner_id = userAId)
      const userADemoRows = supa.db.nasa_observations.filter((r) => r.farm_id === 'farm-1' && r.user_id === userAId);
      assert.ok(userADemoRows.length > 0);
      assert.ok(userADemoRows.every((r) => r.user_id === userAId && r.scope_owner_id === userAId));

      // User A can poll their own jobId; User B gets 403; nonexistent UUID gets 404; bad UUID gets 400
      const jobResA = await fetch(`${baseUrl}/api/nasa/ingestion/${lastDemoJobId}`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert.equal(jobResA.status, 200);
      assert.equal(((await jobResA.json()) as any).job.farm_id, 'farm-3');

      const jobResB = await fetch(`${baseUrl}/api/nasa/ingestion/${lastDemoJobId}`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert.equal(jobResB.status, 403);

      const missingJobRes = await fetch(`${baseUrl}/api/nasa/ingestion/11111111-1111-4111-8111-111111111111`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert.equal(missingJobRes.status, 404);

      const badJobIdRes = await fetch(`${baseUrl}/api/nasa/ingestion/not-a-uuid`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert.equal(badJobIdRes.status, 400);

      // User B sees zero of User A's observations on farm-1 (cross-user demo isolation)
      const obsUserB = await fetch(`${baseUrl}/api/nasa/observations/farm-1`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert.equal(obsUserB.status, 200);
      assert.equal(((await obsUserB.json()) as any).observations.length, 0);

      // Spoofed client isDemo flag on non-verified DB farm-999 -> 403 FARM_ACCESS_DENIED
      const spoofRes = await fetch(`${baseUrl}/api/nasa/ingest/farm-999`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ isDemo: true, userId: 'attacker-spoof', days: 7 }),
      });
      assert.equal(spoofRes.status, 403);
      assert.equal(((await spoofRes.json()) as any).code, 'FARM_ACCESS_DENIED');

      // Nonexistent farm -> 404 FARM_NOT_FOUND
      const notFoundRes = await fetch(`${baseUrl}/api/nasa/ingest/farm-does-not-exist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ days: 7 }),
      });
      assert.equal(notFoundRes.status, 404);
      assert.equal(((await notFoundRes.json()) as any).code, 'FARM_NOT_FOUND');
    });

    await t.test('10-11. Authenticated User A private farm ingestion succeeds; User B rejected with 403 FARM_ACCESS_DENIED', async () => {
      const createFarmRes = await fetch(`${baseUrl}/api/farms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
          name: 'User A Private Parcel',
          location: 'Ames, IA',
          coordinates: [-93.62, 42.03],
          acreage: 200,
          currentCrop: 'Field Corn (Maize)',
          plantingSeason: 'Spring 2026',
          soilType: 'Clarion Silt Loam',
          soilPH: 6.5,
          organicMatter: 3.5,
          nitrogen: 'Medium',
          phosphorus: 'Medium',
          potassium: 'High',
          drainage: 'Well Drained',
        }),
      });
      assert.equal(createFarmRes.status, 201);
      userAFarmId = ((await createFarmRes.json()) as any).farm.id;

      const userAIngest = await fetch(`${baseUrl}/api/nasa/ingest/${userAFarmId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ days: 7 }),
      });
      assert.equal(userAIngest.status, 200);
      const userAIngestJson: any = await userAIngest.json();
      assert.equal(userAIngestJson.accessMode, 'authenticated_owner');
      assert.equal(userAIngestJson.summary.hasPowerData, true);
      assert.ok(userAIngestJson.jobId);

      // Unauthenticated cannot poll private job -> 401
      const unauthJobRes = await fetch(`${baseUrl}/api/nasa/ingestion/${userAIngestJson.jobId}`);
      assert.equal(unauthJobRes.status, 401);

      // User B cannot access User A's private farm across any route -> 403 FARM_ACCESS_DENIED
      const bIngest = await fetch(`${baseUrl}/api/nasa/ingest/${userAFarmId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userBToken}`,
        },
        body: JSON.stringify({ days: 7 }),
      });
      assert.equal(bIngest.status, 403);
      assert.equal(((await bIngest.json()) as any).code, 'FARM_ACCESS_DENIED');

      const bObs = await fetch(`${baseUrl}/api/nasa/observations/${userAFarmId}`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert.equal(bObs.status, 403);

      const bSoil = await fetch(`${baseUrl}/api/soil/profiles?farmId=${encodeURIComponent(userAFarmId)}`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert.equal(bSoil.status, 403);
    });

    await t.test('12. Truthful NASA ingestion never claims success on metadata-only discovery (returns 502 + metadataOnly: true)', async () => {
      // Individual CMR-only dataset syncs report success: false, metadataOnly: true
      for (const ds of ['smap', 'gpm', 'ecostress'] as const) {
        const cmrSync = await fetch(`${baseUrl}/api/datasets/${ds}/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userAToken}`,
          },
          body: JSON.stringify({ farmId: 'farm-1' }),
        });
        assert.equal(cmrSync.status, 200);
        const cmrJson: any = await cmrSync.json();
        assert.equal(cmrJson.success, false, `${ds} metadata-only sync must not claim success=true`);
        assert.equal(cmrJson.metadataOnly, true);
        assert.equal(cmrJson.discoverySuccess, true);
      }

      // Full ingest when both POWER & MODIS numeric fail while CMR granules exist -> HTTP 502, success: false, metadataOnly: true
      powerMode = 'fail';
      modisMode = 'ornl_timeout';
      const metaOnlyIngest = await fetch(`${baseUrl}/api/nasa/ingest/farm-1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ days: 7 }),
      });
      assert.equal(metaOnlyIngest.status, 502);
      const metaOnlyJson: any = await metaOnlyIngest.json();
      assert.equal(metaOnlyJson.success, false);
      assert.equal(metaOnlyJson.metadataOnly, true);
      assert.equal(metaOnlyJson.code, 'NASA_METADATA_ONLY_NO_OBSERVATIONS');
      assert.equal(metaOnlyJson.numericRecordsSaved, 0);
      assert.ok(metaOnlyJson.metadataGranulesFound > 0);
      assert.ok(metaOnlyJson.jobId);
      assert.equal(metaOnlyJson.jobStatus, 'partial');

      // Verify persisted job record obeys DB constraint ('partial')
      const jobRes = await fetch(`${baseUrl}/api/nasa/ingestion/${metaOnlyJson.jobId}`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert.equal(jobRes.status, 200);
      assert.equal(((await jobRes.json()) as any).job.status, 'partial');
    });

    await t.test('13-15. MODIS truncation fix (650+ POWER rows), cloud-masked status, and ORNL timeout + CMR partial persistence', async () => {
      powerMode = 'good';
      modisMode = 'good';

      // Case A: Insert 650 recent POWER rows for User A on farm-1 and confirm MODIS is NOT evicted
      const baseTime = Date.parse('2026-11-12T00:00:00.000Z');
      for (let i = 0; i < 650; i++) {
        const obsAt = new Date(baseTime - i * 3600_000).toISOString();
        supa.db.nasa_observations.push({
          id: crypto.randomUUID(),
          farm_id: 'farm-1',
          user_id: userAId,
          scope_owner_id: userAId,
          dataset_id: 'nasa-power',
          product_id: 'NASA_POWER_AG_DAILY',
          variable: 'T2M',
          unit: 'C',
          value: 12.5,
          is_missing: false,
          quality_flag: 'good_data',
          provenance: 'live_api_nasa_power',
          observed_at: obsAt,
          retrieved_at: new Date().toISOString(),
          raw_metadata: {},
        });
      }
      const { getSupabaseUserClient } = await import('../backend/supabase.js');
      const userAClient = getSupabaseUserClient(userAToken)!;
      const summaryAfter650 = await getFarmNasaObservationsSummary(userAClient, 'farm-1', `test-${Date.now()}`);
      assert.equal(summaryAfter650.hasPowerData, true);
      assert.equal(summaryAfter650.hasModisNumericData, true, 'MODIS must not be evicted by 650 POWER rows');
      assert.equal(summaryAfter650.latestModisNdvi, 0.642);

      // Case B: Quality-masked only (cloudy MODIS pixels) on farm-2 -> vegetationNDVI.status === 'quality_masked'
      supa.db.nasa_observations = supa.db.nasa_observations.filter(
        (r) => !(r.farm_id === 'farm-2' && r.user_id === userAId && r.dataset_id === 'modis')
      );
      modisMode = 'cloudy_only';
      const maskedSync = await fetch(`${baseUrl}/api/datasets/modis/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ farmId: 'farm-2' }),
      });
      assert.equal(maskedSync.status, 200);
      const maskedObs = await fetch(`${baseUrl}/api/nasa/observations?farmId=farm-2`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert.equal(maskedObs.status, 200);
      const maskedObsJson: any = await maskedObs.json();
      assert.equal(maskedObsJson.realTimeMetrics.vegetationNDVI.status, 'quality_masked');

      // Case C: ORNL timeout + Earthdata CMR success on farm-3 -> CMR granules persist, status === 'granule_metadata_only'
      supa.db.nasa_observations = supa.db.nasa_observations.filter(
        (r) => !(r.farm_id === 'farm-3' && r.user_id === userAId && r.dataset_id === 'modis')
      );
      modisMode = 'ornl_timeout';
      const partialSync = await fetch(`${baseUrl}/api/datasets/modis/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({ farmId: 'farm-3' }),
      });
      assert.equal(partialSync.status, 200);
      const partialJson: any = await partialSync.json();
      assert.equal(partialJson.status, 'partial');
      assert.equal(partialJson.success, false);
      assert.equal(partialJson.metadataOnly, true);
      assert.ok(partialJson.granulesFound > 0);
      assert.ok(typeof partialJson.ornlError === 'string' && partialJson.ornlError.length > 0);

      const partialObs = await fetch(`${baseUrl}/api/nasa/observations?farmId=farm-3`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert.equal(partialObs.status, 200);
      const partialObsJson: any = await partialObs.json();
      assert.equal(partialObsJson.realTimeMetrics.vegetationNDVI.status, 'granule_metadata_only');
      assert.ok(partialObsJson.realTimeMetrics.vegetationNDVI.ornlError);
    });

    await t.test('16. Frontend apiClient proactively refreshes near-expired session, retries 401 once, and clears stale localStorage token', async () => {
      const { setSupabaseClientForTesting } = await import('../src/lib/supabase.js');
      const { apiClient } = await import('../src/services/apiClient.js');
      const { authService } = await import('../src/services/authService.js');

      const storageMap = new Map<string, string>();
      const prevLocalStorage = (globalThis as any).localStorage;
      (globalThis as any).localStorage = {
        getItem: (k: string) => (storageMap.has(k) ? storageMap.get(k)! : null),
        setItem: (k: string, v: string) => storageMap.set(k, String(v)),
        removeItem: (k: string) => storageMap.delete(k),
      };

      try {
        // 1. Stale token in localStorage is wiped when Supabase has no active session
        storageMap.set('fieldshift_token', 'stale-legacy-token');
        setSupabaseClientForTesting({
          auth: {
            getSession: async () => ({ data: { session: null }, error: null }),
            refreshSession: async () => ({ data: { session: null }, error: null }),
          },
        } as any);

        const sessNoSession = await authService.getSession();
        assert.equal(sessNoSession.success, false);
        assert.equal(storageMap.get('fieldshift_token'), undefined);

        // 2. Near-expired access token triggers proactive refreshSession BEFORE calling backend
        const freshTokenA = supa.issueJwtForUser(userAId, 3600);
        const expiredTokenA = supa.issueJwtForUser(userAId, -10);
        let refreshCalls = 0;
        setSupabaseClientForTesting({
          auth: {
            getSession: async () => ({
              data: {
                session: {
                  access_token: expiredTokenA,
                  expires_at: Math.floor(Date.now() / 1000) - 5,
                },
              },
              error: null,
            }),
            refreshSession: async () => {
              refreshCalls += 1;
              return {
                data: { session: { access_token: freshTokenA } },
                error: null,
              };
            },
          },
        } as any);

        powerMode = 'good';
        modisMode = 'good';
        const res = await apiClient.post(`${baseUrl}/api/nasa/ingest/farm-1`, { days: 7 });
        assert.equal(res.success, true);
        assert.equal(refreshCalls, 1);
        assert.equal(storageMap.get('fieldshift_token'), freshTokenA);

        // 3. Backend 401 retry path refreshes revoked token once and succeeds
        const revokedToken = supa.issueJwtForUser(userAId, 3600);
        supa.tokens.delete(revokedToken);
        const freshTokenB = supa.issueJwtForUser(userAId, 3600);
        let retryRefreshCalls = 0;
        let sessionAccessToken = revokedToken;
        setSupabaseClientForTesting({
          auth: {
            getSession: async () => ({
              data: {
                session: {
                  access_token: sessionAccessToken,
                  expires_at: Math.floor(Date.now() / 1000) + 3600,
                },
              },
              error: null,
            }),
            refreshSession: async () => {
              retryRefreshCalls += 1;
              sessionAccessToken = freshTokenB;
              return {
                data: { session: { access_token: freshTokenB } },
                error: null,
              };
            },
          },
        } as any);

        const retryRes = await apiClient.get(`${baseUrl}/api/nasa/observations/farm-1`);
        assert.ok(Array.isArray(retryRes.observations));
        assert.equal(retryRefreshCalls, 1);
      } finally {
        setSupabaseClientForTesting(undefined);
        (globalThis as any).localStorage = prevLocalStorage;
      }
    });
  } finally {
    globalThis.fetch = realFetch;
    await supa.stop();
    expressServer.closeAllConnections?.();
    await new Promise<void>((resolve) => expressServer.close(() => resolve()));

    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
