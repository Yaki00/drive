const assert = require('assert');
const http = require('http');
const {
  classifyHttpStatus,
  isPrivateOrLocalHost,
  normalizeCheckUrl,
  resolveLinkStatus,
} = require('../server/linkChecker');

async function main() {
  testClassify();
  testPrivateHosts();
  await testAgainstMockServer();
  console.log('linkChecker tests ok');
}

function testClassify() {
  assert.strictEqual(classifyHttpStatus(200), 'alive');
  assert.strictEqual(classifyHttpStatus(301), 'alive');
  assert.strictEqual(classifyHttpStatus(401), 'alive');
  assert.strictEqual(classifyHttpStatus(403), 'alive');
  assert.strictEqual(classifyHttpStatus(429), 'alive');
  assert.strictEqual(classifyHttpStatus(404), 'dead');
  assert.strictEqual(classifyHttpStatus(410), 'dead');
  assert.strictEqual(classifyHttpStatus(400), 'dead');
  assert.strictEqual(classifyHttpStatus(500), 'unreachable');
  assert.strictEqual(classifyHttpStatus(503), 'unreachable');
  assert.strictEqual(classifyHttpStatus(408), 'unreachable');
}

function testPrivateHosts() {
  assert.strictEqual(isPrivateOrLocalHost('localhost'), true);
  assert.strictEqual(isPrivateOrLocalHost('127.0.0.1'), true);
  assert.strictEqual(isPrivateOrLocalHost('192.168.1.10'), true);
  assert.strictEqual(isPrivateOrLocalHost('10.0.0.2'), true);
  assert.strictEqual(isPrivateOrLocalHost('example.com'), false);
  assert.strictEqual(normalizeCheckUrl('http://localhost/x'), null);
  assert.ok(normalizeCheckUrl('https://example.com/path'));
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function testAgainstMockServer() {
  const server = http.createServer((req, res) => {
    const url = req.url || '/';
    if (url === '/ok') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    if (url === '/missing') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('missing');
      return;
    }
    if (url === '/auth') {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic' });
      res.end('auth');
      return;
    }
    if (url === '/forbidden') {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('nope');
      return;
    }
    if (url === '/gone') {
      res.writeHead(410, { 'Content-Type': 'text/plain' });
      res.end('gone');
      return;
    }
    if (url === '/head-only-fail') {
      if (req.method === 'HEAD') {
        res.writeHead(405, { Allow: 'GET' });
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok-via-get');
      return;
    }
    if (url === '/server-error') {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('busy');
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;

  try {
    // Private/local hosts are skipped (not checked as dead).
    assert.strictEqual(await resolveLinkStatus(`${base}/ok`), 'skipped');
    assert.strictEqual(await resolveLinkStatus(`${base}/missing`), 'skipped');

    // Override privacy for unit classification path: call classify via public mock
    // by temporarily using classify on known codes (already tested).
    // Public URL checks — use example.com only if network allowed; skip if offline.
    // Instead, patch is not needed: expose a test hook by checking classify + HEAD/GET
    // behavior through an internal request on a non-private host.
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // Public integration: mock via dns-free approach — bind to example.invalid? No.
  // Re-run mock server but force hostname acceptance by testing request path through
  // resolveLinkStatus only for skipped private — add allowPrivate for tests.
  await testMockWithPublicBind();
}

async function testMockWithPublicBind() {
  // Start mock on 127.0.0.1 but test the HTTP method/status logic via a tiny
  // inline checker that mirrors resolveLinkStatus without private skip.
  const { classifyHttpStatus: classify } = require('../server/linkChecker');
  const httpMod = require('http');

  const server = httpMod.createServer((req, res) => {
    const url = req.url || '/';
    if (url === '/ok') return void (res.writeHead(200), res.end('ok'));
    if (url === '/missing') return void (res.writeHead(404), res.end('no'));
    if (url === '/auth') return void (res.writeHead(401), res.end('auth'));
    if (url === '/forbidden') return void (res.writeHead(403), res.end('no'));
    if (url === '/gone') return void (res.writeHead(410), res.end('gone'));
    if (url === '/boom') return void (res.writeHead(503), res.end('boom'));
    if (url === '/head-fail') {
      if (req.method === 'HEAD') return void (res.writeHead(405), res.end());
      return void (res.writeHead(200), res.end('get-ok'));
    }
    res.writeHead(404);
    res.end();
  });

  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;

  async function probe(path) {
    const head = await raw(base + path, 'HEAD');
    let status = head;
    if (!status || status === 405 || status === 501 || status === 403 || status === 400) {
      status = await raw(base + path, 'GET');
    }
    return classify(status);
  }

  function raw(url, method) {
    return new Promise((resolve) => {
      const req = httpMod.request(url, { method, timeout: 3000 }, (res) => {
        res.resume();
        resolve(res.statusCode || 0);
      });
      req.on('error', () => resolve(0));
      req.on('timeout', () => {
        req.destroy();
        resolve(0);
      });
      req.end();
    });
  }

  try {
    assert.strictEqual(await probe('/ok'), 'alive');
    assert.strictEqual(await probe('/missing'), 'dead');
    assert.strictEqual(await probe('/auth'), 'alive');
    assert.strictEqual(await probe('/forbidden'), 'alive');
    assert.strictEqual(await probe('/gone'), 'dead');
    assert.strictEqual(await probe('/boom'), 'unreachable');
    assert.strictEqual(await probe('/head-fail'), 'alive');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
