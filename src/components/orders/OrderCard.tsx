
import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, AlertTriangle, X, Edit, CheckCircle2 } from 'lucide-react';
import { OrderItem } from '@/types/orders';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductWithVariants, ProductVariant } from '@/services/productService';

interface OrderCardProps {
  item: OrderItem;
  allProducts: ProductWithVariants[];
  onUpdate: (updatedItem: OrderItem) => void;
  onRemove: () => void;
  onConfirm: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ 
  item, 
  allProducts, 
  onUpdate, 
  onRemove,
  onConfirm
}) => {
  const [isEditing, setIsEditing] = useState(false);
  
  const handleVariantChange = (variantId: string) => {
    if (!item.productMatch) return;
    
    const selectedVariant = (item.productMatch.variants as ProductVariant[]).find(v => v.id === variantId);
    if (selectedVariant) {
      onUpdate({
        ...item,
        variantMatch: selectedVariant,
        variantDescription: selectedVariant.name,
        issues: item.issues.filter(issue => !issue.includes('variant')),
        status: 'valid'
      });
    }
  };
  
  const handleProductChange = (productId: string) => {
    const selectedProduct = allProducts.find(p => p.id === productId);
    if (selectedProduct) {
      onUpdate({
        ...item,
        productMatch: selectedProduct,
        productName: selectedProduct.name,
        variantMatch: null,
        issues: [
          ...item.issues.filter(issue => !issue.includes('Product')),
          'Please select a variant'
        ],
        status: 'warning'
      });
    }
  };
  
  return (
    <Card className={`mb-4 shadow-sm border-l-4 ${
      item.status === 'valid' 
        ? 'border-l-green-500' 
        : item.status === 'warning'
          ? 'border-l-yellow-500' 
          : 'border-l-red-500'
    }`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-medium flex items-center">
            {item.clientMatch ? (
              <span className="font-semibold">{item.clientMatch.name}</span>
            ) : (
              <span className="font-semibold text-red-500">{item.clientName}</span>
            )}
            
            {item.status === 'valid' && (
              <CheckCircle2 className="ml-2 h-4 w-4 text-green-500" />
            )}
            {item.status === 'warning' && (
              <AlertTriangle className="ml-2 h-4 w-4 text-yellow-500" />
            )}
            {item.status === 'error' && (
              <X className="ml-2 h-4 w-4 text-red-500" />
            )}
          </CardTitle>
          
          {item.clientMatch?.phone && (
            <p className="text-xs text-muted-foreground mt-1">
              Tel: {item.clientMatch.phone}
            </p>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setIsEditing(!isEditing)}
        >
          <Edit className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
      </CardHeader>
      
      <CardContent className="py-2">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Product</label>
              <Select
                value={item.productMatch?.id || ''}
                onValueChange={handleProductChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {allProducts.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {item.productMatch && (
              <div>
                <label className="text-sm font-medium mb-1 block">Variant</label>
                <Select
                  value={item.variantMatch?.id || ''}
                  onValueChange={handleVariantChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a variant" />
                  </SelectTrigger>
                  <SelectContent>
                    {(item.productMatch.variants as ProductVariant[]).map(variant => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.name} - ${variant.price.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-start">
              <div>
                {item.productMatch ? (
                  <p className="font-medium">{item.productMatch.name}</p>
                ) : (
                  <p className="font-medium text-red-500">{item.productName || 'No product specified'}</p>
                )}
                
                {item.variantMatch ? (
                  <div className="mt-1 flex items-center">
                    <Badge variant="outline" className="text-xs bg-primary/10">
                      {item.variantMatch.name}
                    </Badge>
                    <span className="text-sm ml-2 text-muted-foreground">
                      ${item.variantMatch.price.toFixed(2)}
                    </span>
                  </div>
                ) : item.productMatch ? (
                  <Select
                    value=""
                    onValueChange={handleVariantChange}
                  >
                    <SelectTrigger className="w-full h-8 text-xs mt-1">
                      <SelectValue placeholder="Select a variant" />
                    </SelectTrigger>
                    <SelectContent>
                      {(item.productMatch.variants as ProductVariant[]).map(variant => (
                        <SelectItem key={variant.id} value={variant.id} className="text-xs">
                          {variant.name} - ${variant.price.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-red-500 mt-1">
                    {item.variantDescription || 'No variant specified'}
                  </p>
                )}
              </div>
              
              <div className="text-lg font-bold">
                {item.quantity}×
              </div>
            </div>
            
            {item.issues.length > 0 && (
              <div className="mt-2 text-xs border-t pt-2">
                {item.issues.map((issue, index) => (
                  <div key={index} className={`flex items-center ${
                    issue.includes('not found') 
                      ? 'text-red-500' 
                      : 'text-yellow-500'
                  }`}>
                    <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-2 pb-3 flex justify-end gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={onRemove}
          className="h-8 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          <X className="h-3 w-3 mr-1" />
          Remove
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onConfirm}
          disabled={item.status === 'error' || !item.variantMatch}
          className={`h-8 px-2 text-xs ${
            item.status === 'valid' 
              ? 'text-green-600 hover:bg-green-50' 
              : ''
          }`}
        >
          <Check className="h-3 w-3 mr-1" />
          Confirm
        </Button>
      </CardFooter>
    </Card>
  );
};

export default OrderCard;
