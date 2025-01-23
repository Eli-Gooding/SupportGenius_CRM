-- Add tsvector columns for full text search
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, ''))) STORED;

ALTER TABLE users ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (to_tsvector('english', coalesce(full_name, ''))) STORED;

ALTER TABLE supporters ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (to_tsvector('english', coalesce(full_name, ''))) STORED;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS search_vector tsvector 
GENERATED ALWAYS AS (to_tsvector('english', coalesce(company_name, ''))) STORED;

-- Create GIN indexes for full text search on the generated tsvector columns
DROP INDEX IF EXISTS idx_tickets_title_search;
DROP INDEX IF EXISTS idx_users_full_name_search;
DROP INDEX IF EXISTS idx_supporters_full_name_search;
DROP INDEX IF EXISTS idx_companies_name_search;

CREATE INDEX idx_tickets_title_search ON tickets USING GIN (search_vector);
CREATE INDEX idx_users_full_name_search ON users USING GIN (search_vector);
CREATE INDEX idx_supporters_full_name_search ON supporters USING GIN (search_vector);
CREATE INDEX idx_companies_name_search ON companies USING GIN (search_vector);

-- Create btree indexes for ILIKE queries (fallback for non-text-search queries)
CREATE INDEX IF NOT EXISTS idx_tickets_title ON tickets (title text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_users_full_name ON users (full_name text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_supporters_full_name ON supporters (full_name text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies (company_name text_pattern_ops);

-- Add comment explaining the purpose of these indexes
COMMENT ON INDEX idx_tickets_title_search IS 'Full text search index for ticket titles';
COMMENT ON INDEX idx_users_full_name_search IS 'Full text search index for user full names';
COMMENT ON INDEX idx_supporters_full_name_search IS 'Full text search index for supporter full names';
COMMENT ON INDEX idx_companies_name_search IS 'Full text search index for company names';

COMMENT ON INDEX idx_tickets_title IS 'B-tree index for ILIKE queries on ticket titles';
COMMENT ON INDEX idx_users_full_name IS 'B-tree index for ILIKE queries on user full names';
COMMENT ON INDEX idx_supporters_full_name IS 'B-tree index for ILIKE queries on supporter full names';
COMMENT ON INDEX idx_companies_name IS 'B-tree index for ILIKE queries on company names'; 