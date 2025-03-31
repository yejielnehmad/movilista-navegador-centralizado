
import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  ChevronUp, 
  Edit, 
  Trash2, 
  Plus, 
  PenLine,
  Tag
} from 'lucide-react';
import { type ProductWithVariants, type ProductVariant } from '@/services/productService';
import ProductVariantList from './ProductVariantList';
import ProductNameEdit from './ProductNameEdit';
import AddVariantForm from './AddVariantForm';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProductCardProps {
  product: ProductWithVariants;
  onProductUpdate: (id: string, name: string) => Promise<void>;
  onProductDelete: (id: string) => Promise<void>;
  onVariantAdd: (productId: string, variant: Omit<ProductVariant, 'id'>) => Promise<void>;
  onVariantUpdate: (productId: string, variantId: string, updates: Partial<Omit<ProductVariant, 'id'>>) => Promise<void>;
  onVariantRemove: (productId: string, variantId: string) => Promise<void>;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onProductUpdate,
  onProductDelete,
  onVariantAdd,
  onVariantUpdate,
  onVariantRemove
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingVariant, setIsAddingVariant] = useState(false);

  const handleEditName = (newName: string) => {
    onProductUpdate(product.id, newName);
    setIsEditing(false);
  };

  const handleAddVariant = async (variant: Omit<ProductVariant, 'id'>) => {
    await onVariantAdd(product.id, variant);
    setIsAddingVariant(false);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card className="mb-4 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-2">
            {isEditing ? (
              <ProductNameEdit 
                initialName={product.name} 
                onSave={handleEditName} 
                onCancel={() => setIsEditing(false)} 
              />
            ) : (
              <CardTitle className="text-xl flex items-center">
                <Tag className="h-5 w-5 mr-2 text-primary" />
                {product.name}
              </CardTitle>
            )}
          </div>
          <div className="flex gap-2">
            {!isEditing && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsEditing(true)} 
                className="h-8 w-8"
              >
                <PenLine className="h-4 w-4" />
                <span className="sr-only">Edit product name</span>
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete product</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the product "{product.name}" and all its variants.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onProductDelete(product.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleExpand} 
              className="h-8 w-8"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span className="sr-only">
                {isExpanded ? 'Collapse' : 'Expand'}
              </span>
            </Button>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <>
          <CardContent className="pt-0">
            {isAddingVariant ? (
              <AddVariantForm 
                onSave={handleAddVariant} 
                onCancel={() => setIsAddingVariant(false)} 
              />
            ) : (
              <ProductVariantList 
                variants={product.variants} 
                onVariantUpdate={(variantId, updates) => 
                  onVariantUpdate(product.id, variantId, updates)
                }
                onVariantRemove={(variantId) => 
                  onVariantRemove(product.id, variantId)
                }
              />
            )}
          </CardContent>
          <CardFooter className="flex justify-between pt-0">
            {!isAddingVariant && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsAddingVariant(true)}
                className="ml-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Variant
              </Button>
            )}
          </CardFooter>
        </>
      )}
    </Card>
  );
};

export default ProductCard;
