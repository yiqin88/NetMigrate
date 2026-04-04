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


-- ── 3. Custom vendors table ──────────────────────────────────────────────────
-- User-defined vendors that sync across all app instances

CREATE TABLE IF NOT EXISTS public.custom_vendors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   text NOT NULL UNIQUE,
  name        text NOT NULL,
  color       text DEFAULT '#888888',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_vendors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='custom_vendors' AND policyname='anon can select custom_vendors') THEN
    CREATE POLICY "anon can select custom_vendors" ON public.custom_vendors FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='custom_vendors' AND policyname='anon can insert custom_vendors') THEN
    CREATE POLICY "anon can insert custom_vendors" ON public.custom_vendors FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='custom_vendors' AND policyname='anon can delete custom_vendors') THEN
    CREATE POLICY "anon can delete custom_vendors" ON public.custom_vendors FOR DELETE TO anon USING (true);
  END IF;
END $$;


-- ── 4. Custom products table ────────────────────────────────────────────────
-- User-defined products under vendors, synced across all app instances

CREATE TABLE IF NOT EXISTS public.custom_products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  text NOT NULL UNIQUE,
  name        text NOT NULL,
  full_name   text NOT NULL,
  vendor_id   text NOT NULL,
  vendor_name text,
  color       text DEFAULT '#888888',
  description text,
  role        text NOT NULL DEFAULT 'both' CHECK (role IN ('source', 'target', 'both')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='custom_products' AND policyname='anon can select custom_products') THEN
    CREATE POLICY "anon can select custom_products" ON public.custom_products FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='custom_products' AND policyname='anon can insert custom_products') THEN
    CREATE POLICY "anon can insert custom_products" ON public.custom_products FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='custom_products' AND policyname='anon can update custom_products') THEN
    CREATE POLICY "anon can update custom_products" ON public.custom_products FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='custom_products' AND policyname='anon can delete custom_products') THEN
    CREATE POLICY "anon can delete custom_products" ON public.custom_products FOR DELETE TO anon USING (true);
  END IF;
END $$;


-- ── 5. Command Knowledge Base table ─────────────────────────────────────────
-- Verified CLI command mappings between vendor platforms

CREATE TABLE IF NOT EXISTS public.command_knowledge_base (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_vendor     text NOT NULL,
  source_product    text NOT NULL,
  target_vendor     text NOT NULL,
  target_product    text NOT NULL,
  source_command    text NOT NULL,
  target_command    text NOT NULL,
  category          text NOT NULL DEFAULT 'other' CHECK (category IN ('vlan','interface','routing','aaa','stp','lag','other')),
  confidence        text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  verified_by_human boolean NOT NULL DEFAULT false,
  source_type       text DEFAULT 'manual' CHECK (source_type IN ('doc_upload','web_search','manual','training')),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_product_pair_idx
  ON public.command_knowledge_base (source_product, target_product, category);

CREATE INDEX IF NOT EXISTS kb_category_idx
  ON public.command_knowledge_base (category, confidence);

ALTER TABLE public.command_knowledge_base ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='command_knowledge_base' AND policyname='anon can select kb') THEN
    CREATE POLICY "anon can select kb" ON public.command_knowledge_base FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='command_knowledge_base' AND policyname='anon can insert kb') THEN
    CREATE POLICY "anon can insert kb" ON public.command_knowledge_base FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='command_knowledge_base' AND policyname='anon can update kb') THEN
    CREATE POLICY "anon can update kb" ON public.command_knowledge_base FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='command_knowledge_base' AND policyname='anon can delete kb') THEN
    CREATE POLICY "anon can delete kb" ON public.command_knowledge_base FOR DELETE TO anon USING (true);
  END IF;
END $$;


-- ── Verification ────────────────────────────────────────────────────────────
-- Run these after the script to verify everything is correct:

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'migrations' ORDER BY ordinal_position;

-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'training_examples' ORDER BY ordinal_position;
