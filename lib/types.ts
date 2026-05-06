// ─── Database Row Types ──────────────────────────────────────────────
// Matches PostgreSQL schema in supabase/migrations/20260506190000_init.sql

export interface Brand {
  brand_id: string;
  name_cn: string;
  name_en: string;
  first_year: number | null;
  organizer: string;
  co_organizer: string;
  city: string;
  frequency: string;
  industry_l1: string;
  industry_l2: string;
  competition_relation: string;
  mds_related: string;
  scale_score: number | null;
  is_international: number;
  is_ufi_certified: number;
  ma_potential: number | null;
  strategic_relevance: number | null;
  competitor_group: string;
  website: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Edition {
  edition_id: string;
  brand_id: string;
  edition_num: number | null;
  year: number | null;
  date_start: string | null;
  date_end: string | null;
  city: string;
  venue: string;
  status: string;
  area_sqm: number | null;
  exhibitors_count: number | null;
  visitors_count: number | null;
  overseas_exhibitor_pct: number | null;
  booth_price_per_sqm: number | null;
  heat_score: number | null;
  yoy_trend: string;
  anomaly_flag: number;
  data_source: string;
  recorded_at: string;
  notes: string;
}

export interface DataProvenance {
  record_id: string;
  brand_id: string | null;
  source_site: "jufair" | "cnexpo" | "manual";
  source_url: string;
  raw_payload: string;
  crawled_at: string;
  crawl_batch_id: string;
  notes: string;
}

export interface CrawlLog {
  id: number;
  batch_id: string;
  source_site: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "failed" | "partial";
  total_fetched: number;
  total_inserted: number;
  total_skipped: number;
  error_message: string;
  created_at: string;
}

export interface ManualTagHistory {
  id: number;
  brand_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_at: string;
  reason: string;
}

// ─── API Response Types ──────────────────────────────────────────────

export interface KpiData {
  total_area: number;
  total_exhibitors: number;
  total_visitors: number;
  total_organizers: number;
}

export interface IndustryDistribution {
  name: string;
  value: number;
}

export interface DashboardResponse {
  kpis: KpiData;
  brands: Brand[];
  industryDistribution: IndustryDistribution[];
}

export interface ApiError {
  error: string;
  details?: string;
}

// ─── Tag Update Types ────────────────────────────────────────────────

export interface TagUpdateRequest {
  competition_relation?: string;
  mds_related?: string;
  strategic_relevance?: number;
  ma_potential?: number;
  competitor_group?: string;
  industry_l1?: string;
  industry_l2?: string;
  notes?: string;
}

export const TAG_FIELDS = [
  "competition_relation",
  "mds_related",
  "strategic_relevance",
  "ma_potential",
  "competitor_group",
  "industry_l1",
  "industry_l2",
  "notes",
] as const;

// ─── Supabase Type Helpers ────────────────────────────────────────────
// Required by @supabase/supabase-js GenericTable constraint.
// Not exported by the package, so defined locally.

interface TableRelationship {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
}

// ─── Database Type (for use with supabase.from<"table">()) ───────────

export type Database = {
  public: {
    Tables: {
      exhibition_brand: {
        Row: Brand;
        Insert: Omit<Brand, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Brand, "brand_id">>;
        Relationships: TableRelationship[];
      };
      exhibition_edition: {
        Row: Edition;
        Insert: Omit<Edition, "recorded_at"> & { recorded_at?: string };
        Update: Partial<Omit<Edition, "edition_id">>;
        Relationships: TableRelationship[];
      };
      data_provenance: {
        Row: DataProvenance;
        Insert: Omit<DataProvenance, "crawled_at"> & { crawled_at?: string };
        Update: Partial<Omit<DataProvenance, "record_id">>;
        Relationships: TableRelationship[];
      };
      crawl_log: {
        Row: CrawlLog;
        Insert: Omit<CrawlLog, "id" | "created_at"> & {
          id?: number;
          created_at?: string;
        };
        Update: Partial<Omit<CrawlLog, "id">>;
        Relationships: TableRelationship[];
      };
      manual_tag_history: {
        Row: ManualTagHistory;
        Insert: Omit<ManualTagHistory, "id" | "changed_at"> & {
          id?: number;
          changed_at?: string;
        };
        Update: Partial<Omit<ManualTagHistory, "id">>;
        Relationships: TableRelationship[];
      };
    };
    Views: {};
    Functions: {};
  };
};
