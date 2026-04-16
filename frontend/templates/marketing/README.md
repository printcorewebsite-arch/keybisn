# Templates Marketing Keybis

Ce dossier sert de base réutilisable pour créer rapidement de nouvelles pages SEO et service sans dupliquer la structure globale.

## Fichiers principaux

- `service-page.template.html`: squelette d'une page service
- `guide-page.template.html`: squelette d'un guide SEO
- `sections/`: blocs réutilisables
  - `service-hero.template.html`
  - `proof-section.template.html`
  - `faq-section.template.html`
  - `guides-section.template.html`
  - `final-cta-section.template.html`

## Principes de maintenance

1. Les pages finales utilisent les partials globaux:
   - `frontend/partials/marketing-header.html`
   - `frontend/partials/marketing-footer.html`
   - `frontend/partials/seo-meta.html`
2. Le SEO technique (canonical + JSON-LD) est injecté par le backend via `backend/services/marketing-seo.js`.
3. Le style global est centralisé dans `frontend/assets/css/acquisition.css`.

## Générer une nouvelle page rapidement

Utilisez le script:

```bash
node scripts/scaffold-seo-page.mjs guide mon-guide-seo "Mon guide SEO"
node scripts/scaffold-seo-page.mjs service creation-societe-lyon "Création de société à Lyon"
```

Le script écrit dans `frontend/pages/<slug>.html` avec une base cohérente.
