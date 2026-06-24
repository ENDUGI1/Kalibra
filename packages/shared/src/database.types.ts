/**
 * Supabase row types for the Phase 0 schema (supabase/migrations/0001_init.sql).
 *
 * Hand-written to match the migration. When a live Supabase project exists, this
 * file can be regenerated with:
 *   supabase gen types typescript --project-id <id> --schema public
 */

export interface Database {
  public: {
    Tables: {
      markets: {
        Row: {
          id: string;
          market_id: string;
          source: string;
          source_ref: string | null;
          event_slug: string | null;
          home: string;
          away: string;
          league: string | null;
          kickoff: string | null;
          prob_market_bps: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          market_id: string;
          source?: string;
          source_ref?: string | null;
          event_slug?: string | null;
          home: string;
          away: string;
          league?: string | null;
          kickoff?: string | null;
          prob_market_bps?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["markets"]["Insert"]>;
      };
      predictions: {
        Row: {
          id: string;
          market_id: string;
          prob_bps: number;
          prob_market_bps: number;
          edge_bps: number;
          model_version: string;
          salt: string;
          prediction_hash: string;
          status: "pending" | "committed" | "revealed" | "skipped";
          commit_tx: string | null;
          committed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          market_id: string;
          prob_bps: number;
          prob_market_bps: number;
          edge_bps: number;
          model_version: string;
          salt: string;
          prediction_hash: string;
          status?: "pending" | "committed" | "revealed" | "skipped";
          commit_tx?: string | null;
          committed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["predictions"]["Insert"]>;
      };
      resolutions: {
        Row: {
          id: string;
          market_id: string;
          outcome: boolean;
          brier_bps: number;
          record_tx: string | null;
          resolved_at: string;
        };
        Insert: {
          id?: string;
          market_id: string;
          outcome: boolean;
          brier_bps: number;
          record_tx?: string | null;
          resolved_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["resolutions"]["Insert"]>;
      };
    };
    Views: {
      market_overview: {
        Row: {
          market_id: string;
          home: string;
          away: string;
          league: string | null;
          kickoff: string | null;
          prob_market_bps: number | null;
          prob_model_bps: number | null;
          edge_bps: number | null;
          commit_status: "pending" | "committed" | "revealed" | "skipped" | null;
          commit_tx: string | null;
          committed_at: string | null;
          model_version: string | null;
          outcome: boolean | null;
          brier_bps: number | null;
          resolved_at: string | null;
        };
      };
    };
  };
}
