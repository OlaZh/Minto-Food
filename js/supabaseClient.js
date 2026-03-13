import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://xpaibteyntflrixmigfx.supabase.co';
const supabaseAnonKey = 'sb_publishable_5aziCmaq0rxAJ24MznPycw_eY5iVZxZ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
