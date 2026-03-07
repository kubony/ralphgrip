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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      comment_reads: {
        Row: {
          comment_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reads_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
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
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          comment_id: string | null
          created_at: string
          id: string
          project_id: string | null
          project_key: string
          read_at: string | null
          title: string
          type: string
          user_id: string
          work_item_id: string | null
          work_item_number: number
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          project_key: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
          work_item_id?: string | null
          work_item_number: number
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          project_id?: string | null
          project_key?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
          work_item_id?: string | null
          work_item_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "active_work_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
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
            foreignKeyName: "work_item_audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          actual_start_date: string | null
          ai_metadata: Json | null
          assignee_id: string | null
          created_at: string
          created_by_ai: boolean
          deleted_at: string | null
          description: string | null
          due_date: string | null
          estimated_hours: number | null
          external_links: Json | null
          external_url: string | null
          id: string
          level: number
          number: number
          parent_id: string | null
          position: number
          priority: number
          project_id: string
          reporter_id: string
          start_date: string | null
          status_id: string | null
          title: string
          tracker_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          actual_end_date?: string | null
          actual_hours?: number | null
          actual_start_date?: string | null
          ai_metadata?: Json | null
          assignee_id?: string | null
          created_at?: string
          created_by_ai?: boolean
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          external_links?: Json | null
          external_url?: string | null
          id?: string
          level?: number
          number: number
          parent_id?: string | null
          position?: number
          priority?: number
          project_id: string
          reporter_id: string
          start_date?: string | null
          status_id?: string | null
          title: string
          tracker_id: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          actual_end_date?: string | null
          actual_hours?: number | null
          actual_start_date?: string | null
          ai_metadata?: Json | null
          assignee_id?: string | null
          created_at?: string
          created_by_ai?: boolean
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_hours?: number | null
          external_links?: Json | null
          external_url?: string | null
          id?: string
          level?: number
          number?: number
          parent_id?: string | null
          position?: number
          priority?: number
          project_id?: string
          reporter_id?: string
          start_date?: string | null
          status_id?: string | null
          title?: string
          tracker_id?: string
          updated_at?: string
          visibility?: string
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
      check_circular_reference: {
        Args: { p_item_id: string; p_new_parent_id: string }
        Returns: boolean
      }
      get_app_role: { Args: never; Returns: string }
      get_cross_project_links: {
        Args: { p_project_ids?: string[] }
        Returns: {
          link_count: number
          source_project_id: string
          source_project_key: string
          source_project_name: string
          suspect_count: number
          target_project_id: string
          target_project_key: string
          target_project_name: string
        }[]
      }
      get_linked_issue_worst_status: {
        Args: { p_project_id: string }
        Returns: {
          work_item_id: string
          worst_status_color: string
          worst_status_name: string
        }[]
      }
      get_project_card_summaries: {
        Args: { p_project_ids: string[] }
        Returns: {
          closed_count: number
          item_count: number
          member_count: number
          members: Json
          owner_avatar_url: string
          owner_name: string
          project_id: string
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
      app_role: ["admin", "user", "guest"],
      project_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const
