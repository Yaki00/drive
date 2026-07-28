const fs = require('fs');
const path = require('path');
const { resolveLinkStatus, mapPool } = require('./linkChecker');

const ACTIVITY_CAP = 500;
const ACTIVITY_LIST_LIMIT = 200;
const CHECK_CONCURRENCY = 5;
const CLICK_LOG_CAP = 2000;

const initialData = {
  cards: [],
  activityLog: [],
  clickLog: [],
  seq: { card: 1, folder: 1, link: 1, activity: 1, click: 1 },
};

function createStore(filePath) {
  ensureDataFile(filePath);
  const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(state.cards)) state.cards = [];
  if (!Array.isArray(state.activityLog)) state.activityLog = [];
  if (!Array.isArray(state.clickLog)) state.clickLog = [];
  if (!state.seq) state.seq = { card: 1, folder: 1, link: 1, activity: 1, click: 1 };
  if (state.seq.activity == null) state.seq.activity = 1;
  if (state.seq.click == null) state.seq.click = 1;
  normalizeState(state);

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

  function formatLink(link) {
    return {
      ...link,
      tags: link.tags ?? [],
      environment: link.environment === 'PRD' || link.environment === 'STG' ? link.environment : 'Not define',
      clickCount: Number(link.clickCount) || 0,
      lastClickedAt: link.lastClickedAt ?? null,
    };
  }

  function formatCard(card) {
    const links = (card.links || [])
      .filter((link) => link.folderId == null)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(formatLink);

    const folders = (card.folders || [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((folder) => ({
        ...folder,
        links: (folder.links || [])
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(formatLink),
      }));

    return { ...card, tags: card.tags ?? [], links, folders };
  }

  function findCardById(id) {
    return state.cards.find((card) => card.id === id);
  }

  function findFolderById(folderId) {
    for (const card of state.cards) {
      const folder = (card.folders || []).find((item) => item.id === folderId);
      if (folder) return { card, folder };
    }
    return null;
  }

  function findLinkById(linkId) {
    for (const card of state.cards) {
      const rootLinks = card.links || [];
      const rootIndex = rootLinks.findIndex((item) => item.id === linkId);
      if (rootIndex >= 0) return { card, link: rootLinks[rootIndex], collection: rootLinks, index: rootIndex };

      for (const folder of card.folders || []) {
        const folderLinks = folder.links || [];
        const folderIndex = folderLinks.findIndex((item) => item.id === linkId);
        if (folderIndex >= 0) {
          return { card, folder, link: folderLinks[folderIndex], collection: folderLinks, index: folderIndex };
        }
      }
    }
    return null;
  }

  function nextSortOrder(items) {
    if (!items.length) return 0;
    return Math.max(...items.map((item) => item.sortOrder ?? 0)) + 1;
  }

  function bumpSeq(kind, id) {
    const n = Number(id);
    if (!Number.isFinite(n)) return;
    if (state.seq[kind] == null || n >= state.seq[kind]) {
      state.seq[kind] = n + 1;
    }
  }

  function bumpSeqFromCard(card) {
    bumpSeq('card', card.id);
    for (const folder of card.folders ?? []) {
      bumpSeq('folder', folder.id);
      for (const link of folder.links ?? []) bumpSeq('link', link.id);
    }
    for (const link of card.links ?? []) bumpSeq('link', link.id);
  }

  function resolveActor(dto, fallback) {
    if (dto && typeof dto === 'object') {
      if (dto.actor != null && String(dto.actor).trim()) return String(dto.actor).trim();
      if (dto.createdBy != null && String(dto.createdBy).trim()) return String(dto.createdBy).trim();
    }
    if (typeof dto === 'string' && dto.trim()) return dto.trim();
    if (fallback != null && String(fallback).trim()) return String(fallback).trim();
    // Never fail activity logging for a missing user/session.
    return 'guest';
  }

  function stripMeta(dto) {
    if (!dto || typeof dto !== 'object') return {};
    const copy = { ...dto };
    delete copy.actor;
    return copy;
  }

  function pushLog({ actor, action, entityType, entityId, summary, before = null, after = null }) {
    const entry = {
      id: state.seq.activity++,
      at: new Date().toISOString(),
      actor: actor || 'guest',
      action,
      entityType,
      entityId,
      summary,
      before: before == null ? null : clone(before),
      after: after == null ? null : clone(after),
      reverted: false,
      revertedAt: null,
      revertedBy: null,
    };
    state.activityLog.push(entry);
    if (state.activityLog.length > ACTIVITY_CAP) {
      state.activityLog = state.activityLog.slice(-ACTIVITY_CAP);
    }
    return entry;
  }

  function restoreCard(snapshot) {
    const card = clone(snapshot);
    if (!Array.isArray(card.links)) card.links = [];
    if (!Array.isArray(card.folders)) card.folders = [];
    const idx = state.cards.findIndex((item) => item.id === card.id);
    if (idx >= 0) state.cards[idx] = card;
    else state.cards.push(card);
    bumpSeqFromCard(card);
    return card;
  }

  function cardMetaSnapshot(card) {
    return {
      id: card.id,
      title: card.title,
      description: card.description ?? null,
      color: card.color,
      tags: clone(card.tags || []),
      sortOrder: card.sortOrder,
      createdBy: card.createdBy ?? null,
      createdAt: card.createdAt,
    };
  }

  function applyCardMeta(card, meta) {
    if (!meta || typeof meta !== 'object') return card;
    if (meta.title !== undefined) card.title = meta.title;
    if (meta.description !== undefined) card.description = meta.description;
    if (meta.color !== undefined) card.color = meta.color;
    if (meta.tags !== undefined) card.tags = clone(meta.tags || []);
    if (meta.sortOrder !== undefined) card.sortOrder = meta.sortOrder;
    return card;
  }

  function restoreFolder(snapshot) {
    const card = findCardById(snapshot.cardId);
    if (!card) throw conflict(`Cannot restore folder #${snapshot.id}: card #${snapshot.cardId} missing`);
    const folder = clone(snapshot);
    if (!Array.isArray(folder.links)) folder.links = [];
    const idx = card.folders.findIndex((item) => item.id === folder.id);
    if (idx >= 0) card.folders[idx] = folder;
    else card.folders.push(folder);
    bumpSeq('folder', folder.id);
    for (const link of folder.links) bumpSeq('link', link.id);
    return folder;
  }

  function folderMetaSnapshot(folder) {
    return {
      id: folder.id,
      title: folder.title,
      description: folder.description ?? null,
      sortOrder: folder.sortOrder,
      cardId: folder.cardId,
      createdBy: folder.createdBy ?? null,
      createdAt: folder.createdAt,
    };
  }

  function applyFolderMeta(folder, meta) {
    if (!meta || typeof meta !== 'object') return folder;
    if (meta.title !== undefined) folder.title = meta.title;
    if (meta.description !== undefined) folder.description = meta.description;
    if (meta.sortOrder !== undefined) folder.sortOrder = meta.sortOrder;
    return folder;
  }

  function restoreLink(snapshot) {
    const card = findCardById(snapshot.cardId);
    if (!card) throw conflict(`Cannot restore link #${snapshot.id}: card #${snapshot.cardId} missing`);

    const existing = findLinkById(snapshot.id);
    if (existing) existing.collection.splice(existing.index, 1);

    let targetCollection = card.links;
    if (snapshot.folderId != null) {
      const folder = card.folders.find((item) => item.id === snapshot.folderId);
      if (!folder) {
        throw conflict(`Cannot restore link #${snapshot.id}: folder #${snapshot.folderId} missing`);
      }
      targetCollection = folder.links;
    }

    const link = clone(snapshot);
    targetCollection.push(link);
    bumpSeq('link', link.id);
    return link;
  }

  function removeLinkSilent(linkId) {
    const found = findLinkById(linkId);
    if (!found) return false;
    found.collection.splice(found.index, 1);
    return true;
  }

  function removeFolderSilent(folderId) {
    const found = findFolderById(folderId);
    if (!found) return false;
    const idx = found.card.folders.findIndex((item) => item.id === folderId);
    found.card.folders.splice(idx, 1);
    return true;
  }

  function removeCardSilent(id) {
    const idx = state.cards.findIndex((card) => card.id === id);
    if (idx < 0) return false;
    state.cards.splice(idx, 1);
    return true;
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
      const actor = resolveActor(dto);
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
      pushLog({
        actor,
        action: 'create',
        entityType: 'card',
        entityId: card.id,
        summary: `Created card "${card.title}"`,
        after: clone(card),
      });
      save();
      return formatCard(card);
    },
    updateCard(id, dto) {
      const card = findCardById(id);
      if (!card) throw notFound(`Card #${id} not found`);
      const actor = resolveActor(dto);
      const before = cardMetaSnapshot(card);
      const patch = stripMeta(dto);
      if (patch.title !== undefined) card.title = patch.title;
      if (patch.description !== undefined) card.description = patch.description;
      if (patch.color !== undefined) card.color = patch.color;
      if (patch.tags !== undefined) card.tags = patch.tags;
      if (patch.sortOrder !== undefined) card.sortOrder = patch.sortOrder;
      pushLog({
        actor,
        action: 'update',
        entityType: 'card',
        entityId: id,
        summary: `Updated card "${card.title}"`,
        before,
        after: cardMetaSnapshot(card),
      });
      save();
      return formatCard(card);
    },
    removeCard(id, actor) {
      const idx = state.cards.findIndex((card) => card.id === id);
      if (idx < 0) throw notFound(`Card #${id} not found`);
      const before = clone(state.cards[idx]);
      state.cards.splice(idx, 1);
      pushLog({
        actor: resolveActor(null, actor),
        action: 'delete',
        entityType: 'card',
        entityId: id,
        summary: `Deleted card "${before.title}"`,
        before,
      });
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
      const actor = resolveActor(dto);
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
      pushLog({
        actor,
        action: 'create',
        entityType: 'folder',
        entityId: folder.id,
        summary: `Created folder "${folder.title}"`,
        after: clone(folder),
      });
      save();
      return clone(folder);
    },
    updateFolder(folderId, dto) {
      const found = findFolderById(folderId);
      if (!found) throw notFound(`Folder #${folderId} not found`);
      const actor = resolveActor(dto);
      const before = folderMetaSnapshot(found.folder);
      const patch = stripMeta(dto);
      if (patch.title !== undefined) found.folder.title = patch.title;
      if (patch.description !== undefined) found.folder.description = patch.description;
      if (patch.sortOrder !== undefined) found.folder.sortOrder = patch.sortOrder;
      pushLog({
        actor,
        action: 'update',
        entityType: 'folder',
        entityId: folderId,
        summary: `Updated folder "${found.folder.title}"`,
        before,
        after: folderMetaSnapshot(found.folder),
      });
      save();
      return clone(found.folder);
    },
    removeFolder(folderId, actor) {
      const found = findFolderById(folderId);
      if (!found) throw notFound(`Folder #${folderId} not found`);
      const before = clone(found.folder);
      const idx = found.card.folders.findIndex((item) => item.id === folderId);
      found.card.folders.splice(idx, 1);
      pushLog({
        actor: resolveActor(null, actor),
        action: 'delete',
        entityType: 'folder',
        entityId: folderId,
        summary: `Deleted folder "${before.title}"`,
        before,
      });
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

      const actor = resolveActor(dto);
      const environment =
        dto.environment === 'PRD' || dto.environment === 'STG' ? dto.environment : 'Not define';
      const link = {
        id: state.seq.link++,
        title: dto.title,
        url: dto.url,
        description: dto.description ?? null,
        tags: dto.tags ?? [],
        environment,
        isFavorite: dto.isFavorite ?? false,
        isDead: false,
        sortOrder: nextSortOrder(targetCollection),
        lastCheckedAt: null,
        clickCount: 0,
        lastClickedAt: null,
        cardId,
        folderId,
        createdBy: dto.createdBy ?? null,
        createdAt: new Date().toISOString(),
      };
      targetCollection.push(link);
      pushLog({
        actor,
        action: 'create',
        entityType: 'link',
        entityId: link.id,
        summary: `Created link "${link.title}"`,
        after: clone(link),
      });
      save();
      return clone(link);
    },
    addLinksBulk(cardId, body) {
      const links = body.links ?? [];
      const created = [];
      for (const item of links) {
        created.push(
          this.addLink(cardId, {
            ...item,
            folderId: item.folderId ?? body.folderId ?? null,
            actor: item.actor ?? body.actor,
            createdBy: item.createdBy ?? body.createdBy,
          }),
        );
      }
      return { created: created.length, links: created };
    },
    updateLink(linkId, dto) {
      const found = findLinkById(linkId);
      if (!found) throw notFound(`Link #${linkId} not found`);
      const actor = resolveActor(dto);
      const before = clone(found.link);
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

      const assignable = stripMeta(dto);
      delete assignable.cardId;
      delete assignable.folderId;
      if (assignable.url && assignable.url !== current.url) {
        current.isDead = false;
        current.lastCheckedAt = null;
      }
      if (assignable.environment !== undefined) {
        assignable.environment =
          assignable.environment === 'PRD' || assignable.environment === 'STG'
            ? assignable.environment
            : 'Not define';
      }
      Object.assign(current, assignable);
      pushLog({
        actor,
        action: 'update',
        entityType: 'link',
        entityId: linkId,
        summary: `Updated link "${current.title}"`,
        before,
        after: clone(current),
      });
      save();
      return clone(current);
    },
    removeLink(linkId, actor) {
      const found = findLinkById(linkId);
      if (!found) throw notFound(`Link #${linkId} not found`);
      const before = clone(found.link);
      found.collection.splice(found.index, 1);
      pushLog({
        actor: resolveActor(null, actor),
        action: 'delete',
        entityType: 'link',
        entityId: linkId,
        summary: `Deleted link "${before.title}"`,
        before,
      });
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
    listActivity(limit = ACTIVITY_LIST_LIMIT) {
      const max = Math.min(Math.max(Number(limit) || ACTIVITY_LIST_LIMIT, 1), ACTIVITY_CAP);
      return state.activityLog
        .slice()
        .reverse()
        .slice(0, max)
        .map((entry) => clone(entry));
    },
    clearActivity() {
      state.activityLog = [];
      save();
      return { cleared: true };
    },
    revertActivity(entryId, actor) {
      const entry = state.activityLog.find((item) => item.id === Number(entryId));
      if (!entry) throw notFound(`Activity #${entryId} not found`);
      if (entry.reverted) throw conflict(`Activity #${entryId} already reverted`);

      if (entry.action === 'create') {
        if (entry.entityType === 'card') {
          if (!removeCardSilent(entry.entityId)) {
            throw conflict(`Card #${entry.entityId} no longer exists`);
          }
        } else if (entry.entityType === 'folder') {
          if (!removeFolderSilent(entry.entityId)) {
            throw conflict(`Folder #${entry.entityId} no longer exists`);
          }
        } else if (entry.entityType === 'link') {
          if (!removeLinkSilent(entry.entityId)) {
            throw conflict(`Link #${entry.entityId} no longer exists`);
          }
        } else {
          throw conflict(`Unsupported entity type: ${entry.entityType}`);
        }
      } else if (entry.action === 'delete') {
        if (!entry.before) throw conflict(`Activity #${entryId} has no snapshot to restore`);
        if (entry.entityType === 'card') restoreCard(entry.before);
        else if (entry.entityType === 'folder') restoreFolder(entry.before);
        else if (entry.entityType === 'link') restoreLink(entry.before);
        else throw conflict(`Unsupported entity type: ${entry.entityType}`);
      } else if (entry.action === 'update') {
        if (!entry.before) throw conflict(`Activity #${entryId} has no snapshot to restore`);
        if (entry.entityType === 'card') {
          const card = findCardById(entry.entityId);
          if (!card) throw conflict(`Card #${entry.entityId} no longer exists`);
          // Meta only — never replace children (links/folders) on update revert.
          applyCardMeta(card, entry.before);
        } else if (entry.entityType === 'folder') {
          const found = findFolderById(entry.entityId);
          if (!found) throw conflict(`Folder #${entry.entityId} no longer exists`);
          applyFolderMeta(found.folder, entry.before);
        } else if (entry.entityType === 'link') {
          if (!findLinkById(entry.entityId)) throw conflict(`Link #${entry.entityId} no longer exists`);
          restoreLink(entry.before);
        } else {
          throw conflict(`Unsupported entity type: ${entry.entityType}`);
        }
      } else {
        throw conflict(`Unsupported action: ${entry.action}`);
      }

      entry.reverted = true;
      entry.revertedAt = new Date().toISOString();
      entry.revertedBy = resolveActor(null, actor);
      save();
      return clone(entry);
    },
    unrevertActivity(entryId) {
      const entry = state.activityLog.find((item) => item.id === Number(entryId));
      if (!entry) throw notFound(`Activity #${entryId} not found`);
      if (!entry.reverted) throw conflict(`Activity #${entryId} is not reverted`);

      // Inverse of revertActivity: re-apply the original change.
      if (entry.action === 'create') {
        if (!entry.after) throw conflict(`Activity #${entryId} has no snapshot to restore`);
        if (entry.entityType === 'card') restoreCard(entry.after);
        else if (entry.entityType === 'folder') restoreFolder(entry.after);
        else if (entry.entityType === 'link') restoreLink(entry.after);
        else throw conflict(`Unsupported entity type: ${entry.entityType}`);
      } else if (entry.action === 'delete') {
        if (entry.entityType === 'card') {
          if (!removeCardSilent(entry.entityId)) {
            throw conflict(`Card #${entry.entityId} no longer exists`);
          }
        } else if (entry.entityType === 'folder') {
          if (!removeFolderSilent(entry.entityId)) {
            throw conflict(`Folder #${entry.entityId} no longer exists`);
          }
        } else if (entry.entityType === 'link') {
          if (!removeLinkSilent(entry.entityId)) {
            throw conflict(`Link #${entry.entityId} no longer exists`);
          }
        } else {
          throw conflict(`Unsupported entity type: ${entry.entityType}`);
        }
      } else if (entry.action === 'update') {
        if (!entry.after) throw conflict(`Activity #${entryId} has no snapshot to restore`);
        if (entry.entityType === 'card') {
          const card = findCardById(entry.entityId);
          if (!card) throw conflict(`Card #${entry.entityId} no longer exists`);
          applyCardMeta(card, entry.after);
        } else if (entry.entityType === 'folder') {
          const found = findFolderById(entry.entityId);
          if (!found) throw conflict(`Folder #${entry.entityId} no longer exists`);
          applyFolderMeta(found.folder, entry.after);
        } else if (entry.entityType === 'link') {
          if (!findLinkById(entry.entityId)) throw conflict(`Link #${entry.entityId} no longer exists`);
          restoreLink(entry.after);
        } else {
          throw conflict(`Unsupported entity type: ${entry.entityType}`);
        }
      } else {
        throw conflict(`Unsupported action: ${entry.action}`);
      }

      entry.reverted = false;
      entry.revertedAt = null;
      entry.revertedBy = null;
      save();
      return clone(entry);
    },
    async checkDeadLinks() {
      const all = [];
      for (const card of state.cards) {
        all.push(...(card.links || []));
        for (const folder of card.folders || []) all.push(...(folder.links || []));
      }

      let checked = 0;
      let dead = 0;
      let skipped = 0;
      let unreachable = 0;

      await mapPool(all, CHECK_CONCURRENCY, async (link) => {
        const status = await resolveLinkStatus(link.url);
        if (status === 'skipped') {
          skipped += 1;
          return;
        }
        if (status === 'unreachable') {
          unreachable += 1;
          // Keep previous isDead — network/5xx should not flip the flag.
          return;
        }
        checked += 1;
        link.isDead = status === 'dead';
        link.lastCheckedAt = new Date().toISOString();
        if (link.isDead) dead += 1;
      });

      save();
      return { checked, dead, skipped, unreachable };
    },

    recordLinkClick(linkId, actor) {
      const found = findLinkById(linkId);
      if (!found) throw notFound(`Link #${linkId} not found`);

      const now = new Date().toISOString();
      found.link.clickCount = (Number(found.link.clickCount) || 0) + 1;
      found.link.lastClickedAt = now;

      const environment =
        found.link.environment === 'PRD' || found.link.environment === 'STG'
          ? found.link.environment
          : 'Not define';

      const entry = {
        id: state.seq.click++,
        at: now,
        actor: resolveActor(null, actor),
        linkId: found.link.id,
        title: found.link.title,
        url: found.link.url,
        cardId: found.card.id,
        cardTitle: found.card.title,
        folderId: found.link.folderId ?? null,
        environment,
      };
      state.clickLog.push(entry);
      if (state.clickLog.length > CLICK_LOG_CAP) {
        state.clickLog = state.clickLog.slice(-CLICK_LOG_CAP);
      }
      save();
      return { click: entry, link: formatLink(found.link) };
    },

    getKpi() {
      const allLinks = [];
      for (const card of state.cards) {
        for (const link of card.links || []) {
          allLinks.push({ link, card });
        }
        for (const folder of card.folders || []) {
          for (const link of folder.links || []) {
            allLinks.push({ link, card, folder });
          }
        }
      }

      const byEnvironment = { PRD: 0, STG: 0, 'Not define': 0 };
      let deadLinks = 0;
      let totalClicks = 0;
      for (const { link } of allLinks) {
        const env =
          link.environment === 'PRD' || link.environment === 'STG' ? link.environment : 'Not define';
        byEnvironment[env] += 1;
        if (link.isDead) deadLinks += 1;
        totalClicks += Number(link.clickCount) || 0;
      }

      const links = allLinks
        .map(({ link, card }) => {
          const clickCount = Number(link.clickCount) || 0;
          return {
            linkId: link.id,
            title: link.title,
            url: link.url,
            cardId: card.id,
            cardTitle: card.title,
            environment:
              link.environment === 'PRD' || link.environment === 'STG' ? link.environment : 'Not define',
            isDead: Boolean(link.isDead),
            clicked: clickCount > 0,
            clickCount,
            lastClickedAt: link.lastClickedAt ?? null,
          };
        })
        .sort(
          (a, b) =>
            b.clickCount - a.clickCount ||
            byDateDesc(a.lastClickedAt || 0, b.lastClickedAt || 0) ||
            String(a.title).localeCompare(String(b.title)),
        );

      const topLinks = links
        .filter((item) => item.clickCount > 0)
        .slice(0, 15)
        .map(({ clickCount, clicked: _clicked, ...rest }) => ({
          ...rest,
          clicks: clickCount,
        }));

      const localDayKey = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      const dayKeyFromIso = (iso) => localDayKey(new Date(iso));
      const clicksByDayMap = new Map();
      const now = new Date();
      for (let i = 29; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 12, 0, 0, 0);
        clicksByDayMap.set(localDayKey(d), 0);
      }
      for (const click of state.clickLog) {
        const key = dayKeyFromIso(click.at);
        if (clicksByDayMap.has(key)) {
          clicksByDayMap.set(key, (clicksByDayMap.get(key) || 0) + 1);
        }
      }
      const clicksByDay = [...clicksByDayMap.entries()].map(([date, count]) => ({ date, count }));

      const clicksByActorMap = new Map();
      for (const click of state.clickLog) {
        const actor = click.actor || 'guest';
        clicksByActorMap.set(actor, (clicksByActorMap.get(actor) || 0) + 1);
      }
      const clicksByActor = [...clicksByActorMap.entries()]
        .map(([actor, count]) => ({ actor, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

      const clicksByCardMap = new Map();
      for (const click of state.clickLog) {
        const key = `${click.cardId}::${click.cardTitle || 'Card'}`;
        clicksByCardMap.set(key, (clicksByCardMap.get(key) || 0) + 1);
      }
      const clicksByCard = [...clicksByCardMap.entries()]
        .map(([key, count]) => {
          const [cardId, cardTitle] = key.split('::');
          return { cardId: Number(cardId), cardTitle, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

      const activitySummary = { create: 0, update: 0, delete: 0 };
      for (const entry of state.activityLog) {
        if (entry.reverted) continue;
        if (activitySummary[entry.action] != null) activitySummary[entry.action] += 1;
      }

      const recentClicks = state.clickLog
        .slice()
        .reverse()
        .slice(0, 25)
        .map((entry) => clone(entry));

      return {
        generatedAt: new Date().toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        totals: {
          cards: state.cards.length,
          folders: state.cards.reduce((sum, card) => sum + (card.folders || []).length, 0),
          links: allLinks.length,
          deadLinks,
          totalClicks,
          uniqueLinksClicked: links.filter((item) => item.clicked).length,
          clickEvents: state.clickLog.length,
          activityEvents: state.activityLog.length,
        },
        byEnvironment,
        links,
        topLinks,
        clicksByDay,
        clicksByActor,
        clicksByCard,
        activitySummary,
        recentClicks,
      };
    },
  };
}

module.exports = { createStore };

function normalizeState(state) {
  for (const card of state.cards) {
    if (!Array.isArray(card.links)) card.links = [];
    if (!Array.isArray(card.folders)) card.folders = [];
    if (!Array.isArray(card.tags)) card.tags = [];
    for (const link of card.links) {
      if (!Array.isArray(link.tags)) link.tags = [];
      if (link.environment !== 'PRD' && link.environment !== 'STG') {
        link.environment = 'Not define';
      }
      if (link.clickCount == null) link.clickCount = 0;
      if (link.lastClickedAt === undefined) link.lastClickedAt = null;
    }
    for (const folder of card.folders) {
      if (!Array.isArray(folder.links)) folder.links = [];
      for (const link of folder.links) {
        if (!Array.isArray(link.tags)) link.tags = [];
        if (link.environment !== 'PRD' && link.environment !== 'STG') {
          link.environment = 'Not define';
        }
        if (link.clickCount == null) link.clickCount = 0;
        if (link.lastClickedAt === undefined) link.lastClickedAt = null;
      }
    }
  }
  for (const entry of state.activityLog || []) {
    if (entry.revertedBy === undefined) entry.revertedBy = null;
    if (entry.revertedAt === undefined) entry.revertedAt = null;
    if (entry.reverted == null) entry.reverted = false;
  }
}

function notFound(message) {
  return Object.assign(new Error(message), { status: 404 });
}

function conflict(message) {
  return Object.assign(new Error(message), { status: 409 });
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
