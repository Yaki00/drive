const express = require('express');
const AuthService = require('./auth.service');
const OidcService = require('./oidc.service');

function parseCookie(req, name) {
  const header = req.headers.cookie || '';
  const parts = String(header).split(';').map((p) => p.trim());
  for (const part of parts) {
    const [k, ...rest] = part.split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function setCookie(
  res,
  name,
  value,
  { httpOnly = true, secure = false, sameSite = 'Lax', path = '/' } = {},
) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (sameSite) parts.push(`SameSite=${sameSite}`);
  if (path) parts.push(`Path=${path}`);
  parts.push('Max-Age=300');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function createAuthRouter(authService = new AuthService()) {
  const router = express.Router();
  const oidcService = new OidcService();

  router.use((req, _res, next) => {
    console.log(
      `[${new Date().toISOString()}] [auth-http] ${req.method} ${req.originalUrl || req.url}`,
    );
    next();
  });

  /** Debug .env OIDC (sans secret en clair) — utile si 404 / 503 */
  router.get('/oidc/env', (_req, res) => {
    const snap = oidcService.logEnvSnapshot('GET /auth/oidc/env');
    return res.status(200).json(snap);
  });

  /** Ping SSO : si 404 ici, les routes OIDC ne sont PAS chargées */
  router.get('/oidc/ping', (_req, res) => {
    const body = {
      ok: true,
      message: 'OIDC routes loaded',
      time: new Date().toISOString(),
      routes: [
        'GET /auth/oidc/ping',
        'GET /auth/oidc/env',
        'GET /auth/oidc/start',
        'GET /auth/oidc/callback',
      ],
      tip: 'Via Vite utilise /api/auth/oidc/ping (pas /auth/... sans proxy)',
    };
    console.log('[oidc] /ping', body);
    return res.status(200).json(body);
  });

  router.get('/status', (_req, res) => {
    const body = {
      configured: authService.isConfigured,
      mode: authService.mode || (authService.isConfigured ? 'ldap' : 'off'),
    };
    console.log(`[${new Date().toISOString()}] [auth-http] /status →`, body);
    res.json(body);
  });

  router.get('/diagnose', async (_req, res) => {
    console.log(`[${new Date().toISOString()}] [auth-http] /diagnose start`);
    try {
      const report = await authService.diagnose();
      console.log(
        `[${new Date().toISOString()}] [auth-http] /diagnose →`,
        JSON.stringify(report, null, 2),
      );
      return res.status(report.ok ? 200 : 500).json(report);
    } catch (err) {
      console.error(
        `[${new Date().toISOString()}] [auth-http] /diagnose threw`,
        err && err.stack ? err.stack : err,
      );
      return res.status(500).json({
        ok: false,
        message: err.message || String(err),
      });
    }
  });

  router.post('/login', async (req, res) => {
    const username = req.body && req.body.username;
    console.log(
      `[${new Date().toISOString()}] [auth-http] /login start user=${username}`,
    );
    try {
      if (!authService.isConfigured) {
        console.warn(`[${new Date().toISOString()}] [auth-http] /login not configured`);
        return res.status(503).json({
          message: 'LDAP not configured. Set AUTH_MODE=mock or provide ldap.toml',
        });
      }
      const { password } = req.body || {};
      const result = await authService.login(username, password);
      console.log(`[${new Date().toISOString()}] [auth-http] /login ok`, {
        user: result.user && result.user.id,
        role: result.role,
      });
      return res.status(200).json(result);
    } catch (err) {
      console.error(
        `[${new Date().toISOString()}] [auth-http] /login failed`,
        err && err.message,
        err && err.status,
      );
      if (err && err.stack) console.error(err.stack);
      return res.status(err.status || 401).json({
        message: err.message || 'Authentication failed',
      });
    }
  });

  router.get('/me', (req, res) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      if (!token) {
        return res.status(401).json({ message: 'Missing token' });
      }
      const payload = authService.verifyToken(token);
      return res.json({
        user: {
          id: payload.sub,
          fullName: payload.name || payload.sub,
          role: payload.role || 'User',
        },
      });
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [auth-http] /me invalid`, err && err.message);
      return res.status(401).json({ message: 'Invalid token' });
    }
  });

  // ----------------------------
  // OIDC SSO
  // ----------------------------

  router.get('/oidc/start', async (req, res) => {
    console.log('[oidc] /start hit', {
      url: req.originalUrl || req.url,
      host: req.headers.host,
      'x-forwarded-proto': req.headers['x-forwarded-proto'] || null,
    });
    oidcService.logEnvSnapshot('GET /auth/oidc/start');
    try {
      if (!oidcService.enabled) {
        console.warn('[oidc] /start blocked: OIDC_ENABLED is not true');
        return res.status(503).json({
          message: 'OIDC not enabled (OIDC_ENABLED=true)',
          env: oidcService.getEnvSnapshot(),
        });
      }

      const secure =
        Boolean(req.secure) ||
        String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';

      const state = oidcService.generateState();
      // Path '/' : compatible Vite (/api/auth/...) et PROD (/auth/...).
      setCookie(res, 'oidc_state', state, {
        httpOnly: true,
        secure,
        sameSite: 'Lax',
        path: '/',
      });

      const authorizationUrl = await oidcService.buildAuthorizationUrl({ state });
      console.log('[oidc] /start redirecting', { state_masked: state.slice(0, 6) + '…' });

      return res.redirect(302, authorizationUrl);
    } catch (err) {
      console.error('[oidc] /start failed', err && err.stack ? err.stack : err);
      return res.status(err.status || 500).json({
        message: err.message || 'OIDC start failed',
        env: oidcService.getEnvSnapshot(),
      });
    }
  });

  router.get('/oidc/callback', async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || '';
    const relative = '/login/sso/callback';
    const redirectBase = frontendUrl
      ? `${frontendUrl.replace(/\/+$/, '')}${relative}`
      : relative;

    try {
      if (req.query && req.query.error) {
        const err = String(req.query.error || '');
        console.error('[oidc] callback error', err, req.query.error_description || '');
        return res.redirect(`${redirectBase}#error=${encodeURIComponent(err)}`);
      }

      const code = typeof req.query.code === 'string' ? req.query.code : '';
      const stateQuery = typeof req.query.state === 'string' ? req.query.state : '';
      const stateCookie = parseCookie(req, 'oidc_state');

      console.log('[oidc] /callback received', {
        has_code: Boolean(code),
        state_cookie_masked: stateCookie ? stateCookie.slice(0, 6) + '…' : null,
        state_query_masked: stateQuery ? String(stateQuery).slice(0, 6) + '…' : null,
      });

      if (!code || !stateQuery) {
        return res.redirect(`${redirectBase}#error=${encodeURIComponent('missing_code_or_state')}`);
      }
      if (!stateCookie || String(stateCookie) !== String(stateQuery)) {
        return res.redirect(`${redirectBase}#error=${encodeURIComponent('state_mismatch')}`);
      }

      const { claims } = await oidcService.exchangeCodeForClaims({ code, state: stateQuery });
      const { uid, used } = oidcService.extractLdapUidFromClaims(claims);
      console.log('[oidc] ldap uid extracted', { used, uid_masked: uid.slice(0, 8) + '…' });

      const appAuth = await oidcService.buildAppJwtFromLdapUid({
        authService,
        uid,
        claims,
      });

      return res.redirect(`${redirectBase}#token=${encodeURIComponent(appAuth.token)}`);
    } catch (err) {
      console.error('[oidc] /callback failed', err && err.stack ? err.stack : err);
      return res.redirect(
        `${redirectBase}#error=${encodeURIComponent(err.message || 'oidc_callback_failed')}`,
      );
    }
  });

  return router;
}

function requireAuth(authService = new AuthService()) {
  return function authMiddleware(req, res, next) {
    const required = String(process.env.AUTH_REQUIRED || '').toLowerCase() === 'true';
    if (!required) return next();

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      req.user = authService.verifyToken(token);
      return next();
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
}

module.exports = { createAuthRouter, requireAuth, AuthService };
