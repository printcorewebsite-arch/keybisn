import { addSupportMessage, buildDossierInsights, getOrCreateDossierByUserId } from "../services/dossier-service.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";
import { requireAuth } from "./route-utils.js";

export async function handleDashboardRoutes(context) {
  const { req, res, method, pathname, user } = context;

  if (!pathname.startsWith("/api/dashboard")) {
    return false;
  }

  if (!requireAuth(res, user)) {
    return true;
  }

  if (pathname === "/api/dashboard" && method === "GET") {
    const dossier = await getOrCreateDossierByUserId(user.id);
    const insights = buildDossierInsights(dossier);
    sendJson(res, 200, {
      ok: true,
      user,
      dossier,
      insights,
    });
    return true;
  }

  if (pathname === "/api/dashboard/message" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const dossier = await addSupportMessage(user.id, body.message, "client");
      sendJson(res, 200, {
        ok: true,
        messages: dossier.messages,
      });
    } catch (error) {
      sendError(res, 400, error.message || "Impossible d'envoyer le message");
    }
    return true;
  }

  return false;
}
