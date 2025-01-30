import { Tool } from "https://esm.sh/langchain@0.0.77/tools";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ChatAction {
  action: "create" | "update" | "get_history";
  session_id?: string;
  title?: string;
  status?: "active" | "archived" | "deleted";
}

export class ChatSessionTool extends Tool {
  name = "chat_session";
  description = `Manage chat sessions. Available actions:
  - create: Create a new chat session
  - update: Update a chat session's title or status
  - get_history: Get the chat history for a session
  The current session ID and supporter ID are available in the agent's memory.`;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly supporterId: string,
    private readonly sessionId?: string
  ) {
    super();
  }

  protected async _call(input: string, runManager?: any): Promise<string> {
    try {
      const { action, session_id, title, status } = JSON.parse(input) as ChatAction;
      
      // Use the session ID from constructor if available, otherwise use from input
      const effectiveSessionId = this.sessionId || session_id;
      
      // If we have runManager, try to get additional context
      const memory = runManager?.memory;
      const contextSessionId = memory?.sessionId;
      const contextSupporterId = memory?.supporterId;
      
      const finalSessionId = effectiveSessionId || contextSessionId;
      const finalSupporterId = this.supporterId || contextSupporterId;
      
      if (!finalSessionId || !finalSupporterId) {
        throw new Error("Missing session or supporter ID");
      }

      switch (action) {
        case "create":
          return await this.createSession(title);
        case "update":
          return await this.updateSession(finalSessionId, { title, status });
        case "get_history":
          return await this.getSessionHistory(finalSessionId);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        return `Error managing chat session: ${error.message}`;
      }
      return "An unknown error occurred";
    }
  }

  private async createSession(title?: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("ai_chat_sessions")
      .insert({
        supporter_id: this.supporterId,
        title: title || "New Chat",
      })
      .select()
      .single();

    if (error) throw error;
    return JSON.stringify(data);
  }

  private async updateSession(
    sessionId: string,
    updates: { title?: string; status?: string }
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from("ai_chat_sessions")
      .update(updates)
      .eq("id", sessionId)
      .eq("supporter_id", this.supporterId)
      .select()
      .single();

    if (error) throw error;
    return JSON.stringify(data);
  }

  private async getSessionHistory(sessionId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("ai_chat_messages")
      .select("*")
      .eq("chat_session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return JSON.stringify(data);
  }
} 