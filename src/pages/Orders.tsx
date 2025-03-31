
import React from 'react';

const Orders: React.FC = () => {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pedidos</h1>
      <p className="text-gray-500">
        Aquí se mostrarán los pedidos generados y sincronizados con Supabase.
      </p>
    </div>
  );
};

export default Orders;
