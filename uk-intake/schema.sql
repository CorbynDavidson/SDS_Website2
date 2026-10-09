CREATE TABLE IF NOT EXISTS form_submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_key TEXT NOT NULL UNIQUE,
  form_key TEXT NOT NULL,
  source_path TEXT NOT NULL,
  payload_json JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_form_submissions_created_at ON form_submissions(created_at DESC);

CREATE TABLE IF NOT EXISTS form_uploads (
  id UUID PRIMARY KEY,
  submission_id BIGINT NOT NULL REFERENCES form_submissions(id),
  storage_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL CHECK(bytes > 0)
);
CREATE INDEX IF NOT EXISTS idx_form_uploads_submission ON form_uploads(submission_id);

CREATE TABLE IF NOT EXISTS submission_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at BIGINT NOT NULL
);
