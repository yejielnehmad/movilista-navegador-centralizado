
import { Product, ProductVariant, ProductWithVariants } from "@/services/productService";
import type { Database } from "@/integrations/supabase/types";

export type Client = Database["public"]["Tables"]["clients"]["Row"];

export interface OrderItem {
  clientName: string;
  productName: string;
  variantDescription: string;
  quantity: number;
  clientMatch?: Client | null;
  productMatch?: ProductWithVariants | null;
  variantMatch?: ProductVariant | null;
  status: 'valid' | 'warning' | 'error';
  issues: string[];
}

export interface ProcessedOrder {
  rawText: string;
  items: OrderItem[];
}
