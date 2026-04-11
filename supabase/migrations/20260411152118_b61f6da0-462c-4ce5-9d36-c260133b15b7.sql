ALTER TABLE public.profiles ADD COLUMN plan_type text NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN stripe_customer_id text;