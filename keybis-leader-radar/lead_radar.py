import os
from urllib.parse import quote_plus
from typing import Optional

import feedparser
import requests

TELEGRAM_TOKEN = os.getenv("KEYBIS_TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("KEYBIS_TELEGRAM_CHAT_ID")

KEYWORDS = [
    "creer une entreprise",
    "ouvrir une sasu",
    "creer micro entreprise",
    "legalstart avis",
    "comment creer societe",
]


def require_env(name: str, value: Optional[str]) -> str:
    if not value:
        raise RuntimeError(f"Variable d'environnement manquante: {name}")
    return value


def send_telegram(message: str) -> None:
    token = require_env("KEYBIS_TELEGRAM_BOT_TOKEN", TELEGRAM_TOKEN)
    chat_id = require_env("KEYBIS_TELEGRAM_CHAT_ID", TELEGRAM_CHAT_ID)

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "disable_web_page_preview": True,
    }
    requests.post(url, data=payload, timeout=15).raise_for_status()


def run() -> None:
    for keyword in KEYWORDS:
        rss_url = f"https://nitter.net/search/rss?f=tweets&q={quote_plus(keyword)}"
        feed = feedparser.parse(rss_url)

        for entry in feed.entries[:3]:
            message = (
                "Prospect detecte\n\n"
                f"Mot cle: {keyword}\n"
                f"Titre: {entry.title}\n"
                f"Lien: {entry.link}"
            )
            send_telegram(message)


if __name__ == "__main__":
    run()
