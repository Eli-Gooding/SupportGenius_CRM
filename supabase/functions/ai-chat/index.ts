import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ChatOpenAI } from "https://esm.sh/@langchain/openai";
import { initializeAgentExecutorWithOptions } from "https://esm.sh/langchain/agents";
import { Client } from "https://esm.sh/langsmith";
import { SupabaseDatabaseTool } from "../_shared/database-tool.ts";
import { ChatSessionTool } from "../_shared/chat-session-tool.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, sessionId, supporterId } = await req.json();

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Initialize LangSmith client if tracing is enabled
    let langsmith: Client | undefined;
    if (Deno.env.get("LANGCHAIN_TRACING_V2") === "true") {
      langsmith = new Client({
        apiUrl: Deno.env.get("LANGCHAIN_ENDPOINT"),
        apiKey: Deno.env.get("LANGCHAIN_API_KEY"),
      });
    }

    // Initialize tools
    const tools = [
      new SupabaseDatabaseTool(supabaseClient),
      new ChatSessionTool(supabaseClient, supporterId),
    ];

    // Initialize the model
    const model = new ChatOpenAI({
      openAIApiKey: Deno.env.get("OPENAI_API_KEY"),
      modelName: Deno.env.get("OPENAI_MODEL") ?? "gpt-4-turbo-preview",
      temperature: Number(Deno.env.get("AI_TEMPERATURE") ?? "0.7"),
      streaming: true,
    });

    // Initialize the agent with LangSmith configuration
    const executor = await initializeAgentExecutorWithOptions(tools, model, {
      agentType: "chat-conversational-react-description",
      verbose: true,
      returnIntermediateSteps: true,
      maxIterations: 3,
      earlyStoppingMethod: "generate",
      tags: ["support-agent", `session:${sessionId}`],
      metadata: {
        sessionId,
        supporterId,
      },
    });

    // Create a LangSmith run for this interaction
    const run = langsmith?.createRun({
      name: "Support Agent Interaction",
      inputs: { message },
      tags: ["support-interaction"],
      metadata: {
        sessionId,
        supporterId,
      },
    });

    // Create a new ReadableStream for streaming the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Store the user message
          await supabaseClient.from("ai_chat_messages").insert({
            chat_session_id: sessionId,
            sender_type: "user",
            content: message,
          });

          let fullResponse = "";
          let steps: any[] = [];

          // Process the message with streaming
          await executor.call(
            { input: message },
            {
              callbacks: [{
                handleLLMNewToken(token: string) {
                  controller.enqueue(token);
                  fullResponse += token;
                },
                handleToolEnd(output: string, toolName: string) {
                  steps.push({ tool: toolName, output });
                },
              }],
            }
          );

          // Store the AI response
          await supabaseClient.from("ai_chat_messages").insert({
            chat_session_id: sessionId,
            sender_type: "llm",
            content: fullResponse,
            metadata: { 
              steps,
              runId: run?.id, // Store LangSmith run ID for reference
            },
          });

          // Update LangSmith run with the results
          if (run) {
            await langsmith?.updateRun(run.id, {
              outputs: { 
                response: fullResponse,
                steps,
              },
              status: "completed",
            });
          }

          controller.close();
        } catch (error) {
          // Log error to LangSmith if available
          if (langsmith && run) {
            await langsmith.updateRun(run.id, {
              status: "failed",
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
          
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}); 