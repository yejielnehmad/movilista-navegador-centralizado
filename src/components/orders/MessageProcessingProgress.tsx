
import React from 'react';
import { ProcessingProgress, ProcessingStage } from '@/types/processingTypes';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertCircle, Check, Bot } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MessageProcessingProgressProps {
  progress: ProcessingProgress;
  minimal?: boolean;
}

const getStageLabel = (stage: ProcessingStage): string => {
  switch (stage) {
    case 'not_started': return 'Iniciando...';
    case 'parsing': return 'Analizando texto...';
    case 'analyzing': return 'Detectando patrones...';
    case 'ai_processing': return 'Mejorando con IA...';
    case 'validating': return 'Validando resultados...';
    case 'grouping': return 'Organizando resultados...';
    case 'completed': return 'Análisis completado';
    case 'failed': return 'Error en el análisis';
    default: return 'Procesando...';
  }
};

const getStageIcon = (stage: ProcessingStage, status: 'idle' | 'processing' | 'success' | 'error'): JSX.Element => {
  if (status === 'error') {
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  }
  
  if (stage === 'completed' && status === 'success') {
    return <Check className="h-4 w-4 text-green-500" />;
  }
  
  if (stage === 'ai_processing') {
    return <Bot className="h-4 w-4 text-primary" />;
  }
  
  return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
};

const MessageProcessingProgress: React.FC<MessageProcessingProgressProps> = ({ 
  progress,
  minimal = false
}) => {
  if (minimal) {
    return (
      <div className="w-full space-y-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            {getStageIcon(progress.stage, progress.status)}
            <span>{getStageLabel(progress.stage)}</span>
          </div>
          <span>{progress.progress}%</span>
        </div>
        <Progress value={progress.progress} className="h-1" />
      </div>
    );
  }
  
  return (
    <Card className="w-full border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Analizando mensaje</span>
          <Badge 
            variant={progress.status === 'error' ? 'destructive' : 
                   progress.status === 'success' && progress.stage === 'completed' ? 'success' : 'default'}
            className="text-xs"
          >
            {getStageLabel(progress.stage)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Progress value={progress.progress} className="h-2" />
          
          {progress.status === 'error' && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {progress.error || 'Ha ocurrido un error durante el análisis'}
            </div>
          )}
          
          <div className="text-xs text-muted-foreground line-clamp-2">
            <span className="font-medium">Mensaje:</span> {progress.message}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MessageProcessingProgress;
