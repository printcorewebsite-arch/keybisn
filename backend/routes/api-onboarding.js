import { completeOnboarding, getOrCreateDossierByUserId, saveOnboardingStep } from "../services/dossier-service.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";
import { requireAuth } from "./route-utils.js";

export async function handleOnboardingRoutes(context) {
  const { req, res, method, pathname, user } = context;

  if (!pathname.startsWith("/api/onboarding")) {
    return false;
  }

  if (!requireAuth(res, user)) {
    return true;
  }

  if (pathname === "/api/onboarding/state" && method === "GET") {
    const dossier = await getOrCreateDossierByUserId(user.id);
    sendJson(res, 200, {
      ok: true,
      onboarding: dossier.onboarding,
      dossierStatus: dossier.status,
      amountCents: dossier.payment?.amountCents || 0,
      progress: dossier.progress,
    });
    return true;
  }

  if (pathname === "/api/onboarding/step" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const step = Number(body.step || 0);
      if (!Number.isInteger(step) || step < 1 || step > 4) {
        sendError(res, 400, "Étape invalide");
        return true;
      }

      const dossier = await saveOnboardingStep(user.id, step, body.data || {});
      sendJson(res, 200, {
        ok: true,
        onboarding: dossier.onboarding,
        amountCents: dossier.payment?.amountCents || 0,
        progress: dossier.progress,
      });
    } catch (error) {
      sendError(res, 400, error.message || "Impossible de sauvegarder l'étape");
    }
    return true;
  }

  if (pathname === "/api/onboarding/complete" && method === "POST") {
    try {
      const dossier = await completeOnboarding(user.id);
      sendJson(res, 200, {
        ok: true,
        dossier,
      });
    } catch (error) {
      sendError(res, 400, error.message || "Impossible de finaliser l'onboarding");
    }
    return true;
  }

  return false;
}
