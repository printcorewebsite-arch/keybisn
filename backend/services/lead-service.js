import { config } from "../config.js";
import { createId } from "../utils/http.js";
import { readCollection, writeCollection } from "./data-store.js";

const NEED_TYPES = new Set(["creation", "modification", "fermeture"]);
const VALID_PACKS = new Set(["basique", "express"]);
const LEAD_STATUSES = new Set(["new", "contacted"]);

const NEED_LABELS = {
  creation: "création de société",
  modification: "modification de société",
  fermeture: "fermeture de société",
};

const PACK_LABELS = {
  basique: "Basique",
  express: "Express",
};

const URGENCY_LABELS = {
  normal: "Normal",
  "48h": "Sous 48h",
  "24h": "Urgent (24h)",
};


function nowIso() {
  return new Date().toISOString();
}

function cleanText(value, maxLength = 300) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeNeedType(needType) {
  const value = cleanText(needType, 30).toLowerCase();
  return NEED_TYPES.has(value) ? value : "";
}

function normalizeStatus(status) {
  const value = cleanText(status, 20).toLowerCase();
  return LEAD_STATUSES.has(value) ? value : "";
}

function normalizeUrgency(urgency) {
  const value = cleanText(urgency, 20).toLowerCase();
  if (value === "24h") return "24h";
  if (value === "48h") return "48h";
  return "normal";
}

function normalizePack(pack) {
  const value = cleanText(pack, 20).toLowerCase();
  return VALID_PACKS.has(value) ? value : "";
}


function normalizeSource(source) {
  const current = source || {};
  return {
    page: cleanText(current.page, 120),
    referrer: cleanText(current.referrer, 240),
    utmSource: cleanText(current.utmSource, 80),
    utmMedium: cleanText(current.utmMedium, 80),
    utmCampaign: cleanText(current.utmCampaign, 80),
    utmTerm: cleanText(current.utmTerm, 80),
    utmContent: cleanText(current.utmContent, 80),
  };
}

function sourceKey(lead) {
  return cleanText(lead?.source?.utmSource || lead?.source?.referrer || "direct", 120) || "direct";
}

function buildWhatsappMessage(lead) {
  const lines = [
    `Bonjour, je souhaite une ${NEED_LABELS[lead.needType] || "demande juridique"}.`,
    ``,
    `Service : ${NEED_LABELS[lead.needType] || lead.needType}`,
    `Offre : ${lead.packLabel || "Non précisée"}`,
    ``,
    `Nom : ${lead.fullName}`,
    `Téléphone : ${lead.phone}`,
    `Email : ${lead.email}`,
  ];

  if (lead.activity) lines.push(`Activité / Formalité : ${lead.activity}`);
  if (lead.legalStatus) lines.push(`Statut / Forme : ${lead.legalStatus}`);
  if (lead.urgency && lead.urgency !== "normal") lines.push(`Urgence : ${URGENCY_LABELS[lead.urgency] || lead.urgency}`);
  if (lead.details) lines.push(`Infos complémentaires : ${lead.details}`);

  return lines.join("\n");
}

function whatsappUrlFromMessage(message) {
  const phone = String(config.whatsappNumber || "").replace(/\D/g, "");
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encoded}`;
}

export function leadWhatsappUrl(lead) {
  if (!lead) return "";
  if (lead.whatsappMessage) {
    return whatsappUrlFromMessage(lead.whatsappMessage);
  }
  return whatsappUrlFromMessage(buildWhatsappMessage(lead));
}

function validateLeadInput(input) {
  const fullName = cleanText(input.fullName, 120);
  const phone = cleanText(input.phone, 30);
  const email = cleanText(input.email, 160).toLowerCase();
  const needType = normalizeNeedType(input.needType);
  const urgency = normalizeUrgency(input.urgency);
  const pack = normalizePack(input.pack);
  const activity = cleanText(input.activity, 180);
  const legalStatus = cleanText(input.legalStatus, 120);
  const details = cleanText(input.details, 800);

  if (!fullName) throw new Error("Le nom est obligatoire");
  if (!phone) throw new Error("Le téléphone est obligatoire");
  if (!email || !email.includes("@")) throw new Error("Email invalide");
  if (!needType) throw new Error("Type de besoin invalide");

  return {
    fullName,
    phone,
    email,
    needType,
    urgency,
    pack,
    activity,
    legalStatus,
    details,
    source: normalizeSource(input.source),
  };
}

function normalizedSearchText(lead) {
  return [
    lead.fullName,
    lead.phone,
    lead.email,
    lead.needType,
    lead.pack,
    lead.packLabel,
    lead.activity,
    lead.legalStatus,
    lead.details,
    lead.source?.utmSource,
    lead.source?.utmCampaign,
  ]
    .map((value) => cleanText(value, 240).toLowerCase())
    .join(" ");
}

function filterLeads(leads, { status = "", needType = "", search = "", source = "" } = {}) {
  const normalizedStatus = normalizeStatus(status);
  const normalizedNeedType = normalizeNeedType(needType);
  const normalizedSearch = cleanText(search, 120).toLowerCase();
  const normalizedSource = cleanText(source, 120).toLowerCase();

  return leads.filter((lead) => {
    if (normalizedStatus && lead.status !== normalizedStatus) return false;
    if (normalizedNeedType && lead.needType !== normalizedNeedType) return false;

    if (normalizedSource) {
      const currentSource = sourceKey(lead).toLowerCase();
      if (!currentSource.includes(normalizedSource)) return false;
    }

    if (normalizedSearch) {
      const haystack = normalizedSearchText(lead);
      if (!haystack.includes(normalizedSearch)) return false;
    }

    return true;
  });
}

function sortByNewest(leads) {
  return leads
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createLead(input) {
  const payload = validateLeadInput(input);

  const lead = {
    id: createId("lead"),
    status: "new",
    fullName: payload.fullName,
    phone: payload.phone,
    email: payload.email,
    needType: payload.needType,
    urgency: payload.urgency,
    pack: payload.pack,
    packLabel: PACK_LABELS[payload.pack] || "",
    activity: payload.activity,
    legalStatus: payload.legalStatus,
    details: payload.details,
    source: payload.source,
    whatsappClickedAt: "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  // Note: estimateCents/estimateLabel supprimés — pas d'estimation de prix dans ce funnel.

  const message = buildWhatsappMessage(lead);
  lead.whatsappMessage = message;

  const leads = await readCollection("leads");
  leads.push(lead);
  await writeCollection("leads", leads);

  return {
    lead,
    whatsappMessage: message,
    whatsappUrl: whatsappUrlFromMessage(message),
  };
}

export async function listLeads(filters = {}) {
  const leads = await readCollection("leads");
  const filtered = filterLeads(leads, filters);
  return sortByNewest(filtered);
}

export async function getLeadStats(filters = {}) {
  const allLeads = await readCollection("leads");
  const filtered = filterLeads(allLeads, filters);

  const total = filtered.length;
  const newCount = filtered.filter((lead) => lead.status === "new").length;
  const contactedCount = filtered.filter((lead) => lead.status === "contacted").length;
  const whatsappClickedCount = filtered.filter((lead) => Boolean(lead.whatsappClickedAt)).length;

  const byNeedType = filtered.reduce((acc, lead) => {
    const key = lead.needType || "other";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const bySource = filtered.reduce((acc, lead) => {
    const key = sourceKey(lead);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const byPack = filtered.reduce((acc, lead) => {
    const key = lead.pack || "non_precise";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    total,
    newCount,
    contactedCount,
    whatsappClickedCount,
    whatsappClickRate: total ? Math.round((whatsappClickedCount / total) * 100) : 0,
    avgEstimateCents: 0,
    byNeedType,
    bySource,
    byPack,
    globalTotal: allLeads.length,
  };
}

export async function updateLeadStatus(leadId, status) {
  const normalizedStatus = normalizeStatus(status);
  if (!normalizedStatus) {
    throw new Error("Statut invalide");
  }

  const leads = await readCollection("leads");
  const index = leads.findIndex((item) => item.id === leadId);
  if (index === -1) return null;

  const updated = {
    ...leads[index],
    status: normalizedStatus,
    updatedAt: nowIso(),
  };

  leads[index] = updated;
  await writeCollection("leads", leads);
  return updated;
}

export async function markLeadWhatsappClicked(leadId) {
  const leads = await readCollection("leads");
  const index = leads.findIndex((item) => item.id === leadId);
  if (index === -1) return null;

  const updated = {
    ...leads[index],
    whatsappClickedAt: nowIso(),
    updatedAt: nowIso(),
  };

  leads[index] = updated;
  await writeCollection("leads", leads);
  return updated;
}
