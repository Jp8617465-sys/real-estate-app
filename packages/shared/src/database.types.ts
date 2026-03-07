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
      activities: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          metadata: Json | null
          property_id: string | null
          title: string
          transaction_id: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          metadata?: Json | null
          property_id?: string | null
          title: string
          transaction_id?: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          property_id?: string | null
          title?: string
          transaction_id?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          client_brief_id: string | null
          confidence: Database["public"]["Enums"]["ai_confidence"]
          content: Json
          created_at: string
          expires_at: string | null
          id: string
          model_used: string | null
          target_id: string
          target_type: string
          title: string | null
          tokens_used: number | null
          type: Database["public"]["Enums"]["ai_insight_type"]
        }
        Insert: {
          client_brief_id?: string | null
          confidence?: Database["public"]["Enums"]["ai_confidence"]
          content: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          model_used?: string | null
          target_id: string
          target_type: string
          title?: string | null
          tokens_used?: number | null
          type: Database["public"]["Enums"]["ai_insight_type"]
        }
        Update: {
          client_brief_id?: string | null
          confidence?: Database["public"]["Enums"]["ai_confidence"]
          content?: Json
          created_at?: string
          expires_at?: string | null
          id?: string
          model_used?: string | null
          target_id?: string
          target_type?: string
          title?: string | null
          tokens_used?: number | null
          type?: Database["public"]["Enums"]["ai_insight_type"]
        }
        Relationships: [
          {
            foreignKeyName: "ai_insights_client_brief_id_fkey"
            columns: ["client_brief_id"]
            isOneToOne: false
            referencedRelation: "client_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      aml_checks: {
        Row: {
          address_verified: boolean
          agent_id: string
          completed_at: string | null
          contact_id: string
          created_at: string | null
          date_of_birth: string | null
          expiry_date: string | null
          full_legal_name: string | null
          id: string
          last_reviewed_at: string | null
          notes: string | null
          points_required: number
          rejection_reason: string | null
          residential_address: string | null
          started_at: string | null
          status: string
          total_points: number
          updated_at: string | null
          verification_method: string | null
          verified_by_user_id: string | null
        }
        Insert: {
          address_verified?: boolean
          agent_id: string
          completed_at?: string | null
          contact_id: string
          created_at?: string | null
          date_of_birth?: string | null
          expiry_date?: string | null
          full_legal_name?: string | null
          id?: string
          last_reviewed_at?: string | null
          notes?: string | null
          points_required?: number
          rejection_reason?: string | null
          residential_address?: string | null
          started_at?: string | null
          status?: string
          total_points?: number
          updated_at?: string | null
          verification_method?: string | null
          verified_by_user_id?: string | null
        }
        Update: {
          address_verified?: boolean
          agent_id?: string
          completed_at?: string | null
          contact_id?: string
          created_at?: string | null
          date_of_birth?: string | null
          expiry_date?: string | null
          full_legal_name?: string | null
          id?: string
          last_reviewed_at?: string | null
          notes?: string | null
          points_required?: number
          rejection_reason?: string | null
          residential_address?: string | null
          started_at?: string | null
          status?: string
          total_points?: number
          updated_at?: string | null
          verification_method?: string | null
          verified_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aml_checks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aml_checks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aml_checks_verified_by_user_id_fkey"
            columns: ["verified_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      aml_document_point_values: {
        Row: {
          category: string
          document_type: Database["public"]["Enums"]["aml_document_type"]
          points: number
        }
        Insert: {
          category: string
          document_type: Database["public"]["Enums"]["aml_document_type"]
          points: number
        }
        Update: {
          category?: string
          document_type?: Database["public"]["Enums"]["aml_document_type"]
          points?: number
        }
        Relationships: []
      }
      aml_identity_documents: {
        Row: {
          check_id: string
          created_at: string | null
          deleted_at: string | null
          document_id: string | null
          document_number: string | null
          document_type: Database["public"]["Enums"]["aml_document_type"]
          expiry_date: string | null
          id: string
          is_expired: boolean
          issue_date: string | null
          issuing_authority: string | null
          notes: string | null
          points: number
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          check_id: string
          created_at?: string | null
          deleted_at?: string | null
          document_id?: string | null
          document_number?: string | null
          document_type: Database["public"]["Enums"]["aml_document_type"]
          expiry_date?: string | null
          id?: string
          is_expired?: boolean
          issue_date?: string | null
          issuing_authority?: string | null
          notes?: string | null
          points: number
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          check_id?: string
          created_at?: string | null
          deleted_at?: string | null
          document_id?: string | null
          document_number?: string | null
          document_type?: Database["public"]["Enums"]["aml_document_type"]
          expiry_date?: string | null
          id?: string
          is_expired?: boolean
          issue_date?: string | null
          issuing_authority?: string | null
          notes?: string | null
          points?: number
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aml_identity_documents_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "aml_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aml_identity_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aml_identity_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      aml_suspicious_matter_reports: {
        Row: {
          agent_id: string
          amount_aud: number | null
          austrac_ref: string | null
          contact_id: string | null
          created_at: string | null
          description: string
          id: string
          report_date: string
          status: string
          suspicion_basis: string
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          amount_aud?: number | null
          austrac_ref?: string | null
          contact_id?: string | null
          created_at?: string | null
          description: string
          id?: string
          report_date?: string
          status?: string
          suspicion_basis: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          amount_aud?: number | null
          austrac_ref?: string | null
          contact_id?: string | null
          created_at?: string | null
          description?: string
          id?: string
          report_date?: string
          status?: string
          suspicion_basis?: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aml_suspicious_matter_reports_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aml_suspicious_matter_reports_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aml_suspicious_matter_reports_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_daily_snapshots: {
        Row: {
          active_clients_count: number | null
          agent_id: string
          ai_cost_aud: number | null
          ai_matches_run: number | null
          avg_deal_value_aud: number | null
          avg_response_time_minutes: number | null
          briefs_created_count: number | null
          contracts_signed_count: number | null
          created_at: string | null
          id: string
          inspections_done_count: number | null
          leads_contacted_count: number | null
          messages_sent_count: number | null
          new_leads_count: number | null
          offers_submitted_count: number | null
          pipeline_value_aud: number | null
          revenue_earned_aud: number | null
          settlements_count: number | null
          snapshot_date: string
          stage_velocity: Json | null
          updated_at: string | null
        }
        Insert: {
          active_clients_count?: number | null
          agent_id: string
          ai_cost_aud?: number | null
          ai_matches_run?: number | null
          avg_deal_value_aud?: number | null
          avg_response_time_minutes?: number | null
          briefs_created_count?: number | null
          contracts_signed_count?: number | null
          created_at?: string | null
          id?: string
          inspections_done_count?: number | null
          leads_contacted_count?: number | null
          messages_sent_count?: number | null
          new_leads_count?: number | null
          offers_submitted_count?: number | null
          pipeline_value_aud?: number | null
          revenue_earned_aud?: number | null
          settlements_count?: number | null
          snapshot_date: string
          stage_velocity?: Json | null
          updated_at?: string | null
        }
        Update: {
          active_clients_count?: number | null
          agent_id?: string
          ai_cost_aud?: number | null
          ai_matches_run?: number | null
          avg_deal_value_aud?: number | null
          avg_response_time_minutes?: number | null
          briefs_created_count?: number | null
          contracts_signed_count?: number | null
          created_at?: string | null
          id?: string
          inspections_done_count?: number | null
          leads_contacted_count?: number | null
          messages_sent_count?: number | null
          new_leads_count?: number | null
          offers_submitted_count?: number | null
          pipeline_value_aud?: number | null
          revenue_earned_aud?: number | null
          settlements_count?: number | null
          snapshot_date?: string
          stage_velocity?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_snapshots_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_events: {
        Row: {
          auction_date: string
          bidding_strategy: string | null
          created_at: string
          final_price: number | null
          id: string
          number_of_bidders: number | null
          offer_id: string
          registration_number: string | null
          result: string | null
          updated_at: string
        }
        Insert: {
          auction_date: string
          bidding_strategy?: string | null
          created_at?: string
          final_price?: number | null
          id?: string
          number_of_bidders?: number | null
          offer_id: string
          registration_number?: string | null
          result?: string | null
          updated_at?: string
        }
        Update: {
          auction_date?: string
          bidding_strategy?: string | null
          created_at?: string
          final_price?: number | null
          id?: string
          number_of_bidders?: number | null
          offer_id?: string
          registration_number?: string | null
          result?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_events_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_results: {
        Row: {
          agency_name: string | null
          agent_name: string | null
          auction_date: string
          created_at: string | null
          domain_listing_id: string | null
          id: string
          postcode: string | null
          property_id: string | null
          raw_data: Json | null
          registered_bidders: number | null
          reserve_price: number | null
          result: string
          sold_price: number | null
          state: string | null
          suburb: string
        }
        Insert: {
          agency_name?: string | null
          agent_name?: string | null
          auction_date: string
          created_at?: string | null
          domain_listing_id?: string | null
          id?: string
          postcode?: string | null
          property_id?: string | null
          raw_data?: Json | null
          registered_bidders?: number | null
          reserve_price?: number | null
          result: string
          sold_price?: number | null
          state?: string | null
          suburb: string
        }
        Update: {
          agency_name?: string | null
          agent_name?: string | null
          auction_date?: string
          created_at?: string | null
          domain_listing_id?: string | null
          id?: string
          postcode?: string | null
          property_id?: string | null
          raw_data?: Json | null
          registered_bidders?: number | null
          reserve_price?: number | null
          result?: string
          sold_price?: number | null
          state?: string | null
          suburb?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_results_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      client_briefs: {
        Row: {
          acknowledged_at: string | null
          acknowledged_ip: unknown
          bathrooms_ideal: number | null
          bathrooms_min: number
          bedrooms_ideal: number | null
          bedrooms_min: number
          best_time_to_call: string | null
          brief_version: number
          broker_email: string | null
          broker_name: string | null
          broker_phone: string | null
          budget_absolute_max: number | null
          budget_max: number
          budget_min: number
          building_age_max: number | null
          building_age_min: number | null
          car_spaces_ideal: number | null
          car_spaces_min: number
          client_signed_off: boolean
          contact_id: string
          created_at: string
          created_by: string
          deal_breakers: string[]
          deleted_at: string | null
          deposit_available: number | null
          enquiry_type: string
          first_home_buyer: boolean
          id: string
          ideal_settlement: string | null
          investor_criteria: Json | null
          is_deleted: boolean
          land_size_max: number | null
          land_size_min: number | null
          lender: string | null
          max_commute: Json | null
          must_haves: string[]
          must_settle_before: string | null
          nice_to_haves: string[]
          partner_email: string | null
          partner_name: string | null
          partner_phone: string | null
          pre_approval_amount: number | null
          pre_approval_expiry: string | null
          pre_approved: boolean
          preferred_contact_method: string | null
          property_types: string[]
          purchase_type: string
          school_zones: string[] | null
          signed_off_at: string | null
          solicitor_contact: string | null
          solicitor_email: string | null
          solicitor_firm: string | null
          solicitor_phone: string | null
          stamp_duty_budgeted: boolean
          suburbs: Json
          transaction_id: string | null
          update_frequency: string | null
          updated_at: string
          urgency: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_ip?: unknown
          bathrooms_ideal?: number | null
          bathrooms_min?: number
          bedrooms_ideal?: number | null
          bedrooms_min?: number
          best_time_to_call?: string | null
          brief_version?: number
          broker_email?: string | null
          broker_name?: string | null
          broker_phone?: string | null
          budget_absolute_max?: number | null
          budget_max: number
          budget_min: number
          building_age_max?: number | null
          building_age_min?: number | null
          car_spaces_ideal?: number | null
          car_spaces_min?: number
          client_signed_off?: boolean
          contact_id: string
          created_at?: string
          created_by: string
          deal_breakers?: string[]
          deleted_at?: string | null
          deposit_available?: number | null
          enquiry_type: string
          first_home_buyer?: boolean
          id?: string
          ideal_settlement?: string | null
          investor_criteria?: Json | null
          is_deleted?: boolean
          land_size_max?: number | null
          land_size_min?: number | null
          lender?: string | null
          max_commute?: Json | null
          must_haves?: string[]
          must_settle_before?: string | null
          nice_to_haves?: string[]
          partner_email?: string | null
          partner_name?: string | null
          partner_phone?: string | null
          pre_approval_amount?: number | null
          pre_approval_expiry?: string | null
          pre_approved?: boolean
          preferred_contact_method?: string | null
          property_types?: string[]
          purchase_type: string
          school_zones?: string[] | null
          signed_off_at?: string | null
          solicitor_contact?: string | null
          solicitor_email?: string | null
          solicitor_firm?: string | null
          solicitor_phone?: string | null
          stamp_duty_budgeted?: boolean
          suburbs?: Json
          transaction_id?: string | null
          update_frequency?: string | null
          updated_at?: string
          urgency?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_ip?: unknown
          bathrooms_ideal?: number | null
          bathrooms_min?: number
          bedrooms_ideal?: number | null
          bedrooms_min?: number
          best_time_to_call?: string | null
          brief_version?: number
          broker_email?: string | null
          broker_name?: string | null
          broker_phone?: string | null
          budget_absolute_max?: number | null
          budget_max?: number
          budget_min?: number
          building_age_max?: number | null
          building_age_min?: number | null
          car_spaces_ideal?: number | null
          car_spaces_min?: number
          client_signed_off?: boolean
          contact_id?: string
          created_at?: string
          created_by?: string
          deal_breakers?: string[]
          deleted_at?: string | null
          deposit_available?: number | null
          enquiry_type?: string
          first_home_buyer?: boolean
          id?: string
          ideal_settlement?: string | null
          investor_criteria?: Json | null
          is_deleted?: boolean
          land_size_max?: number | null
          land_size_min?: number | null
          lender?: string | null
          max_commute?: Json | null
          must_haves?: string[]
          must_settle_before?: string | null
          nice_to_haves?: string[]
          partner_email?: string | null
          partner_name?: string | null
          partner_phone?: string | null
          pre_approval_amount?: number | null
          pre_approval_expiry?: string | null
          pre_approved?: boolean
          preferred_contact_method?: string | null
          property_types?: string[]
          purchase_type?: string
          school_zones?: string[] | null
          signed_off_at?: string | null
          solicitor_contact?: string | null
          solicitor_email?: string | null
          solicitor_firm?: string | null
          solicitor_phone?: string | null
          stamp_duty_budgeted?: boolean
          suburbs?: Json
          transaction_id?: string | null
          update_frequency?: string | null
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_briefs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_briefs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_briefs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidation_reports: {
        Row: {
          client_brief_id: string | null
          client_id: string
          content: Json
          created_at: string
          created_by: string
          deleted_at: string | null
          generated_at: string
          generated_by: Database["public"]["Enums"]["report_generated_by"]
          id: string
          previous_version_id: string | null
          sent_to_client_at: string | null
          status: Database["public"]["Enums"]["consolidation_report_status"]
          title: string
          transaction_id: string | null
          type: Database["public"]["Enums"]["consolidation_report_type"]
          updated_at: string
          version: number
        }
        Insert: {
          client_brief_id?: string | null
          client_id: string
          content?: Json
          created_at?: string
          created_by: string
          deleted_at?: string | null
          generated_at?: string
          generated_by?: Database["public"]["Enums"]["report_generated_by"]
          id?: string
          previous_version_id?: string | null
          sent_to_client_at?: string | null
          status?: Database["public"]["Enums"]["consolidation_report_status"]
          title: string
          transaction_id?: string | null
          type: Database["public"]["Enums"]["consolidation_report_type"]
          updated_at?: string
          version?: number
        }
        Update: {
          client_brief_id?: string | null
          client_id?: string
          content?: Json
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          generated_at?: string
          generated_by?: Database["public"]["Enums"]["report_generated_by"]
          id?: string
          previous_version_id?: string | null
          sent_to_client_at?: string | null
          status?: Database["public"]["Enums"]["consolidation_report_status"]
          title?: string
          transaction_id?: string | null
          type?: Database["public"]["Enums"]["consolidation_report_type"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "consolidation_reports_client_brief_id_fkey"
            columns: ["client_brief_id"]
            isOneToOne: false
            referencedRelation: "client_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidation_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidation_reports_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "consolidation_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidation_reports_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_channels: {
        Row: {
          contact_id: string
          created_at: string
          emails: string[]
          facebook_id: string | null
          id: string
          instagram_id: string | null
          linkedin_profile_url: string | null
          phones: string[]
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          emails?: string[]
          facebook_id?: string | null
          id?: string
          instagram_id?: string | null
          linkedin_profile_url?: string | null
          phones?: string[]
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          emails?: string[]
          facebook_id?: string | null
          id?: string
          instagram_id?: string | null
          linkedin_profile_url?: string | null
          phones?: string[]
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_channels_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address_postcode: string | null
          address_state: string | null
          address_street_name: string | null
          address_street_number: string | null
          address_suburb: string | null
          address_unit_number: string | null
          assigned_agent_id: string
          buyer_profile: Json | null
          communication_preference: Database["public"]["Enums"]["communication_preference"]
          created_at: string
          deleted_at: string | null
          email: string | null
          first_name: string
          id: string
          is_deleted: boolean
          last_contact_date: string | null
          last_name: string
          lead_score: number | null
          next_follow_up: string | null
          phone: string
          secondary_phone: string | null
          seller_profile: Json | null
          social_facebook: string | null
          social_instagram: string | null
          social_linkedin: string | null
          source: Database["public"]["Enums"]["lead_source"]
          source_detail: string | null
          tags: string[]
          types: Database["public"]["Enums"]["contact_type"][]
          updated_at: string
        }
        Insert: {
          address_postcode?: string | null
          address_state?: string | null
          address_street_name?: string | null
          address_street_number?: string | null
          address_suburb?: string | null
          address_unit_number?: string | null
          assigned_agent_id: string
          buyer_profile?: Json | null
          communication_preference?: Database["public"]["Enums"]["communication_preference"]
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          is_deleted?: boolean
          last_contact_date?: string | null
          last_name: string
          lead_score?: number | null
          next_follow_up?: string | null
          phone: string
          secondary_phone?: string | null
          seller_profile?: Json | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          source: Database["public"]["Enums"]["lead_source"]
          source_detail?: string | null
          tags?: string[]
          types: Database["public"]["Enums"]["contact_type"][]
          updated_at?: string
        }
        Update: {
          address_postcode?: string | null
          address_state?: string | null
          address_street_name?: string | null
          address_street_number?: string | null
          address_suburb?: string | null
          address_unit_number?: string | null
          assigned_agent_id?: string
          buyer_profile?: Json | null
          communication_preference?: Database["public"]["Enums"]["communication_preference"]
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          is_deleted?: boolean
          last_contact_date?: string | null
          last_name?: string
          lead_score?: number | null
          next_follow_up?: string | null
          phone?: string
          secondary_phone?: string | null
          seller_profile?: Json | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_linkedin?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_detail?: string | null
          tags?: string[]
          types?: Database["public"]["Enums"]["contact_type"][]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          agent_id: string
          channel: Database["public"]["Enums"]["message_channel"]
          contact_id: string
          content: Json
          created_at: string
          deleted_at: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id: string | null
          id: string
          is_deleted: boolean
          is_read: boolean
          metadata: Json
          property_id: string | null
          status: Database["public"]["Enums"]["message_status"]
          thread_id: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          channel: Database["public"]["Enums"]["message_channel"]
          contact_id: string
          content?: Json
          created_at?: string
          deleted_at?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          id?: string
          is_deleted?: boolean
          is_read?: boolean
          metadata?: Json
          property_id?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          thread_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          channel?: Database["public"]["Enums"]["message_channel"]
          contact_id?: string
          content?: Json
          created_at?: string
          deleted_at?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          id?: string
          is_deleted?: boolean
          is_read?: boolean
          metadata?: Json
          property_id?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          thread_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_action_items: {
        Row: {
          ai_cost_aud: number | null
          ai_model: string | null
          category: Database["public"]["Enums"]["action_item_category"]
          completed_at: string | null
          composite_score: number
          contact_id: string | null
          created_at: string
          date: string
          deadline_proximity: number
          id: string
          is_completed: boolean
          lead_score: number
          rank: number
          recency_penalty: number
          subtitle: string
          task_id: string | null
          title: string
          transaction_id: string | null
          updated_at: string
          urgency_score: number
          user_id: string
        }
        Insert: {
          ai_cost_aud?: number | null
          ai_model?: string | null
          category: Database["public"]["Enums"]["action_item_category"]
          completed_at?: string | null
          composite_score?: number
          contact_id?: string | null
          created_at?: string
          date: string
          deadline_proximity?: number
          id?: string
          is_completed?: boolean
          lead_score?: number
          rank: number
          recency_penalty?: number
          subtitle: string
          task_id?: string | null
          title: string
          transaction_id?: string | null
          updated_at?: string
          urgency_score?: number
          user_id: string
        }
        Update: {
          ai_cost_aud?: number | null
          ai_model?: string | null
          category?: Database["public"]["Enums"]["action_item_category"]
          completed_at?: string | null
          composite_score?: number
          contact_id?: string | null
          created_at?: string
          date?: string
          deadline_proximity?: number
          id?: string
          is_completed?: boolean
          lead_score?: number
          rank?: number
          recency_penalty?: number
          subtitle?: string
          task_id?: string | null
          title?: string
          transaction_id?: string | null
          updated_at?: string
          urgency_score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_action_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_action_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_action_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_action_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          contact_id: string | null
          created_at: string
          deleted_at: string | null
          file_path: string
          id: string
          is_deleted: boolean
          mime_type: string
          name: string
          portal_visible: boolean
          property_id: string | null
          size_bytes: number
          transaction_id: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          category?: string
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          file_path: string
          id?: string
          is_deleted?: boolean
          mime_type: string
          name: string
          portal_visible?: boolean
          property_id?: string | null
          size_bytes: number
          transaction_id?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          category?: string
          contact_id?: string | null
          created_at?: string
          deleted_at?: string | null
          file_path?: string
          id?: string
          is_deleted?: boolean
          mime_type?: string
          name?: string
          portal_visible?: boolean
          property_id?: string | null
          size_bytes?: number
          transaction_id?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_sync_jobs: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          listings_found: number | null
          listings_imported: number | null
          matches_triggered: number | null
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          listings_found?: number | null
          listings_imported?: number | null
          matches_triggered?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          listings_found?: number | null
          listings_imported?: number | null
          matches_triggered?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "domain_sync_jobs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      due_diligence_checklists: {
        Row: {
          completion_percentage: number
          created_at: string
          created_by: string
          id: string
          property_type: string
          state: string
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          completion_percentage?: number
          created_at?: string
          created_by: string
          id?: string
          property_type: string
          state: string
          status?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          completion_percentage?: number
          created_at?: string
          created_by?: string
          id?: string
          property_type?: string
          state?: string
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_diligence_checklists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_diligence_checklists_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      due_diligence_items: {
        Row: {
          assigned_to: string
          category: string
          checklist_id: string
          completed_date: string | null
          created_at: string
          description: string | null
          documents: Json
          due_date: string | null
          id: string
          is_blocking: boolean
          is_critical: boolean
          name: string
          notes: string | null
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to: string
          category: string
          checklist_id: string
          completed_date?: string | null
          created_at?: string
          description?: string | null
          documents?: Json
          due_date?: string | null
          id?: string
          is_blocking?: boolean
          is_critical?: boolean
          name: string
          notes?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string
          category?: string
          checklist_id?: string
          completed_date?: string | null
          created_at?: string
          description?: string | null
          documents?: Json
          due_date?: string | null
          id?: string
          is_blocking?: boolean
          is_critical?: boolean
          name?: string
          notes?: string | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "due_diligence_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "due_diligence_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          merge_fields: string[]
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          merge_fields?: string[]
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          merge_fields?: string[]
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          client_id: string
          created_at: string
          gst_included: boolean
          id: string
          retainer_fee: number
          retainer_paid_date: string | null
          success_fee_amount: number | null
          success_fee_due_date: string | null
          success_fee_flat_amount: number | null
          success_fee_paid: boolean
          success_fee_percentage: number | null
          success_fee_tiers: Json | null
          success_fee_type: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          gst_included?: boolean
          id?: string
          retainer_fee?: number
          retainer_paid_date?: string | null
          success_fee_amount?: number | null
          success_fee_due_date?: string | null
          success_fee_flat_amount?: number | null
          success_fee_paid?: boolean
          success_fee_percentage?: number | null
          success_fee_tiers?: Json | null
          success_fee_type: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          gst_included?: boolean
          id?: string
          retainer_fee?: number
          retainer_paid_date?: string | null
          success_fee_amount?: number | null
          success_fee_due_date?: string | null
          success_fee_flat_amount?: number | null
          success_fee_paid?: boolean
          success_fee_percentage?: number | null
          success_fee_tiers?: Json | null
          success_fee_type?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_sequences: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          is_deleted: boolean
          is_template: boolean
          name: string
          steps: Json
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          is_template?: boolean
          name: string
          steps: Json
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_deleted?: boolean
          is_template?: boolean
          name?: string
          steps?: Json
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_sequences_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_message_queue: {
        Row: {
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          error_message: string | null
          id: string
          processed_at: string | null
          processed_message_id: string | null
          processing_status: string
          raw_payload: Json
          retry_count: number
        }
        Insert: {
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          processed_message_id?: string | null
          processing_status?: string
          raw_payload: Json
          retry_count?: number
        }
        Update: {
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          error_message?: string | null
          id?: string
          processed_at?: string | null
          processed_message_id?: string | null
          processing_status?: string
          raw_payload?: Json
          retry_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "inbound_message_queue_processed_message_id_fkey"
            columns: ["processed_message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_message_queue_processed_message_id_fkey"
            columns: ["processed_message_id"]
            isOneToOne: false
            referencedRelation: "inbox_thread_summaries"
            referencedColumns: ["last_message_id"]
          },
        ]
      }
      inspections: {
        Row: {
          agent_notes: string | null
          area_feel_notes: string | null
          client_feedback: string | null
          client_feedback_at: string | null
          client_id: string | null
          client_rating: number | null
          client_suitability: string | null
          condition_notes: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          inspection_date: string
          is_deleted: boolean
          overall_impression: string
          photos: Json
          property_id: string
          selling_agent_id: string | null
          time_spent_minutes: number | null
          transaction_id: string | null
          updated_at: string
          voice_note_transcript: string | null
          voice_note_url: string | null
        }
        Insert: {
          agent_notes?: string | null
          area_feel_notes?: string | null
          client_feedback?: string | null
          client_feedback_at?: string | null
          client_id?: string | null
          client_rating?: number | null
          client_suitability?: string | null
          condition_notes?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          inspection_date: string
          is_deleted?: boolean
          overall_impression: string
          photos?: Json
          property_id: string
          selling_agent_id?: string | null
          time_spent_minutes?: number | null
          transaction_id?: string | null
          updated_at?: string
          voice_note_transcript?: string | null
          voice_note_url?: string | null
        }
        Update: {
          agent_notes?: string | null
          area_feel_notes?: string | null
          client_feedback?: string | null
          client_feedback_at?: string | null
          client_id?: string | null
          client_rating?: number | null
          client_suitability?: string | null
          condition_notes?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          inspection_date?: string
          is_deleted?: boolean
          overall_impression?: string
          photos?: Json
          property_id?: string
          selling_agent_id?: string | null
          time_spent_minutes?: number | null
          transaction_id?: string | null
          updated_at?: string
          voice_note_transcript?: string | null
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_selling_agent_id_fkey"
            columns: ["selling_agent_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          office_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          office_id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          office_id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          due_date: string | null
          fee_structure_id: string
          gst_amount: number
          id: string
          paid_date: string | null
          status: string
          stripe_invoice_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          due_date?: string | null
          fee_structure_id: string
          gst_amount?: number
          id?: string
          paid_date?: string | null
          status?: string
          stripe_invoice_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          due_date?: string | null
          fee_structure_id?: string
          gst_amount?: number
          id?: string
          paid_date?: string | null
          status?: string
          stripe_invoice_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      key_dates: {
        Row: {
          completed_at: string | null
          created_at: string
          date: string
          id: string
          is_critical: boolean
          label: string
          notes: string | null
          reminder_days_before: number[]
          status: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          date: string
          id?: string
          is_critical?: boolean
          label: string
          notes?: string | null
          reminder_days_before?: number[]
          status?: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          date?: string
          id?: string
          is_critical?: boolean
          label?: string
          notes?: string | null
          reminder_days_before?: number[]
          status?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_dates_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      market_data_snapshots: {
        Row: {
          clearance_rate: number | null
          created_at: string | null
          data_source: string | null
          id: string
          median_days_on_market: number | null
          median_sale_price: number | null
          new_listings_count: number | null
          postcode: string | null
          price_change_1y_percent: number | null
          property_type: string
          snapshot_date: string
          sold_count: number | null
          state: string | null
          suburb: string
          total_auctions: number | null
        }
        Insert: {
          clearance_rate?: number | null
          created_at?: string | null
          data_source?: string | null
          id?: string
          median_days_on_market?: number | null
          median_sale_price?: number | null
          new_listings_count?: number | null
          postcode?: string | null
          price_change_1y_percent?: number | null
          property_type: string
          snapshot_date: string
          sold_count?: number | null
          state?: string | null
          suburb: string
          total_auctions?: number | null
        }
        Update: {
          clearance_rate?: number | null
          created_at?: string | null
          data_source?: string | null
          id?: string
          median_days_on_market?: number | null
          median_sale_price?: number | null
          new_listings_count?: number | null
          postcode?: string | null
          price_change_1y_percent?: number | null
          property_type?: string
          snapshot_date?: string
          sold_count?: number | null
          state?: string | null
          suburb?: string
          total_auctions?: number | null
        }
        Relationships: []
      }
      market_snapshots: {
        Row: {
          auction_clearance_rate: number | null
          created_at: string
          data_as_of: string
          data_source: string | null
          days_on_market: number | null
          id: string
          median_price: number | null
          median_price_change_12m: number | null
          postcode: string | null
          property_type: string | null
          state: string
          suburb: string
          total_listings: number | null
        }
        Insert: {
          auction_clearance_rate?: number | null
          created_at?: string
          data_as_of: string
          data_source?: string | null
          days_on_market?: number | null
          id?: string
          median_price?: number | null
          median_price_change_12m?: number | null
          postcode?: string | null
          property_type?: string | null
          state: string
          suburb: string
          total_listings?: number | null
        }
        Update: {
          auction_clearance_rate?: number | null
          created_at?: string
          data_as_of?: string
          data_source?: string | null
          days_on_market?: number | null
          id?: string
          median_price?: number | null
          median_price_change_12m?: number | null
          postcode?: string | null
          property_type?: string | null
          state?: string
          suburb?: string
          total_listings?: number | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          contact_id: string
          content: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          is_deleted: boolean
          is_pinned: boolean
          property_id: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          contact_id: string
          content: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          property_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          contact_id?: string
          content?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          is_deleted?: boolean
          is_pinned?: boolean
          property_id?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          daily_action_list_enabled: boolean
          daily_action_list_time: string
          digest_mode_enabled: boolean
          digest_send_time: string
          id: string
          notify_follow_up_due: boolean
          notify_key_date_reminder: boolean
          notify_low_priority: boolean
          notify_new_lead: boolean
          notify_pipeline_update: boolean
          notify_property_match: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_action_list_enabled?: boolean
          daily_action_list_time?: string
          digest_mode_enabled?: boolean
          digest_send_time?: string
          id?: string
          notify_follow_up_due?: boolean
          notify_key_date_reminder?: boolean
          notify_low_priority?: boolean
          notify_new_lead?: boolean
          notify_pipeline_update?: boolean
          notify_property_match?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_action_list_enabled?: boolean
          daily_action_list_time?: string
          digest_mode_enabled?: boolean
          digest_send_time?: string
          id?: string
          notify_follow_up_due?: boolean
          notify_key_date_reminder?: boolean
          notify_low_priority?: boolean
          notify_new_lead?: boolean
          notify_pipeline_update?: boolean
          notify_property_match?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_primary: string | null
          action_secondary: string | null
          action_tertiary: string | null
          body: string
          category: Database["public"]["Enums"]["notification_category"]
          created_at: string
          dedup_key: string | null
          deleted_at: string | null
          digest_sent_at: string | null
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_deleted: boolean
          is_digest_item: boolean
          metadata: Json | null
          priority: Database["public"]["Enums"]["notification_priority"]
          read_at: string | null
          scheduled_for: string | null
          sent_at: string | null
          snoozed_until: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_primary?: string | null
          action_secondary?: string | null
          action_tertiary?: string | null
          body: string
          category: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          dedup_key?: string | null
          deleted_at?: string | null
          digest_sent_at?: string | null
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_deleted?: boolean
          is_digest_item?: boolean
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_primary?: string | null
          action_secondary?: string | null
          action_tertiary?: string | null
          body?: string
          category?: Database["public"]["Enums"]["notification_category"]
          created_at?: string
          dedup_key?: string | null
          deleted_at?: string | null
          digest_sent_at?: string | null
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_deleted?: boolean
          is_digest_item?: boolean
          metadata?: Json | null
          priority?: Database["public"]["Enums"]["notification_priority"]
          read_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          snoozed_until?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_tokens: {
        Row: {
          access_token: string
          account_email: string | null
          created_at: string
          expires_at: string
          id: string
          provider: Database["public"]["Enums"]["oauth_provider"]
          refresh_token: string | null
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_email?: string | null
          created_at?: string
          expires_at: string
          id?: string
          provider: Database["public"]["Enums"]["oauth_provider"]
          refresh_token?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_email?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          provider?: Database["public"]["Enums"]["oauth_provider"]
          refresh_token?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_rounds: {
        Row: {
          amount: number
          conditions: string[]
          counter_amount: number | null
          created_at: string
          id: string
          notes: string | null
          offer_id: string
          response: string
        }
        Insert: {
          amount: number
          conditions?: string[]
          counter_amount?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          offer_id: string
          response?: string
        }
        Update: {
          amount?: number
          conditions?: string[]
          counter_amount?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          offer_id?: string
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_rounds_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          client_id: string
          client_max_price: number | null
          conditions: string[]
          created_at: string
          deleted_at: string | null
          deposit_amount: number | null
          deposit_type: string | null
          id: string
          is_deleted: boolean
          property_id: string
          recommended_offer: number | null
          sale_method: string
          settlement_period: number | null
          status: string
          strategy_notes: string | null
          transaction_id: string
          updated_at: string
          walk_away_price: number | null
        }
        Insert: {
          client_id: string
          client_max_price?: number | null
          conditions?: string[]
          created_at?: string
          deleted_at?: string | null
          deposit_amount?: number | null
          deposit_type?: string | null
          id?: string
          is_deleted?: boolean
          property_id: string
          recommended_offer?: number | null
          sale_method: string
          settlement_period?: number | null
          status?: string
          strategy_notes?: string | null
          transaction_id: string
          updated_at?: string
          walk_away_price?: number | null
        }
        Update: {
          client_id?: string
          client_max_price?: number | null
          conditions?: string[]
          created_at?: string
          deleted_at?: string | null
          deposit_amount?: number | null
          deposit_type?: string | null
          id?: string
          is_deleted?: boolean
          property_id?: string
          recommended_offer?: number | null
          sale_method?: string
          settlement_period?: number | null
          status?: string
          strategy_notes?: string | null
          transaction_id?: string
          updated_at?: string
          walk_away_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_migration_history: {
        Row: {
          client_brief_created: boolean
          client_brief_id: string | null
          id: string
          migrated_at: string
          migrated_by: string
          migration_batch_id: string | null
          migration_context: Json | null
          migration_reason: string | null
          new_pipeline_type: string
          new_stage: string
          original_pipeline_type: string
          original_stage: string
          rollback_reason: string | null
          rolled_back: boolean
          rolled_back_at: string | null
          transaction_id: string
        }
        Insert: {
          client_brief_created?: boolean
          client_brief_id?: string | null
          id?: string
          migrated_at?: string
          migrated_by: string
          migration_batch_id?: string | null
          migration_context?: Json | null
          migration_reason?: string | null
          new_pipeline_type: string
          new_stage: string
          original_pipeline_type: string
          original_stage: string
          rollback_reason?: string | null
          rolled_back?: boolean
          rolled_back_at?: string | null
          transaction_id: string
        }
        Update: {
          client_brief_created?: boolean
          client_brief_id?: string | null
          id?: string
          migrated_at?: string
          migrated_by?: string
          migration_batch_id?: string | null
          migration_context?: Json | null
          migration_reason?: string | null
          new_pipeline_type?: string
          new_stage?: string
          original_pipeline_type?: string
          original_stage?: string
          rollback_reason?: string | null
          rolled_back?: boolean
          rolled_back_at?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_migration_history_client_brief_id_fkey"
            columns: ["client_brief_id"]
            isOneToOne: false
            referencedRelation: "client_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_migration_history_migrated_by_fkey"
            columns: ["migrated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_migration_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_clients: {
        Row: {
          agent_id: string
          auth_id: string
          contact_id: string
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          agent_id: string
          auth_id: string
          contact_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          agent_id?: string
          auth_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_clients_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_clients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_listings: {
        Row: {
          created_at: string
          external_listing_id: string | null
          id: string
          last_synced_at: string | null
          portal: string
          property_id: string
          status: string
          sync_error: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_listing_id?: string | null
          id?: string
          last_synced_at?: string | null
          portal: string
          property_id: string
          status?: string
          sync_error?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_listing_id?: string | null
          id?: string
          last_synced_at?: string | null
          portal?: string
          property_id?: string
          status?: string
          sync_error?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address_postcode: string
          address_state: string
          address_street_name: string
          address_street_number: string
          address_suburb: string
          address_unit_number: string | null
          assigned_agent_id: string
          auction_date: string | null
          bathrooms: number
          bedrooms: number
          building_size: number | null
          car_spaces: number
          comparables: Json
          created_at: string
          deleted_at: string | null
          domain_listing_id: string | null
          enquiry_count: number
          floor_plans: string[]
          id: string
          inspection_count: number
          is_deleted: boolean
          land_size: number | null
          list_price: number | null
          listing_description: string | null
          listing_status: Database["public"]["Enums"]["listing_status"]
          photos: Json
          portal_views: number
          price_guide: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          rea_listing_id: string | null
          sale_type: Database["public"]["Enums"]["sale_type"]
          updated_at: string
          vendor_id: string | null
          video_url: string | null
          virtual_tour_url: string | null
          year_built: number | null
        }
        Insert: {
          address_postcode: string
          address_state: string
          address_street_name: string
          address_street_number: string
          address_suburb: string
          address_unit_number?: string | null
          assigned_agent_id: string
          auction_date?: string | null
          bathrooms?: number
          bedrooms?: number
          building_size?: number | null
          car_spaces?: number
          comparables?: Json
          created_at?: string
          deleted_at?: string | null
          domain_listing_id?: string | null
          enquiry_count?: number
          floor_plans?: string[]
          id?: string
          inspection_count?: number
          is_deleted?: boolean
          land_size?: number | null
          list_price?: number | null
          listing_description?: string | null
          listing_status?: Database["public"]["Enums"]["listing_status"]
          photos?: Json
          portal_views?: number
          price_guide?: string | null
          property_type: Database["public"]["Enums"]["property_type"]
          rea_listing_id?: string | null
          sale_type: Database["public"]["Enums"]["sale_type"]
          updated_at?: string
          vendor_id?: string | null
          video_url?: string | null
          virtual_tour_url?: string | null
          year_built?: number | null
        }
        Update: {
          address_postcode?: string
          address_state?: string
          address_street_name?: string
          address_street_number?: string
          address_suburb?: string
          address_unit_number?: string | null
          assigned_agent_id?: string
          auction_date?: string | null
          bathrooms?: number
          bedrooms?: number
          building_size?: number | null
          car_spaces?: number
          comparables?: Json
          created_at?: string
          deleted_at?: string | null
          domain_listing_id?: string | null
          enquiry_count?: number
          floor_plans?: string[]
          id?: string
          inspection_count?: number
          is_deleted?: boolean
          land_size?: number | null
          list_price?: number | null
          listing_description?: string | null
          listing_status?: Database["public"]["Enums"]["listing_status"]
          photos?: Json
          portal_views?: number
          price_guide?: string | null
          property_type?: Database["public"]["Enums"]["property_type"]
          rea_listing_id?: string | null
          sale_type?: Database["public"]["Enums"]["sale_type"]
          updated_at?: string
          vendor_id?: string | null
          video_url?: string | null
          virtual_tour_url?: string | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      property_alert_events: {
        Row: {
          action: string | null
          actioned_at: string | null
          alert_type: string
          channels_attempted: string[]
          channels_delivered: string[]
          created_at: string
          id: string
          match_score: number
          property_match_id: string | null
          sent_at: string | null
          snooze_until: string | null
          subscription_id: string
        }
        Insert: {
          action?: string | null
          actioned_at?: string | null
          alert_type: string
          channels_attempted?: string[]
          channels_delivered?: string[]
          created_at?: string
          id?: string
          match_score: number
          property_match_id?: string | null
          sent_at?: string | null
          snooze_until?: string | null
          subscription_id: string
        }
        Update: {
          action?: string | null
          actioned_at?: string | null
          alert_type?: string
          channels_attempted?: string[]
          channels_delivered?: string[]
          created_at?: string
          id?: string
          match_score?: number
          property_match_id?: string | null
          sent_at?: string | null
          snooze_until?: string | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_alert_events_property_match_id_fkey"
            columns: ["property_match_id"]
            isOneToOne: false
            referencedRelation: "property_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_alert_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "property_alert_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      property_alert_subscriptions: {
        Row: {
          agent_id: string
          brief_id: string
          channels: string[]
          created_at: string
          deleted_at: string | null
          digest_mode: boolean
          digest_time: string
          id: string
          is_active: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          score_threshold: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          brief_id: string
          channels?: string[]
          created_at?: string
          deleted_at?: string | null
          digest_mode?: boolean
          digest_time?: string
          id?: string
          is_active?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          score_threshold?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          brief_id?: string
          channels?: string[]
          created_at?: string
          deleted_at?: string | null
          digest_mode?: boolean
          digest_time?: string
          id?: string
          is_active?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          score_threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_alert_subscriptions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_alert_subscriptions_brief_id_fkey"
            columns: ["brief_id"]
            isOneToOne: false
            referencedRelation: "client_briefs"
            referencedColumns: ["id"]
          },
        ]
      }
      property_interested_buyers: {
        Row: {
          added_at: string
          contact_id: string
          property_id: string
        }
        Insert: {
          added_at?: string
          contact_id: string
          property_id: string
        }
        Update: {
          added_at?: string
          contact_id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_interested_buyers_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_interested_buyers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_matches: {
        Row: {
          agent_notes: string | null
          client_brief_id: string
          client_feedback: string | null
          client_feedback_at: string | null
          client_feedback_note: string | null
          client_id: string
          id: string
          matched_at: string
          overall_score: number
          property_id: string
          rejection_reason: string | null
          score_breakdown: Json
          status: string
          updated_at: string
        }
        Insert: {
          agent_notes?: string | null
          client_brief_id: string
          client_feedback?: string | null
          client_feedback_at?: string | null
          client_feedback_note?: string | null
          client_id: string
          id?: string
          matched_at?: string
          overall_score: number
          property_id: string
          rejection_reason?: string | null
          score_breakdown?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          agent_notes?: string | null
          client_brief_id?: string
          client_feedback?: string | null
          client_feedback_at?: string | null
          client_feedback_note?: string | null
          client_id?: string
          id?: string
          matched_at?: string
          overall_score?: number
          property_id?: string
          rejection_reason?: string | null
          score_breakdown?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_matches_client_brief_id_fkey"
            columns: ["client_brief_id"]
            isOneToOne: false
            referencedRelation: "client_briefs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_matches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_matches_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_price_changes: {
        Row: {
          change_percent: number | null
          change_type: string
          detected_at: string | null
          domain_listing_id: string
          id: string
          new_price: number
          notified_agent_ids: string[] | null
          previous_price: number | null
          property_id: string | null
        }
        Insert: {
          change_percent?: number | null
          change_type: string
          detected_at?: string | null
          domain_listing_id: string
          id?: string
          new_price: number
          notified_agent_ids?: string[] | null
          previous_price?: number | null
          property_id?: string | null
        }
        Update: {
          change_percent?: number | null
          change_type?: string
          detected_at?: string | null
          domain_listing_id?: string
          id?: string
          new_price?: number
          notified_agent_ids?: string[] | null
          previous_price?: number | null
          property_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_price_changes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      push_device_tokens: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          is_active: boolean
          last_seen_at: string | null
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_device_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_fees: {
        Row: {
          amount: number
          created_at: string
          fee_structure_id: string
          id: string
          paid: boolean
          paid_date: string | null
          referrer_contact_id: string | null
          referrer_name: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          fee_structure_id: string
          id?: string
          paid?: boolean
          paid_date?: string | null
          referrer_contact_id?: string | null
          referrer_name: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          fee_structure_id?: string
          id?: string
          paid?: boolean
          paid_date?: string | null
          referrer_contact_id?: string | null
          referrer_name?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_fees_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_fees_referrer_contact_id_fkey"
            columns: ["referrer_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      selling_agent_profiles: {
        Row: {
          agency: string | null
          average_response_time: string | null
          contact_id: string
          created_at: string
          deals_closed_with: number
          domain_agent_id: string | null
          domain_profile_url: string | null
          id: string
          last_contact_date: string | null
          last_enriched_at: string | null
          listings_count_active: number | null
          listings_count_sold: number | null
          properties_sent: number
          relationship_score: number | null
          suburbs: string[]
          tags: string[]
          total_interactions: number
          updated_at: string
        }
        Insert: {
          agency?: string | null
          average_response_time?: string | null
          contact_id: string
          created_at?: string
          deals_closed_with?: number
          domain_agent_id?: string | null
          domain_profile_url?: string | null
          id?: string
          last_contact_date?: string | null
          last_enriched_at?: string | null
          listings_count_active?: number | null
          listings_count_sold?: number | null
          properties_sent?: number
          relationship_score?: number | null
          suburbs?: string[]
          tags?: string[]
          total_interactions?: number
          updated_at?: string
        }
        Update: {
          agency?: string | null
          average_response_time?: string | null
          contact_id?: string
          created_at?: string
          deals_closed_with?: number
          domain_agent_id?: string | null
          domain_profile_url?: string | null
          id?: string
          last_contact_date?: string | null
          last_enriched_at?: string | null
          listings_count_active?: number | null
          listings_count_sold?: number | null
          properties_sent?: number
          relationship_score?: number | null
          suburbs?: string[]
          tags?: string[]
          total_interactions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "selling_agent_profiles_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_enrollments: {
        Row: {
          ai_content_overrides: Json | null
          cancelled_at: string | null
          completed_at: string | null
          contact_id: string
          created_at: string
          current_step_index: number
          enrolled_by: string | null
          id: string
          last_step_sent_at: string | null
          next_step_due_at: string | null
          preferred_send_hour: number | null
          sequence_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          ai_content_overrides?: Json | null
          cancelled_at?: string | null
          completed_at?: string | null
          contact_id: string
          created_at?: string
          current_step_index?: number
          enrolled_by?: string | null
          id?: string
          last_step_sent_at?: string | null
          next_step_due_at?: string | null
          preferred_send_hour?: number | null
          sequence_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_content_overrides?: Json | null
          cancelled_at?: string | null
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          current_step_index?: number
          enrolled_by?: string | null
          id?: string
          last_step_sent_at?: string | null
          next_step_due_at?: string | null
          preferred_send_hour?: number | null
          sequence_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_enrolled_by_fkey"
            columns: ["enrolled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "follow_up_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          merge_fields: string[]
          name: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          merge_fields?: string[]
          name: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          merge_fields?: string[]
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      social_messages: {
        Row: {
          contact_id: string | null
          content: string
          created_at: string
          direction: string
          external_conversation_id: string | null
          id: string
          platform: string
          read_at: string | null
        }
        Insert: {
          contact_id?: string | null
          content: string
          created_at?: string
          direction: string
          external_conversation_id?: string | null
          id?: string
          platform: string
          read_at?: string | null
        }
        Update: {
          contact_id?: string | null
          content?: string
          created_at?: string
          direction?: string
          external_conversation_id?: string | null
          id?: string
          platform?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          comments_count: number
          content: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          external_post_id: string | null
          id: string
          image_url: string | null
          is_deleted: boolean
          likes_count: number
          platform: string
          property_id: string | null
          published_at: string | null
          scheduled_at: string | null
          shares_count: number
          status: string
          updated_at: string
        }
        Insert: {
          comments_count?: number
          content?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          external_post_id?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          likes_count?: number
          platform: string
          property_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          shares_count?: number
          status?: string
          updated_at?: string
        }
        Update: {
          comments_count?: number
          content?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          external_post_id?: string | null
          id?: string
          image_url?: string | null
          is_deleted?: boolean
          likes_count?: number
          platform?: string
          property_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          shares_count?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_transitions: {
        Row: {
          created_at: string
          from_stage: string
          id: string
          reason: string | null
          to_stage: string
          transaction_id: string
          triggered_by: string
        }
        Insert: {
          created_at?: string
          from_stage: string
          id?: string
          reason?: string | null
          to_stage: string
          transaction_id: string
          triggered_by: string
        }
        Update: {
          created_at?: string
          from_stage?: string
          id?: string
          reason?: string | null
          to_stage?: string
          transaction_id?: string
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_transitions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_transitions_triggered_by_fkey"
            columns: ["triggered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string
          id: string
          is_automated: boolean
          priority: Database["public"]["Enums"]["task_priority"]
          property_id: string | null
          reminder_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          transaction_id: string | null
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          workflow_id: string | null
        }
        Insert: {
          assigned_to: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date: string
          id?: string
          is_automated?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          property_id?: string | null
          reminder_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          transaction_id?: string | null
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          workflow_id?: string | null
        }
        Update: {
          assigned_to?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string
          id?: string
          is_automated?: boolean
          priority?: Database["public"]["Enums"]["task_priority"]
          property_id?: string | null
          reminder_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          transaction_id?: string | null
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tasks_workflow"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          lead_agent_id: string | null
          name: string
          office_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_agent_id?: string | null
          name: string
          office_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_agent_id?: string | null
          name?: string
          office_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_teams_lead_agent"
            columns: ["lead_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          assigned_agent_id: string
          commission_amount: number | null
          commission_rate: number | null
          contact_id: string
          contract_price: number | null
          cooling_off_expiry: string | null
          created_at: string
          current_stage: string
          deleted_at: string | null
          deposit_amount: number | null
          deposit_paid: boolean | null
          exchange_date: string | null
          finance_approval_date: string | null
          id: string
          is_deleted: boolean
          notes: string | null
          offer_amount: number | null
          offer_conditions: string | null
          offer_status: Database["public"]["Enums"]["offer_status"] | null
          pipeline_type: Database["public"]["Enums"]["pipeline_type"]
          property_id: string | null
          settlement_date: string | null
          stage_entered_at: string | null
          updated_at: string
        }
        Insert: {
          assigned_agent_id: string
          commission_amount?: number | null
          commission_rate?: number | null
          contact_id: string
          contract_price?: number | null
          cooling_off_expiry?: string | null
          created_at?: string
          current_stage: string
          deleted_at?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          exchange_date?: string | null
          finance_approval_date?: string | null
          id?: string
          is_deleted?: boolean
          notes?: string | null
          offer_amount?: number | null
          offer_conditions?: string | null
          offer_status?: Database["public"]["Enums"]["offer_status"] | null
          pipeline_type: Database["public"]["Enums"]["pipeline_type"]
          property_id?: string | null
          settlement_date?: string | null
          stage_entered_at?: string | null
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string
          commission_amount?: number | null
          commission_rate?: number | null
          contact_id?: string
          contract_price?: number | null
          cooling_off_expiry?: string | null
          created_at?: string
          current_stage?: string
          deleted_at?: string | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          exchange_date?: string | null
          finance_approval_date?: string | null
          id?: string
          is_deleted?: boolean
          notes?: string | null
          offer_amount?: number | null
          offer_conditions?: string | null
          offer_status?: Database["public"]["Enums"]["offer_status"] | null
          pipeline_type?: Database["public"]["Enums"]["pipeline_type"]
          property_id?: string | null
          settlement_date?: string | null
          stage_entered_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          office_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          office_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          office_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          current_action_index: number
          error: string | null
          id: string
          started_at: string
          status: Database["public"]["Enums"]["workflow_run_status"]
          transaction_id: string | null
          workflow_id: string
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          current_action_index?: number
          error?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["workflow_run_status"]
          transaction_id?: string | null
          workflow_id: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          current_action_index?: number
          error?: string | null
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["workflow_run_status"]
          transaction_id?: string | null
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          trigger: Json
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          trigger: Json
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          trigger?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflows_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inbox_thread_summaries: {
        Row: {
          agent_id: string | null
          channels: Database["public"]["Enums"]["message_channel"][] | null
          contact_first_name: string | null
          contact_id: string | null
          contact_last_name: string | null
          last_message_at: string | null
          last_message_channel:
            | Database["public"]["Enums"]["message_channel"]
            | null
          last_message_content: Json | null
          last_message_direction:
            | Database["public"]["Enums"]["message_direction"]
            | null
          last_message_id: string | null
          last_message_is_read: boolean | null
          last_message_status:
            | Database["public"]["Enums"]["message_status"]
            | null
          unread_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_funnel_stats: {
        Row: {
          active_count: number | null
          agent_id: string | null
          avg_days_in_stage: number | null
          new_30d: number | null
          pipeline_type: Database["public"]["Enums"]["pipeline_type"] | null
          stage: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_current_user_id: { Args: never; Returns: string }
      get_current_user_office_id: { Args: never; Returns: string }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      migrate_transaction_to_buyers_agent: {
        Args: {
          p_client_brief_id?: string
          p_migrated_by?: string
          p_migration_batch_id?: string
          p_migration_context?: Json
          p_migration_reason?: string
          p_target_stage: string
          p_transaction_id: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      action_item_category:
        | "call"
        | "follow_up"
        | "key_date"
        | "inspection"
        | "offer_review"
        | "document"
        | "pre_approval"
        | "settlement"
        | "general"
      activity_type:
        | "call"
        | "email-sent"
        | "email-received"
        | "sms-sent"
        | "sms-received"
        | "meeting"
        | "inspection"
        | "open-home"
        | "property-sent"
        | "note-added"
        | "stage-change"
        | "task-completed"
        | "document-uploaded"
        | "offer-submitted"
        | "contract-exchanged"
        | "settlement-completed"
        | "social-dm-sent"
        | "social-dm-received"
        | "system"
        | "inspection-logged"
        | "property-matched"
        | "offer-round"
        | "dd-item-completed"
        | "brief-updated"
      ai_confidence: "high" | "medium" | "low"
      ai_insight_type:
        | "property_analysis"
        | "market_summary"
        | "brief_refinement"
        | "risk_assessment"
        | "recommendation"
        | "consolidation_summary"
      aml_document_type:
        | "passport"
        | "birth_certificate"
        | "citizenship_certificate"
        | "drivers_licence"
        | "government_id_card"
        | "proof_of_age_card"
        | "medicare_card"
        | "credit_card"
        | "bank_card"
        | "utility_bill"
        | "bank_statement"
        | "council_rates"
        | "lease_agreement"
        | "centrelink_letter"
      buyer_stage:
        | "new-enquiry"
        | "qualified-lead"
        | "active-search"
        | "property-shortlisted"
        | "due-diligence"
        | "offer-made"
        | "under-contract"
        | "settled"
      buyers_agent_stage:
        | "enquiry"
        | "consult-qualify"
        | "engaged"
        | "strategy-brief"
        | "active-search"
        | "offer-negotiate"
        | "under-contract"
        | "settled-nurture"
      call_outcome: "answered" | "missed" | "voicemail" | "no_answer"
      communication_preference: "email" | "phone" | "sms" | "any"
      consolidation_report_status:
        | "generating"
        | "ready"
        | "sent_to_client"
        | "archived"
        | "failed"
      consolidation_report_type:
        | "client_brief_summary"
        | "property_comparison"
        | "market_analysis"
        | "search_progress"
        | "due_diligence_summary"
        | "settlement_outcome"
      contact_type:
        | "buyer"
        | "seller"
        | "investor"
        | "landlord"
        | "tenant"
        | "referral-source"
        | "past-client"
        | "selling-agent"
      enrollment_status: "active" | "paused" | "completed" | "cancelled"
      integration_provider:
        | "gmail"
        | "outlook"
        | "twilio"
        | "instagram"
        | "facebook"
        | "whatsapp"
        | "google_calendar"
        | "outlook_calendar"
      lead_source:
        | "domain"
        | "rea"
        | "instagram"
        | "facebook"
        | "linkedin"
        | "referral"
        | "walk-in"
        | "cold-call"
        | "website"
        | "open-home"
        | "signboard"
        | "print"
        | "other"
        | "google_ads"
      listing_status:
        | "pre-market"
        | "active"
        | "under-offer"
        | "sold"
        | "withdrawn"
        | "leased"
      message_channel:
        | "email"
        | "sms"
        | "phone_call"
        | "whatsapp"
        | "instagram_dm"
        | "facebook_messenger"
        | "domain_enquiry"
        | "rea_enquiry"
        | "linkedin"
        | "internal_note"
        | "portal_notification"
      message_direction: "inbound" | "outbound"
      message_status: "pending" | "delivered" | "read" | "failed"
      notification_category:
        | "new_lead"
        | "property_match"
        | "key_date"
        | "pipeline_update"
        | "follow_up_due"
        | "daily_action_list"
        | "system"
        | "digest"
      notification_priority: "critical" | "high" | "medium" | "low"
      notification_status: "pending" | "sent" | "read" | "dismissed" | "snoozed"
      oauth_provider: "google" | "microsoft" | "meta" | "whatsapp"
      offer_status:
        | "pending"
        | "countered"
        | "accepted"
        | "rejected"
        | "withdrawn"
      pipeline_type: "buying" | "selling" | "buyers-agent"
      portal_source: "domain" | "realestate.com.au"
      property_type:
        | "house"
        | "unit"
        | "townhouse"
        | "villa"
        | "land"
        | "rural"
        | "apartment"
        | "duplex"
        | "studio"
        | "acreage"
        | "retirement"
        | "commercial"
      report_generated_by: "ai" | "manual" | "automated"
      sale_type:
        | "private-treaty"
        | "auction"
        | "expression-of-interest"
        | "tender"
      seller_stage:
        | "appraisal-request"
        | "listing-preparation"
        | "on-market"
        | "offers-negotiation"
        | "under-contract"
        | "settled"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in-progress" | "completed" | "cancelled"
      task_type:
        | "call"
        | "email"
        | "sms"
        | "meeting"
        | "inspection"
        | "follow-up"
        | "document-review"
        | "appraisal"
        | "listing-preparation"
        | "marketing"
        | "open-home"
        | "auction-prep"
        | "settlement-task"
        | "general"
        | "brief-review"
        | "due-diligence-check"
        | "pre-settlement-inspection"
        | "client-portal-update"
      user_role: "agent" | "principal" | "admin" | "assistant"
      workflow_run_status: "running" | "completed" | "failed" | "cancelled"
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
      action_item_category: [
        "call",
        "follow_up",
        "key_date",
        "inspection",
        "offer_review",
        "document",
        "pre_approval",
        "settlement",
        "general",
      ],
      activity_type: [
        "call",
        "email-sent",
        "email-received",
        "sms-sent",
        "sms-received",
        "meeting",
        "inspection",
        "open-home",
        "property-sent",
        "note-added",
        "stage-change",
        "task-completed",
        "document-uploaded",
        "offer-submitted",
        "contract-exchanged",
        "settlement-completed",
        "social-dm-sent",
        "social-dm-received",
        "system",
        "inspection-logged",
        "property-matched",
        "offer-round",
        "dd-item-completed",
        "brief-updated",
      ],
      ai_confidence: ["high", "medium", "low"],
      ai_insight_type: [
        "property_analysis",
        "market_summary",
        "brief_refinement",
        "risk_assessment",
        "recommendation",
        "consolidation_summary",
      ],
      aml_document_type: [
        "passport",
        "birth_certificate",
        "citizenship_certificate",
        "drivers_licence",
        "government_id_card",
        "proof_of_age_card",
        "medicare_card",
        "credit_card",
        "bank_card",
        "utility_bill",
        "bank_statement",
        "council_rates",
        "lease_agreement",
        "centrelink_letter",
      ],
      buyer_stage: [
        "new-enquiry",
        "qualified-lead",
        "active-search",
        "property-shortlisted",
        "due-diligence",
        "offer-made",
        "under-contract",
        "settled",
      ],
      buyers_agent_stage: [
        "enquiry",
        "consult-qualify",
        "engaged",
        "strategy-brief",
        "active-search",
        "offer-negotiate",
        "under-contract",
        "settled-nurture",
      ],
      call_outcome: ["answered", "missed", "voicemail", "no_answer"],
      communication_preference: ["email", "phone", "sms", "any"],
      consolidation_report_status: [
        "generating",
        "ready",
        "sent_to_client",
        "archived",
        "failed",
      ],
      consolidation_report_type: [
        "client_brief_summary",
        "property_comparison",
        "market_analysis",
        "search_progress",
        "due_diligence_summary",
        "settlement_outcome",
      ],
      contact_type: [
        "buyer",
        "seller",
        "investor",
        "landlord",
        "tenant",
        "referral-source",
        "past-client",
        "selling-agent",
      ],
      enrollment_status: ["active", "paused", "completed", "cancelled"],
      integration_provider: [
        "gmail",
        "outlook",
        "twilio",
        "instagram",
        "facebook",
        "whatsapp",
        "google_calendar",
        "outlook_calendar",
      ],
      lead_source: [
        "domain",
        "rea",
        "instagram",
        "facebook",
        "linkedin",
        "referral",
        "walk-in",
        "cold-call",
        "website",
        "open-home",
        "signboard",
        "print",
        "other",
        "google_ads",
      ],
      listing_status: [
        "pre-market",
        "active",
        "under-offer",
        "sold",
        "withdrawn",
        "leased",
      ],
      message_channel: [
        "email",
        "sms",
        "phone_call",
        "whatsapp",
        "instagram_dm",
        "facebook_messenger",
        "domain_enquiry",
        "rea_enquiry",
        "linkedin",
        "internal_note",
        "portal_notification",
      ],
      message_direction: ["inbound", "outbound"],
      message_status: ["pending", "delivered", "read", "failed"],
      notification_category: [
        "new_lead",
        "property_match",
        "key_date",
        "pipeline_update",
        "follow_up_due",
        "daily_action_list",
        "system",
        "digest",
      ],
      notification_priority: ["critical", "high", "medium", "low"],
      notification_status: ["pending", "sent", "read", "dismissed", "snoozed"],
      oauth_provider: ["google", "microsoft", "meta", "whatsapp"],
      offer_status: [
        "pending",
        "countered",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      pipeline_type: ["buying", "selling", "buyers-agent"],
      portal_source: ["domain", "realestate.com.au"],
      property_type: [
        "house",
        "unit",
        "townhouse",
        "villa",
        "land",
        "rural",
        "apartment",
        "duplex",
        "studio",
        "acreage",
        "retirement",
        "commercial",
      ],
      report_generated_by: ["ai", "manual", "automated"],
      sale_type: [
        "private-treaty",
        "auction",
        "expression-of-interest",
        "tender",
      ],
      seller_stage: [
        "appraisal-request",
        "listing-preparation",
        "on-market",
        "offers-negotiation",
        "under-contract",
        "settled",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "in-progress", "completed", "cancelled"],
      task_type: [
        "call",
        "email",
        "sms",
        "meeting",
        "inspection",
        "follow-up",
        "document-review",
        "appraisal",
        "listing-preparation",
        "marketing",
        "open-home",
        "auction-prep",
        "settlement-task",
        "general",
        "brief-review",
        "due-diligence-check",
        "pre-settlement-inspection",
        "client-portal-update",
      ],
      user_role: ["agent", "principal", "admin", "assistant"],
      workflow_run_status: ["running", "completed", "failed", "cancelled"],
    },
  },
} as const
