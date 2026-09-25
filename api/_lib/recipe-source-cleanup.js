// Retryable Storage API cleanup. Rows are retained until the whole folder is empty.
export async function cleanupRecipeSources(url, headers, userId = null) {
  const call = async (path, method = 'GET', body) => {
    const response = await fetch(`${url}/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error(`Recipe source cleanup failed (${response.status})`);
    return response.status === 204 ? null : response.json();
  };
  const rows = await call('rest/v1/rpc/claim_recipe_source_cleanup', 'POST', { p_user_id: userId });
  for (const row of rows || []) {
    if (row.retired_at) {
      const prefix = `${row.user_id}/${row.id}`;
      // Always list from zero: each successful batch disappears from the next result.
      for (;;) {
        const files = await call('storage/v1/object/list/recipe-sources', 'POST', { prefix, limit: 100, offset: 0 });
        if (!files.length) break;
        if (files.some(file => !file.id)) throw new Error('Unexpected source subfolder');
        await call('storage/v1/object/recipe-sources', 'DELETE', { prefixes: files.map(file => `${prefix}/${file.name}`) });
      }
      await call(`rest/v1/recipe_sources?id=eq.${row.id}&retired_at=not.is.null`, 'DELETE');
    } else if (row.cleanup_paths.length) {
      for (let i = 0; i < row.cleanup_paths.length; i += 100) {
        await call('storage/v1/object/recipe-sources', 'DELETE', { prefixes: row.cleanup_paths.slice(i, i + 100) });
      }
      // Keep tombstones so a concurrent edit cannot reattach a removed object path.
      await call(`rest/v1/recipe_sources?id=eq.${row.id}&version=eq.${row.version}`, 'PATCH', { cleanup_complete: true });
    }
  }
}
