BEGIN;
-- Fail instead of waiting indefinitely for an ALTER TABLE lock.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE public.discord_connections (
  owner_id UUID NOT NULL,
  discord_user_id VARCHAR(64) NOT NULL,
  discord_username VARCHAR(120) NOT NULL,
  dm_channel_id VARCHAR(64),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT discord_connections_pkey PRIMARY KEY (owner_id),
  CONSTRAINT discord_connections_discord_user_unique UNIQUE (discord_user_id),
  CONSTRAINT discord_connections_owner_fkey FOREIGN KEY (owner_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE public.discord_link_codes (
  code VARCHAR(16) NOT NULL,
  owner_id UUID NOT NULL,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT discord_link_codes_pkey PRIMARY KEY (code),
  CONSTRAINT discord_link_codes_owner_fkey FOREIGN KEY (owner_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX discord_link_codes_owner_idx ON public.discord_link_codes(owner_id);

CREATE TABLE public.notification_logs (
  id UUID NOT NULL,
  owner_id UUID NOT NULL,
  kind VARCHAR(32) NOT NULL,
  ref_key VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notification_logs_pkey PRIMARY KEY (id),
  CONSTRAINT notification_logs_owner_kind_ref_unique UNIQUE (owner_id, kind, ref_key),
  CONSTRAINT notification_logs_owner_fkey FOREIGN KEY (owner_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX notification_logs_owner_created_idx ON public.notification_logs(owner_id, created_at);

ALTER TABLE public.discord_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.discord_connections, public.discord_link_codes, public.notification_logs
  FROM PUBLIC, anon, authenticated;

COMMIT;
