const express = require('express');
const AuthService = require('./auth.service');

function createAuthRouter(authService = new AuthService()) {
  const router = express.Router();

  router.get('/status', (_req, res) => {
    res.json({
      configured: authService.isConfigured,
      mode: authService.mode || (authService.isConfigured ? 'ldap' : 'off'),
    });
  });

  /** Safe connectivity check — does not crash the process. */
  router.get('/diagnose', async (_req, res) => {
    try {
      const report = await authService.diagnose();
      return res.status(report.ok ? 200 : 500).json(report);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        message: err.message || String(err),
      });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      if (!authService.isConfigured) {
        return res.status(503).json({
          message: 'LDAP not configured. Set AUTH_MODE=mock or provide ldap.toml',
        });
      }
      const { username, password } = req.body || {};
      const result = await authService.login(username, password);
      return res.status(200).json(result);
    } catch (err) {
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
    } catch {
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
