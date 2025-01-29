-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- AI Chat Sessions Table
CREATE TABLE ai_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supporter_id UUID NOT NULL REFERENCES supporters(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT NOT NULL CHECK (status IN ('active', 'archived', 'deleted')) DEFAULT 'active',
    title TEXT, -- Optional title for the chat session
    context TEXT -- Optional context or system prompt for the chat
);

-- AI Chat Messages Table
CREATE TABLE ai_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_session_id UUID NOT NULL REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'llm')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    tokens_used INTEGER, -- Number of tokens used for this message
    model_name TEXT,    -- Name of the LLM model used
    metadata JSONB      -- Additional metadata (e.g., temperature, references, etc.)
);

-- Indexes for better query performance
CREATE INDEX idx_ai_chat_sessions_supporter_id ON ai_chat_sessions(supporter_id);
CREATE INDEX idx_ai_chat_sessions_status ON ai_chat_sessions(status);
CREATE INDEX idx_ai_chat_messages_chat_session_id ON ai_chat_messages(chat_session_id);
CREATE INDEX idx_ai_chat_messages_created_at ON ai_chat_messages(created_at);

-- Add updated_at trigger for ai_chat_sessions
CREATE OR REPLACE FUNCTION update_ai_chat_session_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_chat_session_timestamp
    BEFORE UPDATE ON ai_chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_chat_session_updated_at();

-- RLS Policies
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for ai_chat_sessions
CREATE POLICY "Supporters can view their own chat sessions"
    ON ai_chat_sessions
    FOR SELECT
    USING (auth.uid() = supporter_id);

CREATE POLICY "Supporters can insert their own chat sessions"
    ON ai_chat_sessions
    FOR INSERT
    WITH CHECK (auth.uid() = supporter_id);

CREATE POLICY "Supporters can update their own chat sessions"
    ON ai_chat_sessions
    FOR UPDATE
    USING (auth.uid() = supporter_id)
    WITH CHECK (auth.uid() = supporter_id);

-- Policies for ai_chat_messages
CREATE POLICY "Supporters can view messages from their chat sessions"
    ON ai_chat_messages
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM ai_chat_sessions
        WHERE ai_chat_sessions.id = ai_chat_messages.chat_session_id
        AND ai_chat_sessions.supporter_id = auth.uid()
    ));

CREATE POLICY "Supporters can insert messages to their chat sessions"
    ON ai_chat_messages
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM ai_chat_sessions
        WHERE ai_chat_sessions.id = ai_chat_messages.chat_session_id
        AND ai_chat_sessions.supporter_id = auth.uid()
    ));

-- Add comment explaining the tables
COMMENT ON TABLE ai_chat_sessions IS 'Stores chat sessions between supporters and the AI';
COMMENT ON TABLE ai_chat_messages IS 'Stores individual messages within AI chat sessions'; 