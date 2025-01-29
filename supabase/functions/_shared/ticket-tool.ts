import { Tool } from "https://esm.sh/langchain/tools";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TicketAction {
  action: "add_note" | "add_message" | "update_ticket";
  ticket_id: string;
  content?: string;
  category_id?: string;
  assigned_to_supporter_id?: string;
  status?: "new" | "in_progress" | "requires_response" | "closed";
}

export class TicketTool extends Tool {
  name = "ticket_operations";
  description = `Manage tickets, notes, and messages. Available actions:
  - add_note: Add an internal note to a ticket (only visible to supporters)
  - add_message: Add a message to a ticket (visible to customer)
  - update_ticket: Update ticket properties (category, assignment, status)
  
  For updating tickets, you can specify:
  - category_id: The new category ID
  - assigned_to_supporter_id: The ID of the supporter to assign to
  - status: new, in_progress, requires_response, or closed
  
  Always verify the ticket exists before performing operations.
  Ask for clarification if any required information is missing.`;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly supporterId: string
  ) {
    super();
  }

  protected async _call(input: string): Promise<string> {
    try {
      const action = JSON.parse(input) as TicketAction;

      // First verify the ticket exists
      const { data: ticket, error: ticketError } = await this.supabase
        .from("tickets")
        .select("id, title")
        .eq("id", action.ticket_id)
        .single();

      if (ticketError || !ticket) {
        return `Error: Ticket #${action.ticket_id} not found. Please verify the ticket ID.`;
      }

      switch (action.action) {
        case "add_note":
          if (!action.content) {
            return "Error: Note content is required. Please provide the content for the note.";
          }
          return await this.addNote(action.ticket_id, action.content);

        case "add_message":
          if (!action.content) {
            return "Error: Message content is required. Please provide the content for the message.";
          }
          return await this.addMessage(action.ticket_id, action.content);

        case "update_ticket":
          if (!action.category_id && !action.assigned_to_supporter_id && !action.status) {
            return "Error: No update parameters provided. Please specify what you want to update (category, assignment, or status).";
          }
          return await this.updateTicket(action.ticket_id, {
            category_id: action.category_id,
            assigned_to_supporter_id: action.assigned_to_supporter_id,
            ticket_status: action.status,
          });

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

  private async addNote(ticketId: string, content: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("notes")
      .insert({
        ticket_id: ticketId,
        supporter_id: this.supporterId,
        content: content,
      })
      .select()
      .single();

    if (error) throw error;
    return `Successfully added note to ticket #${ticketId}`;
  }

  private async addMessage(ticketId: string, content: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("messages")
      .insert({
        ticket_id: ticketId,
        sender_type: "supporter",
        sender_id: this.supporterId,
        content: content,
      })
      .select()
      .single();

    if (error) throw error;
    return `Successfully added message to ticket #${ticketId}`;
  }

  private async updateTicket(
    ticketId: string,
    updates: {
      category_id?: string;
      assigned_to_supporter_id?: string;
      ticket_status?: string;
    }
  ): Promise<string> {
    // First verify any referenced IDs exist
    if (updates.category_id) {
      const { data: category, error: categoryError } = await this.supabase
        .from("categories")
        .select("id")
        .eq("id", updates.category_id)
        .single();

      if (categoryError || !category) {
        return `Error: Category ${updates.category_id} not found`;
      }
    }

    if (updates.assigned_to_supporter_id) {
      const { data: supporter, error: supporterError } = await this.supabase
        .from("supporters")
        .select("id")
        .eq("id", updates.assigned_to_supporter_id)
        .single();

      if (supporterError || !supporter) {
        return `Error: Supporter ${updates.assigned_to_supporter_id} not found`;
      }
    }

    const { data, error } = await this.supabase
      .from("tickets")
      .update(updates)
      .eq("id", ticketId)
      .select()
      .single();

    if (error) throw error;

    const changes = [];
    if (updates.category_id) changes.push("category");
    if (updates.assigned_to_supporter_id) changes.push("assignment");
    if (updates.ticket_status) changes.push("status");

    return `Successfully updated ticket #${ticketId} (changed: ${changes.join(", ")})`;
  }
} 