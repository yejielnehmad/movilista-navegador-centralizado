// This file is automatically generated. Do not edit it directly.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://oaubgaxqpsykksfeycfq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hdWJnYXhxcHN5a2tzZmV5Y2ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM0Mzk2NjMsImV4cCI6MjA1OTAxNTY2M30.z3I718Vp8XD4FsbuLCdNUwKdT0sfy0fj-vARIpAoaTA";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);