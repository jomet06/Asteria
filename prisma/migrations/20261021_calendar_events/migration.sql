
BEGIN;

-- ==========================================
-- M3.1 — INTERNAL CALENDAR EVENTS
-- ==========================================

-- 1. Calendar Event table

CREATE TABLE public.calendar_events (
    id UUID NOT NULL,
    owner_id UUID NOT NULL,

    title VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(255),

    starts_at TIMESTAMPTZ(3) NOT NULL,
    ends_at TIMESTAMPTZ(3) NOT NULL,

    timezone VARCHAR(64)
        NOT NULL DEFAULT 'Asia/Jakarta',

    is_all_day BOOLEAN
        NOT NULL DEFAULT FALSE,

    recurrence_rule TEXT,

    created_at TIMESTAMPTZ(3)
        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT calendar_events_pkey
        PRIMARY KEY (id),

    -- Prevent zero-length or inverted events.
    CONSTRAINT calendar_events_time_range_chk
        CHECK (ends_at > starts_at),

    CONSTRAINT calendar_events_title_nonblank_chk
        CHECK (char_length(btrim(title)) > 0),

    CONSTRAINT calendar_events_timezone_nonblank_chk
        CHECK (char_length(btrim(timezone)) > 0)
);

-- ==========================================
-- 2. OWNER RELATIONSHIP
-- ==========================================

ALTER TABLE public.calendar_events
ADD CONSTRAINT calendar_events_owner_id_fkey
FOREIGN KEY (owner_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE
ON UPDATE CASCADE;

-- ==========================================
-- 3. QUERY PERFORMANCE
-- ==========================================

CREATE INDEX calendar_events_owner_starts_idx
ON public.calendar_events (
    owner_id,
    starts_at
);

CREATE INDEX calendar_events_owner_ends_idx
ON public.calendar_events (
    owner_id,
    ends_at
);

-- ==========================================
-- 4. SUPABASE DATABASE SECURITY
-- ==========================================

ALTER TABLE public.calendar_events
ENABLE ROW LEVEL SECURITY;

-- Calendar access will use authenticated
-- Next.js Server Actions with owner-scoped
-- Prisma queries, not browser-side SQL access.

REVOKE ALL PRIVILEGES
ON TABLE public.calendar_events
FROM PUBLIC, anon, authenticated;

COMMIT;
