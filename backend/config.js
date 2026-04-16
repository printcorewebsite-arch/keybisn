import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export const config = {
  appName: "Keybis",
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || "127.0.0.1",
  projectRoot,
  frontendDir: path.join(projectRoot, "frontend"),
  dataDir: path.join(projectRoot, "data"),
  uploadsDir: path.join(projectRoot, "storage", "uploads"),
  cookieName: "keybis_session",
  sessionTtlMs: 1000 * 60 * 60 * 24 * 7,
  secureCookies: process.env.KEYBIS_SECURE_COOKIES === "true" || process.env.NODE_ENV === "production",
  whatsappNumber: process.env.KEYBIS_WHATSAPP_NUMBER || "33780954094",
  adminLeadKey: process.env.KEYBIS_ADMIN_KEY || "keybis-admin",
  paymentMode: process.env.KEYBIS_PAYMENT_MODE || "mock",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripePriceId: process.env.STRIPE_PRICE_ID || "price_keybis_v1",
  stripeSuccessBaseUrl: process.env.STRIPE_SUCCESS_BASE_URL || "http://localhost:3000/checkout/success",
  stripeCancelBaseUrl: process.env.STRIPE_CANCEL_BASE_URL || "http://localhost:3000/checkout?payment=cancelled",
};
