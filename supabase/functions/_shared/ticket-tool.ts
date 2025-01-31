import { Tool } from "https://esm.sh/langchain@0.0.77/tools";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TicketAction {
  action: "route_ticket" | "add_message" | "add_note";
  ticket_id: string;
  assigned_to_supporter_id?: string;  // for route_ticket
  content?: string;                   // for add_message and add_note
  note_title?: string;                // optional for add_note
}

export class TicketTool extends Tool {
  name = "ticket_operations";
  description = `Manage ticket operations. Available actions:
  - route_ticket: Route a ticket to a specific supporter
    Required: ticket_id, assigned_to_supporter_id
  
  - add_message: Add a message to a ticket (visible to customer)
    Required: ticket_id, content
  
  - add_note: Add an internal note to a ticket (only visible to supporters)
    Required: ticket_id, content
    Optional: note_title`;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly supporterId: string
  ) {
    super();
  }

  protected async _call(input: string): Promise<string> {
    try {
      const action = JSON.parse(input) as TicketAction;

      if (!action.ticket_id) {
        return "Error: ticket_id is required for all actions";
      }

      switch (action.action) {
        case "route_ticket":
          if (!action.assigned_to_supporter_id) {
            return "Error: assigned_to_supporter_id is required for routing";
          }
          return await this.routeTicket(action.ticket_id, action.assigned_to_supporter_id);

        case "add_message":
          if (!action.content) {
            return "Error: content is required for messages";
          }
          return await this.addMessage(action.ticket_id, action.content);

        case "add_note":
          if (!action.content) {
            return "Error: content is required for notes";
          }
          return await this.addNote(action.ticket_id, action.content, action.note_title);

        default:
          return `Error: Unknown action ${action.action}`;
      }
    } catch (error) {
      if (error instanceof Error) {
        return `Error performing ticket operation: ${error.message}`;
      }
      return "An unknown error occurred";
    }
  }

  private async routeTicket(ticketId: string, supporterId: string): Promise<string> {
    console.log(`Attempting to route ticket #${ticketId} to supporter #${supporterId}`);
    
    const { data, error } = await this.supabase
      .from("tickets")
      .update({ 
        assigned_to_supporter_id: supporterId,
        ticket_status: "in_progress"
      })
      .eq("id", ticketId)
      .select()
      .single();

    if (error) {
      console.error(`Error routing ticket #${ticketId}:`, error);
      return `Error: Unable to route ticket #${ticketId} - ${error.message}`;
    }

    console.log(`Successfully routed ticket #${ticketId} to supporter #${supporterId}`, data);
    return `Successfully routed ticket #${ticketId} to supporter #${supporterId}`;
  }

  private async addMessage(ticketId: string, content: string): Promise<string> {
    console.log(`Attempting to add message to ticket #${ticketId}`);
    
    const { data, error } = await this.supabase
      .from("messages")
      .insert({
        ticket_id: ticketId,
        sender_type: "supporter",
        sender_id: this.supporterId,
        content: content
      })
      .select()
      .single();

    if (error) {
      console.error(`Error adding message to ticket #${ticketId}:`, error);
      return `Error: Unable to add message to ticket #${ticketId} - ${error.message}`;
    }

    console.log(`Successfully added message to ticket #${ticketId}`, data);
    return `Successfully added message to ticket #${ticketId}`;
  }

  private async addNote(ticketId: string, content: string, noteTitle?: string): Promise<string> {
    console.log(`Attempting to add note to ticket #${ticketId}`);
    
    const { data, error } = await this.supabase
      .from("notes")
      .insert({
        ticket_id: ticketId,
        supporter_id: this.supporterId,
        note_title: noteTitle,
        content: content
      })
      .select()
      .single();

    if (error) {
      console.error(`Error adding note to ticket #${ticketId}:`, error);
      return `Error: Unable to add note to ticket #${ticketId} - ${error.message}`;
    }

    console.log(`Successfully added note to ticket #${ticketId}`, data);
    return `Successfully added note to ticket #${ticketId}`;
  }
} 