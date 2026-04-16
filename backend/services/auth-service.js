import crypto from "node:crypto";
import { config } from "../config.js";
import { createId } from "../utils/http.js";
import { readCollection, writeCollection } from "./data-store.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export async function registerUser({ fullName, email, password }) {
  const normalizedEmail = normalizeEmail(email);
  if (!fullName || !normalizedEmail || !password) {
    throw new Error("Informations incomplètes");
  }

  if (String(password).length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères");
  }

  const users = await readCollection("users");
  const existing = users.find((user) => user.email === normalizedEmail);
  if (existing) {
    throw new Error("Cet email est déjà utilisé");
  }

  const user = {
    id: createId("usr"),
    fullName: String(fullName).trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  await writeCollection("users", users);
  return sanitizeUser(user);
}

export async function loginUser({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const users = await readCollection("users");

  const user = users.find((entry) => entry.email === normalizedEmail);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Email ou mot de passe invalide");
  }

  return sanitizeUser(user);
}

export async function createSession(userId) {
  const sessions = await readCollection("sessions");
  const now = Date.now();

  const session = {
    id: createId("sess"),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + config.sessionTtlMs).toISOString(),
  };

  const activeSessions = sessions.filter((entry) => new Date(entry.expiresAt).getTime() > now);
  activeSessions.push(session);
  await writeCollection("sessions", activeSessions);
  return session;
}

export async function deleteSession(sessionId) {
  if (!sessionId) return;
  const sessions = await readCollection("sessions");
  const next = sessions.filter((entry) => entry.id !== sessionId);
  await writeCollection("sessions", next);
}

export async function getUserFromSession(sessionId) {
  if (!sessionId) return null;

  const now = Date.now();
  const sessions = await readCollection("sessions");
  const validSessions = sessions.filter((entry) => new Date(entry.expiresAt).getTime() > now);

  if (validSessions.length !== sessions.length) {
    await writeCollection("sessions", validSessions);
  }

  const session = validSessions.find((entry) => entry.id === sessionId);
  if (!session) return null;

  const users = await readCollection("users");
  const user = users.find((entry) => entry.id === session.userId);
  if (!user) return null;

  return sanitizeUser(user);
}
