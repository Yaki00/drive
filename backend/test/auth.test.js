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
}

async function testMockLoginService() {
  const service = new AuthService({ mode: 'mock' });
  const ok = await service.login('admin', 'admin');
  assert.ok(ok.token);
  assert.strictEqual(ok.user.id, 'admin');
  assert.strictEqual(ok.role, 'Admin');

  await assert.rejects(() => service.login('admin', 'wrong'), /Authentication failed/);
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
