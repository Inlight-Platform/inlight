-- Create profile_views table for tracking when users view profiles
CREATE TABLE public.profile_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  viewer_id TEXT NOT NULL,
  viewed_profile_id TEXT NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_engagement table for tracking daily engagement metrics
CREATE TABLE public.user_engagement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  profile_views INTEGER NOT NULL DEFAULT 0,
  messages_sent INTEGER NOT NULL DEFAULT 0,
  messages_received INTEGER NOT NULL DEFAULT 0,
  connections_made INTEGER NOT NULL DEFAULT 0,
  story_views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create film_metrics table for box office data
CREATE TABLE public.film_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  studio TEXT NOT NULL,
  weekend_gross DECIMAL(15,2) NOT NULL,
  total_gross DECIMAL(15,2) NOT NULL,
  week_change DECIMAL(5,2) NOT NULL DEFAULT 0,
  rating DECIMAL(3,1) NOT NULL DEFAULT 0,
  weeks_in_release INTEGER NOT NULL DEFAULT 1,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create broadway_metrics table for theatre data
CREATE TABLE public.broadway_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  theater TEXT NOT NULL,
  show_type TEXT NOT NULL CHECK (show_type IN ('musical', 'play')),
  weekly_gross DECIMAL(15,2) NOT NULL,
  attendance INTEGER NOT NULL DEFAULT 0,
  capacity_percentage INTEGER NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create industry_highlights table for news snippets
CREATE TABLE public.industry_highlights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.film_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadway_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industry_highlights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profile_views (users can only see views of their own profile)
CREATE POLICY "Users can view their own profile views" 
ON public.profile_views 
FOR SELECT 
USING (viewed_profile_id = current_setting('app.current_user_id', true));

CREATE POLICY "Anyone can insert profile views" 
ON public.profile_views 
FOR INSERT 
WITH CHECK (true);

-- RLS Policies for user_engagement (users can only see their own engagement)
CREATE POLICY "Users can view their own engagement" 
ON public.user_engagement 
FOR SELECT 
USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Anyone can insert engagement" 
ON public.user_engagement 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update engagement" 
ON public.user_engagement 
FOR UPDATE 
USING (true);

-- RLS Policies for public industry data (readable by everyone)
CREATE POLICY "Film metrics are publicly readable" 
ON public.film_metrics 
FOR SELECT 
USING (true);

CREATE POLICY "Broadway metrics are publicly readable" 
ON public.broadway_metrics 
FOR SELECT 
USING (true);

CREATE POLICY "Industry highlights are publicly readable" 
ON public.industry_highlights 
FOR SELECT 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_profile_views_viewed_profile ON public.profile_views(viewed_profile_id);
CREATE INDEX idx_profile_views_viewed_at ON public.profile_views(viewed_at);
CREATE INDEX idx_user_engagement_user_date ON public.user_engagement(user_id, date);
CREATE INDEX idx_film_metrics_date ON public.film_metrics(date);
CREATE INDEX idx_broadway_metrics_date ON public.broadway_metrics(date);

-- Create function to update engagement timestamps
CREATE OR REPLACE FUNCTION public.update_engagement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates on engagement
CREATE TRIGGER update_user_engagement_updated_at
BEFORE UPDATE ON public.user_engagement
FOR EACH ROW
EXECUTE FUNCTION public.update_engagement_updated_at();