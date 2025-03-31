
import React from 'react';

const Products: React.FC = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Catálogo de Productos</h1>
      <p className="text-gray-500">
        Aquí se mostrarán los productos sincronizados con Supabase.
      </p>
    </div>
  );
};

export default Products;
