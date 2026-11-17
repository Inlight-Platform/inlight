import type { Database, Json } from './types';

type OpportunityRow = Database['public']['Tables']['opportunities']['Row'];
type PostRow = Database['public']['Tables']['posts']['Row'];

type GroupAuditionRow = {
  id: string; group_id: string; title: string; description: string; materials: string;
  is_published: boolean; created_by: string; created_at: string; updated_at: string;
};
type GroupAuditionTimeslotRow = {
  id: string; audition_id: string; starts_at: string; ends_at: string;
  capacity: number; created_at: string;
};
type GroupAuditionSignupRow = {
  id: string; audition_id: string; timeslot_id: string; user_id: string; created_at: string; updated_at: string;
};
type CompanyStaffAccessRow = {
  id: string;
  company_id: string;
  email: string;
  token_hash: string;
  created_by: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  staff_name: string | null;
};

type PublicOpportunityFields = Pick<OpportunityRow,
  'id' | 'title' | 'description' | 'type' | 'status' | 'posted_by' | 'company' | 'location' |
  'is_remote' | 'compensation' | 'experience_level' | 'roles' | 'requirements' | 'deadline' |
  'start_date' | 'duration' | 'tags' | 'is_featured' | 'action_type' | 'image_url' | 'link_url' |
  'link_title' | 'is_public' | 'created_at' | 'updated_at'
>;
type PublicOpportunityRow = {
  [K in keyof PublicOpportunityFields]: K extends 'id' ? PublicOpportunityFields[K] : K extends 'posted_by' ? null : PublicOpportunityFields[K] | null;
};

type PublicPostRow = Pick<PostRow,
  'id' | 'content' | 'image_url' | 'image_urls' | 'image_position_x' | 'image_position_y' |
  'image_zoom' | 'image_positions' | 'link_url' | 'link_title' | 'visibility' | 'created_at' | 'updated_at'
>;

type PublicProfilePostRow = {
  [K in keyof PublicPostRow]:
    K extends 'id' | 'visibility' ? PublicPostRow[K] : PublicPostRow[K] | null;
};

type PublicEventRow = {
  id: string;
  visibility: string;
  slug: string | null;
  title: string | null;
  description: string | null;
  event_date: string | null;
  event_type: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  image_position_x: number | null;
  image_position_y: number | null;
  image_zoom: number | null;
  image_positions: Json | null;
  link_url: string | null;
  link_title: string | null;
  location: string | null;
  is_paid: boolean | null;
  price: number | null;
  currency: string | null;
  stripe_price_id: string | null;
  payment_link_url: string | null;
  custom_question: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AdminCreateGroupWithAdminsResult = {
  group: {
    id: string;
    name: string;
    slug: string;
  };
  results: Array<
    | { email: string; outcome: 'invalid' | 'duplicate' }
    | { email: string; outcome: 'assigned'; status: string | null }
    | { email: string; outcome: 'failed'; error: string }
  >;
};

export type OpportunityBrowseDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables' | 'Views' | 'Functions'> & {
    Tables: Database['public']['Tables'] & {
      // Flat operations only; database relationships are not modeled here.
      company_staff_access: {
        Row: CompanyStaffAccessRow;
        Insert: Pick<CompanyStaffAccessRow, 'company_id' | 'email' | 'token_hash'> &
          Partial<Omit<CompanyStaffAccessRow, 'company_id' | 'email' | 'token_hash'>>;
        Update: Partial<CompanyStaffAccessRow>;
        Relationships: [];
      };
      // The child-to-parent timeslot relationship is modeled on the child entry.
      group_auditions: {
        Row: GroupAuditionRow;
        Insert: Pick<GroupAuditionRow, 'group_id' | 'title' | 'created_by'> &
          Partial<Omit<GroupAuditionRow, 'group_id' | 'title' | 'created_by'>>;
        Update: Partial<GroupAuditionRow>;
        Relationships: [];
      };
      group_audition_timeslots: {
        Row: GroupAuditionTimeslotRow;
        Insert: Pick<GroupAuditionTimeslotRow, 'audition_id' | 'starts_at' | 'ends_at'> &
          Partial<Omit<GroupAuditionTimeslotRow, 'audition_id' | 'starts_at' | 'ends_at'>>;
        Update: Partial<GroupAuditionTimeslotRow>;
        Relationships: [{
          foreignKeyName: 'group_audition_timeslots_audition_id_fkey';
          columns: ['audition_id'];
          isOneToOne: false;
          referencedRelation: 'group_auditions';
          referencedColumns: ['id'];
        }];
      };
      group_audition_signups: {
        Row: GroupAuditionSignupRow;
        Insert: Pick<GroupAuditionSignupRow, 'audition_id' | 'timeslot_id' | 'user_id'> &
          Partial<Omit<GroupAuditionSignupRow, 'audition_id' | 'timeslot_id' | 'user_id'>>;
        Update: Partial<GroupAuditionSignupRow>;
        Relationships: [];
      };
    };
    Views: Database['public']['Views'] & {
      opportunities_public_browse: { Row: PublicOpportunityRow; Relationships: [] };
      posts_public_browse: { Row: PublicPostRow; Relationships: [] };
      // This models no embedded relationships; it is not a database relationship inventory.
      project_roles_public_browse: {
        Row: {
          id: string;
          role_name: string | null;
          project_id: string | null;
          project_title: string | null;
          project_deadline: string | null;
          created_at: string | null;
        };
        Relationships: [];
      };
      // No embedded relationships are modeled here; this does not describe database relationships.
      events_public_browse: { Row: PublicEventRow; Relationships: [] };
    };
    Functions: Database['public']['Functions'] & {
      group_page_visible_to_caller: {
        Args: { _group_id: string };
        Returns: boolean;
      };
      admin_create_company_page: {
        Args: {
          _name: string | null;
          _description?: string | null;
          _website_url?: string | null;
          _staff_members?: Json;
        };
        Returns: Json;
      };
      add_company_staff_access: {
        Args: {
          _company_id: string | null;
          _email: string | null;
          _staff_name?: string | null;
          _expires_at?: string | null;
        };
        Returns: Array<{
          access_id: string;
          access_company_id: string;
          access_email: string;
          access_staff_name: string | null;
          token: string;
        }>;
      };
      get_company_requester_profiles: {
        Args: { _user_ids: Array<string | null> | null };
        Returns: Array<{
          user_id: string;
          display_name: string | null;
          email: string;
          avatar_url: string | null;
        }>;
      };
      validate_company_staff_access: {
        Args: { _token: string | null };
        Returns: Array<{ company_id: string; email: string; staff_name: string | null }>;
      };
      create_company_project_with_staff_token: {
        Args: {
          _token: string | null;
          _title: string | null;
          _description?: string | null;
          _category?: string | null;
          _status?: string | null;
          _main_image_url?: string | null;
          _start_date?: string | null;
          _end_date?: string | null;
          _link_title?: string | null;
          _link_url?: string | null;
        };
        Returns: string;
      };
      update_company_with_staff_token: {
        Args: {
          _token: string | null;
          _name: string | null;
          _description?: string | null;
          _location?: string | null;
          _website_url?: string | null;
          _tagline?: string | null;
          _mission?: string | null;
          _brand_primary_color?: string | null;
          _brand_accent_color?: string | null;
          _brand_text_color?: string | null;
          _logo_url?: string | null;
          _cover_image_url?: string | null;
          _fun_facts?: Json;
        };
        Returns: string;
      };
      delete_company_photo_with_staff_token: {
        Args: { _token: string | null; _photo_id: string | null };
        Returns: undefined;
      };
      create_group_audition: {
        Args: { _group_id: string; _title: string; _description: string; _materials: string; _is_published: boolean; _timeslots: Json };
        Returns: string;
      };
      book_group_audition_timeslot: {
        Args: { _audition_id: string; _timeslot_id: string };
        Returns: string;
      };
      get_group_audition_availability: {
        Args: { _group_id: string };
        Returns: Array<{ audition_id: string; timeslot_id: string; booked_count: number; capacity: number; is_my_timeslot: boolean | null }>;
      };
      get_my_role_applications_for_jobs: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          id: string;
          project_role_id: string;
          project_id: string;
          role_name: string;
          project_title: string;
          message: string;
          reel_url: string | null;
          resume_url: string | null;
          status: string;
          created_at: string;
        }>;
      };
      notify_affiliation_reviewed: {
        Args: { p_user_id: string; p_action: string; p_name: string; p_notes?: string | null };
        Returns: undefined;
      };
      mark_event_attended: {
        Args: { _event_id: string };
        Returns: undefined;
      };
      remove_profile_attendance: {
        Args: { _kind: string; _item_id: string };
        Returns: undefined;
      };
      accept_project_invitation: {
        Args: { _invitation_id: string };
        Returns: Json;
      };
      remove_saved_show: {
        Args: { p_show_id: string };
        Returns: undefined;
      };
      set_watchlist_public: {
        Args: { value: boolean };
        Returns: undefined;
      };
      get_public_profile_posts: {
        Args: { _user_id: string };
        Returns: PublicProfilePostRow[];
      };
      get_public_profile_events: {
        Args: { _user_id: string };
        Returns: PublicEventRow[];
      };
      get_profile_watchlist: {
        Args: { p_user_id: string };
        Returns: Array<{
          id: string;
          saved_at: string;
          show_id: string;
          title: string;
          venue: string;
          borough: string | null;
          show_type: string;
          poster_url: string | null;
          run_start: string | null;
          run_end: string | null;
          official_url: string | null;
        }>;
      };
      admin_create_group_with_admins: {
        Args: {
          _name: string | null;
          _slug: string | null;
          _description: string | null;
          _admin_emails: Array<string | null> | null;
        };
        Returns: AdminCreateGroupWithAdminsResult;
      };
    };
  };
};
