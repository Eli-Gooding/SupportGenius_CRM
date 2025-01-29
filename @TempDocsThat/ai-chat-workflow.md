# AI Chat System Architecture and Workflow

## System Components

### 1. Frontend Components
- `AIChatWindow`: Main chat interface component
- `useAIChat`: Hook for managing chat interactions
- `useAuth`: Hook for authentication management
- `useMentionSearch`: Hook for handling @mentions

### 2. Backend Components
- Supabase Edge Function: `ai-chat`
- Shared Tools:
  - `SupabaseDatabaseTool`
  - `ChatSessionTool`
- LangSmith Integration for monitoring

## Required Environment Variables

### Edge Function Variables
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access
- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_MODEL`: Model to use (defaults to "gpt-4-turbo-preview")
- `AI_TEMPERATURE`: Temperature setting for responses (defaults to 0.7)

### Optional LangSmith Variables
- `LANGCHAIN_TRACING_V2`: Set to "true" to enable LangSmith
- `LANGCHAIN_ENDPOINT`: LangSmith API endpoint
- `LANGCHAIN_API_KEY`: Your LangSmith API key

### Frontend Variables
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key for client access

## Data Flow and Workflow

### 1. Chat Initialization
1. User opens chat window
2. `useAuth` hook verifies authentication
3. Component loads with session ID and supporter ID
4. Previous messages are displayed (if any)

### 2. Message Sending Flow
1. User types message
   - Can use @mentions for references
   - Mention search updates in real-time
2. Message is sent via `useAIChat` hook
   - Validates environment variables
   - Prepares request to edge function

### 3. Edge Function Processing
1. Request received by Supabase Edge Function
2. Initialize components:
   - Supabase client
   - LangSmith client (if enabled)
   - AI tools (Database and Chat Session)
   - ChatOpenAI model

3. Agent Execution:
   - Creates LangSmith run for monitoring
   - Processes message through LangChain agent
   - Uses tools to query database or chat history
   - Streams response tokens back to client

4. Data Storage:
   - Stores user message in database
   - Stores AI response in database
   - Updates LangSmith with run results

### 4. Frontend Response Handling
1. Receives streamed tokens
2. Updates UI in real-time
3. Stores messages locally
4. Handles any errors
5. Updates chat window scroll position

## Monitoring and Analytics

### LangSmith Integration
- Tracks each interaction as a run
- Monitors tool usage
- Records errors and completion status
- Enables performance analysis

### Database Storage
- Messages stored in `ai_chat_messages` table
- Includes metadata and session information
- Enables history tracking and analysis

## Error Handling
1. Frontend:
   - Environment variable validation
   - Network error handling
   - Stream processing errors
   - UI feedback for errors

2. Backend:
   - Request validation
   - Tool execution errors
   - LangSmith error logging
   - Graceful error responses

## Security
- Authentication required for all interactions
- Environment variables for sensitive data
- Supabase RLS policies (assumed)
- Secure token handling

## Performance Considerations
- Streaming responses for better UX
- Efficient message storage
- Optimized mention search
- Background processing for analytics

## Future Enhancements
1. Additional monitoring metrics
2. Custom evaluators
3. Feedback collection
4. Performance optimization
5. Enhanced error handling
6. Additional tool integration 