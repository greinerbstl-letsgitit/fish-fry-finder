-- Create claim_requests table for location claim requests
CREATE TABLE IF NOT EXISTS claim_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  role text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON claim_requests(status);
CREATE INDEX IF NOT EXISTS idx_claim_requests_location_id ON claim_requests(location_id);
