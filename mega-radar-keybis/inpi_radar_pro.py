import os
import time
import json
import math
import sqlite3
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests


# ============================================================
# CONFIG
# ============================================================

INPI_USERNAME = os.getenv("KEYBIS_INPI_USERNAME", "")
INPI_PASSWORD = os.getenv("KEYBIS_INPI_PASSWORD", "")

TELEGRAM_BOT_TOKEN = os.getenv("KEYBIS_TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("KEYBIS_TELEGRAM_CHAT_ID", "")

BASE_URL = "https://registre-national-entreprises.inpi.fr/api"
LOGIN_URL = f"{BASE_URL}/sso/login"
DIFF_URL = f"{BASE_URL}/companies/diff"
COUNT_URL = f"{BASE_URL}/companies/diff/count"

# Boucle
POLL_EVERY_SECONDS = 1800 # 30 min
PAGE_SIZE = 100           # doc: 1 à 100 pour /companies ; ici 100 fonctionne souvent bien en diff
REQUEST_TIMEOUT = 30

# Sécurité / conformité
RESPECT_DIFFUSION = True

# Si plus de 10 000 résultats, on découpe automatiquement la période
MAX_SAFE_RESULTS = 10000

# DB anti-doublons
DB_PATH = "inpi_radar.db"

# Logs
LOG_LEVEL = logging.INFO


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("inpi_radar")


def require_env(name: str, value: str) -> str:
    if value:
        return value
    raise RuntimeError(f"Variable d'environnement manquante: {name}")


# ============================================================
# SQLITE
# ============================================================

def init_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sent_events (
        event_key TEXT PRIMARY KEY,
        siren TEXT,
        event_type TEXT,
        company_name TEXT,
        sent_at TEXT
    )
    """)
    conn.commit()
    return conn


def already_sent(conn: sqlite3.Connection, event_key: str) -> bool:
    cur = conn.execute(
        "SELECT 1 FROM sent_events WHERE event_key = ? LIMIT 1",
        (event_key,),
    )
    return cur.fetchone() is not None


def mark_sent(
    conn: sqlite3.Connection,
    event_key: str,
    siren: str,
    event_type: str,
    company_name: str,
) -> None:
    conn.execute(
        """
        INSERT OR IGNORE INTO sent_events (event_key, siren, event_type, company_name, sent_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            event_key,
            siren,
            event_type,
            company_name,
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.commit()


# ============================================================
# HTTP / TELEGRAM
# ============================================================

session = requests.Session()


def send_telegram_message(message: str) -> None:
    token = require_env("KEYBIS_TELEGRAM_BOT_TOKEN", TELEGRAM_BOT_TOKEN)
    chat_id = require_env("KEYBIS_TELEGRAM_CHAT_ID", TELEGRAM_CHAT_ID)
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "disable_web_page_preview": True,
    }
    r = session.post(url, json=payload, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()


def get_inpi_token() -> str:
    username = require_env("KEYBIS_INPI_USERNAME", INPI_USERNAME)
    password = require_env("KEYBIS_INPI_PASSWORD", INPI_PASSWORD)
    payload = {
        "username": username,
        "password": password,
    }
    r = session.post(LOGIN_URL, json=payload, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    data = r.json()
    token = data.get("token")
    if not token:
        raise RuntimeError("Token INPI introuvable dans la réponse.")
    return token


def auth_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


# ============================================================
# UTILS DATE
# ============================================================

def parse_date(d: str) -> datetime:
    return datetime.strptime(d, "%Y-%m-%d")


def daterange_split(start_date: str, end_date: str) -> List[Tuple[str, str]]:
    """
    Découpe [start_date, end_date] en deux sous-périodes.
    """
    start = parse_date(start_date)
    end = parse_date(end_date)

    if start >= end:
        return [(start_date, end_date)]

    delta_days = (end - start).days
    mid = start + timedelta(days=max(1, delta_days // 2))

    left_start = start.strftime("%Y-%m-%d")
    left_end = mid.strftime("%Y-%m-%d")

    right_start = (mid + timedelta(days=1)).strftime("%Y-%m-%d")
    right_end = end.strftime("%Y-%m-%d")

    if parse_date(right_start) > end:
        return [(start_date, end_date)]

    return [(left_start, left_end), (right_start, right_end)]


# ============================================================
# EXTRACTION CHAMPS
# ============================================================

def get_siren(company: Dict[str, Any]) -> str:
    return str(company.get("siren") or "SIREN inconnu")


def get_content(company: Dict[str, Any]) -> Dict[str, Any]:
    return company.get("content") or {}


def get_company_name(company: Dict[str, Any]) -> str:
    content = get_content(company)

    pm = content.get("personneMorale")
    if pm:
        ent = (((pm.get("identite") or {}).get("entreprise")) or {})
        name = ent.get("denomination")
        if name:
             return str(name).strip()

    pp = content.get("personnePhysique")
    if pp:
        desc = (((pp.get("identite") or {}).get("entrepreneur")) or {})
        nom = str(desc.get("nom") or "").strip()
        prenoms = desc.get("prenoms") or []
        prenoms_txt = " ".join([str(x).strip() for x in prenoms if str(x).strip()]).strip()
        full = f"{prenoms_txt} {nom}".strip()
        if full:
            return full

    exp = content.get("exploitation")
    if exp:
        ent = (((exp.get("identite") or {}).get("entreprise")) or {})
        name = ent.get("denomination")
        if name:
            return str(name).strip()

    return ""


def _extract_city_from_node(node: Dict[str, Any]) -> Optional[str]:
    # adresse entreprise
    adr = (((node.get("adresseEntreprise") or {}).get("adresse")) or {})
    commune = adr.get("commune")
    if commune:
        return str(commune).strip()

    # établissement principal
    principal = node.get("etablissementPrincipal") or {}
    adr2 = principal.get("adresse") or {}
    commune2 = adr2.get("commune")
    if commune2:
        return str(commune2).strip()

    # autres établissements
    autres = node.get("autresEtablissements") or []
    for etab in autres:
        adr3 = etab.get("adresse") or {}
        commune3 = adr3.get("commune")
        if commune3:
            return str(commune3).strip()

    return None


def get_city(company: Dict[str, Any]) -> str:
    content = get_content(company)

    for branch in ("personneMorale", "personnePhysique", "exploitation"):
        node = content.get(branch)
        if node:
            city = _extract_city_from_node(node)
            if city:
                return city

    return "Ville inconnue"


def _extract_activity_from_etab(etab: Dict[str, Any]) -> Optional[str]:
    activites = etab.get("activites") or []
    if not activites:
        return None

    act = activites[0] or {}
    for key in ("descriptionDetaillee", "precisionActivite", "codeApe"):
        value = act.get(key)
        if value:
            return str(value).strip()
    return None


def _extract_activity_from_node(node: Dict[str, Any]) -> Optional[str]:
    principal = node.get("etablissementPrincipal") or {}
    found = _extract_activity_from_etab(principal)
    if found:
        return found

    modified = node.get("etablissementModifie") or {}
    found = _extract_activity_from_etab(modified)
    if found:
        return found

    autres = node.get("autresEtablissements") or []
    for etab in autres:
        found = _extract_activity_from_etab(etab)
        if found:
            return found

    return None


def get_activity(company: Dict[str, Any]) -> str:
    content = get_content(company)

    for branch in ("personneMorale", "personnePhysique", "exploitation"):
        node = content.get(branch)
        if node:
            found = _extract_activity_from_node(node)
            if found:
                return found

    return "activité inconnue"


def get_forme_juridique(company: Dict[str, Any]) -> str:
    content = get_content(company)
    nature = content.get("natureCreation") or {}
    forme = nature.get("formeJuridique")
    if forme:
        return str(forme)

    pm = content.get("personneMorale")
    if pm:
        ent = (((pm.get("identite") or {}).get("entreprise")) or {})
        forme2 = ent.get("formeJuridique")
        if forme2:
            return str(forme2)

    return "forme inconnue"


def get_creation_date(company: Dict[str, Any]) -> str:
    content = get_content(company)
    nature = content.get("natureCreation") or {}
    date_creation = nature.get("dateCreation")
    if date_creation:
        return str(date_creation)

    hist = company.get("historique") or []
    if hist:
        date_integration = (hist[0] or {}).get("dateIntegration")
        if date_integration:
            return str(date_integration)

    return "date inconnue"


def get_historique(company: Dict[str, Any]) -> List[Dict[str, Any]]:
    return company.get("historique") or []


# ============================================================
# CONFORMITÉ / FILTRES
# ============================================================

def diffusion_ok(company: Dict[str, Any]) -> bool:
    if not RESPECT_DIFFUSION:
        return True

    # Opposition à prospection / diffusion commerciale
    if company.get("diffusionCommerciale") is False:
        return False

    # Entreprises non diffusibles INSEE
    if company.get("diffusionINSEE") == "N":
        return False

    return True


def quality_ok(company) :
    return True



# ============================================================
# CLASSIFICATION ÉVÉNEMENTS
# ============================================================

def classify_event(company):
    text = str(company).upper()

    if "CESSATION" in text or "RADIATION" in text or "FERMETURE" in text:
        return "CESSATION", "Cessation / radiation"

    if "MODIFICATION" in text or "TRANSFERT" in text or "CHANGEMENT" in text:
        return "MODIFICATION", "Modification entreprise"

    if "CREATION" in text or "CONSTITUTION" in text or "IMMATRICULATION" in text:
        return "CREATION", "Création entreprise"

    return "AUTRE", "Autre formalité"


def event_key(company: Dict[str, Any]) -> str:
    siren = get_siren(company)
    hist = get_historique(company)

    if hist:
        h0 = hist[0] or {}
        code = str(h0.get("codeEvenement") or "")
        date_integration = str(h0.get("dateIntegration") or "")
        numero_liasse = str(h0.get("numeroLiasse") or "")
        return f"{siren}|{code}|{date_integration}|{numero_liasse}"

    content = get_content(company)
    evt_cess = str(content.get("evenementCessation") or "")
    nat_cess = str(content.get("natureCessation") or "")
    return f"{siren}|{evt_cess}|{nat_cess}"


# ============================================================
# API COUNT / DIFF
# ============================================================

def count_diff(token: str, from_date: str, to_date: str) -> Dict[str, Any]:
    r = session.get(
        COUNT_URL,
        headers=auth_headers(token),
        params={"from": from_date, "to": to_date},
        timeout=REQUEST_TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def fetch_diff_range(token: str, from_date: str, to_date: str) -> List[Dict[str, Any]]:
    """
    Récupère une plage de diff, en découpant si > 10k.
    """
    count_info = count_diff(token, from_date, to_date)

    nb_over_10k = bool(count_info.get("isNbResultsOver10000"))
    nb_results = count_info.get("nbResults")

    logger.info("Plage %s -> %s | count=%s | over10k=%s", from_date, to_date, nb_results, nb_over_10k)

    if nb_over_10k:
        parts = daterange_split(from_date, to_date)
        # si impossible de splitter plus finement
        if parts == [(from_date, to_date)]:
            logger.warning("Impossible de découper davantage %s -> %s", from_date, to_date)
            return []

        all_items: List[Dict[str, Any]] = []
        for sub_from, sub_to in parts:
            all_items.extend(fetch_diff_range(token, sub_from, sub_to))
        return all_items

    return fetch_diff_pages(token, from_date, to_date)


def fetch_diff_pages(token: str, from_date: str, to_date: str) -> List[Dict[str, Any]]:
    headers = auth_headers(token)
    params = {
        "from": from_date,
        "to": to_date,
        "pageSize": PAGE_SIZE,
    }

    all_items: List[Dict[str, Any]] = []
    search_after: Optional[str] = None

    while True:
        p = params.copy()
        if search_after:
            p["searchAfter"] = search_after

        r = session.get(DIFF_URL, headers=headers, params=p, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()

        batch = r.json()
        if not isinstance(batch, list) or not batch:
            break

        all_items.extend(batch)
        search_after = r.headers.get("pagination-search-after")
        if not search_after:
            break

    return all_items


# ============================================================
# MESSAGES
# ============================================================

def build_creation_message(company: Dict[str, Any], detail: str) -> str:
    return f"""🚀 Création détectée

Nom : {get_company_name(company)}
SIREN : {get_siren(company)}
Ville : {get_city(company)}
Créée le : {get_creation_date(company)}
Activité : {get_activity(company)}
Forme : {get_forme_juridique(company)}
Événement : {detail}
"""


def build_modification_message(company: Dict[str, Any], detail: str) -> str:
    return f"""⚙️ Modification détectée

Nom : {get_company_name(company)}
SIREN : {get_siren(company)}
Ville : {get_city(company)}
Activité : {get_activity(company)}
Forme : {get_forme_juridique(company)}
Événement : {detail}
"""


def build_cessation_message(company: Dict[str, Any], detail: str) -> str:
    return f"""❌ Cessation détectée

Nom : {get_company_name(company)}
SIREN : {get_siren(company)}
Ville : {get_city(company)}
Activité : {get_activity(company)}
Forme : {get_forme_juridique(company)}
Événement : {detail}
"""


def build_autre_message(company: Dict[str, Any], detail: str) -> str:
    return f"""ℹ️ Formalité détectée

Nom : {get_company_name(company)}
SIREN : {get_siren(company)}
Ville : {get_city(company)}
Activité : {get_activity(company)}
Forme : {get_forme_juridique(company)}
Événement : {detail}
"""


def build_message(company: Dict[str, Any], event_type: str, detail: str) -> str:
    if event_type == "CREATION":
        return build_creation_message(company, detail)
    if event_type == "MODIFICATION":
        return build_modification_message(company, detail)
    if event_type == "CESSATION":
        return build_cessation_message(company, detail)
    return build_autre_message(company, detail)


# ============================================================
# FENÊTRE TEMPORELLE
# ============================================================

def current_window(last_minutes: int = 1440) -> Tuple[str, str]:
    end_dt = datetime.now()
    start_dt = end_dt - timedelta(minutes=last_minutes)
    return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")


def build_windows() -> List[Tuple[str, str]]:
    short_from, short_to = current_window(last_minutes=1440) # 24h
    long_from, long_to = current_window(last_minutes=4320) # 72h
    return [
        (short_from, short_to),
        (long_from, long_to),
    ]



# ============================================================
# TRAITEMENT
# ============================================================
def company_unique_key(company):
    siren = str(company.get("siren", "")).strip()
    date_pub = str(company.get("datePublication", "")).strip()
    nature = str(company.get("nature", "")).strip()

    return f"{siren}_{date_pub}_{nature}"

def process_companies(conn: sqlite3.Connection, companies: Iterable[Dict[str, Any]]) -> None:
    sent = 0
    skipped = 0

    for company in companies:
        if not diffusion_ok(company):
            skipped += 1
            continue

        if not quality_ok(company):
            skipped += 1
            continue

        event_type, detail = classify_event(company)
        key = company_unique_key(company)

        if already_sent(conn, key):
            skipped += 1
            continue

        msg = build_message(company, event_type, detail)

        try:
            send_telegram_message(msg)
            mark_sent(conn, key, get_siren(company), event_type, get_company_name(company))
            sent += 1
            logger.info(
                "Envoyé | %s | %s | %s",
                event_type,
                get_company_name(company),
                get_siren(company),
            )
        except Exception as e:
            logger.exception(
                "Erreur envoi Telegram pour %s: %s",
                get_siren(company),
                e,
            )

    logger.info("Traitement terminé | envoyés=%s | ignorés=%s", sent, skipped)



# ============================================================
# BOUCLE PRINCIPALE
# ============================================================

def run_once(conn: sqlite3.Connection) -> None:
    logger.info("Connexion INPI...")
    token = get_inpi_token()
    logger.info("Token INPI récupéré.")

    windows = build_windows()
    logger.info("Fenêtres de recherche: %s", windows)

    all_companies = []
    seen_keys = set()

    for from_date, to_date in windows:
        logger.info("Recherche fenêtre: %s -> %s", from_date, to_date)

        companies = fetch_diff_range(token, from_date, to_date)
        logger.info("Formalités brutes récupérées: %s", len(companies))

        for company in companies:
            key = company_unique_key(company)

            if key in seen_keys:
                continue

            seen_keys.add(key)
            all_companies.append(company)
    
    logger.info("Formalités fusionnées: %s", len(all_companies))

    process_companies(conn, all_companies)



def run_forever() -> None:
    conn = init_db()

    while True:
        try:
            run_once(conn)
        except requests.HTTPError as e:
            logger.exception("HTTP error: %s", e)
        except Exception as e:
            logger.exception("Erreur inattendue: %s", e)

        logger.info("Pause %s secondes...", POLL_EVERY_SECONDS)
        time.sleep(POLL_EVERY_SECONDS)


if __name__ == "__main__":
    run_forever() 
