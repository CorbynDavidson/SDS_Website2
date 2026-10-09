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

-- Populate only with a licensed UK-wide address dataset. No address records ship with this repository.
CREATE TABLE IF NOT EXISTS address_directory (
  address_id TEXT PRIMARY KEY,
  postcode TEXT NOT NULL,
  postcode_normalized TEXT NOT NULL,
  line_1 TEXT NOT NULL,
  line_2 TEXT NOT NULL DEFAULT '',
  post_town TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_address_directory_postcode ON address_directory(postcode_normalized);
CREATE TABLE IF NOT EXISTS address_dataset_state (
  id INTEGER PRIMARY KEY CHECK(id=1),
  source TEXT NOT NULL,
  licence_reference TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  address_count BIGINT NOT NULL CHECK(address_count>0),
  active BOOLEAN NOT NULL DEFAULT false
);
