
import { OrderItem } from "@/types/orders";
import type { Database } from "@/integrations/supabase/types";
import { Json } from "@/integrations/supabase/types";

// Define the ProcessingStage type (stages of message processing)
export type ProcessingStage = 
  | 'parsing'
  | 'analyzing'
  | 'ai_processing'
  | 'validating'
  | 'grouping'
  | 'completed'
  | 'failed';

// Define the ProcessingStatus type (status of processing)
export type ProcessingStatus = 
  | 'idle'
  | 'processing'
  | 'success'
  | 'error';

// Define the processing progress interface
export interface ProcessingProgress {
  id: string;
  message: string;
  stage: ProcessingStage;
  progress: number;
  status: ProcessingStatus;
  error?: string;
  result?: OrderItem[];
  raw_response?: any;
  timestamp: number; // Added timestamp property
}

// Progress listener type
export type ProgressListener = (progress: ProcessingProgress) => void;

// Database storage model for task progress
export interface ProcessingTaskRecord {
  id: string;
  message: string;
  stage: ProcessingStage;
  progress: number;
  status: ProcessingStatus;
  error?: string;
  result?: OrderItem[];
  raw_response?: any;
  created_at: string;
  updated_at: string;
}
