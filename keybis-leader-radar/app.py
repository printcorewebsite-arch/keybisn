import csv

print("Keybis Lead Radar lancé")

keywords = [

    "je veux créer une entreprise",
    "comment créer une entreprise",
    "comment créer une société",
    "ouvrir une entreprise",
    "ouvrir une société",
    "ouvrir une sasu",
    "ouvrir une sas",
    "ouvrir une eurl",
    "ouvrir une sarl",
    "ouvrir une micro entreprise",

    "devenir auto entrepreneur",
    "créer une micro entreprise",
    "comment devenir auto entrepreneur",
    "statut auto entrepreneur",

    "comment lancer mon business",
    "comment lancer mon entreprise",
    "comment monter un business",
    "comment créer ma boite",
    "comment créer ma société",

    "combien coute créer une société",
    "démarches création entreprise",
    "démarches création société",
    "formalités création entreprise",
    "formalités création société",

    "comment faire un kbis",
    "obtenir kbis",
    "immatriculation société",
    "immatriculation entreprise",

    "création entreprise france",
    "création société france",
    "aide création entreprise",
    "aide création société",

    "accompagnement création entreprise",
    "expert création société",
    "service création entreprise",

    "ouvrir société rapidement",
    "créer entreprise rapidement",
    "ouvrir société en ligne",
    "créer entreprise en ligne",

    "besoin d'aide pour créer entreprise",
    "quel statut choisir entreprise",
    "sasu ou micro entreprise",
    "sasu ou sarl",
    "quel statut juridique choisir",

    "créer société sans comptable",
    "créer société facilement",
    "création entreprise pas cher",

    "je veux entreprendre",
    "je veux lancer un business",
    "je veux ouvrir une boite",

    "comment être entrepreneur",
    "comment devenir entrepreneur",
    "devenir entrepreneur france",

    "projet de création entreprise",
    "idée de business",
    "idée entreprise",
    "idée startup",

    "création startup france",
    "lancer startup",

    "ouvrir entreprise sans argent",
    "ouvrir entreprise seul",
    "ouvrir entreprise en france",

    "créer entreprise 2025",
    "créer entreprise 2026",

    "site pour créer entreprise",
    "meilleur site création société",
    "legalstart alternative",
    "legalplace alternative",
    "captain contrat alternative"

]


fake_results = {
    "je veux créer une entreprise": [
        "https://www.reddit.com/r/entrepreneur/comments/exemple1",
        "https://www.forum-auto-entrepreneur.fr/exemple1"
    ],
    "comment créer une société": [
        "https://www.reddit.com/r/france/comments/exemple2",
        "https://www.legalstart.fr/fiches-pratiques/creation-entreprise/"
    ],
    "ouvrir une sasu": [
        "https://www.legalplace.fr/guides/ouvrir-une-sasu/",
        "https://www.captaincontrat.com/creation-entreprise/sasu"
    ],
    "créer une micro entreprise": [
        "https://www.portail-autoentrepreneur.fr/academie/statut-auto-entrepreneur",
        "https://www.reddit.com/r/vosfinances/comments/exemple3"
    ],
    "devenir auto entrepreneur": [
        "https://www.economie.gouv.fr/entreprises/auto-entrepreneur",
        "https://www.forum-auto-entrepreneur.fr/exemple2"
    ]
}

with open("prospects.csv", "w", newline="", encoding="utf-8") as file:
    writer = csv.writer(file)
    writer.writerow(["mot_cle", "lien"])

for keyword in keywords:
    print("\nRecherche :", keyword)

    results = fake_results.get(keyword, [])

    for href in results:
        print("Lien trouvé :", href)

        with open("prospects.csv", "a", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow([keyword, href])

print("\nTerminé.")
