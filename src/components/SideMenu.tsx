
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Package, Users, Brain, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const menuItems = [
  { 
    label: 'Catálogo de Productos', 
    icon: <Package className="h-5 w-5 mr-3" />, 
    path: '/products' 
  },
  { 
    label: 'Clientes', 
    icon: <Users className="h-5 w-5 mr-3" />, 
    path: '/clients' 
  },
  { 
    label: 'Generar Pedidos con IA', 
    icon: <Brain className="h-5 w-5 mr-3" />, 
    path: '/ai-orders' 
  },
  { 
    label: 'Ver Pedidos', 
    icon: <ClipboardList className="h-5 w-5 mr-3" />, 
    path: '/orders' 
  },
];

const SideMenu: React.FC<SideMenuProps> = ({ isOpen, onClose, className }) => {
  const location = useLocation();

  return (
    <>
      {/* Overlay oscuro */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 transition-opacity duration-300"
          onClick={onClose}
        />
      )}
      
      {/* Menú lateral */}
      <div 
        className={cn(
          "fixed top-0 right-0 w-[280px] h-full bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
          className
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Menú</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar menú">
            <X className="h-6 w-6" />
          </Button>
        </div>
        
        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    "flex items-center py-3 px-4 rounded-md transition-colors",
                    location.pathname === item.path 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-secondary"
                  )}
                  onClick={onClose}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
};

export default SideMenu;
