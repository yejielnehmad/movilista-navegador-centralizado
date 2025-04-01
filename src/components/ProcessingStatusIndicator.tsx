
import React, { useEffect, useState } from 'react';
import { useMessageProcessing } from '@/contexts/MessageProcessingContext';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProcessingProgress, ProcessingStage } from '@/types/processingTypes';

const ProcessingStatusIndicator: React.FC = () => {
  const { registerGlobalListener } = useMessageProcessing();
  const [currentTask, setCurrentTask] = useState<ProcessingProgress | null>(null);
  
  useEffect(() => {
    const unsubscribe = registerGlobalListener((progress) => {
      setCurrentTask(progress);
    });
    
    return unsubscribe;
  }, [registerGlobalListener]);
  
  // If there's no task, or if the task is in one of these completed states, don't show the indicator
  if (!currentTask || 
      currentTask.stage === 'completed' || 
      currentTask.stage === 'failed') {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Badge variant="secondary" className="px-3 py-2 flex items-center gap-2">
        {currentTask.status === 'error' ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (currentTask.stage === 'completed') ? (
          <CheckCircle className="h-4 w-4 text-success" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        <span>
          {currentTask.stage === 'parsing' ? 'Analizando mensaje...' :
           currentTask.stage === 'analyzing' ? 'Detectando patrones...' : 
           currentTask.stage === 'ai_processing' ? 'Procesando con IA...' :
           currentTask.stage === 'validating' ? 'Validando resultados...' :
           currentTask.stage === 'grouping' ? 'Organizando resultados...' :
           'Procesando...'}
        </span>
        <span className="font-semibold">{currentTask.progress}%</span>
      </Badge>
    </div>
  );
};

export default ProcessingStatusIndicator;
