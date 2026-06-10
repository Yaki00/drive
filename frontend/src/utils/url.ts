export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isValidUrl(raw: string): boolean {
  try {
    const url = new URL(normalizeUrl(raw));
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}
