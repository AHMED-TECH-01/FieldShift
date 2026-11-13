# FieldShift — Architecture, API & Deployment Guide

## 1. Production Architecture

FieldShift runs as a unified TypeScript monorepo deployed to **Vercel**:

| Layer | Technology | Entry / Location |
| :--- | :--- | :--- |
| **Frontend SPA** | React 19 + Vite 8 + Tailwind CSS v4 + Three.js | `src/` -> built to `dist/` |
| **Backend API** | Node.js 22 + Express 4 + Zod | `app.ts` + `backend/` |
| **Production Runtime** | Vercel Serverless Functions | `api/index.ts` |
| **Local Dev Server** | `tsx server.ts` (Express + Vite middlewares) | `server.ts` |
| **Database & Auth** | Supabase PostgreSQL (RLS) + Supabase Auth | `supabase/migrations/` |
| **AI Engine** | Google Gemini (`@google/genai`: `gemini-4-hydrogen` / `gemini-3.1-flash-lite`) | `backend/gemini.ts` |
| **NASA Ingestion** | NASA POWER Daily Point API + Earthdata CMR Discovery | `backend/nasa.ts` |

---

## 2. Local Development & Build Workflow

```bash
# 1. Install dependencies cleanly from package-lock.json
npm ci

# 2. Configure local environment variables (copy template and fill values)
cp .env.example .env

# 3. Run full-stack development server (Express + Vite HMR on port 3000)
npm run dev

# 4. Typecheck & build production bundle
npm run lint
npm run build

# 5. Run live API, RLS, NASA & Gemini verification suite
npx tsx tests/verify-production.ts
```

---

## 3. Serverless Compatibility Guarantees

- **`api/index.ts`** exports the Express `app` cleanly for Vercel without calling `app.listen()`.
- **`app.ts`** contains zero imports from `vite` (`devDependencies`), uses `process.cwd()` instead of `import.meta.url`, bounds JSON request bodies to `1mb`, returns structured JSON for malformed JSON (`400`) and unknown `/api/*` paths (`404`), and stores zero persistent user state in memory.
- **`server.ts`** is used strictly for local development (`npm run dev`) or standalone Node execution.

---

## 4. Complete API Endpoint Reference

### Health & Public Reference Catalogs (No Auth Required)
| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Runtime health, Supabase reachability, Gemini key readiness |
| `GET` | `/api/crops` | Verified university/USDA crop catalog (`?family=` optional filter) |
| `GET` | `/api/scientific-methods` | Agronomic formulas & scientific guardrails |
| `GET` | `/api/datasets`, `/api/nasa/roadmap` | NASA mission catalog & harmonization metadata |
| `GET` | `/api/analysis/supplemental-income` | Extension budget conservation & forage revenue notes |

### Authentication (Supabase Auth Proxy + HttpOnly Cookie / Bearer JWT)
| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Create Supabase Auth user & dispatch email confirmation |
| `POST` | `/api/auth/verify-otp` | Verify signup email OTP code & issue session |
| `POST` | `/api/auth/resend-otp` | Resend signup verification OTP |
| `POST` | `/api/auth/login` | Authenticate via Supabase Auth email/password (`GET` -> `405`) |
| `GET` | `/api/auth/session` | Validate active session & return authenticated user |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `POST` | `/api/auth/password-reset` | Trigger Supabase password recovery email |

### User Profile (Protected — `Authorization: Bearer <jwt>` or Session Cookie)
| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/profile` | Fetch or auto-initialize authenticated user profile & units |
| `PATCH` | `/api/profile` | Update `fullName` and/or `measurementUnits` (`imperial` \| `metric`) |

### Farm Properties (Protected & Ownership Verified via RLS)
| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/farms` | List baseline demo farms + caller's private farms |
| `POST` | `/api/farms` | Create a new private farm parcel (`is_demo = false`) |
| `GET` | `/api/farms/:id` | Fetch single accessible farm (`404` if owned by another user) |
| `PATCH` | `/api/farms/:id` | Edit owned private farm (`403` on demo farms, `404` on other users) |
| `DELETE` | `/api/farms/:id` | Delete owned private farm (`403` on demo farms, `404` on other users) |

### Farmer Priorities (Protected, Scoped by `(farm_id, owner_scope)`)
| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/priorities?farmId=...` | Retrieve caller's saved priority weights for farm |
| `PUT` | `/api/priorities` | Upsert caller's 12 priority weights (`1..5`) |

### NASA Data Ingestion & Farm Telemetry (Protected)
| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/datasets/status?farmId=...` | Summary of synced NASA POWER metrics, CMR granules & `ingestion_jobs` |
| `POST` | `/api/datasets/nasa-power/sync` | Fetch live NASA POWER daily agroclimatology for parcel coordinates & upsert idempotently |
| `POST` | `/api/datasets/:dataset/sync` | Query live NASA Earthdata CMR granules (`smap`, `gpm`, `modis`, `ecostress`) & store metadata (`value = null`, `is_missing = true`) |
| `GET` | `/api/datasets/:dataset/observations` | Paginated persisted `nasa_observations` for dataset & farm |
| `GET` | `/api/nasa/observations?farmId=...` | Dashboard real-time metrics + explicit `"not_synced"` / `"granule_metadata_only"` status |
| `GET` | `/api/climate/timeline?farmId=...` | Daily temperature, rainfall, humidity & solar timeline from persisted POWER rows |
| `GET` | `/api/soil/profiles?farmId=...` | Farmer/lab soil test metrics segregated from satellite telemetry |
| `GET` | `/api/risk/field-analysis?farmId=...` | Heat, rainfall deficit/runoff, and organic matter risk indicators |
| `GET` | `/api/analysis/bare-field?farmId=...` | Seasonal bare-soil exposure analysis grounded in crop & POWER data |
| `GET` | `/api/analysis/pest-cycles?farmId=...` | Crop-family pest cycle interruption evaluation |

### Crop Rotation Engine & AI Advisor (Protected)
| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/rotations/strategies?farmId=...` | Deterministic 3-strategy baseline comparison using persisted farm + POWER data |
| `POST` | `/api/rotations/recalculate` (aliases: `/compare`, `/assess`) | Recalculate rankings with custom priorities & optional What-If scenario (optionally persists snapshot) |
| `GET` | `/api/rotations` | List caller's saved `rotation_assessments` |
| `POST` | `/api/rotations` | Create & persist `rotation_scenarios` + `rotation_assessments` snapshot |
| `GET` | `/api/rotations/:id` | Retrieve single persisted assessment owned by caller |
| `POST` | `/api/ai/advisor` (aliases: `/api/gemini/advisor`, `/api/advisor`) | Grounded Gemini AI Advisor query (`gemini-4-hydrogen` / fallback) persisted to `ai_advisor_history` |
| `GET` | `/api/ai/history` | List caller's persisted AI Advisor Q&A history |

---

## 5. Known Limitations & Operational Notes

1. **NASA Sub-Field / Binary Pixel Extraction**: NASA POWER delivers `0.5°` (~50 km) assimilated daily agroclimatology without auth. SMAP (`SPL4SMGP`), GPM (`GPM_3IMERGDL`), MODIS (`MOD13Q1`), and ECOSTRESS (`ECO_L3T_JET`) perform live Earthdata CMR granule discovery and record `granuleId` provenance with `value: null, is_missing: true`; raster HDF5/NetCDF4 pixel extraction requires future authenticated Earthdata Login file download + binary decoding worker outside Vercel serverless limits.
2. **Serverless Execution Limits**: Single NASA POWER sync requests are bounded to `days <= 90` (`datasetSyncSchema`) so sync operations complete safely well inside Vercel's serverless timeout.
3. **Vercel Environment Sync**: Production deployments require environment variables to be saved in the Vercel Dashboard before running `vercel --prod`.
