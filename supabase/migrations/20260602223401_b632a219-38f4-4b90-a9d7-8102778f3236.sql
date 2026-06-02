ALTER TABLE public.nyc_shows ADD COLUMN IF NOT EXISTS saves_count INTEGER DEFAULT 0;

UPDATE public.nyc_shows
SET saves_count = (
  SELECT COUNT(*) FROM public.saved_shows WHERE saved_shows.show_id = nyc_shows.id
);

CREATE OR REPLACE FUNCTION public.update_show_saves_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.nyc_shows SET saves_count = COALESCE(saves_count, 0) + 1 WHERE id = NEW.show_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.nyc_shows SET saves_count = GREATEST(0, COALESCE(saves_count, 0) - 1) WHERE id = OLD.show_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_show_saves_count ON public.saved_shows;
CREATE TRIGGER trigger_update_show_saves_count
AFTER INSERT OR DELETE ON public.saved_shows
FOR EACH ROW
EXECUTE FUNCTION public.update_show_saves_count();
