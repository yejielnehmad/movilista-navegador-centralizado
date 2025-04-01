
import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  progress: number; // 0 to 100
  status: 'idle' | 'loading' | 'complete' | 'error';
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress = 0, 
  status = 'idle',
  className 
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'loading':
        return 'bg-blue-500';
      case 'complete':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-300';
    }
  };

  return (
    <div className={cn("fixed top-14 left-0 right-0 h-1 bg-gray-200 z-40", className)}>
      <div 
        className={cn(
          "h-full transition-all duration-300 ease-in-out", 
          getStatusColor(),
          status === 'loading' && progress < 100 && 'animate-pulse'
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default ProgressBar;
