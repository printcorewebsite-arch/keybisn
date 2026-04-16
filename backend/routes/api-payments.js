import { createCheckout } from "../services/payment-service.js";
import {
  buildDossierInsights,
  getOrCreateDossierByUserId,
  markPaymentCreated,
  markPaymentFailedBySession,
  markPaymentPaidBySession,
} from "../services/dossier-service.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";
import { requireAuth } from "./route-utils.js";

export async function handlePaymentRoutes(context) {
  const { req, res, method, pathname, user, url } = context;

  if (!pathname.startsWith("/api/payments")) {
    return false;
  }

  if (!requireAuth(res, user)) {
    return true;
  }

  if (pathname === "/api/payments/create-checkout" && method === "POST") {
    try {
      const dossier = await getOrCreateDossierByUserId(user.id);

      if (!dossier.onboarding?.completed) {
        sendError(res, 400, "Terminez l'onboarding avant de payer");
        return true;
      }

      if (dossier.payment?.status === "paid") {
        sendError(res, 400, "Paiement déjà confirmé");
        return true;
      }

      const checkout = await createCheckout({ dossier, user });
      await markPaymentCreated(user.id, checkout.checkoutSessionId);

      sendJson(res, 200, {
        ok: true,
        checkout,
      });
    } catch (error) {
      sendError(res, 500, error.message || "Impossible de créer le paiement");
    }
    return true;
  }

  if (pathname === "/api/payments/confirm" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const sessionId = String(body.sessionId || "").trim() || String(url.searchParams.get("session_id") || "").trim();
      if (!sessionId) {
        sendError(res, 400, "session_id manquant");
        return true;
      }

      const dossier = await markPaymentPaidBySession(user.id, sessionId);
      if (!dossier) {
        sendError(res, 400, "Session de paiement invalide");
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        dossier,
      });
    } catch (error) {
      sendError(res, 500, error.message || "Impossible de confirmer le paiement");
    }
    return true;
  }

  if (pathname === "/api/payments/fail" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const sessionId = String(body.sessionId || "").trim() || String(url.searchParams.get("session_id") || "").trim();
      if (!sessionId) {
        sendError(res, 400, "session_id manquant");
        return true;
      }

      const dossier = await markPaymentFailedBySession(user.id, sessionId);
      if (!dossier) {
        sendError(res, 400, "Session de paiement invalide");
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        dossier,
      });
    } catch (error) {
      sendError(res, 500, error.message || "Impossible de marquer le paiement en échec");
    }
    return true;
  }

  if (pathname === "/api/payments/state" && method === "GET") {
    try {
      const dossier = await getOrCreateDossierByUserId(user.id);
      const insights = buildDossierInsights(dossier);
      sendJson(res, 200, {
        ok: true,
        payment: dossier.payment,
        status: dossier.status,
        amountCents: dossier.payment?.amountCents || 0,
        onboardingCompleted: Boolean(dossier.onboarding?.completed),
        insights,
      });
    } catch (error) {
      sendError(res, 500, error.message || "Impossible de récupérer l'état du paiement");
    }
    return true;
  }

  return false;
}
