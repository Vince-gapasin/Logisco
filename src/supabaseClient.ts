import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// We will add your actual URL and Key to a .env file later
const supabaseUrl = process.env.SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// The 'export' keyword here is what fixes your error!
export const supabase = createClient(supabaseUrl, supabaseKey);