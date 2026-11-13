-- FieldShift Migration 002: NASA Datasets, Observations, Ingestion Jobs, Crop Rotations & AI Advisor History
-- Ensures raw NASA observations are segregated from derived indicators and strictly RLS-protected.

-- 1. NASA Datasets Catalog (Reference metadata for supported missions)
CREATE TABLE IF NOT EXISTS public.nasa_datasets (
  id text PRIMARY KEY,
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  provider text NOT NULL,
  dataset_url text NOT NULL,
  spatial_resolution text NOT NULL,
  temporal_resolution text NOT NULL,
  observation_period text NOT NULL,
  units text NOT NULL,
  processing_method text NOT NULL,
  analytical_purpose text NOT NULL,
  limitations text NOT NULL,
  data_category text NOT NULL CHECK (data_category IN ('Satellite Derived', 'Ground Truth Calibrated', 'Model Assimilated')),
  access_mode text NOT NULL,
  requires_earthdata_auth boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nasa_datasets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read nasa_datasets" ON public.nasa_datasets;
CREATE POLICY "Public read nasa_datasets"
  ON public.nasa_datasets FOR SELECT
  USING (true);

-- Seed NASA datasets catalog metadata
INSERT INTO public.nasa_datasets (
  id, code, name, provider, dataset_url, spatial_resolution, temporal_resolution,
  observation_period, units, processing_method, analytical_purpose, limitations,
  data_category, access_mode, requires_earthdata_auth
) VALUES
(
  'nasa-power', 'NASA POWER Agro', 'Prediction Of Worldwide Energy Resources (POWER) Daily Agroclimatology',
  'NASA Langley Research Center (LaRC)', 'https://power.larc.nasa.gov/api/temporal/daily/point',
  '0.5° latitude x 0.5° longitude (~50 km)', 'Daily (1981-present archive)',
  '1981-present', 'T2M/Tmax/Tmin (°C), PRECTOTCORR (mm/day), RH2M (%), ALLSKY_SFC_SW_DWN (MJ/m²/day)',
  'GEOS atmospheric assimilation coupled with CERES satellite radiation',
  'Calculates thermal heat units, solar radiation fluxes, precipitation totals, and frost exposure.',
  'Assimilated ~50 km grid; not a substitute for an on-farm rain gauge or frost pocket thermometer.',
  'Model Assimilated', 'live_public_api', false
),
(
  'smap', 'SMAP SPL4SMGP', 'Soil Moisture Active Passive (SMAP) L4 Surface & Root-Zone Soil Moisture',
  'NASA JPL / NSIDC DAAC', 'https://cmr.earthdata.nasa.gov/search/granules.json?short_name=SPL4SMGP',
  '9 km EASE-Grid 2.0 assimilated', '3-hourly model assimilation',
  '2015-present', 'Volumetric soil moisture (m³/m³)',
  'Kalman filtering assimilation of L-band brightness temperature with Catchment Land Surface Model',
  'Quantifies root-zone available water capacity to evaluate plant stress and cover crop moisture margins.',
  '9 km cell aggregates localized topography; HDF5 pixel extraction requires Earthdata Login bearer token.',
  'Model Assimilated', 'cmr_granule_discovery', true
),
(
  'gpm', 'GPM 3IMERGDL', 'Global Precipitation Measurement (GPM) IMERG Late Daily Run',
  'NASA GSFC / GES DISC', 'https://cmr.earthdata.nasa.gov/search/granules.json?short_name=GPM_3IMERGDL',
  '0.1° x 0.1° (~10 km)', 'Daily (Late Run ~14h latency) / Final Run (~3.5 mo)',
  '2000-present', 'Calibrated precipitation accumulation (mm/day)',
  'Combined passive microwave gridding with IR morphing and GPCC gauge calibration',
  'Tracks rainfall accumulation, storm intensity, and multi-week dry spells.',
  'Late Run is near-real-time without Final research gauge calibration; HDF5/NetCDF grid extraction requires Earthdata Login.',
  'Ground Truth Calibrated', 'cmr_granule_discovery', true
),
(
  'modis', 'MODIS MOD13Q1', 'MODIS Terra Vegetation Indices 16-Day L3 Global 250m',
  'NASA LP DAAC', 'https://cmr.earthdata.nasa.gov/search/granules.json?short_name=MOD13Q1',
  '250 m multispectral', '16-day composite',
  '2000-present', 'NDVI & EVI (-1.0 to +1.0 dimensionless)',
  'Constrained View Angle Maximum Value Composite (CV-MVC)',
  'Measures photosynthetic vigor, seasonal crop emergence, and bare-field duration.',
  '250 m composite may mix adjacent fields and cannot confirm specific insect pests; HDF4 extraction requires Earthdata Login.',
  'Satellite Derived', 'cmr_granule_discovery', true
),
(
  'ecostress', 'ECOSTRESS ECO_L3T_JET', 'ECOsystem Spaceborne Thermal Radiometer Experiment on Space Station L3T ET',
  'NASA JPL / LP DAAC (ISS)', 'https://cmr.earthdata.nasa.gov/search/granules.json?short_name=ECO_L3T_JET',
  '70 m x 70 m multispectral thermal', 'Variable 1 to 5 days (ISS precessing orbit)',
  '2018-present', 'Actual ET (W/m² & mm/day) & Evaporative Stress Index (ESI)',
  'Surface energy balance (PT-JPL) driven by thermal infrared bands (8-12.5 um)',
  'Detects plant water stress before visible wilting via canopy temperature anomalies.',
  'Variable ISS orbit means non-uniform revisit intervals; GeoTIFF/HDF5 download requires Earthdata Login.',
  'Satellite Derived', 'cmr_granule_discovery', true
),
(
  'landsat', 'Landsat 8/9 C2 L2', 'Landsat 8-9 OLI/TIRS Surface Reflectance Collection 2',
  'NASA / USGS EROS', 'https://cmr.earthdata.nasa.gov/search/granules.json?short_name=HLSL30',
  '30 m multispectral', '8-day combined constellation',
  '1982-present', 'Surface reflectance (0.0 to 1.0)',
  'LaSRC atmospheric correction',
  'Sub-field parcel boundary verification and bare-soil residue monitoring.',
  'Optical imagery obstructed by cloud cover during spring emergence.',
  'Satellite Derived', 'catalog_metadata', true
),
(
  'grace', 'GRACE-FO JPL Mascon', 'GRACE Follow-On Monthly Mass Grids (Regional Groundwater Storage)',
  'NASA JPL / CSR', 'https://podaac.jpl.nasa.gov/GRACE-FO',
  '0.5° grid (~300 km effective gravimetry)', 'Monthly',
  '2002-present', 'Liquid Water Equivalent Thickness anomaly (cm)',
  'Spherical harmonic / mascon inversion of K-band inter-satellite range rate',
  'Tracks multi-year regional aquifer depletion baselines.',
  'Coarse ~300 km footprint cannot measure individual field-scale wells.',
  'Satellite Derived', 'catalog_metadata', false
),
(
  'srtm', 'SRTMGL1 v003', 'Shuttle Radar Topography Mission 1 Arc-Second Global Elevation',
  'NASA / NGA / USGS', 'https://lpdaac.usgs.gov/products/srtmgl1v003/',
  '1 arc-second (~30 m)', 'Static baseline (Feb 2000)',
  'February 2000 mission', 'Elevation (m) & Slope (%)',
  'C-band Interferometric SAR with void filling',
  'Topographic slope gradient and rill erosion runoff modeling.',
  'Static 2000 terrain surface; tree canopy can inflate elevation.',
  'Ground Truth Calibrated', 'catalog_metadata', false
)
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  provider = EXCLUDED.provider,
  dataset_url = EXCLUDED.dataset_url,
  spatial_resolution = EXCLUDED.spatial_resolution,
  temporal_resolution = EXCLUDED.temporal_resolution,
  observation_period = EXCLUDED.observation_period,
  units = EXCLUDED.units,
  processing_method = EXCLUDED.processing_method,
  analytical_purpose = EXCLUDED.analytical_purpose,
  limitations = EXCLUDED.limitations,
  data_category = EXCLUDED.data_category,
  access_mode = EXCLUDED.access_mode,
  requires_earthdata_auth = EXCLUDED.requires_earthdata_auth,
  updated_at = now();

-- 2. Raw NASA Observations (Strict Provenance, Duplicate-Safe, Missing-Value Explicit)
CREATE TABLE IF NOT EXISTS public.nasa_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id text NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  scope_owner_id text NOT NULL DEFAULT 'public',
  provider text NOT NULL,
  dataset_id text NOT NULL,
  dataset_name text NOT NULL,
  product_id text NOT NULL,
  variable text NOT NULL,
  value double precision,
  unit text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  observed_at timestamptz NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  spatial_resolution text NOT NULL,
  temporal_resolution text NOT NULL,
  quality_flag text NOT NULL DEFAULT 'valid',
  processing_method text NOT NULL,
  processing_version text NOT NULL DEFAULT 'v1',
  source_url text NOT NULL,
  is_missing boolean NOT NULL DEFAULT false,
  provenance text NOT NULL,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nasa_obs_dedup
  ON public.nasa_observations(farm_id, scope_owner_id, product_id, variable, observed_at);
CREATE INDEX IF NOT EXISTS idx_nasa_obs_farm_dataset
  ON public.nasa_observations(farm_id, dataset_id, observed_at DESC);

ALTER TABLE public.nasa_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read accessible NASA observations" ON public.nasa_observations;
CREATE POLICY "Read accessible NASA observations"
  ON public.nasa_observations FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      user_id IS NULL
      AND EXISTS (SELECT 1 FROM public.farms f WHERE f.id = nasa_observations.farm_id AND f.is_demo = true)
    )
  );

DROP POLICY IF EXISTS "Insert owned NASA observations" ON public.nasa_observations;
CREATE POLICY "Insert owned NASA observations"
  ON public.nasa_observations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND scope_owner_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = nasa_observations.farm_id AND (f.user_id = auth.uid() OR f.is_demo = true)
    )
  );

DROP POLICY IF EXISTS "Update owned NASA observations" ON public.nasa_observations;
CREATE POLICY "Update owned NASA observations"
  ON public.nasa_observations FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id AND scope_owner_id = auth.uid()::text);

-- 3. Ingestion Jobs Audit Log
CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id text NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dataset_id text NOT NULL,
  source_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
  start_date date,
  end_date date,
  records_received integer NOT NULL DEFAULT 0,
  records_saved integer NOT NULL DEFAULT 0,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_farm_dataset
  ON public.ingestion_jobs(farm_id, dataset_id, created_at DESC);

ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read accessible ingestion jobs" ON public.ingestion_jobs;
CREATE POLICY "Read accessible ingestion jobs"
  ON public.ingestion_jobs FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      user_id IS NULL
      AND EXISTS (SELECT 1 FROM public.farms f WHERE f.id = ingestion_jobs.farm_id AND f.is_demo = true)
    )
  );

DROP POLICY IF EXISTS "Insert owned ingestion jobs" ON public.ingestion_jobs;
CREATE POLICY "Insert owned ingestion jobs"
  ON public.ingestion_jobs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = ingestion_jobs.farm_id AND (f.user_id = auth.uid() OR f.is_demo = true)
    )
  );

DROP POLICY IF EXISTS "Update owned ingestion jobs" ON public.ingestion_jobs;
CREATE POLICY "Update owned ingestion jobs"
  ON public.ingestion_jobs FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 4. Crop Rotation Scenarios & Assessments
CREATE TABLE IF NOT EXISTS public.rotation_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id text NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  priorities jsonb NOT NULL,
  scenario_params jsonb,
  is_hypothetical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rotation_scenarios_user_farm
  ON public.rotation_scenarios(user_id, farm_id, created_at DESC);

ALTER TABLE public.rotation_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage own rotation scenarios" ON public.rotation_scenarios;
CREATE POLICY "Manage own rotation scenarios"
  ON public.rotation_scenarios FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = rotation_scenarios.farm_id AND (f.user_id = auth.uid() OR f.is_demo = true)
    )
  );

CREATE TABLE IF NOT EXISTS public.rotation_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid REFERENCES public.rotation_scenarios(id) ON DELETE CASCADE,
  farm_id text NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategies jsonb NOT NULL,
  ranking_explanation text NOT NULL,
  nasa_evidence_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  missing_data_notices jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rotation_assessments_user_farm
  ON public.rotation_assessments(user_id, farm_id, created_at DESC);

ALTER TABLE public.rotation_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage own rotation assessments" ON public.rotation_assessments;
CREATE POLICY "Manage own rotation assessments"
  ON public.rotation_assessments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = rotation_assessments.farm_id AND (f.user_id = auth.uid() OR f.is_demo = true)
    )
  );

-- 5. AI Advisor History
CREATE TABLE IF NOT EXISTS public.ai_advisor_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id text NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  reply text NOT NULL,
  model_source text NOT NULL,
  is_fallback boolean NOT NULL DEFAULT false,
  fallback_reason text,
  latency_ms integer,
  grounding_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_history_user_farm
  ON public.ai_advisor_history(user_id, farm_id, created_at DESC);

ALTER TABLE public.ai_advisor_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Manage own AI advisor history" ON public.ai_advisor_history;
CREATE POLICY "Manage own AI advisor history"
  ON public.ai_advisor_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = ai_advisor_history.farm_id AND (f.user_id = auth.uid() OR f.is_demo = true)
    )
  );
