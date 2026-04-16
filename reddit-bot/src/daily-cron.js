/**
 * daily-cron.js — Envoi automatique quotidien sur Telegram a 11h.
 *
 * Lance ce script en arriere-plan, il tourne en continu
 * et envoie 10 posts chaque jour a 11h00 (heure FR).
 *
 * Usage:
 *   node src/daily-cron.js                  # lance le cron
 *   nohup node src/daily-cron.js &          # lance en arriere-plan
 */
import cron from "node-cron";
import { sendDailyPosts } from "./telegram.js";

console.log(`
╔══════════════════════════════════════════════╗
║  🤖 KEYBIS REDDIT → TELEGRAM                ║
║  Envoi automatique : chaque jour a 11h00     ║
║  Posts par envoi : 10 (dont 3 avec Keybis)   ║
╚══════════════════════════════════════════════╝
`);

// Envoi chaque jour a 11h00 heure de Paris
cron.schedule("0 11 * * *", async () => {
  console.log(`\n🕚 [${new Date().toLocaleString("fr-FR")}] Lancement de l'envoi quotidien...`);
  try {
    await sendDailyPosts(10);
    console.log("✅ Envoi quotidien termine !");
  } catch (err) {
    console.error("❌ Erreur envoi quotidien:", err.message);
  }
}, { timezone: "Europe/Paris" });

console.log("⏳ En attente du prochain envoi (11h00)...");
console.log("   Pour tester maintenant : node src/index.js telegram\n");
