import { track } from "./core.js";

function wireCtaTracking() {
  document.querySelectorAll("[data-cta]").forEach((node) => {
    node.addEventListener("click", async () => {
      await track("acq_cta_click", {
        cta: node.getAttribute("data-cta") || "",
        pageType: document.body.dataset.pageType || "",
      });
    });
  });
}

function wireHeaderMenu() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.getElementById("acq-mobile-menu");
  if (!toggle || !menu) return;

  const closeMenu = () => {
    menu.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!menu.classList.contains("open")) return;
    if (menu.contains(target) || toggle.contains(target)) return;
    closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}

function wireStickyTracking() {
  document.querySelectorAll(".acq-mobile-sticky-wrap a").forEach((node) => {
    node.addEventListener("click", async () => {
      await track("acq_mobile_sticky_click", {
        pageType: document.body.dataset.pageType || "",
      });
    });
  });
}

function wireFaqTracking() {
  document.querySelectorAll("details[data-faq]").forEach((node) => {
    node.addEventListener("toggle", async () => {
      if (!node.open) return;
      await track("acq_faq_open", {
        question: node.querySelector("summary")?.textContent?.trim() || "",
        pageType: document.body.dataset.pageType || "",
      });
    });
  });
}

function wireNavTracking() {
  document.querySelectorAll("[data-nav]").forEach((node) => {
    node.addEventListener("click", async () => {
      await track("acq_nav_click", {
        nav: node.getAttribute("data-nav") || "",
        pageType: document.body.dataset.pageType || "",
      });
    });
  });
}

/**
 * Animation d'apparition des blocs de réassurance (.acq-trust-band).
 * Utilise IntersectionObserver + stagger JS pour déclencher au scroll,
 * nettoie les styles inline après transition pour que le hover CSS reste propre.
 * Respecte prefers-reduced-motion.
 */
function wireTrustBandAnimation() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const band = document.querySelector(".acq-trust-band");
  if (!band) return;

  const pills = Array.from(band.querySelectorAll(".acq-trust-pill"));
  if (!pills.length) return;

  // Masquer les cartes avant leur entrée dans le viewport
  pills.forEach((pill) => {
    pill.style.opacity = "0";
    pill.style.transform = "translateY(14px)";
  });

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();

      const isMobile = window.innerWidth <= 760;
      const staggerDelay = isMobile ? 60 : 110;
      const duration = isMobile ? "0.35s" : "0.52s";

      pills.forEach((pill, i) => {
        setTimeout(() => {
          // Appliquer transition + état final
          pill.style.transition =
            `opacity ${duration} cubic-bezier(0.22, 1, 0.36, 1), ` +
            `transform ${duration} cubic-bezier(0.22, 1, 0.36, 1)`;
          pill.style.opacity = "1";
          pill.style.transform = "translateY(0)";

          // Nettoyer les styles inline dès la fin : le hover CSS prend le relais
          pill.addEventListener(
            "transitionend",
            () => {
              pill.style.removeProperty("opacity");
              pill.style.removeProperty("transform");
              pill.style.removeProperty("transition");
            },
            { once: true }
          );
        }, i * staggerDelay);
      });
    },
    { threshold: 0.2 }
  );

  observer.observe(band);
}

/**
 * Utilitaire générique : anime au scroll les éléments correspondant à `selector`
 * en ajoutant la classe `acq-visible` via IntersectionObserver.
 * Le stagger est géré côté CSS (transition-delay selon nth-child / data-*).
 * Respecte prefers-reduced-motion (la CSS rend déjà les éléments visibles dans ce cas).
 */
function wireScrollReveal(selector, threshold = 0.15) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const items = Array.from(document.querySelectorAll(selector));
  if (!items.length) return;

  // Lower threshold on mobile for earlier, more fluid reveals
  const isMobile = window.innerWidth <= 760;
  const effectiveThreshold = isMobile ? Math.min(threshold, 0.08) : threshold;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        requestAnimationFrame(() => entry.target.classList.add("acq-visible"));
      });
    },
    { threshold: effectiveThreshold }
  );

  items.forEach((item) => observer.observe(item));
}

/** Animation benefit cards (section #benefices) */
function wireBenefitCardsAnimation() {
  wireScrollReveal(".acq-benefit-card", 0.15);
}

/** Animation process steps (section #process) */
function wireProcessAnimation() {
  wireScrollReveal(".acq-process-step-premium", 0.12);
}

/** Animation générique pour tous les éléments .acq-scroll-reveal (checklist, etc.) */
function wireGenericScrollReveal() {
  wireScrollReveal(".acq-scroll-reveal", 0.2);
  wireScrollReveal(".acq-faq-list", 0.15);
}

/**
 * Smart sticky CTA :
 * - Apparaît après 300px de scroll (pas immédiatement)
 * - Disparaît quand le final CTA est visible (évite la redondance)
 * - Transition smooth entrée/sortie
 */
function wireSmartSticky() {
  const sticky = document.querySelector(".acq-mobile-sticky-wrap");
  if (!sticky) return;

  // On ne touche pas au display initial (géré par le media query)
  // On utilise opacity + transform pour l'animation
  sticky.style.transition = "opacity 0.3s ease, transform 0.3s ease";
  sticky.style.opacity = "0";
  sticky.style.transform = "translateY(100%)";
  sticky.style.pointerEvents = "none";

  let isVisible = false;
  const SHOW_THRESHOLD = 300;

  const finalCta = document.querySelector(".acq-cta-banner, .acq-final-cta-v2");

  function show() {
    if (isVisible) return;
    isVisible = true;
    sticky.style.opacity = "1";
    sticky.style.transform = "translateY(0)";
    sticky.style.pointerEvents = "auto";
  }

  function hide() {
    if (!isVisible) return;
    isVisible = false;
    sticky.style.opacity = "0";
    sticky.style.transform = "translateY(100%)";
    sticky.style.pointerEvents = "none";
  }

  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollY = window.scrollY;

      if (scrollY < SHOW_THRESHOLD) {
        hide();
      } else if (finalCta) {
        const rect = finalCta.getBoundingClientRect();
        // Hide when final CTA is visible in viewport
        if (rect.top < window.innerHeight - 60 && rect.bottom > 0) {
          hide();
        } else {
          show();
        }
      } else {
        show();
      }
      ticking = false;
    });
  }, { passive: true });
}

document.addEventListener("DOMContentLoaded", async () => {
  wireHeaderMenu();
  wireCtaTracking();
  wireStickyTracking();
  wireNavTracking();
  wireFaqTracking();
  wireTrustBandAnimation();
  wireBenefitCardsAnimation();
  wireProcessAnimation();
  wireGenericScrollReveal();
  wireSmartSticky();
  await track("acq_page_view", {
    pageType: document.body.dataset.pageType || "",
  });
});
