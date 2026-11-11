# Field Shift — Environment Variables & Configuration Guide

This document provides a comprehensive audit and reference for all environment variables used by the **Field Shift** agricultural intelligence platform.

---

## 1. Complete Environment Variables Inventory

| Variable Name | Classification | Required? | Default Value | Usage Scope | Example Placeholder |
| :--- | :--- | :---: | :---: | :--- | :--- |
| `GEMINI_API_KEY` | **Backend Secret** | **Yes\*** | *None* | Google GenAI SDK (`@google/genai`) for AI Agricultural Advisor queries | `"AIzaSyD-placeholder_key_abc123"` |
| `PORT` | **Backend Config** | No | `3000` | HTTP port on which the Express application listens | `3000` (Local) / `8080` (Cloud Run) |
| `NODE_ENV` | **Backend / Build** | No | `"development"` | Determines whether Vite dev middleware runs or pre-compiled `/dist` assets are served | `"development"` or `"production"` |
| `APP_ENV` | **Backend / Build** | No | *None* | Secondary platform flag equivalent to `NODE_ENV` for container runtimes | `"production"` |
| `APP_URL` | **Config** | No | `"http://localhost:3000"` | Canonical base URL; triggers secure `wss://` reverse-proxy HMR on HTTPS | `"https://fieldshift.example.com"` |
| `GEMINI_TIMEOUT_MS`| **Backend Config** | No | `25000` | Milliseconds allowed for Gemini generation before deterministic fallback triggers | `25000` |
| `DISABLE_HMR` | **Dev Config** | No | `"false"` | Disables Vite file watchers and WebSocket HMR | `"false"` or `"true"` |
| `VITE_API_URL` | **Frontend Config**| No | `""` (relative) | Sets base URL for API requests when frontend runs standalone | `"http://localhost:3000"` |
| `VITE_SUPABASE_URL` | **Frontend Config**| No | *None* | Supabase project URL for optional third-party auth | `"https://xyz.supabase.co"` |
| `VITE_SUPABASE_ANON_KEY` | **Frontend Config**| No | *None* | Supabase public anonymous API key for auth | `"eyJhbGciOiJIUzI1Ni..."` |
| `NASA_API_KEY` | **Backend Optional**| No | *None (Open demo)*| Expands rate limit on `api.nasa.gov` from 30 to 1,000 requests/hr | `"DEMO_KEY"` or `"YOUR_NASA_API_KEY"` |
| `EARTHDATA_TOKEN` | **Backend Optional**| No | *None (Public)*| Bearer token for direct NASA Earthdata CMR granular granule queries | `"eyJhbGciOiJIUzI1Ni..."` |

*\*Note on `GEMINI_API_KEY`: If absent, the platform does not crash. It automatically and gracefully activates the verified **Field Shift Deterministic Agronomic Engine**, displaying a transparent notice in the UI.*

---

## 2. Architectural Classification: Frontend vs. Backend

### 🔒 Backend-Only Variables (Server Execution Only)
The following variables are read strictly inside `server.ts` or `vite.config.ts` during server startup or API execution:
- `GEMINI_API_KEY`: **Strictly server-side**. Kept inside Node.js memory. **NEVER** injected into the client bundle or sent across the wire.
- `PORT`: Server socket listener configuration.
- `NODE_ENV` / `APP_ENV`: Controls Express middleware vs. static file routing.
- `GEMINI_TIMEOUT_MS`: Controls server-side request race condition timeouts and bounded retries.
- `NASA_API_KEY` / `EARTHDATA_TOKEN`: Handled through backend proxies if configured.

### 🌐 Frontend Safety Guarantee
The React client application (`src/**`) contains **zero** `import.meta.env` secrets or exposed credentials. All data flow passes through authenticated backend proxy routes (`/api/auth/*`, `/api/crops`, `/api/rotations/*`, `/api/gemini/advisor`). Client builds in `/dist` contain zero API keys, secrets, or internal server paths.

---

## 3. Gemini AI Configuration

Field Shift integrates the modern `@google/genai` TypeScript SDK:

- **Primary Model**: `gemini-3.8-flash`
- **Fallback / Failover Model**: `gemini-3.1-flash-lite` (used during transient upstream 503 high-demand spikes)
- **Deterministic Agronomic Fallback**: Activated if keys are missing, quota is exhausted (429), or network is disconnected.

### How to Obtain a Gemini API Key:
1. Navigate to **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2. Sign in with your Google Account.
3. Click **"Create API Key"** and select a Google Cloud Project.
4. Copy the generated key (`AIzaSy...`).
5. **In Google AI Studio Build Mode**: Add it via the **Settings > Secrets** panel in the left sidebar. It will be injected as `GEMINI_API_KEY` at runtime.

---

## 4. NASA Earth Observation Data Services

Field Shift ingests multi-mission NASA Earth observation data to evaluate crop rotation strategies:
- **NASA SMAP L4**: 9 km root-zone volumetric soil moisture ($0.0 - 0.5\text{ m}^3/\text{m}^3$).
- **NASA GPM IMERG**: 30-day precipitation anomalies and storm intensity tracking.
- **MODIS (Terra & Aqua) MOD13Q1**: 250 m 16-day NDVI vegetation canopy vigor.
- **NASA POWER**: Agroclimatology solar insolation ($\text{MJ/m}^2/\text{day}$) and Growing Degree Days (GDD).
- **SRTM Topography**: Digital elevation models for slope percentage and rill erosion risk calculations.

### Credentials & Keys:
- **Default (No Key Required)**: The application's server-side models operate using harmonized, calibrated NASA agronomic benchmarks and public Earthdata endpoints.
- **Optional `NASA_API_KEY`**: If connecting directly to `api.nasa.gov`, obtain a free key at **[api.nasa.gov](https://api.nasa.gov/)**.
- **Optional `EARTHDATA_TOKEN`**: Register for a free account at **[urs.earthdata.nasa.gov](https://urs.earthdata.nasa.gov/)** if fetching customized NetCDF/HDF5 granules directly from NASA DAACs.

---

## 5. Authentication & Database Configuration

- **In-Memory Store with Seeded Credentials**:
  - The application includes built-in authentication and session management in `server.ts`.
  - **Reviewer / Demo User**: `ahmed@example.com` (OTP code: `482910` or password: `password123`).
  - **Testing User**: `test@test.com` (Password: `12345678`).
  - Self-service account registration with 6-digit email OTP verification works out-of-the-box without external database dependencies.
- **Persistent Cloud Database (Optional)**:
  - If integrating Google Cloud SQL or Firebase in the future, credentials (`DATABASE_URL` or `FIREBASE_CONFIG`) should be passed as server-side environment variables and never exposed to the frontend.

---

## 6. Local Development Setup

To run Field Shift on your local workstation:

1. **Clone the repository and install dependencies**:
   ```bash
   npm install
   ```

2. **Create your local `.env` file**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Configure your `.env`**:
   ```ini
   GEMINI_API_KEY="AIzaSyYourActualApiKeyHere"
   PORT=3000
   APP_URL="http://localhost:3000"
   NODE_ENV="development"
   GEMINI_TIMEOUT_MS=25000
   DISABLE_HMR="false"
   ```

4. **Start the full-stack development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 7. Production Deployment (Google Cloud Run / Docker)

In production, the application should build static assets (`npm run build`) and run `server.ts` with `NODE_ENV=production`.

### Step 1: Build the Frontend
```bash
npm run build
```
This generates optimized static files in `/dist`.

### Step 2: Deploy to Google Cloud Run
```bash
gcloud run deploy fieldshift \
  --image gcr.io/YOUR_PROJECT_ID/fieldshift:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars NODE_ENV=production,PORT=8080,APP_URL=https://fieldshift-YOUR_HASH.a.run.app,GEMINI_TIMEOUT_MS=25000 \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

### Production Behavior:
- When `NODE_ENV=production` is detected, `server.ts` automatically serves the pre-compiled `/dist` static assets and handles single-page app routing.
- Vite development middlewares, file watchers, and client `@vite/client` injection are bypassed, saving CPU and memory.

---

## 8. Troubleshooting & Common Issues

| Symptom | Probable Cause | Remediation |
| :--- | :--- | :--- |
| **"Gemini API key pending configuration" notice in UI** | `GEMINI_API_KEY` is empty or missing. | Add your API key in `.env` (locally) or via **Settings > Secrets** (in AI Studio). The deterministic fallback will run in the meantime. |
| **"Gemini API timeout after 25000ms"** | Network latency or model thinking delays exceeded threshold. | Increase `GEMINI_TIMEOUT_MS` (e.g. to `35000`) or verify internet connectivity. |
| **`[vite] failed to connect to websocket`** | Secure HTTPS connection with mismatched HMR port. | Ensure `APP_URL` begins with `https://`. Vite will automatically use `clientPort: 443` and `wss://`. |
| **Port conflict on 3000** | Another process is using port 3000. | Change `PORT=3001` in `.env`. |
| **Secrets appearing in Git** | Accidental commit of `.env`. | Verify `.gitignore` contains `.env*` with `!.env.example`. Never commit `.env` or `.env.local`. |

---

## 9. Security & Compliance Checklist

- [x] `.env.example` uses safe placeholders only (`AIzaSy...`).
- [x] `.gitignore` excludes all `.env*` files except `.env.example`.
- [x] Zero API keys or secrets are committed to the codebase.
- [x] Zero server-side environment variables are imported into `src/`.
- [x] Server-side structured logger (`[FIELDSHIFT_LOG]`) sanitizes all payloads to delete `apiKey`, `password`, and `token` prior to logging.
