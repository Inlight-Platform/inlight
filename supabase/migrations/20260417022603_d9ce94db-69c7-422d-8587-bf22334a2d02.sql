-- Add activity_score column to profiles for ranking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS activity_score integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_profiles_activity_score ON public.profiles (activity_score DESC);

-- Helper to bump score safely
CREATE OR REPLACE FUNCTION public.bump_activity_score(_user_id uuid, _delta int)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET activity_score = GREATEST(0, activity_score + _delta)
  WHERE user_id = _user_id;
$$;

-- 1. event RSVPs (going) — weight 2
CREATE OR REPLACE FUNCTION public.score_event_rsvp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NOT NULL AND NEW.status = 'going' THEN
      PERFORM public.bump_activity_score(NEW.user_id, 2);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.user_id IS NOT NULL THEN
      IF OLD.status <> 'going' AND NEW.status = 'going' THEN
        PERFORM public.bump_activity_score(NEW.user_id, 2);
      ELSIF OLD.status = 'going' AND NEW.status <> 'going' THEN
        PERFORM public.bump_activity_score(NEW.user_id, -2);
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.user_id IS NOT NULL AND OLD.status = 'going' THEN
      PERFORM public.bump_activity_score(OLD.user_id, -2);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_score_event_rsvp ON public.event_rsvps;
CREATE TRIGGER trg_score_event_rsvp
AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.score_event_rsvp();

-- 2. tickets — weight 2
CREATE OR REPLACE FUNCTION public.score_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NOT NULL THEN
      PERFORM public.bump_activity_score(NEW.user_id, 2);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.user_id IS NOT NULL THEN
      PERFORM public.bump_activity_score(OLD.user_id, -2);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_score_ticket ON public.tickets;
CREATE TRIGGER trg_score_ticket
AFTER INSERT OR DELETE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.score_ticket();

-- 3. vouches received — weight 3 (in addition to existing vouch_count trigger)
CREATE OR REPLACE FUNCTION public.score_vouch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.bump_activity_score(NEW.vouched_for_id, 3);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.bump_activity_score(OLD.vouched_for_id, -3);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_score_vouch ON public.vouches;
CREATE TRIGGER trg_score_vouch
AFTER INSERT OR DELETE ON public.vouches
FOR EACH ROW EXECUTE FUNCTION public.score_vouch();

-- 4. role applications — weight 1
CREATE OR REPLACE FUNCTION public.score_role_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.bump_activity_score(NEW.applicant_id, 1);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.bump_activity_score(OLD.applicant_id, -1);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_score_role_application ON public.role_applications;
CREATE TRIGGER trg_score_role_application
AFTER INSERT OR DELETE ON public.role_applications
FOR EACH ROW EXECUTE FUNCTION public.score_role_application();

-- 5. opportunity applications — weight 1
CREATE OR REPLACE FUNCTION public.score_opportunity_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.bump_activity_score(NEW.applicant_id, 1);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.bump_activity_score(OLD.applicant_id, -1);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_score_opportunity_application ON public.opportunity_applications;
CREATE TRIGGER trg_score_opportunity_application
AFTER INSERT OR DELETE ON public.opportunity_applications
FOR EACH ROW EXECUTE FUNCTION public.score_opportunity_application();

-- Backfill existing data
UPDATE public.profiles p SET activity_score = 0;

UPDATE public.profiles p SET activity_score = activity_score + sub.delta
FROM (
  SELECT user_id, COUNT(*) * 2 AS delta
  FROM public.event_rsvps
  WHERE user_id IS NOT NULL AND status = 'going'
  GROUP BY user_id
) sub WHERE p.user_id = sub.user_id;

UPDATE public.profiles p SET activity_score = activity_score + sub.delta
FROM (
  SELECT user_id, COUNT(*) * 2 AS delta
  FROM public.tickets
  WHERE user_id IS NOT NULL
  GROUP BY user_id
) sub WHERE p.user_id = sub.user_id;

UPDATE public.profiles p SET activity_score = activity_score + sub.delta
FROM (
  SELECT vouched_for_id AS user_id, COUNT(*) * 3 AS delta
  FROM public.vouches
  GROUP BY vouched_for_id
) sub WHERE p.user_id = sub.user_id;

UPDATE public.profiles p SET activity_score = activity_score + sub.delta
FROM (
  SELECT applicant_id AS user_id, COUNT(*) * 1 AS delta
  FROM public.role_applications
  GROUP BY applicant_id
) sub WHERE p.user_id = sub.user_id;

UPDATE public.profiles p SET activity_score = activity_score + sub.delta
FROM (
  SELECT applicant_id AS user_id, COUNT(*) * 1 AS delta
  FROM public.opportunity_applications
  GROUP BY applicant_id
) sub WHERE p.user_id = sub.user_id;