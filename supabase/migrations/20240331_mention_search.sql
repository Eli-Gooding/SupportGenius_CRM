-- Create a type for mention search results
CREATE TYPE mention_search_result AS (
    entity_id uuid,
    entity_type text,
    display_name text,
    secondary_text text
);

-- Create function for mention search
CREATE OR REPLACE FUNCTION search_mentions(search_query text, max_results integer DEFAULT 5)
RETURNS SETOF mention_search_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sanitized_query text;
BEGIN
    -- Sanitize the search query
    sanitized_query := '%' || search_query || '%';

    -- Return results from all relevant tables
    RETURN QUERY
    (
        -- Search tickets
        SELECT 
            t.id as entity_id,
            'ticket'::text as entity_type,
            t.title as display_name,
            'Ticket #' || substring(t.id::text, 1, 8) as secondary_text
        FROM tickets t
        WHERE 
            t.title ILIKE sanitized_query
            OR t.search_vector @@ plainto_tsquery('english', search_query)
        LIMIT max_results
    )
    UNION ALL
    (
        -- Search supporters
        SELECT 
            s.id as entity_id,
            'supporter'::text as entity_type,
            s.full_name as display_name,
            s.email as secondary_text
        FROM supporters s
        WHERE 
            s.full_name ILIKE sanitized_query
            OR s.email ILIKE sanitized_query
            OR s.search_vector @@ plainto_tsquery('english', search_query)
        LIMIT max_results
    )
    UNION ALL
    (
        -- Search customers (users)
        SELECT 
            u.id as entity_id,
            'customer'::text as entity_type,
            u.full_name as display_name,
            u.email as secondary_text
        FROM users u
        WHERE 
            u.full_name ILIKE sanitized_query
            OR u.email ILIKE sanitized_query
            OR u.search_vector @@ plainto_tsquery('english', search_query)
        LIMIT max_results
    )
    UNION ALL
    (
        -- Search companies
        SELECT 
            c.id as entity_id,
            'account'::text as entity_type,
            c.company_name as display_name,
            'Company' as secondary_text
        FROM companies c
        WHERE 
            c.company_name ILIKE sanitized_query
            OR c.search_vector @@ plainto_tsquery('english', search_query)
        LIMIT max_results
    )
    UNION ALL
    (
        -- Search categories
        SELECT 
            cat.id as entity_id,
            'category'::text as entity_type,
            cat.category_name as display_name,
            COALESCE(cat.description, 'Category') as secondary_text
        FROM categories cat
        WHERE 
            cat.category_name ILIKE sanitized_query
            OR cat.description ILIKE sanitized_query
        LIMIT max_results
    )
    LIMIT max_results;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_mentions TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION search_mentions IS 'Search for mentions across tickets, supporters, customers, companies, and categories'; 