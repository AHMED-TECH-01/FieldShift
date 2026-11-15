-- FieldShift Migration 005: Secure Email Verification OTP Storage & Atomic Operations
-- Enforces hashed OTP persistence, server-side 10-minute expiration, 60-second resend cooldown,
-- 5-attempt brute-force lockout, single active OTP per user, and strict RLS + service_role RPC isolation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Email Verification OTP Ledger (never stores plaintext codes; RLS deny-all for client roles)
CREATE TABLE IF NOT EXISTS public.email_verification_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  otp_hash text,
  delivery_provider text NOT NULL DEFAULT 'smtp' CHECK (delivery_provider IN ('smtp', 'supabase_auth')),
  delivery_status text NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  delivery_error text,
  status text NOT NULL DEFAULT 'pending_delivery' CHECK (
    status IN ('pending_delivery', 'active', 'used', 'invalidated', 'delivery_failed')
  ),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  cooldown_until timestamptz NOT NULL,
  used_at timestamptz,
  invalidated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_otps_email_created
  ON public.email_verification_otps (LOWER(email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_otps_user_created
  ON public.email_verification_otps (user_id, created_at DESC);

-- Guarantee physically that at most ONE active OTP exists per user at any point in time
DROP INDEX IF EXISTS idx_email_otps_one_active_per_user;
CREATE UNIQUE INDEX idx_email_otps_one_active_per_user
  ON public.email_verification_otps (user_id)
  WHERE status = 'active';

-- Enable strict Row Level Security with NO permissive policies for anon or authenticated roles.
-- Only service_role (backend Express server) and SECURITY DEFINER RPCs may interact with this table.
ALTER TABLE public.email_verification_otps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.email_verification_otps FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.email_verification_otps TO service_role;

-- 2. Atomic Reservation for Issuing/Resending an OTP
-- Does NOT invalidate an existing valid active OTP until email delivery succeeds and activate_email_otp runs.
CREATE OR REPLACE FUNCTION public.reserve_email_otp(
  p_user_id uuid,
  p_email text,
  p_otp_hash text,
  p_delivery_provider text,
  p_ttl_seconds integer DEFAULT 600,
  p_cooldown_seconds integer DEFAULT 60,
  p_max_attempts integer DEFAULT 5,
  p_enforce_cooldown boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_clean_email text := LOWER(TRIM(COALESCE(p_email, '')));
  v_active record;
  v_pending record;
  v_retry_after integer;
  v_new_id uuid;
  v_expires_at timestamptz;
  v_cooldown_until timestamptz;
BEGIN
  IF p_user_id IS NULL OR v_clean_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;

  -- Serialize concurrent issue/resend requests for the same user
  PERFORM pg_advisory_xact_lock(hashtext('otp_issue:' || p_user_id::text));

  -- Reject concurrent in-flight resend reservation within last 15 seconds
  SELECT id, created_at
  INTO v_pending
  FROM public.email_verification_otps
  WHERE user_id = p_user_id
    AND status = 'pending_delivery'
    AND created_at > (v_now - interval '15 seconds')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'RESEND_IN_PROGRESS',
      'retry_after_seconds', GREATEST(1, p_cooldown_seconds)
    );
  END IF;

  -- Check server-side resend cooldown against the latest active OTP (if requested)
  IF p_enforce_cooldown THEN
    SELECT id, cooldown_until, expires_at
    INTO v_active
    FROM public.email_verification_otps
    WHERE user_id = p_user_id
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND AND v_active.cooldown_until > v_now THEN
      v_retry_after := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_active.cooldown_until - v_now)))::integer);
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'COOLDOWN_ACTIVE',
        'retry_after_seconds', v_retry_after,
        'cooldown_until', v_active.cooldown_until
      );
    END IF;
  END IF;

  v_expires_at := v_now + make_interval(secs => GREATEST(60, COALESCE(p_ttl_seconds, 600)));
  v_cooldown_until := v_now + make_interval(secs => GREATEST(0, COALESCE(p_cooldown_seconds, 60)));

  INSERT INTO public.email_verification_otps (
    user_id,
    email,
    otp_hash,
    delivery_provider,
    delivery_status,
    status,
    attempts,
    max_attempts,
    created_at,
    expires_at,
    cooldown_until
  )
  VALUES (
    p_user_id,
    v_clean_email,
    p_otp_hash,
    COALESCE(NULLIF(p_delivery_provider, ''), 'smtp'),
    'pending',
    'pending_delivery',
    0,
    GREATEST(1, COALESCE(p_max_attempts, 5)),
    v_now,
    v_expires_at,
    v_cooldown_until
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'RESERVED',
    'otp_id', v_new_id,
    'created_at', v_now,
    'expires_at', v_expires_at,
    'cooldown_until', v_cooldown_until
  );
END;
$$;

-- 3. Atomically Activate Newly Sent OTP & Invalidate All Prior Active OTPs for the User
CREATE OR REPLACE FUNCTION public.activate_email_otp(
  p_otp_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_row record;
BEGIN
  IF p_otp_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('otp_issue:' || p_user_id::text));

  -- Invalidate any previously active or stale pending OTPs for this user
  UPDATE public.email_verification_otps
  SET status = 'invalidated',
      invalidated_at = v_now
  WHERE user_id = p_user_id
    AND id <> p_otp_id
    AND status IN ('active', 'pending_delivery');

  UPDATE public.email_verification_otps
  SET status = 'active',
      delivery_status = 'sent'
  WHERE id = p_otp_id
    AND user_id = p_user_id
    AND status = 'pending_delivery'
  RETURNING id, email, expires_at, cooldown_until, max_attempts INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'OTP_RESERVATION_MISSING');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'ACTIVATED',
    'otp_id', v_row.id,
    'email', v_row.email,
    'expires_at', v_row.expires_at,
    'cooldown_until', v_row.cooldown_until,
    'max_attempts', v_row.max_attempts
  );
END;
$$;

-- 4. Roll Back Pending Delivery Reservation on Email Provider Failure (preserves prior active OTP)
CREATE OR REPLACE FUNCTION public.abort_email_otp(
  p_otp_id uuid,
  p_error text DEFAULT 'Email delivery failed'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_verification_otps
  SET status = 'delivery_failed',
      delivery_status = 'failed',
      delivery_error = LEFT(COALESCE(p_error, 'Email delivery failed'), 300)
  WHERE id = p_otp_id
    AND status = 'pending_delivery';
END;
$$;

-- 5. Invalidate Active OTPs for a User (e.g., pending email change)
CREATE OR REPLACE FUNCTION public.invalidate_user_otps(
  p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('otp_issue:' || p_user_id::text));

  UPDATE public.email_verification_otps
  SET status = 'invalidated',
      invalidated_at = now()
  WHERE user_id = p_user_id
    AND status IN ('active', 'pending_delivery');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 6. Atomic Verification Attempt (supports 'hash' verification & 'managed_precheck')
CREATE OR REPLACE FUNCTION public.verify_email_otp_attempt(
  p_email text,
  p_otp_hash text DEFAULT NULL,
  p_mode text DEFAULT 'hash'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_clean_email text := LOWER(TRIM(COALESCE(p_email, '')));
  v_active record;
  v_latest record;
  v_used_match boolean := false;
  v_new_attempts integer;
BEGIN
  IF v_clean_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'EMAIL_REQUIRED');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('otp_verify:' || v_clean_email));

  SELECT *
  INTO v_active
  FROM public.email_verification_otps
  WHERE LOWER(email) = v_clean_email
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT status, expires_at, used_at, invalidated_at
    INTO v_latest
    FROM public.email_verification_otps
    WHERE LOWER(email) = v_clean_email
      AND status IN ('used', 'invalidated')
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'OTP_MISSING');
    END IF;

    IF v_latest.status = 'used' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'OTP_ALREADY_USED');
    END IF;

    RETURN jsonb_build_object('ok', false, 'code', 'OTP_INVALIDATED');
  END IF;

  -- Check attempt cap
  IF v_active.attempts >= v_active.max_attempts THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'OTP_TOO_MANY_ATTEMPTS',
      'attempts', v_active.attempts,
      'max_attempts', v_active.max_attempts,
      'remaining_attempts', 0
    );
  END IF;

  -- Check server-side expiration timestamp
  IF v_now > v_active.expires_at THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'OTP_EXPIRED',
      'expires_at', v_active.expires_at
    );
  END IF;

  IF p_mode = 'managed_precheck' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'code', 'PRECHECK_OK',
      'otp_id', v_active.id,
      'user_id', v_active.user_id,
      'attempts', v_active.attempts,
      'max_attempts', v_active.max_attempts,
      'remaining_attempts', GREATEST(0, v_active.max_attempts - v_active.attempts),
      'expires_at', v_active.expires_at
    );
  END IF;

  -- Direct hash verification (atomic single-use)
  IF v_active.otp_hash IS NOT NULL AND p_otp_hash IS NOT NULL AND v_active.otp_hash = p_otp_hash THEN
    UPDATE public.email_verification_otps
    SET status = 'used',
        used_at = v_now,
        attempts = attempts + 1
    WHERE id = v_active.id
      AND status = 'active';

    RETURN jsonb_build_object(
      'ok', true,
      'code', 'VERIFIED',
      'otp_id', v_active.id,
      'user_id', v_active.user_id,
      'email', v_active.email
    );
  END IF;

  -- Incorrect code: increment attempts atomically
  UPDATE public.email_verification_otps
  SET attempts = attempts + 1
  WHERE id = v_active.id
  RETURNING attempts INTO v_new_attempts;

  IF v_new_attempts >= v_active.max_attempts THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'OTP_TOO_MANY_ATTEMPTS',
      'attempts', v_new_attempts,
      'max_attempts', v_active.max_attempts,
      'remaining_attempts', 0
    );
  END IF;

  -- Check if user entered an already-used historical OTP hash
  IF p_otp_hash IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.email_verification_otps
      WHERE user_id = v_active.user_id
        AND otp_hash = p_otp_hash
        AND status = 'used'
    ) INTO v_used_match;

    IF v_used_match THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'OTP_ALREADY_USED',
        'attempts', v_new_attempts,
        'max_attempts', v_active.max_attempts,
        'remaining_attempts', GREATEST(0, v_active.max_attempts - v_new_attempts)
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', false,
    'code', 'OTP_INVALID',
    'attempts', v_new_attempts,
    'max_attempts', v_active.max_attempts,
    'remaining_attempts', GREATEST(0, v_active.max_attempts - v_new_attempts)
  );
END;
$$;

-- 7. Complete Managed-Provider OTP Attempt (records Supabase verifyOtp result atomically)
CREATE OR REPLACE FUNCTION public.complete_managed_email_otp(
  p_otp_id uuid,
  p_email text,
  p_success boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_clean_email text := LOWER(TRIM(COALESCE(p_email, '')));
  v_row record;
  v_new_attempts integer;
BEGIN
  IF p_otp_id IS NULL OR v_clean_email = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('otp_verify:' || v_clean_email));

  SELECT *
  INTO v_row
  FROM public.email_verification_otps
  WHERE id = p_otp_id
    AND LOWER(email) = v_clean_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'OTP_MISSING');
  END IF;

  IF p_success THEN
    IF v_row.status <> 'active' THEN
      RETURN jsonb_build_object('ok', false, 'code', CASE WHEN v_row.status = 'used' THEN 'OTP_ALREADY_USED' ELSE 'OTP_INVALIDATED' END);
    END IF;
    UPDATE public.email_verification_otps
    SET status = 'used',
        used_at = v_now,
        attempts = attempts + 1
    WHERE id = v_row.id;

    RETURN jsonb_build_object('ok', true, 'code', 'VERIFIED', 'user_id', v_row.user_id, 'email', v_row.email);
  END IF;

  UPDATE public.email_verification_otps
  SET attempts = attempts + 1
  WHERE id = v_row.id
  RETURNING attempts INTO v_new_attempts;

  IF v_new_attempts >= v_row.max_attempts THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'OTP_TOO_MANY_ATTEMPTS',
      'attempts', v_new_attempts,
      'max_attempts', v_row.max_attempts,
      'remaining_attempts', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', false,
    'code', 'OTP_INVALID',
    'attempts', v_new_attempts,
    'max_attempts', v_row.max_attempts,
    'remaining_attempts', GREATEST(0, v_row.max_attempts - v_new_attempts)
  );
END;
$$;

-- Restrict RPC execution strictly to service_role (never callable from client anon/authenticated APIs)
REVOKE ALL ON FUNCTION public.reserve_email_otp(uuid, text, text, text, integer, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_email_otp(uuid, text, text, text, integer, integer, integer, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.activate_email_otp(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_email_otp(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.abort_email_otp(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abort_email_otp(uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.invalidate_user_otps(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_user_otps(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.verify_email_otp_attempt(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_email_otp_attempt(text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.complete_managed_email_otp(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_managed_email_otp(uuid, text, boolean) TO service_role;
