-- Track ticket quantity explicitly. Native event checkout currently sells one
-- ticket per row, so existing rows are backfilled to quantity 1.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_quantity_positive;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_quantity_positive CHECK (quantity > 0);

NOTIFY pgrst, 'reload schema';
