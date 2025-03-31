
import React from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import GeminiStatusBadge from './GeminiStatusBadge';

interface TopBarProps {
  onMenuToggle: () => void;
  className?: string;
}

const TopBar: React.FC<TopBarProps> = ({ onMenuToggle, className }) => {
  return (
    <div className={cn("fixed top-0 left-0 right-0 h-14 bg-white shadow-sm flex items-center justify-between px-4 z-50", className)}>
      <div className="flex items-center">
        <h1 className="text-lg font-semibold">VentasCom Mágico</h1>
      </div>
      <div className="flex items-center gap-3">
        <GeminiStatusBadge />
        <Button variant="ghost" size="icon" onClick={onMenuToggle} aria-label="Menú">
          <Menu className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
};

export default TopBar;
