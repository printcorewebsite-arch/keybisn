import os

import requests

TELEGRAM_TOKEN = os.getenv("KEYBIS_TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("KEYBIS_TELEGRAM_CHAT_ID")


def send_telegram_message(message: str) -> None:
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        raise RuntimeError("Variables requises: KEYBIS_TELEGRAM_BOT_TOKEN et KEYBIS_TELEGRAM_CHAT_ID")

    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
    }

    response = requests.post(url, data=payload, timeout=15)
    response.raise_for_status()


if __name__ == "__main__":
    send_telegram_message("Mega Radar Keybis connecte")
