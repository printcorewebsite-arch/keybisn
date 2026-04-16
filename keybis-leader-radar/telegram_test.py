import os

import requests

TELEGRAM_TOKEN = os.getenv("KEYBIS_TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("KEYBIS_TELEGRAM_CHAT_ID")


def run() -> None:
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        raise RuntimeError("Variables requises: KEYBIS_TELEGRAM_BOT_TOKEN et KEYBIS_TELEGRAM_CHAT_ID")

    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": "Test Keybis Lead Radar fonctionne",
    }

    requests.post(url, data=payload, timeout=15).raise_for_status()
    print("Message Telegram envoye")


if __name__ == "__main__":
    run()
