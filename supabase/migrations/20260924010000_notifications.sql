-- Notifications people actually receive.
--
-- Until now nothing was stored: a list was re-derived from current data every
-- minute, so it could only ever say what is true now, never what just
-- happened. A booking created, a crew accepting, a proof of delivery
-- arriving - none of it reached anyone. Read state lived in each browser, so
-- reading on a phone left it unread on a laptop, and only three roles were
-- covered at all.
--
-- An event is written once, with a row per person who should see it. Standing
-- conditions ("this truck is on maintenance") are still worked out from live
-- data and merged into the same feed, because they end by themselves.

BEGIN;

CREATE TABLE IF NOT EXISTS "Notification" (
  "notificationID" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What happened, in the app's words: BOOKING_CREATED, CREW_DECLINED.
  "event"          text NOT NULL,
  "title"          text NOT NULL,
  "body"           text NOT NULL,
  -- info: worth knowing. action: someone must do something. urgent: now.
  "severity"       text NOT NULL DEFAULT 'info' CHECK ("severity" IN ('info', 'action', 'urgent')),
  -- What it is about, so the feed can link to it.
  "entityTable"    text,
  "entityID"       text,
  "link"           text,
  -- Who caused it. Null when the system did.
  "actorID"        uuid REFERENCES "Employee" ("employeeID") ON DELETE SET NULL,
  "actorName"      text,
  -- Repeats of the same thing collapse onto one row.
  "dedupeKey"      text,
  "createdAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "NotificationRecipient" (
  "recipientID"     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "notificationID"  uuid NOT NULL REFERENCES "Notification" ("notificationID") ON DELETE CASCADE,
  "employeeID"      uuid NOT NULL REFERENCES "Employee" ("employeeID") ON DELETE CASCADE,
  "readAt"          timestamptz,
  UNIQUE ("notificationID", "employeeID")
);

-- The feed: this person's notifications, newest first.
CREATE INDEX IF NOT EXISTS notificationrecipient_inbox_idx
  ON "NotificationRecipient" ("employeeID", "readAt");
CREATE INDEX IF NOT EXISTS notification_created_idx ON "Notification" ("createdAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS notification_dedupe_idx
  ON "Notification" ("dedupeKey") WHERE "dedupeKey" IS NOT NULL;

-- Where to send a push. One row per device; a person may have several, and a
-- shared phone may pass from one person to the next, so the token is unique
-- and simply moves to whoever signed in last.
CREATE TABLE IF NOT EXISTS "DeviceToken" (
  "tokenID"     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employeeID"  uuid NOT NULL REFERENCES "Employee" ("employeeID") ON DELETE CASCADE,
  "token"       text NOT NULL UNIQUE,
  "platform"    text NOT NULL DEFAULT 'android' CHECK ("platform" IN ('android', 'ios', 'web')),
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  "lastSeenAt"  timestamptz NOT NULL DEFAULT now(),
  -- Set when the push service says the token is dead.
  "failedAt"    timestamptz
);

CREATE INDEX IF NOT EXISTS devicetoken_employee_idx ON "DeviceToken" ("employeeID") WHERE "failedAt" IS NULL;

-- Reached only through the server, like every other table here.
ALTER TABLE "Notification"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationRecipient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceToken"           ENABLE ROW LEVEL SECURITY;

COMMIT;

-- AFTERWARDS
--   SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('Notification', 'NotificationRecipient', 'DeviceToken');
-- Three rows.
