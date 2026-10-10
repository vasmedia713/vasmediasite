-- Local tested schema design, NOT an applied Supabase migration.
-- Generate the approved migration via Supabase CLI after secure project setup.
CREATE SCHEMA vds_intake;
REVOKE ALL ON SCHEMA vds_intake FROM PUBLIC;
CREATE ROLE vds_intake_app NOLOGIN;
CREATE ROLE vds_intake_worker NOLOGIN;
CREATE TABLE vds_intake.assignments (
 workspace text PRIMARY KEY, provider text NOT NULL CHECK(provider IN ('netlify','supabase')),
 subject text NOT NULL, customer text NOT NULL, template text NOT NULL,
 expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false,
 UNIQUE(provider,subject,customer,template)
);
CREATE TABLE vds_intake.drafts (
 workspace text PRIMARY KEY REFERENCES vds_intake.assignments(workspace),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 payload jsonb NOT NULL, saved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vds_intake.versions (
 workspace text NOT NULL REFERENCES vds_intake.assignments(workspace),
 revision integer NOT NULL CHECK(revision>0), payload jsonb NOT NULL,
 saved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace,revision)
);
CREATE TABLE vds_intake.uploads (
 id uuid PRIMARY KEY, workspace text NOT NULL REFERENCES vds_intake.assignments(workspace),
 item_id text NOT NULL, object_key text NOT NULL UNIQUE, mime text NOT NULL,
 size integer NOT NULL CHECK(size BETWEEN 1 AND 10000000), sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','complete')),
 expires_at timestamptz NOT NULL, CHECK(mime IN ('image/jpeg','image/png','image/webp'))
);
CREATE TABLE vds_intake.submissions (
 id uuid PRIMARY KEY, workspace text NOT NULL, revision integer NOT NULL,
 digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','pending','ambiguous','verified')),
 notion_url text, update_status text NOT NULL DEFAULT 'disabled',
 UNIQUE(workspace,revision), FOREIGN KEY(workspace,revision) REFERENCES vds_intake.versions(workspace,revision)
);
CREATE TABLE vds_intake.outbox (
 submission uuid PRIMARY KEY REFERENCES vds_intake.submissions(id),
 fence integer NOT NULL DEFAULT 0, lease_until timestamptz, worker text,
 next_attempt timestamptz NOT NULL DEFAULT now(), done boolean NOT NULL DEFAULT false,
 create_attempted boolean NOT NULL DEFAULT false
);
-- Server-only tables. No anon/authenticated grants; custom app/worker roles need
-- separately approved least-privilege grants. These policies add tenant defense.
ALTER TABLE vds_intake.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vds_intake.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vds_intake.versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vds_intake.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE vds_intake.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vds_intake.outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_assignment ON vds_intake.assignments FOR SELECT USING (
 provider=current_setting('vds.provider',true) AND subject=current_setting('vds.subject',true)
 AND customer=current_setting('vds.customer',true) AND expires_at>now() AND NOT revoked
);
CREATE POLICY lock_own_assignment ON vds_intake.assignments FOR UPDATE TO vds_intake_app USING (
 provider=current_setting('vds.provider',true) AND subject=current_setting('vds.subject',true)
 AND customer=current_setting('vds.customer',true) AND expires_at>now() AND NOT revoked
) WITH CHECK (false);
CREATE POLICY own_draft ON vds_intake.drafts USING (EXISTS(SELECT 1 FROM vds_intake.assignments a WHERE a.workspace=drafts.workspace)) WITH CHECK (EXISTS(SELECT 1 FROM vds_intake.assignments a WHERE a.workspace=drafts.workspace));
CREATE POLICY own_version ON vds_intake.versions USING (EXISTS(SELECT 1 FROM vds_intake.assignments a WHERE a.workspace=versions.workspace)) WITH CHECK (EXISTS(SELECT 1 FROM vds_intake.assignments a WHERE a.workspace=versions.workspace));
CREATE POLICY own_upload ON vds_intake.uploads USING (EXISTS(SELECT 1 FROM vds_intake.assignments a WHERE a.workspace=uploads.workspace)) WITH CHECK (EXISTS(SELECT 1 FROM vds_intake.assignments a WHERE a.workspace=uploads.workspace));
CREATE POLICY own_submission ON vds_intake.submissions USING (EXISTS(SELECT 1 FROM vds_intake.assignments a WHERE a.workspace=submissions.workspace)) WITH CHECK (EXISTS(SELECT 1 FROM vds_intake.assignments a WHERE a.workspace=submissions.workspace));
-- App can enqueue its own submission, but only the trusted worker can read/lease.
CREATE POLICY enqueue_own_submission ON vds_intake.outbox FOR INSERT TO vds_intake_app WITH CHECK (EXISTS(SELECT 1 FROM vds_intake.submissions s WHERE s.id=outbox.submission));
CREATE POLICY worker_versions ON vds_intake.versions FOR SELECT TO vds_intake_worker USING (true);
CREATE POLICY worker_submissions ON vds_intake.submissions TO vds_intake_worker USING (true) WITH CHECK (true);
CREATE POLICY worker_outbox ON vds_intake.outbox TO vds_intake_worker USING (true) WITH CHECK (true);
GRANT USAGE ON SCHEMA vds_intake TO vds_intake_app,vds_intake_worker;
GRANT SELECT ON vds_intake.assignments TO vds_intake_app;
-- Row locking needs UPDATE visibility; WITH CHECK(false) denies actual changes.
GRANT UPDATE(workspace) ON vds_intake.assignments TO vds_intake_app;
GRANT SELECT,INSERT,UPDATE ON vds_intake.drafts,vds_intake.uploads TO vds_intake_app;
GRANT SELECT,INSERT ON vds_intake.versions,vds_intake.submissions TO vds_intake_app;
GRANT INSERT ON vds_intake.outbox TO vds_intake_app;
GRANT SELECT ON vds_intake.versions TO vds_intake_worker;
GRANT SELECT,UPDATE ON vds_intake.submissions,vds_intake.outbox TO vds_intake_worker;
