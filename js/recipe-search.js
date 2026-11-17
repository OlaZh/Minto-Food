const SEARCH_FIELDS = [
  'name_ua', 'name_en', 'name_pl',
  'ingredients', 'ingredients_en', 'ingredients_pl',
];
const SEARCH_CARD_FIELDS = [
  ...SEARCH_FIELDS, 'id', 'user_id', 'status', 'is_public', 'entry_type',
  'category', 'time_minutes', 'difficulty', 'total_weight', 'kcal',
  'has_pending_update', 'moderation_note',
].join(',');
const SEARCH_PAGE_SIZE = 500;
const MAX_ENCODED_SEARCH_TERM = 640;
const APOSTROPHES = "'’ʼ";

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordPattern(term, wordCharacters, apostrophes, complete = true) {
  const start = `(?:^|[^${wordCharacters}${apostrophes}]|(?:^|[^${wordCharacters}])[${apostrophes}])`;
  const end = `(?=$|[^${wordCharacters}${apostrophes}]|[${apostrophes}](?:$|[^${wordCharacters}]))`;
  return start + term + (complete ? end : '');
}

function escapePostgrestValue(text) {
  return text.replace(/[\\"]/g, '\\$&');
}

function toPostgresTerm(query) {
  let term = '';
  let encodedLength = 0;
  for (const character of query) {
    const decomposed = character.normalize('NFD');
    const literal = escapeRegex(character);
    let part = literal;
    if (character === "'") {
      part = `[${APOSTROPHES}]`;
    } else if (character !== decomposed) {
      part = `(?:${literal}|${escapeRegex(decomposed)})`;
    }

    // The pattern is repeated for each field in the URL. For a long phrase,
    // match its prefix in PostgreSQL and verify the whole phrase on the client.
    encodedLength += encodeURIComponent(escapePostgrestValue(part)).length;
    if (encodedLength > MAX_ENCODED_SEARCH_TERM) return { term, complete: false };
    term += part;
  }
  return { term, complete: true };
}

function normalizeSearchText(text) {
  return text.normalize('NFC').replace(/[’ʼ]/g, "'");
}

export function selectAccessibleRecipes(client, columns, userId) {
  const request = client.from('recipes').select(columns).is('deleted_at', null);
  if (userId) {
    return request.or(`and(status.eq.published,is_public.is.true),user_id.eq.${userId}`);
  }
  return request.eq('status', 'published').eq('is_public', true);
}

export async function searchRecipeCards(client, query, userId, signal) {
  const normalized = normalizeSearchText(query);
  const { term, complete } = toPostgresTerm(normalized);
  const postgresPattern = wordPattern(term, '[:alnum:]\u0300-\u036f', APOSTROPHES, complete);
  const filter = SEARCH_FIELDS.map(column => `${column}.imatch."${escapePostgrestValue(postgresPattern)}"`).join(',');
  const wholeWord = new RegExp(wordPattern(escapeRegex(normalized), '\\p{L}\\p{M}\\p{N}', "'"), 'iu');
  const recipes = [];
  let lastId = null;

  while (!signal.aborted) {
    let request = selectAccessibleRecipes(client, SEARCH_CARD_FIELDS, userId)
      .or(filter)
      .order('id')
      .limit(SEARCH_PAGE_SIZE)
      .abortSignal(signal);
    if (lastId !== null) request = request.gt('id', lastId);

    const { data, error } = await request;
    if (error || signal.aborted) return { error };
    const rows = data || [];
    recipes.push(...rows.filter(recipe => SEARCH_FIELDS.some(field => {
      const text = recipe[field];
      return text && wholeWord.test(normalizeSearchText(text));
    })));
    if (rows.length < SEARCH_PAGE_SIZE) break;
    lastId = rows.at(-1).id;
  }

  return { data: recipes };
}
