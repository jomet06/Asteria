BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.notification_logs
  ADD COLUMN title VARCHAR(200),
  ADD COLUMN message TEXT,
  ADD COLUMN href VARCHAR(2048),
  ADD COLUMN source_type VARCHAR(24),
  ADD COLUMN source_id TEXT,
  ADD COLUMN source_version VARCHAR(120),
  ADD COLUMN scheduled_at TIMESTAMPTZ(3),
  ADD COLUMN expires_at TIMESTAMPTZ(3),
  ADD COLUMN read_at TIMESTAMPTZ(3),
  ADD COLUMN dismissed_at TIMESTAMPTZ(3),
  ADD COLUMN in_app BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN legacy_discord_sent BOOLEAN NOT NULL DEFAULT true;
-- Existing logs were the old send/dedupe marker. Never replay them on rollout.
ALTER TABLE public.notification_logs ALTER COLUMN legacy_discord_sent SET DEFAULT false;
CREATE UNIQUE INDEX notification_logs_id_owner_unique ON public.notification_logs(id, owner_id);
CREATE INDEX notification_logs_inbox_idx ON public.notification_logs(owner_id, in_app, dismissed_at, read_at, created_at);
CREATE INDEX notification_logs_source_idx ON public.notification_logs(owner_id, source_type, source_version);

CREATE TABLE public.notification_preferences (
  owner_id UUID PRIMARY KEY,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  discord_enabled BOOLEAN NOT NULL DEFAULT true,
  calendar_enabled BOOLEAN NOT NULL DEFAULT true,
  deadline_enabled BOOLEAN NOT NULL DEFAULT true,
  overdue_enabled BOOLEAN NOT NULL DEFAULT true,
  planner_enabled BOOLEAN NOT NULL DEFAULT true,
  event_lead_minutes INTEGER NOT NULL DEFAULT 15 CHECK (event_lead_minutes IN (5,10,15,30,60)),
  deadline_lead_days INTEGER NOT NULL DEFAULT 1 CHECK (deadline_lead_days IN (0,1,2,3,7)),
  morning_hour INTEGER NOT NULL DEFAULT 7 CHECK (morning_hour BETWEEN 0 AND 11),
  overdue_repeat_days INTEGER NOT NULL DEFAULT 1 CHECK (overdue_repeat_days IN (0,1)),
  task_cursor UUID,
  planner_cursor DATE,
  CONSTRAINT notification_preferences_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE public.notification_deliveries (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL,
  notification_id UUID NOT NULL,
  channel VARCHAR(24) NOT NULL DEFAULT 'discord',
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','retry','sending','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claim_token UUID,
  lease_until TIMESTAMPTZ(3),
  sent_at TIMESTAMPTZ(3),
  last_error VARCHAR(64),
  CONSTRAINT notification_deliveries_notification_owner_fkey FOREIGN KEY (notification_id, owner_id) REFERENCES public.notification_logs(id, owner_id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX notification_deliveries_channel_unique ON public.notification_deliveries(notification_id, channel);
CREATE INDEX notification_deliveries_ready_idx ON public.notification_deliveries(channel, status, next_attempt_at, owner_id);
CREATE INDEX notification_deliveries_owner_idx ON public.notification_deliveries(owner_id, status, next_attempt_at);
CREATE TABLE public.notification_scheduler_state (
  key VARCHAR(32) PRIMARY KEY,
  owner_cursor UUID,
  delivery_cursor UUID,
  lease_token UUID,
  lease_until TIMESTAMPTZ(3)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_scheduler_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.notification_preferences, public.notification_deliveries,
  public.notification_scheduler_state, public.notification_logs FROM PUBLIC, anon, authenticated;
COMMIT;
