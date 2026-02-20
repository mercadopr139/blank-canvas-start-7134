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
      invoices: {
        Row: {
          client_id: string
          created_at: string
          due_date: string | null
          email_note: string | null
          id: string
          invoice_month: number
          invoice_number: string
          invoice_year: number
          issue_date: string | null
          notes: string | null
          sent_at: string | null
          sent_to: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          total: number | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date?: string | null
          email_note?: string | null
          id?: string
          invoice_month: number
          invoice_number: string
          invoice_year: number
          issue_date?: string | null
          notes?: string | null
          sent_at?: string | null
          sent_to?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string | null
          email_note?: string | null
          id?: string
          invoice_month?: number
          invoice_number?: string
          invoice_year?: number
          issue_date?: string | null
          notes?: string | null
          sent_at?: string | null
          sent_to?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          total?: number | null
          updated_at?: string
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
      supporters: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_hall_of_fame: boolean
          name: string
          phone: string | null
          receipt_2026_last_sent_to: string | null
          receipt_2026_pdf_url: string | null
          receipt_2026_sent_at: string | null
          receipt_2026_status: string
          story: string | null
          supporter_type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_hall_of_fame?: boolean
          name: string
          phone?: string | null
          receipt_2026_last_sent_to?: string | null
          receipt_2026_pdf_url?: string | null
          receipt_2026_sent_at?: string | null
          receipt_2026_status?: string
          story?: string | null
          supporter_type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_hall_of_fame?: boolean
          name?: string
          phone?: string | null
          receipt_2026_last_sent_to?: string | null
          receipt_2026_pdf_url?: string | null
          receipt_2026_sent_at?: string | null
          receipt_2026_status?: string
          story?: string | null
          supporter_type?: string
          updated_at?: string
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
      youth_registrations: {
        Row: {
          adults_in_household: number
          allergies: string | null
          asthma_inhaler_info: string | null
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
          final_signature_name: string | null
          free_or_reduced_lunch:
            | Database["public"]["Enums"]["lunch_status"]
            | null
          household_income_range: Database["public"]["Enums"]["household_income"]
          id: string
          important_child_notes: string | null
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
          asthma_inhaler_info?: string | null
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
          final_signature_name?: string | null
          free_or_reduced_lunch?:
            | Database["public"]["Enums"]["lunch_status"]
            | null
          household_income_range: Database["public"]["Enums"]["household_income"]
          id?: string
          important_child_notes?: string | null
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
          asthma_inhaler_info?: string | null
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
          final_signature_name?: string | null
          free_or_reduced_lunch?:
            | Database["public"]["Enums"]["lunch_status"]
            | null
          household_income_range?: Database["public"]["Enums"]["household_income"]
          id?: string
          important_child_notes?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      household_income:
        | "Under $25,000"
        | "$25,000 - $49,999"
        | "$50,000 - $74,999"
        | "$75,000 - $99,999"
        | "$100,000 - $149,999"
        | "$150,000 or more"
      invoice_status: "draft" | "sent" | "paid"
      lunch_status: "Yes" | "No" | "Not Applicable"
      rate_type:
        | "per_day"
        | "per_session"
        | "per_hour"
        | "flat_monthly"
        | "sponsorship"
        | "other_service"
      receipt_status: "Pending" | "Sent" | "Not Needed"
      revenue_type: "Donation" | "Fundraising" | "Fee for Service" | "Re-Grant"
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
      household_income: [
        "Under $25,000",
        "$25,000 - $49,999",
        "$50,000 - $74,999",
        "$75,000 - $99,999",
        "$100,000 - $149,999",
        "$150,000 or more",
      ],
      invoice_status: ["draft", "sent", "paid"],
      lunch_status: ["Yes", "No", "Not Applicable"],
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
      ],
    },
  },
} as const
