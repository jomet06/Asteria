BEGIN;
-- Fail instead of waiting indefinitely for an ALTER TABLE lock.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.calendar_events
  ADD COLUMN google_event_id VARCHAR(512),
  ADD COLUMN sync_state VARCHAR(32) NOT NULL DEFAULT 'local',
  ADD COLUMN sync_error TEXT;

CREATE INDEX calendar_events_owner_sync_state_idx
  ON public.calendar_events(owner_id, sync_state);

ALTER TABLE public.google_calendar_connections
  ADD COLUMN target_calendar_id VARCHAR(512);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.calendar_events, public.google_calendar_connections
  FROM PUBLIC, anon, authenticated;

COMMIT;
