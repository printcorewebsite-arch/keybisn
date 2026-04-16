import { api, track } from "./core.js";

// ─── Constantes ────────────────────────────────────────────────────────────

const NEED_TYPES = new Set(["creation", "modification", "fermeture"]);

const NEED_META = {
  creation: {
    title: "Création de société",
    helper: "On vous aide à créer votre société rapidement, sans blocage administratif.",
    activityLabel: "Activité principale",
    activityPlaceholder: "Ex: agence marketing digital, e-commerce, restauration...",
    detailsPlaceholder: "Ex: date de lancement, nombre d'associés, besoins spécifiques",
  },
  modification: {
    title: "Modification de société",
    helper: "Précisez la modification pour obtenir un plan d'action rapide.",
    activityLabel: "Type de modification",
    activityPlaceholder: "Ex: changement de siège, gérant, objet social...",
    detailsPlaceholder: "Ex: échéance, contexte, informations de la société",
  },
  fermeture: {
    title: "Fermeture de société",
    helper: "Décrivez votre situation pour fermer votre société avec le moins de stress possible.",
    activityLabel: "Contexte de fermeture",
    activityPlaceholder: "Ex: cessation d'activité, dissolution anticipée...",
    detailsPlaceholder: "Ex: date prévue, urgence, contraintes administratives",
  },
};

const VALID_PACKS = new Set(["basique", "express"]);

const PACK_META = {
  basique: { label: "Basique", priority: false },
  express: { label: "Express", priority: true },
};

const URGENCY_LABELS = {
  normal: "Normal",
  "48h": "Sous 48h",
  "24h": "Urgent (24h)",
};

// ─── État ──────────────────────────────────────────────────────────────────

const state = {
  lead: null,
  whatsappUrl: "",
  hasStarted: false,
  pack: "",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function qs(selector) {
  return document.querySelector(selector);
}

function normalizeNeedType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return NEED_TYPES.has(normalized) ? normalized : "creation";
}

function normalizePack(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VALID_PACKS.has(normalized) ? normalized : "";
}

function getInitialNeedType() {
  const fromQuery = new URLSearchParams(window.location.search).get("service");
  return normalizeNeedType(fromQuery);
}

function getInitialPack() {
  const fromQuery = new URLSearchParams(window.location.search).get("pack");
  return normalizePack(fromQuery);
}

function showNotice(message, type = "error") {
  const target = qs("#lead-notice");
  if (!target) return;
  target.className = `acq-notice ${type}`;
  target.textContent = message;
}

function clearNotice() {
  const target = qs("#lead-notice");
  if (!target) return;
  target.className = "acq-notice acq-hidden";
  target.textContent = "";
}

function setSummaryValue(id, value) {
  const node = qs(id);
  if (node) node.textContent = value || "-";
}

// ─── Progression ──────────────────────────────────────────────────────────

function setStep(step) {
  const map = {
    1: { progress: 34, label: "Étape 1/3 - Formulaire" },
    2: { progress: 67, label: "Étape 2/3 - Résumé" },
    3: { progress: 100, label: "Étape 3/3 - WhatsApp" },
  };
  const current = map[step] || map[1];

  const fill = qs("#lead-progress-fill");
  if (fill) fill.style.width = `${current.progress}%`;

  const text = qs("#lead-progress-text");
  if (text) text.textContent = current.label;

  document.querySelectorAll("[data-step]").forEach((node) => {
    const nodeStep = Number(node.getAttribute("data-step"));
    node.classList.toggle("active", nodeStep === step);
  });
}

// ─── Bannière offre ────────────────────────────────────────────────────────

function renderPackBanner(pack) {
  const banner = qs("#pack-banner");
  const labelNode = qs("#pack-banner-label");
  const priorityNode = qs("#pack-banner-priority");

  if (!banner || !pack) return;

  const meta = PACK_META[pack];
  if (!meta) return;

  if (labelNode) labelNode.textContent = meta.label;
  if (priorityNode) priorityNode.classList.toggle("acq-hidden", !meta.priority);

  banner.classList.remove("acq-hidden");

  // Adapter le sous-titre de la page si offre Express
  if (meta.priority) {
    const helper = qs("#need-helper");
    if (helper && !helper.dataset.overridden) {
      helper.dataset.overridden = "1";
      helper.textContent =
        "⚡ Traitement prioritaire — votre dossier sera pris en charge en priorité après envoi sur WhatsApp.";
    }
    // Adapter le bouton submit
    const submitBtn = qs("#lead-form button[type='submit']");
    if (submitBtn) submitBtn.textContent = "Voir mon résumé — Offre Express ⚡";
  }
}

// ─── Adaptation contenu formulaire ────────────────────────────────────────

function updateNeedMeta(needType) {
  const meta = NEED_META[needType] || NEED_META.creation;
  const helper = qs("#need-helper");
  const activityLabel = qs("label[for='lead-activity']");
  const activityInput = qs("#lead-activity");
  const detailsInput = qs("#lead-details");

  if (helper) helper.textContent = meta.helper;
  if (activityLabel) activityLabel.textContent = meta.activityLabel;
  if (activityInput) activityInput.placeholder = meta.activityPlaceholder;
  if (detailsInput) detailsInput.placeholder = meta.detailsPlaceholder;
}

function fillNeedType(needType) {
  const select = qs("#lead-need-type");
  if (!select) return;
  select.value = needType;
  updateNeedMeta(needType);
}

// ─── Collecte et résumé ───────────────────────────────────────────────────

function extractSource() {
  const params = new URLSearchParams(window.location.search);
  return {
    page: window.location.pathname,
    referrer: document.referrer || "",
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmTerm: params.get("utm_term") || "",
    utmContent: params.get("utm_content") || "",
  };
}

function collectPayload() {
  const needType = normalizeNeedType(qs("#lead-need-type")?.value);
  return {
    fullName: qs("#lead-full-name")?.value.trim() || "",
    phone: qs("#lead-phone")?.value.trim() || "",
    email: qs("#lead-email")?.value.trim() || "",
    needType,
    pack: state.pack,
    activity: qs("#lead-activity")?.value.trim() || "",
    legalStatus: qs("#lead-legal-status")?.value.trim() || "",
    urgency: qs("#lead-urgency")?.value || "normal",
    details: qs("#lead-details")?.value.trim() || "",
    source: extractSource(),
  };
}

function showSummary(lead) {
  setSummaryValue("#sum-need", NEED_META[lead.needType]?.title || lead.needType);
  setSummaryValue("#sum-name", lead.fullName);
  setSummaryValue("#sum-phone", lead.phone);
  setSummaryValue("#sum-email", lead.email);
  setSummaryValue("#sum-activity", lead.activity || "-");
  setSummaryValue("#sum-status", lead.legalStatus || "-");
  setSummaryValue("#sum-urgency", URGENCY_LABELS[lead.urgency] || lead.urgency || "Normal");

  // Ligne offre visible seulement si pack défini
  const packRow = qs("#sum-pack-row");
  const packMeta = PACK_META[lead.pack];
  if (packRow && packMeta) {
    setSummaryValue("#sum-pack", packMeta.label);
    packRow.classList.remove("acq-hidden");
  }

  qs("#form-step")?.classList.add("acq-hidden");
  qs("#summary-step")?.classList.remove("acq-hidden");
  setStep(2);
}

function showFormStep() {
  qs("#summary-step")?.classList.add("acq-hidden");
  qs("#form-step")?.classList.remove("acq-hidden");
  setStep(1);
}

// ─── Validation du formulaire ──────────────────────────────────────────────

function showFieldError(field, message) {
  if (!field) return;
  field.classList.add("acq-field-error");
  let errorMsg = field.parentNode?.querySelector(".acq-error-msg");
  if (!errorMsg) {
    errorMsg = document.createElement("span");
    errorMsg.className = "acq-error-msg";
    field.parentNode?.appendChild(errorMsg);
  }
  errorMsg.textContent = message;
}

function clearErrors() {
  document.querySelectorAll(".acq-field-error").forEach((field) => {
    field.classList.remove("acq-field-error");
  });
  document.querySelectorAll(".acq-error-msg").forEach((msg) => {
    msg.remove();
  });
}

function validateForm() {
  let valid = true;
  clearErrors();

  const name = qs("#lead-full-name");
  const phone = qs("#lead-phone");
  const email = qs("#lead-email");

  if (!name?.value.trim()) {
    showFieldError(name, "Veuillez entrer votre nom complet");
    valid = false;
  }
  if (!phone?.value.trim()) {
    showFieldError(phone, "Veuillez entrer votre numéro de téléphone");
    valid = false;
  } else if (!/^[\+]?[0-9\s\-\.]{10,}$/.test(phone.value.trim())) {
    showFieldError(phone, "Numéro de téléphone invalide");
    valid = false;
  }
  if (!email?.value.trim()) {
    showFieldError(email, "Veuillez entrer votre adresse email");
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
    showFieldError(email, "Adresse email invalide");
    valid = false;
  }

  return valid;
}

function wireFieldClearErrors() {
  const fields = [
    "#lead-full-name",
    "#lead-phone",
    "#lead-email",
    "#lead-need-type",
    "#lead-activity",
    "#lead-details",
  ];

  fields.forEach((selector) => {
    const field = qs(selector);
    if (!field) return;
    field.addEventListener("input", () => {
      if (field.classList.contains("acq-field-error")) {
        field.classList.remove("acq-field-error");
        const errorMsg = field.parentNode?.querySelector(".acq-error-msg");
        if (errorMsg) {
          errorMsg.remove();
        }
      }
    });
  });
}

// ─── Soumission ────────────────────────────────────────────────────────────

async function submitLead(event) {
  event.preventDefault();
  clearNotice();

  if (!validateForm()) {
    return;
  }

  const submitBtn = qs("#lead-form button[type='submit']");
  const wasDisabled = submitBtn?.disabled;
  if (submitBtn) submitBtn.disabled = true;

  const payload = collectPayload();
  try {
    const result = await api("/api/leads", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    state.lead = result.lead;
    state.whatsappUrl = result.whatsappUrl || "";
    showSummary(result.lead);

    await track("lead_form_submitted", {
      leadId: result.lead.id,
      needType: result.lead.needType,
      pack: result.lead.pack || "",
    });
  } catch (error) {
    showNotice(error.message || "Impossible d'envoyer votre demande.");
    await track("lead_form_error", { message: error.message || "unknown" });
  } finally {
    if (submitBtn) submitBtn.disabled = wasDisabled;
  }
}

async function redirectToWhatsapp() {
  if (!state.lead || !state.whatsappUrl) return;
  setStep(3);

  try {
    await api(`/api/leads/${state.lead.id}/whatsapp`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch {
    // non bloquant
  }

  await track("lead_whatsapp_redirect", {
    leadId: state.lead.id,
    needType: state.lead.needType,
    pack: state.lead.pack || "",
  });

  window.location.href = state.whatsappUrl;
}

// ─── Tracking démarrage ────────────────────────────────────────────────────

function wireStartTracking() {
  const fields = [
    "#lead-full-name",
    "#lead-phone",
    "#lead-email",
    "#lead-need-type",
    "#lead-activity",
  ];

  fields.forEach((selector) => {
    qs(selector)?.addEventListener("input", async () => {
      if (state.hasStarted) return;
      state.hasStarted = true;
      await track("lead_form_started", {
        service: normalizeNeedType(qs("#lead-need-type")?.value),
        pack: state.pack,
      });
    });
  });
}

// ─── Init ──────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const needType = getInitialNeedType();
  const pack = getInitialPack();

  state.pack = pack;

  fillNeedType(needType);
  renderPackBanner(pack);
  showFormStep();

  qs("#lead-need-type")?.addEventListener("change", (event) => {
    updateNeedMeta(normalizeNeedType(event.target.value));
  });

  qs("#lead-form")?.addEventListener("submit", submitLead);
  qs("#edit-btn")?.addEventListener("click", showFormStep);
  qs("#whatsapp-btn")?.addEventListener("click", redirectToWhatsapp);
  wireStartTracking();
  wireFieldClearErrors();

  await track("lead_form_page_view", { service: needType, pack });
});
