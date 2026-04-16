/**
 * scheduler.js — Orchestrateur principal qui tourne en continu.
 *
 * Planifie automatiquement :
 * - Scan Reddit (2x/jour) pour trouver des opportunites
 * - Generation de contenu (selon les quotas)
 * - Publication aux heures optimales
 * - Collecte des stats de performance
 *
 * Usage:
 *   node src/scheduler.js          # lance le scheduler
 *   DRY_RUN=true node src/scheduler.js  # mode test
 */
import cron from "node-cron";
import { config } from "./config.js";
import * as db from "./database.js";
import { publishNext } from "./publisher.js";
import { generatePost } from "./content-generator.js";

console.log(`
╔══════════════════════════════════════════════╗
║     🤖 KEYBIS REDDIT ENGINE — Scheduler     ║
║     Mode: ${config.publishing.dryRun ? "DRY RUN 🔸" : "LIVE 🟢    "}                        ║
║     Max posts/jour: ${config.publishing.maxPostsPerDay}                        ║
╚══════════════════════════════════════════════╝
`);

// ── CRON 1: Scan Reddit (8h et 18h) ──
cron.schedule("0 8,18 * * *", async () => {
  console.log("\n🔍 [CRON] Scan Reddit programme...");
  try {
    // Import dynamique pour eviter le chargement au demarrage
    const { default: scraper } = await import("./scraper.js");
    // Le scraper s'execute automatiquement via son import
  } catch (err) {
    console.error("[CRON] Erreur scan:", err.message);
  }
}, { timezone: "Europe/Paris" });

// ── CRON 2: Generation de contenu (7h30) ──
// Genere les posts du jour a l'avance
cron.schedule("30 7 * * *", async () => {
  console.log("\n📝 [CRON] Generation du contenu du jour...");
  const todayPosts = db.getPostsToday();
  const remaining = config.publishing.maxPostsPerDay - todayPosts;

  for (let i = 0; i < remaining; i++) {
    try {
      const post = await generatePost();
      if (post) {
        // Calculer l'heure de publication
        const window = config.publishWindows[i % config.publishWindows.length];
        const hour = window.start;
        const minute = Math.floor(Math.random() * 50) + 5; // 05-55 min
        const scheduledTime = new Date();
        scheduledTime.setHours(hour, minute, 0, 0);

        db.addToQueue(post.id, scheduledTime.toISOString());
        console.log(`   ✅ Post #${post.id} programme a ${hour}h${String(minute).padStart(2, "0")}`);
      }
      // Delai entre generations pour ne pas surcharger le LLM
      await sleep(5000);
    } catch (err) {
      console.error(`   ❌ Erreur generation #${i + 1}:`, err.message);
    }
  }
}, { timezone: "Europe/Paris" });

// ── CRON 3: Publication (toutes les 30 min pendant les fenetres) ──
cron.schedule("*/30 8-22 * * *", async () => {
  const queued = db.getNextInQueue();
  if (!queued) return;

  const scheduledTime = new Date(queued.scheduled_at);
  const now = new Date();

  if (now >= scheduledTime) {
    console.log(`\n📤 [CRON] Publication programmee detectee...`);
    try {
      await publishNext();
    } catch (err) {
      console.error("[CRON] Erreur publication:", err.message);
    }
  }
}, { timezone: "Europe/Paris" });

// ── CRON 4: Rapport quotidien (23h) ──
cron.schedule("0 23 * * *", () => {
  console.log("\n📊 [CRON] Rapport quotidien");
  console.log("═".repeat(40));

  const todayPosts = db.getPostsToday();
  const ratio = db.getRecentKeybisRatio(7);
  const perf = db.getPerformanceReport(7);

  console.log(`Posts publies aujourd'hui: ${todayPosts}`);
  console.log(`Ratio mentions Keybis (7j): ${(ratio * 100).toFixed(0)}%`);

  if (perf.length > 0) {
    console.log("\nPerformance par sub (7 derniers jours):");
    for (const row of perf) {
      console.log(`   ${row.subreddit} | ${row.posts} posts | avg score: ${row.avg_score?.toFixed(1)} | avg comments: ${row.avg_comments?.toFixed(1)}`);
    }
  }
}, { timezone: "Europe/Paris" });

// ── CRON 5: Nettoyage hebdomadaire (dimanche 3h) ──
cron.schedule("0 3 * * 0", () => {
  console.log("\n🧹 [CRON] Nettoyage hebdomadaire...");
  // Supprimer les threads scraped de plus de 30 jours
  db.db.prepare(`DELETE FROM scraped_threads WHERE scraped_at < datetime('now', '-30 days')`).run();
  console.log("   ✅ Anciens threads supprimes");
}, { timezone: "Europe/Paris" });

// ── Affichage initial ──
const todayCount = db.getPostsToday();
const keybisRatio = db.getRecentKeybisRatio(7);
console.log(`📊 Etat actuel:`);
console.log(`   Posts aujourd'hui: ${todayCount}/${config.publishing.maxPostsPerDay}`);
console.log(`   Ratio Keybis (7j): ${(keybisRatio * 100).toFixed(0)}%`);
console.log(`\n⏳ Scheduler actif. En attente des crons...\n`);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
