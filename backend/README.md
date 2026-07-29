# Backend — Express + LDAP

API bookmarks en Express. Auth LDAP optionnelle (ou mode mock local).

## Démarrage

```bash
cd backend
npm install
AUTH_MODE=mock npm start
```

Écoute sur [http://localhost:3001](http://localhost:3001).  
Données : `drive.json` à la racine du monorepo (ou `DATA_DIR`).

### Auth locale (sans LDAP)

```bash
AUTH_MODE=mock npm start
```

Comptes mock : `admin`/`admin` (Admin), `user`/`user`, `guest`/`guest`.

### Auth LDAP

1. Copier `ldap.toml.example` → `ldap.toml`
2. Renseigner host / bind / search
3. Lancer sans `AUTH_MODE=mock` (ou `AUTH_MODE=ldap`)

```bash
JWT_SECRET=change-me npm start
```

## Routes auth

| Méthode | Chemin | Description |
|---------|--------|-------------|
| `GET` | `/auth/status` | Auth configurée ? |
| `POST` | `/auth/login` | `{ username, password }` → `{ token, role, user }` |
| `GET` | `/auth/me` | Profil JWT (`Authorization: Bearer …`) |

Préfixe `/api/auth/*` aussi accepté.

## Variables d’environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3001` | Port d’écoute |
| `DATA_DIR` | racine monorepo | Dossier de `drive.json` |
| `AUTH_MODE` | — | `mock` / `dev` / vide (LDAP via `ldap.toml`) |
| `LDAP_TOML` | `backend/ldap.toml` | Chemin config LDAP |
| `JWT_SECRET` | `secret` | Secret JWT |
| `JWT_EXPIRES_IN` | `8h` | Durée du token |
| `AUTH_REQUIRED` | `false` | Si `true`, JWT obligatoire sur l’API |
| `SERVE_STATIC` | `false` | Sert le frontend depuis `public/` |
| `CORS_ORIGIN` | — | Origines CORS supplémentaires |

## Scripts

| Commande | Description |
|----------|-------------|
| `npm start` | Lance l’API |
| `npm run start:dev` | Lance en `AUTH_MODE=mock` |
| `npm test` | Tests API + linkChecker + auth |

## Fichiers

```
server/
  server.js              # Express + CORS + static
  router.js              # API cards / activity / kpi
  store.js
  linkChecker.js
  auth/
    auth.service.js      # LDAP + JWT
    auth.routes.js       # Routes Express /auth
ldap.toml.example
```
