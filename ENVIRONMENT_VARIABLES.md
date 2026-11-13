# FieldShift — Environment Variables & Configuration Guide

This document provides the complete reference for all environment variables used across the **FieldShift** React + Vite + Express + Supabase + Gemini + NASA platform.

---

## 1. Environment Variables Inventory

| Variable Name | Classification | Required? | Default Value | Scope | Example Placeholder |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `VITE_SUPABASE_URL` | **Frontend Public** | **Yes** | *None* | Browser (`src/services/supabaseClient.ts`) | `"https://your-project.supabase.co"` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **Frontend Public** | **Yes** | *None* | Browser Supabase Auth (`sb_publishable_...`) | `"sb_publishable_..."` |
| `VITE_SUPABASE_ANON_KEY` | **Frontend Public** | Legacy Alias | *None* | Optional legacy fallback for publishable key | `"sb_publishable_..."` |
| `VITE_API_URL` | **Frontend Config** | No | `""` (relative `/api`) | Optional base URL; leave empty on shared Vercel domain | `""` |
| `SUPABASE_URL` | **Backend Config** | **Yes** | *None* | Express & Vercel Serverless (`backend/supabase.ts`) | `"https://your-project.supabase.co"` |
| `SUPABASE_SECRET_KEY` | **Backend Secret** | **Yes** | *None* | Server-side admin/health checks & user-scoped clients | `"sb_secret_..."` |
| `GEMINI_API_KEY` | **Backend Secret** | **Yes\*** | *None* | `@google/genai` server-side AI Advisor (`backend/gemini.ts`) | `"AIzaSy..."` |
| `GEMINI_TIMEOUT_MS` | **Backend Config** | No | `25000` | Timeout (ms) before failing over or falling back | `"25000"` |
| `EARTHDATA_TOKEN` | **Backend Optional** | No | *None* | Future authenticated HDF5/NetCDF4 granule downloads | `""` |
| `NASA_API_KEY` | **Backend Optional** | No | *None* | Optional `api.nasa.gov` rate-limit expansion | `""` |
| `APP_PORT` | **Local Dev Config** | No | `3000` | Local `server.ts` HTTP port (not used on Vercel) | `"3000"` |
| `APP_URL` | **Config** | No | *None* | Canonical app origin for CORS & password reset redirects | `"https://field-shift-sable.vercel.app"` |
| `DISABLE_HMR` | **Local Dev Config** | No | `"false"` | Disables Vite HMR WebSocket in headless/container dev | `"true"` |
| `NODE_ENV` | **Runtime Flag** | Auto | `"development"` | Set to `"production"` automatically on Vercel | `"production"` |

*\*Note on `GEMINI_API_KEY`: If absent or temporarily unavailable, the backend gracefully activates the deterministic grounded agronomic summary so advisory endpoints remain available without fabricating satellite data.*

---

## 2. Security & Frontend Safety Rules

1. **Zero Secrets in Browser Code**: `VITE_*` variables are compiled into `dist/` by Vite. Never assign `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, or `EARTHDATA_TOKEN` to any `VITE_*` prefix.
2. **Per-Request RLS Enforcement**: Express creates a user-scoped Supabase client (`getSupabaseUserClient(accessToken)`) per request so PostgreSQL Row Level Security (`auth.uid()`) protects private farm, soil, NASA, rotation, and AI history records.
3. **Log Sanitization**: `[FIELDSHIFT_LOG]` (`backend/logger.ts`) redacts `password`, `token`, `secret`, `apiKey`, and `authorization` fields automatically before logging.

---

## 3. Gemini AI Configuration

- **SDK**: `@google/genai` (server-side only in `backend/gemini.ts`)
- **Primary Model**: `gemini-4-hydrogen`
- **Failover Model**: `gemini-3.1-flash-lite` (used automatically on transient upstream demand/rate-limit spikes)
- **Deterministic Grounded Fallback**: Activated only if the key is missing, quota is exhausted, or upstream requests time out. Never invents satellite pixel readings.

---

## 4. NASA Earth Observation Data Services & Credential Setup

- **NASA POWER Daily & Monthly Point API** (`https://power.larc.nasa.gov/docs/`): Live public agroclimatology API (no key required) queried by farm longitude/latitude (`T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `RH2M`, `ALLSKY_SFC_SW_DWN`, `WS2M`).
- **NASA MODIS via ORNL DAAC Global Subsets REST API** (`https://modis.ornl.gov/rst/api/v1` / `https://modis.gsfc.nasa.gov/data/`): Live public 250m `MOD13Q1` (`NDVI`, `EVI`, `pixel_reliability`) & 1km `MOD11A2` (`LST_Day_1km`) pixel extraction with automatic cloud/snow exclusion (`pixel_reliability` `2`/`3`), plus Earthdata CMR granule metadata. No API key required.
- **NASA Earthdata CMR Granule Search** (`https://cmr.earthdata.nasa.gov/search/granules.json`): Live metadata discovery for `SPL4SMGP` ([SMAP](https://nsidc.org/data/smap)), `GPM_3IMERGDL` ([GPM IMERG](https://gpm.nasa.gov/data)), and `ECO_L3T_JET` ([ECOSTRESS](https://ecostress.jpl.nasa.gov/)). Granule metadata rows are stored with `value = null` and `is_missing = true` until authenticated Earthdata HDF5/NetCDF4 binary extraction is added.
- **How to Obtain Optional NASA Credentials**:
  - `EARTHDATA_TOKEN`: Create a free account at [urs.earthdata.nasa.gov](https://urs.earthdata.nasa.gov/), go to **Generate Token**, and copy the Bearer token into `.env` / Vercel secrets (never into `VITE_*`).
  - `NASA_API_KEY`: Register at [api.nasa.gov](https://api.nasa.gov/) if higher rate limits are needed for future Open API endpoints.
- **Server Capability Status**: Call `GET /api/nasa/health` to verify which NASA providers, credentials, and cache metrics are active without leaking secrets.

---

## 5. Authentication & Database Requirements

- Authentication runs exclusively via **Supabase Auth** (`signUp`, `verifyOtp`, `signInWithPassword`, `resetPasswordForEmail`, `getSession`). There are zero in-memory user maps or hardcoded passwords.
- Local development uses `.env` (git-ignored by `.env*` with `!.env.example`).
- Vercel production deployments must configure both frontend `VITE_*` variables (used at build time) and backend secret variables (used by the serverless function at runtime) across **Production** and **Preview** environments.
