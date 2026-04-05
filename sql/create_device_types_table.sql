-- Create device_types table for user-defined device types
-- Safe to run multiple times (idempotent)
-- Paste into Supabase SQL Editor → Run

CREATE TABLE IF NOT EXISTS public.device_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  label      text NOT NULL,
  icon       text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Also ensure device_type column exists on custom_products
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'custom_products'
      AND column_name  = 'device_type'
  ) THEN
    ALTER TABLE public.custom_products ADD COLUMN device_type text DEFAULT 'switch';
  END IF;
END $$;
