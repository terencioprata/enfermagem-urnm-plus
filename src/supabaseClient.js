// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://leckukttrmqhqwmymsvq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlY2t1a3R0cm1xaHF3bXltc3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MDY3NzMsImV4cCI6MjA3ODE4Mjc3M30.iv0cNsPHzCKNvJ9Yx6-LYK02oakqtjarmIIwn2mhQWc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
