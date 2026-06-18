# Archives offline — incluses dans git

Le serveur Red Hat **n'a pas besoin de npm** : tout est déjà compilé ici.

| Fichier | Contenu |
|---------|---------|
| `frontend-dist.tgz` | UI React compilée |
| `backend-dist.tgz` | API NestJS compilée |
| `backend-prod-node_modules.tgz` | Dépendances runtime (tslib, nestjs, sql.js…) |

## Sur le serveur (zéro npm)

```bash
git pull
cd bookmarks
./deploy/podman/build.sh
./deploy/podman/run.sh
```

## Quand le code change (machine avec npm — CI ou poste perso)

```bash
./deploy/podman/refresh-vendor.sh
git add deploy/podman/vendor/*.tgz
git commit -m "Refresh offline vendor archives"
git push
```
