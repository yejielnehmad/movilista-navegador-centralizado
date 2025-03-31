
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { type ProductVariant } from '@/services/productService';

interface AddVariantFormProps {
  onSave: (variant: Omit<ProductVariant, 'id'>) => void;
  onCancel: () => void;
}

const AddVariantForm: React.FC<AddVariantFormProps> = ({
  onSave,
  onCancel
}) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Variant name is required');
      return;
    }

    const priceValue = Number(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      setError('Price must be a positive number');
      return;
    }

    onSave({
      name: name.trim(),
      price: priceValue
    });
  };

  return (
    <div className="border rounded-md p-4 my-2">
      <h3 className="text-sm font-medium mb-2">Add New Variant</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Variant Name"
            autoFocus
          />
        </div>
        <div>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price"
          />
        </div>
        {error && <div className="text-sm text-red-500">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button type="submit" size="sm">
            <Check className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddVariantForm;
