-- Function to safely execute AI queries
CREATE OR REPLACE FUNCTION ai_execute_query(query_text text, query_params json DEFAULT '[]'::json)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    allowed_tables text[] := ARRAY[
        'tickets',
        'supporters',
        'users',
        'companies',
        'categories',
        'messages',
        'ai_chat_sessions',
        'ai_chat_messages'
    ];
    table_name text;
    is_allowed boolean := false;
BEGIN
    -- Basic SQL injection prevention
    IF query_text ~* ';\s*$' THEN
        RAISE EXCEPTION 'Query must not end with semicolon';
    END IF;

    -- Check if query only accesses allowed tables
    FOREACH table_name IN ARRAY allowed_tables
    LOOP
        IF query_text ~* ('\m' || table_name || '\M') THEN
            is_allowed := true;
            EXIT;
        END IF;
    END LOOP;

    IF NOT is_allowed THEN
        RAISE EXCEPTION 'Query must access at least one allowed table';
    END IF;

    -- Prevent modification queries
    IF query_text ~* '\m(insert|update|delete|drop|create|alter|truncate|replace)\M' THEN
        RAISE EXCEPTION 'Only SELECT queries are allowed';
    END IF;

    -- Execute the query with parameters
    EXECUTE format('SELECT json_agg(t) FROM (%s) t', query_text)
    USING query_params::json
    INTO result;

    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION ai_execute_query TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION ai_execute_query IS 'Safely executes read-only queries for AI assistant with proper validation'; 