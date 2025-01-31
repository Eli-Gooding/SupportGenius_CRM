-- Add service role policies for remaining tables
-- This ensures the Edge Function (using service role) has full access

-- For tickets table
create policy "Enable service role operations on tickets"
    on tickets for all
    using (auth.role() = 'service_role');

-- For messages table
create policy "Enable service role operations on messages"
    on messages for all
    using (auth.role() = 'service_role');

-- For notes table
create policy "Enable service role operations on notes"
    on notes for all
    using (auth.role() = 'service_role');

-- For AI chat sessions table
create policy "Enable service role operations on ai_chat_sessions"
    on ai_chat_sessions for all
    using (auth.role() = 'service_role');

-- For AI chat messages table
create policy "Enable service role operations on ai_chat_messages"
    on ai_chat_messages for all
    using (auth.role() = 'service_role');

-- Add comment explaining the migration
COMMENT ON POLICY "Enable service role operations on tickets" ON tickets IS 'Allows Edge Functions with service role to perform all operations on tickets';
COMMENT ON POLICY "Enable service role operations on messages" ON messages IS 'Allows Edge Functions with service role to perform all operations on messages';
COMMENT ON POLICY "Enable service role operations on notes" ON notes IS 'Allows Edge Functions with service role to perform all operations on notes';
COMMENT ON POLICY "Enable service role operations on ai_chat_sessions" ON ai_chat_sessions IS 'Allows Edge Functions with service role to perform all operations on AI chat sessions';
COMMENT ON POLICY "Enable service role operations on ai_chat_messages" ON ai_chat_messages IS 'Allows Edge Functions with service role to perform all operations on AI chat messages'; 