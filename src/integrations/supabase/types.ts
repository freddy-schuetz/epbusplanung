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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      busunternehmen: {
        Row: {
          aktiv: boolean | null
          ansprechpartner: string | null
          ansprechpartner_cc: string | null
          bemerkung: string | null
          bevorzugtes_format: string | null
          created_at: string | null
          email: string | null
          email_cc: string | null
          firma: string
          id: number
          kuerzel: string | null
          telefon: string | null
        }
        Insert: {
          aktiv?: boolean | null
          ansprechpartner?: string | null
          ansprechpartner_cc?: string | null
          bemerkung?: string | null
          bevorzugtes_format?: string | null
          created_at?: string | null
          email?: string | null
          email_cc?: string | null
          firma: string
          id?: number
          kuerzel?: string | null
          telefon?: string | null
        }
        Update: {
          aktiv?: boolean | null
          ansprechpartner?: string | null
          ansprechpartner_cc?: string | null
          bemerkung?: string | null
          bevorzugtes_format?: string | null
          created_at?: string | null
          email?: string | null
          email_cc?: string | null
          firma?: string
          id?: number
          kuerzel?: string | null
          telefon?: string | null
        }
        Relationships: []
      }
      haltestellen: {
        Row: {
          anhang: string | null
          created_at: string | null
          haltestellen_code: string | null
          hausnummer: string | null
          id: number
          kommentar: string | null
          land: string | null
          name: string | null
          ort: string | null
          plz: number | null
          sportclub_kuerzel: string
          strasse: string | null
        }
        Insert: {
          anhang?: string | null
          created_at?: string | null
          haltestellen_code?: string | null
          hausnummer?: string | null
          id?: number
          kommentar?: string | null
          land?: string | null
          name?: string | null
          ort?: string | null
          plz?: number | null
          sportclub_kuerzel: string
          strasse?: string | null
        }
        Update: {
          anhang?: string | null
          created_at?: string | null
          haltestellen_code?: string | null
          hausnummer?: string | null
          id?: number
          kommentar?: string | null
          land?: string | null
          name?: string | null
          ort?: string | null
          plz?: number | null
          sportclub_kuerzel?: string
          strasse?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "haltestellen_sportclub_kuerzel_fkey"
            columns: ["sportclub_kuerzel"]
            isOneToOne: false
            referencedRelation: "sportclubs"
            referencedColumns: ["kuerzel"]
          },
          {
            foreignKeyName: "haltestellen_sportclub_kuerzel_fkey"
            columns: ["sportclub_kuerzel"]
            isOneToOne: false
            referencedRelation: "v_sportclubs_mit_hotels"
            referencedColumns: ["kuerzel"]
          },
        ]
      }
      hotels: {
        Row: {
          aktiv: boolean | null
          created_at: string | null
          email: string | null
          entfernung_info: string | null
          hausnummer: string | null
          id: number
          kuerzel: string | null
          kurzname: string | null
          land: string | null
          name: string
          ort: string | null
          parkplatz_info: string | null
          plz: string | null
          strasse: string | null
          telefon: string | null
        }
        Insert: {
          aktiv?: boolean | null
          created_at?: string | null
          email?: string | null
          entfernung_info?: string | null
          hausnummer?: string | null
          id?: number
          kuerzel?: string | null
          kurzname?: string | null
          land?: string | null
          name: string
          ort?: string | null
          parkplatz_info?: string | null
          plz?: string | null
          strasse?: string | null
          telefon?: string | null
        }
        Update: {
          aktiv?: boolean | null
          created_at?: string | null
          email?: string | null
          entfernung_info?: string | null
          hausnummer?: string | null
          id?: number
          kuerzel?: string | null
          kurzname?: string | null
          land?: string | null
          name?: string
          ort?: string | null
          parkplatz_info?: string | null
          plz?: string | null
          strasse?: string | null
          telefon?: string | null
        }
        Relationships: []
      }
      parkplaetze: {
        Row: {
          created_at: string | null
          hausnummer: string | null
          id: number
          kommentar: string | null
          land: string | null
          name: string | null
          ort: string | null
          parkplatz_code: string
          plz: number | null
          strasse: string | null
        }
        Insert: {
          created_at?: string | null
          hausnummer?: string | null
          id?: number
          kommentar?: string | null
          land?: string | null
          name?: string | null
          ort?: string | null
          parkplatz_code: string
          plz?: number | null
          strasse?: string | null
        }
        Update: {
          created_at?: string | null
          hausnummer?: string | null
          id?: number
          kommentar?: string | null
          land?: string | null
          name?: string | null
          ort?: string | null
          parkplatz_code?: string
          plz?: number | null
          strasse?: string | null
        }
        Relationships: []
      }
      sportclub_hotels: {
        Row: {
          bemerkung: string | null
          hotel_id: number | null
          id: number
          prioritaet: number | null
          sportclub_kuerzel: string | null
        }
        Insert: {
          bemerkung?: string | null
          hotel_id?: number | null
          id?: number
          prioritaet?: number | null
          sportclub_kuerzel?: string | null
        }
        Update: {
          bemerkung?: string | null
          hotel_id?: number | null
          id?: number
          prioritaet?: number | null
          sportclub_kuerzel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sportclub_hotels_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sportclub_hotels_sportclub_kuerzel_fkey"
            columns: ["sportclub_kuerzel"]
            isOneToOne: false
            referencedRelation: "sportclubs"
            referencedColumns: ["kuerzel"]
          },
          {
            foreignKeyName: "sportclub_hotels_sportclub_kuerzel_fkey"
            columns: ["sportclub_kuerzel"]
            isOneToOne: false
            referencedRelation: "v_sportclubs_mit_hotels"
            referencedColumns: ["kuerzel"]
          },
        ]
      }
      sportclub_parkplaetze: {
        Row: {
          created_at: string | null
          id: number
          parkplatz_code: string
          sportclub_kuerzel: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          parkplatz_code: string
          sportclub_kuerzel: string
        }
        Update: {
          created_at?: string | null
          id?: number
          parkplatz_code?: string
          sportclub_kuerzel?: string
        }
        Relationships: [
          {
            foreignKeyName: "sportclub_parkplaetze_parkplatz_code_fkey"
            columns: ["parkplatz_code"]
            isOneToOne: false
            referencedRelation: "parkplaetze"
            referencedColumns: ["parkplatz_code"]
          },
          {
            foreignKeyName: "sportclub_parkplaetze_sportclub_kuerzel_fkey"
            columns: ["sportclub_kuerzel"]
            isOneToOne: false
            referencedRelation: "sportclubs"
            referencedColumns: ["kuerzel"]
          },
          {
            foreignKeyName: "sportclub_parkplaetze_sportclub_kuerzel_fkey"
            columns: ["sportclub_kuerzel"]
            isOneToOne: false
            referencedRelation: "v_sportclubs_mit_hotels"
            referencedColumns: ["kuerzel"]
          },
        ]
      }
      sportclubs: {
        Row: {
          adresse: string | null
          aktiv: boolean | null
          anmelde_info: string | null
          created_at: string | null
          fahrer_zimmer_info: string | null
          fahrer_zimmer_verfuegbar: boolean | null
          kuerzel: string
          land: string | null
          name: string
          notfall_telefon: string | null
          ort: string | null
          parkplatz_info: string | null
          plz: string | null
          telefon: string | null
          typ: string | null
          updated_at: string | null
        }
        Insert: {
          adresse?: string | null
          aktiv?: boolean | null
          anmelde_info?: string | null
          created_at?: string | null
          fahrer_zimmer_info?: string | null
          fahrer_zimmer_verfuegbar?: boolean | null
          kuerzel: string
          land?: string | null
          name: string
          notfall_telefon?: string | null
          ort?: string | null
          parkplatz_info?: string | null
          plz?: string | null
          telefon?: string | null
          typ?: string | null
          updated_at?: string | null
        }
        Update: {
          adresse?: string | null
          aktiv?: boolean | null
          anmelde_info?: string | null
          created_at?: string | null
          fahrer_zimmer_info?: string | null
          fahrer_zimmer_verfuegbar?: boolean | null
          kuerzel?: string
          land?: string | null
          name?: string
          notfall_telefon?: string | null
          ort?: string | null
          parkplatz_info?: string | null
          plz?: string | null
          telefon?: string | null
          typ?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      standard_texte: {
        Row: {
          aktiv: boolean | null
          created_at: string | null
          kategorie: string | null
          schluessel: string
          text: string
        }
        Insert: {
          aktiv?: boolean | null
          created_at?: string | null
          kategorie?: string | null
          schluessel: string
          text: string
        }
        Update: {
          aktiv?: boolean | null
          created_at?: string | null
          kategorie?: string | null
          schluessel?: string
          text?: string
        }
        Relationships: []
      }
    }
    Views: {
      sportclub_parkplaetze_details: {
        Row: {
          hausnummer: string | null
          kommentar: string | null
          land: string | null
          ort: string | null
          parkplatz_code: string | null
          parkplatz_name: string | null
          plz: number | null
          sportclub_kuerzel: string | null
          strasse: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sportclub_parkplaetze_parkplatz_code_fkey"
            columns: ["parkplatz_code"]
            isOneToOne: false
            referencedRelation: "parkplaetze"
            referencedColumns: ["parkplatz_code"]
          },
          {
            foreignKeyName: "sportclub_parkplaetze_sportclub_kuerzel_fkey"
            columns: ["sportclub_kuerzel"]
            isOneToOne: false
            referencedRelation: "sportclubs"
            referencedColumns: ["kuerzel"]
          },
          {
            foreignKeyName: "sportclub_parkplaetze_sportclub_kuerzel_fkey"
            columns: ["sportclub_kuerzel"]
            isOneToOne: false
            referencedRelation: "v_sportclubs_mit_hotels"
            referencedColumns: ["kuerzel"]
          },
        ]
      }
      v_sportclubs_mit_hotels: {
        Row: {
          fahrer_zimmer_info: string | null
          hotel_name: string | null
          hotel_ort: string | null
          kuerzel: string | null
          parkplatz_info: string | null
          prioritaet: number | null
          sportclub_name: string | null
          sportclub_ort: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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
