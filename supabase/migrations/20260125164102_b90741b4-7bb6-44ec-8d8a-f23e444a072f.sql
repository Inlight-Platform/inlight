-- NYC Shows/Productions table
CREATE TABLE public.nyc_shows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  venue TEXT NOT NULL,
  borough TEXT NOT NULL DEFAULT 'Manhattan',
  description TEXT,
  poster_url TEXT,
  show_type TEXT NOT NULL DEFAULT 'play', -- musical, play, opera, dance, other
  category TEXT NOT NULL DEFAULT 'broadway', -- broadway, off-broadway, off-off-broadway
  price_tier TEXT NOT NULL DEFAULT 'moderate', -- budget, moderate, premium
  run_start DATE,
  run_end DATE,
  show_times TEXT, -- JSON string for schedule
  accessibility_features TEXT[], -- wheelchair, hearing-loop, asl, audio-description
  rush_policy TEXT,
  lottery_info TEXT,
  official_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nyc_shows ENABLE ROW LEVEL SECURITY;

-- Everyone can view shows
CREATE POLICY "Shows are viewable by everyone" 
ON public.nyc_shows 
FOR SELECT 
USING (true);

-- User saved shows
CREATE TABLE public.saved_shows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  show_id UUID NOT NULL REFERENCES public.nyc_shows(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  remind_closing BOOLEAN DEFAULT false,
  remind_ticket_release BOOLEAN DEFAULT false,
  notes TEXT,
  UNIQUE(user_id, show_id)
);

ALTER TABLE public.saved_shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their saved shows" 
ON public.saved_shows FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can save shows" 
ON public.saved_shows FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved shows" 
ON public.saved_shows FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can unsave shows" 
ON public.saved_shows FOR DELETE 
USING (auth.uid() = user_id);

-- Community tips/notes for shows
CREATE TABLE public.show_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID NOT NULL REFERENCES public.nyc_shows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  tip_type TEXT NOT NULL DEFAULT 'general', -- seating, rush, vibe, food-nearby, date-night, family-friendly
  content TEXT NOT NULL,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.show_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tips are viewable by everyone" 
ON public.show_tips FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create tips" 
ON public.show_tips FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tips" 
ON public.show_tips FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tips" 
ON public.show_tips FOR DELETE 
USING (auth.uid() = user_id);

-- Helpful votes for tips
CREATE TABLE public.tip_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tip_id UUID NOT NULL REFERENCES public.show_tips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tip_id, user_id)
);

ALTER TABLE public.tip_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes are viewable by everyone" 
ON public.tip_votes FOR SELECT 
USING (true);

CREATE POLICY "Users can vote" 
ON public.tip_votes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their vote" 
ON public.tip_votes FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger to update helpful_count
CREATE OR REPLACE FUNCTION public.update_tip_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.show_tips SET helpful_count = helpful_count + 1 WHERE id = NEW.tip_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.show_tips SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = OLD.tip_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_helpful_count
AFTER INSERT OR DELETE ON public.tip_votes
FOR EACH ROW
EXECUTE FUNCTION public.update_tip_helpful_count();

-- User show reminders preferences
CREATE TABLE public.show_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  show_id UUID NOT NULL REFERENCES public.nyc_shows(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- closing_soon, ticket_release, price_drop
  remind_date DATE,
  is_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, show_id, reminder_type)
);

ALTER TABLE public.show_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their reminders" 
ON public.show_reminders FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create reminders" 
ON public.show_reminders FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their reminders" 
ON public.show_reminders FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their reminders" 
ON public.show_reminders FOR DELETE 
USING (auth.uid() = user_id);

-- Add some sample NYC shows
INSERT INTO public.nyc_shows (title, venue, borough, description, show_type, category, price_tier, run_start, run_end, accessibility_features, rush_policy) VALUES
('The Great Gatsby', 'Broadway Theatre', 'Manhattan', 'A stunning immersive experience bringing F. Scott Fitzgerald''s masterpiece to life with jazz, dance, and drama.', 'musical', 'broadway', 'premium', '2024-04-25', '2025-06-30', ARRAY['wheelchair', 'hearing-loop'], 'Digital lottery available daily'),
('Hamilton', 'Richard Rodgers Theatre', 'Manhattan', 'The revolutionary musical that changed Broadway forever. Lin-Manuel Miranda''s hip-hop retelling of American history.', 'musical', 'broadway', 'premium', '2015-08-06', NULL, ARRAY['wheelchair', 'hearing-loop', 'asl'], '$10 lottery via Hamilton app'),
('Wicked', 'Gershwin Theatre', 'Manhattan', 'The untold story of the witches of Oz. A magical prequel to The Wizard of Oz that will leave you spellbound.', 'musical', 'broadway', 'premium', '2003-10-30', NULL, ARRAY['wheelchair', 'hearing-loop'], 'Rush tickets available at box office'),
('The Outsiders', 'Bernard B. Jacobs Theatre', 'Manhattan', 'Stay gold. The beloved novel becomes a powerful new musical about brotherhood, belonging, and the bonds that save us.', 'musical', 'broadway', 'moderate', '2024-04-11', '2025-04-20', ARRAY['wheelchair', 'audio-description'], 'Digital lottery daily'),
('Little Shop of Horrors', 'Westside Theatre', 'Manhattan', 'Feed me, Seymour! The sci-fi horror comedy musical about a man-eating plant with soul.', 'musical', 'off-broadway', 'moderate', '2019-10-17', NULL, ARRAY['wheelchair'], 'Rush available 1hr before show'),
('Drunk Shakespeare', 'The Lounge', 'Manhattan', 'One actor has 5 shots of whiskey, then the company attempts Shakespeare. Hilarity ensues.', 'play', 'off-broadway', 'budget', '2014-06-01', NULL, ARRAY['wheelchair'], NULL),
('Sleep No More', 'The McKittrick Hotel', 'Manhattan', 'The groundbreaking immersive theatre experience. Wander through a noir Macbeth in a 1930s hotel.', 'play', 'off-broadway', 'premium', '2011-03-07', NULL, ARRAY['wheelchair'], 'Limited accessibility due to immersive nature'),
('STOMP', 'Orpheum Theatre', 'Manhattan', 'The international percussion sensation. Eight performers transform ordinary objects into extraordinary music.', 'other', 'off-broadway', 'moderate', '1994-02-27', NULL, ARRAY['wheelchair', 'hearing-loop'], NULL),
('The Play That Goes Wrong', 'New World Stages', 'Manhattan', 'A 1920s murder mystery goes hilariously, spectacularly wrong. Physical comedy at its finest.', 'play', 'off-broadway', 'moderate', '2017-04-02', NULL, ARRAY['wheelchair'], NULL),
('Hadestown', 'Walter Kerr Theatre', 'Manhattan', 'Way down under the ground... A folk-opera journey to the underworld retelling the myth of Orpheus and Eurydice.', 'musical', 'broadway', 'premium', '2019-04-17', NULL, ARRAY['wheelchair', 'hearing-loop', 'audio-description'], 'Lottery via TodayTix'),
('Back to the Future', 'Winter Garden Theatre', 'Manhattan', 'Great Scott! The beloved film becomes a thrilling musical adventure through time.', 'musical', 'broadway', 'premium', '2023-06-30', NULL, ARRAY['wheelchair', 'hearing-loop'], 'Digital lottery daily'),
('Water for Elephants', 'Imperial Theatre', 'Manhattan', 'A breathtaking circus romance. Acrobatics, live music, and a love story set in a Depression-era circus.', 'musical', 'broadway', 'moderate', '2024-03-21', '2025-03-30', ARRAY['wheelchair', 'asl'], 'Rush available at box office'),
('Blindness', 'Daryl Roth Theatre', 'Manhattan', 'An audio experience in total darkness. A gripping story of survival when the world loses its sight.', 'play', 'off-broadway', 'budget', '2021-04-02', '2025-02-28', ARRAY['wheelchair', 'audio-description'], NULL),
('NYC Ballet: Nutcracker', 'Lincoln Center', 'Manhattan', 'The magical holiday tradition returns. George Balanchine''s beloved production with live orchestra.', 'dance', 'broadway', 'premium', '2024-11-29', '2025-01-05', ARRAY['wheelchair', 'hearing-loop'], NULL),
('La MaMa Experimental', 'La MaMa Theatre', 'Manhattan', 'Boundary-pushing experimental theatre from one of NYC''s most legendary downtown venues.', 'play', 'off-off-broadway', 'budget', '2024-01-01', NULL, ARRAY['wheelchair'], 'Pay-what-you-can Thursdays');

-- Add some sample tips
INSERT INTO public.show_tips (show_id, user_id, tip_type, content, helpful_count) 
SELECT 
  id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'seating',
  CASE 
    WHEN title = 'Hamilton' THEN 'Mezzanine center has the best view of the turntable choreography!'
    WHEN title = 'Wicked' THEN 'Orchestra left side for best Defying Gravity moment'
    WHEN title = 'Sleep No More' THEN 'Wear comfortable shoes - you''ll walk miles. Follow the nurse for the best storyline.'
    ELSE 'Orchestra center is always a safe bet'
  END,
  floor(random() * 50)::int
FROM public.nyc_shows
WHERE title IN ('Hamilton', 'Wicked', 'Sleep No More', 'The Great Gatsby');