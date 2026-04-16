import { track } from "./core.js";

function wireCtas() {
  document.querySelectorAll("[data-cta]").forEach((button) => {
    button.addEventListener("click", async () => {
      await track("landing_cta_click", {
        cta: button.getAttribute("data-cta"),
      });
    });
  });
}

function wireFaq() {
  document.querySelectorAll("[data-faq-toggle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const panel = btn.nextElementSibling;
      if (!panel) return;
      panel.classList.toggle("hidden");
      await track("landing_faq_toggle", { question: btn.textContent?.trim() || "" });
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  wireCtas();
  wireFaq();
  await track("landing_page_view");
});
