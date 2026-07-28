function createRouter(store) {
  return async function handle(req, res, body) {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;
    const method = req.method || 'GET';
    const actor = resolveActor(req, body);

    try {
      if (method === 'GET' && pathname === '/health') return json(res, 200, { status: 'ok' });

      if (method === 'GET' && pathname === '/kpi') {
        return json(res, 200, store.getKpi());
      }

      if (method === 'GET' && pathname === '/activity') {
        const limit = url.searchParams.get('limit');
        return json(res, 200, store.listActivity(limit));
      }
      if (method === 'DELETE' && pathname === '/activity') {
        return json(res, 200, store.clearActivity());
      }
      if (method === 'POST' && pathname === '/activity/clear') {
        return json(res, 200, store.clearActivity());
      }

      const activityRevertPath = pathname.match(/^\/activity\/(\d+)\/revert$/);
      if (method === 'POST' && activityRevertPath) {
        return json(res, 200, store.revertActivity(Number(activityRevertPath[1]), actor));
      }
      const activityUnrevertPath = pathname.match(/^\/activity\/(\d+)\/unrevert$/);
      if (method === 'POST' && activityUnrevertPath) {
        return json(res, 200, store.unrevertActivity(Number(activityUnrevertPath[1])));
      }

      if (method === 'GET' && pathname === '/cards') return json(res, 200, store.findAll());
      if (method === 'POST' && pathname === '/cards') {
        return json(res, 201, store.createCard({ ...body, actor }));
      }
      if (method === 'POST' && pathname === '/cards/reorder') {
        return json(res, 200, store.reorderCards(body.items || []));
      }
      if (method === 'POST' && pathname === '/cards/links/check-dead') {
        return json(res, 200, await store.checkDeadLinks());
      }

      const cardPath = pathname.match(/^\/cards\/(\d+)$/);
      if (method === 'GET' && cardPath) return json(res, 200, store.findOne(Number(cardPath[1])));
      if (method === 'PATCH' && cardPath) {
        return json(res, 200, store.updateCard(Number(cardPath[1]), { ...body, actor }));
      }
      if (method === 'DELETE' && cardPath) {
        store.removeCard(Number(cardPath[1]), actor);
        return empty(res, 204);
      }

      const folderCreatePath = pathname.match(/^\/cards\/(\d+)\/folders$/);
      if (method === 'POST' && folderCreatePath) {
        return json(res, 201, store.addFolder(Number(folderCreatePath[1]), { ...body, actor }));
      }

      const folderPath = pathname.match(/^\/cards\/folders\/(\d+)$/);
      if (method === 'PATCH' && folderPath) {
        return json(res, 200, store.updateFolder(Number(folderPath[1]), { ...body, actor }));
      }
      if (method === 'DELETE' && folderPath) {
        store.removeFolder(Number(folderPath[1]), actor);
        return empty(res, 204);
      }

      const linkCreatePath = pathname.match(/^\/cards\/(\d+)\/links$/);
      if (method === 'POST' && linkCreatePath) {
        return json(res, 201, store.addLink(Number(linkCreatePath[1]), { ...body, actor }));
      }

      const linkBulkPath = pathname.match(/^\/cards\/(\d+)\/links\/bulk$/);
      if (method === 'POST' && linkBulkPath) {
        return json(res, 201, store.addLinksBulk(Number(linkBulkPath[1]), { ...body, actor }));
      }

      const linkPath = pathname.match(/^\/cards\/links\/(\d+)$/);
      if (method === 'PATCH' && linkPath) {
        return json(res, 200, store.updateLink(Number(linkPath[1]), { ...body, actor }));
      }
      if (method === 'DELETE' && linkPath) {
        store.removeLink(Number(linkPath[1]), actor);
        return empty(res, 204);
      }

      const linkClickPath = pathname.match(/^\/cards\/links\/(\d+)\/click$/);
      if (method === 'POST' && linkClickPath) {
        return json(res, 201, store.recordLinkClick(Number(linkClickPath[1]), actor));
      }

      const reorderCardPath = pathname.match(/^\/cards\/(\d+)\/reorder$/);
      if (method === 'POST' && reorderCardPath) {
        return json(res, 200, store.reorderCard(Number(reorderCardPath[1]), body));
      }

      return json(res, 404, { message: 'Not found' });
    } catch (err) {
      console.error('[api]', method, pathname, err && err.stack ? err.stack : err);
      return json(res, err.status || 500, { message: err.message || 'Error' });
    }
  };
}

module.exports = { createRouter };

function resolveActor(req, body) {
  const header = req.headers['x-actor'];
  if (header != null && String(header).trim()) return String(header).trim();
  if (body && body.actor != null && String(body.actor).trim()) return String(body.actor).trim();
  if (body && body.createdBy != null && String(body.createdBy).trim()) {
    return String(body.createdBy).trim();
  }
  // Never block activity logging when session/user is missing.
  return 'guest';
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function empty(res, status) {
  res.writeHead(status);
  res.end();
}
