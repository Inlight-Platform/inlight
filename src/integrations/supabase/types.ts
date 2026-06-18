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
      analytics_events: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_name: string
          id: string
          path: string
          referrer: string | null
          site_slug: string | null
          user_agent: string | null
          user_id: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_name: string
          id?: string
          path: string
          referrer?: string | null
          site_slug?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_name?: string
          id?: string
          path?: string
          referrer?: string | null
          site_slug?: string | null
          user_agent?: string | null
          user_id?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      broadway_metrics: {
        Row: {
          attendance: number
          capacity_percentage: number
          created_at: string
          date: string
          id: string
          poster_url: string | null
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
          poster_url?: string | null
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
          poster_url?: string | null
          show_type?: string
          theater?: string
          title?: string
          weekly_gross?: number
        }
        Relationships: []
      }
      companies: {
        Row: {
          brand_accent_color: string | null
          brand_primary_color: string | null
          brand_text_color: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          fun_facts: Json
          id: string
          location: string | null
          logo_url: string | null
          mission: string | null
          name: string
          owner_user_id: string | null
          tagline: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          brand_accent_color?: string | null
          brand_primary_color?: string | null
          brand_text_color?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          fun_facts?: Json
          id?: string
          location?: string | null
          logo_url?: string | null
          mission?: string | null
          name: string
          owner_user_id?: string | null
          tagline?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          brand_accent_color?: string | null
          brand_primary_color?: string | null
          brand_text_color?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          fun_facts?: Json
          id?: string
          location?: string | null
          logo_url?: string | null
          mission?: string | null
          name?: string
          owner_user_id?: string | null
          tagline?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      company_account_requests: {
        Row: {
          admin_notes: string | null
          company_email: string | null
          company_name: string
          company_password: string | null
          created_at: string
          created_company_id: string | null
          description: string | null
          id: string
          justification: string
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          admin_notes?: string | null
          company_email?: string | null
          company_name: string
          company_password?: string | null
          created_at?: string
          created_company_id?: string | null
          description?: string | null
          id?: string
          justification: string
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          admin_notes?: string | null
          company_email?: string | null
          company_name?: string
          company_password?: string | null
          created_at?: string
          created_company_id?: string | null
          description?: string | null
          id?: string
          justification?: string
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      company_follows: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_follows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_photos: {
        Row: {
          caption: string | null
          company_id: string
          created_at: string
          id: string
          image_url: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          company_id: string
          created_at?: string
          id?: string
          image_url: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          company_id?: string
          created_at?: string
          id?: string
          image_url?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_photos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
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
      credit_verification_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          credit_id: string
          id: string
          materials_urls: string[] | null
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          credit_id: string
          id?: string
          materials_urls?: string[] | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          credit_id?: string
          id?: string
          materials_urls?: string[] | null
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_verification_requests_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_vouches: {
        Row: {
          created_at: string
          credit_id: string
          id: string
          voucher_id: string
        }
        Insert: {
          created_at?: string
          credit_id: string
          id?: string
          voucher_id: string
        }
        Update: {
          created_at?: string
          credit_id?: string
          id?: string
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_vouches_credit_id_fkey"
            columns: ["credit_id"]
            isOneToOne: false
            referencedRelation: "credits"
            referencedColumns: ["id"]
          },
        ]
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
      event_rsvps: {
        Row: {
          attended: boolean
          attended_at: string | null
          created_at: string
          custom_answer: string | null
          email: string
          event_id: string
          id: string
          name: string
          role_type: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attended?: boolean
          attended_at?: string | null
          created_at?: string
          custom_answer?: string | null
          email: string
          event_id: string
          id?: string
          name: string
          role_type?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attended?: boolean
          attended_at?: string | null
          created_at?: string
          custom_answer?: string | null
          email?: string
          event_id?: string
          id?: string
          name?: string
          role_type?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          currency: string
          custom_question: string | null
          description: string | null
          event_date: string
          event_type: string | null
          id: string
          image_url: string | null
          is_paid: boolean
          link_title: string | null
          link_url: string | null
          location: string | null
          payment_link_url: string | null
          price: number | null
          stripe_price_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          custom_question?: string | null
          description?: string | null
          event_date: string
          event_type?: string | null
          id?: string
          image_url?: string | null
          is_paid?: boolean
          link_title?: string | null
          link_url?: string | null
          location?: string | null
          payment_link_url?: string | null
          price?: number | null
          stripe_price_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          custom_question?: string | null
          description?: string | null
          event_date?: string
          event_type?: string | null
          id?: string
          image_url?: string | null
          is_paid?: boolean
          link_title?: string | null
          link_url?: string | null
          location?: string | null
          payment_link_url?: string | null
          price?: number | null
          stripe_price_id?: string | null
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
          poster_url: string | null
          rating: number
          studio: string
          ticket_url: string | null
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
          poster_url?: string | null
          rating?: number
          studio: string
          ticket_url?: string | null
          title: string
          total_gross?: number
          week_change?: number
          weekend_gross?: number
          weeks_in_release?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          poster_url?: string | null
          rating?: number
          studio?: string
          ticket_url?: string | null
          title?: string
          total_gross?: number
          week_change?: number
          weekend_gross?: number
          weeks_in_release?: number
        }
        Relationships: []
      }
      group_chat_members: {
        Row: {
          group_chat_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          group_chat_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          group_chat_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_chat_members_group_chat_id_fkey"
            columns: ["group_chat_id"]
            isOneToOne: false
            referencedRelation: "project_group_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      group_chat_messages: {
        Row: {
          content: string
          created_at: string
          group_chat_id: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_chat_id: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_chat_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_chat_messages_group_chat_id_fkey"
            columns: ["group_chat_id"]
            isOneToOne: false
            referencedRelation: "project_group_chats"
            referencedColumns: ["id"]
          },
        ]
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
      job_post_credits: {
        Row: {
          credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      nyc_shows: {
        Row: {
          accessibility_features: string[] | null
          badges: string[] | null
          borough: string
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_anonymous: boolean | null
          lottery_info: string | null
          official_url: string | null
          poster_url: string | null
          price_tier: string
          run_end: string | null
          run_start: string | null
          rush_policy: string | null
          saves_count: number | null
          show_times: string | null
          show_type: string
          submitted_by: string | null
          title: string
          updated_at: string
          venue: string
        }
        Insert: {
          accessibility_features?: string[] | null
          badges?: string[] | null
          borough?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_anonymous?: boolean | null
          lottery_info?: string | null
          official_url?: string | null
          poster_url?: string | null
          price_tier?: string
          run_end?: string | null
          run_start?: string | null
          rush_policy?: string | null
          saves_count?: number | null
          show_times?: string | null
          show_type?: string
          submitted_by?: string | null
          title: string
          updated_at?: string
          venue: string
        }
        Update: {
          accessibility_features?: string[] | null
          badges?: string[] | null
          borough?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_anonymous?: boolean | null
          lottery_info?: string | null
          official_url?: string | null
          poster_url?: string | null
          price_tier?: string
          run_end?: string | null
          run_start?: string | null
          rush_policy?: string | null
          saves_count?: number | null
          show_times?: string | null
          show_type?: string
          submitted_by?: string | null
          title?: string
          updated_at?: string
          venue?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          action_type: string
          company: string | null
          compensation: string | null
          created_at: string
          deadline: string | null
          description: string
          duration: string | null
          experience_level: string
          id: string
          image_url: string | null
          is_featured: boolean
          is_remote: boolean
          link_title: string | null
          link_url: string | null
          location: string | null
          posted_by: string
          requirements: string[]
          roles: string[]
          start_date: string | null
          status: string
          tags: string[]
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          action_type?: string
          company?: string | null
          compensation?: string | null
          created_at?: string
          deadline?: string | null
          description: string
          duration?: string | null
          experience_level?: string
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_remote?: boolean
          link_title?: string | null
          link_url?: string | null
          location?: string | null
          posted_by: string
          requirements?: string[]
          roles?: string[]
          start_date?: string | null
          status?: string
          tags?: string[]
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          company?: string | null
          compensation?: string | null
          created_at?: string
          deadline?: string | null
          description?: string
          duration?: string | null
          experience_level?: string
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_remote?: boolean
          link_title?: string | null
          link_url?: string | null
          location?: string | null
          posted_by?: string
          requirements?: string[]
          roles?: string[]
          start_date?: string | null
          status?: string
          tags?: string[]
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      opportunity_applications: {
        Row: {
          additional_materials: Json | null
          applicant_id: string
          created_at: string
          id: string
          include_profile: boolean
          message: string | null
          opportunity_id: string
          portfolio_url: string | null
          resume_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          additional_materials?: Json | null
          applicant_id: string
          created_at?: string
          id?: string
          include_profile?: boolean
          message?: string | null
          opportunity_id: string
          portfolio_url?: string | null
          resume_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          additional_materials?: Json | null
          applicant_id?: string
          created_at?: string
          id?: string
          include_profile?: boolean
          message?: string | null
          opportunity_id?: string
          portfolio_url?: string | null
          resume_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          id: string
          inviter_id: string
          personal_note: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          id?: string
          inviter_id: string
          personal_note?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          id?: string
          inviter_id?: string
          personal_note?: string | null
          token?: string
        }
        Relationships: []
      }
      post_recipients: {
        Row: {
          created_at: string
          id: string
          post_id: string
          recipient_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          recipient_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_recipients_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_position_x: number | null
          image_position_y: number | null
          image_url: string | null
          link_title: string | null
          link_url: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_position_x?: number | null
          image_position_y?: number | null
          image_url?: string | null
          link_title?: string | null
          link_url?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_position_x?: number | null
          image_position_y?: number | null
          image_url?: string | null
          link_title?: string | null
          link_url?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      profile_flipbook: {
        Row: {
          caption: string | null
          content: string | null
          content_type: string
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          content?: string | null
          content_type?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          content?: string | null
          content_type?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
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
          activity_score: number
          avatar_url: string | null
          badges: string[] | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string | null
          email: string
          email_notifications: boolean | null
          favorite_artist: string | null
          favorite_movie: string | null
          favorite_song: string | null
          gear_list: string[] | null
          goals: string[]
          graduation_status: string | null
          graduation_year: number | null
          has_completed_tour: boolean
          headline: string | null
          id: string
          instagram_url: string | null
          location: string | null
          message_privacy: string
          onboarding_completed_at: string | null
          plan_type: string
          preview_survey_completed_at: string | null
          preview_survey_goal: string | null
          preview_survey_role: string | null
          preview_survey_school: string | null
          primary_discipline: string | null
          pronouns: string | null
          referred_by: string | null
          representation: string | null
          role: string | null
          secondary_disciplines: string[]
          show_gear_list: boolean
          show_representation: boolean
          show_union_status: boolean
          skills: string[] | null
          stage_name: string | null
          stripe_customer_id: string | null
          union_status: string | null
          updated_at: string
          user_id: string
          vouch_count: number
          website_url: string | null
          why_artist: string | null
        }
        Insert: {
          activity_score?: number
          avatar_url?: string | null
          badges?: string[] | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          email_notifications?: boolean | null
          favorite_artist?: string | null
          favorite_movie?: string | null
          favorite_song?: string | null
          gear_list?: string[] | null
          goals?: string[]
          graduation_status?: string | null
          graduation_year?: number | null
          has_completed_tour?: boolean
          headline?: string | null
          id?: string
          instagram_url?: string | null
          location?: string | null
          message_privacy?: string
          onboarding_completed_at?: string | null
          plan_type?: string
          preview_survey_completed_at?: string | null
          preview_survey_goal?: string | null
          preview_survey_role?: string | null
          preview_survey_school?: string | null
          primary_discipline?: string | null
          pronouns?: string | null
          referred_by?: string | null
          representation?: string | null
          role?: string | null
          secondary_disciplines?: string[]
          show_gear_list?: boolean
          show_representation?: boolean
          show_union_status?: boolean
          skills?: string[] | null
          stage_name?: string | null
          stripe_customer_id?: string | null
          union_status?: string | null
          updated_at?: string
          user_id: string
          vouch_count?: number
          website_url?: string | null
          why_artist?: string | null
        }
        Update: {
          activity_score?: number
          avatar_url?: string | null
          badges?: string[] | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          email_notifications?: boolean | null
          favorite_artist?: string | null
          favorite_movie?: string | null
          favorite_song?: string | null
          gear_list?: string[] | null
          goals?: string[]
          graduation_status?: string | null
          graduation_year?: number | null
          has_completed_tour?: boolean
          headline?: string | null
          id?: string
          instagram_url?: string | null
          location?: string | null
          message_privacy?: string
          onboarding_completed_at?: string | null
          plan_type?: string
          preview_survey_completed_at?: string | null
          preview_survey_goal?: string | null
          preview_survey_role?: string | null
          preview_survey_school?: string | null
          primary_discipline?: string | null
          pronouns?: string | null
          referred_by?: string | null
          representation?: string | null
          role?: string | null
          secondary_disciplines?: string[]
          show_gear_list?: boolean
          show_representation?: boolean
          show_union_status?: boolean
          skills?: string[] | null
          stage_name?: string | null
          stripe_customer_id?: string | null
          union_status?: string | null
          updated_at?: string
          user_id?: string
          vouch_count?: number
          website_url?: string | null
          why_artist?: string | null
        }
        Relationships: []
      }
      project_credit_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          id: string
          inviter_id: string
          project_id: string
          role_name: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          id?: string
          inviter_id: string
          project_id: string
          role_name: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          id?: string
          inviter_id?: string
          project_id?: string
          role_name?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_group_chats: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_group_chats_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invitations: {
        Row: {
          created_at: string
          id: string
          project_role_id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_role_id: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          project_role_id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_project_role_id_fkey"
            columns: ["project_role_id"]
            isOneToOne: false
            referencedRelation: "project_roles"
            referencedColumns: ["id"]
          },
        ]
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
      project_roles: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          id: string
          project_id: string
          role_name: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          id?: string
          project_id: string
          role_name: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          id?: string
          project_id?: string
          role_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_roles_project_id_fkey"
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
          company_id: string | null
          created_at: string
          creator_id: string
          description: string | null
          end_date: string | null
          google_drive_url: string | null
          header_image_url: string | null
          id: string
          is_public: boolean | null
          link_title: string | null
          link_url: string | null
          main_image_url: string | null
          post_approval_required: boolean
          start_date: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          end_date?: string | null
          google_drive_url?: string | null
          header_image_url?: string | null
          id?: string
          is_public?: boolean | null
          link_title?: string | null
          link_url?: string | null
          main_image_url?: string | null
          post_approval_required?: boolean
          start_date?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          company_id?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          end_date?: string | null
          google_drive_url?: string | null
          header_image_url?: string | null
          id?: string
          is_public?: boolean | null
          link_title?: string | null
          link_url?: string | null
          main_image_url?: string | null
          post_approval_required?: boolean
          start_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          category: string
          created_at: string
          description: string
          display_order: number
          education_type: string | null
          id: string
          industry: string
          is_active: boolean
          is_education: boolean
          name: string
          updated_at: string
          url: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          display_order?: number
          education_type?: string | null
          id?: string
          industry?: string
          is_active?: boolean
          is_education?: boolean
          name: string
          updated_at?: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          display_order?: number
          education_type?: string | null
          id?: string
          industry?: string
          is_active?: boolean
          is_education?: boolean
          name?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      role_applications: {
        Row: {
          applicant_id: string
          created_at: string
          id: string
          include_profile: boolean
          message: string
          project_role_id: string
          reel_url: string | null
          resume_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          id?: string
          include_profile?: boolean
          message: string
          project_role_id: string
          reel_url?: string | null
          resume_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          id?: string
          include_profile?: boolean
          message?: string
          project_role_id?: string
          reel_url?: string | null
          resume_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_applications_project_role_id_fkey"
            columns: ["project_role_id"]
            isOneToOne: false
            referencedRelation: "project_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_films: {
        Row: {
          film_id: string
          id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          film_id: string
          id?: string
          saved_at?: string
          user_id: string
        }
        Update: {
          film_id?: string
          id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_films_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "film_metrics"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          id: string
          item_id: string | null
          item_metadata: Json | null
          item_title: string
          item_type: string
          item_url: string | null
          saved_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id?: string | null
          item_metadata?: Json | null
          item_title: string
          item_type: string
          item_url?: string | null
          saved_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string | null
          item_metadata?: Json | null
          item_title?: string
          item_type?: string
          item_url?: string | null
          saved_at?: string
          user_id?: string
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
      saved_shows: {
        Row: {
          id: string
          notes: string | null
          remind_closing: boolean | null
          remind_ticket_release: boolean | null
          saved_at: string
          show_id: string
          user_id: string
        }
        Insert: {
          id?: string
          notes?: string | null
          remind_closing?: boolean | null
          remind_ticket_release?: boolean | null
          saved_at?: string
          show_id: string
          user_id: string
        }
        Update: {
          id?: string
          notes?: string | null
          remind_closing?: boolean | null
          remind_ticket_release?: boolean | null
          saved_at?: string
          show_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_shows_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "nyc_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_reminders: {
        Row: {
          created_at: string
          id: string
          is_sent: boolean | null
          remind_date: string | null
          reminder_type: string
          show_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_sent?: boolean | null
          remind_date?: string | null
          reminder_type: string
          show_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_sent?: boolean | null
          remind_date?: string | null
          reminder_type?: string
          show_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_reminders_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "nyc_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_teammates: {
        Row: {
          created_at: string
          id: string
          role_description: string | null
          show_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_description?: string | null
          show_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role_description?: string | null
          show_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_teammates_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "nyc_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      show_tips: {
        Row: {
          content: string
          created_at: string
          helpful_count: number | null
          id: string
          show_id: string
          tip_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          helpful_count?: number | null
          id?: string
          show_id: string
          tip_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          helpful_count?: number | null
          id?: string
          show_id?: string
          tip_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_tips_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "nyc_shows"
            referencedColumns: ["id"]
          },
        ]
      }
      showcase_profiles: {
        Row: {
          bio_override: string | null
          created_at: string
          display_order: number | null
          first_name: string | null
          headshot_url: string | null
          id: string
          is_active: boolean
          last_name: string | null
          program_name: string
          program_slug: string
          reel_url: string | null
          resume_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio_override?: string | null
          created_at?: string
          display_order?: number | null
          first_name?: string | null
          headshot_url?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          program_name: string
          program_slug: string
          reel_url?: string | null
          resume_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio_override?: string | null
          created_at?: string
          display_order?: number | null
          first_name?: string | null
          headshot_url?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          program_name?: string
          program_slug?: string
          reel_url?: string | null
          resume_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      showcase_programs: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      streaming_content: {
        Row: {
          content_type: string
          created_at: string
          description: string | null
          genre: string | null
          id: string
          is_active: boolean | null
          platform: string
          poster_url: string | null
          rating: number | null
          release_year: number | null
          title: string
          updated_at: string
          watch_url: string | null
        }
        Insert: {
          content_type?: string
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          is_active?: boolean | null
          platform: string
          poster_url?: string | null
          rating?: number | null
          release_year?: number | null
          title: string
          updated_at?: string
          watch_url?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          description?: string | null
          genre?: string | null
          id?: string
          is_active?: boolean | null
          platform?: string
          poster_url?: string | null
          rating?: number | null
          release_year?: number | null
          title?: string
          updated_at?: string
          watch_url?: string | null
        }
        Relationships: []
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
          badge_tag: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          badge_tag?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          badge_tag?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          amount_paid: number | null
          attendee_email: string | null
          attendee_name: string | null
          attendee_role: string | null
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          event_id: string
          id: string
          source: string
          status: string
          stripe_session_id: string | null
          ticket_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          attendee_email?: string | null
          attendee_name?: string | null
          attendee_role?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          source?: string
          status?: string
          stripe_session_id?: string | null
          ticket_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          attendee_email?: string | null
          attendee_name?: string | null
          attendee_role?: string | null
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          source?: string
          status?: string
          stripe_session_id?: string | null
          ticket_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      tip_votes: {
        Row: {
          created_at: string
          id: string
          tip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tip_votes_tip_id_fkey"
            columns: ["tip_id"]
            isOneToOne: false
            referencedRelation: "show_tips"
            referencedColumns: ["id"]
          },
        ]
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
      user_films: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_anonymous: boolean | null
          link_url: string
          poster_url: string | null
          submitted_by: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_anonymous?: boolean | null
          link_url: string
          poster_url?: string | null
          submitted_by: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_anonymous?: boolean | null
          link_url?: string
          poster_url?: string | null
          submitted_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_media: {
        Row: {
          cover_url: string | null
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          mime_type: string
          position_x: number | null
          position_y: number | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          mime_type: string
          position_x?: number | null
          position_y?: number | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          mime_type?: string
          position_x?: number | null
          position_y?: number | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
      user_music_shows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_anonymous: boolean | null
          is_free: boolean | null
          poster_url: string | null
          show_date: string | null
          show_type: string
          submitted_by: string
          ticket_url: string | null
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_anonymous?: boolean | null
          is_free?: boolean | null
          poster_url?: string | null
          show_date?: string | null
          show_type?: string
          submitted_by: string
          ticket_url?: string | null
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_anonymous?: boolean | null
          is_free?: boolean | null
          poster_url?: string | null
          show_date?: string | null
          show_type?: string
          submitted_by?: string
          ticket_url?: string | null
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vouches: {
        Row: {
          created_at: string
          id: string
          message: string | null
          vouched_for_id: string
          voucher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          vouched_for_id: string
          voucher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          vouched_for_id?: string
          voucher_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          activity_score: number | null
          avatar_url: string | null
          badges: string[] | null
          bio: string | null
          cover_url: string | null
          created_at: string | null
          display_name: string | null
          favorite_artist: string | null
          favorite_movie: string | null
          favorite_song: string | null
          gear_list_display: string[] | null
          graduation_status: string | null
          graduation_year: number | null
          headline: string | null
          id: string | null
          instagram_url: string | null
          location: string | null
          message_privacy: string | null
          pronouns: string | null
          representation: string | null
          role: string | null
          show_gear_list: boolean | null
          show_representation: boolean | null
          show_union_status: boolean | null
          skills: string[] | null
          stage_name: string | null
          union_status: string | null
          updated_at: string | null
          user_id: string | null
          vouch_count: number | null
          website_url: string | null
          why_artist: string | null
        }
        Insert: {
          activity_score?: number | null
          avatar_url?: string | null
          badges?: string[] | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          favorite_artist?: string | null
          favorite_movie?: string | null
          favorite_song?: string | null
          gear_list_display?: never
          graduation_status?: string | null
          graduation_year?: number | null
          headline?: string | null
          id?: string | null
          instagram_url?: string | null
          location?: string | null
          message_privacy?: string | null
          pronouns?: string | null
          representation?: never
          role?: string | null
          show_gear_list?: boolean | null
          show_representation?: boolean | null
          show_union_status?: boolean | null
          skills?: string[] | null
          stage_name?: string | null
          union_status?: never
          updated_at?: string | null
          user_id?: string | null
          vouch_count?: number | null
          website_url?: string | null
          why_artist?: string | null
        }
        Update: {
          activity_score?: number | null
          avatar_url?: string | null
          badges?: string[] | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          display_name?: string | null
          favorite_artist?: string | null
          favorite_movie?: string | null
          favorite_song?: string | null
          gear_list_display?: never
          graduation_status?: string | null
          graduation_year?: number | null
          headline?: string | null
          id?: string | null
          instagram_url?: string | null
          location?: string | null
          message_privacy?: string | null
          pronouns?: string | null
          representation?: never
          role?: string | null
          show_gear_list?: boolean | null
          show_representation?: boolean | null
          show_union_status?: boolean | null
          skills?: string[] | null
          stage_name?: string | null
          union_status?: never
          updated_at?: string | null
          user_id?: string | null
          vouch_count?: number | null
          website_url?: string | null
          why_artist?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_project_credit_invite: { Args: { _token: string }; Returns: Json }
      add_project_member_by_email: {
        Args: {
          target_email: string
          target_project_id: string
          target_role?: string
        }
        Returns: undefined
      }
      approve_company_account_request: {
        Args: { _admin_notes?: string; _request_id: string }
        Returns: string
      }
      bump_activity_score: {
        Args: { _delta: number; _user_id: string }
        Returns: undefined
      }
      can_view_post: {
        Args: { post_row: Database["public"]["Tables"]["posts"]["Row"] }
        Returns: boolean
      }
      claim_invites_on_signup: {
        Args: { _credit_token?: string; _platform_token?: string }
        Returns: Json
      }
      consume_job_credit: { Args: { _user_id: string }; Returns: boolean }
      create_platform_invite: {
        Args: { _email: string; _note?: string }
        Returns: Json
      }
      create_project_credit_invite: {
        Args: { _email: string; _project_id: string; _role_name: string }
        Returns: Json
      }
      deny_company_account_request: {
        Args: { _admin_notes?: string; _request_id: string }
        Returns: undefined
      }
      finalize_company_account_approval: {
        Args: {
          _admin_notes?: string
          _new_owner_id: string
          _request_id: string
        }
        Returns: string
      }
      generate_ticket_code: { Args: never; Returns: string }
      get_2nd_degree_connections: {
        Args: { target_user_id: string }
        Returns: {
          user_id: string
        }[]
      }
      get_message_privacy: { Args: { target_user_id: string }; Returns: string }
      get_mutual_connections: {
        Args: { target_user_id: string }
        Returns: {
          user_id: string
        }[]
      }
      get_public_event_rsvps: {
        Args: { target_event_id: string }
        Returns: {
          created_at: string
          event_id: string
          id: string
          name: string
          role_type: string
          status: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_email: { Args: { _email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
