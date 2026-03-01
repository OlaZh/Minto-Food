const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = '';
const SUPABASE_KEY = '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase; // Експортуємо клієнт
