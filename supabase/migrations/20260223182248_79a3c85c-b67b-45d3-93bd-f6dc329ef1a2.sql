
-- Create event_rsvps table for Partiful-style RSVPs
CREATE TABLE public.event_rsvps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role_type TEXT NOT NULL DEFAULT 'actor', -- 'actor' or 'filmmaker'
  status TEXT NOT NULL DEFAULT 'going', -- 'going' or 'cant_make_it'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can see who's attending
CREATE POLICY "RSVPs are publicly viewable"
ON public.event_rsvps FOR SELECT
USING (true);

-- Authenticated users can RSVP
CREATE POLICY "Authenticated users can RSVP"
ON public.event_rsvps FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own RSVP
CREATE POLICY "Users can update their own RSVP"
ON public.event_rsvps FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own RSVP
CREATE POLICY "Users can delete their own RSVP"
ON public.event_rsvps FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for live counter
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps;

-- Trigger for updated_at
CREATE TRIGGER update_event_rsvps_updated_at
BEFORE UPDATE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
