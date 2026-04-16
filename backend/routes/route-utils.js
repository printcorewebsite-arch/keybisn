import { sendError } from "../utils/http.js";

export function requireAuth(res, user) {
  if (!user) {
    sendError(res, 401, "Authentification requise");
    return false;
  }
  return true;
}
