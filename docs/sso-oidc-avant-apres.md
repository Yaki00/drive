# SSO OIDC — volume de changements & avant / après

## Verdict

**Non, il n’y a pas beaucoup de choses à modifier.**  
Le login LDAP + JWT reste tel quel. Le SSO est **ajouté en parallèle** (bouton + 2–3 routes + un petit service OIDC).

| Zone | Action | Effort |
|------|--------|--------|
| LDAP / `POST /auth/login` | **Inchangé** | — |
| JWT + `requireAuth` + `localStorage` | **Réutilisé** | — |
| Backend OIDC | **Nouveau** (~80–150 lignes) | moyen |
| Routes auth | **+2 routes** | faible |
| Frontend login | **+bouton + callback** | faible |
| Config `.env` | **+quelques variables** | faible |

Fichiers touchés typiquement : **~5–7**, dont **2–3 nouveaux**. Le reste du projet (upload, liens, etc.) ne bouge pas.

---

## Endpoints IdP (déjà fournis)

Base : `https://ssologin.bnpparibas.com/affwebservices/CASSO/oidc/PAR-FTP_SSO_BOOKMARK_PRD`

| Usage | URL |
|-------|-----|
| Discovery | `…/.well-known/openid-configuration` |
| Authorize | `…/authorize` |
| Token | `…/token` |
| JWKS | `…/jwks` |
| UserInfo | `…/userinfo` |
| Introspect / Revoke | optionnels |

Scopes visibles côté IdP : `openid`, `profile`.

À récupérer aussi côté admin IdP (pas dans la capture) :

- **Client ID**
- **Client Secret** (si confidential client)
- **Redirect URI** enregistrée (ex. `https://ton-frontend/login/sso/callback` ou via backend)

---

## Architecture

### Avant

```
[Login form] → POST /auth/login → LDAP bind → JWT → localStorage
```

### Après

```
[Login form]     → POST /auth/login      → LDAP bind     → JWT → localStorage
[Bouton SSO]    → GET  /auth/oidc/start → redirect IdP
[Callback]      → GET  /auth/oidc/callback?code=… → token IdP → claims → même JWT → localStorage
```

Les deux chemins convergent vers **le même format JWT** (`sub`, `name`, `role`).

---

## 1. Config env

### Avant (`.env.example`)

```env
# AUTH_MODE=mock
# JWT_SECRET=change-me
LDAP_BIND_DN=…
LDAP_BIND_PASSWORD=…
```

### Après

```env
# AUTH_MODE=mock
# JWT_SECRET=change-me
LDAP_BIND_DN=…
LDAP_BIND_PASSWORD=…

# OIDC SSO (en plus du LDAP)
OIDC_ENABLED=true
OIDC_ISSUER=https://ssologin.bnpparibas.com/affwebservices/CASSO/oidc/PAR-FTP_SSO_BOOKMARK_PRD
OIDC_CLIENT_ID=CHANGE_ME
OIDC_CLIENT_SECRET=CHANGE_ME
OIDC_REDIRECT_URI=https://TON_HOST/api/auth/oidc/callback
OIDC_SCOPES=openid profile
# Optionnel : claim groupes → rôles (si l’IdP les envoie)
# OIDC_GROUPS_CLAIM=groups
FRONTEND_URL=https://TON_FRONTEND
```

---

## 2. Backend — routes

Fichier : `backend/server/auth/auth.routes.js`

### Avant

```js
router.post('/login', async (req, res) => { /* LDAP */ });
router.get('/me', (req, res) => { /* JWT */ });
// pas de SSO
```

### Après (ajouts seulement — `/login` inchangé)

```js
// LDAP inchangé
router.post('/login', async (req, res) => { /* … */ });

// Nouveau : démarre le flux OIDC (redirect navigateur vers IdP)
router.get('/oidc/start', async (req, res) => {
  if (!authService.isOidcEnabled) {
    return res.status(503).json({ message: 'OIDC not configured' });
  }
  const { url, state } = await authService.createOidcAuthUrl();
  // stocker state (cookie httpOnly ou mémoire/redis court)
  res.redirect(url);
});

// Nouveau : callback IdP → échange code → JWT app → redirect frontend
router.get('/oidc/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const result = await authService.loginWithOidcCode(code, state);
    // rediriger vers le frontend avec le token (fragment ou cookie court)
    const front = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(
      `${front}/login/sso/callback#token=${encodeURIComponent(result.token)}`,
    );
  } catch (err) {
    return res.status(401).json({ message: err.message || 'SSO failed' });
  }
});

router.get('/me', (req, res) => { /* inchangé */ });
```

**Note :** préférer un cookie httpOnly one-shot plutôt qu’un token dans le hash si la sécu interne l’exige ; le hash reste simple pour un premier jet.

---

## 3. Backend — service OIDC (nouveau fichier)

### Avant

Pas de fichier OIDC. Tout est dans `auth.service.js` (LDAP + JWT).

### Après

Nouveau fichier léger, ex. `backend/server/auth/oidc.service.js` :

```js
// Pseudo-code du flux Authorization Code
async createOidcAuthUrl() {
  const state = randomBytes(16).toString('hex');
  const url = new URL(`${issuer}/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile');
  url.searchParams.set('state', state);
  return { url: url.toString(), state };
}

async loginWithOidcCode(code, state) {
  // 1. vérifier state
  // 2. POST {issuer}/token  (code + client_id + client_secret + redirect_uri)
  // 3. valider id_token via JWKS ({issuer}/jwks)  — ou userinfo
  // 4. extraire sub / name / groups
  // 5. mapGroupToRole (même logique que LDAP si claims groupes)
  // 6. return { token: signJwt(...), user, role }  // IDENTIQUE au login LDAP
}
```

Lib recommandée : `openid-client` (Node) — évite de réécrire discovery / JWKS / validation.

`auth.service.js` LDAP : **quasi intact**. On y ajoute au plus un appel `signJwt` / `mapGroupToRole` réutilisable, ou on duplique le `jwt.sign` (déjà présent).

---

## 4. Frontend — page login

Fichier : `frontend/src/pages/LoginPage.tsx`

### Avant

```tsx
{/* formulaire username / password */}
<Button type="submit" …>
  {t('login.submit')}
</Button>
```

### Après

```tsx
{/* formulaire LDAP inchangé */}
<Button type="submit" …>
  {t('login.submit')}
</Button>

<Divider sx={{ my: 2 }}>ou</Divider>

<Button
  variant="outlined"
  fullWidth
  onClick={() => {
    // redirect vers le backend qui envoie vers l’IdP
    window.location.href = `${API_BASE}/auth/oidc/start`;
  }}
>
  {t('login.sso')}
</Button>
```

---

## 5. Frontend — callback SSO (nouveau)

### Avant

Aucune route callback.

### Après

Nouvelle page légère `LoginSsoCallbackPage.tsx` + route `/login/sso/callback` :

```tsx
useEffect(() => {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get('token');
  if (!token) {
    setError('SSO token missing');
    return;
  }
  setAuthToken(token);
  // optionnel : GET /auth/me pour fullName
  api.me().then((r) => {
    setSessionUser({ id: r.user.id, fullName: r.user.fullName });
    navigate('/');
  });
}, []);
```

`sessionUser.ts`, `api.client` Bearer, Navbar : **inchangés**.

---

## 6. API client

Fichier : `frontend/src/api/client.ts`

### Avant

```ts
login: (username, password) => request('/auth/login', { … }),
authStatus: () => request('/auth/status'),
me: () => request('/auth/me'),
```

### Après

```ts
login: (username, password) => request('/auth/login', { … }), // inchangé
authStatus: () => request('/auth/status'),
me: () => request('/auth/me'),
// pas forcément besoin d’une méthode : le bouton fait un redirect navigateur
```

Optionnel : `authStatus` peut renvoyer `oidc: true` pour masquer le bouton si SSO désactivé.

---

## 7. i18n

### Avant

```ts
'login.submit': 'Se connecter',
```

### Après

```ts
'login.submit': 'Se connecter',
'login.sso': 'Connexion SSO',
'login.ssoFailed': 'Échec de la connexion SSO',
```

---

## Récap fichiers

| Fichier | Avant → Après |
|---------|----------------|
| `auth.routes.js` | +2 routes OIDC |
| `auth.service.js` | inchangé ou léger export JWT/rôles |
| `oidc.service.js` | **nouveau** |
| `.env.example` | +vars OIDC |
| `LoginPage.tsx` | +bouton SSO |
| `LoginSsoCallbackPage.tsx` | **nouveau** |
| router frontend | +1 route |
| `translations.ts` | +2–3 clés |
| `package.json` backend | +`openid-client` |

**Ne pas toucher :** logique métier fichiers/liens, middleware JWT existant, stockage token, tests LDAP (sauf ajouts de tests OIDC).

---

## Checklist IdP / réseau (hors code)

1. Enregistrer la **Redirect URI** exacte côté CA SSO.
2. Obtenir **Client ID / Secret**.
3. Vérifier que le serveur backend peut joindre `ssologin.bnpparibas.com` (souvent réseau interne / proxy).
4. Regarder un `id_token` / `userinfo` de test : quels claims pour `uid`, nom, groupes ?
5. Aligner le mapping groupes → `Admin` / `User` avec celui du `ldap.toml`.

---

## Estimation

Sur le vrai PC (même base de code) :

- **½ à 1 jour** si OIDC standard + claims clairs  
- **+½ jour** si proxy, certifs, ou claims groupes exotiques

Le plus long n’est en général **pas** le code app, mais la config IdP + réseau + mapping des claims.
)
