const SITE_URL = process.env.KEYBIS_SITE_URL || "https://www.keybis.fr";

function absoluteUrl(pathname = "/") {
  const normalized = pathname === "/" ? "" : pathname;
  return `${SITE_URL}${normalized}`;
}

function ldScript(payload) {
  return `<script type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

function breadcrumbSchema(items = []) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

function serviceSchema({ name, description, minPrice, maxPrice }) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    areaServed: "France",
    provider: {
      "@type": "Organization",
      name: "Keybis",
      url: SITE_URL,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "EUR",
        minPrice: String(minPrice),
        maxPrice: String(maxPrice),
      },
      availability: "https://schema.org/InStock",
    },
  };
}

function faqSchema(questionAnswerPairs = []) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questionAnswerPairs.map((entry) => ({
      "@type": "Question",
      name: entry.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.a,
      },
    })),
  };
}

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Keybis",
  legalName: "Keybis",
  url: SITE_URL,
  logo: `${SITE_URL}/assets/images/logo-keybis.png`,
  email: "keybisfr@gmail.com",
  telephone: "+33 7 80 95 40 94",
  areaServed: "France",
};

const SEO_MAP = {
  "/": {
    title: "Keybis LegalTech | Création, modification et fermeture de société",
    description: "Keybis accompagne les entrepreneurs sur la création, la modification et la fermeture de société. Plateforme legaltech crédible, contenus experts et funnel WhatsApp rapide.",
    breadcrumb: [{ name: "Accueil", path: "/" }],
    faq: [
      { q: "Combien de temps pour être recontacté ?", a: "En général en moins de 10 minutes sur les heures ouvrées." },
      { q: "Le formulaire est-il engageant ?", a: "Non, il sert à qualifier le besoin et à estimer le niveau de service adapté." },
      { q: "Puis-je gérer une urgence ?", a: "Oui, vous pouvez sélectionner une urgence 24h selon votre contexte." },
    ],
  },
  "/creation-societe": {
    title: "Création de société en ligne 2026 | SASU, SAS, EURL, SARL | Keybis",
    description: "Keybis vous accompagne pour créer votre société en ligne: SASU, SAS, EURL, SARL, micro-entreprise. Process clair, prix lisible, demande rapide via WhatsApp.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Création de société", path: "/creation-societe" },
    ],
    service: {
      name: "Création de société en ligne",
      description: "Accompagnement digital pour créer une société en France.",
      minPrice: 249,
      maxPrice: 499,
    },
    faq: [
      { q: "Quel statut choisir entre SASU, SAS, EURL ou SARL ?", a: "Le choix dépend du projet, de la fiscalité cible et du nombre d'associés." },
      { q: "Combien de temps pour démarrer ?", a: "La prise en charge démarre rapidement après réception de votre demande qualifiée." },
      { q: "Puis-je créer ma société en urgence ?", a: "Oui, l'option urgence 24h est disponible dans le formulaire." },
    ],
  },
  "/modification-societe": {
    title: "Modification de société en ligne 2026 | Siège, gérance, statuts | Keybis",
    description: "Modifiez votre société rapidement avec Keybis: changement de siège, gérant, statuts, objet social. Parcours guidé, prix lisible, demande en ligne avec lancement WhatsApp.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Modification de société", path: "/modification-societe" },
    ],
    service: {
      name: "Modification de société",
      description: "Formalités de modification de société avec assistance experte.",
      minPrice: 169,
      maxPrice: 399,
    },
    faq: [
      { q: "Quels changements peuvent être traités ?", a: "Siège social, gérance, dénomination, objet social, capital et statuts." },
      { q: "Puis-je traiter plusieurs modifications en même temps ?", a: "Oui, un accompagnement multi-modifications est disponible." },
      { q: "Le formulaire est-il engageant ?", a: "Non, il sert d'abord à qualifier le dossier et afficher une estimation." },
    ],
  },
  "/fermeture-societe": {
    title: "Fermeture de société en ligne 2026 | Dissolution et liquidation | Keybis",
    description: "Fermez votre société avec un parcours clair: dissolution, liquidation, clôture. Keybis vous accompagne avec un process rassurant, prix lisible et lancement rapide via WhatsApp.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Fermeture de société", path: "/fermeture-societe" },
    ],
    service: {
      name: "Fermeture de société",
      description: "Accompagnement sur dissolution, liquidation et clôture de société.",
      minPrice: 139,
      maxPrice: 399,
    },
    faq: [
      { q: "Quelle différence entre dissolution et liquidation ?", a: "La dissolution acte la décision de fermer, la liquidation finalise la clôture opérationnelle." },
      { q: "Combien de temps prend une fermeture ?", a: "Le délai dépend du dossier, un cadrage initial clair accélère le traitement." },
      { q: "Puis-je demander une prise en charge urgente ?", a: "Oui, l'option urgence 24h est disponible." },
    ],
  },
  "/guides": {
    title: "Guides juridiques entreprise 2026 | Création, modification, fermeture | Keybis",
    description: "Explorez les guides Keybis pour créer, modifier ou fermer votre société: étapes, checklists, erreurs à éviter et conseils pratiques pour entrepreneurs.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Guides", path: "/guides" },
    ],
  },
  "/guide-creation-sasu": {
    title: "Créer une SASU en 2026: étapes, coûts, checklist | Guide Keybis",
    description: "Guide complet pour créer une SASU en 2026: étapes clés, budget estimé, documents requis, erreurs à éviter et checklist opérationnelle.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Guide création SASU", path: "/guide-creation-sasu" },
    ],
    faq: [
      { q: "Combien de temps pour créer une SASU ?", a: "Avec un dossier prêt, la prise en charge peut démarrer immédiatement." },
      { q: "La SASU est-elle adaptée à tous les projets ?", a: "Le choix dépend du modèle économique, fiscal et social du dirigeant." },
      { q: "Le guide remplace-t-il un accompagnement ?", a: "Le guide structure votre réflexion, l'accompagnement accélère l'exécution." },
    ],
  },
  "/guide-modification-siege-social": {
    title: "Changer le siège social d'une société: guide 2026 | Keybis",
    description: "Guide 2026 pour modifier le siège social de votre société: étapes, pièces à prévoir, coûts, délais et erreurs à éviter.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Guide siège social", path: "/guide-modification-siege-social" },
    ],
    faq: [
      { q: "Peut-on changer le siège en urgence ?", a: "Oui, une prise en charge accélérée est possible selon votre dossier." },
      { q: "Dois-je modifier les statuts à chaque transfert ?", a: "Souvent oui, selon la rédaction actuelle des statuts." },
      { q: "Comment accélérer le traitement ?", a: "Préparez les pièces complètes et indiquez le niveau d'urgence dès le départ." },
    ],
  },
  "/guide-fermeture-societe": {
    title: "Fermer sa société en 2026: dissolution, liquidation, checklist | Guide Keybis",
    description: "Guide complet pour fermer une société en 2026: dissolution, liquidation, coûts, délais, documents et erreurs à éviter.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Guide fermeture société", path: "/guide-fermeture-societe" },
    ],
    faq: [
      { q: "Combien de temps prend une fermeture de société ?", a: "Pour une fermeture amiable simple (sans dette complexe ni actif à réaliser), comptez en moyenne 3 à 6 mois entre la décision de dissolution et la radiation effective. Ce délai comprend les publications légales, les délais de traitement du greffe et les formalités fiscales et sociales. Avec un accompagnement structuré, certaines procédures peuvent être accélérées." },
      { q: "Peut-on fermer une SASU rapidement ?", a: "Oui, la SASU (associé unique) bénéficie d'une procédure simplifiée : la dissolution et la clôture de liquidation peuvent parfois être réalisées lors d'une même journée si la société n'a pas de dette et pas d'actif à réaliser. Cette procédure dite 'dissolution-liquidation simultanée' réduit considérablement les délais." },
      { q: "Que se passe-t-il si la société a des dettes ?", a: "Si les dettes sont réglables (la société dispose des fonds pour les rembourser), la procédure amiable reste possible. Si les dettes dépassent les actifs disponibles et que la société est en cessation de paiements, une procédure judiciaire (redressement ou liquidation judiciaire) s'impose. Il est impératif de ne pas laisser cette situation se prolonger sans agir." },
      { q: "Quelle différence entre fermeture amiable et liquidation judiciaire ?", a: "La fermeture amiable (ou dissolution volontaire) est initiée par les associés quand la société peut faire face à ses obligations. La liquidation judiciaire est prononcée par un tribunal quand la société est en état de cessation de paiements et ne peut pas être redressée. Dans ce second cas, un liquidateur judiciaire (professionnel indépendant) est nommé par le tribunal et prend en charge la procédure." },
      { q: "Faut-il continuer à déclarer la TVA et les charges sociales pendant la liquidation ?", a: "Oui. Tant que la radiation n'est pas effective, la société reste soumise à ses obligations déclaratives. La dissolution déclenche en général une période d'imposition transitoire pour les impôts sur les bénéfices. Continuez vos déclarations normalement jusqu'à radiation, et informez les organismes concernés (URSSAF, SIE des impôts) de la procédure en cours." },
    ],
  },
  "/demande": {
    title: "Demande de formalité entreprise | Devis rapide WhatsApp | Keybis",
    description: "Formulaire ultra simple: renseignez votre besoin, obtenez un prix estimé et envoyez votre demande sur WhatsApp en 2 minutes.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Demande de formalité", path: "/demande" },
    ],
    service: {
      name: "Qualification de formalité d'entreprise",
      description: "Formulaire de qualification avec estimation et redirection WhatsApp.",
      minPrice: 139,
      maxPrice: 499,
    },
  },
  "/creation-societe-rapide": {
    title: "Création société rapide 24h | Keybis",
    description: "Landing Ads création de société: formulaire rapide, estimation immédiate, prise en charge express.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Création société rapide", path: "/creation-societe-rapide" },
    ],
    service: {
      name: "Création de société rapide",
      description: "Parcours express orienté conversion pour la création d'entreprise.",
      minPrice: 249,
      maxPrice: 499,
    },
  },
  "/modification-societe-urgente": {
    title: "Modification société urgente | Keybis",
    description: "Landing Ads modification urgente: changement de siège, gérant, statuts. Demande qualifiée et contact rapide.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Modification urgente", path: "/modification-societe-urgente" },
    ],
    service: {
      name: "Modification de société urgente",
      description: "Traitement prioritaire des modifications de société.",
      minPrice: 169,
      maxPrice: 399,
    },
  },
  "/fermeture-societe-rapide": {
    title: "Fermeture société rapide | Keybis",
    description: "Landing Ads fermeture société: dissolution, liquidation, estimation immédiate et prise de contact rapide sur WhatsApp.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Fermeture société rapide", path: "/fermeture-societe-rapide" },
    ],
    service: {
      name: "Fermeture de société rapide",
      description: "Parcours accéléré pour dissolution et liquidation.",
      minPrice: 139,
      maxPrice: 399,
    },
  },
  "/mentions-legales": {
    title: "Mentions légales | Keybis LegalTech",
    description: "Mentions légales de Keybis: éditeur, contact, hébergement et informations de conformité.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Mentions légales", path: "/mentions-legales" },
    ],
  },
  "/cgv": {
    title: "Conditions générales de vente | Keybis LegalTech",
    description: "Conditions générales de vente Keybis: objet, prix, exécution et responsabilités du service d'accompagnement.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "CGV", path: "/cgv" },
    ],
  },
  "/confidentialite": {
    title: "Politique de confidentialité | Keybis LegalTech",
    description: "Politique de confidentialité Keybis: données collectées, finalités, conservation et droits RGPD.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Confidentialité", path: "/confidentialite" },
    ],
  },
  "/guide-statut-juridique": {
    title: "Choisir son statut juridique : SASU, SAS, SARL ou EURL ? | Keybis",
    description: "Guide complet pour choisir le bon statut juridique : comparatif SASU, SAS, SARL, EURL selon votre activité, votre fiscalité et vos besoins.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Guide statut juridique", path: "/guide-statut-juridique" },
    ],
    faq: [
      { q: "SASU ou EURL : laquelle choisir quand on est seul ?", a: "Cela dépend surtout de votre préférence de régime social. La SASU est plus protectrice (assimilé salarié) mais plus coûteuse. L'EURL est moins chère en charges mais offre une protection moindre. Si vous anticipez une levée de fonds ou l'intégration d'associés à terme, la SASU (qui se transforme en SAS) est plus adaptée." },
      { q: "Peut-on changer de statut juridique après la création ?", a: "Oui, mais la transformation de société est une formalité payante et complexe (vote des associés, publication légale, dépôt au greffe, parfois accord fiscal). Mieux vaut choisir le bon statut dès le départ. La transformation la plus simple est SASU → SAS à l'entrée d'un associé, qui ne nécessite pas de changement de forme juridique." },
      { q: "Le capital social influence-t-il le choix du statut ?", a: "Non, toutes les formes principales (SASU, SAS, SARL, EURL) ont un capital minimum d'1 €. Le montant du capital est libre et dépend de vos besoins opérationnels et de la crédibilité que vous souhaitez afficher auprès de vos partenaires." },
      { q: "La fiscalité est-elle la même selon le statut ?", a: "Pas exactement. Toutes ces formes sont soumises à l'impôt sur les sociétés (IS) par défaut. L'EURL peut opter pour l'IR (impôt sur le revenu). La différence fiscale principale tient au traitement du dirigeant : sa rémunération est déductible du résultat en IS, tandis que les dividendes sont fiscalisés différemment." },
    ],
  },
  "/guide-rediger-statuts": {
    title: "Rédiger les statuts de sa société : guide complet 2026 | Keybis",
    description: "Guide complet pour rédiger les statuts de votre société : mentions obligatoires, clauses essentielles, erreurs à éviter et conseils pratiques.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Guide rédiger statuts", path: "/guide-rediger-statuts" },
    ],
    faq: [
      { q: "Qui peut rédiger les statuts d'une société ?", a: "Légalement, n'importe qui peut rédiger les statuts — l'entrepreneur lui-même, un avocat, un expert-comptable ou un prestataire spécialisé. En pratique, confier cette rédaction à un professionnel réduit le risque d'erreurs et de clauses inadaptées. Pour les SASU et EURL simples, des modèles bien rédigés peuvent suffire à condition de les adapter soigneusement." },
      { q: "Les statuts peuvent-ils être modifiés après la création ?", a: "Oui, mais la modification des statuts est une formalité payante : elle nécessite une décision formelle des associés (ou de l'associé unique), une mise à jour du document, une publication légale et un dépôt au greffe. Il vaut donc mieux anticiper dès la création pour éviter des modifications répétées." },
      { q: "Les statuts doivent-ils être notariés ?", a: "En règle générale, non — les statuts de SASU, SAS, SARL et EURL peuvent être établis sous seing privé (sans notaire). Cependant, si les statuts comportent des apports en nature de type immobilier, l'intervention d'un notaire peut être requise." },
    ],
  },
  "/guide-cessation-activite": {
    title: "Cessation d'activité : guide complet pour les entreprises | Keybis",
    description: "Guide complet sur la cessation d'activité d'une entreprise : définition, différence avec la dissolution, étapes, obligations fiscales et sociales.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Guide cessation d'activité", path: "/guide-cessation-activite" },
    ],
    faq: [
      { q: "Peut-on suspendre une activité sans la fermer officiellement ?", a: "Pour une société, il est possible de cesser l'activité sans dissoudre la société — on parle de 'dormance'. La société reste immatriculée, continue à déposer ses comptes annuels (à zéro) et à payer ses cotisations minimales. C'est une option si vous envisagez de reprendre l'activité à terme. Pour une micro-entreprise, il n'y a pas de 'suspension' officielle." },
      { q: "La cessation d'activité met-elle fin aux contrats de travail ?", a: "Non automatiquement. Si vous avez des salariés, leur contrat de travail ne se termine pas du seul fait de la cessation. Vous devez engager une procédure de licenciement pour motif économique (ou dans le cadre d'une liquidation judiciaire, c'est le liquidateur qui s'en charge). Cette procédure a ses propres règles, délais et coûts." },
      { q: "Combien de temps dure la procédure complète de cessation ?", a: "Pour une micro-entreprise : 4 à 8 semaines entre la déclaration et la confirmation de radiation. Pour une société sans dette ni actif complexe : 3 à 6 mois entre la décision de dissolution et la radiation. Pour une société avec des actifs à réaliser ou des dettes : le délai peut s'étendre à 12 mois ou plus." },
    ],
  },
  "/guide-modification-activite": {
    title: "Modifier l'activité de sa société : guide complet 2026 | Keybis",
    description: "Guide complet pour modifier l'activité ou l'objet social de votre société : quand le faire, comment procéder, documents requis et erreurs à éviter.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Guide modification d'activité", path: "/guide-modification-activite" },
    ],
    faq: [
      { q: "Modifier l'activité change-t-il le code APE de la société ?", a: "Pas automatiquement. Le code APE (ou NAF) est attribué par l'INSEE en fonction de l'activité principale déclarée. Si votre modification d'activité entraîne un changement d'activité principale, vous devez en informer l'INSEE qui mettra à jour le code APE. Ce changement est gratuit et distinct de la formalité au greffe." },
      { q: "Peut-on modifier l'activité en cours d'exercice fiscal ?", a: "Oui. Il n'y a pas de contrainte particulière liée à la date dans l'exercice fiscal pour modifier l'objet social. Cependant, si le changement d'activité a des implications fiscales importantes (TVA, régime applicable…), il peut être utile de l'aligner sur le début d'un exercice fiscal pour simplifier la comptabilité." },
    ],
  },
  "/guide-changement-gerant": {
    title: "Changer de gérant : formalités, documents et étapes | Keybis",
    description: "Guide complet pour changer de gérant ou de dirigeant de société : procédure, documents, publication légale, dépôt au greffe et délais.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Guide changement gérant", path: "/guide-changement-gerant" },
    ],
    faq: [
      { q: "Combien de temps prend un changement de gérant ?", a: "En général, 10 à 20 jours ouvrés entre la décision formelle et la réception du Kbis actualisé. Ce délai inclut la publication légale (48 à 72h) et le traitement par le greffe. Avec une option de traitement prioritaire, ce délai peut être réduit." },
      { q: "Un gérant peut-il démissionner sans préavis ?", a: "Oui, mais une démission abrupte peut engager la responsabilité du gérant si elle cause un préjudice à la société. Il est recommandé de prévoir un délai raisonnable pour organiser la transition et éviter toute contestation ultérieure." },
      { q: "Peut-on nommer plusieurs gérants ?", a: "Oui, en SARL notamment. Il est possible de nommer plusieurs co-gérants, chacun disposant des mêmes pouvoirs sauf limitation statutaire. En SASU/SAS, plusieurs dirigeants peuvent aussi être nommés (directeurs généraux, directeurs généraux délégués) en plus du président." },
    ],
  },
  "/guide-changement-denomination": {
    title: "Changer le nom de sa société : formalités et étapes | Keybis",
    description: "Guide complet pour changer la dénomination sociale de votre société : vérifier la disponibilité, modifier les statuts, publier l'annonce légale et déposer au greffe.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Guide changement dénomination", path: "/guide-changement-denomination" },
    ],
    faq: [
      { q: "Le changement de nom modifie-t-il le numéro SIREN ?", a: "Non. Le numéro SIREN identifie la personne morale (la société) et ne change pas. Votre numéro SIRET, votre code APE et vos obligations fiscales restent inchangés. Seule la dénomination sociale est modifiée." },
      { q: "Peut-on utiliser un nom commercial différent de la dénomination sociale ?", a: "Oui. Le nom commercial est distinct de la dénomination sociale. Une société immatriculée sous 'MARTIN ET ASSOCIÉS SAS' peut exercer sous le nom commercial 'Martin Conseil'. Le nom commercial doit figurer sur certains documents légaux mais n'a pas à être identique à la dénomination sociale." },
    ],
  },
  "/guide-fermeture-micro-entreprise": {
    title: "Fermer une micro-entreprise : démarches simplifiées 2026 | Keybis",
    description: "Guide complet pour fermer une micro-entreprise en 2026 : démarches auprès de l'URSSAF, des impôts, délais et points d'attention.",
    breadcrumb: [
      { name: "Accueil", path: "/" },
      { name: "Guides", path: "/guides" },
      { name: "Guide fermeture micro-entreprise", path: "/guide-fermeture-micro-entreprise" },
    ],
    faq: [
      { q: "Combien de temps prend la fermeture d'une micro-entreprise ?", a: "La déclaration de cessation est traitée en quelques jours ouvrés. Cependant, la radiation effective et les régularisations fiscales peuvent prendre plusieurs semaines selon les organismes. Prévoyez 4 à 8 semaines pour un processus complet." },
      { q: "Peut-on fermer une micro-entreprise et en ouvrir une autre ensuite ?", a: "Oui. Vous pouvez fermer votre micro-entreprise et en ouvrir une nouvelle ultérieurement, y compris sous le même régime. Il n'y a pas de délai de carence imposé. Cependant, si vous souhaitez changer d'activité tout en continuant, il est parfois préférable de modifier l'activité déclarée plutôt que de fermer et de recréer." },
      { q: "Faut-il fermer sa micro-entreprise pour créer une société ?", a: "Pas obligatoirement. Vous pouvez créer une société (SASU, SARL…) tout en maintenant votre micro-entreprise active, à condition que les deux structures n'exercent pas la même activité dans des conditions qui pourraient être qualifiées de concurrence déloyale. Dans la plupart des cas, il est cependant recommandé de fermer la micro-entreprise pour éviter une double imposition et des complications administratives." },
    ],
  },
};

export function marketingSeoContext(pathname = "/") {
  const meta = SEO_MAP[pathname] || SEO_MAP["/"];
  const canonicalUrl = absoluteUrl(pathname);

  const payload = {
    canonicalUrl,
    ogTitle: meta.title,
    ogDescription: meta.description,
    ogUrl: canonicalUrl,
    jsonLdOrganization: ldScript(ORG_SCHEMA),
    jsonLdBreadcrumb: meta.breadcrumb ? ldScript(breadcrumbSchema(meta.breadcrumb)) : "",
    jsonLdService: meta.service ? ldScript(serviceSchema(meta.service)) : "",
    jsonLdFaq: Array.isArray(meta.faq) && meta.faq.length ? ldScript(faqSchema(meta.faq)) : "",
  };

  return payload;
}
