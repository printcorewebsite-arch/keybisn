import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { createId, sanitizeFilename } from "../utils/http.js";
import { readCollection, writeCollection } from "./data-store.js";

function nowIso() {
  return new Date().toISOString();
}

function emptyOnboarding() {
  return {
    currentStep: 1,
    completed: false,
    companyType: "",
    activity: "",
    activityDetails: "",
    associatesCount: 0,
    associatesNames: [],
    options: {
      domiciliation: false,
      accounting: false,
      prioritySupport: false,
      trademark: false,
    },
  };
}

function calculateBaseAmount(companyType) {
  if (!companyType) return 39900;
  if (companyType === "micro") return 2900;
  return 39900;
}

function calculateAmountCents(onboarding) {
  const base = calculateBaseAmount(onboarding.companyType);
  let total = base;

  const options = onboarding.options || {};
  if (options.domiciliation) total += 4900;
  if (options.accounting) total += 9900;
  if (options.prioritySupport) total += 6900;
  if (options.trademark) total += 12900;

  return total;
}

function hasAcceptedUpload(documents = []) {
  return documents.some((doc) => doc.kind === "uploaded" && doc.reviewStatus !== "rejected");
}

function hasRejectedUpload(documents = []) {
  return documents.some((doc) => doc.kind === "uploaded" && doc.reviewStatus === "rejected");
}

function hasPendingUpload(documents = []) {
  return documents.some((doc) => doc.kind === "uploaded" && doc.reviewStatus === "pending");
}

function buildChecklist(onboarding = emptyOnboarding(), paymentStatus = "unpaid", documents = []) {
  return [
    {
      id: "check_onboarding",
      label: "Questionnaire onboarding complété",
      done: Boolean(onboarding.completed),
    },
    {
      id: "check_payment",
      label: "Paiement de la formalité validé",
      done: paymentStatus === "paid",
    },
    {
      id: "check_documents",
      label: "Documents justificatifs uploadés",
      done: hasAcceptedUpload(documents),
    },
    {
      id: "check_review",
      label: "Relecture conformité par Keybis",
      done: false,
    },
    {
      id: "check_submission",
      label: "Dépôt officiel du dossier",
      done: false,
    },
  ];
}

function buildNotifications(dossier) {
  const notifications = [];
  const documents = dossier.documents || [];
  const paymentStatus = dossier.payment?.status || "unpaid";

  if (!dossier.onboarding?.completed) {
    notifications.push({
      id: "notif_onboarding",
      level: "info",
      title: "Onboarding incomplet",
      message: "Complétez votre questionnaire pour structurer correctement le dossier.",
      actionLabel: "Continuer l'onboarding",
      actionPath: "/onboarding",
    });
  }

  if (dossier.onboarding?.completed && paymentStatus !== "paid") {
    notifications.push({
      id: "notif_payment",
      level: paymentStatus === "failed" ? "error" : "warning",
      title: paymentStatus === "failed" ? "Paiement échoué" : "Paiement en attente",
      message: paymentStatus === "failed"
        ? "Le paiement n'a pas été validé. Réessayez pour lancer le traitement."
        : "Le traitement commence dès validation du paiement.",
      actionLabel: "Finaliser le paiement",
      actionPath: "/checkout",
    });
  }

  if (!documents.some((doc) => doc.kind === "uploaded")) {
    notifications.push({
      id: "notif_missing_docs",
      level: "warning",
      title: "Document manquant",
      message: "Ajoutez au moins un justificatif pour accélérer la vérification expert.",
      actionLabel: "Uploader un document",
      actionPath: "/dashboard#upload",
    });
  }

  if (hasRejectedUpload(documents)) {
    notifications.push({
      id: "notif_rejected_doc",
      level: "error",
      title: "Document refusé",
      message: "Un document doit être remplacé (format/qualité insuffisante).",
      actionLabel: "Remplacer le document",
      actionPath: "/dashboard#upload",
    });
  }

  if (hasPendingUpload(documents)) {
    notifications.push({
      id: "notif_pending_doc",
      level: "info",
      title: "Vérification en cours",
      message: "Un document est en attente de validation par un expert Keybis.",
      actionLabel: "Voir les documents",
      actionPath: "/dashboard#documents",
    });
  }

  return notifications;
}

export function buildDossierInsights(dossier) {
  const notifications = buildNotifications(dossier);
  const actions = notifications
    .filter((item) => item.actionPath && item.actionLabel)
    .map((item) => ({
      id: `${item.id}_action`,
      label: item.actionLabel,
      path: item.actionPath,
      level: item.level,
    }));

  return {
    notifications,
    actions,
  };
}

function initialDossier(userId) {
  const onboarding = emptyOnboarding();
  const paymentStatus = "unpaid";
  const documents = [];
  return {
    id: createId("dos"),
    userId,
    status: "draft",
    progress: 10,
    onboarding,
    checklist: buildChecklist(onboarding, paymentStatus, documents),
    payment: {
      status: paymentStatus,
      amountCents: 39900,
      currency: "EUR",
      checkoutSessionId: "",
      paidAt: "",
    },
    documents,
    messages: [
      {
        id: createId("msg"),
        from: "system",
        text: "Bienvenue sur Keybis. Complétez l'onboarding pour générer votre dossier.",
        createdAt: nowIso(),
      },
    ],
    history: [
      {
        id: createId("evt"),
        type: "dossier_created",
        note: "Dossier initialisé",
        createdAt: nowIso(),
      },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function applyStepData(onboarding, step, data) {
  const next = { ...onboarding };

  if (step === 1) {
    next.companyType = String(data.companyType || "").trim();
  }

  if (step === 2) {
    next.activity = String(data.activity || "").trim();
    next.activityDetails = String(data.activityDetails || "").trim();
  }

  if (step === 3) {
    const count = Number(data.associatesCount || 0);
    next.associatesCount = Number.isFinite(count) ? Math.max(0, Math.min(10, count)) : 0;
    next.associatesNames = Array.isArray(data.associatesNames)
      ? data.associatesNames.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 10)
      : [];
  }

  if (step === 4) {
    const options = data.options || {};
    next.options = {
      domiciliation: Boolean(options.domiciliation),
      accounting: Boolean(options.accounting),
      prioritySupport: Boolean(options.prioritySupport),
      trademark: Boolean(options.trademark),
    };
  }

  next.currentStep = Math.max(next.currentStep || 1, step);
  return next;
}

function progressForStep(step, completed = false, paymentStatus = "unpaid") {
  if (paymentStatus === "paid") return 70;
  if (completed) return 55;

  if (step <= 1) return 20;
  if (step === 2) return 30;
  if (step === 3) return 40;
  return 50;
}

async function persistDossier(nextDossier) {
  const dossiers = await readCollection("dossiers");
  const index = dossiers.findIndex((entry) => entry.id === nextDossier.id);
  if (index === -1) dossiers.push(nextDossier);
  else dossiers[index] = nextDossier;
  await writeCollection("dossiers", dossiers);
}

export async function getOrCreateDossierByUserId(userId) {
  const dossiers = await readCollection("dossiers");
  const existing = dossiers.find((entry) => entry.userId === userId);
  if (existing) return existing;

  const created = initialDossier(userId);
  dossiers.push(created);
  await writeCollection("dossiers", dossiers);
  return created;
}

export async function saveOnboardingStep(userId, step, data) {
  const dossier = await getOrCreateDossierByUserId(userId);
  const existingDocuments = Array.isArray(dossier.documents) ? dossier.documents : [];
  const onboarding = applyStepData(dossier.onboarding || emptyOnboarding(), step, data);

  const next = {
    ...dossier,
    onboarding,
    payment: {
      ...dossier.payment,
      amountCents: calculateAmountCents(onboarding),
    },
    checklist: buildChecklist(onboarding, dossier.payment?.status || "unpaid", existingDocuments),
    progress: progressForStep(step, onboarding.completed, dossier.payment?.status || "unpaid"),
    updatedAt: nowIso(),
    history: [
      ...(dossier.history || []),
      {
        id: createId("evt"),
        type: "onboarding_step_saved",
        note: `Étape ${step} sauvegardée`,
        createdAt: nowIso(),
      },
    ],
  };

  await persistDossier(next);
  return next;
}

function buildGeneratedFiles(dossier) {
  const onboarding = dossier.onboarding || emptyOnboarding();
  const options = onboarding.options || {};

  return [
    {
      name: "brief-dossier-keybis.txt",
      content: [
        `Dossier: ${dossier.id}`,
        `Type de société: ${onboarding.companyType || "non renseigné"}`,
        `Activité: ${onboarding.activity || "non renseignée"}`,
        `Associés: ${onboarding.associatesCount || 0}`,
        `Options: ${Object.entries(options)
          .filter(([, value]) => Boolean(value))
          .map(([key]) => key)
          .join(", ") || "aucune"}`,
      ].join("\n"),
    },
    {
      name: "checklist-conformite.txt",
      content: [
        "Checklist conformité Keybis:",
        "1. Vérifier pièces d'identité",
        "2. Vérifier justificatif de domiciliation",
        "3. Vérifier cohérence statuts / activité",
        "4. Valider dépôt officiel",
      ].join("\n"),
    },
    {
      name: "simulation-process.txt",
      content: [
        "Timeline estimative:",
        "- Cadrage: J0",
        "- Validation des pièces: J0-J1",
        "- Préparation dépôt: J1-J2",
        "- Dépôt officiel: J2",
      ].join("\n"),
    },
  ];
}

async function ensureDossierDirectory(userId, dossierId) {
  const directory = path.join(config.uploadsDir, userId, dossierId);
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

export async function completeOnboarding(userId) {
  const dossier = await getOrCreateDossierByUserId(userId);
  const onboarding = {
    ...dossier.onboarding,
    completed: true,
    currentStep: 4,
  };

  const directory = await ensureDossierDirectory(userId, dossier.id);
  const generatedFiles = buildGeneratedFiles({ ...dossier, onboarding });

  const generatedDocuments = [];
  for (const file of generatedFiles) {
    const id = createId("doc");
    const filename = sanitizeFilename(file.name);
    const storedPath = path.join(directory, `${id}_${filename}`);
    await fs.writeFile(storedPath, file.content, "utf-8");

    generatedDocuments.push({
      id,
      name: file.name,
      kind: "generated",
      reviewStatus: "validated",
      reviewNote: "Document généré automatiquement par Keybis.",
      mimeType: "text/plain",
      size: Buffer.byteLength(file.content),
      storedPath,
      downloadPath: `/api/files/${id}`,
      createdAt: nowIso(),
    });
  }

  const existingDocs = Array.isArray(dossier.documents) ? dossier.documents : [];
  const keepNonGenerated = existingDocs.filter((doc) => doc.kind !== "generated");

  const next = {
    ...dossier,
    onboarding,
    status: dossier.payment?.status === "paid" ? "processing" : "pending_payment",
    progress: progressForStep(4, true, dossier.payment?.status || "unpaid"),
    payment: {
      ...dossier.payment,
      amountCents: calculateAmountCents(onboarding),
    },
    checklist: buildChecklist(onboarding, dossier.payment?.status || "unpaid", [...keepNonGenerated, ...generatedDocuments]),
    documents: [...keepNonGenerated, ...generatedDocuments],
    history: [
      ...(dossier.history || []),
      {
        id: createId("evt"),
        type: "onboarding_completed",
        note: "Onboarding finalisé",
        createdAt: nowIso(),
      },
    ],
    updatedAt: nowIso(),
  };

  await persistDossier(next);
  return next;
}

export async function addUploadedDocument(userId, { fileName, mimeType, base64Content }) {
  const dossier = await getOrCreateDossierByUserId(userId);

  const safeName = sanitizeFilename(fileName || "document.bin");
  const cleanBase64 = String(base64Content || "").replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");

  if (!buffer.length) {
    throw new Error("Fichier vide");
  }

  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error("Fichier trop volumineux (max 8MB)");
  }

  const directory = await ensureDossierDirectory(userId, dossier.id);
  const id = createId("doc");
  const storedPath = path.join(directory, `${id}_${safeName}`);
  await fs.writeFile(storedPath, buffer);

  const normalizedMime = String(mimeType || "application/octet-stream").toLowerCase();
  const blockedMimes = new Set([
    "application/x-msdownload",
    "application/x-dosexec",
    "application/java-archive",
  ]);
  let reviewStatus = "pending";
  let reviewNote = "Document reçu. Vérification expert en cours.";

  if (blockedMimes.has(normalizedMime)) {
    reviewStatus = "rejected";
    reviewNote = "Format non accepté. Merci d'envoyer un PDF ou une image.";
  } else if (normalizedMime === "application/pdf" || normalizedMime.startsWith("image/")) {
    reviewStatus = "validated";
    reviewNote = "Pré-vérification automatique effectuée.";
  }

  const document = {
    id,
    name: fileName,
    kind: "uploaded",
    reviewStatus,
    reviewNote,
    mimeType: normalizedMime,
    size: buffer.length,
    storedPath,
    downloadPath: `/api/files/${id}`,
    createdAt: nowIso(),
  };

  const nextDocuments = [...(dossier.documents || []), document];
  const nextChecklist = buildChecklist(
    dossier.onboarding || emptyOnboarding(),
    dossier.payment?.status || "unpaid",
    nextDocuments,
  );

  const next = {
    ...dossier,
    documents: nextDocuments,
    checklist: nextChecklist,
    progress: Math.max(dossier.progress || 0, 75),
    history: [
      ...(dossier.history || []),
      {
        id: createId("evt"),
        type: "document_uploaded",
        note: `${fileName} uploadé`,
        createdAt: nowIso(),
      },
    ],
    updatedAt: nowIso(),
  };

  await persistDossier(next);
  return { dossier: next, document };
}

export async function addSupportMessage(userId, text, from = "client") {
  const dossier = await getOrCreateDossierByUserId(userId);

  const message = {
    id: createId("msg"),
    from,
    text: String(text || "").trim(),
    createdAt: nowIso(),
  };

  if (!message.text) {
    throw new Error("Message vide");
  }

  const autoReply = {
    id: createId("msg"),
    from: "support",
    text: "Merci pour votre message. Un expert Keybis vous répond rapidement.",
    createdAt: nowIso(),
  };

  const next = {
    ...dossier,
    messages: [...(dossier.messages || []), message, autoReply],
    history: [
      ...(dossier.history || []),
      {
        id: createId("evt"),
        type: "support_message",
        note: "Nouveau message client",
        createdAt: nowIso(),
      },
    ],
    updatedAt: nowIso(),
  };

  await persistDossier(next);
  return next;
}

export async function markPaymentCreated(userId, checkoutSessionId) {
  const dossier = await getOrCreateDossierByUserId(userId);
  const nextPaymentStatus = dossier.payment?.status === "paid" ? "paid" : "pending";

  const next = {
    ...dossier,
    status: nextPaymentStatus === "paid" ? dossier.status : "pending_payment",
    payment: {
      ...dossier.payment,
      status: nextPaymentStatus,
      checkoutSessionId,
    },
    history: [
      ...(dossier.history || []),
      {
        id: createId("evt"),
        type: "checkout_created",
        note: `Session ${checkoutSessionId}`,
        createdAt: nowIso(),
      },
    ],
    updatedAt: nowIso(),
  };

  await persistDossier(next);
  return next;
}

export async function markPaymentPaidBySession(userId, checkoutSessionId) {
  const dossier = await getOrCreateDossierByUserId(userId);

  if (!checkoutSessionId || dossier.payment?.checkoutSessionId !== checkoutSessionId) {
    return null;
  }

  const checklist = (dossier.checklist || []).map((item) =>
    item.id === "check_payment" ? { ...item, done: true } : item,
  );

  const next = {
    ...dossier,
    status: "processing",
    progress: Math.max(dossier.progress || 0, 80),
    checklist,
    payment: {
      ...dossier.payment,
      status: "paid",
      paidAt: nowIso(),
    },
    history: [
      ...(dossier.history || []),
      {
        id: createId("evt"),
        type: "payment_paid",
        note: "Paiement confirmé",
        createdAt: nowIso(),
      },
    ],
    updatedAt: nowIso(),
  };

  await persistDossier(next);
  return next;
}

export async function markPaymentFailedBySession(userId, checkoutSessionId) {
  const dossier = await getOrCreateDossierByUserId(userId);

  if (!checkoutSessionId || dossier.payment?.checkoutSessionId !== checkoutSessionId) {
    return null;
  }

  const next = {
    ...dossier,
    status: "pending_payment",
    payment: {
      ...dossier.payment,
      status: "failed",
    },
    history: [
      ...(dossier.history || []),
      {
        id: createId("evt"),
        type: "payment_failed",
        note: "Paiement échoué",
        createdAt: nowIso(),
      },
    ],
    updatedAt: nowIso(),
  };

  await persistDossier(next);
  return next;
}

export async function findDocumentForUser(userId, documentId) {
  const dossier = await getOrCreateDossierByUserId(userId);
  const document = (dossier.documents || []).find((entry) => entry.id === documentId);
  if (!document) return null;
  return { dossier, document };
}
