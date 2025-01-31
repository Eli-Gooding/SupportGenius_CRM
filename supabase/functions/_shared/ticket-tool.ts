import { Tool } from "https://esm.sh/langchain@0.0.77/tools";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TicketAction {
  action: "route_ticket";
  ticket_id: string;
  assigned_to_supporter_id: string;
}

export class TicketTool extends Tool {
  name = "ticket_operations";
  description = `Route tickets to supporters. Required parameters:
  - action: Must be "route_ticket"
  - ticket_id: The ID of the ticket to route
  - assigned_to_supporter_id: The ID of the supporter to assign the ticket to`;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly supporterId: string
  ) {
    super();
  }

  protected async _call(input: string): Promise<string> {
    try {
      const action = JSON.parse(input) as TicketAction;

      if (action.action !== "route_ticket") {
        return "Error: Only route_ticket action is supported";
      }

      if (!action.ticket_id || !action.assigned_to_supporter_id) {
        return "Error: Both ticket_id and assigned_to_supporter_id are required";
      }

      console.log(`Attempting to route ticket #${action.ticket_id} to supporter #${action.assigned_to_supporter_id}`);
      
      const { data, error } = await this.supabase
        .from("tickets")
        .update({ 
          assigned_to_supporter_id: action.assigned_to_supporter_id,
          ticket_status: "in_progress"
        })
        .eq("id", action.ticket_id)
        .select()
        .single();

      if (error) {
        console.error(`Error routing ticket #${action.ticket_id}:`, error);
        return `Error: Unable to route ticket #${action.ticket_id} - ${error.message}`;
      }

      console.log(`Successfully routed ticket #${action.ticket_id} to supporter #${action.assigned_to_supporter_id}`, data);
      return `Successfully routed ticket #${action.ticket_id} to supporter #${action.assigned_to_supporter_id}`;
    } catch (error) {
      if (error instanceof Error) {
        return `Error performing ticket operation: ${error.message}`;
      }
      return "An unknown error occurred";
    }
  }
} 