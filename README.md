# No Trace Audio

> Site **100 % statique** pour retirer les watermarks et fingerprints IA des musiques générées (Suno, ElevenLabs, OpenAI, etc.). **Tout le traitement se fait dans ton navigateur** via Web Audio API — aucun fichier n'est envoyé sur un serveur. Compatible **GitHub Pages, Cloudflare Pages, Netlify, Vercel**.

Inspiré du projet Python [`geeknik/ai-audio-fingerprint-remover`](https://github.com/geeknik/ai-audio-fingerprint-remover), porté en JavaScript pur.

## Quotas Cloudflare (optionnel)

Un système de quotas journalier (`3/jour/IP`) + codes Pro (`NTA-PRO-XXXX`) est prêt dans :

- `cloudflare/quota-worker/README.md`
- `cloudflare/quota-worker/src/index.js`

Pour activer le frontend, crée `frontend/.env.production` avec `REACT_APP_QUOTA_API_URL=<url-du-worker>`.

---

## Pipeline anti-détection (Phase A + B + C — Dec 2025)

| # | Étape | Effet |
|---|------|-------|
| 1 | Décodage local | `AudioContext.decodeAudioData()` — MP3/WAV/FLAC/OGG/M4A/AAC |
| 2 | **FFT phase randomization HF** *(Phase B)* | STFT 2048 / Hann / hop ¼ — randomise la phase >6 kHz, **casse la cohérence du codec neuronal** *(expérimental, peut dégrader la musique)* |
| 3 | **Spectral magnitude jitter** *(Phase B)* | Variation aléatoire ±0.4 dB par bin FFT — détruit les patterns de quantification *(expérimental, peut dégrader la musique)* |
| 4 | **Pitch + time micro-shift** | `playbackRate ±0.4-1.5 %` → décale toutes les fréquences |
| 5 | **Micro time-warping** *(Phase B)* | Vibrato de tempo aléatoire ±0.3 % via `setValueCurveAtTime` — casse la régularité parfaite des onsets |
| 6 | **Resample chain non-entier** | Pass à 47 983 Hz puis retour origRate → brouille la position sub-échantillon des artefacts |
| 7 | Filtres spectraux | Low-pass + notch (16/17/18/19 kHz Suno) + high-shelf reduction |
| 8 | **Tape saturation** (`tanh`) | Harmoniques analogiques douces |
| 9 | **Short-IR convolution** *(Phase C)* | IR aléatoire ~35 ms via `ConvolverNode` — cue acoustique d'une petite pièce |
| 10 | **Stereo M/S decorrelation** *(Phase C)* | Délai R ~80 µs via `DelayNode` — brise la cohérence stéréo parfaite |
| 11 | **Pink noise floor** (-65 dB) | Voss-McCartney : bruit de fond d'un enregistrement réel |
| 12 | Dithering triangulaire | Sub-audible, casse les patterns d'absence statistiques |
| 13 | **Codec round-trip MP3** *(optional)* | Re-encode 256/320 kbps puis re-décode → appose une signature codec lossy naturelle |
| 14 | Re-encodage WAV PCM 16-bit **ou MP3 320 kbps** (lamejs) | Strip total des métadonnées |

**4 presets** : Lite · Standard · Aggressive · **Stealth**.
Par défaut, `phase randomization HF` et `spectral magnitude jitter` sont désactivés sur tous les presets (options expérimentales).

### Outils intégrés

- **🎨 Spectrogramme avant/après** — heatmap STFT 0-12 kHz, preuve visuelle des bandes nettoyées
- **🎧 A/B Blind Test** — modal qui présente deux samples non labellisés en ordre random et calcule ton score (>60 % = nettoyage trop audible, <60 % = transparent)
- **📦 Batch processing** — dépose plusieurs fichiers d'un coup, traitement séquentiel avec progression par fichier, "Télécharger tous"
- **🎲 Random Seed** — randomise les paramètres à chaque run pour empreinte unique

### Mode « Random Seed » 🎲

Toggle dans la barre d'options. Chaque clic sur « Lancer le nettoyage » **randomise les paramètres** (`playbackRate`, intermediate rate, drive, niveau pink noise, fréquence phase rand, etc.) dans une plage sûre. Conséquence : même fichier source → empreinte de sortie **différente à chaque run**, impossible pour un détecteur de mémoriser ton « style de nettoyage ».

---

## Développement local

```bash
cd frontend
yarn install
yarn start
# → http://localhost:3000
```

---

## 🚀 Déploiement GitHub Pages — étape par étape

### Pré-requis

- Compte GitHub
- Git installé localement (`git --version`)
- Node 18+ et Yarn 1 (`node -v` / `yarn -v`)

---

### Étape 1 — Préparer le projet localement

```bash
# 1.1 - Récupère le code
git clone <ton-repo> notraceaudio
cd notraceaudio

# 1.2 - Installe les dépendances
cd frontend
yarn install

# 1.3 - Vérifie que la config GitHub Pages est OK
# Le fichier frontend/package.json contient déjà :
#   "homepage": "."
# → ça force des chemins relatifs, indispensable sur GH Pages.
```

### Étape 2 — Créer le repo GitHub

```bash
# Reviens à la racine du projet
cd ..

# Initialise git (si pas déjà fait)
git init
git add .
git commit -m "Initial commit"

# Crée le repo sur GitHub puis :
git branch -M main
git remote add origin https://github.com/<ton-pseudo>/<nom-repo>.git
git push -u origin main
```

### Étape 3 — Configurer le workflow GitHub Actions

Crée le fichier `.github/workflows/deploy.yml` à la racine du repo :

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "yarn"
          cache-dependency-path: frontend/yarn.lock

      - name: Install dependencies
        working-directory: frontend
        run: yarn install --frozen-lockfile

      - name: Build
        working-directory: frontend
        run: yarn build
        env:
          CI: false

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: frontend/build

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

Push :

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: deploy to GitHub Pages"
git push
```

### Étape 4 — Activer GitHub Pages dans le repo

1. Va sur **github.com/`<ton-pseudo>`/`<nom-repo>`/settings/pages**
2. Section **Source** → choisis **GitHub Actions**
3. Sauvegarde

### Étape 5 — Attendre le build

1. Onglet **Actions** du repo → tu vois le workflow `Deploy to GitHub Pages` tourner (~1-2 min)
2. Quand il devient ✅, le site est en ligne sur :
   ```
   https://<ton-pseudo>.github.io/<nom-repo>/
   ```

### Étape 6 — Tester

Ouvre l'URL, dépose un fichier audio IA, choisis le preset **Stealth**, clique « Lancer le nettoyage », télécharge le WAV. Aucune requête réseau ne devrait sortir (vérifie dans l'onglet Network du DevTools).

---

## 🔁 Méthode alternative — branche `gh-pages` (plus simple, sans Actions)

```bash
cd frontend
yarn add -D gh-pages
```

Ajoute dans `frontend/package.json` :

```json
"scripts": {
  "predeploy": "yarn build",
  "deploy": "gh-pages -d build"
}
```

Puis :

```bash
yarn deploy
```

→ Active ensuite Pages dans Settings > Pages > **Source: branch `gh-pages`**.

---

## 🌍 Domaine personnalisé

Crée `frontend/public/CNAME` contenant ton domaine, ex :

```
notraceaudio.com
```

Configure ensuite chez ton registrar :

- `CNAME` `www` → `<ton-pseudo>.github.io`
- ou record A apex → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`

---

## Compatibilité

- ✅ Chrome/Edge/Safari/Firefox récents (desktop + mobile)
- ✅ iOS Safari, Chrome Android
- ⚠️ Très long fichiers (>10 min stéréo) → traitement de plusieurs secondes sur mobile bas de gamme
- ❌ Aucun support IE / navigateurs sans Web Audio API

---

## Limitations connues

- Le mode **Stealth** réduit fortement la détection mais n'est **jamais 100 % indétectable** — les modèles de détection sont mis à jour régulièrement (course à l'armement).
- Phase B (FFT phase randomization, spectral magnitude jitter) et Phase C (convolution IR, M/S decorrelation) sont prévues — voir `/app/memory/PRD.md`.

## Licence

MIT
