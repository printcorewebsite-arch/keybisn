import { config } from "../config.js";
import { createId } from "../utils/http.js";

function toAmountLabel(cents) {
  return `${(Number(cents || 0) / 100).toFixed(2)} €`;
}

async function createStripeCheckout({ dossier, user }) {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${config.stripeSuccessBaseUrl}?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", config.stripeCancelBaseUrl);
  body.set("customer_email", user.email);

  if (config.stripePriceId && config.stripePriceId.startsWith("price_")) {
    body.set("line_items[0][price]", config.stripePriceId);
    body.set("line_items[0][quantity]", "1");
  } else {
    body.set("line_items[0][price_data][currency]", "eur");
    body.set("line_items[0][price_data][product_data][name]", "Formalité Keybis");
    body.set("line_items[0][price_data][unit_amount]", String(dossier.payment.amountCents));
    body.set("line_items[0][quantity]", "1");
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const payload = await response.json();

  if (!response.ok || !payload.url || !payload.id) {
    throw new Error(payload?.error?.message || "Erreur Stripe Checkout");
  }

  return {
    mode: "stripe",
    checkoutSessionId: payload.id,
    checkoutUrl: payload.url,
  };
}

function createMockCheckout({ dossier }) {
  const sessionId = createId("chk");
  return {
    mode: "mock",
    checkoutSessionId: sessionId,
    checkoutUrl: `/checkout/success?session_id=${sessionId}`,
    amountLabel: toAmountLabel(dossier.payment.amountCents),
  };
}

export async function createCheckout({ dossier, user }) {
  if (config.paymentMode === "stripe" && config.stripeSecretKey) {
    return createStripeCheckout({ dossier, user });
  }

  return createMockCheckout({ dossier });
}
