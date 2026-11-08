// Kiểu CSDL viết tay theo dạng `supabase gen types typescript` (không có CLI ở môi
// trường này). Giữ khớp với supabase/migrations/*.sql khi đổi lược đồ.
// bigint/numeric được PostgREST trả về dạng number; timestamptz dạng chuỗi ISO.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: { id: string; name: string; sort_order: number; slug: string | null; image_url: string | null }
        Insert: { id?: string; name: string; sort_order?: number; slug?: string | null; image_url?: string | null }
        Update: { id?: string; name?: string; sort_order?: number; slug?: string | null; image_url?: string | null }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          sku: string
          name: string
          unit: string
          category_id: string
          list_price: number
          image_url: string | null
          in_stock: boolean
          is_active: boolean
          description: string | null
          updated_price_at: string
          brand: string | null
          short_desc: string | null
          composition: string | null
          benefits: string | null
          usage: string | null
          crops: string[]
          is_featured: boolean
        }
        Insert: {
          id?: string
          sku: string
          name: string
          unit: string
          category_id: string
          list_price: number
          image_url?: string | null
          in_stock?: boolean
          is_active?: boolean
          description?: string | null
          updated_price_at?: string
          brand?: string | null
          short_desc?: string | null
          composition?: string | null
          benefits?: string | null
          usage?: string | null
          crops?: string[]
          is_featured?: boolean
        }
        Update: {
          id?: string
          sku?: string
          name?: string
          unit?: string
          category_id?: string
          list_price?: number
          image_url?: string | null
          in_stock?: boolean
          is_active?: boolean
          description?: string | null
          updated_price_at?: string
          brand?: string | null
          short_desc?: string | null
          composition?: string | null
          benefits?: string | null
          usage?: string | null
          crops?: string[]
          is_featured?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
        ]
      }
      promotions: {
        Row: {
          id: string
          name: string
          scope: 'product' | 'category'
          target_id: string
          type: 'percent' | 'fixed_price'
          value: number
          starts_at: string
          ends_at: string
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          scope: 'product' | 'category'
          target_id: string
          type: 'percent' | 'fixed_price'
          value: number
          starts_at: string
          ends_at: string
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          scope?: 'product' | 'category'
          target_id?: string
          type?: 'percent' | 'fixed_price'
          value?: number
          starts_at?: string
          ends_at?: string
          is_active?: boolean
        }
        Relationships: []
      }
      partner_tiers: {
        Row: { id: string; name: string; kind: 'commission' | 'wholesale' }
        Insert: { id?: string; name: string; kind: 'commission' | 'wholesale' }
        Update: { id?: string; name?: string; kind?: 'commission' | 'wholesale' }
        Relationships: []
      }
      tier_rates: {
        Row: { tier_id: string; category_id: string; rate_pct: number }
        Insert: { tier_id: string; category_id: string; rate_pct: number }
        Update: { tier_id?: string; category_id?: string; rate_pct?: number }
        Relationships: [
          {
            foreignKeyName: 'tier_rates_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tier_rates_tier_id_fkey'
            columns: ['tier_id']
            isOneToOne: false
            referencedRelation: 'partner_tiers'
            referencedColumns: ['id']
          },
        ]
      }
      tier_product_rates: {
        Row: { tier_id: string; product_id: string; rate_pct: number }
        Insert: { tier_id: string; product_id: string; rate_pct: number }
        Update: { tier_id?: string; product_id?: string; rate_pct?: number }
        Relationships: [
          {
            foreignKeyName: 'tier_product_rates_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tier_product_rates_tier_id_fkey'
            columns: ['tier_id']
            isOneToOne: false
            referencedRelation: 'partner_tiers'
            referencedColumns: ['id']
          },
        ]
      }
      partners: {
        Row: {
          id: string
          user_id: string
          phone: string
          name: string
          region: string | null
          delivery_address: string | null
          tier_id: string | null
          status: 'pending' | 'active' | 'locked'
          created_at: string
          bank_name: string | null
          bank_account: string | null
          bank_holder: string | null
          is_demo: boolean
        }
        Insert: {
          id?: string
          user_id: string
          phone: string
          name: string
          region?: string | null
          delivery_address?: string | null
          tier_id?: string | null
          status?: 'pending' | 'active' | 'locked'
          created_at?: string
          bank_name?: string | null
          bank_account?: string | null
          bank_holder?: string | null
          is_demo?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          phone?: string
          name?: string
          region?: string | null
          delivery_address?: string | null
          tier_id?: string | null
          status?: 'pending' | 'active' | 'locked'
          created_at?: string
          bank_name?: string | null
          bank_account?: string | null
          bank_holder?: string | null
          is_demo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'partners_tier_id_fkey'
            columns: ['tier_id']
            isOneToOne: false
            referencedRelation: 'partner_tiers'
            referencedColumns: ['id']
          },
        ]
      }
      staff: {
        Row: { user_id: string; role: 'admin' | 'staff' }
        Insert: { user_id: string; role: 'admin' | 'staff' }
        Update: { user_id?: string; role?: 'admin' | 'staff' }
        Relationships: []
      }
      farmers: {
        Row: {
          id: string
          phone: string
          name: string
          address: string | null
          owner_partner_id: string | null
          created_at: string
          is_demo: boolean
        }
        Insert: {
          id?: string
          phone: string
          name: string
          address?: string | null
          owner_partner_id?: string | null
          created_at?: string
          is_demo?: boolean
        }
        Update: {
          id?: string
          phone?: string
          name?: string
          address?: string | null
          owner_partner_id?: string | null
          created_at?: string
          is_demo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'farmers_owner_partner_id_fkey'
            columns: ['owner_partner_id']
            isOneToOne: false
            referencedRelation: 'partners'
            referencedColumns: ['id']
          },
        ]
      }
      farmer_transfer_log: {
        Row: {
          id: number
          farmer_id: string
          from_partner_id: string | null
          to_partner_id: string | null
          changed_by: string | null
          changed_at: string
        }
        Insert: {
          id?: never
          farmer_id: string
          from_partner_id?: string | null
          to_partner_id?: string | null
          changed_by?: string | null
          changed_at?: string
        }
        Update: {
          id?: never
          farmer_id?: string
          from_partner_id?: string | null
          to_partner_id?: string | null
          changed_by?: string | null
          changed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'farmer_transfer_log_farmer_id_fkey'
            columns: ['farmer_id']
            isOneToOne: false
            referencedRelation: 'farmers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'farmer_transfer_log_from_partner_id_fkey'
            columns: ['from_partner_id']
            isOneToOne: false
            referencedRelation: 'partners'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'farmer_transfer_log_to_partner_id_fkey'
            columns: ['to_partner_id']
            isOneToOne: false
            referencedRelation: 'partners'
            referencedColumns: ['id']
          },
        ]
      }
      orders: {
        Row: {
          id: string
          code: string
          client_key: string | null
          client_ip: string | null
          source: 'partner' | 'retail'
          partner_id: string | null
          status: Database['public']['Enums']['order_status']
          delivery_address: string | null
          payment_method: 'cod' | 'transfer'
          retail_name: string | null
          retail_phone: string | null
          retail_address: string | null
          note: string | null
          subtotal: number
          partner_payable: number | null
          commission_expected: number
          total_qty: number
          created_at: string
          is_demo: boolean
        }
        Insert: {
          id?: string
          code: string
          client_key?: string | null
          client_ip?: string | null
          source: 'partner' | 'retail'
          partner_id?: string | null
          status?: Database['public']['Enums']['order_status']
          delivery_address?: string | null
          payment_method?: 'cod' | 'transfer'
          retail_name?: string | null
          retail_phone?: string | null
          retail_address?: string | null
          note?: string | null
          subtotal?: number
          partner_payable?: number | null
          commission_expected?: number
          total_qty?: number
          created_at?: string
          is_demo?: boolean
        }
        Update: {
          id?: string
          code?: string
          client_key?: string | null
          client_ip?: string | null
          source?: 'partner' | 'retail'
          partner_id?: string | null
          status?: Database['public']['Enums']['order_status']
          delivery_address?: string | null
          payment_method?: 'cod' | 'transfer'
          retail_name?: string | null
          retail_phone?: string | null
          retail_address?: string | null
          note?: string | null
          subtotal?: number
          partner_payable?: number | null
          commission_expected?: number
          total_qty?: number
          created_at?: string
          is_demo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'orders_partner_id_fkey'
            columns: ['partner_id']
            isOneToOne: false
            referencedRelation: 'partners'
            referencedColumns: ['id']
          },
        ]
      }
      order_lines: {
        Row: {
          id: string
          order_id: string
          farmer_id: string | null
          product_id: string
          qty: number
          list_price_snap: number
          sale_price_snap: number
          promotion_id_snap: string | null
          rate_pct_snap: number
          line_total: number
          line_commission: number
          line_partner_price: number | null
        }
        Insert: {
          id?: string
          order_id: string
          farmer_id?: string | null
          product_id: string
          qty: number
          list_price_snap: number
          sale_price_snap: number
          promotion_id_snap?: string | null
          rate_pct_snap?: number
          line_total: number
          line_commission?: number
          line_partner_price?: number | null
        }
        Update: {
          id?: string
          order_id?: string
          farmer_id?: string | null
          product_id?: string
          qty?: number
          list_price_snap?: number
          sale_price_snap?: number
          promotion_id_snap?: string | null
          rate_pct_snap?: number
          line_total?: number
          line_commission?: number
          line_partner_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'order_lines_farmer_id_fkey'
            columns: ['farmer_id']
            isOneToOne: false
            referencedRelation: 'farmers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_lines_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_lines_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      order_status_log: {
        Row: {
          id: number
          order_id: string
          from_status: Database['public']['Enums']['order_status'] | null
          to_status: Database['public']['Enums']['order_status']
          changed_by: string | null
          changed_at: string
          note: string | null
        }
        Insert: {
          id?: never
          order_id: string
          from_status?: Database['public']['Enums']['order_status'] | null
          to_status: Database['public']['Enums']['order_status']
          changed_by?: string | null
          changed_at?: string
          note?: string | null
        }
        Update: {
          id?: never
          order_id?: string
          from_status?: Database['public']['Enums']['order_status'] | null
          to_status?: Database['public']['Enums']['order_status']
          changed_by?: string | null
          changed_at?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'order_status_log_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
        ]
      }
      order_counters: {
        Row: { period: string; last: number }
        Insert: { period: string; last?: number }
        Update: { period?: string; last?: number }
        Relationships: []
      }
      commission_entries: {
        Row: {
          id: string
          partner_id: string
          order_id: string
          kind: 'earn' | 'reversal'
          amount: number
          period: string
          status: 'pending' | 'paid'
          created_at: string
          paid_at: string | null
        }
        Insert: {
          id?: string
          partner_id: string
          order_id: string
          kind: 'earn' | 'reversal'
          amount: number
          period: string
          status?: 'pending' | 'paid'
          created_at?: string
          paid_at?: string | null
        }
        Update: {
          id?: string
          partner_id?: string
          order_id?: string
          kind?: 'earn' | 'reversal'
          amount?: number
          period?: string
          status?: 'pending' | 'paid'
          created_at?: string
          paid_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'commission_entries_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'commission_entries_partner_id_fkey'
            columns: ['partner_id']
            isOneToOne: false
            referencedRelation: 'partners'
            referencedColumns: ['id']
          },
        ]
      }
      payout_batches: {
        Row: {
          id: string
          kind: 'weekly' | 'monthly' | 'custom'
          cutoff_date: string
          note: string | null
          is_demo: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          kind: 'weekly' | 'monthly' | 'custom'
          cutoff_date: string
          note?: string | null
          is_demo?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          kind?: 'weekly' | 'monthly' | 'custom'
          cutoff_date?: string
          note?: string | null
          is_demo?: boolean
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      payouts: {
        Row: {
          id: string
          partner_id: string
          amount: number
          source: 'request' | 'batch' | 'legacy'
          batch_id: string | null
          status: 'requested' | 'approved' | 'paid' | 'rejected'
          bank_name: string | null
          bank_account: string | null
          bank_holder: string | null
          transfer_ref: string | null
          transferred_on: string | null
          proof_path: string | null
          reject_reason: string | null
          requested_at: string
          decided_by: string | null
          decided_at: string | null
          paid_by: string | null
          paid_at: string | null
          is_demo: boolean
        }
        Insert: {
          id?: string
          partner_id: string
          amount: number
          source: 'request' | 'batch' | 'legacy'
          batch_id?: string | null
          status: 'requested' | 'approved' | 'paid' | 'rejected'
          bank_name?: string | null
          bank_account?: string | null
          bank_holder?: string | null
          transfer_ref?: string | null
          transferred_on?: string | null
          proof_path?: string | null
          reject_reason?: string | null
          requested_at?: string
          decided_by?: string | null
          decided_at?: string | null
          paid_by?: string | null
          paid_at?: string | null
          is_demo?: boolean
        }
        Update: {
          id?: string
          partner_id?: string
          amount?: number
          source?: 'request' | 'batch' | 'legacy'
          batch_id?: string | null
          status?: 'requested' | 'approved' | 'paid' | 'rejected'
          bank_name?: string | null
          bank_account?: string | null
          bank_holder?: string | null
          transfer_ref?: string | null
          transferred_on?: string | null
          proof_path?: string | null
          reject_reason?: string | null
          requested_at?: string
          decided_by?: string | null
          decided_at?: string | null
          paid_by?: string | null
          paid_at?: string | null
          is_demo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'payouts_partner_id_fkey'
            columns: ['partner_id']
            isOneToOne: false
            referencedRelation: 'partners'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payouts_batch_id_fkey'
            columns: ['batch_id']
            isOneToOne: false
            referencedRelation: 'payout_batches'
            referencedColumns: ['id']
          },
        ]
      }
      settings: {
        Row: { key: string; value: Json }
        Insert: { key: string; value: Json }
        Update: { key?: string; value?: Json }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      // RPC ghi (0003_functions.sql) — chỉ service_role được execute.
      create_order: {
        // p_order: source, partner_id, client_key, client_ip, delivery_address, payment_method,
        // retail_name, retail_phone, retail_address, note, subtotal, partner_payable,
        // commission_expected, actor (auth user id, tùy chọn), is_demo (boolean, 0007). p_lines: mảng dòng theo cột order_lines.
        Args: { p_order: Json; p_lines: Json }
        Returns: { id: string; code: string }[]
      }
      change_order_status: {
        Args: {
          p_order_id: string
          p_to: Database['public']['Enums']['order_status']
          p_actor: string | null
          p_actor_kind: 'partner' | 'staff'
          p_note: string | null
        }
        Returns: undefined
      }
      replace_order_lines: {
        // p_totals: subtotal, partner_payable, commission_expected
        Args: {
          p_order_id: string
          p_lines: Json
          p_totals: Json
          p_actor: string | null
          p_actor_kind: 'partner' | 'staff'
        }
        Returns: undefined
      }
      claim_farmer: {
        Args: { p_partner_id: string; p_phone: string; p_name: string; p_address: string | null }
        // { status: 'ok', farmer_id } | { status: 'owned_by_other' }
        Returns: Json
      }
      delete_demo_data: {
        // 0007: xóa dữ liệu thử trong một giao dịch. { payouts, payout_batches, orders, farmers, partners, user_ids }
        Args: Record<string, never>
        Returns: Json
      }
      transfer_farmer: {
        Args: { p_farmer_id: string; p_to_partner: string | null; p_actor: string | null }
        Returns: undefined
      }
      retail_recent_count: {
        Args: { p_phone: string; p_ip: string }
        Returns: number
      }
      // Ví / chi trả (0006_payouts.sql) — chỉ service_role. Lỗi nghiệp vụ là mã trong error.message.
      partner_wallet: {
        Args: { p_partner_id: string }
        Returns: { earned: number; pending_out: number; paid: number; available: number }[]
      }
      request_payout: {
        // not_active | not_commission | missing_bank | below_min | insufficient_balance | partner_not_found
        Args: { p_partner_id: string; p_amount: number; p_min: number }
        Returns: string
      }
      decide_payout: {
        // invalid_state | reason_required | invalid_action | payout_not_found
        Args: { p_payout_id: string; p_action: 'approve' | 'reject'; p_actor: string | null; p_reason: string | null }
        Returns: undefined
      }
      mark_payout_paid: {
        // invalid_state | ref_required | invalid_date | payout_not_found; đã paid → false (không đổi gì), vừa đổi → true
        Args: {
          p_payout_id: string
          p_actor: string | null
          p_ref: string
          p_date: string
          p_proof_path: string | null
        }
        Returns: boolean
      }
      create_payout_batch: {
        Args: {
          p_kind: 'weekly' | 'monthly' | 'custom'
          p_cutoff: string
          p_min: number
          p_actor: string | null
          p_note: string | null
          p_is_demo?: boolean
        }
        // { batch_id, created, skipped_no_bank, skipped_below_min }
        Returns: Json
      }
      current_partner_id: { Args: never; Returns: string }
      current_tier_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      order_status: 'new' | 'confirmed' | 'shipping' | 'delivered' | 'paid' | 'cancelled' | 'returned'
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
