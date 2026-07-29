const fs = require('fs');
const path = require('path');
const ldap = require('ldapjs');
const jwt = require('jsonwebtoken');

/**
 * LDAP authentication (ported from parftp-aps AuthService).
 * Config file: LDAP_TOML path or backend/ldap.toml
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
        },
      ];
      return;
    }

    if (!fs.existsSync(this.tomlPath)) {
      this.config.servers = [];
      return;
    }

    const raw = fs.readFileSync(this.tomlPath, 'utf8');
    this.config = this.parseToml(raw);
  }

  get isConfigured() {
    return this.mode === 'mock' || this.mode === 'dev' || this.config.servers.length > 0;
  }

  parseToml(raw) {
    const config = { servers: [] };
    let currentServer = {};

    for (const line of String(raw || '').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) continue;

      const match = trimmed.match(/^([a-z_]+)\s*=\s*(.+)$/i);
      if (!match) continue;

      const key = match[1].toLowerCase();
      let rawValue = match[2].trim();

      if (key === 'search_base_dns') {
        const withoutBrackets = rawValue.replace(/^\s*\[|\]\s*$/g, '');
        const matches = withoutBrackets.match(/"(.*?)"/g) || [];
        currentServer.search_base_dns =
          matches.length > 0
            ? matches.map((item) => item.replace(/^"|"$/g, ''))
            : withoutBrackets
              ? [withoutBrackets.replace(/^"|"$/g, '')]
              : [];
        continue;
      }

      if (key === 'group_mappings') {
        try {
          currentServer.group_mappings = JSON.parse(rawValue);
        } catch {
          currentServer.group_mappings = [];
        }
        continue;
      }

      let value = rawValue.replace(/^"|"$/g, '');
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^\d+$/.test(value)) value = parseInt(value, 10);

      currentServer[key] = value;
    }

    if (!currentServer.host || !currentServer.port) {
      throw new Error('Echec du parsing TOML - aucune configuration de serveur valide trouvée');
    }

    config.servers = [currentServer];
    return config;
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
    const tlsOptions = {};

    if (srv.root_ca_cert) {
      tlsOptions.ca = fs.readFileSync(srv.root_ca_cert);
    }
    tlsOptions.rejectUnauthorized = !srv.ssl_skip_verify;

    const client = ldap.createClient({ url, tlsOptions });
    if (srv.start_tls) {
      client.starttls(tlsOptions, null, (err) => {
        if (err) console.error('starttls error:', err.message || err);
      });
    }
    return client;
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

    let base = srv.search_base_dns[0];
    if (typeof base === 'string') {
      base = base
        .replace(/^\$+/g, '')
        .replace(/\$+$/g, '')
        .replace(/^"+|"+$/g, '')
        .trim();
    }

    const filter = String(srv.search_filter || '(uid=%s)').replace('%s', username);
    const opts = {
      filter,
      scope: 'sub',
      attributes: ['dn', 'memberOf', 'cn', 'displayName', 'givenName', 'sn'],
    };

    return new Promise((resolve, reject) => {
      let userDn = null;
      let displayName = null;

      client.search(base, opts, (err, res) => {
        if (err) return reject(err);

        res.on('searchEntry', (entry) => {
          const object = entry.object || {};
          const dn = object.dn || entry.dn;
          if (!dn) {
            console.warn('Entrée LDAP sans DN :', entry);
            return;
          }
          userDn = typeof dn === 'string' ? dn : String(dn);
          displayName =
            object.displayName ||
            object.cn ||
            [object.givenName, object.sn].filter(Boolean).join(' ') ||
            null;
        });

        res.on('error', (searchErr) => reject(searchErr));
        res.on('end', () => {
          if (!userDn) {
            reject(new Error(`Utilisateur ${username} introuvable`));
            return;
          }
          resolve({ userDn, displayName });
        });
      });
    });
  }

  async getUserGroups(client, userDn) {
    const opts = { scope: 'base', attributes: ['memberOf'] };
    return new Promise((resolve, reject) => {
      const groups = [];
      client.search(userDn, opts, (err, res) => {
        if (err) return reject(err);

        res.on('searchEntry', (entry) => {
          const memberOf = entry.object && entry.object.memberOf;
          if (Array.isArray(memberOf)) groups.push(...memberOf);
          else if (memberOf) groups.push(memberOf);
          else console.debug("Aucun attribut memberOf trouvé pour l'entrée LDAP", entry);
        });

        res.on('error', (searchErr) => reject(searchErr));
        res.on('end', () => resolve(groups));
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

    const client = this.createLdapClient();
    const srv = this.activeServer;

    try {
      if (srv.bind_dn) {
        await this.bind(client, srv.bind_dn, srv.bind_password || '');
      }

      const { userDn, displayName } = await this.searchUser(client, cleanUsername);
      const bindDn = typeof userDn === 'string' ? userDn : String(userDn);
      await this.bind(client, bindDn, cleanPassword);

      const groups = await this.getUserGroups(client, bindDn);
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
      console.error('LDAP authentication error:', err && err.message ? err.message : err);
      const failure = new Error('Authentication failed');
      failure.status = 401;
      throw failure;
    } finally {
      try {
        client.unbind();
      } catch {
        // ignore
      }
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

module.exports = AuthService;
