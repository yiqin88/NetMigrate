-- ============================================================================
-- NetMigrate — Complete Supabase Schema
-- Run this entire script in the Supabase SQL Editor to create/fix all tables
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS checks)
-- ============================================================================

-- ── 1. Migrations table ─────────────────────────────────────────────────────
-- Stores every approved config migration + quality signals for the AI learning system

CREATE TABLE IF NOT EXISTS public.migrations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_vendor      text NOT NULL,
  target_vendor      text NOT NULL,
  source_config      text NOT NULL,
  converted_config   text NOT NULL,
  accuracy_rating    smallint NOT NULL CHECK (accuracy_rating BETWEEN 1 AND 5),
  corrections_made   int NOT NULL DEFAULT 0,
  conversion_summary jsonb,
  warnings           jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS migrations_vendor_pair_idx
  ON public.migrations (source_vendor, target_vendor, created_at DESC);

CREATE INDEX IF NOT EXISTS migrations_created_at_idx
  ON public.migrations (created_at DESC);

-- RLS
ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'migrations' AND policyname = 'anon can select migrations') THEN
    CREATE POLICY "anon can select migrations" ON public.migrations FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'migrations' AND policyname = 'anon can insert migrations') THEN
    CREATE POLICY "anon can insert migrations" ON public.migrations FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'migrations' AND policyname = 'anon can update migrations') THEN
    CREATE POLICY "anon can update migrations" ON public.migrations FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ── 2. Training examples table ──────────────────────────────────────────────
-- Stores curated config pairs uploaded by engineers to improve conversion accuracy

CREATE TABLE IF NOT EXISTS public.training_examples (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_vendor      text NOT NULL,
  target_vendor      text NOT NULL,
  source_config      text NOT NULL,
  converted_config   text NOT NULL,
  description        text,
  command_mappings   jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Add command_mappings column if table already exists but column is missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'training_examples'
      AND column_name = 'command_mappings'
  ) THEN
    ALTER TABLE public.training_examples ADD COLUMN command_mappings jsonb;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS training_examples_vendor_pair_idx
  ON public.training_examples (source_vendor, target_vendor, created_at DESC);

-- RLS
ALTER TABLE public.training_examples ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_examples' AND policyname = 'anon can select training_examples') THEN
    CREATE POLICY "anon can select training_examples" ON public.training_examples FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_examples' AND policyname = 'anon can insert training_examples') THEN
    CREATE POLICY "anon can insert training_examples" ON public.training_examples FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_examples' AND policyname = 'anon can delete training_examples') THEN
    CREATE POLICY "anon can delete training_examples" ON public.training_examples FOR DELETE TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'training_examples' AND policyname = 'anon can update training_examples') THEN
    CREATE POLICY "anon can update training_examples" ON public.training_examples FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ── Verification ────────────────────────────────────────────────────────────
-- Run these after the script to verify everything is correct:

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'migrations' ORDER BY ordinal_position;

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'training_examples' ORDER BY ordinal_position;
