const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Issuer } = require('openid-client');

function mask(value, head = 6, tail = 2) {
  const s = value == null ? '' : String(value);
  if (!s) return '';
  if (s.length <= head + tail) return `${s.slice(0, head)}…`;
  return `${s.slice(0, head)}…${s.slice(-tail)} (len=${s.length})`;
}

function present(key) {
  const v = process.env[key];
  return v != null && String(v).trim() !== '';
}

function safeProjection(claims) {
  return {
    iss: claims && claims.iss,
    sub: claims && claims.sub,
    preferred_username: claims && (claims.preferred_username || claims.preferredUserName),
    name: claims && claims.name,
    email: claims && claims.email,
    uid: claims && claims.uid,
    user_id: claims && claims.user_id,
  };
}

class OidcService {
  constructor() {
    this.clientPromise = null;
    // Toujours loguer un snapshot masqué au boot (pour debug .env / 404).
    this.logEnvSnapshot('boot');
  }

  get enabled() {
    return String(process.env.OIDC_ENABLED || '').toLowerCase() === 'true';
  }

  get debug() {
    // true par défaut si OIDC_DEBUG non défini → plus simple pour le 1er setup
    if (process.env.OIDC_DEBUG == null || String(process.env.OIDC_DEBUG).trim() === '') {
      return true;
    }
    return String(process.env.OIDC_DEBUG).toLowerCase() === 'true';
  }

  log(...args) {
    if (!this.debug) return;
    console.log('[oidc]', ...args);
  }

  /** Snapshot safe des env OIDC (jamais le secret en clair). */
  getEnvSnapshot() {
    const required = ['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_REDIRECT_URI'];
    const missing = required.filter((k) => !present(k));
    return {
      cwd: process.cwd(),
      OIDC_ENABLED: process.env.OIDC_ENABLED || '(empty)',
      OIDC_DEBUG: process.env.OIDC_DEBUG || '(empty→default true)',
      enabled: this.enabled,
      OIDC_ISSUER: process.env.OIDC_ISSUER || '(missing)',
      OIDC_REDIRECT_URI: process.env.OIDC_REDIRECT_URI || '(missing)',
      OIDC_SCOPES: process.env.OIDC_SCOPES || '(default: openid profile)',
      FRONTEND_URL: process.env.FRONTEND_URL || '(missing)',
      OIDC_CLIENT_ID: present('OIDC_CLIENT_ID')
        ? mask(process.env.OIDC_CLIENT_ID, 4, 2)
        : '(missing)',
      OIDC_CLIENT_SECRET: present('OIDC_CLIENT_SECRET')
        ? `***len=${String(process.env.OIDC_CLIENT_SECRET).length}`
        : '(missing)',
      missing,
      hint_env_file: 'backend/.env (chargé par server.js ; restart Node après édition)',
    };
  }

  logEnvSnapshot(reason) {
    const snap = this.getEnvSnapshot();
    console.log(`[oidc-env] snapshot (${reason})`, snap);
    return snap;
  }

  requiredEnv() {
    const required = ['OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_REDIRECT_URI'];
    return required.filter((k) => !present(k));
  }

  async getClient() {
    if (this.clientPromise) return this.clientPromise;

    this.clientPromise = (async () => {
      const missing = this.requiredEnv();
      if (missing.length > 0) {
        this.logEnvSnapshot('missing-env-before-discover');
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

      // PKCE volontairement NON (aligné IdP corporate)
      return new issuer.Client({
        client_id: process.env.OIDC_CLIENT_ID,
        client_secret: process.env.OIDC_CLIENT_SECRET,
        redirect_uris: [process.env.OIDC_REDIRECT_URI],
        response_types: ['code'],
      });
    })().catch((err) => {
      this.clientPromise = null;
      throw err;
    });

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

    const tokenSet = await client.callback(redirectUri, { code, state }, { state });
    const claims = tokenSet.claims();

    this.log('callback exchange ok', {
      has_id_token: Boolean(tokenSet && tokenSet.id_token),
      has_access_token: Boolean(tokenSet && tokenSet.access_token),
      claims_debug: safeProjection(claims),
    });

    return { claims, tokenSet };
  }

  extractLdapUidFromClaims(claims) {
    const preferred =
      claims &&
      (claims.preferred_username || claims.preferredUserName || claims['preferred_username']);
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

  /**
   * Local Keycloak / lab without LDAP: AUTH_MODE=mock|dev → JWT app sans LDAP.
   * Prod / autre PC : mode LDAP normal (memberOf → rôle).
   */
  buildMockAppJwt(uid, claims) {
    const secret = process.env.JWT_SECRET || 'secret';
    const fullName =
      (claims && claims.name && String(claims.name).trim()) ||
      (claims && claims.preferred_username && String(claims.preferred_username).trim()) ||
      uid;
    const role = 'User';
    const token = jwt.sign(
      {
        sub: uid,
        role,
        name: fullName,
      },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
    );
    this.log('mock → jwt ok', { uid: mask(uid, 10, 4), role });
    return {
      token,
      role,
      user: {
        id: uid,
        fullName,
      },
    };
  }

  async buildAppJwtFromLdapUid({ authService, uid, claims }) {
    const mode = String(authService.mode || process.env.AUTH_MODE || '').toLowerCase();
    if (mode === 'mock' || mode === 'dev') {
      return this.buildMockAppJwt(uid, claims);
    }

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

      if (srv.bind_dn && !authService.isPlaceholderBind(srv)) {
        await authService.bind(client, srv.bind_dn, srv.bind_password || '');
      }

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
