# Tutoriel SSO OIDC + LDAP (BofinLinks)

Guide pas à pas pour **garder le login LDAP** et **ajouter un bouton SSO** (OIDC).

---

## Décisions validées

| Point | Choix |
|-------|--------|
| Hôte public | `https://bof…` (tu complètes le FQDN) |
| Client ID / secret | Variables d’env uniquement (jamais en dur / git) |
| Rôles Admin / User | Réutiliser `ldap.toml` (`group_mappings`) — **oui, c’est OK** |
| Front + API | Même serveur |

### Rôles via `ldap.toml` — comment ça marche avec le SSO ?

Le fichier LDAP ne contient pas des « claims OIDC », mais les **DN de groupes** et le mapping :

```toml
[servers.attributes]
username = "uid"
member_of = "memberOf"

[[servers.group_mappings]]
group_dn = "cn=parftp_bofinmon_admin,…"
org_role = "Admin"

[[servers.group_mappings]]
group_dn = "cn=parftp_bofinmon_user,…"
org_role = "User"
```

**Approche recommandée (hybride) :**

1. SSO OIDC → identité (`uid` / `sub` / `preferred_username`)
2. Avec cet `uid`, **relecture LDAP** des `memberOf` (code déjà présent)
3. `mapGroupToRole(groups)` comme pour le login mot de passe

Ainsi **une seule source de vérité** pour les rôles : `ldap.toml`.  
Pas besoin que l’IdP renvoie les mêmes groupes dans le token.

Si plus tard l’IdP envoie aussi des groupes dans les claims, on pourra s’en servir ; ce n’est pas nécessaire au départ.

---

## URLs (placeholder hôte)

Remplace `bof…` par ton hostname complet (ex. `bofinlinks.xxx`).

| Rôle | URL |
|------|-----|
| Home (après login) | `https://bof…/` |
| Login LDAP + bouton SSO | `https://bof…/login` |
| Démarre SSO | `https://bof…/auth/oidc/start` |
| **Redirect URI à déclarer chez l’IdP** | `https://bof…/auth/oidc/callback` |
| Pose le JWT côté navigateur | `https://bof…/login/sso/callback` |

> La Redirect URI IdP = callback **technique** backend.  
> Ce n’est **pas** la home `/`. Après succès, ton code envoie l’utilisateur vers `/`.

---

## 0. Parcours utilisateur

```
1. User ouvre          https://bof…/login
2. Clique « Connexion SSO »
3. Navigateur →        https://bof…/auth/oidc/start
4. Backend → IdP       (ssologin…/authorize)
5. Auth entreprise
6. IdP →               https://bof…/auth/oidc/callback?code=…&state=…
7. Backend : code → tokens IdP → uid → LDAP memberOf → rôle → JWT app
8. Redirect →          https://bof…/login/sso/callback#token=…
9. Frontend stocke JWT (comme LDAP) → https://bof…/
```

Formulaire LDAP sur `/login` : inchangé (`POST /auth/login` → JWT → `/`).

---

## Phase A — Côté IdP / serveur (hors code)

### A1 — Enregistrement OIDC (équipe SSO)

À fournir :

- Nom app : BofinLinks (ou nom officiel)
- **Redirect URI exacte** : `https://bof…/auth/oidc/callback`
- Scopes : `openid` `profile`

À recevoir (à mettre dans `.env` seulement) :

- `OIDC_CLIENT_ID`
- `OIDC_CLIENT_SECRET`

### A2 — Réseau depuis le serveur app

```bash
curl -vk "https://ssologin.bnpparibas.com/affwebservices/CASSO/oidc/PAR-FTP_SSO_BOOKMARK_PRD/.well-known/openid-configuration"
```

Attendu : JSON discovery. Sinon firewall / proxy sortant HTTPS.

### A3 — HTTPS

La redirect URI en PRD est en général **HTTPS** obligatoire.

---

## Phase B — Config (variables d’env)

Dans le `.env` **du serveur** (pas committé) :

```env
# --- LDAP (existant) ---
LDAP_BIND_DN=…
LDAP_BIND_PASSWORD=…
JWT_SECRET=…
# AUTH_REQUIRED=true

# --- OIDC SSO (à remplir) ---
OIDC_ENABLED=true
OIDC_ISSUER=https://ssologin.bnpparibas.com/affwebservices/CASSO/oidc/PAR-FTP_SSO_BOOKMARK_PRD
OIDC_CLIENT_ID=          # tu ajoutes
OIDC_CLIENT_SECRET=      # tu ajoutes
OIDC_REDIRECT_URI=https://bof…/auth/oidc/callback
OIDC_SCOPES=openid profile
FRONTEND_URL=https://bof…
```

**Règle :** `OIDC_REDIRECT_URI` = URI déclarée chez l’IdP, caractère pour caractère (hôte `bof…` complet inclus).

Dépendance (**Node 16** du projet → **pas** la v6) :

```bash
cd backend
npm install openid-client@5
```

| Version | Node requis | À utiliser ? |
|---------|-------------|--------------|
| `openid-client@6` | Node **≥ 20** | Non (incompatible) |
| `openid-client@5` | Node **16+** (CJS OK) | **Oui** |

Dans `package.json` ça doit apparaître comme `"openid-client": "^5.7.1"` (ou équivalent 5.x), pas `^6`.

---

## Phase C — Backend

### C1 — `oidc.service.js` (nouveau)

1. Discovery ou endpoints issuer
2. `GET` start → URL authorize + `state`
3. Callback :
   - vérifie `state`
   - échange `code` → tokens (`…/token`)
   - lit identité (`uid` / `preferred_username` / `sub`)
   - **LDAP** : récupérer `memberOf` pour cet uid (réutiliser AuthService)
   - `mapGroupToRole` via `group_mappings` du `ldap.toml`
   - signer le **même JWT** que le login LDAP

### C2 — Routes (`auth.routes.js`)

| Méthode | Chemin | Action |
|---------|--------|--------|
| `POST` | `/auth/login` | **Inchangé** (LDAP) |
| `GET` | `/auth/oidc/start` | Redirect → IdP |
| `GET` | `/auth/oidc/callback` | Code → JWT → redirect `#token=` vers `/login/sso/callback` |
| `GET` | `/auth/me` | **Inchangé** |

Redirect après callback :

```text
302 → https://bof…/login/sso/callback#token=<JWT>
```

### C3 — Checklist non-régression

- [ ] Login LDAP OK
- [ ] JWT SSO accepté par `/auth/me` et `requireAuth`
- [ ] Rôles identiques LDAP formulaire vs SSO (mêmes groupes `ldap.toml`)

---

## Phase D — Frontend (même serveur)

### D1 — `LoginPage` (`/login`)

- Formulaire LDAP inchangé
- Bouton SSO → `window.location.href = '/auth/oidc/start'`  
  (ou `/api/auth/oidc/start` : le backend normalise `/api`)

### D2 — Route `/login/sso/callback`

- Lire `#token`
- `setAuthToken` + optionnel `GET /auth/me`
- `navigate('/')` → home `https://bof…/`

### D3 — i18n

`login.sso`, `login.ssoFailed`

---

## Phase E — Tests

### E1 — LDAP

`/login` → compte LDAP → home `/` → API 200 avec Bearer

### E2 — SSO

`/login` → bouton SSO → IdP → callback → home `/` connecté + bon rôle

### E3 — Erreurs fréquentes

| Symptôme | Cause | Action |
|----------|--------|--------|
| `redirect_uri_mismatch` | URI IdP ≠ env | Aligner avec hôte `bof…` final |
| Timeout ssologin | Réseau serveur | Ouvrir HTTPS sortant |
| Rôle faux | uid OIDC ≠ uid LDAP / groupes | Vérifier claim uid + lookup LDAP |
| 503 SSO | env manquante | `OIDC_ENABLED` + id/secret + restart |

---

## Endpoints IdP

Base :  
`https://ssologin.bnpparibas.com/affwebservices/CASSO/oidc/PAR-FTP_SSO_BOOKMARK_PRD`

| Usage | Suffixe |
|-------|---------|
| Discovery | `/.well-known/openid-configuration` |
| Authorize | `/authorize` |
| Token | `/token` |
| JWKS | `/jwks` |
| UserInfo | `/userinfo` |

---

## Avant / après (rappel)

### Architecture

**Avant :** form → LDAP → JWT → `/`  
**Après :** idem **+** bouton SSO → OIDC → uid → LDAP groupes (`ldap.toml`) → même JWT → `/`

### Fichiers

| Fichier | Action |
|---------|--------|
| `oidc.service.js` | Créer |
| `auth.routes.js` | +2 routes |
| `auth.service.js` | Réutiliser lookup groupes + JWT |
| `.env` / `.env.example` | +`OIDC_*` (valeurs vides / placeholders) |
| `package.json` | +`openid-client@5` (pas v6) |
| `LoginPage.tsx` | +bouton |
| `LoginSsoCallbackPage.tsx` | Créer |
| Router + i18n | +route / clés |
| `ldap.toml` | **Inchangé** (source des rôles) |

---

## Checklist prod

- [ ] Hôte final renseigné partout (`bof…` → FQDN réel)
- [ ] Redirect IdP = `https://<hôte>/auth/oidc/callback`
- [ ] `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` dans `.env` serveur
- [ ] Serveur joint `ssologin.bnpparibas.com`
- [ ] LDAP formulaire OK
- [ ] SSO → home `/` + rôle aligné `group_mappings`
---
## Checklist logs : quoi me renvoyer (avec `OIDC_DEBUG`)

### 1) Backend : activer les logs “utiles”
Dans `backend/.env` (ou les env vars du conteneur), mets :

```env
OIDC_DEBUG=true
AUTH_DEBUG=true
```

Puis redémarre le backend.

### 2) Lancer le login SSO
Sur la page login, clique `Connexion SSO`.

### 3) Ce que je veux voir dans les logs backend
Copie-colle :

1. Les logs autour de `[oidc] /start redirecting` (20-30 lignes environ)
2. Les logs autour de `[oidc] /callback received` (20-30 lignes environ)
3. La ligne (ou bloc) contenant `claims_debug` (projection “safe”)
4. Les logs LDAP autour de :
   - `ldap resolveUserDn ok`
   - puis `ldap → jwt ok`

### 4) En cas d’erreur
Ajoute aussi le bloc `[oidc]` avec le `stack` (mais sans tokens bruts / sans `code`).

### 5) Règle d’identification LDAP
Une fois que tu me renvoies `claims_debug`, je te dis exactement quel champ OIDC utiliser pour retrouver le `uid` LDAP dans ta config.
)
