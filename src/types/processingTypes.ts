
import { OrderItem } from '@/types/orders';

// Process state types
export type ProcessingStage = 
  | 'not_started'
  | 'parsing'
  | 'fetching_data'
  | 'analyzing'
  | 'ai_processing'
  | 'validating'
  | 'completed'
  | 'failed';

export interface ProcessingProgress {
  id: string;
  message: string;
  stage: ProcessingStage;
  progress: number; // 0-100
  status: 'pending' | 'success' | 'error';
  error?: string;
  result?: OrderItem[];
  raw?: any;
  timestamp: number;
}
