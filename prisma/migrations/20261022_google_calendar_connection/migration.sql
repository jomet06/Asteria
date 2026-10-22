BEGIN;

CREATE TABLE public.google_calendar_connections (
  owner_id UUID NOT NULL,
  google_account_id VARCHAR(255) NOT NULL,
  google_email VARCHAR(320),
  refresh_token_encrypted TEXT NOT NULL,
  granted_scopes TEXT NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT google_calendar_connections_pkey PRIMARY KEY (owner_id),
  CONSTRAINT google_calendar_connections_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.google_calendar_connections
  FROM PUBLIC, anon, authenticated;

COMMIT;
