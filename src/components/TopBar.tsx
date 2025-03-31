
import React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onMenuToggle: () => void;
  className?: string;
}

const TopBar: React.FC<TopBarProps> = ({ onMenuToggle, className }) => {
  return (
    <div className={cn("fixed top-0 left-0 right-0 h-14 bg-white shadow-sm flex items-center justify-between px-4 z-50", className)}>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold">Navegador Centralizado</h1>
      </div>
      <Button variant="ghost" size="icon" onClick={onMenuToggle} aria-label="Menú">
        <Menu className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default TopBar;
