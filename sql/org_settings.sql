-- Organization settings / invite codes
-- Used by the first-launch setup wizard to validate invite codes

CREATE TABLE IF NOT EXISTS public.org_settings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code  text NOT NULL UNIQUE,
  org_name     text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_settings_invite_code_idx
  ON public.org_settings (invite_code);

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon can read org_settings"
  ON public.org_settings FOR SELECT TO anon USING (true);

-- Seed an initial invite code (change values as needed):
-- INSERT INTO public.org_settings (invite_code, org_name)
-- VALUES ('NETMIG-2024-ALPHA', 'NetMigrate Team');
