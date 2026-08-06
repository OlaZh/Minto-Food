import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.4';

const supabaseUrl = 'https://xpaibteyntflrixmigfx.supabase.co';
const supabaseAnonKey = 'sb_publishable_5aziCmaq0rxAJ24MznPycw_eY5iVZxZ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
