export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          company_name: string
          created_at: string
        }
        Insert: {
          id?: string
          company_name: string
          created_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          created_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          company_id: string | null
          created_at: string
          last_login: string | null
        }
        Insert: {
          id: string
          email: string
          full_name: string
          company_id?: string | null
          created_at?: string
          last_login?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          company_id?: string | null
          created_at?: string
          last_login?: string | null
        }
      }
      supporters: {
        Row: {
          id: string
          email: string
          full_name: string
          created_at: string
          last_login: string | null
        }
        Insert: {
          id: string
          email: string
          full_name: string
          created_at?: string
          last_login?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          created_at?: string
          last_login?: string | null
        }
      }
      categories: {
        Row: {
          id: string
          category_name: string
          description: string | null
        }
        Insert: {
          id?: string
          category_name: string
          description?: string | null
        }
        Update: {
          id?: string
          category_name?: string
          description?: string | null
        }
      }
      tickets: {
        Row: {
          id: string
          title: string
          category_id: string | null
          created_by_user_id: string
          assigned_to_supporter_id: string | null
          ticket_status: 'new' | 'in_progress' | 'requires_response' | 'closed'
          priority: 'low' | 'medium' | 'high' | 'urgent' | null
          created_at: string
          updated_at: string
          closed_at: string | null
        }
        Insert: {
          id?: string
          title: string
          category_id?: string | null
          created_by_user_id: string
          assigned_to_supporter_id?: string | null
          ticket_status: 'new' | 'in_progress' | 'requires_response' | 'closed'
          priority?: 'low' | 'medium' | 'high' | 'urgent' | null
          created_at?: string
          updated_at?: string
          closed_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          category_id?: string | null
          created_by_user_id?: string
          assigned_to_supporter_id?: string | null
          ticket_status?: 'new' | 'in_progress' | 'requires_response' | 'closed'
          priority?: 'low' | 'medium' | 'high' | 'urgent' | null
          created_at?: string
          updated_at?: string
          closed_at?: string | null
        }
      }
      messages: {
        Row: {
          id: string
          ticket_id: string
          sender_type: 'user' | 'supporter'
          sender_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          sender_type: 'user' | 'supporter'
          sender_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          sender_type?: 'user' | 'supporter'
          sender_id?: string
          content?: string
          created_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          ticket_id: string
          supporter_id: string
          note_title: string | null
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          supporter_id: string
          note_title?: string | null
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          supporter_id?: string
          note_title?: string | null
          content?: string
          created_at?: string
        }
      }
      files: {
        Row: {
          id: string
          file_name: string
          file_size: number
          mime_type: string
          storage_path: string
          uploaded_by_type: 'user' | 'supporter'
          uploaded_by_id: string
          ticket_id: string | null
          message_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          file_name: string
          file_size: number
          mime_type: string
          storage_path: string
          uploaded_by_type: 'user' | 'supporter'
          uploaded_by_id: string
          ticket_id?: string | null
          message_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          file_name?: string
          file_size?: number
          mime_type?: string
          storage_path?: string
          uploaded_by_type?: 'user' | 'supporter'
          uploaded_by_id?: string
          ticket_id?: string | null
          message_id?: string | null
          created_at?: string
        }
      }
      templates: {
        Row: {
          id: string
          template_name: string
          content: string
          created_by_supporter_id: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          template_name: string
          content: string
          created_by_supporter_id: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          template_name?: string
          content?: string
          created_by_supporter_id?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      template_mappings: {
        Row: {
          id: string
          template_id: string
          ticket_category_id: string
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          ticket_category_id: string
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          ticket_category_id?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 