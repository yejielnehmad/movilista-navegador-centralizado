
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { OrderItem } from "@/types/orders";
import type { Database } from "@/integrations/supabase/types";

export type Order = Database["public"]["Tables"]["orders"]["Row"];

// Fetch all orders with client details
export const fetchOrders = async (): Promise<Order[]> => {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, clients(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
      toast.error("Error loading orders");
      return [];
    }

    return data;
  } catch (error) {
    console.error("Error in fetchOrders:", error);
    toast.error("Failed to load orders");
    return [];
  }
};

// Save a new order
export const saveOrder = async (
  clientId: string,
  items: OrderItem[]
): Promise<Order | null> => {
  try {
    // Format items for storage
    const formattedItems = items.map(item => ({
      product_id: item.productMatch?.id,
      product_name: item.productMatch?.name,
      variant_id: item.variantMatch?.id,
      variant_name: item.variantMatch?.name,
      quantity: item.quantity,
    }));

    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          client_id: clientId,
          items: formattedItems,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error saving order:", error);
      toast.error("Failed to save order");
      return null;
    }

    toast.success("Order saved successfully");
    return data;
  } catch (error) {
    console.error("Error in saveOrder:", error);
    toast.error("Failed to save order");
    return null;
  }
};

// Delete an order
export const deleteOrder = async (orderId: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from("orders").delete().eq("id", orderId);

    if (error) {
      console.error("Error deleting order:", error);
      toast.error("Failed to delete order");
      return false;
    }

    toast.success("Order deleted successfully");
    return true;
  } catch (error) {
    console.error("Error in deleteOrder:", error);
    toast.error("Failed to delete order");
    return false;
  }
};
