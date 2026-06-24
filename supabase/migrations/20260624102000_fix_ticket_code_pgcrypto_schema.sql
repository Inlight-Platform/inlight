CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  exists_count int;
BEGIN
  LOOP
    new_code := encode(extensions.gen_random_bytes(12), 'hex');
    SELECT COUNT(*) INTO exists_count FROM public.tickets WHERE ticket_code = new_code;
    EXIT WHEN exists_count = 0;
  END LOOP;

  RETURN new_code;
END;
$$;
