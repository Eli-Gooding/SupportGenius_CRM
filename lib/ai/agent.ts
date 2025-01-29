import { ChatOpenAI } from "langchain/chat_models/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseDatabaseTool } from "./tools/database";
import { ChatSessionTool } from "./tools/chat-session";
import { Client } from "langsmith";

export interface AIAgentConfig {
  openaiApiKey: string;
  model: string;
  temperature?: number;
  supporterId: string;
  sessionId: string;
  projectName?: string; // Optional LangSmith project name
}

export class AIAgent {
  private model: ChatOpenAI;
  private executor: any;
  private langsmith: Client;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly config: AIAgentConfig
  ) {
    this.model = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: config.model,
      temperature: config.temperature ?? 0.7,
    });

    // Initialize LangSmith client if tracing is enabled
    if (process.env.LANGCHAIN_TRACING_V2 === "true") {
      this.langsmith = new Client({
        apiUrl: process.env.LANGCHAIN_ENDPOINT,
        apiKey: process.env.LANGCHAIN_API_KEY,
      });
    }
  }

  async initialize() {
    const tools = [
      new SupabaseDatabaseTool(this.supabase),
      new ChatSessionTool(this.supabase, this.config.supporterId),
    ];

    this.executor = await initializeAgentExecutorWithOptions(tools, this.model, {
      agentType: "chat-conversational-react-description",
      verbose: true,
      returnIntermediateSteps: true,
      maxIterations: 3,
      earlyStoppingMethod: "generate",
      tags: ["support-agent", `session:${this.config.sessionId}`],
      metadata: {
        sessionId: this.config.sessionId,
        supporterId: this.config.supporterId,
      },
    });

    // Set initial context
    await this.executor.memory.saveContext(
      { input: "Initialize chat session" },
      {
        output: `Chat session initialized. Session ID: ${this.config.sessionId}. 
        You are a helpful AI assistant for support agents. You can:
        1. Query the database to find information
        2. Manage chat sessions
        Always format your responses professionally and clearly.`,
      }
    );
  }

  async processMessage(message: string): Promise<{
    response: string;
    steps?: any[];
  }> {
    if (!this.executor) {
      throw new Error("Agent not initialized. Call initialize() first.");
    }

    try {
      // Create a run in LangSmith for this interaction
      const run = this.langsmith?.createRun({
        name: "Support Agent Interaction",
        inputs: { message },
        tags: ["support-interaction"],
        metadata: {
          sessionId: this.config.sessionId,
          supporterId: this.config.supporterId,
        },
      });

      const result = await this.executor.call({ input: message });

      // Store the message and response
      await this.supabase.from("ai_chat_messages").insert([
        {
          chat_session_id: this.config.sessionId,
          sender_type: "user",
          content: message,
        },
        {
          chat_session_id: this.config.sessionId,
          sender_type: "llm",
          content: result.output,
          metadata: {
            steps: result.intermediateSteps,
            runId: run?.id, // Store LangSmith run ID for reference
          },
        },
      ]);

      // Update LangSmith run with the results
      if (run) {
        await this.langsmith?.updateRun(run.id, {
          outputs: { 
            response: result.output,
            steps: result.intermediateSteps,
          },
          status: "completed",
        });
      }

      return {
        response: result.output,
        steps: result.intermediateSteps,
      };
    } catch (error) {
      // Log error to LangSmith if available
      if (this.langsmith && run) {
        await this.langsmith.updateRun(run.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
      
      console.error("Error processing message:", error);
      throw error;
    }
  }
} 