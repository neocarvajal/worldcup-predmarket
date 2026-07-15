ALTER TABLE public.push_subscriptions
ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'es';

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_locale ON public.push_subscriptions(locale);
