
BEGIN;

-- ============================================
-- M2.5 — DAILY PLANNER MIGRATION
-- ============================================

-- 1. Composite unique constraint on Tasks.
-- Required to reference both task ID and owner ID.

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_id_owner_unique
UNIQUE (id, owner_id);

-- ============================================
-- 2. Create Daily Planner table
-- ============================================

CREATE TABLE public.daily_plan_items (
    id UUID NOT NULL,
    owner_id UUID NOT NULL,
    task_id UUID NOT NULL,
    planned_date DATE NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT daily_plan_items_pkey
        PRIMARY KEY (id)
);

-- ============================================
-- 3. Prevent duplicate planning
-- ============================================

ALTER TABLE public.daily_plan_items
ADD CONSTRAINT daily_plan_task_date_unique
UNIQUE (task_id, planned_date);

-- ============================================
-- 4. Optimize daily plan queries
-- ============================================

CREATE INDEX daily_plan_owner_date_position_idx
ON public.daily_plan_items (
    owner_id,
    planned_date,
    position
);

-- ============================================
-- 5. Enforce Task ownership at database level
-- ============================================

ALTER TABLE public.daily_plan_items
ADD CONSTRAINT daily_plan_items_task_id_owner_id_fkey
FOREIGN KEY (task_id, owner_id)
REFERENCES public.tasks (id, owner_id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- ============================================
-- 6. Supabase security
-- ============================================

ALTER TABLE public.daily_plan_items
ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
ON TABLE public.daily_plan_items
FROM PUBLIC, anon, authenticated;

COMMIT;
