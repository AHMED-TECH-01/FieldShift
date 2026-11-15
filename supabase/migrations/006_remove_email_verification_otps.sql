-- FieldShift Migration 006: Remove Obsolete Email Verification OTP Schema & RPCs
-- Drops the email_verification_otps ledger and its SECURITY DEFINER RPC functions.
-- Preserves auth.users, public.profiles, farms, and all agronomic/NASA tables untouched.

DROP FUNCTION IF EXISTS public.reserve_email_otp(uuid, text, text, text, integer, integer, integer, boolean);
DROP FUNCTION IF EXISTS public.activate_email_otp(uuid, uuid);
DROP FUNCTION IF EXISTS public.abort_email_otp(uuid, text);
DROP FUNCTION IF EXISTS public.invalidate_user_otps(uuid);
DROP FUNCTION IF EXISTS public.verify_email_otp_attempt(text, text, text);
DROP FUNCTION IF EXISTS public.complete_managed_email_otp(uuid, text, boolean);

DROP TABLE IF EXISTS public.email_verification_otps CASCADE;
