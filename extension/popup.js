import { addLink, addLinksBulk, getCards } from './lib/api.js';
import {
  dedupeByUrl,
  flattenBookmarkTree,
  toLinkPayload,
} from './lib/bookmarks.js';
import { getApiUrl } from './lib/storage.js';

const state = {
  cards: [],
  bookmarks: [],
};

const els = {
  apiLabel: document.getElementById('api-label'),
  tabs: [...document.querySelectorAll('.tab')],
  panels: {
    add: document.getElementById('panel-add'),
    import: document.getElementById('panel-import'),
  },
  add: {
    title: document.getElementById('add-title'),
    url: document.getElementById('add-url'),
    card: document.getElementById('add-card'),
    folder: document.getElementById('add-folder'),
    favorite: document.getElementById('add-favorite'),
    submit: document.getElementById('add-submit'),
    status: document.getElementById('add-status'),
  },
  import: {
    card: document.getElementById('import-card'),
    folder: document.getElementById('import-folder'),
    list: document.getElementById('bookmark-list'),
    selectAll: document.getElementById('import-select-all'),
    selectNone: document.getElementById('import-select-none'),
    reload: document.getElementById('import-reload'),
    submit: document.getElementById('import-submit'),
    status: document.getElementById('import-status'),
  },
};

function showStatus(el, message, type = 'info') {
  el.textContent = message;
  el.className = `status show ${type}`;
}

function hideStatus(el) {
  el.className = 'status';
  el.textContent = '';
}

function fillCardSelect(select, cards, selectedId) {
  select.innerHTML = '';
  for (const card of cards) {
    const option = document.createElement('option');
    option.value = String(card.id);
    option.textContent = card.title;
    select.appendChild(option);
  }
  if (selectedId) {
    select.value = String(selectedId);
  }
}

function fillFolderSelect(select, card, selectedId = '') {
  select.innerHTML = '<option value="">Card root</option>';
  for (const folder of card?.folders || []) {
    const option = document.createElement('option');
    option.value = String(folder.id);
    option.textContent = folder.title;
    select.appendChild(option);
  }
  select.value = selectedId ? String(selectedId) : '';
}

function getCardById(cardId) {
  return state.cards.find((card) => card.id === Number(cardId));
}

function renderBookmarkList() {
  const container = els.import.list;
  container.innerHTML = '';

  if (!state.bookmarks.length) {
    container.innerHTML = '<div class="empty">No importable bookmarks found.</div>';
    els.import.submit.disabled = true;
    return;
  }

  for (const entry of state.bookmarks) {
    const row = document.createElement('div');
    row.className = 'list-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.id = entry.id;
    checkbox.addEventListener('change', updateImportButton);

    const label = document.createElement('label');
    label.htmlFor = checkbox.id = `bm-${entry.id}`;
    label.innerHTML = `<strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.url)}</small>`;

    row.appendChild(checkbox);
    row.appendChild(label);
    container.appendChild(row);
  }

  updateImportButton();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getSelectedBookmarkIds() {
  return [...els.import.list.querySelectorAll('input[type="checkbox"]:checked')].map(
    (input) => input.dataset.id,
  );
}

function updateImportButton() {
  const count = getSelectedBookmarkIds().length;
  els.import.submit.disabled = count === 0;
  els.import.submit.textContent = count
    ? `Import ${count} bookmark${count > 1 ? 's' : ''}`
    : 'Import selected';
}

async function loadCards() {
  state.cards = await getCards();
  fillCardSelect(els.add.card, state.cards, state.cards[0]?.id);
  fillCardSelect(els.import.card, state.cards, state.cards[0]?.id);
  fillFolderSelect(els.add.folder, getCardById(els.add.card.value));
  fillFolderSelect(els.import.folder, getCardById(els.import.card.value));
}

async function loadCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  els.add.title.value = tab.title || '';
  els.add.url.value = tab.url || '';
}

async function loadBrowserBookmarks() {
  const tree = await chrome.bookmarks.getTree();
  state.bookmarks = dedupeByUrl(flattenBookmarkTree(tree));
  renderBookmarkList();
}

async function handleAddSubmit() {
  hideStatus(els.add.status);
  const cardId = Number(els.add.card.value);
  const folderId = els.add.folder.value ? Number(els.add.folder.value) : null;
  const title = els.add.title.value.trim();
  const url = els.add.url.value.trim();

  if (!cardId || !title || !url) {
    showStatus(els.add.status, 'Title, URL and card are required.', 'error');
    return;
  }

  els.add.submit.disabled = true;
  try {
    await addLink(cardId, {
      title,
      url,
      folderId,
      isFavorite: els.add.favorite.checked,
      createdBy: 'extension',
    });
    showStatus(els.add.status, 'Link added to APS Tools.', 'ok');
  } catch (error) {
    showStatus(els.add.status, error.message || 'Failed to add link.', 'error');
  } finally {
    els.add.submit.disabled = false;
  }
}

async function handleImportSubmit() {
  hideStatus(els.import.status);
  const cardId = Number(els.import.card.value);
  const folderId = els.import.folder.value ? Number(els.import.folder.value) : null;
  const selectedIds = new Set(getSelectedBookmarkIds());
  const selected = state.bookmarks.filter((entry) => selectedIds.has(entry.id));

  if (!cardId || selected.length === 0) {
    showStatus(els.import.status, 'Select at least one bookmark.', 'error');
    return;
  }

  els.import.submit.disabled = true;
  showStatus(els.import.status, `Importing ${selected.length} bookmark(s)…`, 'info');

  try {
    const result = await addLinksBulk(
      cardId,
      selected.map((entry) => toLinkPayload(entry)),
      folderId,
    );
    showStatus(
      els.import.status,
      `${result.created} bookmark(s) imported.`,
      'ok',
    );
    for (const checkbox of els.import.list.querySelectorAll('input[type="checkbox"]')) {
      checkbox.checked = false;
    }
    updateImportButton();
  } catch (error) {
    showStatus(els.import.status, error.message || 'Import failed.', 'error');
  } finally {
    els.import.submit.disabled = getSelectedBookmarkIds().length === 0;
  }
}

function bindEvents() {
  for (const tab of els.tabs) {
    tab.addEventListener('click', () => {
      els.tabs.forEach((btn) => btn.classList.toggle('active', btn === tab));
      Object.values(els.panels).forEach((panel) => panel.classList.remove('active'));
      els.panels[tab.dataset.tab].classList.add('active');
    });
  }

  els.add.card.addEventListener('change', () => {
    fillFolderSelect(els.add.folder, getCardById(els.add.card.value));
  });

  els.import.card.addEventListener('change', () => {
    fillFolderSelect(els.import.folder, getCardById(els.import.card.value));
  });

  els.add.submit.addEventListener('click', () => void handleAddSubmit());
  els.import.submit.addEventListener('click', () => void handleImportSubmit());

  els.import.selectAll.addEventListener('click', () => {
    for (const checkbox of els.import.list.querySelectorAll('input[type="checkbox"]')) {
      checkbox.checked = true;
    }
    updateImportButton();
  });

  els.import.selectNone.addEventListener('click', () => {
    for (const checkbox of els.import.list.querySelectorAll('input[type="checkbox"]')) {
      checkbox.checked = false;
    }
    updateImportButton();
  });

  els.import.reload.addEventListener('click', () => {
    hideStatus(els.import.status);
    void loadBrowserBookmarks();
  });
}

async function init() {
  bindEvents();
  els.apiLabel.textContent = `API: ${await getApiUrl()}`;

  try {
    await loadCards();
    await loadCurrentTab();
    await loadBrowserBookmarks();
  } catch (error) {
    showStatus(
      els.add.status,
      error.message || 'Cannot reach APS Tools API. Check Settings.',
      'error',
    );
  }
}

void init();
