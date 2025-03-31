
import { Product, ProductVariant, ProductWithVariants } from "@/services/productService";
import type { Database } from "@/integrations/supabase/types";
import { Json } from "@/integrations/supabase/types";

export type Client = Database["public"]["Tables"]["clients"]["Row"];

// Define Order interface explicitly since it's not in the generated types yet
export interface Order {
  id: string;
  client_id: string;
  items: OrderItemData[];
  created_at: string;
  updated_at: string;
  clients?: Client; // For joined data
}

export interface OrderItemData {
  product_id?: string;
  product_name: string;
  variant_id?: string;
  variant_name: string;
  quantity: number;
}

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
