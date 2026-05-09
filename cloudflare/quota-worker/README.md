# Quota Worker (Cloudflare)

Worker API pour limiter le nettoyage audio :

- Niveau 1 (gratuit) : `3 / jour / IP`
- Niveau 2 (code Pro) : quota personnalisé par code (`NTA-PRO-XXXX`)

Le compteur quotidien est stocké dans `Workers KV`.  
Les codes Pro sont stockés dans `D1`.

## 1) Prerequis

- Compte Cloudflare
- `wrangler` installé (`npm i -g wrangler` ou `npx wrangler ...`)
- Être connecté : `wrangler login`

## 2) Créer KV + D1

Depuis `cloudflare/quota-worker` :

```bash
npx wrangler kv namespace create QUOTA_KV
npx wrangler kv namespace create QUOTA_KV --preview
npx wrangler d1 create notraceaudio-quota
```

Copie les IDs retournés dans `wrangler.toml`.

## 3) Initialiser la base D1

```bash
npx wrangler d1 execute notraceaudio-quota --file=./schema.sql --remote
```

## 4) Configurer le token admin

```bash
npx wrangler secret put ADMIN_TOKEN
```

`ADMIN_TOKEN` protège les endpoints d'administration des codes Pro.

## 5) Déployer

```bash
npx wrangler deploy
```

Récupère l'URL du Worker, exemple :

`https://notraceaudio-quota-worker.<subdomain>.workers.dev`

## 6) Brancher le frontend

Dans `frontend/.env.production` :

```env
REACT_APP_QUOTA_API_URL=https://notraceaudio-quota-worker.<subdomain>.workers.dev
```

Le frontend mémorise localement sur l'appareil :

- le code Pro actif
- un snapshot du quota du jour
- un identifiant appareil

Cela améliore l'expérience mobile, mais l'autorité reste côté Worker.

## 7) Endpoints

### Public

- `POST /v1/quota/status`
- `POST /v1/quota/claim`

Payload type :

```json
{
  "proCode": "NTA-PRO-XXXX",
  "units": 1,
  "deviceId": "optional-client-id"
}
```

### Admin

- `POST /v1/admin/pro-code`
- `POST /v1/admin/pro-code/revoke`

Header requis :

`X-Admin-Token: <ADMIN_TOKEN>`

## 8) Exemples admin (création / révocation)

Créer un code 100/jour :

```bash
curl -X POST "https://<worker-url>/v1/admin/pro-code" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: <ADMIN_TOKEN>" \
  -d '{"code":"NTA-PRO-ALPHA100","dailyLimit":100,"isUnlimited":false,"active":true,"note":"client alpha"}'
```

Créer un code illimité :

```bash
curl -X POST "https://<worker-url>/v1/admin/pro-code" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: <ADMIN_TOKEN>" \
  -d '{"code":"NTA-PRO-ULTRA","isUnlimited":true,"active":true,"note":"plan enterprise"}'
```

Révoquer un code :

```bash
curl -X POST "https://<worker-url>/v1/admin/pro-code/revoke" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Token: <ADMIN_TOKEN>" \
  -d '{"code":"NTA-PRO-ALPHA100"}'
```

## Notes

- Le quota gratuit est défini par `FREE_DAILY_LIMIT` dans `wrangler.toml`.
- Le matching gratuit est fait par IP (`CF-Connecting-IP`).
- Si tu veux du 100% anti-contournement à très forte charge/concurrence, passe plus tard sur Durable Objects pour un verrou strict des increments.
