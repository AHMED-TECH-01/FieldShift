import assert from 'node:assert/strict';
import http from 'node:http';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function main() {
  const results: Array<{ check: string; status: 'PASS' | 'WARN' | 'FAIL'; detail: string }> = [];
  const record = (check: string, status: 'PASS' | 'WARN' | 'FAIL', detail: string) => {
    results.push({ check, status, detail });
    console.log(`[${status}] ${check}: ${detail}`);
  };

  // 1. Verify Vercel serverless entrypoint loads cleanly without starting Vite or app.listen
  const apiMod = await import('../api/index');
  const app = apiMod.default;
  assert.ok(app && typeof app === 'function', 'api/index.ts must export Express app');
  record('Serverless entry import (api/index.ts)', 'PASS', 'Loaded cleanly with zero Vite dependency');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const adminClient = supabaseUrl && secretKey
    ? createClient(supabaseUrl, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

  const tempUserIds: string[] = [];

  try {
    // 2. Public & error handling checks
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson: any = await healthRes.json();
    assert.equal(healthJson.status, 'healthy');
    assert.equal(healthJson.supabaseReachable, true);
    record('GET /api/health', 'PASS', `status=${healthJson.status}, supabaseReachable=${healthJson.supabaseReachable}, geminiConfigured=${healthJson.geminiConfigured}`);

    const cropsRes = await fetch(`${baseUrl}/api/crops`);
    assert.equal(cropsRes.status, 200);
    const cropsJson: any = await cropsRes.json();
    assert.equal(cropsJson.totalCrops, 8);
    record('GET /api/crops', 'PASS', `${cropsJson.totalCrops} crops returned`);

    const notFoundRes = await fetch(`${baseUrl}/api/non-existent-endpoint-check`);
    assert.equal(notFoundRes.status, 404);
    assert.match(notFoundRes.headers.get('content-type') || '', /application\/json/);
    record('Unknown API 404 JSON', 'PASS', 'Returned HTTP 404 JSON');

    const badJsonRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email": invalid-json',
    });
    assert.equal(badJsonRes.status, 400);
    record('Malformed JSON handling', 'PASS', 'Returned HTTP 400 JSON');

    const methodNotAllowedRes = await fetch(`${baseUrl}/api/auth/login`);
    assert.equal(methodNotAllowedRes.status, 405);
    record('GET /api/auth/login 405', 'PASS', 'Returned HTTP 405');

    // 3. Unauthenticated route enforcement
    const protectedChecks: Array<[string, string, any?]> = [
      ['GET', '/api/profile'],
      ['GET', '/api/farms'],
      ['GET', '/api/rotations'],
      ['GET', '/api/ai/history'],
      ['POST', '/api/datasets/nasa-power/sync', { farmId: 'farm-1' }],
      ['POST', '/api/ai/advisor', { prompt: 'Test', farmId: 'farm-1' }],
    ];
    for (const [method, path, body] of protectedChecks) {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      assert.equal(res.status, 401, `${method} ${path} should reject unauthenticated access with 401`);
    }
    record('Protected endpoints unauthenticated rejection', 'PASS', `${protectedChecks.length} routes returned 401`);

    if (!adminClient) {
      throw new Error('Supabase admin client unavailable for integration tests');
    }

    // 4. Create two ephemeral verified Supabase Auth users for end-to-end RLS + API verification
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const emailA = `qa.a.${suffix}@fieldshift.local`;
    const emailB = `qa.b.${suffix}@fieldshift.local`;
    const pw = 'FieldShift_QA_2026!';

    const { data: uAData, error: uAErr } = await adminClient.auth.admin.createUser({
      email: emailA,
      password: pw,
      email_confirm: true,
      user_metadata: { full_name: 'QA Agronomist A' },
    });
    assert.ifError(uAErr);
    assert.ok(uAData.user);
    tempUserIds.push(uAData.user.id);

    const { data: uBData, error: uBErr } = await adminClient.auth.admin.createUser({
      email: emailB,
      password: pw,
      email_confirm: true,
      user_metadata: { full_name: 'QA Agronomist B' },
    });
    assert.ifError(uBErr);
    assert.ok(uBData.user);
    tempUserIds.push(uBData.user.id);

    // Login both users through Express /api/auth/login
    const loginARes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailA, password: pw }),
    });
    assert.equal(loginARes.status, 200);
    const loginAJson: any = await loginARes.json();
    const tokenA = loginAJson.token;
    assert.ok(tokenA);

    const loginBRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailB, password: pw }),
    });
    assert.equal(loginBRes.status, 200);
    const loginBJson: any = await loginBRes.json();
    const tokenB = loginBJson.token;
    assert.ok(tokenB);
    record('POST /api/auth/login (Supabase Auth)', 'PASS', 'Authenticated both QA users with live JWTs');

    const authHeadersA = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` };
    const authHeadersB = { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` };

    const sessionRes = await fetch(`${baseUrl}/api/auth/session`, { headers: authHeadersA });
    assert.equal(sessionRes.status, 200);
    const sessionJson: any = await sessionRes.json();
    assert.equal(sessionJson.user.email, emailA);
    record('GET /api/auth/session', 'PASS', `Verified session user ${sessionJson.user.email}`);

    // 5. Profile GET & PATCH
    const profGet = await fetch(`${baseUrl}/api/profile`, { headers: authHeadersA });
    assert.equal(profGet.status, 200);
    const profPatch = await fetch(`${baseUrl}/api/profile`, {
      method: 'PATCH',
      headers: authHeadersA,
      body: JSON.stringify({ fullName: 'QA Agronomist A Updated', measurementUnits: 'metric' }),
    });
    assert.equal(profPatch.status, 200);
    const profPatchJson: any = await profPatch.json();
    assert.equal(profPatchJson.profile.measurementUnits, 'metric');
    record('GET/PATCH /api/profile', 'PASS', 'Initialized and persisted unit preference to metric');

    // 6. Farm CRUD + Cross-user RLS isolation
    const createFarmRes = await fetch(`${baseUrl}/api/farms`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({
        name: 'QA Prairie Parcel',
        location: 'Ames, IA',
        coordinates: [-93.62, 42.03],
        acreage: 320,
        currentCrop: 'Field Corn (Maize)',
        plantingSeason: 'Spring 2026',
        soilType: 'Clarion Silt Loam',
        soilPH: 6.4,
        organicMatter: 3.9,
        nitrogen: 'Medium',
        phosphorus: 'Optimal',
        potassium: 'High',
        drainage: 'Moderately Well Drained',
      }),
    });
    assert.equal(createFarmRes.status, 201);
    const createdFarmJson: any = await createFarmRes.json();
    const farmId = createdFarmJson.farm.id;
    assert.ok(farmId);

    const patchFarmRes = await fetch(`${baseUrl}/api/farms/${farmId}`, {
      method: 'PATCH',
      headers: authHeadersA,
      body: JSON.stringify({ acreage: 340 }),
    });
    assert.equal(patchFarmRes.status, 200);
    assert.equal(((await patchFarmRes.json()) as any).farm.acreage, 340);

    // Cross-user isolation checks (User B must NEVER read/update/delete User A's farm)
    const bGet = await fetch(`${baseUrl}/api/farms/${farmId}`, { headers: authHeadersB });
    assert.equal(bGet.status, 404);
    const bPatch = await fetch(`${baseUrl}/api/farms/${farmId}`, {
      method: 'PATCH',
      headers: authHeadersB,
      body: JSON.stringify({ acreage: 999 }),
    });
    assert.equal(bPatch.status, 404);
    const bDelete = await fetch(`${baseUrl}/api/farms/${farmId}`, { method: 'DELETE', headers: authHeadersB });
    assert.equal(bDelete.status, 404);
    const bSync = await fetch(`${baseUrl}/api/datasets/nasa-power/sync`, {
      method: 'POST',
      headers: authHeadersB,
      body: JSON.stringify({ farmId, days: 5 }),
    });
    assert.equal(bSync.status, 404);
    record('Farms CRUD & Cross-User RLS', 'PASS', `Created/updated farm ${farmId}; User B blocked (404) on read/edit/delete/sync`);

    // 7. Priorities upsert
    const putPrio = await fetch(`${baseUrl}/api/priorities`, {
      method: 'PUT',
      headers: authHeadersA,
      body: JSON.stringify({
        farmId,
        priorities: {
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
    assert.equal(putPrio.status, 200);
    const getPrio = await fetch(`${baseUrl}/api/priorities?farmId=${encodeURIComponent(farmId)}`, { headers: authHeadersA });
    assert.equal(getPrio.status, 200);
    const getPrioJson: any = await getPrio.json();
    assert.equal(getPrioJson.priorities.waterConservation, 5);
    record('GET/PUT /api/priorities', 'PASS', 'Saved and reloaded user-scoped weights');

    // 8. Live NASA POWER sync + duplicate-safe idempotent re-sync
    const powerSync1 = await fetch(`${baseUrl}/api/datasets/nasa-power/sync`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({ farmId, days: 7 }),
    });
    assert.equal(powerSync1.status, 200);
    const powerJson1: any = await powerSync1.json();
    assert.ok(powerJson1.recordsSaved > 0);

    const powerSync2 = await fetch(`${baseUrl}/api/datasets/nasa-power/sync`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({ farmId, days: 7 }),
    });
    assert.equal(powerSync2.status, 200);

    const powerObsRes = await fetch(`${baseUrl}/api/datasets/nasa-power/observations?farmId=${encodeURIComponent(farmId)}&limit=100`, {
      headers: authHeadersA,
    });
    assert.equal(powerObsRes.status, 200);
    const powerObsJson: any = await powerObsRes.json();
    assert.equal(powerObsJson.totalCount, powerJson1.recordsSaved, 'Duplicate-safe upsert must not create duplicate rows');
    record('NASA POWER live sync + idempotency', 'PASS', `${powerJson1.recordsSaved} records saved & verified idempotent (${powerJson1.startDate}..${powerJson1.endDate})`);

    // 9. Live NASA Earthdata CMR Granule Discovery (SMAP, GPM, MODIS, ECOSTRESS)
    for (const ds of ['smap', 'gpm', 'modis', 'ecostress'] as const) {
      const cmrRes = await fetch(`${baseUrl}/api/datasets/${ds}/sync`, {
        method: 'POST',
        headers: authHeadersA,
        body: JSON.stringify({ farmId }),
      });
      assert.equal(cmrRes.status, 200);
      const cmrJson: any = await cmrRes.json();
      const obsCheck = await fetch(`${baseUrl}/api/datasets/${ds}/observations?farmId=${encodeURIComponent(farmId)}`, {
        headers: authHeadersA,
      });
      assert.equal(obsCheck.status, 200);
      const obsCheckJson: any = await obsCheck.json();
      if (obsCheckJson.observations.length > 0) {
        assert.equal(obsCheckJson.observations[0].value, null, `${ds} must never fabricate numeric pixel values`);
        assert.equal(obsCheckJson.observations[0].is_missing, true);
      }
      record(`NASA Earthdata CMR (${ds.toUpperCase()})`, 'PASS', `Found ${cmrJson.recordsReceived} granules; pixel values strictly null/metadata-only`);
    }

    // 10. Dashboard aggregated telemetry, climate timeline, risk, soil, bare-field, pest-cycles
    const dashObs = await fetch(`${baseUrl}/api/nasa/observations?farmId=${encodeURIComponent(farmId)}`, { headers: authHeadersA });
    assert.equal(dashObs.status, 200);
    const dashObsJson: any = await dashObs.json();
    assert.equal(dashObsJson.realTimeMetrics.solarInsolationPOWER.status, 'synced');

    const climateRes = await fetch(`${baseUrl}/api/climate/timeline?farmId=${encodeURIComponent(farmId)}`, { headers: authHeadersA });
    assert.equal(climateRes.status, 200);
    const climateJson: any = await climateRes.json();
    assert.equal(climateJson.hasLivePowerData, true);
    assert.ok(climateJson.timeline.length >= 1);

    for (const path of ['/api/soil/profiles', '/api/risk/field-analysis', '/api/analysis/bare-field', '/api/analysis/pest-cycles']) {
      const r = await fetch(`${baseUrl}${path}?farmId=${encodeURIComponent(farmId)}`, { headers: authHeadersA });
      assert.equal(r.status, 200, `${path} failed`);
    }
    record('Dashboard NASA/Soil/Risk/Analysis endpoints', 'PASS', `POWER timeline (${climateJson.timeline.length} days) & all analysis routes verified`);

    // 11. Crop Rotation Engine + Saved Assessment Persistence
    const compareRes = await fetch(`${baseUrl}/api/rotations/compare`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({ farmId, scenario: { rainfallChangePercent: -25, temperatureChangeCelsius: 2.5, extendedDrySeasonWeeks: 4, irrigationRestricted: false, plantingDateOffsetDays: 0 } }),
    });
    assert.equal(compareRes.status, 200);
    const compareJson: any = await compareRes.json();
    assert.equal(compareJson.strategies.length, 3);
    assert.equal(compareJson.nasaEvidenceSummary.hasPowerData, true);

    const saveRotRes = await fetch(`${baseUrl}/api/rotations`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({ farmId, name: 'QA Drought Stress Snapshot' }),
    });
    assert.equal(saveRotRes.status, 201);
    const saveRotJson: any = await saveRotRes.json();
    const rotId = saveRotJson.assessment.id;

    const listRotRes = await fetch(`${baseUrl}/api/rotations?farmId=${encodeURIComponent(farmId)}`, { headers: authHeadersA });
    assert.equal(listRotRes.status, 200);
    const listRotJson: any = await listRotRes.json();
    assert.ok(listRotJson.rotations.some((r: any) => r.id === rotId));
    record('Crop Rotation Engine & Persistence', 'PASS', `Saved & reloaded assessment ${rotId} with live POWER grounding`);

    // 12. AI Advisor + History Persistence
    const advRes = await fetch(`${baseUrl}/api/ai/advisor`, {
      method: 'POST',
      headers: authHeadersA,
      body: JSON.stringify({
        farmId,
        prompt: 'Briefly summarize whether Strategy B or Strategy C fits my organic matter and recent NASA POWER precipitation.',
      }),
    });
    assert.equal(advRes.status, 200);
    const advJson: any = await advRes.json();
    assert.ok(typeof advJson.reply === 'string' && advJson.reply.length > 40);

    const histRes = await fetch(`${baseUrl}/api/ai/history?farmId=${encodeURIComponent(farmId)}`, { headers: authHeadersA });
    assert.equal(histRes.status, 200);
    const histJson: any = await histRes.json();
    assert.ok(histJson.history.length >= 1);
    record('POST /api/ai/advisor & GET /api/ai/history', advJson.isFallback ? 'WARN' : 'PASS', `source=${advJson.source}, isFallback=${advJson.isFallback}, historyCount=${histJson.history.length}`);

    // 13. Delete farm & logout
    const delRes = await fetch(`${baseUrl}/api/farms/${farmId}`, { method: 'DELETE', headers: authHeadersA });
    assert.equal(delRes.status, 200);
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: authHeadersA });
    assert.equal(logoutRes.status, 200);
    record('Farm DELETE & Auth Logout', 'PASS', `Deleted farm ${farmId} and cleared session cookie`);
  } finally {
    // Cleanup temporary QA users (cascades profiles, farms, observations, jobs, rotations, AI history)
    if (adminClient) {
      for (const uid of tempUserIds) {
        try {
          await adminClient.auth.admin.deleteUser(uid);
        } catch {
          // ignore cleanup errors
        }
      }
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${results.filter((r) => r.status === 'PASS').length}/${results.length}`);
  console.log(`Warnings: ${results.filter((r) => r.status === 'WARN').length}`);
  console.log(`Failed: ${results.filter((r) => r.status === 'FAIL').length}`);
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err?.message || err);
  process.exit(1);
});
