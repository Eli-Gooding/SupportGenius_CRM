import { Tool } from "langchain/tools";
import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

// Schema for validating SQL queries
const SQLQuerySchema = z.object({
  query: z.string().min(1),
  parameters: z.array(z.any()).optional(),
});

export class SupabaseDatabaseTool extends Tool {
  name = "supabase_db";
  description = `Use this tool to query the database. Always use parameterized queries for safety.
  Available tables:
  - tickets (id, title, category_id, created_by_user_id, assigned_to_supporter_id, ticket_status, priority)
  - supporters (id, email, full_name)
  - users (id, email, full_name, company_id)
  - companies (id, company_name)
  - categories (id, category_name, description)
  - messages (id, ticket_id, sender_type, sender_id, content)`;

  constructor(private readonly supabase: SupabaseClient) {
    super();
  }

  protected async _call(input: string): Promise<string> {
    try {
      // Parse and validate the input
      const { query, parameters = [] } = SQLQuerySchema.parse(
        JSON.parse(input)
      );

      // Execute the query
      const { data, error } = await this.supabase.rpc(
        "ai_execute_query",
        {
          query_text: query,
          query_params: parameters,
        }
      );

      if (error) throw error;

      return JSON.stringify(data);
    } catch (error) {
      return `Error executing query: ${error.message}`;
    }
  }
} 