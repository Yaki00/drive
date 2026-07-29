const fs = require('fs');
const path = require('path');
const ldap = require('ldapjs');
const jwt = require('jsonwebtoken');

/**
 * LDAP authentication (ported from parftp-aps AuthService).
 * Config file: LDAP_TOML path or backend/ldap.toml
 * Env overrides (priority over TOML): LDAP_BIND_DN, LDAP_BIND_PASSWORD, …
 * Mock mode: AUTH_MODE=mock (no LDAP required) for local tests.
 */
class AuthService {
  constructor(options = {}) {
    this.tomlPath =
      options.tomlPath ||
      process.env.LDAP_TOML ||
      path.join(__dirname, '..', '..', 'ldap.toml');
    this.mode = String(options.mode || process.env.AUTH_MODE || '').toLowerCase();
    this.config = { servers: [] };
    this.loadConfig();
  }

  loadConfig() {
    if (this.mode === 'mock' || this.mode === 'dev') {
      this.config.servers = [
        {
          host: 'mock',
          port: 389,
          use_ssl: false,
          start_tls: false,
          ssl_skip_verify: true,
          bind_dn: '',
          bind_password: '',
          search_base_dns: ['ou=users,dc=mock'],
          search_filter: '(uid=%s)',
          group_mappings: [],
          attributes: {},
        },
      ];
      return;
    }

    if (fs.existsSync(this.tomlPath)) {
      const raw = fs.readFileSync(this.tomlPath, 'utf8');
      this.config = this.parseToml(raw);
      this.resolveCertPaths();
    } else {
      this.config.servers = [];
    }

    this.applyEnvOverrides();
  }

  /**
   * Env vars override / complete ldap.toml (typical enterprise setup).
   * Placeholders like bind_dn="bind_dn" are OK when LDAP_BIND_* is set.
   */
  applyEnvOverrides() {
    const env = process.env;
    const bindDn = firstEnv(env, ['LDAP_BIND_DN', 'BIND_DN']);
    const bindPassword = firstEnv(env, ['LDAP_BIND_PASSWORD', 'BIND_PASSWORD']);
    const host = firstEnv(env, ['LDAP_HOST', 'LDAP_URL']);
    const port = firstEnv(env, ['LDAP_PORT']);
    const useSsl = parseEnvBool(firstEnv(env, ['LDAP_USE_SSL', 'LDAP_SSL']));
    const startTls = parseEnvBool(firstEnv(env, ['LDAP_START_TLS']));
    const sslSkipVerify = parseEnvBool(
      firstEnv(env, ['LDAP_SSL_SKIP_VERIFY', 'LDAP_TLS_SKIP_VERIFY']),
    );
    const searchFilter = firstEnv(env, ['LDAP_SEARCH_FILTER']);
    const searchBase = firstEnv(env, ['LDAP_SEARCH_BASE', 'LDAP_SEARCH_BASE_DNS']);
    const rootCa = firstEnv(env, ['LDAP_ROOT_CA_CERT', 'LDAP_CA_CERT']);

    const hasAny =
      bindDn != null ||
      bindPassword != null ||
      host != null ||
      port != null ||
      useSsl != null ||
      startTls != null ||
      sslSkipVerify != null ||
      searchFilter != null ||
      searchBase != null ||
      rootCa != null;

    if (!hasAny) return;

    if (!this.config.servers || this.config.servers.length === 0) {
      this.config.servers = [
        {
          host: host || 'localhost',
          port: port != null ? Number(port) : 389,
          use_ssl: useSsl === true,
          start_tls: startTls === true,
          ssl_skip_verify: sslSkipVerify !== false,
          bind_dn: '',
          bind_password: '',
          search_base_dns: [],
          search_filter: '(uid=%s)',
          group_mappings: [],
          attributes: {},
        },
      ];
    }

    const srv = this.config.servers[0];
    if (bindDn != null) srv.bind_dn = bindDn;
    if (bindPassword != null) srv.bind_password = bindPassword;
    if (host != null) {
      // Allow LDAP_URL=ldaps://host:636 — keep host only if plain hostname.
      const urlMatch = String(host).match(/^ldaps?:\/\/([^/:]+)/i);
      srv.host = urlMatch ? urlMatch[1] : host;
      if (urlMatch && /^ldaps:/i.test(host) && useSsl == null) srv.use_ssl = true;
    }
    if (port != null && String(port).trim() !== '') srv.port = Number(port);
    if (useSsl != null) srv.use_ssl = useSsl;
    if (startTls != null) srv.start_tls = startTls;
    if (sslSkipVerify != null) srv.ssl_skip_verify = sslSkipVerify;
    if (searchFilter != null) srv.search_filter = searchFilter;
    if (searchBase != null) {
      // Multiple bases: separate with ";" (DN values already contain commas).
      const parts = String(searchBase)
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      srv.search_base_dns = parts.length > 0 ? parts : [String(searchBase).trim()];
    }
    if (rootCa != null) {
      srv.root_ca_cert = path.isAbsolute(rootCa)
        ? rootCa
        : path.resolve(path.dirname(path.resolve(this.tomlPath)), rootCa);
    }
  }

  resolveCertPaths() {
    const baseDir = path.dirname(path.resolve(this.tomlPath));
    for (const server of this.config.servers || []) {
      if (!server.root_ca_cert) continue;
      if (path.isAbsolute(server.root_ca_cert)) continue;
      server.root_ca_cert = path.resolve(baseDir, server.root_ca_cert);
    }
  }

  isPlaceholderBind(srv) {
    const dn = String(srv.bind_dn || '').trim();
    const pw = String(srv.bind_password || '').trim();
    return (
      !dn ||
      !pw ||
      dn === 'bind_dn' ||
      pw === 'bind_password' ||
      pw === 'CHANGE_ME'
    );
  }

  get isConfigured() {
    return this.mode === 'mock' || this.mode === 'dev' || this.config.servers.length > 0;
  }

  /**
   * Supports both flat keys and the enterprise TOML shape:
   * [[servers]] / [servers.attributes] / [[servers.group_mappings]]
   */
  parseToml(raw) {
    const config = { servers: [] };
    let currentServer = null;
    let section = 'root'; // root | server | attributes | group_mapping
    let currentMapping = null;

    const ensureServer = () => {
      if (!currentServer) {
        currentServer = { group_mappings: [], attributes: {} };
      }
      if (!Array.isArray(currentServer.group_mappings)) currentServer.group_mappings = [];
      if (!currentServer.attributes || typeof currentServer.attributes !== 'object') {
        currentServer.attributes = {};
      }
      return currentServer;
    };

    for (const line of String(raw || '').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const sectionMatch = trimmed.match(/^\[+([^\]]+)\]+$/);
      if (sectionMatch) {
        const name = sectionMatch[1].trim().toLowerCase();
        if (name === 'servers' || name.startsWith('servers.')) {
          if (name === 'servers') {
            if (currentMapping && currentServer) {
              currentServer.group_mappings.push(currentMapping);
              currentMapping = null;
            }
            if (currentServer && currentServer.host) {
              config.servers.push(currentServer);
            }
            currentServer = { group_mappings: [], attributes: {} };
            section = 'server';
          } else if (name === 'servers.attributes') {
            ensureServer();
            section = 'attributes';
          } else if (name === 'servers.group_mappings') {
            ensureServer();
            if (currentMapping) currentServer.group_mappings.push(currentMapping);
            currentMapping = {};
            section = 'group_mapping';
          }
        }
        continue;
      }

      const match = trimmed.match(/^([a-z_]+)\s*=\s*(.+)$/i);
      if (!match) continue;

      const key = match[1].toLowerCase();
      let rawValue = match[2].trim();
      const value = this.parseTomlValue(key, rawValue);

      if (section === 'group_mapping') {
        if (!currentMapping) currentMapping = {};
        currentMapping[key] = value;
        continue;
      }

      const server = ensureServer();
      if (section === 'attributes') {
        server.attributes[key] = value;
        continue;
      }

      if (key === 'search_base_dns') {
        server.search_base_dns = Array.isArray(value) ? value : [String(value)];
        continue;
      }
      if (key === 'group_mappings' && Array.isArray(value)) {
        server.group_mappings = value;
        continue;
      }
      server[key] = value;
    }

    if (currentMapping && currentServer) {
      currentServer.group_mappings.push(currentMapping);
    }
    if (currentServer && currentServer.host && currentServer.port) {
      config.servers.push(currentServer);
    }

    // Flat file without [[servers]] header still works.
    if (config.servers.length === 0 && currentServer && currentServer.host && currentServer.port) {
      config.servers.push(currentServer);
    }

    if (config.servers.length === 0) {
      throw new Error('Echec du parsing TOML - aucune configuration de serveur valide trouvée');
    }

    return config;
  }

  parseTomlValue(key, rawValue) {
    if (key === 'search_base_dns') {
      const withoutBrackets = rawValue.replace(/^\s*\[|\]\s*$/g, '');
      const matches = withoutBrackets.match(/"(.*?)"/g) || [];
      if (matches.length > 0) return matches.map((item) => item.replace(/^"|"$/g, ''));
      return withoutBrackets ? [withoutBrackets.replace(/^"|"$/g, '')] : [];
    }

    if (key === 'group_mappings') {
      try {
        return JSON.parse(rawValue);
      } catch {
        return [];
      }
    }

    let value = rawValue.replace(/^"|"$/g, '');
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    return value;
  }

  get activeServer() {
    if (!this.config.servers || this.config.servers.length === 0) {
      throw new Error("Aucun serveur LDAP n'est configuré dans ldap.toml");
    }
    return this.config.servers[0];
  }

  createLdapClient() {
    const srv = this.activeServer;
    const protocol = srv.use_ssl ? 'ldaps' : 'ldap';
    const url = `${protocol}://${srv.host}:${srv.port}`;
    const tlsOptions = {
      // Needed for SNI on many corporate LDAPS endpoints.
      servername: srv.host,
      rejectUnauthorized: !srv.ssl_skip_verify,
    };

    if (srv.root_ca_cert) {
      if (!fs.existsSync(srv.root_ca_cert)) {
        throw new Error(`root_ca_cert introuvable: ${srv.root_ca_cert}`);
      }
      tlsOptions.ca = loadCaCertificates(srv.root_ca_cert);
    }

    const client = ldap.createClient({
      url,
      tlsOptions,
      reconnect: false,
      connectTimeout: Number(process.env.LDAP_CONNECT_TIMEOUT_MS || 10000),
      timeout: Number(process.env.LDAP_TIMEOUT_MS || 15000),
    });

    // Without listeners, ldapjs kills the Node process on socket/TLS errors.
    const swallow = (err) => {
      console.error('LDAP client error:', formatLdapErr(err));
    };
    client.on('error', swallow);
    client.on('connectError', swallow);
    client.on('timeout', swallow);
    client.on('resultError', swallow);

    if (srv.start_tls) {
      client.starttls(tlsOptions, null, (err) => {
        if (err) console.error('starttls error:', formatLdapErr(err));
      });
    }
    return client;
  }

  destroyClient(client) {
    if (!client) return;
    try {
      if (typeof client.destroy === 'function') {
        client.destroy();
        return;
      }
    } catch (err) {
      console.error('LDAP destroy error:', formatLdapErr(err));
    }
    try {
      client.unbind(() => {});
    } catch {
      // ignore
    }
  }

  bind(client, dn, password) {
    return new Promise((resolve, reject) => {
      client.bind(dn, password, (err) => (err ? reject(err) : resolve()));
    });
  }

  async searchUser(client, username) {
    const srv = this.activeServer;
    if (!Array.isArray(srv.search_base_dns) || srv.search_base_dns.length === 0) {
      throw new Error('search_base_dns est vide ou mal formaté');
    }

    const bases = srv.search_base_dns
      .map((base) =>
        String(base || '')
          .replace(/^\$+/g, '')
          .replace(/\$+$/g, '')
          .replace(/^"+|"+$/g, '')
          .trim(),
      )
      .filter(Boolean);

    const filterAttr = (srv.attributes && srv.attributes.username) || 'uid';
    const nameAttr = (srv.attributes && srv.attributes.name) || 'givenName';
    const surnameAttr = (srv.attributes && srv.attributes.surname) || 'sn';
    const memberAttr = (srv.attributes && srv.attributes.member_of) || 'memberOf';

    const filterTemplate = String(srv.search_filter || `(${filterAttr}=%s)`);
    const filter = filterTemplate.replace('%s', escapeLdapFilterValue(username));
    const opts = {
      filter,
      scope: 'sub',
      attributes: [memberAttr, 'cn', 'displayName', nameAttr, surnameAttr, 'mail'],
    };

    let lastErr = null;
    for (const base of bases) {
      try {
        return await this.searchUserInBase(client, base, opts, nameAttr, surnameAttr, username);
      } catch (err) {
        lastErr = err;
        console.error(`LDAP search failed on base "${base}":`, formatLdapErr(err));
      }
    }
    throw lastErr || new Error(`Utilisateur ${username} introuvable`);
  }

  searchUserInBase(client, base, opts, nameAttr, surnameAttr, username) {
    return new Promise((resolve, reject) => {
      let userDn = null;
      let displayName = null;
      let settled = false;
      const finish = (err, value) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve(value);
      };

      client.search(base, opts, (err, res) => {
        if (err) return finish(err);

        res.on('searchEntry', (entry) => {
          const object = ldapEntryToObject(entry);
          const dn = object.dn;
          if (!dn) {
            console.warn('Entrée LDAP sans DN');
            return;
          }
          userDn = dn;
          displayName =
            object.displayName ||
            object.cn ||
            [object[nameAttr], object[surnameAttr]].filter(Boolean).join(' ') ||
            null;
        });

        res.on('error', (searchErr) => finish(searchErr));
        res.on('end', () => {
          if (!userDn) {
            finish(new Error(`Utilisateur ${username} introuvable`));
            return;
          }
          finish(null, { userDn, displayName });
        });
      });
    });
  }

  async getUserGroups(client, userDn) {
    const srv = this.activeServer;
    const memberAttr = (srv.attributes && srv.attributes.member_of) || 'memberOf';
    const opts = { scope: 'base', attributes: [memberAttr] };
    return new Promise((resolve, reject) => {
      const groups = [];
      let settled = false;
      const finish = (err, value) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve(value);
      };

      client.search(userDn, opts, (err, res) => {
        if (err) return finish(err);

        res.on('searchEntry', (entry) => {
          const object = ldapEntryToObject(entry);
          const memberOf = object[memberAttr];
          if (Array.isArray(memberOf)) groups.push(...memberOf);
          else if (memberOf) groups.push(memberOf);
        });

        res.on('error', (searchErr) => finish(searchErr));
        res.on('end', () => finish(null, groups));
      });
    });
  }

  mapGroupToRole(groups) {
    const srv = this.activeServer;
    const list = Array.isArray(groups) ? groups : [];

    if (Array.isArray(srv.group_mappings)) {
      for (const mapping of srv.group_mappings) {
        if (list.some((group) => String(group).includes(String(mapping.group_dn)))) {
          return mapping.org_role;
        }
      }
    }

    if (list.some((group) => String(group).includes('APP_ADMIN'))) return 'Admin';
    if (list.some((group) => String(group).includes('APP_USER'))) return 'User';
    return 'User';
  }

  async validateUser(username, password) {
    const cleanUsername =
      typeof username === 'string' ? username.replace(/^"+|"+$/g, '').trim() : '';
    const cleanPassword =
      typeof password === 'string' ? password.replace(/^"+|"+$/g, '').trim() : String(password ?? '');

    if (!cleanUsername || !cleanPassword) {
      const err = new Error('Username and password required');
      err.status = 400;
      throw err;
    }

    if (this.mode === 'mock' || this.mode === 'dev') {
      return this.validateMockUser(cleanUsername, cleanPassword);
    }

    let client;
    const srv = this.activeServer;

    try {
      client = this.createLdapClient();

      if (srv.bind_dn) {
        if (this.isPlaceholderBind(srv)) {
          throw Object.assign(
            new Error(
              'LDAP bind credentials manquants: définis LDAP_BIND_DN / LDAP_BIND_PASSWORD dans .env (ou remplace les placeholders dans ldap.toml)',
            ),
            { status: 500 },
          );
        }
        console.log('LDAP: binding service account…');
        await this.bind(client, srv.bind_dn, srv.bind_password || '');
        console.log('LDAP: service bind ok');
      }

      console.log(`LDAP: searching user "${cleanUsername}"…`);
      const { userDn, displayName } = await this.searchUser(client, cleanUsername);
      const bindDn = typeof userDn === 'string' ? userDn : String(userDn);
      console.log(`LDAP: user found, binding as ${bindDn}`);
      await this.bind(client, bindDn, cleanPassword);
      console.log('LDAP: user bind ok');

      let groups = [];
      try {
        groups = await this.getUserGroups(client, bindDn);
      } catch (groupErr) {
        // Group lookup must not kill login if memberOf is restricted.
        console.error('LDAP groups lookup failed:', formatLdapErr(groupErr));
      }
      const role = this.mapGroupToRole(groups);
      const secret = process.env.JWT_SECRET || 'secret';
      const token = jwt.sign(
        {
          sub: cleanUsername,
          role,
          name: displayName || cleanUsername,
        },
        secret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
      );

      return {
        role,
        token,
        user: {
          id: cleanUsername,
          fullName: displayName || cleanUsername,
          role,
        },
      };
    } catch (err) {
      console.error('LDAP authentication error:', formatLdapErr(err));
      const failure = new Error(
        err && err.status === 500 ? err.message : 'Authentication failed',
      );
      failure.status = err && err.status === 500 ? 500 : 401;
      throw failure;
    } finally {
      this.destroyClient(client);
    }
  }

  validateMockUser(username, password) {
    // Local/dev users — not for production.
    const users = {
      admin: { password: 'admin', role: 'Admin', fullName: 'Admin User' },
      user: { password: 'user', role: 'User', fullName: 'Demo User' },
      guest: { password: 'guest', role: 'User', fullName: 'Guest' },
    };
    const found = users[username.toLowerCase()];
    if (!found || found.password !== password) {
      const err = new Error('Authentication failed');
      err.status = 401;
      throw err;
    }

    const secret = process.env.JWT_SECRET || 'secret';
    const token = jwt.sign(
      { sub: username, role: found.role, name: found.fullName },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
    );

    return {
      role: found.role,
      token,
      user: { id: username, fullName: found.fullName, role: found.role },
    };
  }

  async login(username, password) {
    const result = await this.validateUser(username, password);
    return {
      token: result.token,
      role: result.role,
      user: result.user,
    };
  }

  verifyToken(token) {
    const secret = process.env.JWT_SECRET || 'secret';
    return jwt.verify(token, secret);
  }
}

function firstEnv(env, keys) {
  for (const key of keys) {
    if (env[key] != null && String(env[key]).trim() !== '') return String(env[key]);
  }
  return null;
}

function parseEnvBool(value) {
  if (value == null) return null;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return null;
}

function formatLdapErr(err) {
  if (!err) return String(err);
  const parts = [err.message || err.name || String(err)];
  if (err.code != null) parts.push(`code=${err.code}`);
  if (err.name && err.name !== err.message) parts.push(`name=${err.name}`);
  return parts.join(' | ');
}

function escapeLdapFilterValue(value) {
  return String(value).replace(/([\\*()])/g, '\\$1');
}

/** ldapjs@3 exposes entry.pojo; older code used entry.object. */
function ldapEntryToObject(entry) {
  if (!entry) return {};
  if (entry.object && typeof entry.object === 'object') {
    const object = { ...entry.object };
    if (!object.dn && entry.dn) object.dn = String(entry.dn);
    return object;
  }

  const pojo = entry.pojo || {};
  const object = {
    dn: pojo.objectName || (entry.dn != null ? String(entry.dn) : null),
  };
  for (const attr of pojo.attributes || []) {
    const values = Array.isArray(attr.values) ? attr.values : [];
    if (!attr.type) continue;
    object[attr.type] = values.length <= 1 ? values[0] : values;
  }
  return object;
}

/** Accept PEM or binary DER (.cer) CA files. */
function loadCaCertificates(certPath) {
  const buf = fs.readFileSync(certPath);
  const asText = buf.toString('utf8');
  if (asText.includes('BEGIN CERTIFICATE')) return [buf];

  const b64 = buf.toString('base64').match(/.{1,64}/g) || [];
  const pem = `-----BEGIN CERTIFICATE-----\n${b64.join('\n')}\n-----END CERTIFICATE-----\n`;
  return [Buffer.from(pem, 'utf8')];
}

module.exports = AuthService;
