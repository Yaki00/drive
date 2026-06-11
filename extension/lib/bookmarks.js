export function normalizeUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isImportableUrl(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return false;
  }
  try {
    const parsed = new URL(normalizeUrl(trimmed));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function flattenBookmarkTree(nodes, parentPath = '') {
  const result = [];

  for (const node of nodes || []) {
    const path = parentPath
      ? `${parentPath} / ${node.title || ''}`
      : node.title || '';

    if (node.url) {
      if (isImportableUrl(node.url)) {
        result.push({
          id: String(node.id),
          title: (node.title || node.url).trim(),
          url: normalizeUrl(node.url),
          path,
        });
      }
      continue;
    }

    if (node.children?.length) {
      result.push(...flattenBookmarkTree(node.children, path));
    }
  }

  return result;
}

export function toLinkPayload(entry, options = {}) {
  return {
    title: entry.title,
    url: entry.url,
    description: entry.path || undefined,
    isFavorite: Boolean(options.isFavorite),
    createdBy: options.createdBy || 'extension',
  };
}

export function dedupeByUrl(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = entry.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
