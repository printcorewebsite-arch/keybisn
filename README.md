# Keybis LegalTech Acquisition Platform (SEO + Conversion + WhatsApp)

Version orientée acquisition de leads qualifiés avec structure marketing premium:
- pages SEO dédiées: création, modification, fermeture de société
- hub guides structuré et pages guides détaillées
- landing pages Ads dédiées: création rapide, modification urgente, fermeture rapide
- tunnel simple: page service -> formulaire -> résumé -> WhatsApp
- stockage des leads en JSON (`data/leads.json`)
- dashboard admin leads (stats conversion, filtres, recherche, détail, statut nouveau/contacté)
- tracking des événements de conversion (CTA, formulaire, redirection WhatsApp)
- SEO technique: canonical, Open Graph, JSON-LD (Organization, Breadcrumb, Service, FAQ)

## Architecture

- `backend/server.js`: serveur HTTP + routing statique/API
- `backend/services/marketing-shell.js`: contexte dynamique header/topbar/CTA par route
- `backend/services/marketing-seo.js`: contexte SEO dynamique (canonical, OG, JSON-LD)
- `backend/routes/api-leads.js`: API leads (capture, liste admin, statut, clic WhatsApp)
- `backend/services/lead-service.js`: logique métier leads + estimation prix + message WhatsApp
- `backend/services/data-store.js`: persistance JSON (inclut `leads`)
- `frontend/partials/`: partials partagés (`marketing-header`, `marketing-footer`, `seo-meta`)
- `frontend/templates/marketing/`: templates réutilisables (service/guide + sections)
- `scripts/scaffold-seo-page.mjs`: génération rapide de nouvelles pages SEO
- `frontend/pages/`
- `index.html`: homepage acquisition
- `creation-societe.html`, `modification-societe.html`, `fermeture-societe.html`: pages SEO service
- `guides.html` + `guide-*.html`: bibliothèque de contenus SEO
- `creation-societe-rapide.html`, `modification-societe-urgente.html`, `fermeture-societe-rapide.html`: landing pages Ads
- `demande.html`: formulaire dynamique + résumé + CTA WhatsApp
- `admin-leads.html`: dashboard leads + stats
- `frontend/assets/js/demande.js`: logique funnel lead
- `frontend/assets/js/admin-leads.js`: logique dashboard admin
- `frontend/assets/js/acquisition.js`: tracking pages service/home
- `frontend/assets/css/acquisition.css`: design mobile-first conversion

## Lancer en local

```bash
npm start
```

Puis ouvrir `http://127.0.0.1:3000`.

## Variables d'environnement

Voir `.env.example`.

Variables clés acquisition:
- `KEYBIS_WHATSAPP_NUMBER`: numéro WhatsApp de réception (format international sans `+`)
- `KEYBIS_ADMIN_KEY`: clé d'accès à `/admin-leads`

Leads stockés dans:
- `data/leads.json`

## Créer une nouvelle page SEO

```bash
node scripts/scaffold-seo-page.mjs guide mon-guide-seo "Mon guide SEO"
node scripts/scaffold-seo-page.mjs service creation-societe-lyon "Création de société à Lyon"
```

Puis:
1. Ajouter la route dans `backend/server.js` (`PAGE_ROUTES`)
2. Compléter `backend/services/marketing-shell.js` (texte topbar + CTA)
3. Compléter `backend/services/marketing-seo.js` (title/description/breadcrumb/schema)
