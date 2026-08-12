# SSO OIDC + LDAP — Copier / Coller (code complet)

Ce document liste uniquement les fichiers à ajouter/modifier pour l’ajout SSO/OIDC (avec relecture LDAP via `ldap.toml`).

## ⚠️ Dépannage rapide (à lire avant)

### A) Flash sur `/auth/oidc/start` puis retour home / aucun log backend

Cause : Vite (DEV) ne proxy souvent que `/api`.  
`/auth/oidc/start` est alors pris par React (`path="*"` → `/`).

**Fix :** dans `LoginPage` :

```ts
window.location.href = '/api/auth/oidc/start';
```

### B) Erreur **404** + message console `default-src 'none'`

Ce message CSP vient souvent de **Chrome** (ou d’une page d’erreur nginx) sur une **404** : ce n’est **pas** ta CSP app.

**Signification :** quelque chose a répondu **404**. Même si “tous les fichiers sont là”, le navigateur n’atteint parfois **pas** Express (proxy / static).

#### Étape 1 — URL exacte du 404 (Network)

DevTools → Network → requête rouge :
- URL complète ?
- Response : `Cannot GET /...` (Express) **ou** HTML nginx / page blanche ?

| Response | Interprétation |
|----------|----------------|
| `Cannot GET /auth/oidc/start` | Express OK, **route absente** dans le process actuel |
| HTML nginx / vide / CSP `default-src 'none'` | **Proxy/static** a répondu, **pas** Node |
| JSON `{ "message": "Not found" }` | Hit API Express, pas le router `/auth` |

#### Étape 2 — curl **sur le serveur** (bypass front)

```bash
curl -i http://127.0.0.1:3001/auth/oidc/start
curl -i http://127.0.0.1:3001/api/auth/oidc/start
```

| curl | Action |
|------|--------|
| **302** vers `ssologin...` | Backend OK → bug **front/proxy** |
| **503** JSON | Code chargé → `OIDC_ENABLED=true` + secrets + restart |
| **404** `Cannot GET` | Process Node sans routes (mauvais dossier / ancien process) |
| Connection refused | Backend pas démarré / mauvais port |

#### Étape 3 — curl = 302 mais navigateur = 404 (cas le plus fréquent)

Souvent nginx sert le front pour `/*` et ne proxy que `/api/*` vers Node.  
Bouton `/auth/oidc/start` → **404 nginx** (+ CSP).

**Fix bouton :**

```ts
window.location.href = '/api/auth/oidc/start';
```

#### Étape 4 — curl local = 404 alors que les fichiers “sont là”

Dans le dossier réellement lancé par `npm start` :

```bash
cd backend
ls -la server/auth/oidc.service.js
grep -n "oidc/start" server/auth/auth.routes.js
grep -n "openid-client" package.json
# puis restart propre du process Node
```

#### Étape 5 — renvoie-moi

1. URL exacte du 404  
2. 20 premières lignes de la Response  
3. Sortie `curl -i http://127.0.0.1:3001/auth/oidc/start`  
4. Mode de lancement : Vite / SERVE_STATIC / nginx / Podman  
5. `grep -n "oidc/start" backend/server/auth/auth.routes.js`

---

## Audit complet : autres fichiers (adapter ou non ?)

### À adapter (recommandé / parfois obligatoire)

| Fichier | Obligatoire ? | Pourquoi | Que faire |
|---------|---------------|----------|-----------|
| `frontend/vite.config.ts` | **Oui en DEV Vite** | Vite ne proxy que `/api` → `/auth/oidc/*` ne touche pas Express (404 / flash) | Soit bouton = `/api/auth/oidc/start`, soit ajouter un proxy `/auth` → `localhost:3001` |
| `backend/.env` (serveur, **pas git**) | **Oui** | Active OIDC + secrets + URLs | `OIDC_ENABLED=true`, id/secret, `OIDC_REDIRECT_URI`, `FRONTEND_URL`, `OIDC_DEBUG=true` le temps du debug |
| `deploy/podman/env.example` / `env.local` | **Oui en prod Podman** | Les vars OIDC doivent entrer dans le conteneur | Passer `OIDC_*`, `FRONTEND_URL`, `JWT_SECRET`, LDAP… au run (`-e` / env file) |
| `frontend/src/components/Navbar.tsx` | Optionnel UX | `isLoginPage = path === '/login'` → `/login/sso/callback` affiche encore « Se connecter » | `pathname.startsWith('/login')` |

#### Vite : 3 points critiques

1. **Bouton SSO** → `/api/auth/oidc/start` (pas `/auth/...` en Vite)
2. **`FRONTEND_URL`** dans `.env` backend (local Vite) :
   ```env
   FRONTEND_URL=http://localhost:5173
   ```
3. **Cookie `oidc_state` + Path**  
   Dans le code copier-coller, cookie en `Path=/auth/oidc/callback`.  
   Via Vite `/api/auth/...`, le navigateur est sur `http://localhost:5173/api/auth/...` → le cookie **ne part pas** au callback.  
   **Adaptation sur l’autre PC dans `auth.routes.js`** :
   - soit `path: '/'` (plus simple en DEV)
   - soit Path + `OIDC_REDIRECT_URI` alignés sur `/api/auth/oidc/callback` (souvent refusé par l’IdP en localhost)

> En entreprise, le vrai flux IdP se teste souvent seulement en **HTTPS public** (`bof…`). Vite sert surtout à brancher bouton + page callback.

### Pas besoin d’adapter

| Fichier | Raison |
|---------|--------|
| `backend/server/server.js` | Monte déjà `/auth`, retire déjà `/api` |
| `backend/server/auth/auth.service.js` | LDAP + rôles + JWT déjà OK |
| `backend/ldap.toml` (+ example) | Source des rôles inchangée |
| `frontend/src/api/client.ts` | Bearer + `me()` déjà OK |
| `frontend/src/utils/sessionUser.ts` | `setAuthToken` / `setSessionUser` suffisent |
| Pages métier (`HomePage`, etc.) | Auth via token localStorage |
| `backend/server/router.js` / `store.js` | Hors auth |
| `backend/test/auth.test.js` | Pas bloquant pour activer SSO |

### Ops après changements

| Action | Quand |
|--------|--------|
| `cd backend && npm install` | Après `openid-client@5` |
| Restart Node | Après `.env` / routes |
| Restart Vite | Après `vite.config.ts` |
| `refresh-vendor.sh` + rebuild Podman | Si image prod |
| Redirect URI IdP = `OIDC_REDIRECT_URI` | Exact match |

### Checklist Vite « je clique SSO »

- [ ] Backend `:3001` up
- [ ] Vite `:5173` up
- [ ] Bouton → `/api/auth/oidc/start`
- [ ] `curl -i http://127.0.0.1:3001/auth/oidc/start` ≠ 404
- [ ] `curl -i http://127.0.0.1:5173/api/auth/oidc/start` ≠ 404 HTML
- [ ] `OIDC_ENABLED=true` + secrets
- [ ] Cookie Path compatible callback (souvent `path: '/'` en DEV)
- [ ] `FRONTEND_URL=http://localhost:5173`

---

## 1) Backend

### `backend/package.json`

```json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "Express backend for bookmarks with optional LDAP auth",
  "private": true,
  "license": "UNLICENSED",
  "engines": {
    "node": "16.20.2"
  },
  "scripts": {
    "start": "node server/server.js",
    "start:dev": "AUTH_MODE=mock node server/server.js",
    "start:prod": "node server/server.js",
    "test": "node test/api.test.js && node test/linkChecker.test.js && node test/auth.test.js"
  },
  "dependencies": {
    "express": "4.21.2",
    "jsonwebtoken": "9.0.2",
    "ldapjs": "3.0.7",
    "openid-client": "^5.7.1"
  }
}
```

---

### `backend/.env.example`

```env
# Copy to backend/.env (never commit secrets).
# AUTH_MODE=mock for local without LDAP.

# AUTH_MODE=mock
# JWT_SECRET=change-me

# LDAP — overrides ldap.toml (especially bind placeholders)
LDAP_BIND_DN=cn=svc-bookmarks,ou=apps,dc=root
LDAP_BIND_PASSWORD=CHANGE_ME

# Optional overrides
# LDAP_HOST=eldap-global.cib.echonet
# LDAP_PORT=636
# LDAP_USE_SSL=true
# LDAP_START_TLS=false
# LDAP_SSL_SKIP_VERIFY=false
# LDAP_SEARCH_BASE=ou=Internal,ou=Users,dc=root
# LDAP_SEARCH_FILTER=(uid=%s)
# LDAP_ROOT_CA_CERT=./certs/root.cer
# LDAP_TOML=./ldap.toml

# --- OIDC SSO (SSologin) ---
# (met ces valeurs dans backend/.env, pas commit)
OIDC_ENABLED=false
OIDC_DEBUG=false

OIDC_ISSUER=https://ssologin.bnpparibas.com/affwebservices/CASSO/oidc/PAR-FTP_SSO_BOOKMARK_PRD
OIDC_CLIENT_ID=CHANGE_ME
OIDC_CLIENT_SECRET=CHANGE_ME
OIDC_REDIRECT_URI=https://bof…/auth/oidc/callback
OIDC_SCOPES=openid profile

# Pour rediriger après callback (URL de ton frontend SPA)
FRONTEND_URL=https://bof…
```

---

### `backend/server/auth/oidc.service.js` (FICHIER NOUVEAU)

```javascript
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Issuer } = require('openid-client');

function mask(value, head = 6, tail = 2) {
  const s = value == null ? '' : String(value);
  if (!s) return '';
  if (s.length <= head + tail) return `${s.slice(0, head)}…`;
  return `${s.slice(0, head)}…${s.slice(-tail)} (len=${s.length})`;
}

function safeProjection(claims) {
  // Projection “safe” : évite de logguer le token entier.
  return {
    iss: claims && claims.iss,
    sub: claims && claims.sub,
    preferred_username: claims && (claims.preferred_username || claims['preferred_username']),
    name: claims && claims.name,
    email: claims && claims.email,
    uid: claims && claims.uid,
    user_id: claims && claims.user_id,
  };
}

class OidcService {
  constructor() {
    this.clientPromise = null;
  }

  get enabled() {
    return String(process.env.OIDC_ENABLED || '').toLowerCase() === 'true';
  }

  get debug() {
    return String(process.env.OIDC_DEBUG || '').toLowerCase() === 'true';
  }

  log(...args) {
    if (!this.debug) return;
    console.log('[oidc]', ...args);
  }

  requiredEnv() {
    const required = ['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_REDIRECT_URI'];
    return required.filter((k) => !process.env[k] || !String(process.env[k]).trim());
  }

  async getClient() {
    if (this.clientPromise) return this.clientPromise;

    this.clientPromise = (async () => {
      const missing = this.requiredEnv();
      if (missing.length > 0) {
        const err = new Error(`OIDC env manquantes: ${missing.join(', ')}`);
        err.status = 503;
        throw err;
      }

      const issuerUrl = process.env.OIDC_ISSUER;
      this.log('discover issuer start', { issuerUrl });
      const issuer = await Issuer.discover(issuerUrl);

      this.log('discover issuer ok', {
        authorization_endpoint: issuer.authorization_endpoint,
        token_endpoint: issuer.token_endpoint,
        userinfo_endpoint: issuer.userinfo_endpoint,
      });

      // PKCE volontairement NON (ta consigne "pkce false")
      const client = new issuer.Client({
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        redirect_uris: [process.env.OIDC_REDIRECT_URI],
        response_types: ['code'],
      });

      return client;
    })();

    return this.clientPromise;
  }

  generateState() {
    return crypto.randomBytes(24).toString('hex');
  }

  async buildAuthorizationUrl({ state }) {
    const client = await this.getClient();
    const scope = process.env.OIDC_SCOPES || 'openid profile';

    const authorizationUrl = client.authorizationUrl({
      state,
      scope,
    });

    this.log('authorizationUrl generated', {
      scope,
      state: mask(state, 6, 2),
      url: (() => {
        try {
          const u = new URL(authorizationUrl);
          return `${u.origin}${u.pathname}`;
        } catch {
          return authorizationUrl;
        }
      })(),
    });

    return authorizationUrl;
  }

  async exchangeCodeForClaims({ code, state }) {
    const client = await this.getClient();
    const redirectUri = process.env.OIDC_REDIRECT_URI;

    this.log('callback exchange start', {
      has_code: Boolean(code),
      state: mask(state, 6, 2),
      redirectUri,
    });

    const tokenSet = await client.callback(redirectUri, { code, state });
    const claims = tokenSet.claims();

    this.log('callback exchange ok', {
      has_id_token: Boolean(tokenSet && tokenSet.id_token),
      has_access_token: Boolean(tokenSet && tokenSet.access_token),
      claims_debug: safeProjection(claims),
    });

    return { claims, tokenSet };
  }

  extractLdapUidFromClaims(claims) {
    // Heuristique: preferred_username puis sub.
    const preferred =
      claims &&
      (claims.preferred_username || claims['preferred_username'] || claims.preferredUserName);
    if (preferred && String(preferred).trim()) {
      return { uid: String(preferred).trim(), used: 'preferred_username' };
    }

    if (claims && claims.sub && String(claims.sub).trim()) {
      return { uid: String(claims.sub).trim(), used: 'sub' };
    }

    if (claims && claims.uid && String(claims.uid).trim()) {
      return { uid: String(claims.uid).trim(), used: 'uid' };
    }

    if (claims && claims.user_id && String(claims.user_id).trim()) {
      return { uid: String(claims.user_id).trim(), used: 'user_id' };
    }

    const err = new Error('Impossible de déduire un uid LDAP depuis les claims OIDC');
    err.status = 401;
    err.claims_debug = safeProjection(claims);
    throw err;
  }

  async buildAppJwtFromLdapUid({ authService, uid }) {
    const srv = authService.activeServer;
    this.log('ldap login via uid start', {
      uid: mask(uid, 10, 4),
      ldap_host: srv.host,
      ldap_port: srv.port,
      ldap_ssl: Boolean(srv.use_ssl),
      bind_dn_set: Boolean(srv.bind_dn && !authService.isPlaceholderBind(srv)),
    });

    let client = null;
    try {
      client = authService.createLdapClient();

      const resolved = await authService.resolveUserDn(client, uid);
      this.log('ldap resolveUserDn ok', {
        userDn: mask(resolved.userDn, 12, 6),
        displayName: resolved.displayName,
        dnCandidates_count: resolved.dnCandidates ? resolved.dnCandidates.length : 0,
      });

      if (srv.bind_dn && !authService.isPlaceholderBind(srv)) {
        await authService.bind(client, srv.bind_dn, srv.bind_password || '');
      }

      const groups = await authService.getUserGroups(client, resolved.userDn);
      const role = authService.mapGroupToRole(groups);

      const secret = process.env.JWT_SECRET || 'secret';
      const token = jwt.sign(
        {
          sub: uid,
          role,
          name: resolved.displayName || uid,
        },
        secret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
      );

      this.log('ldap → jwt ok', {
        role,
        groups_count: Array.isArray(groups) ? groups.length : 0,
        groups_sample: Array.isArray(groups)
          ? groups.slice(0, 6).map((g) => mask(String(g), 16, 4))
          : [],
      });

      return {
        token,
        role,
        user: {
          id: uid,
          fullName: resolved.displayName || uid,
        },
      };
    } finally {
      authService.destroyClient(client);
    }
  }
}

module.exports = OidcService;
```

---

### `backend/server/auth/auth.routes.js` (remplacement complet)

```javascript
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
    try {
      if (!oidcService.enabled) {
        return res.status(503).json({ message: 'OIDC not enabled (OIDC_ENABLED=true)' });
      }

      const secure =
        Boolean(req.secure) || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';

      const state = oidcService.generateState();
      // Path '/' : compatible Vite (/api/auth/...) et PROD (/auth/...).
      // Évite state_mismatch si le cookie est scoped sur /auth alors que le navigateur est sur /api/auth.
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
      });
    }
  });

  router.get('/oidc/callback', async (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || '';
    const relative = '/login/sso/callback';
    const redirectBase = frontendUrl
      ? `${frontendUrl.replace(/\\/+$/, '')}${relative}`
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
```

---

## 2) Frontend

### `frontend/src/i18n/translations.ts` (ajouter les clés i18n)

Dans `const en = { ... }`, ajoute :

```ts
  'login.sso': 'Sign in with SSO',
  'login.ssoFailed': 'SSO failed',
```

Dans `const fr = { ... }`, ajoute :

```ts
  'login.sso': 'Connexion SSO',
  'login.ssoFailed': 'SSO échoué',
```

---

### `frontend/src/pages/LoginPage.tsx` (remplacement complet)

```tsx
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Navbar } from '../components/Navbar';
import { useLocale } from '../context/LocaleContext';
import { getGreenPale } from '../theme';
import { setAuthToken, setSessionUser } from '../utils/sessionUser';

export function LoginPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const greenPale = getGreenPale(theme.palette.mode);
  const { t } = useLocale();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.login(username.trim(), password);
      setAuthToken(result.token);
      setSessionUser({
        id: result.user.id,
        fullName: result.user.fullName,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSso = () => {
    // En DEV Vite, seul /api est proxyé vers le backend (sauf si /auth est aussi proxyé).
    // Le backend retire le préfixe /api → /auth/oidc/start.
    // En PROD (même hôte), /api/auth/... ou /auth/... marchent tous les deux.
    const apiBase =
      import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '/api' : '');
    window.location.href = `${apiBase}/auth/oidc/start`;
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Navbar />
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 6,
        }}
      >
        <Paper
          elevation={0}
          component="form"
          onSubmit={(e) => void handleSubmit(e)}
          sx={{
            width: '100%',
            maxWidth: 420,
            p: 4,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: greenPale,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <LoginOutlinedIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          </Box>

          <Typography variant="h5" align="center" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t('login.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            {t('login.subtitle')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <TextField
              label={t('login.username')}
              fullWidth
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
            <TextField
              label={t('login.password')}
              type="password"
              fullWidth
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </Box>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LoginOutlinedIcon />}
            disabled={loading || !username.trim() || !password}
          >
            {t('login.submit')}
          </Button>

          <Button
            type="button"
            variant="outlined"
            fullWidth
            size="large"
            sx={{ mt: 2 }}
            onClick={handleSso}
            disabled={loading}
          >
            {t('login.sso')}
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}
```

---

### `frontend/src/pages/LoginSsoCallbackPage.tsx` (FICHIER NOUVEAU)

```tsx
import { Alert, Box, Button, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { setAuthToken, setSessionUser } from '../utils/sessionUser';

function parseHashParams(hash: string) {
  const raw = String(hash || '').replace(/^#/, '');
  const params = new URLSearchParams(raw);
  const token = params.get('token') || '';
  const error = params.get('error') || '';
  return { token, error };
}

export function LoginSsoCallbackPage() {
  const navigate = useNavigate();
  const { t } = useLocale();

  const [error, setError] = useState('');

  const { token, error: hashError } = useMemo(
    () => parseHashParams(window.location.hash),
    [],
  );

  useEffect(() => {
    const run = async () => {
      if (hashError) {
        setError(hashError);
        return;
      }

      if (!token) {
        setError('missing_token');
        return;
      }

      setAuthToken(token);

      try {
        const me = await api.me();
        setSessionUser({
          id: me.user.id,
          fullName: me.user.fullName,
        });
        navigate('/');
      } catch (err) {
        setError(err instanceof Error ? err.message : t('login.ssoFailed'));
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hashError, navigate, t]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 520 }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {t('login.ssoFailed')}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {error}
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button variant="outlined" onClick={() => navigate('/login')}>
                Retour login
              </Button>
            </Box>
          </Alert>
        ) : (
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Connexion SSO en cours…
          </Typography>
        )}
      </Box>
    </Box>
  );
}
```

---

### `frontend/vite.config.ts` (à adapter en DEV Vite)

**Avant**

```ts
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
},
```

**Après** (recommandé : proxy `/auth` en plus ; le bouton peut rester en `/api/auth/...`)

```ts
proxy: {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
  '/auth': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
},
```

Puis **redémarrer Vite**.

---

### `frontend/src/components/Navbar.tsx` (optionnel)

**Avant**

```ts
const isLoginPage = location.pathname === '/login';
```

**Après**

```ts
const isLoginPage = location.pathname.startsWith('/login');
```

---

### `frontend/src/App.tsx` (ajouter la route callback)

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LocaleProvider } from './context/LocaleContext';
import { ThemeModeProvider } from './context/ThemeModeContext';
import { ActivityPage } from './pages/ActivityPage';
import { HomePage } from './pages/HomePage';
import { KpiPage } from './pages/KpiPage';
import { LoginPage } from './pages/LoginPage';
import { LoginSsoCallbackPage } from './pages/LoginSsoCallbackPage';

function App() {
  return (
    <LocaleProvider>
      <ThemeModeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/kpi" element={<KpiPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/sso/callback" element={<LoginSsoCallbackPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ThemeModeProvider>
    </LocaleProvider>
  );
}

export default App;
```

