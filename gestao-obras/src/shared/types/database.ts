// Gerado a partir do banco Supabase (projeto gestao-obras). Não edite à mão:
// regenere depois de cada migração com o MCP do Supabase ou `supabase gen types`.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      auditoria: {
        Row: {
          acao: string
          antes: Json | null
          criado_em: string
          depois: Json | null
          id: number
          obra_id: string | null
          organizacao_id: string | null
          registro_id: string
          tabela: string
          user_id: string | null
        }
        Insert: {
          acao: string
          antes?: Json | null
          criado_em?: string
          depois?: Json | null
          id?: never
          obra_id?: string | null
          organizacao_id?: string | null
          registro_id: string
          tabela: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          antes?: Json | null
          criado_em?: string
          depois?: Json | null
          id?: never
          obra_id?: string | null
          organizacao_id?: string | null
          registro_id?: string
          tabela?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          atualizado_em: string
          criado_em: string
          criado_por: string | null
          documento: string | null
          email: string | null
          endereco: Json
          id: string
          nome: string
          observacoes: string | null
          organizacao_id: string
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          documento?: string | null
          email?: string | null
          endereco?: Json
          id?: string
          nome: string
          observacoes?: string | null
          organizacao_id: string
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          criado_por?: string | null
          documento?: string | null
          email?: string | null
          endereco?: Json
          id?: string
          nome?: string
          observacoes?: string | null
          organizacao_id?: string
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      convites: {
        Row: {
          aceito_em: string | null
          convidado_por: string
          criado_em: string
          email: string
          expira_em: string
          id: string
          organizacao_id: string
          papel: Database["public"]["Enums"]["papel_organizacao"]
          token: string
        }
        Insert: {
          aceito_em?: string | null
          convidado_por: string
          criado_em?: string
          email: string
          expira_em?: string
          id?: string
          organizacao_id: string
          papel?: Database["public"]["Enums"]["papel_organizacao"]
          token?: string
        }
        Update: {
          aceito_em?: string | null
          convidado_por?: string
          criado_em?: string
          email?: string
          expira_em?: string
          id?: string
          organizacao_id?: string
          papel?: Database["public"]["Enums"]["papel_organizacao"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_convidado_por_fkey"
            columns: ["convidado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_participantes: {
        Row: {
          adicionado_por: string | null
          criado_em: string
          obra_id: string
          papel: Database["public"]["Enums"]["papel_obra"]
          permissoes: Json
          user_id: string
        }
        Insert: {
          adicionado_por?: string | null
          criado_em?: string
          obra_id: string
          papel: Database["public"]["Enums"]["papel_obra"]
          permissoes?: Json
          user_id: string
        }
        Update: {
          adicionado_por?: string | null
          criado_em?: string
          obra_id?: string
          papel?: Database["public"]["Enums"]["papel_obra"]
          permissoes?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "obra_participantes_adicionado_por_fkey"
            columns: ["adicionado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_participantes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_participantes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          area_m2: number | null
          arquivada_em: string | null
          atualizado_em: string
          cliente_id: string | null
          codigo: string | null
          criado_em: string
          criado_por: string | null
          data_fim_prevista: string | null
          data_fim_real: string | null
          data_inicio_prevista: string | null
          data_inicio_real: string | null
          descricao: string | null
          endereco: Json
          id: string
          nome: string
          organizacao_id: string
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_obra"]
          valor_contratado: number | null
        }
        Insert: {
          area_m2?: number | null
          arquivada_em?: string | null
          atualizado_em?: string
          cliente_id?: string | null
          codigo?: string | null
          criado_em?: string
          criado_por?: string | null
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio_prevista?: string | null
          data_inicio_real?: string | null
          descricao?: string | null
          endereco?: Json
          id?: string
          nome: string
          organizacao_id: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_obra"]
          valor_contratado?: number | null
        }
        Update: {
          area_m2?: number | null
          arquivada_em?: string | null
          atualizado_em?: string
          cliente_id?: string | null
          codigo?: string | null
          criado_em?: string
          criado_por?: string | null
          data_fim_prevista?: string | null
          data_fim_real?: string | null
          data_inicio_prevista?: string | null
          data_inicio_real?: string | null
          descricao?: string | null
          endereco?: Json
          id?: string
          nome?: string
          organizacao_id?: string
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_obra"]
          valor_contratado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obras_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacao_membros: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          organizacao_id: string
          papel: Database["public"]["Enums"]["papel_organizacao"]
          user_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          organizacao_id: string
          papel?: Database["public"]["Enums"]["papel_organizacao"]
          user_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          organizacao_id?: string
          papel?: Database["public"]["Enums"]["papel_organizacao"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizacao_membros_organizacao_id_fkey"
            columns: ["organizacao_id"]
            isOneToOne: false
            referencedRelation: "organizacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizacao_membros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      organizacoes: {
        Row: {
          atualizado_em: string
          criado_em: string
          documento: string | null
          dono_id: string
          id: string
          logo_url: string | null
          nome: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          documento?: string | null
          dono_id: string
          id?: string
          logo_url?: string | null
          nome: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          documento?: string | null
          dono_id?: string
          id?: string
          logo_url?: string | null
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizacoes_dono_id_fkey"
            columns: ["dono_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          atualizado_em: string
          avatar_url: string | null
          criado_em: string
          id: string
          nome: string
          profissao: string | null
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string
          avatar_url?: string | null
          criado_em?: string
          id: string
          nome: string
          profissao?: string | null
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string
          avatar_url?: string | null
          criado_em?: string
          id?: string
          nome?: string
          profissao?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      papel_obra: "cliente" | "equipe"
      papel_organizacao:
        | "proprietario"
        | "administrador"
        | "engenheiro"
        | "mestre_obras"
        | "funcionario"
        | "prestador"
      status_obra:
        | "planejada"
        | "em_execucao"
        | "pausada"
        | "atrasada"
        | "concluida"
        | "cancelada"
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
      papel_obra: ["cliente", "equipe"],
      papel_organizacao: [
        "proprietario",
        "administrador",
        "engenheiro",
        "mestre_obras",
        "funcionario",
        "prestador",
      ],
      status_obra: [
        "planejada",
        "em_execucao",
        "pausada",
        "atrasada",
        "concluida",
        "cancelada",
      ],
    },
  },
} as const
