-- Add paid event fields to events table
ALTER TABLE public.events
  ADD COLUMN is_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN price numeric(10,2) DEFAULT NULL,
  ADD COLUMN currency text NOT NULL DEFAULT 'usd',
  ADD COLUMN stripe_price_id text DEFAULT NULL;

-- Create tickets table
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stripe_session_id text,
  status text NOT NULL DEFAULT 'pending',
  amount_paid numeric(10,2),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Users can view their own tickets
CREATE POLICY "Users can view their own tickets"
  ON public.tickets FOR SELECT
  USING (auth.uid() = user_id);

-- Event hosts can view tickets for their events
CREATE POLICY "Event hosts can view event tickets"
  ON public.tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = tickets.event_id AND e.user_id = auth.uid()
    )
  );

-- Allow inserts (used by edge functions with service role, but also allow authenticated)
CREATE POLICY "Authenticated users can create tickets"
  ON public.tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();