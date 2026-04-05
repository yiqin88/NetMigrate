-- Add device_type column to custom_products if missing
-- Safe to run multiple times (idempotent)
-- Paste into Supabase SQL Editor → Run

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
