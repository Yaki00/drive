# Backend — Node HTTP

API bookmarks en Node pur (pas de Nest, pas de TypeScript, zéro dépendance npm).

## Démarrage

```bash
cd backend
npm start
```

Écoute sur [http://localhost:3001](http://localhost:3001).  
Données : `drive.json` à la racine du monorepo (ou `DATA_DIR`).

## Favoris (`isFavorite`)

Le champ `isFavorite` sur chaque link dans `drive.json` est **legacy / partagé** : l’UI ne s’en sert plus pour le panneau Favoris ni le filtre. Les favoris sont **par utilisateur** côté frontend (`localStorage` : `bookmarks-favorites:<userId>`). L’API accepte encore `isFavorite` en create/update pour compat (export/import, extension), mais ce n’est plus la source de vérité UI.

## Scripts

| Commande | Description |
|----------|-------------|
| `npm start` | Lance l’API |
| `npm test` | Tests API (serveur déjà lancé, ou via script) |

## Variables d’environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3001` | Port d’écoute |
| `DATA_DIR` | racine du monorepo | Dossier de `drive.json` |
| `SERVE_STATIC` | `false` | Sert le frontend depuis `public/` |
| `STATIC_ROOT` | `backend/public` | Racine des fichiers statiques |
| `CORS_ORIGIN` | — | Origines CORS supplémentaires (virgules) |

## Fichiers

```
server/
  server.js   # HTTP + CORS + static optionnel
  router.js   # Routes /cards et /health
  store.js    # Persistance JSON
```
