import { api, authStatus, escapeHtml, formatCurrency, notify, qs, statusClass, statusLabel, track } from "./core.js";

let currentDashboard = null;
let selectedUploadFile = null;

function reviewMeta(status = "pending") {
  if (status === "validated") {
    return { label: "Validé", className: "validated" };
  }
  if (status === "rejected") {
    return { label: "Refusé", className: "rejected" };
  }
  return { label: "En attente", className: "pending" };
}

function eventLabel(eventType = "") {
  const labels = {
    dossier_created: "Dossier créé",
    onboarding_step_saved: "Étape onboarding sauvegardée",
    onboarding_completed: "Onboarding finalisé",
    checkout_created: "Session de paiement créée",
    payment_paid: "Paiement confirmé",
    payment_failed: "Paiement échoué",
    document_uploaded: "Document ajouté",
    support_message: "Message support envoyé",
  };
  return labels[eventType] || "Mise à jour dossier";
}

function renderStatus(dossier) {
  const statusNode = qs("#status-pill");
  if (statusNode) {
    statusNode.className = `status-pill ${statusClass(dossier.status)}`;
    statusNode.textContent = statusLabel(dossier.status);
  }

  const progress = Number(dossier.progress || 0);
  const fill = qs("#dashboard-progress-fill");
  if (fill) fill.style.width = `${progress}%`;

  const progressValue = qs("#dashboard-progress-value");
  if (progressValue) progressValue.textContent = `${progress}%`;

  const amountNode = qs("#dashboard-amount");
  if (amountNode) amountNode.textContent = formatCurrency(dossier.payment?.amountCents || 0);
}

function renderChecklist(dossier) {
  const target = qs("#checklist-list");
  if (!target) return;

  const items = dossier.checklist || [];
  target.innerHTML = items
    .map((item) => `
      <div class="list-item">
        <span>${item.done ? "✅" : "⏳"} ${escapeHtml(item.label)}</span>
      </div>
    `)
    .join("");
}

function renderDocuments(dossier) {
  const target = qs("#docs-list");
  if (!target) return;

  const items = dossier.documents || [];
  if (!items.length) {
    target.innerHTML = '<div class="list-item"><span>Aucun document pour le moment.</span></div>';
    return;
  }

  target.innerHTML = items
    .map((doc) => {
      const meta = reviewMeta(doc.reviewStatus);
      return `
        <div class="list-item wrap">
          <div style="display:flex; width:100%; justify-content:space-between; gap:8px; align-items:center;">
            <strong>${escapeHtml(doc.name)}</strong>
            <span class="doc-status ${meta.className}">${meta.label}</span>
          </div>
          <div class="small-muted">${escapeHtml(doc.reviewNote || "Document ajouté")}</div>
          <div style="display:flex; gap:8px;">
            <a class="btn btn-ghost" href="${escapeHtml(doc.downloadPath)}">Télécharger</a>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMessages(dossier) {
  const target = qs("#messages-box");
  if (!target) return;

  const messages = dossier.messages || [];
  if (!messages.length) {
    target.innerHTML = '<p class="helper">Aucun message.</p>';
    return;
  }

  target.innerHTML = messages
    .map((msg) => {
      const from = escapeHtml(msg.from || "system");
      const text = escapeHtml(msg.text || "");
      const createdAt = new Date(msg.createdAt).toLocaleString("fr-FR");
      return `<div class="msg ${from}"><strong>${from}</strong> · ${createdAt}<br />${text}</div>`;
    })
    .join("");

  target.scrollTop = target.scrollHeight;
}

function renderHistory(dossier) {
  const target = qs("#history-list");
  if (!target) return;

  const history = (dossier.history || []).slice().reverse().slice(0, 8);
  if (!history.length) {
    target.innerHTML = '<div class="list-item"><span>Aucun historique.</span></div>';
    return;
  }

  target.innerHTML = history
    .map((item) => `
      <div class="list-item">
        <span>${escapeHtml(item.note || eventLabel(item.type))}</span>
        <span class="small-muted">${new Date(item.createdAt).toLocaleDateString("fr-FR")}</span>
      </div>
    `)
    .join("");
}

function renderTimeline(dossier) {
  const target = qs("#timeline-list");
  if (!target) return;

  const steps = dossier.checklist || [];
  if (!steps.length) {
    target.innerHTML = '<div class="timeline-item"><strong>Aucune étape</strong><br /><small>Le timeline se remplit au fil de votre progression.</small></div>';
    return;
  }

  const firstPendingIndex = steps.findIndex((item) => !item.done);

  target.innerHTML = steps
    .map((item, index) => {
      const visualState = item.done
        ? "is-done"
        : (firstPendingIndex === -1 || index === firstPendingIndex ? "is-current" : "is-next");

      return `
      <div class="timeline-item ${visualState}">
        <strong>${escapeHtml(item.label || "Étape")}</strong><br />
        <small>${item.done ? "Terminé" : visualState === "is-current" ? "En cours" : "À venir"}</small>
      </div>
    `;
    })
    .join("");
}

function renderNotifications(insights = {}) {
  const target = qs("#notifications-list");
  if (!target) return;

  const notifications = insights.notifications || [];
  if (!notifications.length) {
    target.innerHTML = '<div class="notification info"><strong>Tout est bon</strong><br />Aucune action urgente requise.</div>';
    return;
  }

  target.innerHTML = notifications
    .map((item) => `
      <div class="notification ${escapeHtml(item.level || "info")}">
        <strong>${escapeHtml(item.title || "Notification")}</strong><br />
        <span class="small-muted">${escapeHtml(item.message || "")}</span>
        ${item.actionPath && item.actionLabel
    ? `<div style="margin-top:8px;"><a class="btn btn-ghost" href="${escapeHtml(item.actionPath)}">${escapeHtml(item.actionLabel)}</a></div>`
    : ""}
      </div>
    `)
    .join("");
}

function renderActions(payload) {
  const target = qs("#action-list");
  if (!target) return;

  const actions = payload?.insights?.actions || [];
  if (!actions.length) {
    target.innerHTML = `
      <div class="list-item">
        <span>Consultez votre dashboard pour suivre les prochaines étapes.</span>
        <a class="btn btn-ghost" href="/checkout">Voir le paiement</a>
      </div>
    `;
    return;
  }

  target.innerHTML = actions
    .slice(0, 4)
    .map((action) => `
      <div class="list-item">
        <span>${escapeHtml(action.label)}</span>
        <a class="btn btn-ghost" href="${escapeHtml(action.path)}">Ouvrir</a>
      </div>
    `)
    .join("");
}

function updatePaymentButton(dossier) {
  const payBtn = qs("#pay-btn");
  if (!payBtn) return;

  if (!dossier.onboarding?.completed) {
    payBtn.disabled = true;
    payBtn.textContent = "Terminer l'onboarding";
    return;
  }

  if (dossier.payment?.status === "paid") {
    payBtn.disabled = true;
    payBtn.textContent = "Paiement confirmé";
    return;
  }

  payBtn.disabled = false;
  payBtn.textContent = dossier.payment?.status === "failed"
    ? "Réessayer le paiement"
    : "Finaliser le paiement";
}

function renderDashboard(payload) {
  const { user, dossier } = payload;
  currentDashboard = payload;

  const username = qs("#dashboard-user-name");
  if (username) username.textContent = user.fullName;

  renderStatus(dossier);
  renderChecklist(dossier);
  renderDocuments(dossier);
  renderMessages(dossier);
  renderHistory(dossier);
  renderTimeline(dossier);
  renderNotifications(payload.insights || {});
  renderActions(payload);
  updatePaymentButton(dossier);
}

async function refreshDashboard() {
  const payload = await api("/api/dashboard", { method: "GET" });
  renderDashboard(payload);
}

function updateDropzoneLabel() {
  const zone = qs("#upload");
  if (!zone) return;

  const strong = zone.querySelector("strong");
  if (!strong) return;

  if (!selectedUploadFile) {
    strong.textContent = "Glissez-déposez votre fichier ici";
    return;
  }

  strong.textContent = `Fichier sélectionné: ${selectedUploadFile.name}`;
}

function wireDropzone() {
  const zone = qs("#upload");
  const fileInput = qs("#file-input");
  if (!zone || !fileInput) return;

  zone.addEventListener("click", () => fileInput.click());
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", () => {
    selectedUploadFile = fileInput.files?.[0] || null;
    updateDropzoneLabel();
  });

  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragover");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("dragover");
  });

  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragover");

    const file = event.dataTransfer?.files?.[0] || null;
    if (!file) return;

    selectedUploadFile = file;
    updateDropzoneLabel();
  });

  qs("#upload-reset-btn")?.addEventListener("click", () => {
    selectedUploadFile = null;
    fileInput.value = "";
    updateDropzoneLabel();
  });

  updateDropzoneLabel();
}

function getSelectedFile() {
  if (selectedUploadFile) return selectedUploadFile;
  const fileInput = qs("#file-input");
  return fileInput?.files?.[0] || null;
}

async function onUploadSubmit(form, noticeNode) {
  const file = getSelectedFile();
  if (!file) {
    notify(noticeNode, "Sélectionnez un fichier à uploader.", "error");
    return;
  }

  const base64Content = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  await api("/api/files/upload", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      base64Content,
    }),
  });

  notify(noticeNode, "Document uploadé avec succès.", "success");
  await track("document_uploaded", { fileName: file.name });
  form.reset();
  selectedUploadFile = null;
  updateDropzoneLabel();
  await refreshDashboard();
}

async function onMessageSubmit(noticeNode) {
  const input = qs("#message-input");
  const message = input?.value.trim() || "";
  if (!message) {
    notify(noticeNode, "Entrez un message avant envoi.", "error");
    return;
  }

  await api("/api/dashboard/message", {
    method: "POST",
    body: JSON.stringify({ message }),
  });

  if (input) input.value = "";
  notify(noticeNode, "Message envoyé.", "success");
  await track("support_message_sent");
  await refreshDashboard();
}

async function bootstrap() {
  const notice = qs("#dashboard-notice");

  const status = await authStatus();
  if (!status.authenticated) {
    window.location.href = "/auth";
    return;
  }

  await refreshDashboard();
  wireDropzone();

  qs("#pay-btn")?.addEventListener("click", async () => {
    await track("dashboard_pay_cta_click", {
      paymentStatus: currentDashboard?.dossier?.payment?.status || "unknown",
    });
    window.location.href = "/checkout";
  });

  qs("#upload-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await onUploadSubmit(event.currentTarget, notice);
    } catch (error) {
      notify(notice, error.message || "Upload impossible", "error");
    }
  });

  qs("#message-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await onMessageSubmit(notice);
    } catch (error) {
      notify(notice, error.message || "Message impossible", "error");
    }
  });

  qs("#logout-btn")?.addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    window.location.href = "/";
  });

  await track("dashboard_page_view", {
    dossierStatus: currentDashboard?.dossier?.status || "",
    paymentStatus: currentDashboard?.dossier?.payment?.status || "",
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrap().catch((error) => {
    notify(qs("#dashboard-notice"), error.message || "Impossible de charger le dashboard", "error");
  });
});
