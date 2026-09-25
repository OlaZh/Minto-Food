export const SOURCE_BUCKET = 'recipe-sources';
export const SOURCE_IMAGE_LIMIT = 10 * 1024 * 1024;
export const SOURCE_VIDEO_LIMIT = 50 * 1024 * 1024;
export const SOURCE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'];
export const SOURCE_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'];
export function sourceFileKind(file) {
  const kind = SOURCE_IMAGE_TYPES.includes(file.type) ? 'image' : SOURCE_VIDEO_TYPES.includes(file.type) ? 'video' : null;
  if (!kind || !file.size) throw new Error('invalid_source_files');
  if (file.size > (kind === 'image' ? SOURCE_IMAGE_LIMIT : SOURCE_VIDEO_LIMIT)) throw new Error(`${kind}_too_large`);
  return kind;
}
export function normalizeSourceUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.href;
  } catch { throw new Error('invalid_source_url'); }
}
