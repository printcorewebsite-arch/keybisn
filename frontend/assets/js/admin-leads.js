import { api, escapeHtml, formatCurrency, track } from "./core.js";

const STORAGE_KEY = "keybis_admin_key_v1";

const state = {
  adminKey: "",
  leads: [],
  selectedLeadId: "",
  stats: null,
};
let searchTimer = null;

function getStoredKey() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function setStoredKey(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // storage non disponible
  }
}

function clearStoredKey() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage non disponible
  }
}

function qs(selector) {
  return document.querySelector(selector);
}

function getStatusClass(status) {
  return status === "contacted" ? "contacted" : "new";
}

function showNotice(message, type = "error") {
  const target = qs("#admin-notice");
  if (!target) return;
  target.className = `acq-notice ${type}`;
  target.textContent = message;
}

function clearNotice() {
  const target = qs("#admin-notice");
  if (!target) return;
  target.className = "acq-notice acq-hidden";
  target.textContent = "";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("fr-FR");
}

async function adminApi(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    "x-admin-key": state.adminKey,
  };

  return api(path, {
    ...options,
    headers,
  });
}

function selectedLead() {
  return state.leads.find((lead) => lead.id === state.selectedLeadId) || null;
}

function renderStats() {
  const stats = state.stats;
  if (!stats) return;

  const set = (id, value) => {
    const node = qs(id);
    if (node) node.textContent = value;
  };

  set("#stat-total", String(stats.total || 0));
  set("#stat-global", String(stats.globalTotal || 0));
  set("#stat-new", String(stats.newCount || 0));
  set("#stat-contacted", String(stats.contactedCount || 0));
  set("#stat-wa-rate", `${Number(stats.whatsappClickRate || 0)}%`);
  // Calcul du pack le plus fréquent
  const packBreakdown = stats.byPack || {};
  const packEntries = Object.entries(packBreakdown).sort((a, b) => b[1] - a[1]);
  const topPack = packEntries[0] ? `${packEntries[0][0]} (${packEntries[0][1]})` : "-";
  set("#stat-avg", topPack);
}

function refreshSourceFilter() {
  const select = qs("#source-filter");
  if (!select || !state.stats) return;

  const currentValue = select.value || "";
  const sourceEntries = Object.entries(state.stats.bySource || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  const options = ['<option value="">Toutes les sources</option>']
    .concat(
      sourceEntries.map(
        ([key, count]) => `<option value="${escapeHtml(key)}">${escapeHtml(key)} (${count})</option>`,
      ),
    )
    .join("");

  select.innerHTML = options;
  select.value = sourceEntries.some(([key]) => key === currentValue) ? currentValue : "";
}

function renderDetails() {
  const lead = selectedLead();
  const empty = qs("#lead-empty");
  const details = qs("#lead-detail-content");

  if (!lead) {
    empty?.classList.remove("acq-hidden");
    details?.classList.add("acq-hidden");
    return;
  }

  empty?.classList.add("acq-hidden");
  details?.classList.remove("acq-hidden");

  const set = (id, value) => {
    const node = qs(id);
    if (node) node.textContent = value || "-";
  };

  set("#detail-name", lead.fullName);
  set("#detail-phone", lead.phone);
  set("#detail-email", lead.email);
  set("#detail-need", lead.needType);
  set("#detail-activity", lead.activity);
  set("#detail-status", lead.legalStatus);
  set("#detail-urgency", lead.urgency);
  set("#detail-price", lead.packLabel || "-");
  set("#detail-created", formatDate(lead.createdAt));
  set("#detail-whatsapp", formatDate(lead.whatsappClickedAt));
  set("#detail-details", lead.details || "-");
  set("#detail-source", lead.sourceLabel || "direct");

  const badge = qs("#detail-lead-status");
  if (badge) {
    badge.className = `acq-status ${getStatusClass(lead.status)}`;
    badge.textContent = lead.status === "contacted" ? "Contacté" : "Nouveau";
  }

  const toggleBtn = qs("#toggle-status-btn");
  if (toggleBtn) {
    toggleBtn.textContent = lead.status === "contacted" ? "Marquer Nouveau" : "Marquer Contacté";
  }
}

function renderLeads() {
  const tbody = qs("#leads-tbody");
  if (!tbody) return;

  if (!state.leads.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">Aucun lead trouvé avec ces filtres.</td>
      </tr>
    `;
    renderDetails();
    return;
  }

  tbody.innerHTML = state.leads
    .map((lead) => `
      <tr data-lead-id="${escapeHtml(lead.id)}">
        <td>${escapeHtml(formatDate(lead.createdAt))}</td>
        <td>${escapeHtml(lead.fullName)}</td>
        <td>${escapeHtml(lead.needType)}</td>
        <td>${escapeHtml(lead.phone)}</td>
        <td>${escapeHtml(lead.sourceLabel || "direct")}</td>
        <td>${escapeHtml(lead.packLabel || "-")}</td>
        <td><span class="acq-status ${getStatusClass(lead.status)}">${lead.status === "contacted" ? "Contacté" : "Nouveau"}</span></td>
        <td>
          <div class="acq-table-actions">
            <button class="acq-btn acq-btn-ghost acq-btn-sm" data-open-lead="${escapeHtml(lead.id)}" type="button">Voir</button>
            <button class="acq-btn acq-btn-secondary acq-btn-sm" data-copy-phone="${escapeHtml(lead.id)}" type="button">Copier</button>
            <button class="acq-btn acq-btn-primary acq-btn-sm" data-open-wa="${escapeHtml(lead.id)}" type="button">WhatsApp</button>
          </div>
        </td>
      </tr>
    `)
    .join("");

  renderDetails();
}

function queryFromFilters() {
  const params = new URLSearchParams();
  const status = qs("#lead-filter")?.value || "";
  const needType = qs("#need-filter")?.value || "";
  const source = qs("#source-filter")?.value || "";
  const search = qs("#lead-search")?.value.trim() || "";

  if (status) params.set("status", status);
  if (needType) params.set("needType", needType);
  if (source) params.set("source", source);
  if (search) params.set("search", search);

  const query = params.toString();
  return query ? `?${query}` : "";
}

async function loadLeads() {
  const query = queryFromFilters();
  const result = await adminApi(`/api/leads${query}`, { method: "GET" });

  state.leads = result.leads || [];
  state.stats = result.stats || null;

  if (!state.selectedLeadId && state.leads[0]) {
    state.selectedLeadId = state.leads[0].id;
  }
  if (state.selectedLeadId && !state.leads.some((lead) => lead.id === state.selectedLeadId)) {
    state.selectedLeadId = state.leads[0]?.id || "";
  }

  renderStats();
  refreshSourceFilter();
  renderLeads();
}

function openApp() {
  qs("#admin-auth-panel")?.classList.add("acq-hidden");
  qs("#admin-app")?.classList.remove("acq-hidden");
}

function closeApp() {
  state.adminKey = "";
  state.leads = [];
  state.selectedLeadId = "";
  state.stats = null;
  clearStoredKey();
  const keyInput = qs("#admin-key");
  if (keyInput) keyInput.value = "";
  qs("#admin-app")?.classList.add("acq-hidden");
  qs("#admin-auth-panel")?.classList.remove("acq-hidden");
  clearNotice();
}

async function authenticate(event) {
  event.preventDefault();
  clearNotice();

  const input = qs("#admin-key");
  const key = input?.value.trim() || "";
  if (!key) {
    showNotice("Clé admin requise.");
    return;
  }

  state.adminKey = key;

  try {
    await loadLeads();
    setStoredKey(key);
    openApp();
    await track("admin_leads_login_success");
  } catch (error) {
    showNotice(error.message || "Accès admin refusé.");
    state.adminKey = "";
    await track("admin_leads_login_error", { message: error.message || "unknown" });
  }
}

async function toggleLeadStatus() {
  const lead = selectedLead();
  if (!lead) return;

  const nextStatus = lead.status === "contacted" ? "new" : "contacted";
  clearNotice();

  try {
    await adminApi(`/api/leads/${lead.id}/status`, {
      method: "POST",
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadLeads();
    showNotice("Statut mis à jour.", "success");
    await track("admin_lead_status_updated", {
      leadId: lead.id,
      status: nextStatus,
    });
  } catch (error) {
    showNotice(error.message || "Impossible de mettre à jour ce lead.");
  }
}

async function copyPhone(lead) {
  if (!lead?.phone) return;

  try {
    await navigator.clipboard.writeText(lead.phone);
    showNotice("Numéro copié.", "success");
  } catch {
    showNotice("Copie impossible sur ce navigateur.");
  }
}

async function openLeadWhatsapp(lead) {
  if (!lead?.whatsappUrl) return;

  try {
    await api(`/api/leads/${lead.id}/whatsapp`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch {
    // non bloquant
  }

  await track("admin_lead_open_whatsapp", {
    leadId: lead.id,
    needType: lead.needType,
  });

  window.open(lead.whatsappUrl, "_blank", "noopener,noreferrer");
}

function wireFilters() {
  ["#lead-filter", "#need-filter", "#source-filter"].forEach((selector) => {
    qs(selector)?.addEventListener("change", async () => {
      try {
        await loadLeads();
      } catch (error) {
        showNotice(error.message || "Filtre impossible");
      }
    });
  });

  qs("#lead-search")?.addEventListener("input", async () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      try {
        await loadLeads();
      } catch (error) {
        showNotice(error.message || "Recherche impossible");
      }
    }, 250);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  qs("#admin-key-form")?.addEventListener("submit", authenticate);
  qs("#refresh-btn")?.addEventListener("click", async () => {
    clearNotice();
    try {
      await loadLeads();
      await track("admin_leads_refresh");
    } catch (error) {
      showNotice(error.message || "Impossible de charger les leads.");
    }
  });
  wireFilters();

  qs("#toggle-status-btn")?.addEventListener("click", toggleLeadStatus);
  qs("#logout-admin-btn")?.addEventListener("click", closeApp);

  qs("#copy-phone-btn")?.addEventListener("click", async () => {
    const lead = selectedLead();
    await copyPhone(lead);
  });

  qs("#open-whatsapp-btn")?.addEventListener("click", async () => {
    const lead = selectedLead();
    await openLeadWhatsapp(lead);
  });

  qs("#leads-tbody")?.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const openId = target.getAttribute("data-open-lead");
    if (openId) {
      state.selectedLeadId = openId;
      renderDetails();
      return;
    }

    const copyId = target.getAttribute("data-copy-phone");
    if (copyId) {
      const lead = state.leads.find((item) => item.id === copyId);
      await copyPhone(lead);
      return;
    }

    const waId = target.getAttribute("data-open-wa");
    if (waId) {
      const lead = state.leads.find((item) => item.id === waId);
      await openLeadWhatsapp(lead);
    }
  });

  const existingKey = getStoredKey();
  if (existingKey) {
    state.adminKey = existingKey;
    try {
      await loadLeads();
      openApp();
    } catch {
      closeApp();
    }
  }

  await track("admin_leads_page_view");
});
