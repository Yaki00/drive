const http = require('http');
const https = require('https');

const REQUEST_TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 5;
const USER_AGENT =
  'Mozilla/5.0 (compatible; Bookmarks-LinkChecker/1.1; +https://localhost)';

/** Status codes where the resource exists but access is restricted / limited. */
const ALIVE_SPECIAL = new Set([401, 403, 407, 429]);

/**
 * Classify an HTTP status the way a browser user would experience the URL.
 * - dead: missing / gone (404, 410, other hard 4xx)
 * - alive: reachable page (2xx/3xx) or auth wall (401/403…)
 * - unreachable: network / temporary server issues (do not flip isDead)
 */
function classifyHttpStatus(code) {
  const status = Number(code) || 0;
  if (status >= 200 && status < 400) return 'alive';
  if (ALIVE_SPECIAL.has(status)) return 'alive';
  if (status === 405) return 'alive';
  if (status === 408) return 'unreachable';
  if (status === 404 || status === 410) return 'dead';
  if (status >= 400 && status < 500) return 'dead';
  if (status >= 500) return 'unreachable';
  return 'unreachable';
}

function isPrivateOrLocalHost(hostname) {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return true;
  if (host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
  if (host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) {
    return true;
  }
  return false;
}

function normalizeCheckUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withScheme);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    if (isPrivateOrLocalHost(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function requestOnce(parsed, method) {
  return new Promise((resolve) => {
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(
      parsed,
      {
        method,
        timeout: REQUEST_TIMEOUT_MS,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
        },
      },
      (res) => {
        // Drain / abort body quickly — we only need the status line.
        res.resume();
        resolve({
          status: res.statusCode || 0,
          location: res.headers.location || null,
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, error: 'timeout' });
    });
    req.on('error', () => resolve({ status: 0, error: 'network' }));
    req.end();
  });
}

async function followRedirects(startUrl, method) {
  let current = startUrl;
  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const result = await requestOnce(current, method);
    if (result.error || !result.status) return result;

    if (result.status >= 300 && result.status < 400 && result.location) {
      try {
        const next = new URL(result.location, current);
        if (!['http:', 'https:'].includes(next.protocol)) {
          return { status: result.status, error: 'bad-redirect' };
        }
        if (isPrivateOrLocalHost(next.hostname)) {
          return { status: 0, error: 'private-redirect' };
        }
        current = next;
        continue;
      } catch {
        return { status: result.status, error: 'bad-redirect' };
      }
    }
    return result;
  }
  return { status: 0, error: 'too-many-redirects' };
}

/**
 * Resolve whether a public http(s) URL looks dead for an end user.
 * @returns {'alive'|'dead'|'unreachable'|'skipped'}
 */
async function resolveLinkStatus(rawUrl) {
  const parsed = normalizeCheckUrl(rawUrl);
  if (!parsed) return 'skipped';

  // Prefer HEAD (cheap). Many CDNs/apps reject HEAD → fall back to GET.
  let result = await followRedirects(parsed, 'HEAD');
  const headStatus = result.status;

  const needsGet =
    result.error ||
    !headStatus ||
    headStatus === 405 ||
    headStatus === 501 ||
    headStatus === 403 ||
    headStatus === 400;

  if (needsGet) {
    result = await followRedirects(parsed, 'GET');
  }

  if (result.error || !result.status) return 'unreachable';
  return classifyHttpStatus(result.status);
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

module.exports = {
  classifyHttpStatus,
  isPrivateOrLocalHost,
  normalizeCheckUrl,
  resolveLinkStatus,
  mapPool,
  ALIVE_SPECIAL,
};
