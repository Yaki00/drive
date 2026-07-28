# Déploiement Podman — module bookmarks

Une seule image locale sert l’API Node **et** le frontend React.
Aucun `podman pull` : tout est construit sur la machine.

## Emplacement dans le monorepo

Sur le serveur, seul le dossier **bookmarks** est déployé (un module parmi d’autres) :

```
monorepo/
├── bookmarks/              ← racine du module (BOOKMARKS_ROOT)
│   ├── backend/
│   ├── frontend/
│   └── deploy/podman/      ← scripts ici
├── autre-outil/
└── ...
```

Les scripts détectent automatiquement la racine `bookmarks/` (présence de `frontend/` + `backend/`).
Si besoin, forcez le chemin :

```bash
export BOOKMARKS_ROOT=/srv/apps/bookmarks
```

## Layout serveur recommandé : `apps/` + `data/`

```
/srv/
├── apps/
│   └── bookmarks/          ← backend/, frontend/, deploy/
│       └── deploy/podman/
└── data/
    └── bookmarks/          ← drive.json (créé au premier démarrage)
        └── drive.json
```

**Build** (depuis `apps/bookmarks`) :

```bash
cd /srv/apps/bookmarks
./deploy/podman/build.sh
```

**Run** :

```bash
cd /srv/apps/bookmarks
DATA_DIR=/srv/data/bookmarks ./deploy/podman/run.sh
```

Ou via un fichier de config :

```bash
cp deploy/podman/env.example deploy/podman/env.local
# éditer DATA_DIR=/srv/data/bookmarks
./deploy/podman/run.sh
```

Le conteneur monte `DATA_DIR` sur `/data` ; l’app écrit `drive.json` dedans.

## Prérequis

**Sur le serveur (prod) :**
- `podman`
- `node` (binaire local pour embarquer dans l’image — `prepare-rootfs.sh`)
- **Pas de npm** — les archives sont dans `deploy/podman/vendor/*.tgz` (git)

**Pour mettre à jour le code** (CI ou poste avec npm) :
- `./deploy/podman/refresh-vendor.sh` puis commit des `.tgz`

## Construction (hors-ligne)

```bash
cd bookmarks
git pull
chmod +x deploy/podman/*.sh
./deploy/podman/build.sh
```

## Exécution

```bash
cd bookmarks
./deploy/podman/run.sh
```

→ [http://localhost:3001](http://localhost:3001)

| Variable | Défaut | Description |
|----------|--------|-------------|
| `BOOKMARKS_ROOT` | auto | Chemin vers le dossier bookmarks |
| `IMAGE_NAME` | `bookmarks-app` | Nom de l’image |
| `IMAGE_TAG` | `latest` | Tag de l’image |
| `HOST_PORT` | `3001` | Port exposé sur l’hôte |
| `DATA_DIR` | `deploy/podman/data` | Persistance de `drive.json` |
| `NODE_BIN` | `which node` | Binaire Node embarqué dans l’image |

## Variables du conteneur

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `3001` | Port d’écoute |
| `DATA_DIR` | `/data` | Répertoire de `drive.json` |
| `SERVE_STATIC` | `true` | Servir le frontend depuis Node |
| `CORS_ORIGIN` | — | Origines CORS (virgules) si UI et API sur des hôtes distincts |

## Dépannage

- **Racine introuvable** : `export BOOKMARKS_ROOT=/chemin/vers/bookmarks`
- **Archives manquantes** : `./deploy/podman/refresh-vendor.sh` puis commit
- **SELinux** : le volume utilise le suffixe `:Z`
- **Santé** : `curl http://localhost:3001/health` → `{"status":"ok"}`
