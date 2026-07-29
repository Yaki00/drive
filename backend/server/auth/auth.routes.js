const express = require('express');
const AuthService = require('./auth.service');

function createAuthRouter(authService = new AuthService()) {
  const router = express.Router();

  router.use((req, _res, next) => {
    console.log(
      `[${new Date().toISOString()}] [auth-http] ${req.method} ${req.originalUrl || req.url}`,
    );
    next();
  });

  router.get('/status', (_req, res) => {
    const body = {
      configured: authService.isConfigured,
      mode: authService.mode || (authService.isConfigured ? 'ldap' : 'off'),
    };
    console.log(`[${new Date().toISOString()}] [auth-http] /status →`, body);
    res.json(body);
  });

  /** Safe connectivity check — does not crash the process. */
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
