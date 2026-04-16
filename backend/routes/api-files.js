import { addUploadedDocument, findDocumentForUser } from "../services/dossier-service.js";
import { readJsonBody, sendError, sendJson, serveFile } from "../utils/http.js";
import { requireAuth } from "./route-utils.js";

export async function handleFileRoutes(context) {
  const { req, res, method, pathname, user } = context;

  if (!pathname.startsWith("/api/files")) {
    return false;
  }

  if (!requireAuth(res, user)) {
    return true;
  }

  if (pathname === "/api/files/upload" && method === "POST") {
    try {
      const body = await readJsonBody(req, 12_000_000);
      const result = await addUploadedDocument(user.id, {
        fileName: body.fileName,
        mimeType: body.mimeType,
        base64Content: body.base64Content,
      });

      sendJson(res, 201, {
        ok: true,
        document: result.document,
      });
    } catch (error) {
      sendError(res, 400, error.message || "Upload impossible");
    }
    return true;
  }

  const documentMatch = pathname.match(/^\/api\/files\/([a-zA-Z0-9_\-]+)/);
  if (documentMatch && method === "GET") {
    const documentId = documentMatch[1];

    try {
      const found = await findDocumentForUser(user.id, documentId);
      if (!found) {
        sendError(res, 404, "Document introuvable");
        return true;
      }

      const headers = {
        "Content-Disposition": `attachment; filename=\"${encodeURIComponent(found.document.name)}\"`,
        "Cache-Control": "no-store",
      };

      const served = await serveFile(res, found.document.storedPath, headers);
      if (!served) {
        sendError(res, 404, "Fichier indisponible");
      }
    } catch (error) {
      sendError(res, 500, error.message || "Erreur de lecture du document");
    }
    return true;
  }

  return false;
}
