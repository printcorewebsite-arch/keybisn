import { api, authStatus, formatCurrency, notify, qs, track } from "./core.js";

const COMPANY_LABELS = {
  micro: "Micro-entreprise",
  sasu: "SASU",
  sas: "SAS",
  eurl: "EURL",
  sarl: "SARL",
};

let dashboardState = null;

function mapPaymentStatus(paymentStatus = "unpaid") {
  if (paymentStatus === "paid") {
    return { label: "Payé", className: "status-completed" };
  }
  if (paymentStatus === "pending") {
    return { label: "Paiement en cours", className: "status-pending" };
  }
  if (paymentStatus === "failed") {
    return { label: "Paiement échoué", className: "status-failed" };
  }
  return { label: "En attente", className: "status-pending" };
}

function selectedOptionsText(options = {}) {
  const values = [];
  if (options.domiciliation) values.push("Domiciliation");
  if (options.accounting) values.push("Pack comptable");
  if (options.prioritySupport) values.push("Support prioritaire");
  if (options.trademark) values.push("Pré-audit marque");
  return values.length ? values.join(", ") : "Aucune";
}

function renderSummary(payload) {
  const dossier = payload.dossier || {};
  const onboarding = dossier.onboarding || {};
  const payment = dossier.payment || {};

  const statusMeta = mapPaymentStatus(payment.status);
  const statusPill = qs("#payment-status-pill");
  if (statusPill) {
    statusPill.className = `status-pill ${statusMeta.className}`;
    statusPill.textContent = statusMeta.label;
  }

  qs("#checkout-company").textContent = COMPANY_LABELS[onboarding.companyType] || "Non défini";
  qs("#checkout-activity").textContent = onboarding.activity || "Non définie";
  qs("#checkout-associates").textContent = onboarding.companyType === "micro"
    ? "Non concerné"
    : `${Number(onboarding.associatesCount || 0)} associé(s)`;
  qs("#checkout-options").textContent = selectedOptionsText(onboarding.options || {});
  qs("#checkout-total").textContent = formatCurrency(payment.amountCents || 0);

  const payBtn = qs("#checkout-pay-btn");
  if (!payBtn) return;

  if (!onboarding.completed) {
    payBtn.disabled = true;
    payBtn.textContent = "Terminer l'onboarding d'abord";
    return;
  }

  if (payment.status === "paid") {
    payBtn.disabled = true;
    payBtn.textContent = "Paiement déjà confirmé";
    return;
  }

  payBtn.disabled = false;
  payBtn.textContent = payment.status === "failed" ? "Réessayer le paiement" : "Procéder au paiement";
}

async function openCheckout(noticeNode) {
  const result = await api("/api/payments/create-checkout", {
    method: "POST",
    body: JSON.stringify({}),
  });

  notify(noticeNode, "Redirection vers la page de paiement...", "info");
  await track("checkout_redirect_started", { mode: result.checkout.mode });
  window.location.href = result.checkout.checkoutUrl;
}

async function handleCancelledPayment(noticeNode) {
  const search = new URLSearchParams(window.location.search);
  const cancelled = search.get("payment") === "cancelled";
  const sessionId = search.get("session_id") || "";

  if (!cancelled && !sessionId) return false;

  if (sessionId) {
    try {
      await api("/api/payments/fail", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // non bloquant
    }
  }

  notify(noticeNode, "Paiement interrompu. Vous pouvez relancer en un clic.", "warning");
  return true;
}

function wireLogout() {
  qs("#checkout-logout")?.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // no-op
    }
    window.location.href = "/";
  });
}

async function bootstrap() {
  const notice = qs("#checkout-notice");

  const status = await authStatus();
  if (!status.authenticated) {
    window.location.href = "/auth";
    return;
  }

  dashboardState = await api("/api/dashboard", { method: "GET" });
  renderSummary(dashboardState);
  const cancelled = await handleCancelledPayment(notice);
  if (cancelled) {
    dashboardState = await api("/api/dashboard", { method: "GET" });
    renderSummary(dashboardState);
  }

  qs("#checkout-pay-btn")?.addEventListener("click", async () => {
    try {
      await openCheckout(notice);
    } catch (error) {
      notify(notice, error.message || "Impossible de lancer le paiement", "error");
      await track("checkout_redirect_error", { message: error.message || "unknown" });
    }
  });

  wireLogout();
  await track("checkout_page_view", {
    paymentStatus: dashboardState?.dossier?.payment?.status || "unknown",
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrap().catch((error) => {
    notify(qs("#checkout-notice"), error.message || "Erreur de chargement paiement", "error");
  });
});
