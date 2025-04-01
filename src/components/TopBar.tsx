
import React, { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import GeminiStatusBadge from './GeminiStatusBadge';
import ProgressBar from './ProgressBar';
import { useMessageProcessing } from '@/contexts/MessageProcessingContext';
import { ProcessingProgress } from '@/types/processingTypes';

interface TopBarProps {
  onMenuToggle: () => void;
  className?: string;
}

const TopBar: React.FC<TopBarProps> = ({ onMenuToggle, className }) => {
  const { registerGlobalListener, activeTask } = useMessageProcessing();
  const [currentTask, setCurrentTask] = useState<ProcessingProgress | null>(null);

  useEffect(() => {
    // Register global listener to update progress bar
    const unsubscribe = registerGlobalListener((progress) => {
      setCurrentTask(progress);
    });
    
    // Also sync with activeTask from context
    if (activeTask) {
      setCurrentTask(activeTask);
    }
    
    return unsubscribe;
  }, [registerGlobalListener, activeTask]);

  // Calculate progress bar status
  const getProgressStatus = () => {
    if (!currentTask) return 'idle';
    
    if (currentTask.status === 'error') return 'error';
    if (currentTask.stage === 'completed') return 'complete';
    
    return 'loading';
  };

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (!currentTask) return 0;
    return currentTask.progress;
  };

  return (
    <>
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
      
      {/* Progress indicator that shows AI processing status */}
      <ProgressBar 
        progress={getProgressPercentage()}
        status={getProgressStatus()}
      />
    </>
  );
};

export default TopBar;
