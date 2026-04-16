/**
 * index.js — Point d'entree principal du Keybis Reddit Engine.
 *
 * Commandes :
 *   node src/index.js start       → Lance le scheduler complet
 *   node src/index.js generate    → Genere un post (preview)
 *   node src/index.js publish     → Publie le prochain post
 *   node src/index.js scrape      → Scan Reddit pour opportunites
 *   node src/index.js analyze     → Rapport de performance
 *   node src/index.js status      → Etat actuel du systeme
 *   node src/index.js help        → Aide
 */
import { config } from "./config.js";
import * as db from "./database.js";

const command = process.argv[2] || "help";

const HELP = `
╔══════════════════════════════════════════════════════════╗
║          🤖 KEYBIS REDDIT ENGINE v1.0                    ║
║          Systeme semi-automatise de content marketing     ║
╚══════════════════════════════════════════════════════════╝

COMMANDES :

  start       Lance le scheduler (tourne en continu)
  generate    Genere un post et l'affiche (sans publier)
  telegram    Genere 10 posts et les envoie sur Telegram
  publish     Publie le prochain post en queue
  scrape      Scanne Reddit pour trouver des opportunites
  analyze     Rapport de performance complet
  status      Etat actuel (quotas, ratio, queue)
  help        Affiche cette aide

CONFIGURATION :
  Copiez .env.example en .env et remplissez vos identifiants.
  DRY_RUN=true par defaut (aucune publication reelle).

PREMIER LANCEMENT :
  1. npm install
  2. cp .env.example .env
  3. Editez .env avec vos identifiants Reddit + LLM
  4. node src/index.js generate    (testez la generation)
  5. node src/index.js scrape      (scannez Reddit)
  6. DRY_RUN=false node src/index.js publish  (publiez)
  7. node src/index.js start       (lancez le scheduler)
`;

async function main() {
  switch (command) {
    case "start":
      await import("./scheduler.js");
      break;

    case "generate": {
      const { generatePost } = await import("./content-generator.js");
      const post = await generatePost();
      if (post?.body) {
        console.log("\n" + "═".repeat(60));
        console.log(`TITRE: ${post.title}`);
        console.log(`SUB: ${post.subreddit}`);
        console.log(`FORMAT: ${post.formatType}`);
        console.log(`KEYBIS: ${post.mentionsKeybis ? "oui" : "non"}`);
        console.log("═".repeat(60));
        console.log(post.body);
        console.log("═".repeat(60));
      }
      break;
    }

    case "telegram": {
      const { sendDailyPosts } = await import("./telegram.js");
      const count = Number(process.argv[3]) || 10;
      await sendDailyPosts(count);
      break;
    }

    case "publish": {
      const { publishNext } = await import("./publisher.js");
      await publishNext();
      break;
    }

    case "scrape": {
      await import("./scraper.js");
      break;
    }

    case "analyze": {
      const analyzer = await import("./analyzer.js");
      break;
    }

    case "status": {
      const todayPosts = db.getPostsToday();
      const ratio = db.getRecentKeybisRatio(7);
      const queue = db.db.prepare(`
        SELECT COUNT(*) as count FROM queue WHERE status = 'pending'
      `).get();
      const totalPublished = db.db.prepare(`
        SELECT COUNT(*) as count FROM posts WHERE status = 'published'
      `).get();
      const drafts = db.db.prepare(`
        SELECT COUNT(*) as count FROM posts WHERE status = 'draft'
      `).get();

      console.log(`\n📊 STATUT DU SYSTEME`);
      console.log("═".repeat(40));
      console.log(`Mode:              ${config.publishing.dryRun ? "DRY RUN 🔸" : "LIVE 🟢"}`);
      console.log(`Posts aujourd'hui:  ${todayPosts}/${config.publishing.maxPostsPerDay}`);
      console.log(`Total publies:     ${totalPublished.count}`);
      console.log(`Brouillons:        ${drafts.count}`);
      console.log(`En queue:          ${queue.count}`);
      console.log(`Ratio Keybis (7j): ${(ratio * 100).toFixed(0)}% (max: ${(config.publishing.keybisMentionRatio * 100).toFixed(0)}%)`);
      console.log("═".repeat(40));
      break;
    }

    case "help":
    default:
      console.log(HELP);
  }
}

main().catch(err => {
  console.error("❌ Erreur fatale:", err);
  process.exit(1);
});
