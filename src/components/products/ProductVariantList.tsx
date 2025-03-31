
import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PenLine, Trash2, Check, X } from 'lucide-react';
import { type ProductVariant } from '@/services/productService';
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

interface ProductVariantListProps {
  variants: ProductVariant[];
  onVariantUpdate: (variantId: string, updates: Partial<Omit<ProductVariant, 'id'>>) => Promise<void>;
  onVariantRemove: (variantId: string) => Promise<void>;
}

const ProductVariantList: React.FC<ProductVariantListProps> = ({
  variants,
  onVariantUpdate,
  onVariantRemove
}) => {
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startEditing = (variant: ProductVariant) => {
    setEditingVariant(variant.id);
    setEditName(variant.name);
    setEditPrice(variant.price.toString());
    setError(null);
  };

  const cancelEditing = () => {
    setEditingVariant(null);
    setError(null);
  };

  const handleSave = async (variantId: string) => {
    setError(null);

    if (!editName.trim()) {
      setError('Variant name is required');
      return;
    }

    const priceValue = Number(editPrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      setError('Price must be a positive number');
      return;
    }

    await onVariantUpdate(variantId, {
      name: editName.trim(),
      price: priceValue
    });
    
    setEditingVariant(null);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(price);
  };

  if (variants.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No variants added yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Variant</TableHead>
            <TableHead>Price</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((variant) => (
            <TableRow key={variant.id}>
              <TableCell>
                {editingVariant === variant.id ? (
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    size={20}
                    autoFocus
                  />
                ) : (
                  variant.name
                )}
              </TableCell>
              <TableCell>
                {editingVariant === variant.id ? (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    size={10}
                  />
                ) : (
                  formatPrice(variant.price)
                )}
              </TableCell>
              <TableCell className="text-right">
                {editingVariant === variant.id ? (
                  <div className="flex justify-end items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleSave(variant.id)}
                      className="h-8 w-8 text-green-600"
                    >
                      <Check className="h-4 w-4" />
                      <span className="sr-only">Save</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={cancelEditing}
                      className="h-8 w-8 text-red-600"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Cancel</span>
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-end items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditing(variant)}
                      className="h-8 w-8"
                    >
                      <PenLine className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the variant "{variant.name}".
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onVariantRemove(variant.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
                {error && editingVariant === variant.id && (
                  <div className="text-sm text-red-500 mt-1">{error}</div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ProductVariantList;
