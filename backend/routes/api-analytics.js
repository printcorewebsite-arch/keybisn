import { getAnalyticsSummary, trackEvent } from "../services/analytics-service.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";
import { requireAuth } from "./route-utils.js";

export async function handleAnalyticsRoutes(context) {
  const { req, res, method, pathname, user } = context;

  if (!pathname.startsWith("/api/analytics")) {
    return false;
  }

  if (pathname === "/api/analytics/event" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      await trackEvent({
        event: String(body.event || "unknown"),
        page: String(body.page || ""),
        source: String(body.source || ""),
        userId: user?.id || null,
        payload: body.payload || {},
      });

      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendError(res, 400, error.message || "Tracking impossible");
    }
    return true;
  }

  if (pathname === "/api/analytics/summary" && method === "GET") {
    if (!requireAuth(res, user)) {
      return true;
    }

    const summary = await getAnalyticsSummary();
    sendJson(res, 200, {
      ok: true,
      summary,
    });
    return true;
  }

  return false;
}
