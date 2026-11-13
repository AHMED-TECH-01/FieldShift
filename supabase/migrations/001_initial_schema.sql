-- FieldShift Migration 001: Core Profiles, Farms, Priorities, Soil Records & RLS Hardening
-- Idempotent migration safe for initial provisioning and re-application.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. User Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT 'Farmer',
  measurement_units text NOT NULL DEFAULT 'imperial' CHECK (measurement_units IN ('imperial', 'metric')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile row on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    LOWER(COALESCE(NEW.email, '')),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(COALESCE(NEW.email, 'farmer'), '@', 1))
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Farms
CREATE TABLE IF NOT EXISTS public.farms (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  location text NOT NULL,
  coordinates jsonb NOT NULL DEFAULT '[-93.62, 42.03]'::jsonb,
  acreage numeric NOT NULL DEFAULT 250 CHECK (acreage > 0),
  current_crop text NOT NULL DEFAULT 'Corn (Maize)',
  planting_season text NOT NULL DEFAULT 'Spring 2026',
  rotation_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  soil_type text NOT NULL DEFAULT 'Silt Loam',
  soil_ph numeric NOT NULL DEFAULT 6.5 CHECK (soil_ph >= 0 AND soil_ph <= 14),
  organic_matter numeric NOT NULL DEFAULT 3.2 CHECK (organic_matter >= 0 AND organic_matter <= 100),
  nitrogen text NOT NULL DEFAULT 'Medium',
  phosphorus text NOT NULL DEFAULT 'Medium',
  potassium text NOT NULL DEFAULT 'Medium',
  drainage text NOT NULL DEFAULT 'Well Drained',
  last_soil_test text NOT NULL DEFAULT '2026-01-01',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_farms_user_id ON public.farms(user_id);
CREATE INDEX IF NOT EXISTS idx_farms_is_demo ON public.farms(is_demo);

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read demo or owned farms" ON public.farms;
CREATE POLICY "Read demo or owned farms"
  ON public.farms FOR SELECT
  USING (is_demo = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Insert owned farms" ON public.farms;
CREATE POLICY "Insert owned farms"
  ON public.farms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id AND is_demo = false);

DROP POLICY IF EXISTS "Update owned farms" ON public.farms;
CREATE POLICY "Update owned farms"
  ON public.farms FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND is_demo = false);

DROP POLICY IF EXISTS "Delete owned farms" ON public.farms;
CREATE POLICY "Delete owned farms"
  ON public.farms FOR DELETE
  USING (auth.uid() = user_id AND is_demo = false);

-- 3. Farmer Priorities (Per farm + owner scope so demo farms never collide across users)
CREATE TABLE IF NOT EXISTS public.farmer_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id text NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_scope text NOT NULL DEFAULT 'public',
  water_conservation integer NOT NULL DEFAULT 4 CHECK (water_conservation BETWEEN 1 AND 5),
  profitability integer NOT NULL DEFAULT 4 CHECK (profitability BETWEEN 1 AND 5),
  forage_value integer NOT NULL DEFAULT 2 CHECK (forage_value BETWEEN 1 AND 5),
  nitrogen_fixing integer NOT NULL DEFAULT 5 CHECK (nitrogen_fixing BETWEEN 1 AND 5),
  soil_organic_matter integer NOT NULL DEFAULT 5 CHECK (soil_organic_matter BETWEEN 1 AND 5),
  erosion_reduction integer NOT NULL DEFAULT 4 CHECK (erosion_reduction BETWEEN 1 AND 5),
  soil_infiltration integer NOT NULL DEFAULT 4 CHECK (soil_infiltration BETWEEN 1 AND 5),
  market_suitability integer NOT NULL DEFAULT 4 CHECK (market_suitability BETWEEN 1 AND 5),
  drought_resilience integer NOT NULL DEFAULT 4 CHECK (drought_resilience BETWEEN 1 AND 5),
  crop_diversity integer NOT NULL DEFAULT 3 CHECK (crop_diversity BETWEEN 1 AND 5),
  equipment_compatibility integer NOT NULL DEFAULT 3 CHECK (equipment_compatibility BETWEEN 1 AND 5),
  planting_harvest_constraints integer NOT NULL DEFAULT 3 CHECK (planting_harvest_constraints BETWEEN 1 AND 5),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.farmer_priorities
  ADD COLUMN IF NOT EXISTS owner_scope text NOT NULL DEFAULT 'public';

UPDATE public.farmer_priorities
SET owner_scope = COALESCE(user_id::text, 'public')
WHERE owner_scope = 'public' AND user_id IS NOT NULL;

ALTER TABLE public.farmer_priorities
  DROP CONSTRAINT IF EXISTS farmer_priorities_farm_id_key;

DROP INDEX IF EXISTS idx_farmer_priorities_farm_owner;
CREATE UNIQUE INDEX idx_farmer_priorities_farm_owner
  ON public.farmer_priorities(farm_id, owner_scope);

ALTER TABLE public.farmer_priorities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read priorities for accessible farms" ON public.farmer_priorities;
CREATE POLICY "Read priorities for accessible farms"
  ON public.farmer_priorities FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      user_id IS NULL
      AND EXISTS (SELECT 1 FROM public.farms f WHERE f.id = farmer_priorities.farm_id AND f.is_demo = true)
    )
  );

DROP POLICY IF EXISTS "Manage own priorities" ON public.farmer_priorities;
CREATE POLICY "Manage own priorities"
  ON public.farmer_priorities FOR ALL
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND owner_scope = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.farms f
      WHERE f.id = farmer_priorities.farm_id AND (f.user_id = auth.uid() OR f.is_demo = true)
    )
  );

-- 4. Soil Records (Lab & USDA SSURGO survey measurements)
CREATE TABLE IF NOT EXISTS public.soil_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id text NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  sample_date date NOT NULL DEFAULT CURRENT_DATE,
  soil_type text NOT NULL,
  soil_ph numeric CHECK (soil_ph >= 0 AND soil_ph <= 14),
  organic_matter numeric CHECK (organic_matter >= 0 AND organic_matter <= 100),
  nitrogen text,
  phosphorus text,
  potassium text,
  cec_meq numeric,
  drainage_class text,
  source_type text NOT NULL DEFAULT 'lab_test' CHECK (source_type IN ('lab_test', 'ssurgo_survey', 'farmer_estimate')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soil_records_farm_id ON public.soil_records(farm_id, sample_date DESC);

ALTER TABLE public.soil_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read soil records for accessible farms" ON public.soil_records;
CREATE POLICY "Read soil records for accessible farms"
  ON public.soil_records FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.farms f WHERE f.id = soil_records.farm_id AND f.is_demo = true AND soil_records.user_id IS NULL)
  );

DROP POLICY IF EXISTS "Manage own soil records" ON public.soil_records;
CREATE POLICY "Manage own soil records"
  ON public.soil_records FOR ALL
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.farms f WHERE f.id = soil_records.farm_id AND f.user_id = auth.uid())
  );

-- 5. Seed 3 Baseline Demonstration Farms idempotently
INSERT INTO public.farms (
  id, user_id, is_demo, name, location, coordinates, acreage, current_crop, planting_season,
  rotation_history, soil_type, soil_ph, organic_matter, nitrogen, phosphorus, potassium, drainage, last_soil_test
) VALUES
(
  'farm-1', NULL, true, 'Prairie Ridge Valley Farm', 'Ames, Story County, Iowa, USA',
  '[-93.62, 42.03]'::jsonb, 480, 'Corn (Maize)', 'Spring 2026',
  '["Corn (2025)", "Soybeans (2024)", "Corn (2023)"]'::jsonb,
  'Clarion-Nicollet Loam', 6.4, 3.8, 'Medium (18 ppm)', 'Low (12 ppm)', 'Medium (145 ppm)', 'Moderately Well Drained', '2025-10-15'
),
(
  'farm-2', NULL, true, 'Cedar Creek Sustainable Acres', 'Salina, Saline County, Kansas, USA',
  '[-97.61, 38.84]'::jsonb, 720, 'Winter Wheat', 'Autumn 2025 - Summer 2026',
  '["Winter Wheat (2025)", "Fallow (2024)", "Sorghum (2023)"]'::jsonb,
  'Harney Silt Loam', 7.1, 2.4, 'Low (9 ppm)', 'Moderate (19 ppm)', 'High (220 ppm)', 'Well Drained', '2025-09-02'
),
(
  'farm-3', NULL, true, 'Green River Basin Organics', 'Bowling Green, Warren County, Kentucky, USA',
  '[-86.44, 36.99]'::jsonb, 310, 'Soybean', 'Late Spring 2026',
  '["Soybean (2025)", "Winter Cover Rye (2024)", "Corn (2024)"]'::jsonb,
  'Crider Silt Loam', 6.7, 4.1, 'Medium (24 ppm)', 'Optimal (28 ppm)', 'Optimal (170 ppm)', 'Well Drained (Karst sub-layer)', '2025-11-20'
)
ON CONFLICT (id) DO NOTHING;

-- 6. Harden legacy data_sources / dataset_ingestion_jobs / farm_climate_observations RLS if present
ALTER TABLE IF EXISTS public.data_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read data_sources" ON public.data_sources;
CREATE POLICY "Public read data_sources" ON public.data_sources FOR SELECT USING (true);

ALTER TABLE IF EXISTS public.dataset_ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.farm_climate_observations ENABLE ROW LEVEL SECURITY;
