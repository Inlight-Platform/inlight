-- Prevent a user from submitting multiple pending requests for the same affiliation name.
-- Case-insensitive match via lower().
CREATE UNIQUE INDEX IF NOT EXISTS affiliation_requests_user_pending_name_unique
  ON public.affiliation_requests (user_id, lower(requested_name))
  WHERE status = 'pending';
