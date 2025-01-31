import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ChatOpenAI } from "https://esm.sh/langchain@0.0.77/chat_models/openai";
import { initializeAgentExecutorWithOptions } from "https://esm.sh/langchain@0.0.77/agents";
import { Tool } from "https://esm.sh/langchain@0.0.77/tools";
import { SupabaseDatabaseTool } from "../_shared/database-tool.ts";
import { ChatSessionTool } from "../_shared/chat-session-tool.ts";
import { TicketTool } from "../_shared/ticket-tool.ts";

// Initialize LangChain configuration
const langchainApiKey = Deno.env.get("LANGCHAIN_API_KEY");
const langchainProject = Deno.env.get("LANGCHAIN_PROJECT") || "default";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `You are a support ticket assistant. You can route tickets and add communications.

When you receive a message, check the metadata.mentions object for:
- A ticket (entityType: "ticket") - use its entityId value directly as the ticket_id
- A supporter (entityType: "supporter") - use its entityId value directly as the assigned_to_supporter_id

Available operations through the ticket_operations tool:

1. Route a ticket:
   When asked to route/assign a ticket and both ticket and supporter are mentioned:
   Action: ticket_operations
   Action Input: {
     "action": "route_ticket",
     "ticket_id": "[ticket entityId]",
     "assigned_to_supporter_id": "[supporter entityId]"
   }

2. Add a message:
   When asked to send/add a message to a ticket:
   Action: ticket_operations
   Action Input: {
     "action": "add_message",
     "ticket_id": "[ticket entityId]",
     "content": "Your message here"
   }

3. Add a note:
   When asked to add an internal note/comment:
   Action: ticket_operations
   Action Input: {
     "action": "add_note",
     "ticket_id": "[ticket entityId]",
     "content": "Your note here",
     "note_title": "Optional title"
   }

Example metadata format:
{
  "mentions": {
    "mention-123": {
      "entityId": "b40e96b0-808c-4ed8-9802-bfbc13c8157e",
      "entityType": "ticket",
      "displayName": "Case Title"
    },
    "mention-789": {
      "entityId": "5dfabf9d-45a2-4396-ab4d-e0c4b4fd2452",
      "entityType": "supporter",
      "displayName": "John Doe"
    }
  }
}

Remember:
1. Always use exactly "ticket_operations" as the Action
2. Put the specific operation (route_ticket/add_message/add_note) in the action field of the Action Input
3. Use the exact entityId values from the metadata
4. Do not perform any additional checks or verifications`;

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, sessionId, supporterId, metadata } = await req.json();

    if (!message || !sessionId || !supporterId) {
      throw new Error("Missing required fields: message, sessionId, or supporterId");
    }

    console.log('Received request with:', {
      message,
      sessionId,
      supporterId,
      metadata
    });

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Initialize tools
    const tools = [
      new TicketTool(supabaseClient, supporterId)
    ];

    // Initialize the model
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    
    // Debug logging for environment variables
    console.log("Environment configuration:", {
      hasOpenAiKey: !!openAiKey,
      langchainProject,
      supabaseUrl: !!supabaseUrl
    });
    
    if (!openAiKey) {
      throw new Error("Missing OpenAI API key");
    }

    const model = new ChatOpenAI({
      openAIApiKey: openAiKey,
      modelName: Deno.env.get("OPENAI_MODEL") ?? "gpt-4-turbo-preview",
      temperature: parseFloat(Deno.env.get("AI_TEMPERATURE") ?? "0.7"),
    });

    console.log("Initializing agent executor...");
    
    // Initialize the agent with tracing configuration
    const executor = await initializeAgentExecutorWithOptions(tools, model, {
      agentType: "zero-shot-react-description",
      verbose: true,
      returnIntermediateSteps: true,
      maxIterations: 5,
      earlyStoppingMethod: "generate",
      agentArgs: {
        prefix: `You are a support ticket assistant. You can route tickets and add communications.

When you receive a message, check the metadata.mentions object for ticket and supporter information.

Use ONLY the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: ticket_operations
Action Input: the JSON payload for the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question`,
      },
      // Configure tracing if API key is available
      ...(langchainApiKey ? {
        tracingV2: true,
        tracingV2Project: langchainProject,
        tracingV2ApiKey: langchainApiKey,
        tracingV2Endpoint: Deno.env.get("LANGCHAIN_ENDPOINT"),
        headers: {
          "Langchain-API-Key": langchainApiKey,
          "Langchain-Project": langchainProject,
          "Langchain-Trace-V2": "true"
        }
      } : {})
    });

    console.log("Agent executor initialized successfully");

    // Execute the agent with combined context and message
    const result = await executor.call({
      input: `Message: ${message}\nContext:\nSession ID: ${sessionId}\nSupporter ID: ${supporterId}\nMetadata: ${JSON.stringify(metadata || {})}`
    });

    // Store AI response in the database
    console.log('Attempting to store AI response...');
    const { data: aiMessageData, error: aiMessageError } = await supabaseClient
      .from("ai_chat_messages")
      .insert({
        chat_session_id: sessionId,
        sender_type: "llm",
        content: result.output,
        metadata: {
          model: model.modelName,
          temperature: model.temperature,
          intermediate_steps: result.intermediateSteps
        }
      })
      .select();

    if (aiMessageError) {
      console.error('Failed to store AI message:', aiMessageError);
      throw new Error(`Failed to store AI message: ${aiMessageError.message}`);
    } else {
      console.log('Successfully stored AI message:', aiMessageData);
    }

    // Return the response
    return new Response(
      JSON.stringify({
        message: result.output,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error('Error in AI chat:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
}); 