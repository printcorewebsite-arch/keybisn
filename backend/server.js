import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { config } from "./config.js";
import { handleAnalyticsRoutes } from "./routes/api-analytics.js";
import { handleAuthRoutes } from "./routes/api-auth.js";
import { handleDashboardRoutes } from "./routes/api-dashboard.js";
import { handleFileRoutes } from "./routes/api-files.js";
import { handleLeadRoutes } from "./routes/api-leads.js";
import { handleOnboardingRoutes } from "./routes/api-onboarding.js";
import { handlePaymentRoutes } from "./routes/api-payments.js";
import { handleToolRoutes } from "./routes/api-tools.js";
import { getUserFromSession } from "./services/auth-service.js";
import { ensureDataStore } from "./services/data-store.js";
import { marketingSeoContext } from "./services/marketing-seo.js";
import { marketingShellContext } from "./services/marketing-shell.js";
import { parseCookies, safePathJoin, sendJson, serveFile, serveHtmlTemplate } from "./utils/http.js";

const PAGE_ROUTES = {
  "/": "index.html",
  "/a-propos": "a-propos.html",
  "/creation-societe": "creation-societe.html",
  "/creation-societe-rapide": "creation-societe-rapide.html",
  "/modification-societe": "modification-societe.html",
  "/modification-societe-urgente": "modification-societe-urgente.html",
  "/fermeture-societe": "fermeture-societe.html",
  "/fermeture-societe-rapide": "fermeture-societe-rapide.html",
  "/guides": "guides.html",
  "/guide-creation-sasu": "guide-creation-sasu.html",
  "/guide-modification-siege-social": "guide-modification-siege-social.html",
  "/guide-fermeture-societe": "guide-fermeture-societe.html",
  "/demande": "demande.html",
  "/admin-leads": "admin-leads.html",
  "/auth": "auth.html",
  "/onboarding": "onboarding.html",
  "/dashboard": "dashboard.html",
  "/checkout": "checkout.html",
  "/checkout/success": "checkout-success.html",
  "/mentions-legales": "mentions-legales.html",
  "/cgv": "cgv.html",
  "/confidentialite": "confidentialite.html",
  "/comment-ca-marche": "comment-ca-marche.html",
  "/tarifs": "REDIRECT:/comment-ca-marche#prix",
  "/prix": "REDIRECT:/comment-ca-marche#prix",
  "/documents-juridiques": "documents-juridiques.html",
  "/formalites-juridiques": "documents-juridiques.html",
  "/guide-statut-juridique": "guide-statut-juridique.html",
  "/guide-rediger-statuts": "guide-rediger-statuts.html",
  "/guide-changement-gerant": "guide-changement-gerant.html",
  "/guide-modification-activite": "guide-modification-activite.html",
  "/guide-changement-denomination": "guide-changement-denomination.html",
  "/guide-fermeture-micro-entreprise": "guide-fermeture-micro-entreprise.html",
  "/guide-cessation-activite": "guide-cessation-activite.html",
  "/simulateur-couts": "simulateur-couts.html",
  "/quiz-statut-juridique": "quiz-statut-juridique.html",
  "/documents-gratuits": "documents-gratuits.html",
};

const PROTECTED_PAGES = new Set(["/onboarding", "/dashboard", "/checkout", "/checkout/success"]);

const PUBLIC_PAGES_FOR_SITEMAP = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/a-propos", priority: 0.6, changefreq: "monthly" },
  { path: "/creation-societe", priority: 0.9, changefreq: "weekly" },
  { path: "/modification-societe", priority: 0.9, changefreq: "weekly" },
  { path: "/fermeture-societe", priority: 0.9, changefreq: "weekly" },
  { path: "/guides", priority: 0.7, changefreq: "monthly" },
  { path: "/guide-creation-sasu", priority: 0.8, changefreq: "monthly" },
  { path: "/guide-modification-siege-social", priority: 0.8, changefreq: "monthly" },
  { path: "/guide-fermeture-societe", priority: 0.8, changefreq: "monthly" },
  { path: "/guide-fermeture-micro-entreprise", priority: 0.8, changefreq: "monthly" },
  { path: "/guide-statut-juridique", priority: 0.8, changefreq: "monthly" },
  { path: "/guide-rediger-statuts", priority: 0.8, changefreq: "monthly" },
  { path: "/guide-cessation-activite", priority: 0.8, changefreq: "monthly" },
  { path: "/guide-modification-activite", priority: 0.8, changefreq: "monthly" },
  { path: "/guide-changement-gerant", priority: 0.8, changefreq: "monthly" },
  { path: "/guide-changement-denomination", priority: 0.8, changefreq: "monthly" },
  { path: "/comment-ca-marche", priority: 0.7, changefreq: "monthly" },
  { path: "/documents-juridiques", priority: 0.7, changefreq: "monthly" },
  { path: "/formalites-juridiques", priority: 0.7, changefreq: "monthly" },
  { path: "/simulateur-couts", priority: 0.9, changefreq: "monthly" },
  { path: "/quiz-statut-juridique", priority: 0.9, changefreq: "monthly" },
  { path: "/documents-gratuits", priority: 0.8, changefreq: "monthly" },
  { path: "/mentions-legales", priority: 0.3, changefreq: "yearly" },
  { path: "/cgv", priority: 0.3, changefreq: "yearly" },
  { path: "/confidentialite", priority: 0.3, changefreq: "yearly" },
];

const SITE_URL = config.keybisUrl || "https://keybis.fr";

function generateSitemap() {
  const lastmod = new Date().toISOString().split("T")[0];
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const page of PUBLIC_PAGES_FOR_SITEMAP) {
    const url = `${SITE_URL}${page.path}`;
    xml += `  <url>\n`;
    xml += `    <loc>${url}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += '</urlset>';
  return xml;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

async function handleStatic(pathname, req, res) {
  if (pathname.startsWith("/assets/")) {
    const localPath = safePathJoin(
      path.join(config.frontendDir, "assets"),
      pathname.replace("/assets/", ""),
    );

    if (!localPath) return false;
    const isProduction = process.env.NODE_ENV === "production";
    const cacheHeader = isProduction
      ? "public, max-age=31536000, immutable"
      : "no-cache, no-store, must-revalidate";
    return serveFile(res, localPath, { "Cache-Control": cacheHeader }, req);
  }

  if (pathname === "/favicon.ico") {
    return serveFile(res, path.join(config.frontendDir, "assets", "images", "favicon.png"), {
      "Cache-Control": "public, max-age=31536000, immutable",
    }, req);
  }

  const pageFile = PAGE_ROUTES[pathname];
  if (!pageFile) return false;

  if (pageFile.startsWith("REDIRECT:")) {
    const target = pageFile.slice("REDIRECT:".length);
    res.writeHead(302, { Location: target });
    res.end();
    return true;
  }

  const fullPath = path.join(config.frontendDir, "pages", pageFile);
  const templateContext = {
    ...marketingShellContext(pathname),
    ...marketingSeoContext(pathname),
  };

  return serveHtmlTemplate(
    res,
    fullPath,
    { "Cache-Control": "public, max-age=3600" },
    templateContext,
    config.frontendDir,
    req,
  );
}

async function createServer() {
  await ensureDataStore();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const pathname = url.pathname;
      const method = (req.method || "GET").toUpperCase();

      setSecurityHeaders(res);

      // Redirection keybis.fr → www.keybis.fr
      const host = req.headers.host || "";
      if (host === "keybis.fr" || host === "keybis.fr:443") {
        res.writeHead(301, { Location: `https://www.keybis.fr${req.url}` });
        res.end();
        return;
      }

      if (method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
      }

      if (pathname === "/sitemap.xml" && method === "GET") {
        res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
        res.end(generateSitemap());
        return;
      }

      if (pathname === "/robots.txt" && method === "GET") {
        const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin-leads
Disallow: /dashboard
Disallow: /checkout
Disallow: /auth
Disallow: /onboarding
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml`;
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(robotsTxt);
        return;
      }

      const cookies = parseCookies(req);
      const sessionId = cookies[config.cookieName] || "";
      const user = await getUserFromSession(sessionId);

      if (PROTECTED_PAGES.has(pathname) && !user) {
        redirect(res, "/auth");
        return;
      }

      if (pathname === "/health" && method === "GET") {
        sendJson(res, 200, { ok: true, service: "keybis-platform" });
        return;
      }

      const context = {
        req,
        res,
        url,
        pathname,
        method,
        user,
        sessionId,
      };

      const apiHandlers = [
        handleLeadRoutes,
        handleAuthRoutes,
        handleOnboardingRoutes,
        handleDashboardRoutes,
        handlePaymentRoutes,
        handleFileRoutes,
        handleAnalyticsRoutes,
        handleToolRoutes,
      ];

      for (const handler of apiHandlers) {
        const handled = await handler(context);
        if (handled) return;
      }

      const staticHandled = await handleStatic(pathname, req, res);
      if (staticHandled) return;

      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" });
      const notFoundHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Page non trouvée | Keybis</title>
  <link rel="icon" type="image/png" href="/assets/images/favicon.png" />
  <link rel="stylesheet" href="/assets/css/acquisition.css" />
</head>
<body class="acq-body">
  <div class="acq-container" style="text-align: center; padding: 60px 20px;">
    <div class="acq-card" style="max-width: 500px; margin: 0 auto;">
      <h1 style="font-size: 3rem; margin-bottom: 20px;">404</h1>
      <p style="font-size: 1.25rem; margin-bottom: 30px; color: #666;">La page que vous recherchez n'existe pas ou a été supprimée.</p>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <a href="/" class="acq-btn acq-btn-primary">Retour à l'accueil</a>
        <a href="/creation-societe" class="acq-btn acq-btn-secondary">Créer une société</a>
        <a href="/modification-societe" class="acq-btn acq-btn-secondary">Modifier une société</a>
        <a href="/fermeture-societe" class="acq-btn acq-btn-secondary">Fermer une société</a>
        <a href="/guides" class="acq-btn acq-btn-ghost">Consulter les guides</a>
      </div>
    </div>
  </div>
</body>
</html>`;
      res.end(notFoundHtml);
    } catch (error) {
      console.error("[Keybis] request error", error);
      const wantsJson = String(req.headers.accept || "").includes("application/json")
        || String(req.url || "").startsWith("/api/");

      if (wantsJson) {
        sendJson(res, 500, { ok: false, error: "Erreur serveur inattendue" });
      } else {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>500</h1><p>Une erreur est survenue. Réessayez dans un instant.</p>");
      }
    }
  });

  server.listen(config.port, config.host, () => {
    console.log(`[Keybis] server running on http://${config.host}:${config.port}`);
  });
}

createServer().catch((error) => {
  console.error("[Keybis] server bootstrap error", error);
  process.exit(1);
});
