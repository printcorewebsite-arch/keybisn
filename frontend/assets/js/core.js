const ATTRIBUTION_KEY = "keybis_attribution_v1";
const CAMPAIGN_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
  "li_fat_id",
];

function readAttribution() {
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeAttribution(value) {
  try {
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(value));
  } catch {
    // storage non disponible
  }
}

function parseCampaignParams() {
  const params = new URLSearchParams(window.location.search || "");
  const campaign = {};

  CAMPAIGN_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) {
      campaign[key] = value;
    }
  });

  return campaign;
}

function campaignSource(campaign = {}, fallbackReferrer = "") {
  if (campaign.utm_source) return campaign.utm_source;
  if (campaign.gclid) return "google_ads";
  if (campaign.fbclid) return "facebook_ads";
  if (campaign.msclkid) return "microsoft_ads";
  if (fallbackReferrer) return "referrer";
  return "direct";
}

function getAttributionSnapshot() {
  const now = new Date().toISOString();
  const currentPath = window.location.pathname;
  const referrer = document.referrer || "";
  const campaign = parseCampaignParams();
  const hasCampaign = Object.keys(campaign).length > 0;

  const stored = readAttribution() || {};
  const next = {
    firstSeenAt: stored.firstSeenAt || now,
    firstPath: stored.firstPath || currentPath,
    firstReferrer: stored.firstReferrer || referrer,
    firstCampaign: stored.firstCampaign || (hasCampaign ? campaign : {}),
    lastSeenAt: now,
    lastPath: currentPath,
    lastReferrer: referrer || stored.lastReferrer || "",
    lastCampaign: hasCampaign ? campaign : (stored.lastCampaign || {}),
  };

  writeAttribution(next);

  const source = campaignSource(
    next.firstCampaign && Object.keys(next.firstCampaign).length ? next.firstCampaign : next.lastCampaign,
    next.firstReferrer,
  );

  return { ...next, source };
}

export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    throw new Error("Connexion serveur impossible. Réessayez dans un instant.");
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.error || `Erreur API (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export function formatCurrency(cents = 0) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(cents) / 100);
}

export function qs(selector) {
  return document.querySelector(selector);
}

export function setText(selector, value) {
  const node = qs(selector);
  if (node) node.textContent = value;
}

export function statusLabel(status) {
  const map = {
    draft: "Brouillon",
    pending_payment: "En attente de paiement",
    processing: "En cours de traitement",
    completed: "Terminé",
  };
  return map[status] || status || "Inconnu";
}

export function statusClass(status) {
  return `status-${status || "draft"}`;
}

export async function authStatus() {
  return api("/api/auth/me", { method: "GET" });
}

export async function track(event, payload = {}) {
  try {
    const attribution = getAttributionSnapshot();
    const context = {
      firstPath: attribution.firstPath,
      lastPath: attribution.lastPath,
      firstReferrer: attribution.firstReferrer,
      lastReferrer: attribution.lastReferrer,
      firstCampaign: attribution.firstCampaign || {},
      lastCampaign: attribution.lastCampaign || {},
      ...(payload.context || {}),
    };

    await api("/api/analytics/event", {
      method: "POST",
      body: JSON.stringify({
        event,
        page: window.location.pathname,
        source: attribution.source,
        payload: {
          ...payload,
          context,
        },
      }),
    });
  } catch {
    // non bloquant
  }
}

export function notify(target, message, type = "success") {
  if (!target) return;
  target.className = `notice ${type}`;
  target.textContent = message;
  target.classList.remove("hidden");
}

export function clearNotice(target) {
  if (!target) return;
  target.className = "notice hidden";
  target.textContent = "";
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
