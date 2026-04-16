# Keybis Reddit Engine — Strategie complete

## Architecture du systeme

```
┌─────────────────────────────────────────────────────────────┐
│                    KEYBIS REDDIT ENGINE                      │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │ SCRAPER  │───→│  GENERATEUR  │───→│   PUBLISHER       │  │
│  │          │    │  DE CONTENU  │    │   (+ validation)  │  │
│  │ - Hot    │    │              │    │                   │  │
│  │ - New    │    │ - LLM        │    │ - Quotas          │  │
│  │ - Search │    │ - Templates  │    │ - Timing          │  │
│  │ - Trends │    │ - Anti-spam  │    │ - Anti-promo      │  │
│  └──────────┘    └──────────────┘    └───────────────────┘  │
│       │                │                      │              │
│       └────────────────┼──────────────────────┘              │
│                        │                                     │
│                ┌───────▼───────┐                             │
│                │   SCHEDULER   │  (cron: scan, generate,     │
│                │   CENTRAL     │   publish, report)          │
│                └───────┬───────┘                             │
│                        │                                     │
│                ┌───────▼───────┐                             │
│                │   ANALYZER    │  (scores, tendances,        │
│                │               │   recommandations)          │
│                └───────────────┘                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    SQLite DB                          │   │
│  │  posts | queue | scraped_threads | accounts | stats   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Strategie de publication

### Frequence par tier de subreddit

| Tier | Subreddits | Frequence | Type de contenu |
|------|-----------|-----------|-----------------|
| 1 | r/EntrepreneurFrancais, r/autoentrepreneur, r/vosfinances | Quotidien | Posts + commentaires |
| 2 | r/creation_entreprise, r/france | 3x/semaine | Posts ciblés |
| 3 | r/Entrepreneur, r/freelance, r/smallbusiness | Hebdo | Posts EN |
| 4 | r/legaladviceEU, r/startups | Opportuniste | Reponses uniquement |

### Fenetres de publication (heure FR)

| Creneau | Heure | Poids | Rationale |
|---------|-------|-------|-----------|
| Matin | 8h-9h | 15% | Entrepreneurs en debut de journee |
| Midi | 12h-13h | 25% | Pause dejeuner = pic Reddit |
| Aprem | 14h-15h | 15% | Retour bureau |
| Soir | 18h-19h | 25% | Fin de journee, reflexion |
| Nuit | 21h-22h | 20% | Navigation detendue |

### Ratio de contenu

- 80% des posts : **zero mention de Keybis** (pur contenu educatif)
- 20% des posts : **mention subtile** (en footnote, contexte, ou recommandation douce)
- 0% des posts : lien direct vers keybis.fr

---

## Strategie anti-ban — REGLES CRITIQUES

### 1. Comportement humain

- **Delai minimum entre posts** : 2 heures (variable aleatoire ±30min)
- **Max posts/jour** : 3 (meme si le quota autorise 5)
- **Ratio posts/commentaires** : viser 1 post pour 3-5 commentaires
- **Varier les heures** : jamais publier a la meme heure 2 jours de suite
- **Activite organique** : upvoter d'autres posts, participer a des discussions hors-sujet

### 2. Contenu

- **Zero repetition** : chaque post est unique (verifie par la base de donnees)
- **Variation des formats** : alterner retour d'experience, guide, erreurs, comparatif
- **Variation du ton** : parfois decontracte, parfois technique, parfois humble
- **Pas de templates visibles** : le LLM genere du contenu frais a chaque fois
- **Longueur variable** : entre 300 et 1500 mots selon le format

### 3. Mentions de marque

- **Max 20% des posts** mentionnent Keybis
- **Jamais 2 posts consecutifs** avec mention
- **Toujours citer des alternatives** (Legalstart, LegalPlace, etc.)
- **Jamais de lien URL**
- **Jamais de ton promotionnel**
- **Detection automatique** : le publisher bloque les posts trop promos

### 4. Gestion des comptes

**Option A : Compte unique (recommande pour commencer)**
- 1 seul compte avec un historique organique
- Construire du karma avec des commentaires utiles pendant 2-4 semaines AVANT de poster
- Activite variee : pas que des posts sur la creation d'entreprise
- Poster aussi dans d'autres subs (r/france Forum Libre, etc.)

**Option B : Rotation de comptes (avance)**
- 2-3 comptes avec des personnalites differentes
- Compte 1 : "entrepreneur tech" (SAS, dev, startup)
- Compte 2 : "comptable independant" (fiscalite, optimisation)
- Compte 3 : "ex-AE reconverti" (transition, retour d'experience)
- Jamais poster avec 2 comptes dans le meme thread
- Delai de 24h entre les posts de chaque compte

### 5. Signaux d'alerte (STOP immediat)

- Post supprime par les mods → analyser pourquoi, attendre 48h
- Message d'avertissement d'un mod → repondre poliment, ajuster
- Shadowban detecte → switcher de compte, analyser les causes
- Score negatif repetitif → changer de sub ou de format
- Accusation de spam en commentaire → retirer le post, ne plus poster pendant 1 semaine

### 6. Warmup d'un nouveau compte

Semaine 1-2 :
- Commenter uniquement (5-10 commentaires utiles/jour)
- Upvoter des posts pertinents
- S'abonner aux subs cibles
- Poster 1-2 fois dans r/france (Forum Libre) ou des subs generaux

Semaine 3-4 :
- Commencer a poster (1 post/2 jours max)
- Continuer les commentaires (3-5/jour)
- Surveiller le karma (viser 100+ avant d'accelerer)

Semaine 5+ :
- Passer a 1 post/jour si le karma est OK
- Activer les mentions Keybis (1 sur 5 posts)

---

## Strategie de commentaires (reactive)

### Quand repondre

1. **Questions directes** sur creation/modification/fermeture de societe
2. **Demandes de conseil** sur le choix de statut
3. **Partage d'experience** ou on peut apporter une info complementaire
4. **Posts avec peu de reponses** (<5 commentaires, <6h)

### Comment repondre

- Repondre a la question AVANT tout
- Apporter des chiffres ou des infos concretes
- Partager une experience personnelle si pertinent
- Poser une question pour engager la conversation
- **Jamais mentionner Keybis dans un commentaire** (sauf si quelqu'un demande explicitement une recommendation de service)

### Volume

- 3-5 commentaires par jour
- Repartis sur differents subs
- Delai de 1-4h apres le post original (pas trop vite = bot, pas trop tard = pas vu)

---

## KPIs a suivre

| Metrique | Objectif Mois 1 | Objectif Mois 3 | Objectif Mois 6 |
|----------|----------------|-----------------|-----------------|
| Posts/semaine | 5-7 | 10-15 | 15-20 |
| Score moyen | 5+ | 15+ | 30+ |
| Commentaires moyen | 3+ | 8+ | 15+ |
| Karma du compte | 100+ | 500+ | 2000+ |
| Trafic Reddit → keybis.fr | - | 50 visites/mois | 200+ visites/mois |
| Leads depuis Reddit | - | 2-3/mois | 10+/mois |

---

## Lancement — Checklist

1. [ ] Creer un compte Reddit (ou utiliser un existant avec historique)
2. [ ] Warmup du compte (2 semaines de commentaires)
3. [ ] Creer une app Reddit (https://www.reddit.com/prefs/apps) → type "script"
4. [ ] Configurer le .env avec les identifiants
5. [ ] `npm install`
6. [ ] Tester : `node src/index.js generate` (verifier la qualite du contenu)
7. [ ] Tester : `DRY_RUN=true node src/index.js publish` (verifier le flow)
8. [ ] Premier post MANUEL (copier-coller depuis le generate) pour tester la reception
9. [ ] Si OK : passer en mode semi-auto (`DRY_RUN=false`)
10. [ ] Lancer le scheduler : `node src/index.js start`
11. [ ] Verifier les stats chaque semaine : `node src/index.js analyze`
