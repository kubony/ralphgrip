export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_logs: {
        Row: {
          action: string
          agent_id: string
          created_at: string
          details: Json | null
          id: string
        }
        Insert: {
          action: string
          agent_id: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Update: {
          action?: string
          agent_id?: string
          created_at?: string
          details?: Json | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_permissions: {
        Row: {
          agent_id: string
          granted_at: string
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          agent_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_permissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          agent_kind: string
          agent_model: string | null
          agent_role: string
          agent_runtime: string
          api_key_hash: string | null
          api_key_prefix: string | null
          avatar_url: string | null
          category: string
          created_at: string
          description: string | null
          display_name: string
          id: string
          metadata: Json | null
          name: string
          owner_id: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["agent_status"]
          updated_at: string
        }
        Insert: {
          agent_kind?: string
          agent_model?: string | null
          agent_role?: string
          agent_runtime?: string
          api_key_hash?: string | null
          api_key_prefix?: string | null
          avatar_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          metadata?: Json | null
          name: string
          owner_id?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Update: {
          agent_kind?: string
          agent_model?: string | null
          agent_role?: string
          agent_runtime?: string
          api_key_hash?: string | null
          api_key_prefix?: string | null
          avatar_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          metadata?: Json | null
          name?: string
          owner_id?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          agent_id: string | null
          attachments: Json | null
          author_id: string | null
          content: string
          created_at: string | null
          deleted_at: string | null
          id: string
          updated_at: string | null
          work_item_id: string
        }
        Insert: {
          agent_id?: string | null
          attachments?: Json | null
          author_id?: string | null
          content: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          updated_at?: string | null
          work_item_id: string
        }
        Update: {
          agent_id?: string | null
          attachments?: Json | null
          author_id?: string | null
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          updated_at?: string | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "active_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          position: number
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          app_role: Database["public"]["Enums"]["app_role"]
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          google_access_token: string | null
          google_refresh_token: string | null
          google_token_expires_at: string | null
          id: string
          updated_at: string
        }
        Insert: {
          app_role?: Database["public"]["Enums"]["app_role"]
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          app_role?: Database["public"]["Enums"]["app_role"]
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_audit_logs: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_fields: string[]
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          operation: string
          project_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[]
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          project_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[]
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_pinned: boolean
          last_viewed_at: string | null
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean
          last_viewed_at?: string | null
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean
          last_viewed_at?: string | null
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          is_demo: boolean
          key: string
          name: string
          owner_id: string
          project_type: string
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          key: string
          name: string
          owner_id: string
          project_type?: string
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_demo?: boolean
          key?: string
          name?: string
          owner_id?: string
          project_type?: string
          settings?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_closed: boolean | null
          name: string
          position: number
          project_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean | null
          name: string
          position?: number
          project_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_closed?: boolean | null
          name?: string
          position?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statuses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statuses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      trackers: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          position: number
          project_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          position?: number
          project_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          position?: number
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trackers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trackers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          project_id: string | null
          properties: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          project_id?: string | null
          properties?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          project_id?: string | null
          properties?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pinned_items: {
        Row: {
          pinned_at: string
          user_id: string
          work_item_id: string
        }
        Insert: {
          pinned_at?: string
          user_id: string
          work_item_id: string
        }
        Update: {
          pinned_at?: string
          user_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pinned_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pinned_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "active_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pinned_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_audit_logs: {
        Row: {
          agent_id: string | null
          changed_at: string
          changed_by: string | null
          changed_fields: string[]
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          operation: string
          project_id: string
          work_item_id: string
        }
        Insert: {
          agent_id?: string | null
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[]
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          project_id: string
          work_item_id: string
        }
        Update: {
          agent_id?: string | null
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[]
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          project_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_audit_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_audit_logs_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "active_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_audit_logs_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          link_type: string
          source_id: string
          suspect: boolean
          target_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          link_type?: string
          source_id: string
          suspect?: boolean
          target_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          link_type?: string
          source_id?: string
          suspect?: boolean
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_links_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "active_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_links_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_links_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "active_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_links_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_sequences: {
        Row: {
          created_at: string
          next_number: number
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          next_number?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          next_number?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_sequences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_sequences_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          actual_end_date: string | null
          actual_hours: number | null
          actual_resolved_date: string | null
          actual_start_date: string | null
          agent_assignee_id: string | null
          agent_reporter_id: string | null
          ai_metadata: Json | null
          assignee_id: string | null
          created_at: string
          created_by_ai: boolean | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          external_url: string | null
          folder_id: string | null
          id: string
          level: number | null
          number: number
          parent_id: string | null
          position: number
          priority: number
          project_id: string
          reporter_id: string
          start_date: string | null
          status_id: string
          title: string
          tracker_id: string
          updated_at: string
          visibility: string | null
        }
        Insert: {
          actual_end_date?: string | null
          actual_hours?: number | null
          actual_resolved_date?: string | null
          actual_start_date?: string | null
          agent_assignee_id?: string | null
          agent_reporter_id?: string | null
          ai_metadata?: Json | null
          assignee_id?: string | null
          created_at?: string
          created_by_ai?: boolean | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          external_url?: string | null
          folder_id?: string | null
          id?: string
          level?: number | null
          number: number
          parent_id?: string | null
          position?: number
          priority?: number
          project_id: string
          reporter_id: string
          start_date?: string | null
          status_id: string
          title: string
          tracker_id: string
          updated_at?: string
          visibility?: string | null
        }
        Update: {
          actual_end_date?: string | null
          actual_hours?: number | null
          actual_resolved_date?: string | null
          actual_start_date?: string | null
          agent_assignee_id?: string | null
          agent_reporter_id?: string | null
          ai_metadata?: Json | null
          assignee_id?: string | null
          created_at?: string
          created_by_ai?: boolean | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          external_url?: string | null
          folder_id?: string | null
          id?: string
          level?: number | null
          number?: number
          parent_id?: string | null
          position?: number
          priority?: number
          project_id?: string
          reporter_id?: string
          start_date?: string | null
          status_id?: string
          title?: string
          tracker_id?: string
          updated_at?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_items_agent_assignee_id_fkey"
            columns: ["agent_assignee_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_agent_reporter_id_fkey"
            columns: ["agent_reporter_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "active_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "trackers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_projects: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          id: string | null
          is_demo: boolean | null
          key: string | null
          name: string | null
          owner_id: string | null
          project_type: string | null
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string | null
          is_demo?: boolean | null
          key?: string | null
          name?: string | null
          owner_id?: string | null
          project_type?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string | null
          is_demo?: boolean | null
          key?: string | null
          name?: string | null
          owner_id?: string | null
          project_type?: string | null
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      active_work_items: {
        Row: {
          actual_end_date: string | null
          actual_hours: number | null
          actual_resolved_date: string | null
          actual_start_date: string | null
          ai_metadata: Json | null
          assignee_id: string | null
          created_at: string | null
          created_by_ai: boolean | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          external_url: string | null
          folder_id: string | null
          id: string | null
          level: number | null
          number: number | null
          parent_id: string | null
          position: number | null
          priority: number | null
          project_id: string | null
          reporter_id: string | null
          start_date: string | null
          status_id: string | null
          title: string | null
          tracker_id: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          actual_end_date?: string | null
          actual_hours?: number | null
          actual_resolved_date?: string | null
          actual_start_date?: string | null
          ai_metadata?: Json | null
          assignee_id?: string | null
          created_at?: string | null
          created_by_ai?: boolean | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          external_url?: string | null
          folder_id?: string | null
          id?: string | null
          level?: number | null
          number?: number | null
          parent_id?: string | null
          position?: number | null
          priority?: number | null
          project_id?: string | null
          reporter_id?: string | null
          start_date?: string | null
          status_id?: string | null
          title?: string | null
          tracker_id?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          actual_end_date?: string | null
          actual_hours?: number | null
          actual_resolved_date?: string | null
          actual_start_date?: string | null
          ai_metadata?: Json | null
          assignee_id?: string | null
          created_at?: string | null
          created_by_ai?: boolean | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          external_url?: string | null
          folder_id?: string | null
          id?: string | null
          level?: number | null
          number?: number | null
          parent_id?: string | null
          position?: number | null
          priority?: number | null
          project_id?: string | null
          reporter_id?: string | null
          start_date?: string | null
          status_id?: string | null
          title?: string | null
          tracker_id?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "active_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "trackers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      batch_soft_delete_work_items: {
        Args: { p_project_id: string; p_work_item_ids: string[] }
        Returns: number
      }
      get_app_role: { Args: never; Returns: string }
      get_linked_issue_worst_status: {
        Args: { p_project_id: string }
        Returns: {
          work_item_id: string
          worst_status_color: string
          worst_status_name: string
        }[]
      }
      get_project_role: { Args: { p_project_id: string }; Returns: string }
      get_work_item_link_counts: {
        Args: { p_project_id: string }
        Returns: {
          has_suspect: boolean
          link_count: number
          work_item_id: string
        }[]
      }
      is_app_user: { Args: never; Returns: boolean }
      is_project_admin: { Args: { p_project_id: string }; Returns: boolean }
      is_project_member: { Args: { p_project_id: string }; Returns: boolean }
      move_work_items_batch: {
        Args: {
          p_moves: Database["public"]["CompositeTypes"]["work_item_move"][]
          p_project_id: string
        }
        Returns: {
          error_message: string
          id: string
          success: boolean
        }[]
      }
      permanently_delete_work_item: {
        Args: { p_work_item_id: string }
        Returns: boolean
      }
      reorder_work_items: {
        Args: {
          p_item_ids: string[]
          p_parent_id: string
          p_project_id: string
        }
        Returns: {
          id: string
          new_position: number
          success: boolean
        }[]
      }
      restore_project: { Args: { p_project_id: string }; Returns: boolean }
      restore_work_item: { Args: { p_work_item_id: string }; Returns: boolean }
      set_agent_session: { Args: { agent_id: string }; Returns: undefined }
      soft_delete_project: { Args: { p_project_id: string }; Returns: boolean }
      soft_delete_work_item: {
        Args: { p_work_item_id: string }
        Returns: boolean
      }
      touch_project_view: { Args: { p_project_id: string }; Returns: undefined }
      update_user_app_role: {
        Args: { p_new_role: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      agent_status: "active" | "inactive" | "revoked"
      app_role: "admin" | "user" | "guest"
      project_role: "owner" | "admin" | "member" | "viewer"
    }
    CompositeTypes: {
      work_item_move: {
        id: string | null
        parent_id: string | null
        position: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_status: ["active", "inactive", "revoked"],
      app_role: ["admin", "user", "guest"],
      project_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const
