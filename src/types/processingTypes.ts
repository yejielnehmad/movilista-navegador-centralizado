
export type ProcessingStage = 
  | 'not_started'
  | 'parsing'
  | 'analyzing'
  | 'ai_processing'
  | 'validating'
  | 'grouping'
  | 'completed'
  | 'failed';

export type ProcessingStatus = 'pending' | 'success' | 'error';

export interface ProcessingProgress {
  id: string;
  stage: ProcessingStage;
  status: ProcessingStatus;
  progress: number;
  message: string;
  result?: any;
  error?: string;
  raw_response?: any;
}

export type ProgressListener = (progress: ProcessingProgress) => void;
