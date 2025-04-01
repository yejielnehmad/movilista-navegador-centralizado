
import { OrderItem } from "@/types/orders";
import type { Database } from "@/integrations/supabase/types";
import { Json } from "@/integrations/supabase/types";

// Import ProcessingProgress type from the service to maintain compatibility
import { ProcessingProgress, ProcessingStage, ProcessingStatus, ProgressListener } from "@/services/messageProcessingService";

// Re-export for backward compatibility
export { ProcessingProgress, ProcessingStage, ProcessingStatus, ProgressListener };

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
