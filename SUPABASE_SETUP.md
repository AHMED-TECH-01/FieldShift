# FieldShift — Supabase Setup & Security Guide

## 1. Project Overview

FieldShift uses **Supabase Authentication** and **Supabase PostgreSQL** with strict **Row Level Security (RLS)** on every `public` table.

- **Auth Client (Browser)**: Initialized in `src/services/supabaseClient.ts` using `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (`VITE_SUPABASE_ANON_KEY` fallback).
- **API Client (Backend / Serverless)**: Initialized per request in `backend/supabase.ts` using `getSupabaseUserClient(accessToken)` so all queries execute under the caller's verified JWT (`auth.uid()`).

---

## 2. Database Schema & SQL Migrations

All schema definitions live under `/supabase/migrations/` and are idempotent:

1. **`supabase/migrations/001_initial_schema.sql`**
   - `public.profiles`: User profile metadata (`full_name`, `measurement_units`: `'imperial' | 'metric'`) + `on_auth_user_created` trigger.
   - `public.farms`: Farm parcels, coordinates `[lon, lat]`, crop history, and baseline soil characteristics. Includes `user_id` and `is_demo`. Seeds 3 baseline demo farms (`farm-1`, `farm-2`, `farm-3`).
   - `public.farmer_priorities`: 12 agronomic priority weights (`1..5`), uniquely keyed by `(farm_id, owner_scope)` so multiple users can customize priorities on demo farms without colliding.
   - `public.soil_records`: Segregated laboratory / SSURGO / farmer-reported soil tests.
   - Hardens RLS on legacy tables (`data_sources`, `dataset_ingestion_jobs`, `farm_climate_observations`) if present.

2. **`supabase/migrations/002_nasa_rotations_ai.sql`**
   - `public.nasa_datasets`: Public reference catalog of NASA missions, resolutions, units, and Earthdata auth requirements.
   - `public.nasa_observations`: Persisted NASA POWER daily observations and Earthdata CMR granule metadata with strict provenance columns (`provider`, `product_id`, `variable`, `value`, `unit`, `observed_at`, `retrieved_at`, `spatial_resolution`, `temporal_resolution`, `quality_flag`, `processing_method`, `processing_version`, `source_url`, `is_missing`, `provenance`, `raw_metadata`) and duplicate-safe unique index `idx_nasa_obs_dedup` on `(farm_id, scope_owner_id, product_id, variable, observed_at)`.
   - `public.ingestion_jobs`: Audit log of NASA sync runs (`running`, `completed`, `partial`, `failed`).
   - `public.rotation_scenarios` & `public.rotation_assessments`: Persisted farmer weight + What-If scenario configurations and deterministic multi-strategy evaluations.
   - `public.ai_advisor_history`: Grounded AI Advisor conversation turns linked to `user_id` and `farm_id`.

---

## 3. Applying Migrations

Run the migrations in order against your Supabase PostgreSQL database via the Supabase SQL Editor or Supabase CLI:

```bash
# Using Supabase CLI
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push
```

Or execute `supabase/migrations/001_initial_schema.sql` followed by `supabase/migrations/002_nasa_rotations_ai.sql` in **Supabase Dashboard -> SQL Editor**.

---

## 4. Row Level Security (RLS) & Farm Ownership

Every table in `public` has `ENABLE ROW LEVEL SECURITY`:

- **`profiles`**: Users can only `SELECT`, `INSERT`, and `UPDATE` their own row (`auth.uid() = id`).
- **`farms`**:
  - `SELECT`: Permitted when `is_demo = true` OR `auth.uid() = user_id`.
  - `INSERT`: Requires authenticated `auth.uid() = user_id` and `is_demo = false`.
  - `UPDATE` / `DELETE`: Restricted strictly to `auth.uid() = user_id` and `is_demo = false` (baseline demo farms cannot be mutated or deleted by users).
- **`farmer_priorities`, `nasa_observations`, `ingestion_jobs`**: Users can insert/update rows strictly scoped to `auth.uid()` for farms they own or baseline demo farms. Users can never read another user's synced observations, priorities, or jobs.
- **`rotation_scenarios`, `rotation_assessments`, `ai_advisor_history`**: Strict `auth.uid() = user_id` ownership on all operations.

---

## 5. Supabase Authentication, 6-Digit Email OTP & Google OAuth

In **Supabase Dashboard -> Authentication -> URL Configuration**:

1. **Site URL**: `https://field-shift-sable.vercel.app` (or your Vercel production domain)
2. **Additional Redirect URLs**:
   - `http://localhost:3000/**`
   - `https://field-shift-sable.vercel.app/**`
   - `https://*.vercel.app/**` (for Vercel Preview deployments)

In **Supabase Dashboard -> Authentication -> Sign In / Providers -> Email**:

1. Enable **Email** provider and **Confirm email**.
2. Set **Email OTP Expiration** (recommended: `3600` seconds or `900` seconds).
3. Ensure **Email OTP Length** is `6` digits (Supabase default).
4. Review **Authentication -> Rate Limits** for email sends (default Supabase Auth enforces a 60-second cooldown per user and project SMTP hourly quotas; configure custom SMTP in **Project Settings -> Authentication -> SMTP Settings** for higher production volume).

In **Supabase Dashboard -> Authentication -> Email Templates -> Confirm signup**:

Replace the default confirmation link (`{{ .ConfirmationURL }}`) with Supabase's 6-digit OTP token (`{{ .Token }}`):

- **Subject**: `Verify your FieldShift account`
- **Body** (see ready-to-paste HTML in `supabase/templates/confirm_signup_otp.html` or plain text):

```text
Welcome to FieldShift!

Your email verification code is:

{{ .Token }}

Enter this 6-digit code in FieldShift to verify your email address.

If you did not create this account, you can ignore this email.
```

In **Supabase Dashboard -> Authentication -> Sign In / Providers -> Google** (Google OAuth):

1. Enable **Google** provider with your Google Cloud OAuth Client ID and Client Secret.
2. Add your Supabase callback URL (`https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`) to Google Cloud Console Authorized Redirect URIs.
3. Google OAuth users are authenticated directly via Supabase OAuth PKCE redirect to `/dashboard` and do not require an email OTP step.

---

## 6. Secret-Key Handling Rules

- **Publishable Key (`VITE_SUPABASE_PUBLISHABLE_KEY`)**: Safe for browser bundles and public client initialization; all database access is gated by RLS.
- **Secret Key (`SUPABASE_SECRET_KEY`)**: Strictly server-side only (used for `/api/health` readiness or CLI/test administration). Backend route handlers **never** use the secret key to bypass farm ownership checks; private data queries always run through the user's JWT-scoped client (`getSupabaseUserClient`).
