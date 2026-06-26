-- Prevent two users from having simultaneous pending requests in opposite directions.
-- If mirrored pending rows already exist, keep the earliest request active and reject the later mirror.
ALTER TABLE public.connection_requests
DROP CONSTRAINT IF EXISTS connection_requests_sender_id_receiver_id_key;

WITH mirrored_pending AS (
  SELECT
    newer.id
  FROM public.connection_requests newer
  JOIN public.connection_requests older
    ON newer.sender_id = older.receiver_id
   AND newer.receiver_id = older.sender_id
   AND newer.status = 'pending'
   AND older.status = 'pending'
   AND (
     newer.created_at > older.created_at
     OR (newer.created_at = older.created_at AND newer.id > older.id)
   )
)
UPDATE public.connection_requests cr
SET status = 'rejected',
    updated_at = now()
FROM mirrored_pending mp
WHERE cr.id = mp.id;

CREATE UNIQUE INDEX IF NOT EXISTS connection_requests_one_pending_pair_idx
ON public.connection_requests (
  LEAST(sender_id, receiver_id),
  GREATEST(sender_id, receiver_id)
)
WHERE status = 'pending';
