# Vendor archives (offline Podman build)

| Archive | Contenu |
|---------|---------|
| `frontend-dist.tgz` | Build Vite du frontend (`dist/`) |
| `backend-server.tgz` | Serveur Node pur (`server/` + `package.json`) |

Régénération (machine avec npm) :

```bash
./deploy/podman/refresh-vendor.sh
```

Le backend n’a **aucune** dépendance npm runtime.
