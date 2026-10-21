BEGIN;
-- Fail instead of waiting indefinitely for an ALTER TABLE lock.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
ALTER TABLE public.calendar_events
  ADD COLUMN task_id UUID,
  ADD COLUMN parent_id UUID,
  ADD COLUMN original_start TIMESTAMPTZ(3),
  ADD COLUMN is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT calendar_events_id_owner_unique UNIQUE (id, owner_id),
  ADD CONSTRAINT calendar_events_occurrence_unique UNIQUE (parent_id, original_start),
  ADD CONSTRAINT calendar_events_exception_shape_chk CHECK (
    (parent_id IS NULL AND original_start IS NULL AND NOT is_cancelled) OR
    (parent_id IS NOT NULL AND original_start IS NOT NULL AND recurrence_rule IS NULL)
  ),
  ADD CONSTRAINT calendar_events_task_owner_fkey FOREIGN KEY (task_id, owner_id)
    REFERENCES public.tasks(id, owner_id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT calendar_events_parent_owner_fkey FOREIGN KEY (parent_id, owner_id)
    REFERENCES public.calendar_events(id, owner_id) ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX calendar_events_task_owner_idx ON public.calendar_events(task_id, owner_id);
-- Existing RLS and revoked browser-role privileges continue to cover these columns.
COMMIT;
