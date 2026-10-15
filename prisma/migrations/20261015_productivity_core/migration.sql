
BEGIN;

-- ==============================================
-- 1. ENUM TYPES
-- ==============================================

CREATE TYPE public."TaskStatus" AS ENUM (
  'TODO',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED'
);

CREATE TYPE public."TaskPriority" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

-- ==============================================
-- 2. PROJECTS
-- ==============================================

CREATE TABLE public.projects (
  id UUID NOT NULL,
  owner_id UUID NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT projects_pkey PRIMARY KEY (id)
);

-- ==============================================
-- 3. TASKS
-- ==============================================

CREATE TABLE public.tasks (
  id UUID NOT NULL,
  owner_id UUID NOT NULL,
  project_id UUID,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status public."TaskStatus" NOT NULL DEFAULT 'TODO',
  priority public."TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  due_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT tasks_pkey PRIMARY KEY (id)
);

-- ==============================================
-- 4. SUBTASKS
-- ==============================================

CREATE TABLE public.subtasks (
  id UUID NOT NULL,
  task_id UUID NOT NULL,
  title VARCHAR(200) NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT subtasks_pkey PRIMARY KEY (id)
);

-- ==============================================
-- 5. INDEXES
-- ==============================================

CREATE INDEX projects_owner_created_idx
ON public.projects (owner_id, created_at);

CREATE INDEX tasks_owner_status_idx
ON public.tasks (owner_id, status);

CREATE INDEX tasks_owner_due_at_idx
ON public.tasks (owner_id, due_at);

CREATE INDEX tasks_project_idx
ON public.tasks (project_id);

CREATE INDEX subtasks_task_position_idx
ON public.subtasks (task_id, position);

-- ==============================================
-- 6. FOREIGN KEYS
-- ==============================================

ALTER TABLE public.projects
ADD CONSTRAINT projects_owner_id_fkey
FOREIGN KEY (owner_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_owner_id_fkey
FOREIGN KEY (owner_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE public.tasks
ADD CONSTRAINT tasks_project_id_fkey
FOREIGN KEY (project_id)
REFERENCES public.projects(id)
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE public.subtasks
ADD CONSTRAINT subtasks_task_id_fkey
FOREIGN KEY (task_id)
REFERENCES public.tasks(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- ==============================================
-- 7. DATABASE SECURITY
-- ==============================================

ALTER TABLE public.projects
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.subtasks
ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
ON TABLE public.projects, public.tasks, public.subtasks
FROM PUBLIC, anon, authenticated;

COMMIT;
