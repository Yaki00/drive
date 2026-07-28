# APS Tools — Bookmarks

Link manager organized as cards, folders and tags.

- **Backend**: Node HTTP pur + JSON (`drive.json`, port **3001**) — pas de Nest, pas de TypeScript
- **Frontend**: React + Vite + MUI (port **5173**)

## Quick start

```bash
# Terminal 1 — API
cd backend && npm start

# Terminal 2 — UI
cd frontend && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

In development, the frontend proxies `/api` to the backend (no CORS issues if Vite uses another port).

## Features

- **Cards** — CRUD, color, tags, reorder (← → buttons on each card)
- **Folders** — nested inside cards
- **Links** — CRUD, tags, favorites, move (card + folder), dead link detection
- **Search & filters** — tags, card, author, date range, favorites, dead links
- **Navbar session** — `Logged in as guest - Guest` (display only; no login yet)
- **Favorites** — per-user panel & filter (`localStorage` key `bookmarks-favorites:<userId>`; API `isFavorite` is legacy/shared and ignored for UI)
- **History** — opened links (localStorage)
- **Undo / Redo** — current session only (`Ctrl+Z` / `Ctrl+Shift+Z`)
- **Drag & drop** — reorder inside a card, move links across cards
- **Dark mode** — navbar toggle, preference persisted
- **i18n** — English by default, French via navbar toggle
- **Dead link check** — server-side (private/localhost URLs skipped)
- **Link import / export** — one or many links as JSON (per-link icon or multi-select)
- **Browser extension** — Chrome/Edge: add current page or import bookmarks (`extension/`)

## API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/cards` | List all cards |
| POST | `/cards` | Create a card |
| PATCH | `/cards/:id` | Update a card |
| DELETE | `/cards/:id` | Delete a card |
| POST | `/cards/reorder` | Reorder cards |
| POST | `/cards/:id/folders` | Add a folder |
| PATCH | `/cards/folders/:folderId` | Update a folder |
| DELETE | `/cards/folders/:folderId` | Delete a folder |
| POST | `/cards/:id/links` | Add a link |
| POST | `/cards/:id/links/bulk` | Import multiple links |
| PATCH | `/cards/links/:linkId` | Update / move a link |
| DELETE | `/cards/links/:linkId` | Delete a link |
| POST | `/cards/:id/reorder` | Reorder links/folders in a card |
| POST | `/cards/links/check-dead` | Check dead links |

## Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API URL in production build (dev default: `/api`; same-origin prod default: ``) |
| `PORT` | Backend port (default `3001`) |
| `SERVE_STATIC` | When `true`, Node serves the built frontend (`deploy/podman` sets this) |
| `DATA_DIR` | Directory for `drive.json` (default: monorepo root; container default `/data`) |
| `CORS_ORIGIN` | Comma-separated allowed origins for cross-origin API access |

## Podman (offline / no public images)

**Aucun npm sur le serveur** : front et backend Node sont dans `deploy/podman/vendor/*.tgz`.

```bash
cd bookmarks
git pull
chmod +x deploy/podman/*.sh
./deploy/podman/build.sh
./deploy/podman/run.sh
```

See [deploy/podman/README.md](deploy/podman/README.md) for details.

## Notes

- `drive.json` is not committed — it is created on first backend start.
- Copy `drive.json` to migrate data to another machine.

## Authentication (not in scope yet)

Authentication is **not implemented** and is intentionally deferred. The `/login` page and navbar label are UI placeholders only (fields disabled, no backend check).

Enterprise SSO / login for the target organization will be added in a later phase. Until then, the API stays open and `createdBy` is filled client-side as `guest`.

## Link import / export

**Export one link** — click the download icon on a link row.

**Export several links** — use **Select links**, check the rows, then **Export**. A `.json` file is downloaded.

**Import** — use **Import**, upload or paste JSON, then choose target card and folder.

Supported JSON shapes:

```json
{
  "version": 1,
  "exportedAt": "2026-06-09T12:00:00.000Z",
  "links": [
    {
      "title": "Example",
      "url": "https://example.com",
      "description": "Optional",
      "tags": ["docs"],
      "isFavorite": false
    }
  ]
}
```

A plain array of link objects or a single `{ "title", "url", ... }` object also works.
