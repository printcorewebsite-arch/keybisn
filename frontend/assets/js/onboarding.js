import { api, authStatus, clearNotice, formatCurrency, notify, qs, setText, track } from "./core.js";

const COMPANY_LABELS = {
  micro: "Micro-entreprise",
  sasu: "SASU",
  sas: "SAS",
  eurl: "EURL",
  sarl: "SARL",
};

const state = {
  currentStep: 1,
  onboarding: {
    companyType: "",
    activity: "",
    activityDetails: "",
    associatesCount: 0,
    associatesNames: [],
    options: {
      domiciliation: false,
      accounting: false,
      prioritySupport: false,
      trademark: false,
    },
  },
  amountCents: 39900,
};

function estimateAmountCents() {
  const type = state.onboarding.companyType;
  let total = type === "micro" ? 2900 : 39900;

  const options = state.onboarding.options || {};
  if (options.domiciliation) total += 4900;
  if (options.accounting) total += 9900;
  if (options.prioritySupport) total += 6900;
  if (options.trademark) total += 12900;

  return total;
}

function getSelectedOptionsText() {
  const labels = [];
  const options = state.onboarding.options || {};
  if (options.domiciliation) labels.push("Domiciliation");
  if (options.accounting) labels.push("Pack comptable");
  if (options.prioritySupport) labels.push("Support prioritaire");
  if (options.trademark) labels.push("Pré-audit marque");
  return labels.length ? labels.join(", ") : "Aucune";
}

function renderSummary() {
  const company = COMPANY_LABELS[state.onboarding.companyType] || "Non défini";
  const activity = state.onboarding.activity || "Non définie";
  const associates = state.onboarding.companyType === "micro"
    ? "Non concerné (micro-entreprise)"
    : `${Number(state.onboarding.associatesCount || 0)} associé(s)`;

  setText("#summary-company", company);
  setText("#summary-activity", activity);
  setText("#summary-associates", associates);
  setText("#summary-options", getSelectedOptionsText());
}

function updateProgressVisual() {
  const ratio = (state.currentStep / 4) * 100;
  const fill = qs("#onboarding-progress-fill");
  if (fill) fill.style.width = `${ratio}%`;
  setText("#onboarding-progress-text", `Étape ${state.currentStep} sur 4`);
  setText("#onboarding-progress-percent", `${Math.round(ratio)}%`);

  document.querySelectorAll("[data-step-pill]").forEach((node) => {
    const step = Number(node.getAttribute("data-step-pill"));
    node.classList.toggle("active", step === state.currentStep);
    node.classList.toggle("done", step < state.currentStep);
  });

  const prevBtn = qs("#btn-prev");
  const nextBtn = qs("#btn-next");
  if (prevBtn) prevBtn.classList.toggle("hidden", state.currentStep === 1);
  if (nextBtn) {
    nextBtn.textContent = state.currentStep === 4
      ? "Finaliser le questionnaire"
      : "Continuer";
  }

  document.querySelectorAll(".step-view").forEach((view) => {
    const step = Number(view.getAttribute("data-step"));
    view.classList.toggle("hidden", step !== state.currentStep);
  });
}

function setAmount(amountCents, { fromServer = false } = {}) {
  if (fromServer) {
    state.amountCents = amountCents;
  } else {
    state.amountCents = estimateAmountCents();
  }

  setText("#onboarding-amount", formatCurrency(state.amountCents));
}

function prefillFromServer(onboarding) {
  state.onboarding = {
    ...state.onboarding,
    ...(onboarding || {}),
    options: {
      ...state.onboarding.options,
      ...(onboarding?.options || {}),
    },
  };

  if (state.onboarding.companyType) {
    const selected = qs(`input[name="companyType"][value="${state.onboarding.companyType}"]`);
    if (selected) selected.checked = true;
  }

  if (state.onboarding.activity) {
    const activity = qs("#activity");
    if (activity) activity.value = state.onboarding.activity;
  }

  if (state.onboarding.activityDetails) {
    const details = qs("#activityDetails");
    if (details) details.value = state.onboarding.activityDetails;
  }

  const associatesCount = qs("#associatesCount");
  if (associatesCount) {
    associatesCount.value = String(state.onboarding.associatesCount || 0);
  }

  ["domiciliation", "accounting", "prioritySupport", "trademark"].forEach((key) => {
    const checkbox = qs(`#option-${key}`);
    if (checkbox) checkbox.checked = Boolean(state.onboarding.options?.[key]);
  });

  syncAssociatesUI();
  renderSummary();
}

function buildAssociatesInputs(count) {
  const wrap = qs("#associatesNamesWrap");
  if (!wrap) return;

  wrap.innerHTML = "";
  if (count <= 0) return;

  for (let index = 0; index < count; index += 1) {
    const field = document.createElement("div");
    field.className = "field";

    const label = document.createElement("label");
    label.textContent = `Associé ${index + 1}`;

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Nom et prénom";
    input.dataset.associate = String(index);
    input.value = state.onboarding.associatesNames?.[index] || "";
    input.addEventListener("input", () => {
      renderSummary();
    });

    field.append(label, input);
    wrap.appendChild(field);
  }
}

function syncAssociatesUI() {
  const type = state.onboarding.companyType;
  const wrap = qs("#associatesSection");
  const hint = qs("#associatesHint");

  if (!wrap || !hint) return;

  if (type === "micro") {
    wrap.classList.add("hidden");
    hint.classList.remove("hidden");
    const select = qs("#associatesCount");
    if (select) select.value = "0";
    state.onboarding.associatesCount = 0;
    state.onboarding.associatesNames = [];
    buildAssociatesInputs(0);
    renderSummary();
    return;
  }

  wrap.classList.remove("hidden");
  hint.classList.add("hidden");

  const count = Number(qs("#associatesCount")?.value || state.onboarding.associatesCount || 0);
  state.onboarding.associatesCount = count;
  buildAssociatesInputs(count);
  renderSummary();
}

function collectStepData(step) {
  if (step === 1) {
    const selected = qs('input[name="companyType"]:checked');
    return {
      companyType: selected?.value || "",
    };
  }

  if (step === 2) {
    return {
      activity: qs("#activity")?.value.trim() || "",
      activityDetails: qs("#activityDetails")?.value.trim() || "",
    };
  }

  if (step === 3) {
    if (state.onboarding.companyType === "micro") {
      return {
        associatesCount: 0,
        associatesNames: [],
      };
    }

    const count = Number(qs("#associatesCount")?.value || 0);
    const associatesNames = Array.from(document.querySelectorAll("input[data-associate]"))
      .map((node) => node.value.trim())
      .filter(Boolean)
      .slice(0, 10);

    return {
      associatesCount: count,
      associatesNames,
    };
  }

  if (step === 4) {
    return {
      options: {
        domiciliation: Boolean(qs("#option-domiciliation")?.checked),
        accounting: Boolean(qs("#option-accounting")?.checked),
        prioritySupport: Boolean(qs("#option-prioritySupport")?.checked),
        trademark: Boolean(qs("#option-trademark")?.checked),
      },
    };
  }

  return {};
}

function validateStep(step, data) {
  if (step === 1 && !data.companyType) {
    return "Sélectionnez un type de société.";
  }

  if (step === 2 && !data.activity) {
    return "Indiquez votre activité principale.";
  }

  if (step === 3 && state.onboarding.companyType !== "micro" && Number(data.associatesCount) <= 0) {
    return "Indiquez le nombre d'associés.";
  }

  return "";
}

function mergeIntoState(payload) {
  state.onboarding = {
    ...state.onboarding,
    ...payload,
    options: {
      ...state.onboarding.options,
      ...(payload.options || {}),
    },
  };
  renderSummary();
  setAmount(0, { fromServer: false });
}

async function saveStep(step, noticeNode) {
  const payload = collectStepData(step);
  const validationError = validateStep(step, payload);
  if (validationError) {
    notify(noticeNode, validationError, "error");
    return false;
  }

  clearNotice(noticeNode);
  mergeIntoState(payload);

  const result = await api("/api/onboarding/step", {
    method: "POST",
    body: JSON.stringify({ step, data: payload }),
  });

  setAmount(result.amountCents || state.amountCents, { fromServer: true });
  return true;
}

async function completeFlow(noticeNode) {
  const result = await api("/api/onboarding/complete", {
    method: "POST",
    body: JSON.stringify({}),
  });

  notify(noticeNode, "Onboarding terminé. Redirection vers votre dashboard.", "success");
  await track("onboarding_completed", { dossierId: result.dossier?.id || "" });
  window.location.href = "/dashboard";
}

function wireLiveUpdates() {
  document.querySelectorAll('input[name="companyType"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.onboarding.companyType = input.value;
      syncAssociatesUI();
      renderSummary();
      setAmount(0, { fromServer: false });
    });
  });

  qs("#activity")?.addEventListener("input", (event) => {
    state.onboarding.activity = event.target.value.trim();
    renderSummary();
  });

  qs("#activityDetails")?.addEventListener("input", (event) => {
    state.onboarding.activityDetails = event.target.value.trim();
  });

  qs("#associatesCount")?.addEventListener("change", (event) => {
    state.onboarding.associatesCount = Number(event.target.value || 0);
    buildAssociatesInputs(state.onboarding.associatesCount);
    renderSummary();
  });

  ["domiciliation", "accounting", "prioritySupport", "trademark"].forEach((key) => {
    qs(`#option-${key}`)?.addEventListener("change", (event) => {
      state.onboarding.options[key] = Boolean(event.target.checked);
      renderSummary();
      setAmount(0, { fromServer: false });
    });
  });
}

function wireLogout() {
  qs("#connected-logout")?.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // no-op
    }
    window.location.href = "/";
  });
}

async function bootstrap() {
  const notice = qs("#onboarding-notice");

  const status = await authStatus();
  if (!status.authenticated) {
    window.location.href = "/auth";
    return;
  }

  const stateResult = await api("/api/onboarding/state", { method: "GET" });
  prefillFromServer(stateResult.onboarding || {});
  setAmount(stateResult.amountCents || 39900, { fromServer: true });

  if (stateResult.onboarding?.completed) {
    window.location.href = "/dashboard";
    return;
  }

  state.currentStep = Math.min(Math.max(Number(stateResult.onboarding?.currentStep || 1), 1), 4);
  updateProgressVisual();

  qs("#btn-prev")?.addEventListener("click", async () => {
    if (state.currentStep > 1) {
      state.currentStep -= 1;
      updateProgressVisual();
      await track("onboarding_step_view", { step: state.currentStep });
    }
  });

  qs("#btn-next")?.addEventListener("click", async () => {
    try {
      const saved = await saveStep(state.currentStep, notice);
      if (!saved) return;

      await track("onboarding_step_saved", { step: state.currentStep });

      if (state.currentStep < 4) {
        state.currentStep += 1;
        updateProgressVisual();
        await track("onboarding_step_view", { step: state.currentStep });
        return;
      }

      await completeFlow(notice);
    } catch (error) {
      notify(notice, error.message, "error");
    }
  });

  wireLiveUpdates();
  wireLogout();

  await track("onboarding_page_view");
  await track("onboarding_step_view", { step: state.currentStep });
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrap().catch((error) => {
    const notice = qs("#onboarding-notice");
    notify(notice, error.message || "Erreur de chargement de l'onboarding", "error");
  });
});
