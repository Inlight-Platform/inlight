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
      broadway_metrics: {
        Row: {
          attendance: number
          capacity_percentage: number
          created_at: string
          date: string
          id: string
          show_type: string
          theater: string
          title: string
          weekly_gross: number
        }
        Insert: {
          attendance?: number
          capacity_percentage?: number
          created_at?: string
          date?: string
          id?: string
          show_type: string
          theater: string
          title: string
          weekly_gross: number
        }
        Update: {
          attendance?: number
          capacity_percentage?: number
          created_at?: string
          date?: string
          id?: string
          show_type?: string
          theater?: string
          title?: string
          weekly_gross?: number
        }
        Relationships: []
      }
      connections: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      credits: {
        Row: {
          company: string | null
          created_at: string
          id: string
          project: string
          role: string
          updated_at: string
          user_id: string
          verified: boolean
          year: number
        }
        Insert: {
          company?: string | null
          created_at?: string
          id?: string
          project: string
          role: string
          updated_at?: string
          user_id: string
          verified?: boolean
          year: number
        }
        Update: {
          company?: string | null
          created_at?: string
          id?: string
          project?: string
          role?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
          year?: number
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_type: string | null
          id: string
          image_url: string | null
          location: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date: string
          event_type?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      film_metrics: {
        Row: {
          created_at: string
          date: string
          id: string
          rating: number
          studio: string
          title: string
          total_gross: number
          week_change: number
          weekend_gross: number
          weeks_in_release: number
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          rating?: number
          studio: string
          title: string
          total_gross: number
          week_change?: number
          weekend_gross: number
          weeks_in_release?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          rating?: number
          studio?: string
          title?: string
          total_gross?: number
          week_change?: number
          weekend_gross?: number
          weeks_in_release?: number
        }
        Relationships: []
      }
      industry_highlights: {
        Row: {
          category: string
          content: string
          created_at: string
          date: string
          id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          date?: string
          id?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          date?: string
          id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_views: {
        Row: {
          id: string
          viewed_at: string
          viewed_profile_id: string
          viewer_id: string
        }
        Insert: {
          id?: string
          viewed_at?: string
          viewed_profile_id: string
          viewer_id: string
        }
        Update: {
          id?: string
          viewed_at?: string
          viewed_profile_id?: string
          viewer_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          badges: string[] | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string
          gear_list: string[] | null
          headline: string | null
          id: string
          location: string | null
          pronouns: string | null
          representation: string | null
          role: string | null
          union_status: string | null
          updated_at: string
          user_id: string
          vouch_count: number
        }
        Insert: {
          avatar_url?: string | null
          badges?: string[] | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          gear_list?: string[] | null
          headline?: string | null
          id?: string
          location?: string | null
          pronouns?: string | null
          representation?: string | null
          role?: string | null
          union_status?: string | null
          updated_at?: string
          user_id: string
          vouch_count?: number
        }
        Update: {
          avatar_url?: string | null
          badges?: string[] | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          gear_list?: string[] | null
          headline?: string | null
          id?: string
          location?: string | null
          pronouns?: string | null
          representation?: string | null
          role?: string | null
          union_status?: string | null
          updated_at?: string
          user_id?: string
          vouch_count?: number
        }
        Relationships: []
      }
      project_members: {
        Row: {
          id: string
          joined_at: string
          project_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          project_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          project_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          project_id: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          project_id: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_photos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category: string | null
          created_at: string
          creator_id: string
          description: string | null
          id: string
          main_image_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          main_image_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          main_image_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_projects: {
        Row: {
          id: string
          project_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          id?: string
          project_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          id?: string
          project_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "studio_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_posts: {
        Row: {
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          studio_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          studio_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          studio_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_posts_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studios: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_engagement: {
        Row: {
          connections_made: number
          created_at: string
          date: string
          id: string
          messages_received: number
          messages_sent: number
          profile_views: number
          story_views: number
          updated_at: string
          user_id: string
        }
        Insert: {
          connections_made?: number
          created_at?: string
          date?: string
          id?: string
          messages_received?: number
          messages_sent?: number
          profile_views?: number
          story_views?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          connections_made?: number
          created_at?: string
          date?: string
          id?: string
          messages_received?: number
          messages_sent?: number
          profile_views?: number
          story_views?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_media: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          mime_type: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          mime_type: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          mime_type?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      vouches: {
        Row: {
          created_at: string
          id: string
          vouched_for_id: string
          voucher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          vouched_for_id: string
          voucher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          vouched_for_id?: string
          voucher_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          badges: string[] | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          gear_list: string[] | null
          headline: string | null
          id: string | null
          location: string | null
          pronouns: string | null
          representation: string | null
          role: string | null
          union_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          badges?: string[] | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          gear_list?: string[] | null
          headline?: string | null
          id?: string | null
          location?: string | null
          pronouns?: string | null
          representation?: string | null
          role?: string | null
          union_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          badges?: string[] | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          gear_list?: string[] | null
          headline?: string | null
          id?: string | null
          location?: string | null
          pronouns?: string | null
          representation?: string | null
          role?: string | null
          union_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_2nd_degree_connections: {
        Args: { target_user_id: string }
        Returns: {
          user_id: string
        }[]
      }
      get_mutual_connections: {
        Args: { target_user_id: string }
        Returns: {
          user_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
