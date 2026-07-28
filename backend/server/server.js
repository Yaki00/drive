const http = require('http');
const fs = require('fs');
const path = require('path');
const { createStore } = require('./store');
const { createRouter } = require('./router');

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..');
const DATA_FILE = path.join(DATA_DIR, 'drive.json');
const SERVE_STATIC = process.env.SERVE_STATIC === 'true';
const STATIC_ROOT =
  process.env.STATIC_ROOT || path.join(__dirname, '..', 'public');

const store = createStore(DATA_FILE);
const router = createRouter(store);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  // Accept both /activity and /api/activity (Vite proxy rewrite, reverse proxies, mis-set VITE_API_URL).
  const pathname = stripApiPrefix(url.pathname);
  if (pathname !== url.pathname) {
    req.url = pathname + url.search;
  }

  if (isApiPath(pathname)) {
    const rawBody = await readBody(req);
    let body = {};
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ message: 'Invalid JSON body' }));
        return;
      }
    }
    await router(req, res, body);
    return;
  }

  if (SERVE_STATIC) {
    serveStatic(pathname, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ message: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`node backend http://localhost:${PORT}`);
  console.log(`data file: ${DATA_FILE}`);
  if (SERVE_STATIC) {
    console.log(`static root: ${STATIC_ROOT}`);
  }
});

function stripApiPrefix(pathname) {
  if (pathname === '/api') return '/';
  if (pathname.startsWith('/api/')) return pathname.slice(4) || '/';
  return pathname;
}

function isApiPath(pathname) {
  return (
    pathname === '/health' ||
    pathname === '/kpi' ||
    pathname === '/cards' ||
    pathname.startsWith('/cards/') ||
    pathname === '/activity' ||
    pathname.startsWith('/activity/')
  );
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;

  const allowLocalDev = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  const allowed = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowLocalDev || allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Actor',
    );
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PATCH,DELETE,OPTIONS',
    );
  }
}

function serveStatic(pathname, res) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(STATIC_ROOT, safePath));

  if (!filePath.startsWith(path.normalize(STATIC_ROOT))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(filePath, res);
    return;
  }

  const indexPath = path.join(STATIC_ROOT, 'index.html');
  if (fs.existsSync(indexPath)) {
    sendFile(indexPath, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function sendFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(filePath).pipe(res);
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') {
      resolve('');
      return;
    }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
