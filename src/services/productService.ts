
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductVariant = {
  id: string;
  name: string;
  price: number;
};

export type ProductWithVariants = Product & {
  variants: ProductVariant[];
};

// Fetch all products
export const fetchProducts = async (): Promise<ProductWithVariants[]> => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching products:", error);
      toast.error("Error loading products");
      return [];
    }

    return data.map(product => ({
      ...product,
      variants: product.variants as unknown as ProductVariant[]
    }));
  } catch (error) {
    console.error("Error in fetchProducts:", error);
    toast.error("Failed to load products");
    return [];
  }
};

// Create a new product
export const createProduct = async (name: string): Promise<Product | null> => {
  try {
    const { data, error } = await supabase
      .from("products")
      .insert([{ name, variants: [] }])
      .select()
      .single();

    if (error) {
      console.error("Error creating product:", error);
      toast.error("Failed to create product");
      return null;
    }

    toast.success("Product created successfully");
    return data;
  } catch (error) {
    console.error("Error in createProduct:", error);
    toast.error("Failed to create product");
    return null;
  }
};

// Update a product
export const updateProduct = async (
  id: string,
  updates: Partial<Omit<Product, "id" | "created_at">>
): Promise<Product | null> => {
  try {
    const { data, error } = await supabase
      .from("products")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating product:", error);
      toast.error("Failed to update product");
      return null;
    }

    toast.success("Product updated successfully");
    return data;
  } catch (error) {
    console.error("Error in updateProduct:", error);
    toast.error("Failed to update product");
    return null;
  }
};

// Delete a product
export const deleteProduct = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error("Error deleting product:", error);
      toast.error("Failed to delete product");
      return false;
    }

    toast.success("Product deleted successfully");
    return true;
  } catch (error) {
    console.error("Error in deleteProduct:", error);
    toast.error("Failed to delete product");
    return false;
  }
};

// Add a variant to a product
export const addVariant = async (
  productId: string,
  newVariant: Omit<ProductVariant, "id">
): Promise<ProductWithVariants | null> => {
  try {
    // Fetch current product first
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (fetchError) {
      console.error("Error fetching product:", fetchError);
      toast.error("Failed to add variant");
      return null;
    }

    // Create a variant with a unique ID
    const variantWithId: ProductVariant = {
      id: crypto.randomUUID(),
      ...newVariant
    };

    // Add the new variant to the existing variants
    const currentVariants = (product.variants as unknown as ProductVariant[]) || [];
    const updatedVariants = [...currentVariants, variantWithId];

    // Update the product with the new variants array
    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({ 
        variants: updatedVariants,
        updated_at: new Date().toISOString()
      })
      .eq("id", productId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating product variants:", updateError);
      toast.error("Failed to add variant");
      return null;
    }

    toast.success("Variant added successfully");
    return {
      ...updatedProduct,
      variants: updatedProduct.variants as unknown as ProductVariant[]
    };
  } catch (error) {
    console.error("Error in addVariant:", error);
    toast.error("Failed to add variant");
    return null;
  }
};

// Update a variant
export const updateVariant = async (
  productId: string,
  variantId: string,
  updates: Partial<Omit<ProductVariant, "id">>
): Promise<ProductWithVariants | null> => {
  try {
    // Fetch current product first
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (fetchError) {
      console.error("Error fetching product:", fetchError);
      toast.error("Failed to update variant");
      return null;
    }

    // Update the specific variant
    const currentVariants = (product.variants as unknown as ProductVariant[]) || [];
    const updatedVariants = currentVariants.map(variant => 
      variant.id === variantId ? { ...variant, ...updates } : variant
    );

    // Update the product with the modified variants array
    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({ 
        variants: updatedVariants,
        updated_at: new Date().toISOString()
      })
      .eq("id", productId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating product variant:", updateError);
      toast.error("Failed to update variant");
      return null;
    }

    toast.success("Variant updated successfully");
    return {
      ...updatedProduct,
      variants: updatedProduct.variants as unknown as ProductVariant[]
    };
  } catch (error) {
    console.error("Error in updateVariant:", error);
    toast.error("Failed to update variant");
    return null;
  }
};

// Remove a variant from a product
export const removeVariant = async (
  productId: string,
  variantId: string
): Promise<ProductWithVariants | null> => {
  try {
    // Fetch current product first
    const { data: product, error: fetchError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (fetchError) {
      console.error("Error fetching product:", fetchError);
      toast.error("Failed to remove variant");
      return null;
    }

    // Filter out the variant to remove
    const currentVariants = (product.variants as unknown as ProductVariant[]) || [];
    const updatedVariants = currentVariants.filter(variant => variant.id !== variantId);

    // Update the product with the filtered variants array
    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({ 
        variants: updatedVariants,
        updated_at: new Date().toISOString()
      })
      .eq("id", productId)
      .select()
      .single();

    if (updateError) {
      console.error("Error removing product variant:", updateError);
      toast.error("Failed to remove variant");
      return null;
    }

    toast.success("Variant removed successfully");
    return {
      ...updatedProduct,
      variants: updatedProduct.variants as unknown as ProductVariant[]
    };
  } catch (error) {
    console.error("Error in removeVariant:", error);
    toast.error("Failed to remove variant");
    return null;
  }
};
