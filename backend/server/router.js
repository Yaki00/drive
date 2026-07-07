function createRouter(store) {
  return async function handle(req, res, body) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    const method = req.method ?? 'GET';

    try {
      if (method === 'GET' && path === '/health') return json(res, 200, { status: 'ok' });
      if (method === 'GET' && path === '/cards') return json(res, 200, store.findAll());
      if (method === 'POST' && path === '/cards') return json(res, 201, store.createCard(body));
      if (method === 'POST' && path === '/cards/reorder') return json(res, 200, store.reorderCards(body.items ?? []));
      if (method === 'POST' && path === '/cards/links/check-dead') return json(res, 200, await store.checkDeadLinks());

      const cardPath = path.match(/^\/cards\/(\d+)$/);
      if (method === 'GET' && cardPath) return json(res, 200, store.findOne(Number(cardPath[1])));
      if (method === 'PATCH' && cardPath) return json(res, 200, store.updateCard(Number(cardPath[1]), body));
      if (method === 'DELETE' && cardPath) {
        store.removeCard(Number(cardPath[1]));
        return empty(res, 204);
      }

      const folderCreatePath = path.match(/^\/cards\/(\d+)\/folders$/);
      if (method === 'POST' && folderCreatePath) return json(res, 201, store.addFolder(Number(folderCreatePath[1]), body));

      const folderPath = path.match(/^\/cards\/folders\/(\d+)$/);
      if (method === 'PATCH' && folderPath) return json(res, 200, store.updateFolder(Number(folderPath[1]), body));
      if (method === 'DELETE' && folderPath) {
        store.removeFolder(Number(folderPath[1]));
        return empty(res, 204);
      }

      const linkCreatePath = path.match(/^\/cards\/(\d+)\/links$/);
      if (method === 'POST' && linkCreatePath) return json(res, 201, store.addLink(Number(linkCreatePath[1]), body));

      const linkBulkPath = path.match(/^\/cards\/(\d+)\/links\/bulk$/);
      if (method === 'POST' && linkBulkPath) return json(res, 201, store.addLinksBulk(Number(linkBulkPath[1]), body));

      const linkPath = path.match(/^\/cards\/links\/(\d+)$/);
      if (method === 'PATCH' && linkPath) return json(res, 200, store.updateLink(Number(linkPath[1]), body));
      if (method === 'DELETE' && linkPath) {
        store.removeLink(Number(linkPath[1]));
        return empty(res, 204);
      }

      const reorderCardPath = path.match(/^\/cards\/(\d+)\/reorder$/);
      if (method === 'POST' && reorderCardPath) {
        return json(res, 200, store.reorderCard(Number(reorderCardPath[1]), body));
      }

      return json(res, 404, { message: 'Not found' });
    } catch (err) {
      return json(res, err.status ?? 500, { message: err.message ?? 'Error' });
    }
  };
}

module.exports = { createRouter };

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function empty(res, status) {
  res.writeHead(status);
  res.end();
}
