const fs = require('fs');
const path = require('path');
const ldap = require('ldapjs');
const jwt = require('jsonwebtoken');

/**
 * LDAP authentication (ported from parftp-aps AuthService).
 * Config file: LDAP_TOML path or backend/ldap.toml
 * Env overrides (priority over TOML): LDAP_BIND_DN, LDAP_BIND_PASSWORD, …
 * Mock mode: AUTH_MODE=mock (no LDAP required) for local tests.
 * Verbose logs: AUTH_DEBUG=false to reduce noise (default: max logs).
 */
const AUTH_DEBUG = String(process.env.AUTH_DEBUG || 'true').toLowerCase() !== 'false';

function ldapLog(...args) {
  if (!AUTH_DEBUG) return;
  const ts = new Date().toISOString();
  console.log(`[${ts}] [auth]`, ...args);
}

function ldapWarn(...args) {
  const ts = new Date().toISOString();
  console.warn(`[${ts}] [auth]`, ...args);
}

function ldapErr(...args) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] [auth]`, ...args);
}

class AuthService {
  constructor(options = {}) {
    this.tomlPath =
      options.tomlPath ||
      process.env.LDAP_TOML ||
      path.join(__dirname, '..', '..', 'ldap.toml');
    this.mode = String(options.mode || process.env.AUTH_MODE || '').toLowerCase();
    this.config = { servers: [] };
    ldapLog('AuthService init', {
      mode: this.mode || '(empty → ldap)',
      tomlPath: this.tomlPath,
      cwd: process.cwd(),
      node: process.version,
      platform: process.platform,
      authDebug: AUTH_DEBUG,
    });
    this.loadConfig();
    this.logConfigSummary('after loadConfig');
  }

  logConfigSummary(label) {
    try {
      const srv = this.config.servers && this.config.servers[0];
      ldapLog(`config summary (${label})`, {
        mode: this.mode || '(ldap)',
        configured: this.isConfigured,
        servers: (this.config.servers || []).length,
        host: srv && srv.host,
        port: srv && srv.port,
        use_ssl: srv && srv.use_ssl,
        start_tls: srv && srv.start_tls,
        ssl_skip_verify: srv && srv.ssl_skip_verify,
        search_filter: srv && srv.search_filter,
        search_base_dns: srv && srv.search_base_dns,
        attributes: srv && srv.attributes,
        group_mappings: srv && (srv.group_mappings || []).length,
        bind_dn: srv && maskSecret(srv.bind_dn, 24),
        bind_password: srv && maskSecret(srv.bind_password, 0),
        bind_placeholder: srv ? this.isPlaceholderBind(srv) : null,
        root_ca_cert: srv && srv.root_ca_cert,
        root_ca_exists: srv && srv.root_ca_cert ? fs.existsSync(srv.root_ca_cert) : false,
        env: {
          LDAP_BIND_DN: maskSecret(process.env.LDAP_BIND_DN, 24),
          LDAP_BIND_PASSWORD: maskSecret(process.env.LDAP_BIND_PASSWORD, 0),
          LDAP_HOST: process.env.LDAP_HOST || null,
          LDAP_PORT: process.env.LDAP_PORT || null,
          LDAP_SSL_SKIP_VERIFY: process.env.LDAP_SSL_SKIP_VERIFY || null,
          AUTH_MODE: process.env.AUTH_MODE || null,
        },
      });
    } catch (err) {
      ldapErr('config summary failed', formatLdapErr(err));
    }
  }

  loadConfig() {
    ldapLog('loadConfig start');
    if (this.mode === 'mock' || this.mode === 'dev') {
      ldapLog('loadConfig → mock/dev servers');
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
      ldapLog('reading ldap.toml', this.tomlPath);
      const raw = fs.readFileSync(this.tomlPath, 'utf8');
      ldapLog('ldap.toml bytes', raw.length, 'lines', raw.split(/\r?\n/).length);
      this.config = this.parseToml(raw);
      ldapLog('parsed servers', this.config.servers.length);
      this.resolveCertPaths();
    } else {
      ldapWarn('ldap.toml NOT FOUND', this.tomlPath);
      this.config.servers = [];
    }

    this.applyEnvOverrides();
    ldapLog('loadConfig done');
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

    const applied = {
      LDAP_BIND_DN: bindDn != null,
      LDAP_BIND_PASSWORD: bindPassword != null,
      LDAP_HOST: host != null,
      LDAP_PORT: port != null,
      LDAP_USE_SSL: useSsl != null,
      LDAP_START_TLS: startTls != null,
      LDAP_SSL_SKIP_VERIFY: sslSkipVerify != null,
      LDAP_SEARCH_FILTER: searchFilter != null,
      LDAP_SEARCH_BASE: searchBase != null,
      LDAP_ROOT_CA_CERT: rootCa != null,
    };
    ldapLog('applyEnvOverrides detected', applied);

    const hasAny = Object.values(applied).some(Boolean);
    if (!hasAny) {
      ldapLog('applyEnvOverrides: nothing to apply');
      return;
    }

    if (!this.config.servers || this.config.servers.length === 0) {
      ldapWarn('applyEnvOverrides: creating server from env only');
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
    if (bindDn != null) {
      srv.bind_dn = bindDn;
      ldapLog('override bind_dn', maskSecret(bindDn, 24));
    }
    if (bindPassword != null) {
      srv.bind_password = bindPassword;
      ldapLog('override bind_password', maskSecret(bindPassword, 0));
    }
    if (host != null) {
      const urlMatch = String(host).match(/^ldaps?:\/\/([^/:]+)/i);
      srv.host = urlMatch ? urlMatch[1] : host;
      if (urlMatch && /^ldaps:/i.test(host) && useSsl == null) srv.use_ssl = true;
      ldapLog('override host', srv.host);
    }
    if (port != null && String(port).trim() !== '') {
      srv.port = Number(port);
      ldapLog('override port', srv.port);
    }
    if (useSsl != null) {
      srv.use_ssl = useSsl;
      ldapLog('override use_ssl', srv.use_ssl);
    }
    if (startTls != null) {
      srv.start_tls = startTls;
      ldapLog('override start_tls', srv.start_tls);
    }
    if (sslSkipVerify != null) {
      srv.ssl_skip_verify = sslSkipVerify;
      ldapLog('override ssl_skip_verify', srv.ssl_skip_verify);
    }
    if (searchFilter != null) {
      srv.search_filter = searchFilter;
      ldapLog('override search_filter', srv.search_filter);
    }
    if (searchBase != null) {
      const parts = String(searchBase)
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      srv.search_base_dns = parts.length > 0 ? parts : [String(searchBase).trim()];
      ldapLog('override search_base_dns', srv.search_base_dns);
    }
    if (rootCa != null) {
      srv.root_ca_cert = path.isAbsolute(rootCa)
        ? rootCa
        : path.resolve(path.dirname(path.resolve(this.tomlPath)), rootCa);
      ldapLog('override root_ca_cert', srv.root_ca_cert);
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
    const connectTimeout = Number(process.env.LDAP_CONNECT_TIMEOUT_MS || 10000);
    const timeout = Number(process.env.LDAP_TIMEOUT_MS || 15000);
    const tlsOptions = {
      servername: srv.host,
      rejectUnauthorized: !srv.ssl_skip_verify,
    };

    ldapLog('createLdapClient', {
      url,
      connectTimeout,
      timeout,
      start_tls: Boolean(srv.start_tls),
      rejectUnauthorized: tlsOptions.rejectUnauthorized,
      servername: tlsOptions.servername,
      root_ca_cert: srv.root_ca_cert || null,
    });

    if (srv.root_ca_cert) {
      if (!fs.existsSync(srv.root_ca_cert)) {
        throw new Error(`root_ca_cert introuvable: ${srv.root_ca_cert}`);
      }
      const caList = loadCaCertificates(srv.root_ca_cert);
      tlsOptions.ca = caList;
      ldapLog('CA loaded', {
        path: srv.root_ca_cert,
        entries: caList.length,
        firstBytes: caList[0] ? caList[0].slice(0, 40).toString('utf8') : null,
        size: caList[0] ? caList[0].length : 0,
      });
    } else {
      ldapWarn('no root_ca_cert configured');
    }

    const client = ldap.createClient({
      url,
      tlsOptions,
      reconnect: false,
      connectTimeout,
      timeout,
    });

    const onEvent = (event) => (err) => {
      ldapErr(`client event "${event}"`, formatLdapErr(err), err && err.stack ? err.stack : '');
    };
    client.on('error', onEvent('error'));
    client.on('connectError', onEvent('connectError'));
    client.on('connectTimeout', onEvent('connectTimeout'));
    client.on('connectRefused', onEvent('connectRefused'));
    client.on('connect', () => ldapLog('client event "connect"'));
    client.on('timeout', onEvent('timeout'));
    client.on('resultError', onEvent('resultError'));
    client.on('end', () => ldapLog('client event "end"'));
    client.on('close', () => ldapLog('client event "close"'));
    client.on('destroy', () => ldapLog('client event "destroy"'));

    if (srv.start_tls) {
      ldapLog('starttls begin');
      client.starttls(tlsOptions, null, (err) => {
        if (err) ldapErr('starttls error', formatLdapErr(err));
        else ldapLog('starttls ok');
      });
    }
    ldapLog('createLdapClient done');
    return client;
  }

  destroyClient(client) {
    if (!client) {
      ldapLog('destroyClient: no client');
      return;
    }
    ldapLog('destroyClient begin');
    try {
      if (typeof client.destroy === 'function') {
        client.destroy();
        ldapLog('destroyClient destroy() ok');
        return;
      }
    } catch (err) {
      ldapErr('destroyClient destroy error', formatLdapErr(err));
    }
    try {
      client.unbind((err) => {
        if (err) ldapErr('destroyClient unbind error', formatLdapErr(err));
        else ldapLog('destroyClient unbind ok');
      });
    } catch (err) {
      ldapErr('destroyClient unbind threw', formatLdapErr(err));
    }
  }

  bind(client, dn, password) {
    const started = Date.now();
    ldapLog('bind begin', { dn: maskSecret(dn, 48), password: maskSecret(password, 0) });
    return new Promise((resolve, reject) => {
      client.bind(dn, password, (err) => {
        const ms = Date.now() - started;
        if (err) {
          ldapErr('bind failed', { dn: maskSecret(dn, 48), ms, err: formatLdapErr(err) });
          reject(err);
          return;
        }
        ldapLog('bind ok', { dn: maskSecret(dn, 48), ms });
        resolve();
      });
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

    ldapLog('searchUser begin', { username, bases, opts });

    let lastErr = null;
    for (const base of bases) {
      try {
        ldapLog('searchUser trying base', base);
        const found = await this.searchUserInBase(
          client,
          base,
          opts,
          nameAttr,
          surnameAttr,
          username,
        );
        ldapLog('searchUser found', found);
        return found;
      } catch (err) {
        lastErr = err;
        ldapErr(`searchUser failed on base "${base}"`, formatLdapErr(err));
      }
    }
    throw lastErr || new Error(`Utilisateur ${username} introuvable`);
  }

  searchUserInBase(client, base, opts, nameAttr, surnameAttr, username) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      let userDn = null;
      let displayName = null;
      let entryCount = 0;
      let settled = false;
      const finish = (err, value) => {
        if (settled) return;
        settled = true;
        ldapLog('searchUserInBase finish', {
          base,
          ms: Date.now() - started,
          entryCount,
          ok: !err,
          err: err ? formatLdapErr(err) : null,
          userDn,
        });
        if (err) reject(err);
        else resolve(value);
      };

      client.search(base, opts, (err, res) => {
        if (err) {
          ldapErr('search callback error', formatLdapErr(err));
          return finish(err);
        }
        ldapLog('search request accepted', base);

        res.on('searchEntry', (entry) => {
          entryCount += 1;
          const object = ldapEntryToObject(entry);
          ldapLog('searchEntry', {
            n: entryCount,
            dn: object.dn,
            keys: Object.keys(object),
            cn: object.cn,
            mail: object.mail,
          });
          const dn = object.dn;
          if (!dn) {
            ldapWarn('searchEntry without DN');
            return;
          }
          userDn = dn;
          displayName =
            object.displayName ||
            object.cn ||
            [object[nameAttr], object[surnameAttr]].filter(Boolean).join(' ') ||
            null;
        });

        res.on('searchReference', (ref) => {
          ldapWarn('searchReference (referral)', ref && (ref.uris || ref));
        });

        res.on('error', (searchErr) => {
          ldapErr('search result error', formatLdapErr(searchErr));
          finish(searchErr);
        });
        res.on('end', (result) => {
          ldapLog('search end', {
            status: result && result.status,
            entryCount,
            userDn,
          });
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
    ldapLog('getUserGroups begin', { userDn, memberAttr });
    return new Promise((resolve, reject) => {
      const groups = [];
      let settled = false;
      const finish = (err, value) => {
        if (settled) return;
        settled = true;
        if (err) {
          ldapErr('getUserGroups failed', formatLdapErr(err));
          reject(err);
        } else {
          ldapLog('getUserGroups ok', { count: value.length, groups: value });
          resolve(value);
        }
      };

      client.search(userDn, opts, (err, res) => {
        if (err) return finish(err);

        res.on('searchEntry', (entry) => {
          const object = ldapEntryToObject(entry);
          const memberOf = object[memberAttr];
          ldapLog('getUserGroups entry', {
            keys: Object.keys(object),
            memberOfType: Array.isArray(memberOf) ? 'array' : typeof memberOf,
          });
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
    ldapLog('mapGroupToRole', {
      groupsCount: list.length,
      mappings: (srv.group_mappings || []).map((m) => ({
        group_dn: m.group_dn,
        org_role: m.org_role,
      })),
    });

    if (Array.isArray(srv.group_mappings)) {
      for (const mapping of srv.group_mappings) {
        if (list.some((group) => String(group).includes(String(mapping.group_dn)))) {
          ldapLog('mapGroupToRole matched', mapping.org_role, mapping.group_dn);
          return mapping.org_role;
        }
      }
    }

    if (list.some((group) => String(group).includes('APP_ADMIN'))) return 'Admin';
    if (list.some((group) => String(group).includes('APP_USER'))) return 'User';
    ldapLog('mapGroupToRole default → User');
    return 'User';
  }

  async diagnose() {
    ldapLog('diagnose start');
    if (this.mode === 'mock' || this.mode === 'dev') {
      return { ok: true, mode: this.mode, steps: [{ step: 'mock', ok: true }] };
    }

    const steps = [];
    let client;
    try {
      const srv = this.activeServer;
      steps.push({
        step: 'config',
        ok: true,
        host: srv.host,
        port: srv.port,
        use_ssl: Boolean(srv.use_ssl),
        search_base_dns: srv.search_base_dns,
        bind_dn_set: Boolean(srv.bind_dn && !this.isPlaceholderBind(srv)),
        ca: srv.root_ca_cert || null,
      });
      ldapLog('diagnose step config', steps[0]);

      client = this.createLdapClient();
      steps.push({ step: 'client', ok: true });
      ldapLog('diagnose step client ok');

      if (srv.bind_dn && !this.isPlaceholderBind(srv)) {
        await this.bind(client, srv.bind_dn, srv.bind_password || '');
        steps.push({ step: 'service_bind', ok: true });
        ldapLog('diagnose step service_bind ok');
      } else {
        steps.push({ step: 'service_bind', ok: false, error: 'missing bind credentials' });
        ldapErr('diagnose service_bind missing credentials');
        return { ok: false, steps };
      }

      const base = Array.isArray(srv.search_base_dns) ? srv.search_base_dns[0] : null;
      if (base) {
        ldapLog('diagnose search_base begin', base);
        await new Promise((resolve, reject) => {
          client.search(
            String(base).trim(),
            { scope: 'base', filter: '(objectClass=*)', attributes: ['dn'], sizeLimit: 1 },
            (err, res) => {
              if (err) return reject(err);
              res.on('error', reject);
              res.on('end', resolve);
              res.on('searchEntry', (entry) => {
                ldapLog('diagnose search_base entry', ldapEntryToObject(entry).dn);
              });
            },
          );
        });
        steps.push({ step: 'search_base', ok: true, base });
        ldapLog('diagnose step search_base ok');
      }

      ldapLog('diagnose success', steps);
      return { ok: true, steps };
    } catch (err) {
      ldapErr('diagnose failed', formatLdapErr(err), err && err.stack);
      steps.push({
        step: 'error',
        ok: false,
        error: formatLdapErr(err),
        code: err && err.code,
        name: err && err.name,
      });
      return { ok: false, steps };
    } finally {
      this.destroyClient(client);
      ldapLog('diagnose end');
    }
  }

  buildUserDnCandidates(username) {
    const srv = this.activeServer;
    const candidates = [];
    const template =
      process.env.LDAP_USER_DN_TEMPLATE ||
      srv.user_dn_template ||
      '';
    if (template && template.includes('%s')) {
      candidates.push(template.replace('%s', escapeLdapDnValue(username)));
    }

    const filterAttr = (srv.attributes && srv.attributes.username) || 'uid';
    for (const base of srv.search_base_dns || []) {
      const cleanBase = String(base || '')
        .replace(/^"+|"+$/g, '')
        .trim();
      if (!cleanBase) continue;
      candidates.push(`${filterAttr}=${escapeLdapDnValue(username)},${cleanBase}`);
    }
    ldapLog('buildUserDnCandidates', { username, candidates });
    return [...new Set(candidates)];
  }

  async resolveUserDn(client, username) {
    ldapLog('resolveUserDn begin', username);
    try {
      const found = await this.searchUser(client, username);
      ldapLog('resolveUserDn via search', found);
      return found;
    } catch (searchErr) {
      ldapErr('resolveUserDn search failed, fallback DN', formatLdapErr(searchErr));
      const candidates = this.buildUserDnCandidates(username);
      if (candidates.length === 0) throw searchErr;
      return { userDn: candidates[0], displayName: username, dnCandidates: candidates };
    }
  }

  async validateUser(username, password) {
    const reqId = `login-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    ldapLog(reqId, 'validateUser start', {
      username,
      password: maskSecret(password, 0),
      mode: this.mode || 'ldap',
    });

    const cleanUsername =
      typeof username === 'string' ? username.replace(/^"+|"+$/g, '').trim() : '';
    const cleanPassword =
      typeof password === 'string' ? password.replace(/^"+|"+$/g, '').trim() : String(password ?? '');

    if (!cleanUsername || !cleanPassword) {
      ldapWarn(reqId, 'missing username/password');
      const err = new Error('Username and password required');
      err.status = 400;
      throw err;
    }

    if (this.mode === 'mock' || this.mode === 'dev') {
      ldapLog(reqId, 'mock path');
      return this.validateMockUser(cleanUsername, cleanPassword);
    }

    let client;
    const srv = this.activeServer;
    this.logConfigSummary(`${reqId} before ldap ops`);

    try {
      ldapLog(reqId, 'creating client…');
      client = this.createLdapClient();

      if (srv.bind_dn) {
        if (this.isPlaceholderBind(srv)) {
          ldapErr(reqId, 'placeholder bind credentials');
          throw Object.assign(
            new Error(
              'LDAP bind credentials manquants: définis LDAP_BIND_DN / LDAP_BIND_PASSWORD dans .env (ou remplace les placeholders dans ldap.toml)',
            ),
            { status: 500 },
          );
        }
        ldapLog(reqId, 'service bind…');
        await this.bind(client, srv.bind_dn, srv.bind_password || '');
        ldapLog(reqId, 'service bind ok');
      } else {
        ldapWarn(reqId, 'no service bind_dn — searching anonymously');
      }

      ldapLog(reqId, 'resolve user…');
      const resolved = await this.resolveUserDn(client, cleanUsername);
      const candidates =
        resolved.dnCandidates && resolved.dnCandidates.length > 0
          ? resolved.dnCandidates
          : [resolved.userDn];
      ldapLog(reqId, 'user dn candidates', candidates);

      let bindDn = null;
      let displayName = resolved.displayName || cleanUsername;
      let lastBindErr = null;
      for (const candidate of candidates) {
        try {
          ldapLog(reqId, 'user bind try', candidate);
          await this.bind(client, candidate, cleanPassword);
          bindDn = candidate;
          ldapLog(reqId, 'user bind ok', candidate);
          break;
        } catch (bindErr) {
          lastBindErr = bindErr;
          ldapErr(reqId, 'user bind failed', candidate, formatLdapErr(bindErr));
        }
      }
      if (!bindDn) throw lastBindErr || new Error('Authentication failed');

      let groups = [];
      try {
        if (srv.bind_dn && !this.isPlaceholderBind(srv)) {
          ldapLog(reqId, 're-bind service for groups…');
          await this.bind(client, srv.bind_dn, srv.bind_password || '');
        }
        groups = await this.getUserGroups(client, bindDn);
      } catch (groupErr) {
        ldapErr(reqId, 'groups lookup failed (ignored)', formatLdapErr(groupErr));
      }
      const role = this.mapGroupToRole(groups);
      ldapLog(reqId, 'role resolved', role);
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

      ldapLog(reqId, 'login success', { user: cleanUsername, role, displayName });
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
      ldapErr(reqId, 'validateUser failed', formatLdapErr(err));
      if (err && err.stack) ldapErr(reqId, err.stack);
      const failure = new Error(
        err && err.status === 500 ? err.message : 'Authentication failed',
      );
      failure.status = err && err.status === 500 ? 500 : 401;
      throw failure;
    } finally {
      ldapLog(reqId, 'cleanup client');
      this.destroyClient(client);
      ldapLog(reqId, 'validateUser end');
    }
  }

  validateMockUser(username, password) {
    ldapLog('validateMockUser', username);
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
    ldapLog('login() called');
    const result = await this.validateUser(username, password);
    ldapLog('login() done', { role: result.role, user: result.user && result.user.id });
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

function maskSecret(value, keep = 0) {
  if (value == null || value === '') return '(empty)';
  const s = String(value);
  if (keep <= 0) return `***len=${s.length}`;
  if (s.length <= keep) return `${s.slice(0, Math.min(4, s.length))}…***len=${s.length}`;
  return `${s.slice(0, keep)}…***len=${s.length}`;
}

function escapeLdapFilterValue(value) {
  return String(value).replace(/([\\*()])/g, '\\$1');
}

function escapeLdapDnValue(value) {
  return String(value).replace(/([,\\#+<>;"=])/g, '\\$1');
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
  if (asText.includes('BEGIN CERTIFICATE')) {
    ldapLog('CA format PEM', certPath);
    return [buf];
  }

  ldapLog('CA format DER → converting to PEM', certPath, 'bytes', buf.length);
  const b64 = buf.toString('base64').match(/.{1,64}/g) || [];
  const pem = `-----BEGIN CERTIFICATE-----\n${b64.join('\n')}\n-----END CERTIFICATE-----\n`;
  return [Buffer.from(pem, 'utf8')];
}

module.exports = AuthService;
