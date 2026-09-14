export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      billing_cycles: {
        Row: {
          id: string;
          month: string;
          owner_id: string;
          property_id: string;
          status: Database["public"]["Enums"]["cycle_status"];
        };
        Insert: {
          id?: string;
          month: string;
          owner_id: string;
          property_id: string;
          status?: Database["public"]["Enums"]["cycle_status"];
        };
        Update: {
          id?: string;
          month?: string;
          owner_id?: string;
          property_id?: string;
          status?: Database["public"]["Enums"]["cycle_status"];
        };
        Relationships: [
          {
            foreignKeyName: "billing_cycles_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      charge_templates: {
        Row: {
          amount: number;
          id: string;
          label: string;
          owner_id: string;
          property_id: string;
        };
        Insert: {
          amount: number;
          id?: string;
          label: string;
          owner_id: string;
          property_id: string;
        };
        Update: {
          amount?: number;
          id?: string;
          label?: string;
          owner_id?: string;
          property_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "charge_templates_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_items: {
        Row: {
          amount: number | null;
          current_reading: number | null;
          id: string;
          invoice_id: string;
          kind: Database["public"]["Enums"]["charge_kind"];
          label: string;
          owner_id: string;
          position: number;
          previous_reading: number | null;
          quantity: number;
          rate: number;
        };
        Insert: {
          amount?: number | null;
          current_reading?: number | null;
          id?: string;
          invoice_id: string;
          kind: Database["public"]["Enums"]["charge_kind"];
          label: string;
          owner_id: string;
          position?: number;
          previous_reading?: number | null;
          quantity: number;
          rate: number;
        };
        Update: {
          amount?: number | null;
          current_reading?: number | null;
          id?: string;
          invoice_id?: string;
          kind?: Database["public"]["Enums"]["charge_kind"];
          label?: string;
          owner_id?: string;
          position?: number;
          previous_reading?: number | null;
          quantity?: number;
          rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          created_at: string;
          cycle_id: string;
          due_date: string;
          id: string;
          issued_at: string | null;
          month: string;
          owner_id: string;
          paid_at: string | null;
          paid_by: string | null;
          payment_info: string;
          payment_method: string | null;
          property_id: string;
          property_name: string;
          room_id: string;
          room_name: string;
          status: Database["public"]["Enums"]["invoice_status"];
          tenancy_id: string;
          tenant_name: string;
          token: string;
          token_expires_at: string;
          total: number;
        };
        Insert: {
          created_at?: string;
          cycle_id: string;
          due_date: string;
          id?: string;
          issued_at?: string | null;
          month: string;
          owner_id: string;
          paid_at?: string | null;
          paid_by?: string | null;
          payment_info: string;
          payment_method?: string | null;
          property_id: string;
          property_name: string;
          room_id: string;
          room_name: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          tenancy_id: string;
          tenant_name: string;
          token?: string;
          token_expires_at?: string;
          total?: number;
        };
        Update: {
          created_at?: string;
          cycle_id?: string;
          due_date?: string;
          id?: string;
          issued_at?: string | null;
          month?: string;
          owner_id?: string;
          paid_at?: string | null;
          paid_by?: string | null;
          payment_info?: string;
          payment_method?: string | null;
          property_id?: string;
          property_name?: string;
          room_id?: string;
          room_name?: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          tenancy_id?: string;
          tenant_name?: string;
          token?: string;
          token_expires_at?: string;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "billing_cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_tenancy_id_fkey";
            columns: ["tenancy_id"];
            isOneToOne: false;
            referencedRelation: "tenancies";
            referencedColumns: ["id"];
          },
        ];
      };
      meter_readings: {
        Row: {
          cycle_id: string;
          electric_current: number | null;
          electric_previous: number | null;
          id: string;
          owner_id: string;
          room_id: string;
          water_current: number | null;
          water_previous: number | null;
        };
        Insert: {
          cycle_id: string;
          electric_current?: number | null;
          electric_previous?: number | null;
          id?: string;
          owner_id: string;
          room_id: string;
          water_current?: number | null;
          water_previous?: number | null;
        };
        Update: {
          cycle_id?: string;
          electric_current?: number | null;
          electric_previous?: number | null;
          id?: string;
          owner_id?: string;
          room_id?: string;
          water_current?: number | null;
          water_previous?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "meter_readings_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "billing_cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "meter_readings_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_events: {
        Row: {
          actor_id: string | null;
          amount: number;
          created_at: string;
          event: string;
          id: string;
          invoice_id: string;
          note: string;
          owner_id: string;
        };
        Insert: {
          actor_id?: string | null;
          amount?: number;
          created_at?: string;
          event: string;
          id?: string;
          invoice_id: string;
          note?: string;
          owner_id: string;
        };
        Update: {
          actor_id?: string | null;
          amount?: number;
          created_at?: string;
          event?: string;
          id?: string;
          invoice_id?: string;
          note?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_events_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_submissions: {
        Row: {
          created_at: string;
          id: string;
          invoice_id: string;
          owner_id: string;
          path: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invoice_id: string;
          owner_id: string;
          path: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invoice_id?: string;
          owner_id?: string;
          path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_submissions_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          address: string;
          created_at: string;
          due_day: number;
          electric_rate: number;
          id: string;
          name: string;
          owner_id: string;
          payment_info: string;
          rent: number;
          water_method: Database["public"]["Enums"]["water_method"];
          water_rate: number;
        };
        Insert: {
          address?: string;
          created_at?: string;
          due_day?: number;
          electric_rate?: number;
          id?: string;
          name: string;
          owner_id: string;
          payment_info?: string;
          rent?: number;
          water_method?: Database["public"]["Enums"]["water_method"];
          water_rate?: number;
        };
        Update: {
          address?: string;
          created_at?: string;
          due_day?: number;
          electric_rate?: number;
          id?: string;
          name?: string;
          owner_id?: string;
          payment_info?: string;
          rent?: number;
          water_method?: Database["public"]["Enums"]["water_method"];
          water_rate?: number;
        };
        Relationships: [];
      };
      rooms: {
        Row: {
          electric_rate: number | null;
          floor: string;
          id: string;
          name: string;
          owner_id: string;
          property_id: string;
          rent: number | null;
          water_rate: number | null;
        };
        Insert: {
          electric_rate?: number | null;
          floor?: string;
          id?: string;
          name: string;
          owner_id: string;
          property_id: string;
          rent?: number | null;
          water_rate?: number | null;
        };
        Update: {
          electric_rate?: number | null;
          floor?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          property_id?: string;
          rent?: number | null;
          water_rate?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
      tenancies: {
        Row: {
          id: string;
          moved_in: string;
          moved_out: string | null;
          owner_id: string;
          room_id: string;
          tenant_id: string;
        };
        Insert: {
          id?: string;
          moved_in: string;
          moved_out?: string | null;
          owner_id: string;
          room_id: string;
          tenant_id: string;
        };
        Update: {
          id?: string;
          moved_in?: string;
          moved_out?: string | null;
          owner_id?: string;
          room_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenancies_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tenancies_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          phone: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          phone?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          phone?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      owner_command: { Args: { op: string; p: Json }; Returns: Json };
      submit_slip: {
        Args: { bill_token: string; object_path: string };
        Returns: boolean;
      };
    };
    Enums: {
      charge_kind: "rent" | "water" | "electric" | "other";
      cycle_status: "open" | "issued";
      invoice_status:
        | "draft"
        | "issued"
        | "slip_submitted"
        | "paid"
        | "overdue"
        | "void";
      water_method: "meter" | "flat";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      charge_kind: ["rent", "water", "electric", "other"],
      cycle_status: ["open", "issued"],
      invoice_status: [
        "draft",
        "issued",
        "slip_submitted",
        "paid",
        "overdue",
        "void",
      ],
      water_method: ["meter", "flat"],
    },
  },
} as const;
