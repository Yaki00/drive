const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const AuthService = require('../server/auth/auth.service');

const PORT = 3101;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-auth-'));

async function main() {
  testParseAndRoles();
  testMockLoginService();
  testEnvOverridesToml();

  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR,
      AUTH_MODE: 'mock',
      JWT_SECRET: 'test-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForHealth();
    await testAuthRoutes();
    console.log('auth tests ok');
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

function testParseAndRoles() {
  const service = new AuthService({ mode: 'mock' });
  const parsed = service.parseToml(`
host = "ldap.example.com"
port = 636
use_ssl = true
search_base_dns = ["ou=people,dc=example,dc=com"]
search_filter = "(uid=%s)"
bind_dn = "cn=svc,dc=example,dc=com"
bind_password = "x"
`);
  assert.strictEqual(parsed.servers[0].host, 'ldap.example.com');
  assert.strictEqual(parsed.servers[0].port, 636);
  assert.strictEqual(parsed.servers[0].use_ssl, true);
  assert.deepStrictEqual(parsed.servers[0].search_base_dns, ['ou=people,dc=example,dc=com']);

  service.config = parsed;
  assert.strictEqual(service.mapGroupToRole(['CN=APP_ADMIN,DC=example']), 'Admin');
  assert.strictEqual(service.mapGroupToRole(['CN=APP_USER,DC=example']), 'User');
  assert.strictEqual(service.mapGroupToRole([]), 'User');

  const enterprise = service.parseToml(`
[[servers]]
host = "eldap-global.cib.echonet"
port = 636
use_ssl = true
bind_dn = "cn=svc,dc=root"
bind_password = "secret"
search_filter = "(uid=%s)"
search_base_dns = ["ou=Internal,ou=Users,dc=root"]

[servers.attributes]
name = "givenName"
surname = "sn"
username = "uid"
member_of = "memberOf"

[[servers.group_mappings]]
group_dn = "cn=parftp_bofinmon_admin,ou=group,ou=PARFTP,ou=Applications,dc=root"
org_role = "Admin"

[[servers.group_mappings]]
group_dn = "cn=parftp_bofinmon_user,ou=group,ou=PARFTP,ou=Applications,dc=root"
org_role = "User"
`);
  assert.strictEqual(enterprise.servers.length, 1);
  assert.strictEqual(enterprise.servers[0].host, 'eldap-global.cib.echonet');
  assert.strictEqual(enterprise.servers[0].attributes.username, 'uid');
  assert.strictEqual(enterprise.servers[0].group_mappings.length, 2);
  assert.strictEqual(enterprise.servers[0].group_mappings[0].org_role, 'Admin');

  service.config = enterprise;
  assert.strictEqual(
    service.mapGroupToRole([
      'cn=parftp_bofinmon_admin,ou=group,ou=PARFTP,ou=Applications,dc=root',
    ]),
    'Admin',
  );
}

async function testMockLoginService() {
  const service = new AuthService({ mode: 'mock' });
  const ok = await service.login('admin', 'admin');
  assert.ok(ok.token);
  assert.strictEqual(ok.user.id, 'admin');
  assert.strictEqual(ok.role, 'Admin');

  await assert.rejects(() => service.login('admin', 'wrong'), /Authentication failed/);
}

function testEnvOverridesToml() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-ldap-'));
  const tomlPath = path.join(tmpDir, 'ldap.toml');
  fs.writeFileSync(
    tomlPath,
    `
[[servers]]
host = "eldap.example.com"
port = 636
use_ssl = true
bind_dn = "bind_dn"
bind_password = "bind_password"
search_filter = "(uid=%s)"
search_base_dns = ["ou=Users,dc=root"]
`,
    'utf8',
  );

  const prev = {
    AUTH_MODE: process.env.AUTH_MODE,
    LDAP_BIND_DN: process.env.LDAP_BIND_DN,
    LDAP_BIND_PASSWORD: process.env.LDAP_BIND_PASSWORD,
    LDAP_HOST: process.env.LDAP_HOST,
    LDAP_SEARCH_BASE: process.env.LDAP_SEARCH_BASE,
  };

  try {
    delete process.env.AUTH_MODE;
    process.env.LDAP_BIND_DN = 'cn=svc-real,ou=apps,dc=root';
    process.env.LDAP_BIND_PASSWORD = 'real-secret';
    process.env.LDAP_HOST = 'ldap-from-env.example.com';
    process.env.LDAP_SEARCH_BASE = 'ou=Internal,ou=Users,dc=root';

    const service = new AuthService({ mode: '', tomlPath });
    const srv = service.activeServer;
    assert.strictEqual(srv.bind_dn, 'cn=svc-real,ou=apps,dc=root');
    assert.strictEqual(srv.bind_password, 'real-secret');
    assert.strictEqual(srv.host, 'ldap-from-env.example.com');
    assert.deepStrictEqual(srv.search_base_dns, ['ou=Internal,ou=Users,dc=root']);
    assert.strictEqual(service.isPlaceholderBind(srv), false);
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function testAuthRoutes() {
  const status = await request('GET', '/auth/status');
  assert.strictEqual(status.status, 200);
  assert.strictEqual(status.body.configured, true);
  assert.strictEqual(status.body.mode, 'mock');

  const bad = await request('POST', '/auth/login', { username: 'admin', password: 'nope' });
  assert.strictEqual(bad.status, 401);

  const login = await request('POST', '/auth/login', { username: 'user', password: 'user' });
  assert.strictEqual(login.status, 200);
  assert.ok(login.body.token);
  assert.strictEqual(login.body.user.id, 'user');

  const me = await request('GET', '/auth/me', null, {
    Authorization: `Bearer ${login.body.token}`,
  });
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.body.user.id, 'user');

  const viaApiPrefix = await request('POST', '/api/auth/login', {
    username: 'admin',
    password: 'admin',
  });
  assert.strictEqual(viaApiPrefix.status, 200);
  assert.ok(viaApiPrefix.body.token);

  const oidcPing = await request('GET', '/auth/oidc/ping');
  assert.strictEqual(oidcPing.status, 200);
  assert.strictEqual(oidcPing.body.ok, true);

  const oidcPingApi = await request('GET', '/api/auth/oidc/ping');
  assert.strictEqual(oidcPingApi.status, 200);

  // OIDC disabled by default → 503 (routes loaded), never 404
  const oidcStart = await request('GET', '/auth/oidc/start');
  assert.strictEqual(oidcStart.status, 503);
}

function request(method, pathname, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: pathname,
        method,
        headers: {
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          if (text) {
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = text;
            }
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function waitForHealth() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const res = await request('GET', '/health');
        if (res.status === 200) return resolve();
      } catch {
        // retry
      }
      if (attempts > 40) return reject(new Error('auth server did not start'));
      setTimeout(tick, 50);
    };
    tick();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
