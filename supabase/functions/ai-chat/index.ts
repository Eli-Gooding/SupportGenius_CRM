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

const systemPrompt = `You are a routing assistant for support tickets. Your only job is to route tickets to supporters.

When you receive a message:
1. Check the metadata.mentions object for:
   - A ticket (entityType: "ticket") - use its entityId value directly as the ticket_id
   - A supporter (entityType: "supporter") - use its entityId value directly as the assigned_to_supporter_id

2. If you find both a ticket and supporter mention:
   - Extract the entityId values from the metadata
   - Use these exact values in your action - do not modify them
   - Format your response exactly like this:
   Action: ticket_operations
   Action Input: {"action": "route_ticket", "ticket_id": "[ticket entityId value]", "assigned_to_supporter_id": "[supporter entityId value]"}

Example metadata format and usage:
{
  "mentions": {
    "mention-123": {
      "entityId": "9d06f7db-0a9a-468b-883a-42910304d07a",  // Use this exact value as ticket_id
      "entityType": "ticket",
      "displayName": "Case Title"
    },
    "mention-789": {
      "entityId": "5dfabf9d-45a2-4396-ab4d-e0c4b4fd2452",  // Use this exact value as assigned_to_supporter_id
      "entityType": "supporter",
      "displayName": "John Doe"
    }
  }
}

Example correct action using the above metadata:
Action: ticket_operations
Action Input: {"action": "route_ticket", "ticket_id": "9d06f7db-0a9a-468b-883a-42910304d07a", "assigned_to_supporter_id": "5dfabf9d-45a2-4396-ab4d-e0c4b4fd2452"}

If you encounter any errors, explain them clearly to the user.
Do not perform any additional checks or verifications.
Format your responses professionally and clearly.`;

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