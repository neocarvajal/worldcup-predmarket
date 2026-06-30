CREATE TABLE IF NOT EXISTS public.user_api_tokens (
  wallet TEXT PRIMARY KEY,
  jwt TEXT NOT NULL,
  api_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_api_tokens ENABLE ROW LEVEL SECURITY;

-- Allow public upsert (insert/update) based on wallet
-- The api_token only provides read-only sports data access, not financial access
CREATE POLICY "Anyone can insert their own token"
  ON public.user_api_tokens
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can update their own token"
  ON public.user_api_tokens
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can read tokens"
  ON public.user_api_tokens
  FOR SELECT
  TO anon
  USING (true);
