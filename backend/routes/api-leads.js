import { config } from "../config.js";
import { trackEvent } from "../services/analytics-service.js";
import {
  createLead,
  getLeadStats,
  leadWhatsappUrl,
  listLeads,
  markLeadWhatsappClicked,
  updateLeadStatus,
} from "../services/lead-service.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";

function isAdminAuthorized(req, url) {
  const expected = String(config.adminLeadKey || "");
  if (!expected) return false;

  const headerKey = String(req.headers["x-admin-key"] || "").trim();
  const queryKey = String(url.searchParams.get("key") || "").trim();
  return headerKey === expected || queryKey === expected;
}

function sanitizedLead(lead) {
  return {
    id: lead.id,
    status: lead.status,
    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email,
    needType: lead.needType,
    urgency: lead.urgency,
    pack: lead.pack || "",
    packLabel: lead.packLabel || "",
    activity: lead.activity,
    legalStatus: lead.legalStatus,
    details: lead.details,
    // Rétrocompatibilité : anciens leads peuvent avoir estimateLabel
    estimateLabel: lead.estimateLabel || "",
    source: lead.source,
    sourceLabel: lead.source?.utmSource || lead.source?.referrer || "direct",
    whatsappUrl: leadWhatsappUrl(lead),
    whatsappClickedAt: lead.whatsappClickedAt,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

export async function handleLeadRoutes(context) {
  const { req, res, method, pathname, url } = context;

  if (!pathname.startsWith("/api/leads")) {
    return false;
  }

  if (pathname === "/api/leads" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const result = await createLead(body);

      await trackEvent({
        event: "lead_created",
        page: body?.source?.page || "",
        source: body?.source?.utmSource || body?.source?.referrer || "direct",
        userId: null,
        payload: {
          leadId: result.lead.id,
          needType: result.lead.needType,
          urgency: result.lead.urgency,
          estimateCents: result.lead.estimateCents,
        },
      });

      sendJson(res, 201, {
        ok: true,
        lead: sanitizedLead(result.lead),
        whatsappMessage: result.whatsappMessage,
        whatsappUrl: result.whatsappUrl,
      });
    } catch (error) {
      sendError(res, 400, error.message || "Impossible de créer le lead");
    }
    return true;
  }

  if (pathname === "/api/leads" && method === "GET") {
    if (!isAdminAuthorized(req, url)) {
      sendError(res, 401, "Accès admin requis");
      return true;
    }

    try {
      const status = String(url.searchParams.get("status") || "");
      const needType = String(url.searchParams.get("needType") || "");
      const source = String(url.searchParams.get("source") || "");
      const search = String(url.searchParams.get("search") || "");

      const filters = {
        status,
        needType,
        source,
        search,
      };

      const leads = await listLeads(filters);
      const stats = await getLeadStats(filters);
      sendJson(res, 200, {
        ok: true,
        leads: leads.map(sanitizedLead),
        stats,
      });
    } catch (error) {
      sendError(res, 500, error.message || "Impossible de lire les leads");
    }
    return true;
  }

  const statusMatch = pathname.match(/^\/api\/leads\/([a-zA-Z0-9_\-]+)\/status$/);
  if (statusMatch && method === "POST") {
    if (!isAdminAuthorized(req, url)) {
      sendError(res, 401, "Accès admin requis");
      return true;
    }

    try {
      const body = await readJsonBody(req);
      const updated = await updateLeadStatus(statusMatch[1], body.status);
      if (!updated) {
        sendError(res, 404, "Lead introuvable");
        return true;
      }

      sendJson(res, 200, {
        ok: true,
        lead: sanitizedLead(updated),
      });
    } catch (error) {
      sendError(res, 400, error.message || "Impossible de mettre à jour le statut");
    }
    return true;
  }

  const whatsappMatch = pathname.match(/^\/api\/leads\/([a-zA-Z0-9_\-]+)\/whatsapp$/);
  if (whatsappMatch && method === "POST") {
    try {
      const updated = await markLeadWhatsappClicked(whatsappMatch[1]);
      if (!updated) {
        sendError(res, 404, "Lead introuvable");
        return true;
      }

      await trackEvent({
        event: "lead_whatsapp_click",
        page: updated.source?.page || "/demande",
        source: updated.source?.utmSource || updated.source?.referrer || "direct",
        userId: null,
        payload: {
          leadId: updated.id,
          needType: updated.needType,
        },
      });

      sendJson(res, 200, {
        ok: true,
      });
    } catch (error) {
      sendError(res, 400, error.message || "Impossible de suivre le clic WhatsApp");
    }
    return true;
  }

  return false;
}
