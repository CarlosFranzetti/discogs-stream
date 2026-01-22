CREATE TABLE IF NOT EXISTS search_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    page_token TEXT,
    results JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_cache_query_token ON search_cache(query, page_token);

-- Add RLS policies just in case, though this table is mainly for internal use by Edge Functions
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON search_cache
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated users to read cache (optional, if we wanted client to query directly, but we use Edge Function)
-- For now, we'll keep it restricted to service_role (Edge Functions) to enforce logic.
