-- FieldShift Migration 003: Demo Farm Integrity & RLS Hardening
-- Ensures demo farms (`farm-1`, `farm-2`, `farm-3`) strictly have user_id IS NULL and is_demo = true,
-- optimizes per-dataset observation & ingestion job queries, and tightens public demo vs user isolation.

-- 1. Ensure baseline demo farms maintain strict demo invariants
UPDATE public.farms
SET user_id = NULL, is_demo = true
WHERE id IN ('farm-1', 'farm-2', 'farm-3');

ALTER TABLE public.farms
  DROP CONSTRAINT IF EXISTS chk_farms_demo_no_owner;

ALTER TABLE public.farms
  ADD CONSTRAINT chk_farms_demo_no_owner
  CHECK (NOT is_demo OR user_id IS NULL);

-- 2. Prevent user_id = NULL public observations on non-demo farms
ALTER TABLE public.nasa_observations
  DROP CONSTRAINT IF EXISTS chk_nasa_obs_public_scope_consistency;

ALTER TABLE public.nasa_observations
  ADD CONSTRAINT chk_nasa_obs_public_scope_consistency
  CHECK (
    (user_id IS NULL AND scope_owner_id = 'public')
    OR (user_id IS NOT NULL AND scope_owner_id = user_id::text)
  );

-- 3. Composite indexes so daily NASA POWER volume never slows or evicts 16-day MODIS/CMR queries
CREATE INDEX IF NOT EXISTS idx_nasa_obs_farm_scope_dataset_observed
  ON public.nasa_observations(farm_id, scope_owner_id, dataset_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_farm_dataset_user_created
  ON public.ingestion_jobs(farm_id, dataset_id, user_id, created_at DESC);

-- 4. Tighten SELECT RLS policies for public demo environmental records (`user_id IS NULL`)
DROP POLICY IF EXISTS "Read accessible NASA observations" ON public.nasa_observations;
CREATE POLICY "Read accessible NASA observations"
  ON public.nasa_observations FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      user_id IS NULL
      AND scope_owner_id = 'public'
      AND EXISTS (
        SELECT 1 FROM public.farms f
        WHERE f.id = nasa_observations.farm_id
          AND f.is_demo = true
          AND f.user_id IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "Read accessible ingestion jobs" ON public.ingestion_jobs;
CREATE POLICY "Read accessible ingestion jobs"
  ON public.ingestion_jobs FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      user_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.farms f
        WHERE f.id = ingestion_jobs.farm_id
          AND f.is_demo = true
          AND f.user_id IS NULL
      )
    )
  );
