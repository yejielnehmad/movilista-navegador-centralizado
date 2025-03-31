
import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Users, Brain, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const menuItems = [
  { 
    label: 'Catálogo de Productos', 
    icon: <Package className="h-6 w-6" />, 
    path: '/products',
    description: 'Gestiona tus productos en la nube.'
  },
  { 
    label: 'Clientes', 
    icon: <Users className="h-6 w-6" />, 
    path: '/clients',
    description: 'Administra tus clientes de forma centralizada.'
  },
  { 
    label: 'Generar Pedidos con IA', 
    icon: <Brain className="h-6 w-6" />, 
    path: '/ai-orders',
    description: 'Utiliza IA para generar pedidos de forma inteligente.'
  },
  { 
    label: 'Ver Pedidos', 
    icon: <ClipboardList className="h-6 w-6" />, 
    path: '/orders',
    description: 'Visualiza y gestiona todos tus pedidos.'
  },
];

const Index: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="text-center pt-8 pb-6">
        <h1 className="text-3xl font-bold">Bienvenido al Navegador Centralizado</h1>
        <p className="text-gray-500 mt-2">
          Gestiona tus productos, clientes y pedidos desde cualquier dispositivo
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {menuItems.map((item) => (
          <Link to={item.path} key={item.path}>
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xl">{item.label}</CardTitle>
                <div className="text-primary">{item.icon}</div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">{item.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Index;
