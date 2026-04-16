const WA_NUMBER = "33780954094";
const TRACK_KEY = "keybis_tracking_events_v1";
const ATTR_KEY = "keybis_attribution_v1";
const SESSION_KEY = "keybis_session_id_v1";

function buildWhatsAppUrl(message) {
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(message)}`;
}

function ensureSessionId() {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function parseUtmParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || "",
    utm_term: params.get("utm_term") || "",
    utm_content: params.get("utm_content") || "",
  };
}

function resolveSource(utm) {
  if (utm.utm_source) return utm.utm_source;
  if (document.referrer) {
    try {
      const host = new URL(document.referrer).hostname;
      return host || "referral";
    } catch {
      return "referral";
    }
  }
  return "direct";
}

function setupAttribution() {
  const utm = parseUtmParams();
  const existingRaw = localStorage.getItem(ATTR_KEY);
  const nowIso = new Date().toISOString();

  if (!existingRaw) {
    const firstTouch = {
      first_touch_at: nowIso,
      first_page: window.location.pathname,
      first_query: window.location.search || "",
      referrer: document.referrer || "direct",
      source: resolveSource(utm),
      ...utm,
    };
    localStorage.setItem(ATTR_KEY, JSON.stringify(firstTouch));
    return firstTouch;
  }

  let existing = {};
  try {
    existing = JSON.parse(existingRaw) || {};
  } catch {
    existing = {};
  }

  if (utm.utm_source || utm.utm_campaign || utm.utm_medium || utm.utm_term || utm.utm_content) {
    existing.last_touch_at = nowIso;
    existing.last_page = window.location.pathname;
    existing.last_query = window.location.search || "";
    existing.last_source = resolveSource(utm);
    existing.last_utm_source = utm.utm_source || "";
    existing.last_utm_medium = utm.utm_medium || "";
    existing.last_utm_campaign = utm.utm_campaign || "";
    existing.last_utm_term = utm.utm_term || "";
    existing.last_utm_content = utm.utm_content || "";
    localStorage.setItem(ATTR_KEY, JSON.stringify(existing));
  }

  return existing;
}

function readAttribution() {
  const raw = localStorage.getItem(ATTR_KEY);
  if (!raw) return setupAttribution();
  try {
    return JSON.parse(raw);
  } catch {
    return setupAttribution();
  }
}

function readEvents() {
  const raw = localStorage.getItem(TRACK_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events) {
  const trimmed = events.slice(-400);
  localStorage.setItem(TRACK_KEY, JSON.stringify(trimmed));
}

function trackEvent(name, payload = {}) {
  const attribution = readAttribution() || {};
  const event = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    ts: new Date().toISOString(),
    page: window.location.pathname,
    query: window.location.search || "",
    session_id: ensureSessionId(),
    source: attribution.source || attribution.last_source || "direct",
    utm_source: attribution.utm_source || "",
    utm_medium: attribution.utm_medium || "",
    utm_campaign: attribution.utm_campaign || "",
    ...payload,
  };

  const events = readEvents();
  events.push(event);
  writeEvents(events);

  if (window.gtag) {
    window.gtag("event", name, payload);
  }

  if (window.plausible) {
    window.plausible(name, { props: payload });
  }

  return event;
}

function buildTrackingContextLines() {
  const attribution = readAttribution() || {};
  const lines = [
    `Session: ${ensureSessionId()}`,
    `Page actuelle: ${window.location.pathname}`,
    `Source: ${attribution.source || attribution.last_source || "direct"}`,
  ];

  if (attribution.utm_source) lines.push(`UTM source: ${attribution.utm_source}`);
  if (attribution.utm_medium) lines.push(`UTM medium: ${attribution.utm_medium}`);
  if (attribution.utm_campaign) lines.push(`UTM campaign: ${attribution.utm_campaign}`);
  if (attribution.referrer) lines.push(`Referrer: ${attribution.referrer}`);

  return lines;
}

function openWhatsApp(message, context = {}) {
  trackEvent("whatsapp_open", context);
  window.location.href = buildWhatsAppUrl(message);
}

function setupMobileMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const nav = document.getElementById("site-nav");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const opened = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(opened));
    trackEvent("menu_toggle", { opened });
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function setupFaq() {
  document.querySelectorAll(".faq-item").forEach((item, index) => {
    const trigger = item.querySelector(".faq-question");
    if (!trigger) return;

    trigger.addEventListener("click", () => {
      const wasOpen = item.classList.contains("open");
      item.parentElement?.querySelectorAll(".faq-item").forEach((sibling) => {
        sibling.classList.remove("open");
      });
      if (!wasOpen) {
        item.classList.add("open");
        trackEvent("faq_open", { index: index + 1, question: trigger.textContent?.trim() || "" });
      }
    });
  });
}

function setupTabs() {
  const tabs = document.querySelectorAll(".pricing-tab");
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      const wrap = tab.closest(".panel-wrap") || document;
      if (!target) return;

      wrap.querySelectorAll(".pricing-tab").forEach((btn) => btn.classList.remove("active"));
      wrap.querySelectorAll(".pricing-panel").forEach((panel) => panel.classList.remove("active"));

      tab.classList.add("active");
      const targetPanel = wrap.querySelector(`#${target}`);
      if (targetPanel) targetPanel.classList.add("active");

      trackEvent("tab_click", { tab: target });
    });
  });
}

function setupGlobalClickTracking() {
  document.addEventListener("click", (event) => {
    const target = event.target.closest("a,button");
    if (!target) return;

    const href = target.getAttribute("href") || "";
    const label = target.getAttribute("data-track") || target.textContent?.trim() || "";
    let ctaType = "";

    if (href.includes("demarrer.html")) ctaType = "demarrer";
    else if (href.includes("wa.me")) ctaType = "whatsapp";
    else if (href.startsWith("tel:")) ctaType = "phone";
    else if (href.startsWith("mailto:")) ctaType = "email";
    else if (target.matches("button[type='submit']")) ctaType = "submit";
    else if (target.classList.contains("btn") || target.hasAttribute("data-track")) ctaType = "other";

    if (!ctaType) return;
    trackEvent("cta_click", { cta_type: ctaType, label, href });
  });
}

function setupLeadForm() {
  const form = document.getElementById("lead-form");
  if (!form) return;
  let started = false;

  const needField = form.querySelector("#need");
  const preselectedNeed = new URLSearchParams(window.location.search).get("besoin");

  if (preselectedNeed && needField) {
    const hasOption = Array.from(needField.options).some((option) => option.value === preselectedNeed);
    if (!hasOption) {
      const option = document.createElement("option");
      option.value = preselectedNeed;
      option.textContent = preselectedNeed;
      needField.appendChild(option);
    }
    needField.value = preselectedNeed;
  }

  form.addEventListener("input", () => {
    if (started) return;
    started = true;
    trackEvent("form_start", { form: "lead-form" });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = (form.querySelector("#name")?.value || "").trim();
    const email = (form.querySelector("#email")?.value || "").trim();
    const need = (form.querySelector("#need")?.value || "").trim();

    if (!name || !email || !need) {
      trackEvent("form_error", { form: "lead-form", reason: "missing_required_field" });
      form.reportValidity();
      return;
    }

    trackEvent("form_submit", {
      form: "lead-form",
      need,
      has_name: Boolean(name),
      has_email: Boolean(email),
    });

    const messageLines = [
      "Bonjour Keybis, je souhaite demarrer une formalite.",
      `Nom: ${name}`,
      `Email: ${email}`,
      `Type de besoin: ${need}`,
      ...buildTrackingContextLines(),
    ];

    openWhatsApp(messageLines.join("\n"), {
      cta_type: "lead_form",
      need,
      from_page: window.location.pathname,
    });
  });
}

function injectStickyWhatsApp() {
  const existing = document.querySelector(".sticky-whatsapp");
  if (existing) return;

  const button = document.createElement("a");
  button.href = "#";
  button.className = "sticky-whatsapp";
  button.setAttribute("aria-label", "Contacter Keybis sur WhatsApp");
  button.textContent = "WhatsApp";

  button.addEventListener("click", (event) => {
    event.preventDefault();
    const message = [
      "Bonjour Keybis, je souhaite etre rappelle rapidement.",
      ...buildTrackingContextLines(),
    ].join("\n");

    openWhatsApp(message, {
      cta_type: "sticky_whatsapp",
      from_page: window.location.pathname,
    });
  });

  document.body.appendChild(button);
}

function setupTrackingPage() {
  const root = document.getElementById("tracking-root");
  if (!root) return;

  const events = readEvents();
  if (!events.length) {
    root.innerHTML = "<p>Aucun événement tracké pour le moment.</p>";
    return;
  }

  const byName = events.reduce((acc, event) => {
    acc[event.name] = (acc[event.name] || 0) + 1;
    return acc;
  }, {});

  const rows = Object.entries(byName)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `<tr><td>${name}</td><td>${count}</td></tr>`)
    .join("");

  root.innerHTML = `
    <p>Total événements: <strong>${events.length}</strong></p>
    <table class="tracking-table">
      <thead><tr><th>Événement</th><th>Volume</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function setCurrentYear() {
  const year = String(new Date().getFullYear());
  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = year;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  ensureSessionId();
  setupAttribution();
  trackEvent("page_view", { title: document.title });

  setupMobileMenu();
  setupFaq();
  setupTabs();
  setupGlobalClickTracking();
  setupLeadForm();
  injectStickyWhatsApp();
  setupTrackingPage();
  setCurrentYear();
});
