const http = require('node:http');
const path = require('node:path');
const { createStore } = require('./store');
const { createRouter } = require('./router');

const PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR = process.env.DATA_DIR ?? process.cwd();
const DATA_FILE = path.join(DATA_DIR, 'drive.json');

const store = createStore(DATA_FILE);
const router = createRouter(store);

const server = http.createServer(async (req, res) => {
  const rawBody = await readBody(req);
  let body = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ message: 'Invalid JSON body' }));
      return;
    }
  }
  await router(req, res, body);
});

server.listen(PORT, () => {
  console.log(`node backend http://localhost:${PORT}`);
  console.log(`data file: ${DATA_FILE}`);
});

function readBody(req) {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') {
      resolve('');
      return;
    }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}
