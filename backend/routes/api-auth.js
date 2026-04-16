import { config } from "../config.js";
import { createSession, deleteSession, loginUser, registerUser } from "../services/auth-service.js";
import { getOrCreateDossierByUserId } from "../services/dossier-service.js";
import { clearCookie, readJsonBody, sendError, sendJson, setCookie } from "../utils/http.js";

function getNextPath(dossier) {
  if (dossier?.onboarding?.completed) return "/dashboard";
  return "/onboarding";
}

export async function handleAuthRoutes(context) {
  const { req, res, method, pathname, user, sessionId } = context;

  if (pathname === "/api/auth/register" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const createdUser = await registerUser({
        fullName: body.fullName,
        email: body.email,
        password: body.password,
      });

      const session = await createSession(createdUser.id);
      const dossier = await getOrCreateDossierByUserId(createdUser.id);

      setCookie(res, config.cookieName, session.id, {
        maxAge: config.sessionTtlMs,
        path: "/",
        sameSite: "Lax",
        secure: config.secureCookies,
      });

      sendJson(res, 201, {
        ok: true,
        user: createdUser,
        nextPath: getNextPath(dossier),
      });
    } catch (error) {
      sendError(res, 400, error.message || "Impossible de créer le compte");
    }
    return true;
  }

  if (pathname === "/api/auth/login" && method === "POST") {
    try {
      const body = await readJsonBody(req);
      const loggedUser = await loginUser({
        email: body.email,
        password: body.password,
      });

      const session = await createSession(loggedUser.id);
      const dossier = await getOrCreateDossierByUserId(loggedUser.id);

      setCookie(res, config.cookieName, session.id, {
        maxAge: config.sessionTtlMs,
        path: "/",
        sameSite: "Lax",
        secure: config.secureCookies,
      });

      sendJson(res, 200, {
        ok: true,
        user: loggedUser,
        nextPath: getNextPath(dossier),
      });
    } catch (error) {
      sendError(res, 400, error.message || "Connexion impossible");
    }
    return true;
  }

  if (pathname === "/api/auth/logout" && method === "POST") {
    if (sessionId) {
      await deleteSession(sessionId);
    }
    clearCookie(res, config.cookieName);
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (pathname === "/api/auth/me" && method === "GET") {
    if (!user) {
      sendJson(res, 200, { ok: true, authenticated: false });
      return true;
    }

    const dossier = await getOrCreateDossierByUserId(user.id);
    sendJson(res, 200, {
      ok: true,
      authenticated: true,
      user,
      nextPath: getNextPath(dossier),
    });
    return true;
  }

  return false;
}
