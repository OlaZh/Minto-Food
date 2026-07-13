// ============================================================
// profile-flags.js — надійний запис полів у власний рядок profiles
// ============================================================
//
// Історія: welcome_intro_seen / display_name роками не зберігались і
// онбординг вилазив при кожному вході. Записи падали/не проходили RLS
// МОВЧКИ, бо жоден виклик не перевіряв error і не дивився, скільки
// рядків реально оновлено (RLS-фільтр дає «0 рядків» БЕЗ помилки).
//
// Тому тут: update-спершу з перевіркою кількості рядків, upsert-фолбек,
// і гучна діагностика в консоль — включно зі станом сесії, бо головна
// підозра: запити після логіну йдуть без auth-токена (як anon).

import { supabase } from './supabaseClient.js';

export async function saveProfileFields(userId, fields) {
  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', userId)
    .select('id');

  if (!error && data?.length) return true;

  // Діагностика: «0 рядків без помилки» = RLS не впізнав користувача.
  const { data: { session } = {} } = await supabase.auth.getSession();
  console.error(
    '[profiles] update не пройшов:',
    error ?? '0 рядків (RLS відфільтрував — запит, схоже, без токена)',
    '| сесія:', session ? `є, user=${session.user?.id}, exp=${session.expires_at}` : 'НЕМАЄ',
  );

  const { error: upsertErr } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...fields }, { onConflict: 'id' });

  if (upsertErr) {
    console.error('[profiles] upsert-фолбек теж не пройшов:', upsertErr);
    return false;
  }
  return true;
}
