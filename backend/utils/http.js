import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";

const gzip = promisify(zlib.gzip);

const COMPRESSIBLE_TYPES = new Set([
  "text/html",
  "text/css",
  "application/javascript",
  "application/json",
  "image/svg+xml",
  "application/xml",
]);

function isCompressible(contentType) {
  return COMPRESSIBLE_TYPES.has((contentType || "").split(";")[0].trim());
}

function acceptsGzip(req) {
  return (req?.headers?.["accept-encoding"] || "").includes("gzip");
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

export function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

export function sendError(res, statusCode, message, details = undefined) {
  sendJson(res, statusCode, {
    ok: false,
    error: message,
    ...(details ? { details } : {}),
  });
}

export function parseCookies(req) {
  const raw = req.headers.cookie;
  if (!raw) return {};

  return raw.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
}

export function setCookie(res, name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  parts.push(`Path=${options.path || "/"}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");

  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearCookie(res, name) {
  res.setHeader("Set-Cookie", `${name}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax`);
}

export async function readJsonBody(req, maxSize = 1_000_000) {
  let raw = "";

  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > maxSize) {
      throw new Error("Corps de requête trop volumineux");
    }
  }

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("JSON invalide");
  }
}

export function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

export async function serveFile(res, filePath, customHeaders = {}, req = null) {
  try {
    const content = await fs.readFile(filePath);
    const contentType = getContentType(filePath);
    const headers = {
      "Content-Type": contentType,
      ...customHeaders,
    };

    if (req && acceptsGzip(req) && isCompressible(contentType) && content.length > 1024) {
      const compressed = await gzip(content);
      headers["Content-Encoding"] = "gzip";
      headers["Content-Length"] = compressed.length;
      headers["Vary"] = "Accept-Encoding";
      res.writeHead(200, headers);
      res.end(compressed);
    } else {
      headers["Content-Length"] = content.length;
      res.writeHead(200, headers);
      res.end(content);
    }
    return true;
  } catch {
    return false;
  }
}

const INCLUDE_PATTERN = /{{\s*include:([a-zA-Z0-9_./-]+)\s*}}/g;
const VAR_PATTERN = /{{\s*var:([a-zA-Z0-9_.-]+)\s*}}/g;
const MAX_TEMPLATE_DEPTH = 8;

async function replaceAsync(input, pattern, resolver) {
  const values = [];
  input.replace(pattern, (...args) => {
    values.push(resolver(...args));
    return "";
  });

  const resolved = await Promise.all(values);
  let cursor = 0;
  return input.replace(pattern, () => resolved[cursor++] || "");
}

function isInsideRoot(candidatePath, rootPath) {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

async function renderHtmlTemplate(filePath, templateContext = {}, includeRoot = null, depth = 0) {
  if (depth > MAX_TEMPLATE_DEPTH) {
    throw new Error(`Template include depth exceeded for ${filePath}`);
  }

  let content = await fs.readFile(filePath, "utf8");
  const baseDir = path.dirname(filePath);
  const root = includeRoot ? path.resolve(includeRoot) : path.resolve(baseDir);

  content = await replaceAsync(content, INCLUDE_PATTERN, async (_full, includePathRaw) => {
    const includePath = path.resolve(baseDir, includePathRaw);
    if (!isInsideRoot(includePath, root)) return "";

    try {
      return await renderHtmlTemplate(includePath, templateContext, root, depth + 1);
    } catch {
      return "";
    }
  });

  content = content.replace(VAR_PATTERN, (_full, key) => {
    const value = templateContext[key];
    if (value === null || value === undefined) return "";
    return String(value);
  });

  return content;
}

export async function serveHtmlTemplate(
  res,
  filePath,
  customHeaders = {},
  templateContext = {},
  includeRoot = null,
  req = null,
) {
  try {
    const html = await renderHtmlTemplate(filePath, templateContext, includeRoot);
    const content = Buffer.from(html, "utf8");

    const headers = {
      "Content-Type": "text/html; charset=utf-8",
      ...customHeaders,
    };

    if (req && acceptsGzip(req) && content.length > 1024) {
      const compressed = await gzip(content);
      headers["Content-Encoding"] = "gzip";
      headers["Content-Length"] = compressed.length;
      headers["Vary"] = "Accept-Encoding";
      res.writeHead(200, headers);
      res.end(compressed);
    } else {
      headers["Content-Length"] = content.length;
      res.writeHead(200, headers);
      res.end(content);
    }
    return true;
  } catch {
    return false;
  }
}

export function safePathJoin(basePath, targetPath) {
  const normalizedTarget = path.normalize(String(targetPath || "")).replace(/^([/\\])+/, "");
  const resolved = path.resolve(basePath, normalizedTarget);
  const normalizedBase = path.resolve(basePath);

  const isInsideBase = resolved === normalizedBase || resolved.startsWith(`${normalizedBase}${path.sep}`);
  if (!isInsideBase) {
    return null;
  }

  return resolved;
}

export function sanitizeFilename(input) {
  const cleaned = input.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return cleaned.slice(0, 120) || "document";
}

export function createId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
