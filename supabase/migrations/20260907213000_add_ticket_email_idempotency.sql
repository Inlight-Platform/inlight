-- Track ticket confirmation email sends so webhook retries do not duplicate emails.
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS confirmation_email_send_started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS confirmation_email_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS confirmation_email_provider_id text,
  ADD COLUMN IF NOT EXISTS confirmation_email_last_error text;

CREATE INDEX IF NOT EXISTS idx_tickets_confirmation_email_sent_at
  ON public.tickets(confirmation_email_sent_at)
  WHERE confirmation_email_sent_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
