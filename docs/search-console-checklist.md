# Search Console Checklist (No Trace Audio)

Date de référence : 2026-05-09

## 1) Préparation avant soumission

1. Vérifier que le domaine final est correct dans ces fichiers :
   - `frontend/public/index.html` (`canonical`, `og:url`, `og:image`, `twitter:image`)
   - `frontend/public/robots.txt` (`Sitemap`)
   - `frontend/public/sitemap.xml` (`loc`)
2. Déployer la dernière version en production HTTPS.
3. Vérifier publiquement :
   - `https://notraceaudio.com/robots.txt`
   - `https://notraceaudio.com/sitemap.xml`
   - `https://notraceaudio.com/og-cover.png`

## 2) Ajouter la propriété Search Console

1. Ouvrir : <https://search.google.com/search-console>
2. Ajouter une propriété de type `Domaine` (recommandé).
3. Valider via DNS TXT chez ton registrar.

Docs :
- Add property: <https://support.google.com/webmasters/answer/34592>
- Verify ownership: <https://support.google.com/webmasters/answer/9008080>

## 3) Soumettre le sitemap

1. Dans Search Console > `Sitemaps`
2. Soumettre : `https://notraceaudio.com/sitemap.xml`
3. Vérifier le statut : `Success`

Doc :
- <https://support.google.com/webmasters/answer/7451001>

## 4) Validation indexation/crawl

1. Outil `URL Inspection` :
   - Tester `https://notraceaudio.com/`
   - Cliquer `Request indexing` si nécessaire
2. Contrôler que la page est indexable et rendue correctement.

Doc :
- <https://support.google.com/webmasters/answer/12482179>

## 5) Validation SEO technique

1. Vérifier le canonical effectif : `https://notraceaudio.com/`
2. Vérifier les tags title/description/robots dans le HTML live.
3. Valider le JSON-LD :
   - Rich Results Test : <https://search.google.com/test/rich-results>
4. Tester la prévisualisation sociale :
   - Facebook Sharing Debugger
   - Twitter Card Validator

## 6) Suivi performance (7, 28, 90 jours)

Dans `Performance > Search results`, suivre :

1. `Clicks`
2. `Impressions`
3. `CTR`
4. `Average position`

Créer ces vues sauvegardées :

1. Requêtes marque : `notraceaudio`, `no trace audio`
2. Requêtes produit : `audio ai`, `watermark audio`, `nettoyage audio`
3. Pays : France + global
4. Device : mobile vs desktop

Docs :
- Metrics: <https://support.google.com/webmasters/answer/7042828>
- Performance report: <https://support.google.com/webmasters/answer/7576553>

## 7) Routine hebdo (30 min)

1. Vérifier erreurs `Page indexing`
2. Vérifier erreurs `Sitemaps`
3. Inspecter 3 URLs importantes
4. Mettre à jour title/description si CTR faible
5. Demander réindexation après changement SEO majeur

## 8) Cibles réalistes (départ)

1. J+7 : sitemap `Success`, homepage indexée
2. J+30 : impressions en hausse, CTR > 2% sur requêtes marque
3. J+90 : pages/sections supplémentaires si nécessaire (FAQ, pricing, docs)
