
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';
import ProductCard from '@/components/products/ProductCard';
import ProductForm from '@/components/products/ProductForm';
import { supabase } from '@/lib/supabase';
import { 
  fetchProducts, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  addVariant,
  updateVariant,
  removeVariant,
  type ProductWithVariants,
  type ProductVariant
} from '@/services/productService';

const Products: React.FC = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();

  // Set up real-time listener for products
  useEffect(() => {
    const channel = supabase
      .channel('products-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products'
      }, () => {
        // Invalidate and refetch products when changes occur
        queryClient.invalidateQueries({ queryKey: ['products'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Query to fetch products
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts
  });

  // Mutation to create product
  const createProductMutation = useMutation({
    mutationFn: (name: string) => createProduct(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowAddForm(false);
    }
  });

  // Mutation to update product
  const updateProductMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => 
      updateProduct(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  // Mutation to delete product
  const deleteProductMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  // Mutation to add variant
  const addVariantMutation = useMutation({
    mutationFn: ({ productId, variant }: { productId: string; variant: Omit<ProductVariant, 'id'> }) => 
      addVariant(productId, variant),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  // Mutation to update variant
  const updateVariantMutation = useMutation({
    mutationFn: ({ productId, variantId, updates }: 
      { productId: string; variantId: string; updates: Partial<Omit<ProductVariant, 'id'>> }) => 
      updateVariant(productId, variantId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  // Mutation to remove variant
  const removeVariantMutation = useMutation({
    mutationFn: ({ productId, variantId }: { productId: string; variantId: string }) => 
      removeVariant(productId, variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  // Handlers
  const handleCreateProduct = async (name: string) => {
    await createProductMutation.mutateAsync(name);
  };

  const handleUpdateProduct = async (id: string, name: string) => {
    await updateProductMutation.mutateAsync({ id, name });
  };

  const handleDeleteProduct = async (id: string) => {
    await deleteProductMutation.mutateAsync(id);
  };

  const handleAddVariant = async (productId: string, variant: Omit<ProductVariant, 'id'>) => {
    await addVariantMutation.mutateAsync({ productId, variant });
  };

  const handleUpdateVariant = async (productId: string, variantId: string, updates: Partial<Omit<ProductVariant, 'id'>>) => {
    await updateVariantMutation.mutateAsync({ productId, variantId, updates });
  };

  const handleRemoveVariant = async (productId: string, variantId: string) => {
    await removeVariantMutation.mutateAsync({ productId, variantId });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catálogo de Productos</h1>
        {!showAddForm && (
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Agregar Producto
          </Button>
        )}
      </div>

      {showAddForm && (
        <ProductForm
          onSave={handleCreateProduct}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {productsQuery.isLoading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : productsQuery.isError ? (
        <div className="text-center py-8 text-destructive">
          Error loading products. Please try again later.
        </div>
      ) : productsQuery.data.length === 0 ? (
        <div className="text-center py-8 border rounded-md bg-muted/50">
          <p className="text-lg text-muted-foreground mb-4">
            No hay productos en el catálogo
          </p>
          {!showAddForm && (
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Primer Producto
            </Button>
          )}
        </div>
      ) : (
        <div>
          {productsQuery.data.map((product: ProductWithVariants) => (
            <ProductCard
              key={product.id}
              product={product}
              onProductUpdate={handleUpdateProduct}
              onProductDelete={handleDeleteProduct}
              onVariantAdd={handleAddVariant}
              onVariantUpdate={handleUpdateVariant}
              onVariantRemove={handleRemoveVariant}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Products;
