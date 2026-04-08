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
      admin_allowlist: {
        Row: {
          added_by: string | null
          created_at: string
          email: string
          id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          check_in_at: string
          check_in_date: string
          created_at: string
          id: string
          program_source: string
          registration_id: string
        }
        Insert: {
          check_in_at?: string
          check_in_date?: string
          created_at?: string
          id?: string
          program_source?: string
          registration_id: string
        }
        Update: {
          check_in_at?: string
          check_in_date?: string
          created_at?: string
          id?: string
          program_source?: string
          registration_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "youth_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_verses: {
        Row: {
          created_at: string
          day: number
          id: string
          is_trashed: boolean
          month: number
          reference: string
          text: string
          theme: string | null
          year: number
        }
        Insert: {
          created_at?: string
          day: number
          id?: string
          is_trashed?: boolean
          month: number
          reference: string
          text: string
          theme?: string | null
          year: number
        }
        Update: {
          created_at?: string
          day?: number
          id?: string
          is_trashed?: boolean
          month?: number
          reference?: string
          text?: string
          theme?: string | null
          year?: number
        }
        Relationships: []
      }
      client_services: {
        Row: {
          client_id: string
          created_at: string
          id: string
          rate_amount: number
          rate_type: string
          service_name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          rate_amount?: number
          rate_type: string
          service_name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          rate_amount?: number
          rate_type?: string
          service_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_address: string | null
          billing_email: string | null
          client_name: string
          contact_name: string | null
          created_at: string
          default_billing_method: string | null
          default_flat_rate: number | null
          hourly_rate: number | null
          id: string
          notes: string | null
          phone: string | null
          program_title: string | null
          rate_amount: number | null
          rate_type: Database["public"]["Enums"]["rate_type"] | null
          service_days: string | null
          service_description_default: string | null
          service_time: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          billing_email?: string | null
          client_name: string
          contact_name?: string | null
          created_at?: string
          default_billing_method?: string | null
          default_flat_rate?: number | null
          hourly_rate?: number | null
          id?: string
          notes?: string | null
          phone?: string | null
          program_title?: string | null
          rate_amount?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"] | null
          service_days?: string | null
          service_description_default?: string | null
          service_time?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          billing_email?: string | null
          client_name?: string
          contact_name?: string | null
          created_at?: string
          default_billing_method?: string | null
          default_flat_rate?: number | null
          hourly_rate?: number | null
          id?: string
          notes?: string | null
          phone?: string | null
          program_title?: string | null
          rate_amount?: number | null
          rate_type?: Database["public"]["Enums"]["rate_type"] | null
          service_days?: string | null
          service_description_default?: string | null
          service_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deposit_batches: {
        Row: {
          bank_account: Database["public"]["Enums"]["bank_account"]
          batch_name: string
          created_at: string
          created_by: string | null
          deposit_date: string | null
          deposited_by: string | null
          id: string
          status: Database["public"]["Enums"]["deposit_status"]
          updated_at: string
        }
        Insert: {
          bank_account?: Database["public"]["Enums"]["bank_account"]
          batch_name: string
          created_at?: string
          created_by?: string | null
          deposit_date?: string | null
          deposited_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
        }
        Update: {
          bank_account?: Database["public"]["Enums"]["bank_account"]
          batch_name?: string
          created_at?: string
          created_by?: string | null
          deposit_date?: string | null
          deposited_by?: string | null
          id?: string
          status?: Database["public"]["Enums"]["deposit_status"]
          updated_at?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          created_at: string
          date_received: string
          deposit_batch_id: string | null
          deposit_date: string | null
          donor_email: string | null
          donor_name: string
          event_name: string | null
          grant_date: string | null
          id: string
          method: Database["public"]["Enums"]["donation_method"]
          notes: string | null
          partner_name: string | null
          program_name: string | null
          receipt_status: Database["public"]["Enums"]["receipt_status"]
          recognition_period: string | null
          reference_id: string | null
          revenue_description: string | null
          revenue_type: Database["public"]["Enums"]["revenue_type"]
          service_month: string | null
          source_email: string | null
          source_name: string | null
          supporter_id: string | null
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          date_received: string
          deposit_batch_id?: string | null
          deposit_date?: string | null
          donor_email?: string | null
          donor_name: string
          event_name?: string | null
          grant_date?: string | null
          id?: string
          method: Database["public"]["Enums"]["donation_method"]
          notes?: string | null
          partner_name?: string | null
          program_name?: string | null
          receipt_status?: Database["public"]["Enums"]["receipt_status"]
          recognition_period?: string | null
          reference_id?: string | null
          revenue_description?: string | null
          revenue_type?: Database["public"]["Enums"]["revenue_type"]
          service_month?: string | null
          source_email?: string | null
          source_name?: string | null
          supporter_id?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          date_received?: string
          deposit_batch_id?: string | null
          deposit_date?: string | null
          donor_email?: string | null
          donor_name?: string
          event_name?: string | null
          grant_date?: string | null
          id?: string
          method?: Database["public"]["Enums"]["donation_method"]
          notes?: string | null
          partner_name?: string | null
          program_name?: string | null
          receipt_status?: Database["public"]["Enums"]["receipt_status"]
          recognition_period?: string | null
          reference_id?: string | null
          revenue_description?: string | null
          revenue_type?: Database["public"]["Enums"]["revenue_type"]
          service_month?: string | null
          source_email?: string | null
          source_name?: string | null
          supporter_id?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_deposit_batch_id_fkey"
            columns: ["deposit_batch_id"]
            isOneToOne: false
            referencedRelation: "deposit_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donations_supporter_id_fkey"
            columns: ["supporter_id"]
            isOneToOne: false
            referencedRelation: "supporters"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          pin_hash: string
          status: Database["public"]["Enums"]["driver_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          pin_hash: string
          status?: Database["public"]["Enums"]["driver_status"]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          pin_hash?: string
          status?: Database["public"]["Enums"]["driver_status"]
        }
        Relationships: []
      }
      engagements: {
        Row: {
          created_at: string
          date: string
          engagement_type: Database["public"]["Enums"]["engagement_type"]
          follow_up_date: string | null
          follow_up_needed: boolean
          id: string
          logged_by: string | null
          outcome: Database["public"]["Enums"]["engagement_outcome"] | null
          summary: string | null
          supporter_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          engagement_type: Database["public"]["Enums"]["engagement_type"]
          follow_up_date?: string | null
          follow_up_needed?: boolean
          id?: string
          logged_by?: string | null
          outcome?: Database["public"]["Enums"]["engagement_outcome"] | null
          summary?: string | null
          supporter_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          engagement_type?: Database["public"]["Enums"]["engagement_type"]
          follow_up_date?: string | null
          follow_up_needed?: boolean
          id?: string
          logged_by?: string | null
          outcome?: Database["public"]["Enums"]["engagement_outcome"] | null
          summary?: string | null
          supporter_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagements_supporter_id_fkey"
            columns: ["supporter_id"]
            isOneToOne: false
            referencedRelation: "supporters"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          description: string
          driver_id: string | null
          id: string
          recorded_at: string
          run_id: string | null
          youth_id: string | null
        }
        Insert: {
          description: string
          driver_id?: string | null
          id?: string
          recorded_at?: string
          run_id?: string | null
          youth_id?: string | null
        }
        Update: {
          description?: string
          driver_id?: string | null
          id?: string
          recorded_at?: string
          run_id?: string | null
          youth_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_youth_id_fkey"
            columns: ["youth_id"]
            isOneToOne: false
            referencedRelation: "youth_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_approvals: {
        Row: {
          approver_email: string
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          requested_by_user_id: string | null
          responded_at: string | null
          status: string
          token: string
        }
        Insert: {
          approver_email?: string
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          requested_by_user_id?: string | null
          responded_at?: string | null
          status?: string
          token?: string
        }
        Update: {
          approver_email?: string
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          requested_by_user_id?: string | null
          responded_at?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_approvals_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sends: {
        Row: {
          created_at: string
          error: string | null
          id: string
          invoice_id: string
          last_checked_at: string | null
          message: string | null
          provider_message_id: string | null
          provider_status: string | null
          sent_at: string
          sent_by_user_id: string | null
          sent_to: string
          status: string
          subject: string
          type: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          invoice_id: string
          last_checked_at?: string | null
          message?: string | null
          provider_message_id?: string | null
          provider_status?: string | null
          sent_at?: string
          sent_by_user_id?: string | null
          sent_to: string
          status?: string
          subject: string
          type?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          invoice_id?: string
          last_checked_at?: string | null
          message?: string | null
          provider_message_id?: string | null
          provider_status?: string | null
          sent_at?: string
          sent_by_user_id?: string | null
          sent_to?: string
          status?: string
          subject?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_sends_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          approval_notes: string | null
          approval_request_sent_at: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          client_id: string
          created_at: string
          due_date: string | null
          email_note: string | null
          id: string
          invoice_month: number
          invoice_number: string
          invoice_year: number
          issue_date: string | null
          last_sent_at: string | null
          notes: string | null
          pdf_base64: string | null
          pdf_generated_at: string | null
          send_count: number
          sent_at: string | null
          sent_to: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          total: number | null
          updated_at: string
          vendor_email: string | null
        }
        Insert: {
          approval_notes?: string | null
          approval_request_sent_at?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          client_id: string
          created_at?: string
          due_date?: string | null
          email_note?: string | null
          id?: string
          invoice_month: number
          invoice_number: string
          invoice_year: number
          issue_date?: string | null
          last_sent_at?: string | null
          notes?: string | null
          pdf_base64?: string | null
          pdf_generated_at?: string | null
          send_count?: number
          sent_at?: string | null
          sent_to?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          total?: number | null
          updated_at?: string
          vendor_email?: string | null
        }
        Update: {
          approval_notes?: string | null
          approval_request_sent_at?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string
          created_at?: string
          due_date?: string | null
          email_note?: string | null
          id?: string
          invoice_month?: number
          invoice_number?: string
          invoice_year?: number
          issue_date?: string | null
          last_sent_at?: string | null
          notes?: string | null
          pdf_base64?: string | null
          pdf_generated_at?: string | null
          send_count?: number
          sent_at?: string | null
          sent_to?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          total?: number | null
          updated_at?: string
          vendor_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_form_fields: {
        Row: {
          created_at: string
          db_column: string | null
          default_value: string | null
          field_key: string
          field_type: string
          help_text: string | null
          id: string
          is_active: boolean
          is_core: boolean
          label: string
          options: Json | null
          placeholder: string | null
          required: boolean
          section: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          db_column?: string | null
          default_value?: string | null
          field_key: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_core?: boolean
          label: string
          options?: Json | null
          placeholder?: string | null
          required?: boolean
          section?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          db_column?: string | null
          default_value?: string | null
          field_key?: string
          field_type?: string
          help_text?: string | null
          id?: string
          is_active?: boolean
          is_core?: boolean
          label?: string
          options?: Json | null
          placeholder?: string | null
          required?: boolean
          section?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      revenue: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          logged_by: string | null
          notes: string | null
          payment_method: string | null
          reference_id: string | null
          revenue_type: string
          supporter_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          date: string
          id?: string
          logged_by?: string | null
          notes?: string | null
          payment_method?: string | null
          reference_id?: string | null
          revenue_type: string
          supporter_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          logged_by?: string | null
          notes?: string | null
          payment_method?: string | null
          reference_id?: string | null
          revenue_type?: string
          supporter_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_supporter_id_fkey"
            columns: ["supporter_id"]
            isOneToOne: false
            referencedRelation: "supporters"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          assigned_driver_id: string | null
          created_at: string
          id: string
          name: Database["public"]["Enums"]["route_name"]
        }
        Insert: {
          assigned_driver_id?: string | null
          created_at?: string
          id?: string
          name: Database["public"]["Enums"]["route_name"]
        }
        Update: {
          assigned_driver_id?: string | null
          created_at?: string
          id?: string
          name?: Database["public"]["Enums"]["route_name"]
        }
        Relationships: [
          {
            foreignKeyName: "routes_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          closed_at: string | null
          driver_id: string
          id: string
          route_id: string
          run_type: Database["public"]["Enums"]["run_type"]
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
        }
        Insert: {
          closed_at?: string | null
          driver_id: string
          id?: string
          route_id: string
          run_type: Database["public"]["Enums"]["run_type"]
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
        }
        Update: {
          closed_at?: string | null
          driver_id?: string
          id?: string
          route_id?: string
          run_type?: Database["public"]["Enums"]["run_type"]
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
        }
        Relationships: [
          {
            foreignKeyName: "runs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      service_logs: {
        Row: {
          billing_method: string | null
          client_id: string
          created_at: string
          flat_amount: number | null
          hours: number | null
          id: string
          line_total: number | null
          notes: string | null
          quantity: number | null
          service_date: string
          service_type: string | null
          service_type_id: string | null
          updated_at: string
        }
        Insert: {
          billing_method?: string | null
          client_id: string
          created_at?: string
          flat_amount?: number | null
          hours?: number | null
          id?: string
          line_total?: number | null
          notes?: string | null
          quantity?: number | null
          service_date: string
          service_type?: string | null
          service_type_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_method?: string | null
          client_id?: string
          created_at?: string
          flat_amount?: number | null
          hours?: number | null
          id?: string
          line_total?: number | null
          notes?: string | null
          quantity?: number | null
          service_date?: string
          service_type?: string | null
          service_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_logs_service_type_id_fkey"
            columns: ["service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          rate_amount: number
          rate_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          rate_amount?: number
          rate_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rate_amount?: number
          rate_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      signals: {
        Row: {
          archived_at: string | null
          completed_at: string | null
          created_at: string
          date_assigned: string | null
          deck_sort_order: number | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          id: string
          is_archived: boolean
          is_trashed: boolean
          metadata: Json | null
          pillar: Database["public"]["Enums"]["signal_pillar"] | null
          priority_layer: Database["public"]["Enums"]["priority_layer"] | null
          reopen_count: number
          reopened_at: string | null
          signal_kind: Database["public"]["Enums"]["signal_kind"] | null
          signal_type: string
          source: string | null
          status: Database["public"]["Enums"]["signal_status"]
          title: string | null
          today_sort_order: number | null
          trashed_at: string | null
          trashed_by: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string
          date_assigned?: string | null
          deck_sort_order?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_trashed?: boolean
          metadata?: Json | null
          pillar?: Database["public"]["Enums"]["signal_pillar"] | null
          priority_layer?: Database["public"]["Enums"]["priority_layer"] | null
          reopen_count?: number
          reopened_at?: string | null
          signal_kind?: Database["public"]["Enums"]["signal_kind"] | null
          signal_type: string
          source?: string | null
          status?: Database["public"]["Enums"]["signal_status"]
          title?: string | null
          today_sort_order?: number | null
          trashed_at?: string | null
          trashed_by?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          completed_at?: string | null
          created_at?: string
          date_assigned?: string | null
          deck_sort_order?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean
          is_trashed?: boolean
          metadata?: Json | null
          pillar?: Database["public"]["Enums"]["signal_pillar"] | null
          priority_layer?: Database["public"]["Enums"]["priority_layer"] | null
          reopen_count?: number
          reopened_at?: string | null
          signal_kind?: Database["public"]["Enums"]["signal_kind"] | null
          signal_type?: string
          source?: string | null
          status?: Database["public"]["Enums"]["signal_status"]
          title?: string | null
          today_sort_order?: number | null
          trashed_at?: string | null
          trashed_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      supporters: {
        Row: {
          address: string | null
          address_city: string | null
          address_country: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          created_at: string
          email: string | null
          email_opt_in: boolean
          id: string
          is_hall_of_fame: boolean
          name: string
          outreach_tags: string[] | null
          phone: string | null
          primary_revenue_stream: string | null
          receipt_2026_last_sent_to: string | null
          receipt_2026_pdf_url: string | null
          receipt_2026_sent_at: string | null
          receipt_2026_status: string
          relationship_owner: string | null
          sms_opt_in: boolean
          status: string | null
          story: string | null
          supporter_category: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_city?: string | null
          address_country?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          created_at?: string
          email?: string | null
          email_opt_in?: boolean
          id?: string
          is_hall_of_fame?: boolean
          name: string
          outreach_tags?: string[] | null
          phone?: string | null
          primary_revenue_stream?: string | null
          receipt_2026_last_sent_to?: string | null
          receipt_2026_pdf_url?: string | null
          receipt_2026_sent_at?: string | null
          receipt_2026_status?: string
          relationship_owner?: string | null
          sms_opt_in?: boolean
          status?: string | null
          story?: string | null
          supporter_category?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_city?: string | null
          address_country?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          created_at?: string
          email?: string | null
          email_opt_in?: boolean
          id?: string
          is_hall_of_fame?: boolean
          name?: string
          outreach_tags?: string[] | null
          phone?: string | null
          primary_revenue_stream?: string | null
          receipt_2026_last_sent_to?: string | null
          receipt_2026_pdf_url?: string | null
          receipt_2026_sent_at?: string | null
          receipt_2026_status?: string
          relationship_owner?: string | null
          sms_opt_in?: boolean
          status?: string | null
          story?: string | null
          supporter_category?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["task_status"]
          supporter_id: string
          task_type: Database["public"]["Enums"]["task_type"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          supporter_id: string
          task_type: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          supporter_id?: string
          task_type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_supporter_id_fkey"
            columns: ["supporter_id"]
            isOneToOne: false
            referencedRelation: "supporters"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_attendance: {
        Row: {
          id: string
          recorded_at: string
          run_id: string
          status: Database["public"]["Enums"]["transport_attendance_status"]
          youth_id: string
        }
        Insert: {
          id?: string
          recorded_at?: string
          run_id: string
          status?: Database["public"]["Enums"]["transport_attendance_status"]
          youth_id: string
        }
        Update: {
          id?: string
          recorded_at?: string
          run_id?: string
          status?: Database["public"]["Enums"]["transport_attendance_status"]
          youth_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_attendance_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_attendance_youth_id_fkey"
            columns: ["youth_id"]
            isOneToOne: false
            referencedRelation: "youth_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      upcoming_events: {
        Row: {
          created_at: string
          event_date: string
          event_name: string
          id: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          event_date: string
          event_name: string
          id?: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          event_date?: string
          event_name?: string
          id?: string
          notes?: string | null
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
      verse_library: {
        Row: {
          created_at: string
          id: string
          is_trashed: boolean
          reference: string
          sort_index: number
          text: string
          theme: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_trashed?: boolean
          reference: string
          sort_index: number
          text: string
          theme?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_trashed?: boolean
          reference?: string
          sort_index?: number
          text?: string
          theme?: string | null
        }
        Relationships: []
      }
      vision_cloud_items: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          pillar: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          pillar: string
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          pillar?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      youth_profiles: {
        Row: {
          address: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          photo_url: string | null
          pickup_zone: Database["public"]["Enums"]["pickup_zone"]
          status: Database["public"]["Enums"]["youth_transport_status"]
        }
        Insert: {
          address?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          photo_url?: string | null
          pickup_zone: Database["public"]["Enums"]["pickup_zone"]
          status?: Database["public"]["Enums"]["youth_transport_status"]
        }
        Update: {
          address?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          photo_url?: string | null
          pickup_zone?: Database["public"]["Enums"]["pickup_zone"]
          status?: Database["public"]["Enums"]["youth_transport_status"]
        }
        Relationships: []
      }
      youth_registrations: {
        Row: {
          adults_in_household: number
          allergies: string | null
          approved_for_attendance: boolean
          asthma_inhaler_info: string | null
          bald_eagle_active: boolean
          child_boxing_program: Database["public"]["Enums"]["boxing_program"]
          child_date_of_birth: string
          child_first_name: string
          child_grade_level: number | null
          child_headshot_url: string | null
          child_last_name: string
          child_phone: string | null
          child_primary_address: string
          child_race_ethnicity: Database["public"]["Enums"]["child_race_ethnicity"]
          child_school_district: Database["public"]["Enums"]["school_district"]
          child_sex: Database["public"]["Enums"]["child_sex"]
          counseling_services_name: string | null
          counseling_services_signature_url: string | null
          created_at: string
          custom_fields_data: Json | null
          extended_program: string | null
          final_signature_name: string | null
          free_or_reduced_lunch:
            | Database["public"]["Enums"]["lunch_status"]
            | null
          household_income_range: Database["public"]["Enums"]["household_income"]
          id: string
          important_child_notes: string | null
          is_bald_eagle: boolean
          liability_waiver_name: string
          liability_waiver_signature_url: string
          media_consent_name: string
          media_consent_signature_url: string
          medical_consent_name: string
          medical_consent_signature_url: string
          parent_email: string
          parent_first_name: string
          parent_last_name: string
          parent_phone: string
          siblings_in_household: number
          spiritual_development_policy_name: string
          spiritual_development_policy_signature_url: string
          submission_date: string
          transportation_excursions_signature_url: string
          transportation_excursions_waiver_name: string
          updated_at: string
        }
        Insert: {
          adults_in_household: number
          allergies?: string | null
          approved_for_attendance?: boolean
          asthma_inhaler_info?: string | null
          bald_eagle_active?: boolean
          child_boxing_program: Database["public"]["Enums"]["boxing_program"]
          child_date_of_birth: string
          child_first_name: string
          child_grade_level?: number | null
          child_headshot_url?: string | null
          child_last_name: string
          child_phone?: string | null
          child_primary_address: string
          child_race_ethnicity: Database["public"]["Enums"]["child_race_ethnicity"]
          child_school_district: Database["public"]["Enums"]["school_district"]
          child_sex: Database["public"]["Enums"]["child_sex"]
          counseling_services_name?: string | null
          counseling_services_signature_url?: string | null
          created_at?: string
          custom_fields_data?: Json | null
          extended_program?: string | null
          final_signature_name?: string | null
          free_or_reduced_lunch?:
            | Database["public"]["Enums"]["lunch_status"]
            | null
          household_income_range: Database["public"]["Enums"]["household_income"]
          id?: string
          important_child_notes?: string | null
          is_bald_eagle?: boolean
          liability_waiver_name: string
          liability_waiver_signature_url: string
          media_consent_name: string
          media_consent_signature_url: string
          medical_consent_name: string
          medical_consent_signature_url: string
          parent_email: string
          parent_first_name: string
          parent_last_name: string
          parent_phone: string
          siblings_in_household: number
          spiritual_development_policy_name: string
          spiritual_development_policy_signature_url: string
          submission_date?: string
          transportation_excursions_signature_url: string
          transportation_excursions_waiver_name: string
          updated_at?: string
        }
        Update: {
          adults_in_household?: number
          allergies?: string | null
          approved_for_attendance?: boolean
          asthma_inhaler_info?: string | null
          bald_eagle_active?: boolean
          child_boxing_program?: Database["public"]["Enums"]["boxing_program"]
          child_date_of_birth?: string
          child_first_name?: string
          child_grade_level?: number | null
          child_headshot_url?: string | null
          child_last_name?: string
          child_phone?: string | null
          child_primary_address?: string
          child_race_ethnicity?: Database["public"]["Enums"]["child_race_ethnicity"]
          child_school_district?: Database["public"]["Enums"]["school_district"]
          child_sex?: Database["public"]["Enums"]["child_sex"]
          counseling_services_name?: string | null
          counseling_services_signature_url?: string | null
          created_at?: string
          custom_fields_data?: Json | null
          extended_program?: string | null
          final_signature_name?: string | null
          free_or_reduced_lunch?:
            | Database["public"]["Enums"]["lunch_status"]
            | null
          household_income_range?: Database["public"]["Enums"]["household_income"]
          id?: string
          important_child_notes?: string | null
          is_bald_eagle?: boolean
          liability_waiver_name?: string
          liability_waiver_signature_url?: string
          media_consent_name?: string
          media_consent_signature_url?: string
          medical_consent_name?: string
          medical_consent_signature_url?: string
          parent_email?: string
          parent_first_name?: string
          parent_last_name?: string
          parent_phone?: string
          siblings_in_household?: number
          spiritual_development_policy_name?: string
          spiritual_development_policy_signature_url?: string
          submission_date?: string
          transportation_excursions_signature_url?: string
          transportation_excursions_waiver_name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_registration_approval: {
        Args: { _approved: boolean; _registration_id: string }
        Returns: {
          adults_in_household: number
          allergies: string | null
          approved_for_attendance: boolean
          asthma_inhaler_info: string | null
          bald_eagle_active: boolean
          child_boxing_program: Database["public"]["Enums"]["boxing_program"]
          child_date_of_birth: string
          child_first_name: string
          child_grade_level: number | null
          child_headshot_url: string | null
          child_last_name: string
          child_phone: string | null
          child_primary_address: string
          child_race_ethnicity: Database["public"]["Enums"]["child_race_ethnicity"]
          child_school_district: Database["public"]["Enums"]["school_district"]
          child_sex: Database["public"]["Enums"]["child_sex"]
          counseling_services_name: string | null
          counseling_services_signature_url: string | null
          created_at: string
          custom_fields_data: Json | null
          extended_program: string | null
          final_signature_name: string | null
          free_or_reduced_lunch:
            | Database["public"]["Enums"]["lunch_status"]
            | null
          household_income_range: Database["public"]["Enums"]["household_income"]
          id: string
          important_child_notes: string | null
          is_bald_eagle: boolean
          liability_waiver_name: string
          liability_waiver_signature_url: string
          media_consent_name: string
          media_consent_signature_url: string
          medical_consent_name: string
          medical_consent_signature_url: string
          parent_email: string
          parent_first_name: string
          parent_last_name: string
          parent_phone: string
          siblings_in_household: number
          spiritual_development_policy_name: string
          spiritual_development_policy_signature_url: string
          submission_date: string
          transportation_excursions_signature_url: string
          transportation_excursions_waiver_name: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "youth_registrations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_today_checkin_count: { Args: never; Returns: number }
      get_today_lil_champs_count: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      search_kiosk_youth: {
        Args: { _search: string }
        Returns: {
          child_boxing_program: Database["public"]["Enums"]["boxing_program"]
          child_first_name: string
          child_headshot_url: string
          child_last_name: string
          id: string
        }[]
      }
      search_lil_champs_youth: {
        Args: { _search: string }
        Returns: {
          child_date_of_birth: string
          child_first_name: string
          child_headshot_url: string
          child_last_name: string
          id: string
        }[]
      }
      update_youth_headshot: {
        Args: { _headshot_url: string; _registration_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      bank_account: "Crest Savings" | "Other"
      boxing_program:
        | "Junior Boxing (Ages 7-10)"
        | "Senior Boxing (Ages 11-19)"
        | "Grit & Grace (Ages 11-19)"
      child_race_ethnicity:
        | "American Indian or Alaska Native"
        | "Asian"
        | "Black or African American"
        | "Hispanic or Latino"
        | "Native Hawaiian or Other Pacific Islander"
        | "White"
        | "Two or More Races"
      child_sex: "Male" | "Female"
      deposit_status: "Draft" | "Deposited"
      donation_method:
        | "Check"
        | "PayPal"
        | "Cash"
        | "Other"
        | "Venmo"
        | "Square"
      driver_status: "active" | "inactive"
      engagement_outcome: "Positive" | "Neutral" | "No Response"
      engagement_type:
        | "Call"
        | "Email"
        | "Text"
        | "Meeting"
        | "Event"
        | "Report Sent"
        | "Video Update Sent"
        | "Monthly Postcard"
      household_income:
        | "Under $25,000"
        | "$25,000 - $49,999"
        | "$50,000 - $74,999"
        | "$75,000 - $99,999"
        | "$100,000 - $149,999"
        | "$150,000 or more"
        | "Less than $25,000"
        | "Less than $35,000"
        | "Less than $45,000"
        | "Less than $65,000"
        | "Less than $80,000"
        | "Greater than $80,001"
      invoice_status: "draft" | "sent" | "paid"
      lunch_status: "Yes" | "No" | "Not Applicable"
      pickup_zone: "Woodbine" | "Wildwood"
      priority_layer: "Core" | "Bonus"
      rate_type:
        | "per_day"
        | "per_session"
        | "per_hour"
        | "flat_monthly"
        | "sponsorship"
        | "other_service"
      receipt_status: "Pending" | "Sent" | "Not Needed"
      revenue_type: "Donation" | "Fundraising" | "Fee for Service" | "Re-Grant"
      route_name: "Woodbine" | "Wildwood" | "Both"
      run_status: "in_progress" | "completed"
      run_type: "pickup" | "dropoff"
      school_district:
        | "Cape May City"
        | "Lower Cape May Regional"
        | "Middle Township"
        | "Ocean City"
        | "Upper Township"
        | "Wildwood"
        | "Wildwood Crest"
        | "North Wildwood"
        | "West Cape May"
        | "Dennis Township"
        | "Woodbine"
        | "Other"
        | "Lower Township"
        | "Cape May Tech"
        | "Avalon/Stone Harbor"
        | "Wildwood Catholic Academy"
        | "Homeschool, Hybrid, or Alternative Form of Schooling"
        | "Cape May/West Cape May"
        | "Wildwood/Wildwood Crest/North Wildwood"
      signal_kind: "Outcome" | "Action"
      signal_pillar:
        | "Operations"
        | "Sales & Marketing"
        | "Finance"
        | "Vision"
        | "Personal"
      signal_status: "Pending" | "Complete"
      task_status: "Open" | "Completed"
      task_type:
        | "Call"
        | "Proposal"
        | "Thank You"
        | "Renewal"
        | "Report Deadline"
        | "Follow-Up"
      transport_attendance_status:
        | "present"
        | "no_show"
        | "picked_up"
        | "dropped_off"
      youth_transport_status: "active" | "inactive"
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
      bank_account: ["Crest Savings", "Other"],
      boxing_program: [
        "Junior Boxing (Ages 7-10)",
        "Senior Boxing (Ages 11-19)",
        "Grit & Grace (Ages 11-19)",
      ],
      child_race_ethnicity: [
        "American Indian or Alaska Native",
        "Asian",
        "Black or African American",
        "Hispanic or Latino",
        "Native Hawaiian or Other Pacific Islander",
        "White",
        "Two or More Races",
      ],
      child_sex: ["Male", "Female"],
      deposit_status: ["Draft", "Deposited"],
      donation_method: ["Check", "PayPal", "Cash", "Other", "Venmo", "Square"],
      driver_status: ["active", "inactive"],
      engagement_outcome: ["Positive", "Neutral", "No Response"],
      engagement_type: [
        "Call",
        "Email",
        "Text",
        "Meeting",
        "Event",
        "Report Sent",
        "Video Update Sent",
        "Monthly Postcard",
      ],
      household_income: [
        "Under $25,000",
        "$25,000 - $49,999",
        "$50,000 - $74,999",
        "$75,000 - $99,999",
        "$100,000 - $149,999",
        "$150,000 or more",
        "Less than $25,000",
        "Less than $35,000",
        "Less than $45,000",
        "Less than $65,000",
        "Less than $80,000",
        "Greater than $80,001",
      ],
      invoice_status: ["draft", "sent", "paid"],
      lunch_status: ["Yes", "No", "Not Applicable"],
      pickup_zone: ["Woodbine", "Wildwood"],
      priority_layer: ["Core", "Bonus"],
      rate_type: [
        "per_day",
        "per_session",
        "per_hour",
        "flat_monthly",
        "sponsorship",
        "other_service",
      ],
      receipt_status: ["Pending", "Sent", "Not Needed"],
      revenue_type: ["Donation", "Fundraising", "Fee for Service", "Re-Grant"],
      route_name: ["Woodbine", "Wildwood", "Both"],
      run_status: ["in_progress", "completed"],
      run_type: ["pickup", "dropoff"],
      school_district: [
        "Cape May City",
        "Lower Cape May Regional",
        "Middle Township",
        "Ocean City",
        "Upper Township",
        "Wildwood",
        "Wildwood Crest",
        "North Wildwood",
        "West Cape May",
        "Dennis Township",
        "Woodbine",
        "Other",
        "Lower Township",
        "Cape May Tech",
        "Avalon/Stone Harbor",
        "Wildwood Catholic Academy",
        "Homeschool, Hybrid, or Alternative Form of Schooling",
        "Cape May/West Cape May",
        "Wildwood/Wildwood Crest/North Wildwood",
      ],
      signal_kind: ["Outcome", "Action"],
      signal_pillar: [
        "Operations",
        "Sales & Marketing",
        "Finance",
        "Vision",
        "Personal",
      ],
      signal_status: ["Pending", "Complete"],
      task_status: ["Open", "Completed"],
      task_type: [
        "Call",
        "Proposal",
        "Thank You",
        "Renewal",
        "Report Deadline",
        "Follow-Up",
      ],
      transport_attendance_status: [
        "present",
        "no_show",
        "picked_up",
        "dropped_off",
      ],
      youth_transport_status: ["active", "inactive"],
    },
  },
} as const
