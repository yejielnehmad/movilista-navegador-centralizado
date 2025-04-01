
import { OrderItem } from '@/types/orders';

// Process state types
export type ProcessingStage = 
  | 'not_started'
  | 'parsing'
  | 'fetching_data'
  | 'analyzing'
  | 'ai_processing'
  | 'grouping'
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
  synced?: boolean; // Indicates if the task has been synced with Supabase
}

export type ProgressListener = (progress: ProcessingProgress) => void;

// Database storage model for task progress
export interface ProcessingTaskRecord {
  id: string;
  message: string;
  stage: ProcessingStage;
  progress: number;
  status: 'pending' | 'success' | 'error';
  error?: string;
  result?: OrderItem[];
  raw_response?: any;
  created_at: string;
  updated_at: string;
}
