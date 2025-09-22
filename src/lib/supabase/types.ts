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
      candidates: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          first_name: string
          last_name: string
          email: string
          phone: string | null
          city: string | null
          country: string | null
          linkedin_url: string | null
          portfolio_url: string | null
          current_position: string | null
          current_company: string | null
          experience_level: 'junior' | 'mid' | 'senior' | null
          total_experience: string | null
          industry: string | null
          expected_salary: string | null
          availability_date: 'asap' | '1week' | '1month' | null
          primary_skills: string | null
          languages: string | null
          status: string
          registration_date: string
          last_updated: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          city?: string | null
          country?: string | null
          linkedin_url?: string | null
          portfolio_url?: string | null
          current_position?: string | null
          current_company?: string | null
          experience_level?: 'junior' | 'mid' | 'senior' | null
          total_experience?: string | null
          industry?: string | null
          expected_salary?: string | null
          availability_date?: 'asap' | '1week' | '1month' | null
          primary_skills?: string | null
          languages?: string | null
          status?: string
          registration_date?: string
          last_updated?: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          city?: string | null
          country?: string | null
          linkedin_url?: string | null
          portfolio_url?: string | null
          current_position?: string | null
          current_company?: string | null
          experience_level?: 'junior' | 'mid' | 'senior' | null
          total_experience?: string | null
          industry?: string | null
          expected_salary?: string | null
          availability_date?: 'asap' | '1week' | '1month' | null
          primary_skills?: string | null
          languages?: string | null
          status?: string
          registration_date?: string
          last_updated?: string
        }
      }
      work_experiences: {
        Row: {
          id: string
          candidate_id: string
          created_at: string
          position: string
          company: string
          start_date: string
          end_date: string | null
          is_current_job: boolean
          main_tasks: string | null
          industry: string | null
        }
        Insert: {
          id?: string
          candidate_id: string
          created_at?: string
          position: string
          company: string
          start_date: string
          end_date?: string | null
          is_current_job?: boolean
          main_tasks?: string | null
          industry?: string | null
        }
        Update: {
          id?: string
          candidate_id?: string
          created_at?: string
          position?: string
          company?: string
          start_date?: string
          end_date?: string | null
          is_current_job?: boolean
          main_tasks?: string | null
          industry?: string | null
        }
      }
      chat_conversations: {
        Row: {
          id: string
          candidate_id: string
          admin_user_id: string
          status: 'active' | 'closed' | 'archived'
          created_at: string
          updated_at: string
          last_message_at: string | null
          talent_token: string
          token_expires_at: string
          opportunity_type: 'direct_hire' | 'project' | 'consultation' | 'collaboration'
          urgency: 'immediate' | 'flexible' | 'future'
          engagement_type: 'full_time' | 'part_time' | 'contract' | 'freelance'
        }
        Insert: {
          id?: string
          candidate_id: string
          admin_user_id: string
          status?: 'active' | 'closed' | 'archived'
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
          talent_token?: string
          token_expires_at?: string
          opportunity_type?: 'direct_hire' | 'project' | 'consultation' | 'collaboration'
          urgency?: 'immediate' | 'flexible' | 'future'
          engagement_type?: 'full_time' | 'part_time' | 'contract' | 'freelance'
        }
        Update: {
          id?: string
          candidate_id?: string
          admin_user_id?: string
          status?: 'active' | 'closed' | 'archived'
          created_at?: string
          updated_at?: string
          last_message_at?: string | null
          talent_token?: string
          token_expires_at?: string
          opportunity_type?: 'direct_hire' | 'project' | 'consultation' | 'collaboration'
          urgency?: 'immediate' | 'flexible' | 'future'
          engagement_type?: 'full_time' | 'part_time' | 'contract' | 'freelance'
        }
      }
      chat_messages: {
        Row: {
          id: string
          conversation_id: string
          sender_type: 'admin' | 'candidate'
          sender_id: string
          content: string
          message_type: 'text' | 'file' | 'system'
          read_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_type: 'admin' | 'candidate'
          sender_id: string
          content: string
          message_type?: 'text' | 'file' | 'system'
          read_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_type?: 'admin' | 'candidate'
          sender_id?: string
          content?: string
          message_type?: 'text' | 'file' | 'system'
          read_at?: string | null
          created_at?: string
          updated_at?: string
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