BEGIN;

CREATE TABLE public.google_calendar_sources (
  id UUID NOT NULL,
  owner_id UUID NOT NULL,
  connection_owner_id UUID NOT NULL,
  google_calendar_id VARCHAR(512) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  sync_status VARCHAR(32) NOT NULL DEFAULT 'idle',
  last_successful_sync TIMESTAMPTZ(3),
  last_sync_error TEXT,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT google_calendar_sources_pkey PRIMARY KEY (id),
  CONSTRAINT google_calendar_sources_owner_fkey FOREIGN KEY (owner_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT google_calendar_sources_connection_fkey FOREIGN KEY (connection_owner_id)
    REFERENCES public.google_calendar_connections(owner_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT google_calendar_sources_connection_calendar_unique UNIQUE (connection_owner_id, google_calendar_id)
);

CREATE INDEX google_calendar_sources_owner_selected_idx
  ON public.google_calendar_sources(owner_id, selected);

CREATE TABLE public.google_event_mirrors (
  id UUID NOT NULL,
  owner_id UUID NOT NULL,
  source_id UUID NOT NULL,
  google_event_id VARCHAR(512) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  location VARCHAR(1000),
  starts_at TIMESTAMPTZ(3) NOT NULL,
  ends_at TIMESTAMPTZ(3) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
  html_link VARCHAR(2000),
  google_updated_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT google_event_mirrors_pkey PRIMARY KEY (id),
  CONSTRAINT google_event_mirrors_owner_fkey FOREIGN KEY (owner_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT google_event_mirrors_source_fkey FOREIGN KEY (source_id)
    REFERENCES public.google_calendar_sources(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT google_event_mirrors_source_event_unique UNIQUE (source_id, google_event_id)
);

CREATE INDEX google_event_mirrors_owner_starts_idx
  ON public.google_event_mirrors(owner_id, starts_at);
CREATE INDEX google_event_mirrors_source_starts_idx
  ON public.google_event_mirrors(source_id, starts_at);

ALTER TABLE public.google_calendar_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_event_mirrors ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.google_calendar_sources, public.google_event_mirrors
  FROM PUBLIC, anon, authenticated;

COMMIT;
