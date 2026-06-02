import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = 'https://xpaibteyntflrixmigfx.supabase.co';
const supabaseAnonKey = 'sb_publishable_5aziCmaq0rxAJ24MznPycw_eY5iVZxZ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const originalGetUser = supabase.auth.getUser.bind(supabase.auth);

supabase.auth.getUser = async (...args) => {
  if (args.length === 0) {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!error && session?.user) {
        return { data: { user: session.user }, error: null };
      }
    } catch {}
  }

  return originalGetUser(...args);
};
