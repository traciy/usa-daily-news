export function safeHttpUrl(value: string | null | undefined, allowHttp = false): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && !(allowHttp && url.protocol === 'http:')) return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
