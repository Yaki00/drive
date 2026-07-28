const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const PORT = 3099;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-api-'));
const DATA_FILE = path.join(DATA_DIR, 'drive.json');

async function main() {
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForHealth();
    await runChecks();
    console.log('api tests ok');
  } finally {
    child.kill('SIGTERM');
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
  }
}

async function runChecks() {
  const health = await request('GET', '/health');
  assert.strictEqual(health.status, 200);
  assert.deepStrictEqual(health.body, { status: 'ok' });

  const created = await request('POST', '/cards', {
    title: 'Test card',
    color: '#00965A',
    createdBy: 'qa',
  });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.body.title, 'Test card');

  const list = await request('GET', '/cards');
  assert.strictEqual(list.status, 200);
  assert.strictEqual(list.body.length, 1);

  const link = await request('POST', `/cards/${created.body.id}/links`, {
    title: 'Example',
    url: 'https://example.com',
  });
  assert.strictEqual(link.status, 201);
  assert.strictEqual(link.body.url, 'https://example.com');
  assert.strictEqual(link.body.environment, 'Not define');

  const linkPrd = await request('POST', `/cards/${created.body.id}/links`, {
    title: 'Prod',
    url: 'https://prod.example.com',
    environment: 'PRD',
  });
  assert.strictEqual(linkPrd.status, 201);
  assert.strictEqual(linkPrd.body.environment, 'PRD');

  const updated = await request('PATCH', `/cards/links/${link.body.id}`, {
    environment: 'STG',
  });
  assert.strictEqual(updated.status, 200);
  assert.strictEqual(updated.body.environment, 'STG');

  const deleted = await request('DELETE', `/cards/${created.body.id}`);
  assert.strictEqual(deleted.status, 204);

  assert.ok(fs.existsSync(DATA_FILE));

  await testActivityLog();
  await testKpiClicks();
}

async function testKpiClicks() {
  const card = await request('POST', '/cards', { title: 'KPI card' }, { 'X-Actor': 'kpi-user' });
  assert.strictEqual(card.status, 201);
  const link = await request(
    'POST',
    `/cards/${card.body.id}/links`,
    { title: 'KPI link', url: 'https://example.com/kpi', environment: 'PRD' },
    { 'X-Actor': 'kpi-user' },
  );
  assert.strictEqual(link.status, 201);

  const click = await request(
    'POST',
    `/cards/links/${link.body.id}/click`,
    {},
    { 'X-Actor': 'kpi-user' },
  );
  assert.strictEqual(click.status, 201);
  assert.strictEqual(click.body.link.clickCount, 1);

  const kpi = await request('GET', '/kpi');
  assert.strictEqual(kpi.status, 200);
  assert.ok(kpi.body.totals.totalClicks >= 1);
  assert.ok(Array.isArray(kpi.body.links));
  assert.ok(kpi.body.topLinks.some((row) => row.linkId === link.body.id && row.clicks >= 1));
  assert.ok(kpi.body.recentClicks.some((row) => row.linkId === link.body.id));
  const linkRow = kpi.body.links.find((row) => row.linkId === link.body.id);
  assert.ok(linkRow);
  assert.strictEqual(linkRow.clicked, true);
  assert.strictEqual(linkRow.clickCount, 1);
  assert.ok(linkRow.lastClickedAt);

  assert.strictEqual(kpi.body.clicksByDay.length, 30);
  const todayLocal = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();
  assert.strictEqual(kpi.body.clicksByDay[kpi.body.clicksByDay.length - 1].date, todayLocal);
  const todayBucket = kpi.body.clicksByDay.find((row) => row.date === todayLocal);
  assert.ok(todayBucket, 'today must be in clicksByDay window');
  assert.ok(todayBucket.count >= 1, 'a click recorded now must appear in today bucket');

  const untouched = await request(
    'POST',
    `/cards/${card.body.id}/links`,
    { title: 'Never clicked', url: 'https://example.com/never', environment: 'STG' },
    { 'X-Actor': 'kpi-user' },
  );
  assert.strictEqual(untouched.status, 201);
  const kpi2 = await request('GET', '/kpi');
  const neverRow = kpi2.body.links.find((row) => row.linkId === untouched.body.id);
  assert.ok(neverRow, 'KPI links table must include unclicked links');
  assert.strictEqual(neverRow.clicked, false);
  assert.strictEqual(neverRow.clickCount, 0);
  assert.strictEqual(neverRow.lastClickedAt, null);
}

async function testActivityLog() {
  const card = await request('POST', '/cards', {
    title: 'Activity card',
    createdBy: 'alice - Alice',
  }, { 'X-Actor': 'alice - Alice' });
  assert.strictEqual(card.status, 201);

  const link = await request(
    'POST',
    `/cards/${card.body.id}/links`,
    { title: 'Logged link', url: 'https://example.org' },
    { 'X-Actor': 'bob - Bob' },
  );
  assert.strictEqual(link.status, 201);

  const patched = await request(
    'PATCH',
    `/cards/${card.body.id}`,
    { title: 'Activity card renamed' },
    { 'X-Actor': 'alice - Alice' },
  );
  assert.strictEqual(patched.status, 200);
  assert.strictEqual(patched.body.title, 'Activity card renamed');

  const activity = await request('GET', '/activity');
  assert.strictEqual(activity.status, 200);
  assert.ok(Array.isArray(activity.body));
  assert.ok(activity.body.length >= 3);

  const createLinkEntry = activity.body.find(
    (entry) => entry.action === 'create' && entry.entityType === 'link' && entry.entityId === link.body.id,
  );
  assert.ok(createLinkEntry);
  assert.strictEqual(createLinkEntry.actor, 'bob - Bob');
  assert.strictEqual(createLinkEntry.reverted, false);

  const revertCreate = await request('POST', `/activity/${createLinkEntry.id}/revert`, {}, { 'X-Actor': 'carol - Carol' });
  assert.strictEqual(revertCreate.status, 200);
  assert.strictEqual(revertCreate.body.reverted, true);
  assert.strictEqual(revertCreate.body.revertedBy, 'carol - Carol');
  assert.ok(revertCreate.body.revertedAt);

  const afterRevert = await request('GET', `/cards/${card.body.id}`);
  assert.strictEqual(afterRevert.status, 200);
  assert.strictEqual(afterRevert.body.links.length, 0);

  const doubleRevert = await request('POST', `/activity/${createLinkEntry.id}/revert`);
  assert.strictEqual(doubleRevert.status, 409);

  const unrevertCreate = await request('POST', `/activity/${createLinkEntry.id}/unrevert`);
  assert.strictEqual(unrevertCreate.status, 200);
  assert.strictEqual(unrevertCreate.body.reverted, false);
  assert.strictEqual(unrevertCreate.body.revertedBy, null);

  const afterUnrevert = await request('GET', `/cards/${card.body.id}`);
  assert.strictEqual(afterUnrevert.status, 200);
  assert.strictEqual(afterUnrevert.body.links.length, 1);
  assert.strictEqual(afterUnrevert.body.links[0].id, link.body.id);

  const revertCreateAgain = await request('POST', `/activity/${createLinkEntry.id}/revert`, {}, { 'X-Actor': 'dave - Dave' });
  assert.strictEqual(revertCreateAgain.status, 200);
  assert.strictEqual(revertCreateAgain.body.revertedBy, 'dave - Dave');

  const updateEntry = activity.body.find(
    (entry) => entry.action === 'update' && entry.entityType === 'card' && entry.entityId === card.body.id,
  );
  assert.ok(updateEntry);
  // Add a link after the card update — revert of update must NOT wipe it.
  const postUpdateLink = await request(
    'POST',
    `/cards/${card.body.id}/links`,
    { title: 'Kept after revert', url: 'https://example.com/kept' },
    { 'X-Actor': 'bob - Bob' },
  );
  assert.strictEqual(postUpdateLink.status, 201);

  const revertUpdate = await request('POST', `/activity/${updateEntry.id}/revert`);
  assert.strictEqual(revertUpdate.status, 200);

  const restoredCard = await request('GET', `/cards/${card.body.id}`);
  assert.strictEqual(restoredCard.status, 200);
  assert.strictEqual(restoredCard.body.title, 'Activity card');
  assert.ok(
    restoredCard.body.links.some((item) => item.id === postUpdateLink.body.id),
    'update revert must keep links added after the update',
  );
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(updateEntry.before || {}, 'links'),
    false,
    'card update logs must store meta-only snapshots',
  );

  const deleteLink = await request(
    'POST',
    `/cards/${card.body.id}/links`,
    { title: 'To delete', url: 'https://example.com/x' },
    { 'X-Actor': 'carol - Carol' },
  );
  assert.strictEqual(deleteLink.status, 201);
  const removed = await request('DELETE', `/cards/links/${deleteLink.body.id}`, null, {
    'X-Actor': 'carol - Carol',
  });
  assert.strictEqual(removed.status, 204);

  const afterDelete = await request('GET', '/activity');
  const deleteEntry = afterDelete.body.find(
    (entry) => entry.action === 'delete' && entry.entityType === 'link' && entry.entityId === deleteLink.body.id,
  );
  assert.ok(deleteEntry);
  assert.strictEqual(deleteEntry.actor, 'carol - Carol');

  const revertDelete = await request('POST', `/activity/${deleteEntry.id}/revert`);
  assert.strictEqual(revertDelete.status, 200);
  const cardAgain = await request('GET', `/cards/${card.body.id}`);
  assert.ok(cardAgain.body.links.some((item) => item.id === deleteLink.body.id));

  const cleared = await request('DELETE', '/activity');
  assert.strictEqual(cleared.status, 200);
  assert.deepStrictEqual(cleared.body, { cleared: true });
  const emptyLog = await request('GET', '/activity');
  assert.strictEqual(emptyLog.body.length, 0);

  // No user / no X-Actor → still log with guest; /api prefix must work.
  const guestCard = await request('POST', '/api/cards', {
    title: 'Guest logged card',
    color: '#607d8b',
  });
  assert.strictEqual(guestCard.status, 201);
  const guestActivity = await request('GET', '/api/activity');
  assert.strictEqual(guestActivity.status, 200);
  const guestEntry = guestActivity.body.find(
    (entry) => entry.action === 'create' && entry.entityType === 'card' && entry.entityId === guestCard.body.id,
  );
  assert.ok(guestEntry);
  assert.strictEqual(guestEntry.actor, 'guest');
}

function waitForHealth() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const res = await request('GET', '/health');
        if (res.status === 200) {
          resolve();
          return;
        }
      } catch {
        // retry
      }
      if (attempts > 40) {
        reject(new Error('server did not start'));
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
