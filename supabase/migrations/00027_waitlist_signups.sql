-- Migration: 00027_waitlist_signups
-- Purpose: Landing page email capture + compliance calculator results
-- Context: Validation sprint Day 4 — AML/CTF wedge landing page

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'hero',        -- hero | calculator | footer | dd-checklist
  variant TEXT,                                -- A|B|C|D|E|F headline variant
  ref TEXT,                                    -- outreach attribution (e.g. 'dion-marsden')
  compliance_score INTEGER,                    -- 0-100 from calculator (nullable)
  compliance_answers JSONB,                    -- raw calculator responses
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,                             -- for dedup, nullable

  CONSTRAINT waitlist_signups_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT waitlist_signups_source_check CHECK (source IN ('hero', 'calculator', 'footer', 'dd-checklist'))
);

-- Unique constraint on email to prevent duplicates (upsert on re-submit)
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_signups_email_unique ON public.waitlist_signups (email);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS waitlist_signups_created_at_idx ON public.waitlist_signups (created_at DESC);
CREATE INDEX IF NOT EXISTS waitlist_signups_source_idx ON public.waitlist_signups (source);

-- RLS: service-role insert only, no public read
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anon role (landing page visitors aren't authenticated)
CREATE POLICY "Anyone can sign up for waitlist"
  ON public.waitlist_signups
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- No SELECT/UPDATE/DELETE for anon — only service role can read
CREATE POLICY "Service role can read waitlist"
  ON public.waitlist_signups
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can manage waitlist"
  ON public.waitlist_signups
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
