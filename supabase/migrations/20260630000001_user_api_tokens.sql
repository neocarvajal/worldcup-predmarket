CREATE TABLE IF NOT EXISTS public.user_api_tokens (
  wallet TEXT PRIMARY KEY,
  jwt TEXT NOT NULL,
  api_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_api_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_api_tokens' AND policyname = 'Anyone can insert their own token') THEN
    CREATE POLICY "Anyone can insert their own token"
      ON public.user_api_tokens
      FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_api_tokens' AND policyname = 'Anyone can update their own token') THEN
    CREATE POLICY "Anyone can update their own token"
      ON public.user_api_tokens
      FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_api_tokens' AND policyname = 'Anyone can read tokens') THEN
    CREATE POLICY "Anyone can read tokens"
      ON public.user_api_tokens
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
