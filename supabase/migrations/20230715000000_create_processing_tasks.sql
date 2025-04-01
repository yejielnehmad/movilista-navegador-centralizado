
-- Create table for storing processing tasks
CREATE TABLE IF NOT EXISTS public.processing_tasks (
  id UUID PRIMARY KEY,
  message TEXT NOT NULL,
  stage TEXT NOT NULL,
  progress INTEGER NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  result JSONB,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster retrieval by updated_at
CREATE INDEX IF NOT EXISTS idx_processing_tasks_updated_at ON public.processing_tasks(updated_at DESC);

-- Make the table accessible without authentication
ALTER TABLE public.processing_tasks ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anonymous access to processing tasks
CREATE POLICY "Allow anonymous access to processing tasks"
  ON public.processing_tasks
  FOR ALL
  USING (true);
