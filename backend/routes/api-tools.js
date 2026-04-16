/**
 * api-tools.js — Route de capture d'emails pour les outils gratuits
 * (simulateur, quiz, documents).
 *
 * Envoie une notification WhatsApp au gérant pour chaque nouveau lead.
 */
import { config } from "../config.js";
import { trackEvent } from "../services/analytics-service.js";
import { readJsonBody, sendError, sendJson } from "../utils/http.js";

const VALID_TYPES = new Set(["simulateur", "quiz_statut", "document_download"]);

const TYPE_LABELS = {
  simulateur: "Simulateur de coûts",
  quiz_statut: "Quiz statut juridique",
  document_download: "Téléchargement document",
};

function buildWhatsAppMessage(capture) {
  const type = TYPE_LABELS[capture.type] || capture.type;
  const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
  let msg = `🔔 Nouveau lead Keybis\n\n`;
  msg += `📧 Email : ${capture.email}\n`;
  msg += `🏷 Source : ${type}\n`;
  msg += `📅 Date : ${now}\n`;

  if (capture.type === "simulateur" && capture.data) {
    const d = capture.data;
    msg += `\n📊 Simulation :\n`;
    msg += `• Forme : ${(d.forme || "").toUpperCase()}\n`;
    msg += `• Capital : ${d.capital || "-"} €\n`;
    msg += `• Domiciliation : ${d.domiciliation || "-"}\n`;
    msg += `• Accompagnement : ${d.accompagnement || "-"}\n`;
  }

  if (capture.type === "quiz_statut" && capture.data) {
    msg += `\n🧠 Réponses quiz :\n`;
    for (const [k, v] of Object.entries(capture.data)) {
      msg += `• ${k} : ${v}\n`;
    }
  }

  if (capture.type === "document_download" && capture.data) {
    msg += `\n📄 Document : ${capture.data.documentLabel || capture.data.document}\n`;
  }

  msg += `\n💡 Page : ${capture.source?.page || "-"}`;
  return msg;
}

function buildWhatsAppUrl(message) {
  const phone = config.whatsappNumber || "33780954094";
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
}

// Simple in-memory store for tool captures (could be extended to file/db)
const captures = [];

export async function handleToolRoutes(context) {
  const { req, res, method, pathname } = context;

  if (pathname === "/api/tools/capture" && method === "POST") {
    try {
      const body = await readJsonBody(req);

      // Validation
      if (!body || !body.email || !body.type) {
        sendError(res, 400, "Email et type requis");
        return true;
      }

      if (!VALID_TYPES.has(body.type)) {
        sendError(res, 400, "Type non reconnu");
        return true;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        sendError(res, 400, "Email invalide");
        return true;
      }

      const capture = {
        id: `cap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: body.type,
        email: body.email.trim().toLowerCase(),
        data: body.data || {},
        source: body.source || {},
        createdAt: new Date().toISOString(),
      };

      // Store
      captures.push(capture);

      // Build WhatsApp notification message
      const whatsappMessage = buildWhatsAppMessage(capture);

      // Log for server console
      console.log(`[Keybis] 📧 Nouveau lead outil: ${capture.type} — ${capture.email}`);
      console.log(`[Keybis] WhatsApp msg:\n${whatsappMessage}`);

      // Track analytics event
      await trackEvent({
        event: "tool_lead_captured",
        page: capture.source?.page || "",
        source: capture.source?.referrer || "direct",
        userId: null,
        payload: {
          captureId: capture.id,
          type: capture.type,
          email: capture.email,
        },
      }).catch(() => {});

      sendJson(res, 201, {
        ok: true,
        captureId: capture.id,
      });
    } catch (error) {
      console.error("[Keybis] tool capture error:", error);
      sendError(res, 500, "Erreur de capture");
    }
    return true;
  }

  // Admin endpoint to list captures
  if (pathname === "/api/tools/captures" && method === "GET") {
    const expected = String(config.adminLeadKey || "");
    const headerKey = String(req.headers["x-admin-key"] || "").trim();
    const queryKey = String(context.url.searchParams.get("key") || "").trim();

    if (!expected || (headerKey !== expected && queryKey !== expected)) {
      sendError(res, 401, "Accès admin requis");
      return true;
    }

    sendJson(res, 200, {
      ok: true,
      total: captures.length,
      captures: captures.slice(-100).reverse(),
    });
    return true;
  }

  return false;
}
