import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

const COLLECTION_FILES = {
  users: "users.json",
  sessions: "sessions.json",
  dossiers: "dossiers.json",
  analytics: "analytics.json",
  leads: "leads.json",
};

function collectionPath(name) {
  const fileName = COLLECTION_FILES[name];
  if (!fileName) throw new Error(`Collection inconnue: ${name}`);
  return path.join(config.dataDir, fileName);
}

async function ensureJsonFile(filePath, initialValue = []) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(initialValue, null, 2), "utf-8");
  }
}

export async function ensureDataStore() {
  await fs.mkdir(config.dataDir, { recursive: true });
  await fs.mkdir(config.uploadsDir, { recursive: true });

  await Promise.all([
    ensureJsonFile(collectionPath("users"), []),
    ensureJsonFile(collectionPath("sessions"), []),
    ensureJsonFile(collectionPath("dossiers"), []),
    ensureJsonFile(collectionPath("analytics"), []),
    ensureJsonFile(collectionPath("leads"), []),
  ]);
}

export async function readCollection(name) {
  const filePath = collectionPath(name);
  const content = await fs.readFile(filePath, "utf-8");
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeCollection(name, value) {
  const filePath = collectionPath(name);
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf-8");
  await fs.rename(tempPath, filePath);
}

export async function mutateCollection(name, mutator) {
  const current = await readCollection(name);
  const next = await mutator(current);
  await writeCollection(name, next);
  return next;
}
