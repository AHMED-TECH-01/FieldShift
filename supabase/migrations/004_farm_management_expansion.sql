-- FieldShift Migration 004: Complete Add Farm Management Schema & RLS Hardening
-- Idempotent migration expanding public.farms with structured geography, units,
-- operational metadata, nullable optional soil attributes, and strict user ownership.

-- 1. Add structured geographic, area, agricultural, and optional priority fields
ALTER TABLE public.farms
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS area numeric,
  ADD COLUMN IF NOT EXISTS area_unit text NOT NULL DEFAULT 'acres',
  ADD COLUMN IF NOT EXISTS farm_type text,
  ADD COLUMN IF NOT EXISTS operating_status text,
  ADD COLUMN IF NOT EXISTS previous_crop text,
  ADD COLUMN IF NOT EXISTS irrigation_type text,
  ADD COLUMN IF NOT EXISTS harvest_season text,
  ADD COLUMN IF NOT EXISTS farmer_priorities jsonb;

-- 2. Remove synthetic NOT NULL defaults from optional laboratory soil columns so missing
--    soil measurements remain authentically NULL rather than fabricated values.
ALTER TABLE public.farms
  ALTER COLUMN soil_type DROP NOT NULL,
  ALTER COLUMN soil_type DROP DEFAULT,
  ALTER COLUMN soil_ph DROP NOT NULL,
  ALTER COLUMN soil_ph DROP DEFAULT,
  ALTER COLUMN organic_matter DROP NOT NULL,
  ALTER COLUMN organic_matter DROP DEFAULT,
  ALTER COLUMN nitrogen DROP NOT NULL,
  ALTER COLUMN nitrogen DROP DEFAULT,
  ALTER COLUMN phosphorus DROP NOT NULL,
  ALTER COLUMN phosphorus DROP DEFAULT,
  ALTER COLUMN potassium DROP NOT NULL,
  ALTER COLUMN potassium DROP DEFAULT,
  ALTER COLUMN drainage DROP NOT NULL,
  ALTER COLUMN drainage DROP DEFAULT,
  ALTER COLUMN last_soil_test DROP NOT NULL,
  ALTER COLUMN last_soil_test DROP DEFAULT;

-- 3. Drop legacy inline constraints that conflict with NULL optional soil values and apply named constraints
DO $$
DECLARE
  c_rec record;
BEGIN
  FOR c_rec IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.farms'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) ILIKE '%soil_ph%'
        OR pg_get_constraintdef(oid) ILIKE '%organic_matter%'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.farms DROP CONSTRAINT IF EXISTS %I', c_rec.conname);
  END LOOP;
END $$;

ALTER TABLE public.farms
  DROP CONSTRAINT IF EXISTS chk_farms_area_unit,
  DROP CONSTRAINT IF EXISTS chk_farms_area_positive,
  DROP CONSTRAINT IF EXISTS chk_farms_latitude_range,
  DROP CONSTRAINT IF EXISTS chk_farms_longitude_range,
  DROP CONSTRAINT IF EXISTS chk_farms_soil_ph_range,
  DROP CONSTRAINT IF EXISTS chk_farms_organic_matter_range,
  DROP CONSTRAINT IF EXISTS chk_farms_demo_no_owner;

ALTER TABLE public.farms
  ADD CONSTRAINT chk_farms_area_unit CHECK (area_unit IN ('acres', 'hectares')),
  ADD CONSTRAINT chk_farms_area_positive CHECK (area IS NULL OR area > 0),
  ADD CONSTRAINT chk_farms_latitude_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  ADD CONSTRAINT chk_farms_longitude_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  ADD CONSTRAINT chk_farms_soil_ph_range CHECK (soil_ph IS NULL OR (soil_ph >= 0 AND soil_ph <= 14)),
  ADD CONSTRAINT chk_farms_organic_matter_range CHECK (organic_matter IS NULL OR (organic_matter >= 0 AND organic_matter <= 100)),
  ADD CONSTRAINT chk_farms_demo_no_owner CHECK (NOT is_demo OR user_id IS NULL);

-- 4. Backfill coordinates, area, and structured location fields for existing seeded demo farms cleanly
UPDATE public.farms
SET
  country = COALESCE(country, 'United States'),
  state = COALESCE(state, CASE id
    WHEN 'farm-1' THEN 'Iowa'
    WHEN 'farm-2' THEN 'Kansas'
    WHEN 'farm-3' THEN 'Kentucky'
    ELSE state
  END),
  city = COALESCE(city, CASE id
    WHEN 'farm-1' THEN 'Ames'
    WHEN 'farm-2' THEN 'Salina'
    WHEN 'farm-3' THEN 'Bowling Green'
    ELSE city
  END),
  longitude = COALESCE(longitude, NULLIF(coordinates->>0, '')::double precision),
  latitude = COALESCE(latitude, NULLIF(coordinates->>1, '')::double precision),
  area = COALESCE(area, acreage),
  area_unit = COALESCE(NULLIF(area_unit, ''), 'acres'),
  farm_type = COALESCE(farm_type, 'Row Crop & Regenerative Trial'),
  operating_status = COALESCE(operating_status, 'Active')
WHERE id IN ('farm-1', 'farm-2', 'farm-3')
   OR (latitude IS NULL AND jsonb_typeof(coordinates) = 'array' AND jsonb_array_length(coordinates) = 2);

-- 5. Indexes & per-user farm name uniqueness for user-owned farms
CREATE INDEX IF NOT EXISTS idx_farms_created_at ON public.farms(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_farms_user_created ON public.farms(user_id, created_at DESC);

DROP INDEX IF EXISTS idx_farms_user_name_unique;
CREATE UNIQUE INDEX idx_farms_user_name_unique
  ON public.farms(user_id, LOWER(TRIM(name)))
  WHERE user_id IS NOT NULL AND is_demo = false;

-- 6. Re-assert Row Level Security (RLS) policies on public.farms
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read demo or owned farms" ON public.farms;
CREATE POLICY "Read demo or owned farms"
  ON public.farms FOR SELECT
  USING (
    (is_demo = true AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "Insert owned farms" ON public.farms;
CREATE POLICY "Insert owned farms"
  ON public.farms FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND is_demo = false
  );

DROP POLICY IF EXISTS "Update owned farms" ON public.farms;
CREATE POLICY "Update owned farms"
  ON public.farms FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id AND is_demo = false)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id AND is_demo = false);

DROP POLICY IF EXISTS "Delete owned farms" ON public.farms;
CREATE POLICY "Delete owned farms"
  ON public.farms FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id AND is_demo = false);
