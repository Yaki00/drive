# Bookmarks

Gestionnaire de liens organisés en cartes, dossiers et tags.

- **Backend** : NestJS + TypeORM + SQLite (`drive.db`, port **3001**)
- **Frontend** : React + Vite + MUI (port **5173**)

## Démarrage

```bash
# Terminal 1 — API
cd backend && npm run start:dev

# Terminal 2 — Interface
cd frontend && npm run dev
```

Ouvrez [http://localhost:5173](http://localhost:5173). En dev, le frontend proxifie `/api` vers le backend (pas de souci CORS si le port Vite change).

## Fonctionnalités

- **Cartes** — CRUD, couleur, tags, réordonnancement (flèches sur chaque carte)
- **Dossiers** — imbriqués dans les cartes, liens par dossier
- **Liens** — CRUD, tags, favoris, déplacement (carte + dossier), liens morts
- **Recherche & filtres** — tags, carte, auteur, plage de dates, favoris, liens morts
- **Utilisateur local** — nom saisi dans les filtres, enregistré comme auteur des créations
- **Favoris** — panneau dédié
- **Historique** — liens ouverts (localStorage)
- **Undo / Redo** — session courante (`Ctrl+Z` / `Ctrl+Shift+Z`)
- **Drag & drop** — réorganisation intra-carte, déplacement inter-cartes
- **Mode sombre** — toggle navbar, préférence persistée
- **Vérification liens morts** — côté serveur (URLs privées/localhost ignorées)

## API principale

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/cards` | Liste les cartes (triées par `sortOrder`) |
| POST | `/cards` | Crée une carte |
| PATCH | `/cards/:id` | Met à jour une carte |
| DELETE | `/cards/:id` | Supprime une carte |
| POST | `/cards/reorder` | Réordonne les cartes `{ items: [{ id, sortOrder }] }` |
| POST | `/cards/:id/folders` | Ajoute un dossier |
| PATCH | `/cards/folders/:folderId` | Met à jour un dossier |
| DELETE | `/cards/folders/:folderId` | Supprime un dossier |
| POST | `/cards/:id/links` | Ajoute un lien |
| PATCH | `/cards/links/:linkId` | Met à jour / déplace un lien |
| DELETE | `/cards/links/:linkId` | Supprime un lien |
| POST | `/cards/:id/reorder` | Réordonne liens/dossiers dans une carte |
| POST | `/cards/links/check-dead` | Vérifie les liens morts |

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | URL de l'API en build prod (défaut dev : `/api`) |
| `PORT` | Port backend (défaut `3001`) |
