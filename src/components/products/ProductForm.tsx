
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

interface ProductFormProps {
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Product name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(name.trim());
      setName('');
    } catch (err) {
      console.error('Error saving product:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border rounded-md p-4 mb-4 bg-card">
      <h3 className="text-lg font-medium mb-3">Add New Product</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product Name"
            autoFocus
            disabled={isSubmitting}
          />
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;
