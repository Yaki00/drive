const path = require('path');
const fs = require('fs');
const express = require('express');
const { createStore } = require('./store');
const { createRouter } = require('./router');
const { createAuthRouter, requireAuth, AuthService } = require('./auth/auth.routes');

loadDotEnv([
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '..', '.env'),
]);

const PORT = Number(process.env.PORT || 3001);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..');
const DATA_FILE = path.join(DATA_DIR, 'drive.json');
const SERVE_STATIC = process.env.SERVE_STATIC === 'true';
const STATIC_ROOT =
  process.env.STATIC_ROOT || path.join(__dirname, '..', 'public');

const store = createStore(DATA_FILE);
const apiRouter = createRouter(store);
const authService = new AuthService();
const authRouter = createAuthRouter(authService);
const authGuard = requireAuth(authService);

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

const app = express();
app.disable('x-powered-by');
app.use(applyCors);
app.use(express.json({ limit: '2mb' }));

// Normalize /api/* → /* so Vite proxy and reverse proxies both work.
app.use((req, _res, next) => {
  if (req.url === '/api' || req.url.startsWith('/api/')) {
    req.url = req.url === '/api' ? '/' : req.url.slice(4) || '/';
  }
  next();
});

app.use('/auth', authRouter);

app.use(async (req, res, next) => {
  try {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;

    if (pathname.startsWith('/auth')) {
      return next();
    }

    if (isApiPath(pathname)) {
      if (pathname !== '/health') {
        return authGuard(req, res, async () => {
          try {
            await apiRouter(req, res, req.body || {});
          } catch (err) {
            next(err);
          }
        });
      }
      await apiRouter(req, res, req.body || {});
      return;
    }

    if (SERVE_STATIC) {
      serveStatic(pathname, res);
      return;
    }

    res.status(404).json({ message: 'Not found' });
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error('[server]', err && err.stack ? err.stack : err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ message: err.message || 'Error' });
});

process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (err) => {
  console.error('[server] unhandledRejection:', err && err.stack ? err.stack : err);
});

app.listen(PORT, () => {
  console.log(`express backend http://localhost:${PORT}`);
  console.log(`data file: ${DATA_FILE}`);
  console.log(
    `auth: ${authService.isConfigured ? authService.mode || 'ldap' : 'not configured'}`,
  );
  logLdapStartupHints(authService);
  if (SERVE_STATIC) {
    console.log(`static root: ${STATIC_ROOT}`);
  }
});

function logLdapStartupHints(service) {
  if (service.mode === 'mock' || service.mode === 'dev') return;
  try {
    const srv = service.config && service.config.servers && service.config.servers[0];
    if (!srv) {
      console.warn('auth hint: no LDAP server in ldap.toml');
      return;
    }
    const hasEnvBind = Boolean(
      process.env.LDAP_BIND_DN && process.env.LDAP_BIND_PASSWORD,
    );
    console.log(
      `ldap: ${srv.host}:${srv.port} ssl=${Boolean(srv.use_ssl)} env_bind=${hasEnvBind}`,
    );
    if (srv.root_ca_cert) {
      const ok = fs.existsSync(srv.root_ca_cert);
      console.log(`ldap ca: ${srv.root_ca_cert} (${ok ? 'found' : 'MISSING'})`);
    }
    if (service.isPlaceholderBind && service.isPlaceholderBind(srv)) {
      console.warn(
        'auth hint: bind credentials missing — set LDAP_BIND_DN / LDAP_BIND_PASSWORD in backend/.env',
      );
    }
  } catch (err) {
    console.warn('auth hint:', err && err.message ? err.message : err);
  }
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

function applyCors(req, res, next) {
  const origin = req.headers.origin;
  if (origin) {
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

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

function serveStatic(pathname, res) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(STATIC_ROOT, safePath));

  if (!filePath.startsWith(path.normalize(STATIC_ROOT))) {
    res.status(403).end('Forbidden');
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

  res.status(404).type('text').send('Not found');
}

function sendFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', type);
  fs.createReadStream(filePath).pipe(res);
}

/** Minimal dotenv loader (no dependency). Does not overwrite existing env. */
function loadDotEnv(candidates) {
  for (const file of candidates) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}
