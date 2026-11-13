# FieldShift — Vercel Serverless Setup Guide

## 1. Project Settings in Vercel Dashboard

Configure the Vercel project (`AHMED-TECH-01/FieldShift`) with:

| Setting | Value |
| :--- | :--- |
| **Root Directory** | `.` (Repository Root) |
| **Framework Preset** | `Vite` |
| **Install Command** | `npm ci` (or `npm install`) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Node.js Version** | `22.x` (`package.json` `engines.node`) |

---

## 2. Serverless Entry Point & Routing (`vercel.json`)

- **API Serverless Function**: `/api/index.ts` imports and default-exports `{ app }` from `/app.ts`.
  - It **never** imports `vite`, **never** uses `import.meta.url` file resolution, and **never** calls `app.listen()`.
- **Routing (`vercel.json`)**:
  ```json
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
  ```
  - `/api/*` requests are routed to `/api/index.ts` before the SPA fallback so API endpoints always return JSON and never `index.html`.
  - Direct browser navigation or page refresh on `/dashboard`, `/dashboard/farms`, `/resources/ai-advisor`, etc. serves `dist/index.html` cleanly.
  - `/api/*` responses include `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`.

---

## 3. Vercel Environment Variables

Add these variables in **Vercel Dashboard -> Project Settings -> Environment Variables** for **Production**, **Preview**, and **Development** (or copy from `.env.example`):

| Variable | Visibility | Value / Notes |
| :--- | :--- | :--- |
| `VITE_API_URL` | Exposed at build time | Leave empty (`""`) on Vercel so browser calls relative `/api/*` on the same origin |
| `VITE_SUPABASE_URL` | Exposed at build time | Your Supabase project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Exposed at build time | Your Supabase publishable key (`sb_publishable_...`) |
| `VITE_SUPABASE_ANON_KEY` | Exposed at build time | Same publishable key (legacy alias compatibility) |
| `SUPABASE_URL` | Server runtime secret | Same Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server runtime secret | Your Supabase secret key (`sb_secret_...`) |
| `GEMINI_API_KEY` | Server runtime secret | Your Google AI Studio Gemini API key |
| `GEMINI_TIMEOUT_MS` | Server runtime config | `25000` |
| `APP_URL` | Server runtime config | Canonical domain (e.g. `https://field-shift-sable.vercel.app`) |
| `NODE_ENV` | Runtime | `production` |

> **Important:** Whenever `VITE_*` variables are added or changed in Vercel, trigger a fresh **Redeploy** so Vite bakes the updated public values into `dist/`.

---

## 4. Post-Deployment Verification Checklist

```bash
# 1. Homepage HTML
curl -i https://field-shift-sable.vercel.app/

# 2. Serverless Express Health Check (JSON)
curl -s https://field-shift-sable.vercel.app/api/health | jq

# 3. Unknown API Route (must return HTTP 404 JSON, never HTML)
curl -i https://field-shift-sable.vercel.app/api/does-not-exist

# 4. SPA Deep Route Refresh (must return HTTP 200 HTML)
curl -i https://field-shift-sable.vercel.app/dashboard/farms
```

Expected `/api/health` fields:
- `"status": "healthy"`
- `"runtime": "vercel-serverless"`
- `"supabaseConfigured": true`
- `"supabaseReachable": true`
- `"geminiConfigured": true`
