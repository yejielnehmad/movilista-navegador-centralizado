
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

-- Create function to check if the processing functions exist
CREATE OR REPLACE FUNCTION public.check_processing_functions_exist()
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN TRUE;
END;
$$;

-- Create function to upsert a processing task
CREATE OR REPLACE FUNCTION public.upsert_processing_task(
  p_id UUID,
  p_message TEXT,
  p_stage TEXT,
  p_progress INTEGER,
  p_status TEXT,
  p_error TEXT DEFAULT NULL,
  p_result JSONB DEFAULT NULL,
  p_raw_response JSONB DEFAULT NULL
) RETURNS SETOF public.processing_tasks
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.processing_tasks (
    id, message, stage, progress, status, error, result, raw_response, updated_at
  ) VALUES (
    p_id, p_message, p_stage, p_progress, p_status, p_error, p_result, p_raw_response, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    message = p_message,
    stage = p_stage,
    progress = p_progress,
    status = p_status,
    error = p_error,
    result = p_result,
    raw_response = p_raw_response,
    updated_at = now()
  RETURNING *;
END;
$$;

-- Create function to get processing tasks with limit
CREATE OR REPLACE FUNCTION public.get_processing_tasks(limit_count INTEGER DEFAULT 20)
RETURNS SETOF public.processing_tasks
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.processing_tasks
  ORDER BY updated_at DESC
  LIMIT limit_count;
END;
$$;
