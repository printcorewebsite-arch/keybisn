import { api, authStatus, notify, qs, track } from "./core.js";

async function bootstrap() {
  const notice = qs("#checkout-notice");
  const sessionId = new URLSearchParams(window.location.search).get("session_id") || "";

  const status = await authStatus();
  if (!status.authenticated) {
    window.location.href = "/auth";
    return;
  }

  if (sessionId) {
    await api("/api/payments/confirm", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    });

    notify(notice, "Paiement confirmé. Votre dossier est en traitement.", "success");
    await track("payment_confirmed", { sessionId });
  } else {
    notify(notice, "Paiement déjà enregistré. Consultez votre dashboard pour la suite.", "info");
  }

  qs("#checkout-success-logout")?.addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      // no-op
    }
    window.location.href = "/";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrap().catch((error) => {
    const notice = qs("#checkout-notice");
    notify(notice, error.message || "Erreur de confirmation de paiement", "error");
  });
});
