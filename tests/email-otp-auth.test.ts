import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * Local GoTrue (/auth/v1/*) + PostgREST (/rest/v1/*) harness specifically
 * exercising 6-digit Email OTP signup verification, resend cooldown/rate-limiting,
 * empty-identities duplicate protection, unconfirmed login gating, and backend
 * Bearer token acceptance end-to-end.
 */
function createOtpSupabaseHarness() {
  const ANON_KEY = 'test-publishable-key';
  const SECRET_KEY = 'test-secret-role-key';

  interface SimUser {
    id: string;
    email: string;
    password: string;
    fullName: string;
    emailConfirmedAt: string | null;
    otpCode: string;
    otpExpiresAt: number;
    resendCount: number;
  }

  const users = new Map<string, SimUser>();
  const tokens = new Map<string, { userId: string; exp: number }>();

  let signupCalls: Array<{ email: string; hasEmailRedirectTo: boolean }> = [];
  let verifyCalls: Array<{ email: string; token: string; type: string }> = [];
  let resendCalls: Array<{ email: string; type: string }> = [];
  let forceDuplicateAsEmptyIdentities = false;
  let forceResendRateLimit = false;

  const farms = [
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
  ];
  const profiles: any[] = [];
  const priorities: any[] = [];

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
    }
    return { role: 'anon', userId: null };
  }

  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const ch of req) chunks.push(ch as Buffer);
    const bodyText = Buffer.concat(chunks).toString('utf8');
    const body = bodyText ? JSON.parse(bodyText) : {};

    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = url.pathname;
    const sendJson = (status: number, data: any) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    if (pathname === '/auth/v1/signup' && req.method === 'POST') {
      const email = String(body.email || '').toLowerCase();
      signupCalls.push({
        email,
        hasEmailRedirectTo: Boolean(url.searchParams.get('redirect_to') || body.gotrue_meta_security?.email_redirect_to || body.email_redirect_to),
      });

      if (users.has(email)) {
        if (forceDuplicateAsEmptyIdentities) {
          return sendJson(200, {
            id: users.get(email)!.id,
            email,
            identities: [],
            user: {
              id: users.get(email)!.id,
              email,
              identities: [],
            },
            session: null,
          });
        }
        return sendJson(422, {
          error_code: 'user_already_exists',
          msg: 'User already registered',
          error_description: 'User already registered',
        });
      }

      const otpCode = String(Math.floor(100000 + Math.random() * 900000));
      const user: SimUser = {
        id: crypto.randomUUID(),
        email,
        password: String(body.password || ''),
        fullName: String(body.data?.full_name || email.split('@')[0]),
        emailConfirmedAt: null,
        otpCode,
        otpExpiresAt: Date.now() + 10 * 60_000,
        resendCount: 0,
      };
      users.set(email, user);

      // GoTrue response format when Confirm Email is ON (user returned, session is null)
      return sendJson(200, {
        id: user.id,
        email: user.email,
        email_confirmed_at: null,
        identities: [{ id: crypto.randomUUID(), provider: 'email' }],
        user_metadata: { full_name: user.fullName },
        user: {
          id: user.id,
          email: user.email,
          email_confirmed_at: null,
          identities: [{ id: crypto.randomUUID(), provider: 'email' }],
          user_metadata: { full_name: user.fullName },
        },
        session: null,
      });
    }

    if (pathname === '/auth/v1/resend' && req.method === 'POST') {
      const email = String(body.email || '').toLowerCase();
      const type = String(body.type || 'signup');
      resendCalls.push({ email, type });

      if (forceResendRateLimit) {
        return sendJson(429, {
          error_code: 'over_email_send_rate_limit',
          msg: 'For security purposes, you can only request this after 60 seconds.',
        });
      }

      const user = users.get(email);
      if (!user) {
        return sendJson(200, {});
      }
      user.otpCode = String(Math.floor(100000 + Math.random() * 900000));
      user.otpExpiresAt = Date.now() + 10 * 60_000;
      user.resendCount += 1;
      return sendJson(200, { message_id: crypto.randomUUID() });
    }

    if (pathname === '/auth/v1/verify' && req.method === 'POST') {
      const email = String(body.email || '').toLowerCase();
      const token = String(body.token || '');
      const type = String(body.type || '');
      verifyCalls.push({ email, token, type });

      const user = users.get(email);
      if (!user) {
        return sendJson(403, { error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      }
      if (user.otpExpiresAt <= Date.now()) {
        return sendJson(403, { error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      }
      if (user.otpCode !== token) {
        return sendJson(403, { error_code: 'otp_disabled', msg: 'Token has expired or is invalid' });
      }

      user.emailConfirmedAt = new Date().toISOString();
      const accessToken = issueJwtForUser(user.id);
      const userPayload = {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.emailConfirmedAt,
        confirmed_at: user.emailConfirmedAt,
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
        return sendJson(400, {
          error_code: 'email_not_confirmed',
          error: 'invalid_grant',
          error_description: 'Email not confirmed',
        });
      }
      const accessToken = issueJwtForUser(user.id);
      const userPayload = {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.emailConfirmedAt,
        confirmed_at: user.emailConfirmedAt,
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
        confirmed_at: user.emailConfirmedAt,
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

    // Minimal PostgREST tables for /api/farms, /api/profile, /api/rotations
    if (pathname.startsWith('/rest/v1/')) {
      const table = pathname.slice('/rest/v1/'.length);
      const caller = resolveCaller(req);
      const wantsSingle = String(req.headers.accept || '').includes('application/vnd.pgrst.object+json');
      if (req.method === 'GET') {
        if (table === 'farms') {
          const rows =
            caller.role === 'authenticated'
              ? farms.filter((f) => f.is_demo || f.user_id === caller.userId)
              : farms.filter((f) => f.is_demo);
          return sendJson(200, wantsSingle ? rows[0] : rows);
        }
        if (table === 'profiles') {
          const rows = caller.role === 'authenticated' ? profiles.filter((p) => p.id === caller.userId) : [];
          if (wantsSingle && rows.length !== 1) {
            return sendJson(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
          }
          return sendJson(200, wantsSingle ? rows[0] : rows);
        }
        if (table === 'farmer_priorities') {
          const rows = caller.role === 'authenticated' ? priorities.filter((p) => p.user_id === caller.userId) : [];
          if (wantsSingle && rows.length !== 1) {
            return sendJson(406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
          }
          return sendJson(200, wantsSingle ? rows[0] : rows);
        }
        return sendJson(200, []);
      }
      if (req.method === 'POST') {
        if (caller.role === 'anon') return sendJson(403, { message: 'RLS violation' });
        const row = Array.isArray(body) ? body[0] : body;
        if (table === 'profiles') {
          const idx = profiles.findIndex((p) => p.id === row.id);
          if (idx >= 0) profiles[idx] = { ...profiles[idx], ...row };
          else profiles.push(row);
          return sendJson(201, wantsSingle ? row : [row]);
        }
        if (table === 'farmer_priorities') {
          priorities.push(row);
          return sendJson(201, wantsSingle ? row : [row]);
        }
        return sendJson(201, wantsSingle ? row : [row]);
      }
    }

    sendJson(404, { error: 'Not found' });
  });

  return {
    ANON_KEY,
    SECRET_KEY,
    users,
    get signupCalls() {
      return signupCalls;
    },
    get verifyCalls() {
      return verifyCalls;
    },
    get resendCalls() {
      return resendCalls;
    },
    setForceDuplicateAsEmptyIdentities(val: boolean) {
      forceDuplicateAsEmptyIdentities = val;
    },
    setForceResendRateLimit(val: boolean) {
      forceResendRateLimit = val;
    },
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

test('Email OTP Signup, Verification, Resend, Google OAuth & Backend Integration Suite', async (t) => {
  const savedEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  };

  const supaHarness = createOtpSupabaseHarness();
  const supaUrl = await supaHarness.start();

  process.env.SUPABASE_URL = supaUrl;
  process.env.VITE_SUPABASE_URL = supaUrl;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = supaHarness.ANON_KEY;
  process.env.SUPABASE_SECRET_KEY = supaHarness.SECRET_KEY;

  const { default: app } = await import('../api/index.js');
  const expressServer = http.createServer(app);
  await new Promise<void>((resolve) => expressServer.listen(0, '127.0.0.1', resolve));
  const expressAddr = expressServer.address();
  assert.ok(expressAddr && typeof expressAddr === 'object');
  const baseUrl = `http://127.0.0.1:${expressAddr.port}`;

  const { setSupabaseClientForTesting } = await import('../src/lib/supabase.js');
  const { authService, AuthServiceError } = await import('../src/services/authService.js');
  const { apiClient } = await import('../src/services/apiClient.js');

  const storageMap = new Map<string, string>();
  const prevLocalStorage = (globalThis as any).localStorage;
  const prevWindow = (globalThis as any).window;
  (globalThis as any).localStorage = {
    getItem: (k: string) => (storageMap.has(k) ? storageMap.get(k)! : null),
    setItem: (k: string, v: string) => storageMap.set(k, String(v)),
    removeItem: (k: string) => storageMap.delete(k),
  };
  (globalThis as any).window = {
    location: { origin: 'https://field-shift-sable.vercel.app' },
  };

  const memoryStore = new Map<string, string>();
  const browserSupabaseClient = createClient(supaUrl, supaHarness.ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (k) => memoryStore.get(k) ?? null,
        setItem: (k, v) => {
          memoryStore.set(k, v);
        },
        removeItem: (k) => {
          memoryStore.delete(k);
        },
      },
    },
  });
  setSupabaseClientForTesting(browserSupabaseClient);

  try {
    const testEmail = 'new.grower@fieldshift.test';
    const testPassword = 'FieldShift_OTP_2026!';

    await t.test('1. New email signup dispatches OTP without emailRedirectTo and returns autoConfirmed=false', async () => {
      const res = await authService.register({
        email: testEmail,
        fullName: 'New Grower',
        password: testPassword,
      });

      assert.equal(res.success, true);
      assert.equal(res.autoConfirmed, false);
      assert.equal(res.token, undefined);
      assert.equal(storageMap.get('fieldshift_token'), undefined);

      const recorded = supaHarness.signupCalls.find((c) => c.email === testEmail);
      assert.ok(recorded);
      assert.equal(recorded.hasEmailRedirectTo, false, 'signUp must not send emailRedirectTo for OTP flow');

      const simUser = supaHarness.users.get(testEmail);
      assert.ok(simUser);
      assert.equal(simUser.emailConfirmedAt, null);
      assert.match(simUser.otpCode, /^\d{6}$/);
    });

    await t.test('2. Unverified user cannot log in yet and receives EMAIL_NOT_CONFIRMED', async () => {
      await assert.rejects(
        () => authService.login(testEmail, testPassword),
        (err: any) => err instanceof AuthServiceError && err.code === 'EMAIL_NOT_CONFIRMED'
      );
      assert.equal(storageMap.get('fieldshift_token'), undefined);
    });

    await t.test('3. Duplicate signup detects both empty identities[] and user_already_exists error', async () => {
      supaHarness.setForceDuplicateAsEmptyIdentities(true);
      await assert.rejects(
        () => authService.register({ email: testEmail, fullName: 'Duplicate', password: testPassword }),
        (err: any) => err instanceof AuthServiceError && err.code === 'USER_ALREADY_EXISTS'
      );

      supaHarness.setForceDuplicateAsEmptyIdentities(false);
      await assert.rejects(
        () => authService.register({ email: testEmail, fullName: 'Duplicate', password: testPassword }),
        (err: any) => err instanceof AuthServiceError && err.code === 'USER_ALREADY_EXISTS'
      );
    });

    await t.test('4. Invalid OTP formats and incorrect 6-digit codes are rejected without establishing a session', async () => {
      await assert.rejects(
        () => authService.verifyOtp(testEmail, '1234'),
        (err: any) => err instanceof AuthServiceError && err.code === 'INVALID_OTP_FORMAT'
      );
      await assert.rejects(
        () => authService.verifyOtp(testEmail, '12ab56'),
        (err: any) => err instanceof AuthServiceError && err.code === 'INVALID_OTP_FORMAT'
      );

      const wrongCode = supaHarness.users.get(testEmail)!.otpCode === '000000' ? '999999' : '000000';
      await assert.rejects(
        () => authService.verifyOtp(testEmail, wrongCode),
        (err: any) => err instanceof AuthServiceError && err.code === 'OTP_INVALID'
      );
      assert.equal(storageMap.get('fieldshift_token'), undefined);
    });

    await t.test('5. Expired 6-digit OTP fails cleanly with OTP_EXPIRED', async () => {
      const simUser = supaHarness.users.get(testEmail)!;
      const savedExpiry = simUser.otpExpiresAt;
      simUser.otpExpiresAt = Date.now() - 10_000;

      await assert.rejects(
        () => authService.verifyOtp(testEmail, simUser.otpCode),
        (err: any) => err instanceof AuthServiceError && err.code === 'OTP_EXPIRED'
      );

      simUser.otpExpiresAt = savedExpiry;
    });

    await t.test('6. Resend OTP issues a fresh 6-digit code and surfaces rate-limit errors honestly', async () => {
      const simUser = supaHarness.users.get(testEmail)!;
      const previousOtp = simUser.otpCode;

      supaHarness.setForceResendRateLimit(true);
      await assert.rejects(
        () => authService.resendOtp(testEmail),
        (err: any) => err instanceof AuthServiceError && err.code === 'RATE_LIMITED'
      );
      supaHarness.setForceResendRateLimit(false);

      const resendRes = await authService.resendOtp(testEmail);
      assert.equal(resendRes.success, true);
      assert.equal(simUser.resendCount, 1);
      assert.match(simUser.otpCode, /^\d{6}$/);
      assert.equal(supaHarness.resendCalls.at(-1)?.type, 'signup');
      // Ensure previous OTP variable exists for typecheck
      assert.ok(previousOtp.length === 6);
    });

    await t.test('7. Valid 6-digit OTP verifies signup, establishes Supabase session, and authorizes backend API calls', async () => {
      const latestOtp = supaHarness.users.get(testEmail)!.otpCode;
      const verified = await authService.verifyOtp(testEmail, latestOtp);

      assert.equal(verified.success, true);
      assert.equal(verified.user.email, testEmail);
      assert.equal(verified.user.fullName, 'New Grower');
      assert.equal(verified.user.verified, true);
      assert.ok(verified.token);
      assert.equal(storageMap.get('fieldshift_token'), verified.token);

      const lastVerify = supaHarness.verifyCalls.at(-1);
      assert.deepEqual(lastVerify, { email: testEmail, token: latestOtp, type: 'signup' });

      // Session survives simulated reload via browser Supabase storage
      const restored = await authService.getSession();
      assert.equal(restored.success, true);
      assert.equal(restored.user?.email, testEmail);
      assert.equal(restored.user?.verified, true);

      // Authenticated backend API calls via apiClient work immediately with Bearer token
      const farmsRes = await apiClient.get(`${baseUrl}/api/farms`);
      assert.ok(Array.isArray(farmsRes.farms));
      assert.ok(farmsRes.farms.length >= 1);

      const profileRes = await apiClient.get(`${baseUrl}/api/profile`);
      assert.equal(profileRes.profile.email, testEmail);
    });

    await t.test('8. Google OAuth remains independent and redirects to /dashboard without triggering email OTP', async () => {
      let capturedOAuthArgs: any = null;
      const origSignInWithOAuth = browserSupabaseClient.auth.signInWithOAuth.bind(browserSupabaseClient.auth);
      (browserSupabaseClient.auth as any).signInWithOAuth = async (args: any) => {
        capturedOAuthArgs = args;
        return { data: { provider: 'google', url: `${supaUrl}/auth/v1/authorize?provider=google` }, error: null };
      };

      try {
        const otpCountBefore = supaHarness.resendCalls.length + supaHarness.signupCalls.length;
        await authService.loginWithGoogle('/dashboard');
        assert.equal(capturedOAuthArgs.provider, 'google');
        assert.equal(capturedOAuthArgs.options.redirectTo, 'https://field-shift-sable.vercel.app/dashboard');
        assert.equal(supaHarness.resendCalls.length + supaHarness.signupCalls.length, otpCountBefore);
      } finally {
        (browserSupabaseClient.auth as any).signInWithOAuth = origSignInWithOAuth;
      }
    });

    await t.test('9. Backend /api/auth/* OTP endpoints validate 6-digit codes, unconfirmed 403, and duplicate 409', async () => {
      const apiEmail = 'api.grower@fieldshift.test';

      const reg1 = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: apiEmail, fullName: 'API Grower', password: testPassword }),
      });
      assert.equal(reg1.status, 201);
      const reg1Json: any = await reg1.json();
      assert.equal(reg1Json.autoConfirmed, false);

      const regDup = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: apiEmail, fullName: 'API Grower', password: testPassword }),
      });
      assert.equal(regDup.status, 409);
      assert.equal(((await regDup.json()) as any).code, 'USER_ALREADY_EXISTS');

      const unconfirmedLogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: apiEmail, password: testPassword }),
      });
      assert.equal(unconfirmedLogin.status, 403);
      assert.equal(((await unconfirmedLogin.json()) as any).code, 'EMAIL_NOT_CONFIRMED');

      const badOtpFmt = await fetch(`${baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: apiEmail, code: '1234' }),
      });
      assert.equal(badOtpFmt.status, 400);

      const resendRes = await fetch(`${baseUrl}/api/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: apiEmail }),
      });
      assert.equal(resendRes.status, 200);

      const validOtp = supaHarness.users.get(apiEmail)!.otpCode;
      const verifyOk = await fetch(`${baseUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: apiEmail, code: validOtp }),
      });
      assert.equal(verifyOk.status, 200);
      const verifyJson: any = await verifyOk.json();
      assert.ok(verifyJson.token);
      assert.equal(verifyJson.user.verified, true);
    });
  } finally {
    setSupabaseClientForTesting(undefined);
    (globalThis as any).localStorage = prevLocalStorage;
    (globalThis as any).window = prevWindow;
    await supaHarness.stop();
    expressServer.closeAllConnections?.();
    await new Promise<void>((resolve) => expressServer.close(() => resolve()));

    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
