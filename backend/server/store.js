const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const initialData = {
  cards: [],
  seq: { card: 1, folder: 1, link: 1 },
};

function createStore(filePath) {
  ensureDataFile(filePath);
  const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  function save() {
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sortedCards() {
    return state.cards
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || byDateDesc(a.createdAt, b.createdAt))
      .map(formatCard);
  }

  function formatCard(card) {
    const links = card.links
      .filter((link) => link.folderId == null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((link) => ({ ...link, tags: link.tags ?? [] }));

    const folders = card.folders
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((folder) => ({
        ...folder,
        links: folder.links
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((link) => ({ ...link, tags: link.tags ?? [] })),
      }));

    return { ...card, tags: card.tags ?? [], links, folders };
  }

  function findCardById(id) {
    return state.cards.find((card) => card.id === id);
  }

  function findFolderById(folderId) {
    for (const card of state.cards) {
      const folder = card.folders.find((item) => item.id === folderId);
      if (folder) return { card, folder };
    }
    return null;
  }

  function findLinkById(linkId) {
    for (const card of state.cards) {
      const rootIndex = card.links.findIndex((item) => item.id === linkId);
      if (rootIndex >= 0) return { card, link: card.links[rootIndex], collection: card.links, index: rootIndex };

      for (const folder of card.folders) {
        const folderIndex = folder.links.findIndex((item) => item.id === linkId);
        if (folderIndex >= 0) {
          return { card, folder, link: folder.links[folderIndex], collection: folder.links, index: folderIndex };
        }
      }
    }
    return null;
  }

  function nextSortOrder(items) {
    if (!items.length) return 0;
    return Math.max(...items.map((item) => item.sortOrder ?? 0)) + 1;
  }

  return {
    findAll() {
      return sortedCards();
    },
    findOne(id) {
      const card = findCardById(id);
      if (!card) throw notFound(`Card #${id} not found`);
      return formatCard(card);
    },
    createCard(dto) {
      const card = {
        id: state.seq.card++,
        title: dto.title,
        description: dto.description ?? null,
        color: dto.color ?? '#00965A',
        tags: dto.tags ?? [],
        sortOrder: nextSortOrder(state.cards),
        links: [],
        folders: [],
        createdBy: dto.createdBy ?? null,
        createdAt: new Date().toISOString(),
      };
      state.cards.push(card);
      save();
      return formatCard(card);
    },
    updateCard(id, dto) {
      const card = findCardById(id);
      if (!card) throw notFound(`Card #${id} not found`);
      Object.assign(card, dto);
      save();
      return formatCard(card);
    },
    removeCard(id) {
      const idx = state.cards.findIndex((card) => card.id === id);
      if (idx < 0) throw notFound(`Card #${id} not found`);
      state.cards.splice(idx, 1);
      save();
    },
    reorderCards(items) {
      for (const item of items) {
        const card = findCardById(Number(item.id));
        if (!card) throw notFound(`Card #${item.id} not found`);
        card.sortOrder = Number(item.sortOrder);
      }
      save();
      return sortedCards();
    },
    addFolder(cardId, dto) {
      const card = findCardById(cardId);
      if (!card) throw notFound(`Card #${cardId} not found`);
      const folder = {
        id: state.seq.folder++,
        title: dto.title,
        description: dto.description ?? null,
        sortOrder: nextSortOrder(card.folders),
        cardId,
        createdBy: dto.createdBy ?? null,
        createdAt: new Date().toISOString(),
        links: [],
      };
      card.folders.push(folder);
      save();
      return clone(folder);
    },
    updateFolder(folderId, dto) {
      const found = findFolderById(folderId);
      if (!found) throw notFound(`Folder #${folderId} not found`);
      Object.assign(found.folder, dto);
      save();
      return clone(found.folder);
    },
    removeFolder(folderId) {
      const found = findFolderById(folderId);
      if (!found) throw notFound(`Folder #${folderId} not found`);
      const idx = found.card.folders.findIndex((item) => item.id === folderId);
      found.card.folders.splice(idx, 1);
      save();
    },
    addLink(cardId, dto) {
      const card = findCardById(cardId);
      if (!card) throw notFound(`Card #${cardId} not found`);

      let targetCollection = card.links;
      let folderId = null;
      if (dto.folderId != null) {
        const folder = card.folders.find((item) => item.id === dto.folderId);
        if (!folder) throw notFound(`Folder #${dto.folderId} not found in card #${cardId}`);
        targetCollection = folder.links;
        folderId = folder.id;
      }

      const link = {
        id: state.seq.link++,
        title: dto.title,
        url: dto.url,
        description: dto.description ?? null,
        tags: dto.tags ?? [],
        isFavorite: dto.isFavorite ?? false,
        isDead: false,
        sortOrder: nextSortOrder(targetCollection),
        lastCheckedAt: null,
        cardId,
        folderId,
        createdBy: dto.createdBy ?? null,
        createdAt: new Date().toISOString(),
      };
      targetCollection.push(link);
      save();
      return clone(link);
    },
    addLinksBulk(cardId, body) {
      const links = body.links ?? [];
      const created = [];
      for (const item of links) {
        created.push(this.addLink(cardId, { ...item, folderId: item.folderId ?? body.folderId ?? null }));
      }
      return { created: created.length, links: created };
    },
    updateLink(linkId, dto) {
      const found = findLinkById(linkId);
      if (!found) throw notFound(`Link #${linkId} not found`);
      const current = found.link;

      if (dto.cardId !== undefined || dto.folderId !== undefined) {
        const targetCardId = dto.cardId ?? current.cardId;
        const targetCard = findCardById(targetCardId);
        if (!targetCard) throw notFound(`Card #${targetCardId} not found`);

        let targetFolderId = dto.folderId;
        if (targetFolderId === undefined) targetFolderId = current.folderId;

        let targetCollection = targetCard.links;
        if (targetFolderId != null) {
          const targetFolder = targetCard.folders.find((folder) => folder.id === targetFolderId);
          if (!targetFolder) throw notFound(`Folder #${targetFolderId} not found`);
          targetCollection = targetFolder.links;
        }

        found.collection.splice(found.index, 1);
        current.cardId = targetCardId;
        current.folderId = targetFolderId ?? null;
        current.sortOrder = nextSortOrder(targetCollection);
        targetCollection.push(current);
      }

      const assignable = { ...dto };
      delete assignable.cardId;
      delete assignable.folderId;
      if (assignable.url && assignable.url !== current.url) {
        current.isDead = false;
        current.lastCheckedAt = null;
      }
      Object.assign(current, assignable);
      save();
      return clone(current);
    },
    removeLink(linkId) {
      const found = findLinkById(linkId);
      if (!found) throw notFound(`Link #${linkId} not found`);
      found.collection.splice(found.index, 1);
      save();
    },
    reorderCard(cardId, body) {
      const card = findCardById(cardId);
      if (!card) throw notFound(`Card #${cardId} not found`);
      for (const item of body.items ?? []) {
        if (item.type === 'folder') {
          const folder = card.folders.find((f) => f.id === item.id);
          if (!folder) throw notFound(`Folder #${item.id} not found`);
          folder.sortOrder = Number(item.sortOrder);
          continue;
        }

        const found = findLinkById(item.id);
        if (!found || found.card.id !== cardId) throw notFound(`Link #${item.id} not found in card #${cardId}`);
        found.collection.splice(found.index, 1);

        let targetCollection = card.links;
        let targetFolderId = item.folderId ?? null;
        if (targetFolderId != null) {
          const folder = card.folders.find((f) => f.id === targetFolderId);
          if (!folder) throw notFound(`Folder #${targetFolderId} not found`);
          targetCollection = folder.links;
        }

        found.link.cardId = cardId;
        found.link.folderId = targetFolderId;
        found.link.sortOrder = Number(item.sortOrder);
        targetCollection.push(found.link);
      }
      save();
      return formatCard(card);
    },
    async checkDeadLinks() {
      const all = [];
      for (const card of state.cards) {
        all.push(...card.links);
        for (const folder of card.folders) all.push(...folder.links);
      }

      let checked = 0;
      let dead = 0;
      let skipped = 0;
      let unreachable = 0;

      for (const link of all) {
        const target = normalizeUrl(link.url);
        if (!target) {
          skipped += 1;
          continue;
        }
        const status = await resolveLinkStatus(target);
        if (status === 'unreachable') {
          unreachable += 1;
          continue;
        }
        checked += 1;
        link.isDead = status === 'dead';
        link.lastCheckedAt = new Date().toISOString();
        if (link.isDead) dead += 1;
      }

      save();
      return { checked, dead, skipped, unreachable };
    },
  };
}

module.exports = { createStore };

function notFound(message) {
  return Object.assign(new Error(message), { status: 404 });
}

function ensureDataFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
  }
}

function byDateDesc(a, b) {
  return new Date(b).getTime() - new Date(a).getTime();
}

function normalizeUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function resolveLinkStatus(url) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      resolve('unreachable');
      return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      resolve('unreachable');
      return;
    }

    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request(
      parsed,
      { method: 'HEAD', timeout: 10000, headers: { 'User-Agent': 'Bookmarks-LinkChecker/1.0' } },
      (res) => {
        const code = res.statusCode ?? 500;
        resolve(code >= 400 ? 'dead' : 'alive');
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve('unreachable');
    });
    req.on('error', () => resolve('unreachable'));
    req.end();
  });
}
