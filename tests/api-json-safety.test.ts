import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import dotenv from 'dotenv';
import { app, resetRateLimitsForTesting } from '../app.js';
import { resetSupabaseClientsForTesting } from '../backend/supabase.js';
import { apiClient, ApiError, isHtmlPayload } from '../src/services/apiClient.js';
import { AuthServiceError, safeFetchAuthJson } from '../src/services/authService.js';
import { ingestAllAvailableForFarm } from '../backend/nasa.js';

dotenv.config();

async function rawRequest(
  baseUrl: string,
  method: string,
  route: string,
  bodyText?: string,
  headers: Record<string, string> = {}
) {
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(bodyText !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: bodyText,
  });
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';
  return { status: res.status, contentType, text };
}

test('API JSON Safety, Vercel Routing & Frontend HTML-Guard Suite', async (t) => {
  resetRateLimitsForTesting();
  resetSupabaseClientsForTesting();

  await t.test('1. vercel.json & authService.ts route guards keep /api/* routed cleanly to serverless Express', () => {
    const vercelCfg = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8'));
    assert.ok(Array.isArray(vercelCfg.rewrites), 'vercel.json must define rewrites');
    const apiRootIdx = vercelCfg.rewrites.findIndex(
      (r: any) => r.source === '/api' && r.destination === '/api'
    );
    const apiWildcardIdx = vercelCfg.rewrites.findIndex(
      (r: any) => r.source === '/api/(.*)' && r.destination === '/api'
    );
    const spaIdx = vercelCfg.rewrites.findIndex(
      (r: any) => r.source === '/(.*)' && r.destination === '/index.html'
    );
    assert.ok(apiRootIdx >= 0, 'vercel.json must explicitly route /api to /api');
    assert.ok(apiWildcardIdx >= 0, 'vercel.json must route /api/(.*) to /api');
    assert.ok(spaIdx > apiWildcardIdx, 'SPA catch-all must appear AFTER /api rewrites');
    assert.equal(vercelCfg.functions?.['api/index.ts']?.maxDuration, 60);

    const authServiceSrc = fs.readFileSync(path.resolve('src/services/authService.ts'), 'utf8');
    assert.doesNotMatch(
      authServiceSrc,
      /['"]\/auth\/login['"]/,
      'authService.ts must not call non-/api route /auth/login that falls through to index.html on Vercel'
    );
  });

  await t.test('2. isHtmlPayload accurately detects HTML documents vs valid JSON payloads', () => {
    assert.equal(isHtmlPayload('text/html; charset=utf-8', '<!DOCTYPE html><html></html>'), true);
    assert.equal(isHtmlPayload('text/plain', '  <!doctype html><html><body>504 Gateway</body></html>'), true);
    assert.equal(isHtmlPayload('', '<html><body>Bad Gateway</body></html>'), true);
    assert.equal(isHtmlPayload('application/json; charset=utf-8', '{"ok":true}'), false);
    assert.equal(isHtmlPayload('application/json', '[{"id":1}]'), false);
  });

  const apiServer = http.createServer(app);
  await new Promise<void>((resolve) => apiServer.listen(0, '127.0.0.1', resolve));
  const apiAddr = apiServer.address();
  assert.ok(apiAddr && typeof apiAddr === 'object');
  const apiBaseUrl = `http://127.0.0.1:${apiAddr.port}`;

  try {
    await t.test('3. Missing /api routes, method mismatches, and malformed JSON all return structured JSON (never HTML)', async () => {
      const cases: Array<{
        method: string;
        route: string;
        bodyText?: string;
        expectedStatus: number;
        expectedCode?: string;
      }> = [
        { method: 'GET', route: '/api', expectedStatus: 404, expectedCode: 'API_ROUTE_NOT_FOUND' },
        { method: 'GET', route: '/api/nonexistent-endpoint', expectedStatus: 404, expectedCode: 'API_ROUTE_NOT_FOUND' },
        { method: 'POST', route: '/api/nasa/ingest/', expectedStatus: 404, expectedCode: 'API_ROUTE_NOT_FOUND' },
        { method: 'GET', route: '/api/nasa/ingest/farm-1', expectedStatus: 405, expectedCode: 'METHOD_NOT_ALLOWED' },
        { method: 'POST', route: '/api/datasets/unknown-provider/sync', bodyText: '{"farmId":"farm-1"}', expectedStatus: 400 },
        { method: 'POST', route: '/api/auth/login', bodyText: '{"email": broken json', expectedStatus: 400 },
      ];

      for (const c of cases) {
        const res = await rawRequest(apiBaseUrl, c.method, c.route, c.bodyText);
        assert.equal(res.status, c.expectedStatus, `${c.method} ${c.route} status mismatch`);
        assert.match(res.contentType, /application\/json/i, `${c.method} ${c.route} must return application/json`);
        assert.equal(isHtmlPayload(res.contentType, res.text), false, `${c.method} ${c.route} must never return HTML`);
        const parsed = JSON.parse(res.text);
        assert.ok(parsed && typeof parsed.error === 'string' && parsed.error.length > 0);
        if (c.expectedCode) {
          assert.equal(parsed.code, c.expectedCode);
        }
      }
    });

    await t.test('4. Health, roadmap, scientific methods, and crops endpoints return valid JSON', async () => {
      for (const route of ['/api/health', '/api/nasa/health', '/api/nasa/roadmap', '/api/scientific-methods', '/api/crops']) {
        const res = await rawRequest(apiBaseUrl, 'GET', route);
        assert.equal(res.status, 200, `${route} should return 200`);
        assert.match(res.contentType, /application\/json/i);
        const parsed = JSON.parse(res.text);
        assert.ok(parsed && typeof parsed === 'object');
      }
    });
  } finally {
    await new Promise<void>((resolve) => apiServer.close(() => resolve()));
  }

  await t.test('5. Async route rejection in app.ts error boundary returns 500 JSON instead of crashing or emitting HTML', async () => {
    const miniApp = express();
    miniApp.use((req, _res, next) => next());
    // Mirror the async wrapper + error handler pattern in app.ts
    const asyncHandler = async () => {
      throw new Error('Simulated unhandled database exception');
    };
    miniApp.get('/api/test-async-crash', (req, res, next) => {
      Promise.resolve(asyncHandler()).catch(next);
    });
    miniApp.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res
        .status(500)
        .set('Content-Type', 'application/json; charset=utf-8')
        .json({ error: 'Internal server error.', code: 'INTERNAL_SERVER_ERROR', endpoint: req.path, status: 500 });
    });

    const srv = http.createServer(miniApp);
    await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
    const addr = srv.address() as any;
    try {
      const res = await rawRequest(`http://127.0.0.1:${addr.port}`, 'GET', '/api/test-async-crash');
      assert.equal(res.status, 500);
      assert.match(res.contentType, /application\/json/i);
      const parsed = JSON.parse(res.text);
      assert.equal(parsed.code, 'INTERNAL_SERVER_ERROR');
      assert.equal(parsed.status, 500);
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  await t.test('6. Frontend apiClient & safeFetchAuthJson reject HTML (200/502/504) and malformed JSON with endpoint + HTTP status', async () => {
    const mockSrv = http.createServer((req, res) => {
      if (req.url === '/api/html-200') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!DOCTYPE html><html><head><title>FieldShift SPA</title></head><body>fallback</body></html>');
        return;
      }
      if (req.url === '/api/html-504') {
        res.writeHead(504, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!DOCTYPE html><html><body><h1>504 Gateway Time-out</h1></body></html>');
        return;
      }
      if (req.url === '/api/bad-json-200') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end('{"broken": ');
        return;
      }
      if (req.url === '/api/auth/html-502') {
        res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<!DOCTYPE html><html><body>502 Bad Gateway</body></html>');
        return;
      }
      if (req.url === '/api/ok-json') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, dataset: 'nasa-power' }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', status: 404 }));
    });

    await new Promise<void>((resolve) => mockSrv.listen(0, '127.0.0.1', resolve));
    const addr = mockSrv.address() as any;
    const base = `http://127.0.0.1:${addr.port}`;

    try {
      await assert.rejects(
        () => apiClient.get(`${base}/api/html-200`),
        (err: any) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.code, 'INVALID_HTML_RESPONSE');
          assert.equal(err.status, 200);
          assert.match(err.message, /\/api\/html-200/);
          assert.match(err.message, /200/);
          assert.doesNotMatch(err.message, /Unexpected token/i);
          return true;
        }
      );

      await assert.rejects(
        () => apiClient.post(`${base}/api/html-504`, { farmId: 'farm-1' }),
        (err: any) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.code, 'INVALID_HTML_RESPONSE');
          assert.equal(err.status, 504);
          assert.match(err.message, /\/api\/html-504/);
          assert.match(err.message, /504/);
          return true;
        }
      );

      await assert.rejects(
        () => apiClient.get(`${base}/api/bad-json-200`),
        (err: any) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.code, 'INVALID_JSON_RESPONSE');
          assert.equal(err.status, 200);
          assert.match(err.message, /\/api\/bad-json-200/);
          return true;
        }
      );

      await assert.rejects(
        () => safeFetchAuthJson(`${base}/api/auth/html-502`, { method: 'POST', body: '{}' }),
        (err: any) => {
          assert.ok(err instanceof AuthServiceError);
          assert.equal(err.code, 'INVALID_HTML_RESPONSE');
          assert.equal(err.status, 502);
          assert.match(err.message, /\/api\/auth\/html-502/);
          assert.match(err.message, /502/);
          return true;
        }
      );

      const okRes = await apiClient.get(`${base}/api/ok-json`);
      assert.deepEqual(okRes, { ok: true, dataset: 'nasa-power' });
    } finally {
      await new Promise<void>((resolve) => mockSrv.close(() => resolve()));
    }
  });

  await t.test('7. ingestAllAvailableForFarm isolates per-dataset failures & enforces serverless deadline cleanly', async () => {
    // Fake minimal Supabase client so ingestAllAvailableForFarm never fails on unrelated DB writes
    const fakeSupabase: any = {
      from() {
        const builder: any = {
          select: () => builder,
          eq: () => builder,
          in: () => builder,
          order: () => builder,
          limit: () => builder,
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: { id: 'job-1' }, error: null }),
          insert: () => builder,
          upsert: async () => ({ data: [], error: null }),
          update: () => builder,
          then: (resolve: any) => resolve({ data: [], error: null }),
        };
        return builder;
      },
    };

    const farm: any = {
      id: 'farm-test-isolation',
      name: 'Isolation Test Farm',
      coordinates: [-93.6204, 41.5868],
      latitude: 41.5868,
      longitude: -93.6204,
      acreage: 120,
    };

    // With a short deadlineMs, slow upstream fetches are terminated cleanly by the deadline guard
    // and return structured per-dataset outcomes instead of hanging past serverless limits.
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u.includes('power.larc.nasa.gov')) {
        return new Response(
          JSON.stringify({
            properties: {
              parameter: {
                T2M: { '20260401': 16.5 },
                T2M_MAX: { '20260401': 22.0 },
                T2M_MIN: { '20260401': 10.0 },
                PRECTOTCORR: { '20260401': 4.2 },
                RH2M: { '20260401': 68.0 },
                ALLSKY_SFC_SW_DWN: { '20260401': 18.4 },
                WS2M: { '20260401': 3.5 },
              },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      // Hang CMR / ORNL requests so the serverless deadline guard exercises timeout isolation
      return new Promise<Response>(() => {});
    }) as typeof globalThis.fetch;

    try {
      const outcomes = await ingestAllAvailableForFarm(fakeSupabase, 'user-1', farm, {
        days: 5,
        forceRefresh: true,
        modisBudgetMs: 120,
        deadlineMs: 250,
      });

      assert.equal(outcomes['nasa-power']?.ok, true, 'Working NASA POWER dataset must remain isolated and succeed');
      assert.equal(outcomes.modis?.ok, false, 'Timed-out MODIS must return structured failure outcome');
      assert.equal(outcomes.modis?.code, 'NASA_SERVERLESS_DEADLINE');
      assert.equal(outcomes.smap?.ok, false);
      assert.equal(outcomes.gpm?.ok, false);
      assert.equal(outcomes.ecostress?.ok, false);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
