BEGIN;
-- Fail instead of waiting indefinitely for an ALTER TABLE lock.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TYPE "TaskDifficulty" AS ENUM ('EASY', 'NORMAL', 'HARD');

ALTER TABLE public.tasks
  ADD COLUMN difficulty "TaskDifficulty" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN estimated_minutes INTEGER,
  ADD COLUMN progress INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN depends_on_task_id UUID,
  ADD CONSTRAINT tasks_progress_range_chk CHECK (progress >= 0 AND progress <= 100),
  ADD CONSTRAINT tasks_estimated_minutes_chk CHECK (estimated_minutes IS NULL OR (estimated_minutes >= 1 AND estimated_minutes <= 1440)),
  ADD CONSTRAINT tasks_depends_self_chk CHECK (depends_on_task_id IS NULL OR depends_on_task_id <> id);

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_depends_on_fkey FOREIGN KEY (depends_on_task_id)
    REFERENCES public.tasks(id) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX tasks_owner_difficulty_idx ON public.tasks(owner_id, difficulty);
CREATE INDEX tasks_depends_on_idx ON public.tasks(depends_on_task_id);

-- Existing RLS and revoked browser-role privileges continue to cover these columns.
COMMIT;
