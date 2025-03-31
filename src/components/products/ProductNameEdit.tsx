
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';

interface ProductNameEditProps {
  initialName: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

const ProductNameEdit: React.FC<ProductNameEditProps> = ({
  initialName,
  onSave,
  onCancel
}) => {
  const [name, setName] = useState(initialName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Product Name"
        autoFocus
        className="flex-1"
      />
      <div className="flex gap-1">
        <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-green-600">
          <Check className="h-4 w-4" />
          <span className="sr-only">Save</span>
        </Button>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} className="h-8 w-8 text-red-600">
          <X className="h-4 w-4" />
          <span className="sr-only">Cancel</span>
        </Button>
      </div>
    </form>
  );
};

export default ProductNameEdit;
