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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      certificate_batches: {
        Row: {
          created_at: string
          created_by: string
          csv_file_url: string | null
          generated_count: number
          id: string
          name: string
          organization_id: string
          status: string
          template_id: string
          total_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          csv_file_url?: string | null
          generated_count?: number
          id?: string
          name: string
          organization_id: string
          status?: string
          template_id: string
          total_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          csv_file_url?: string | null
          generated_count?: number
          id?: string
          name?: string
          organization_id?: string
          status?: string
          template_id?: string
          total_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_batches_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_verifications: {
        Row: {
          certificate_id: string
          id: string
          ip_address: string | null
          user_agent: string | null
          verified_at: string
        }
        Insert: {
          certificate_id: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          verified_at?: string
        }
        Update: {
          certificate_id?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_verifications_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          issued_at: string
          organization_id: string
          pdf_url: string | null
          qr_code_url: string | null
          recipient_data: Json
          recipient_email: string | null
          recipient_name: string
          revoked_at: string | null
          serial_number: string
          status: string
          template_id: string
          updated_at: string
          verification_token: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          issued_at?: string
          organization_id: string
          pdf_url?: string | null
          qr_code_url?: string | null
          recipient_data?: Json
          recipient_email?: string | null
          recipient_name: string
          revoked_at?: string | null
          serial_number: string
          status?: string
          template_id: string
          updated_at?: string
          verification_token?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          issued_at?: string
          organization_id?: string
          pdf_url?: string | null
          qr_code_url?: string | null
          recipient_data?: Json
          recipient_email?: string | null
          recipient_name?: string
          revoked_at?: string | null
          serial_number?: string
          status?: string
          template_id?: string
          updated_at?: string
          verification_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "certificate_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      template_fields: {
        Row: {
          created_at: string
          field_key: string
          font_color: string
          font_family: string
          font_size: number
          id: string
          label: string
          max_width: number | null
          sort_order: number
          template_id: string
          text_align: string
          x_position: number
          y_position: number
        }
        Insert: {
          created_at?: string
          field_key: string
          font_color?: string
          font_family?: string
          font_size?: number
          id?: string
          label: string
          max_width?: number | null
          sort_order?: number
          template_id: string
          text_align?: string
          x_position?: number
          y_position?: number
        }
        Update: {
          created_at?: string
          field_key?: string
          font_color?: string
          font_family?: string
          font_size?: number
          id?: string
          label?: string
          max_width?: number | null
          sort_order?: number
          template_id?: string
          text_align?: string
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          background_url: string | null
          created_at: string
          created_by: string
          height_px: number
          id: string
          logo_url: string | null
          logo_x: number
          logo_y: number
          name: string
          organization_id: string
          seal_url: string | null
          seal_x: number
          seal_y: number
          signature_url: string | null
          signature_x: number
          signature_y: number
          updated_at: string
          verification_fields: string[]
          width_px: number
        }
        Insert: {
          background_url?: string | null
          created_at?: string
          created_by: string
          height_px?: number
          id?: string
          logo_url?: string | null
          logo_x?: number
          logo_y?: number
          name: string
          organization_id: string
          seal_url?: string | null
          seal_x?: number
          seal_y?: number
          signature_url?: string | null
          signature_x?: number
          signature_y?: number
          updated_at?: string
          verification_fields?: string[]
          width_px?: number
        }
        Update: {
          background_url?: string | null
          created_at?: string
          created_by?: string
          height_px?: number
          id?: string
          logo_url?: string | null
          logo_x?: number
          logo_y?: number
          name?: string
          organization_id?: string
          seal_url?: string | null
          seal_x?: number
          seal_y?: number
          signature_url?: string | null
          signature_x?: number
          signature_y?: number
          updated_at?: string
          verification_fields?: string[]
          width_px?: number
        }
        Relationships: [
          {
            foreignKeyName: "templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_user_organization: {
        Args: { _name: string; _owner_id: string; _slug: string }
        Returns: string
      }
      get_org_branding_for_certificate: {
        Args: { _cert_id: string }
        Returns: {
          org_logo_url: string
          org_name: string
          verification_fields: string[]
        }[]
      }
      get_org_name_for_certificate: {
        Args: { _cert_id: string }
        Returns: string
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      verify_certificate_by_token: {
        Args: { _token: string }
        Returns: {
          id: string
          issued_at: string
          organization_id: string
          recipient_data: Json
          recipient_name: string
          serial_number: string
          status: string
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
