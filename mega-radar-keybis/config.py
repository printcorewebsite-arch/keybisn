import os

# Variables d'environnement requises:
# - KEYBIS_TELEGRAM_BOT_TOKEN
# - KEYBIS_TELEGRAM_CHAT_ID
TELEGRAM_TOKEN = os.getenv("KEYBIS_TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("KEYBIS_TELEGRAM_CHAT_ID", "")

KEYWORDS = [
    "creation societe",
    "creer une entreprise",
    "ouvrir une sasu",
    "ouvrir une sarl",
    "auto entrepreneur",
    "domiciliation entreprise",
    "compte bancaire pro",
    "expert comptable",
    "assurance rc pro",
    "logo entreprise",
    "site web entreprise",
]
