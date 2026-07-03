CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_wallet ON public.push_subscriptions(wallet);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert push subscription"
  ON public.push_subscriptions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can read push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can delete push subscriptions"
  ON public.push_subscriptions
  FOR DELETE
  TO anon
  USING (true);
