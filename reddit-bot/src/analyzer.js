/**
 * analyzer.js — Analyse de performance et optimisation automatique.
 *
 * Collecte les stats des posts publies (score, commentaires),
 * identifie les formats/subs les plus performants, et ajuste
 * la strategie en consequence.
 *
 * Usage:
 *   node src/analyzer.js               # rapport complet
 *   node src/analyzer.js --update      # met a jour les scores depuis Reddit
 */
import { config } from "./config.js";
import * as db from "./database.js";
import * as reddit from "./reddit-client.js";

// ── Mettre a jour les scores des posts publies ──
async function updateScores() {
  const posts = db.db.prepare(`
    SELECT id, reddit_post_id, subreddit FROM posts
    WHERE status = 'published' AND reddit_post_id IS NOT NULL
    AND published_at >= datetime('now', '-30 days')
  `).all();

  console.log(`\n🔄 Mise a jour des scores de ${posts.length} posts...\n`);

  let updated = 0;
  for (const post of posts) {
    try {
      const r = reddit.getClient();
      const submission = await r.getSubmission(post.reddit_post_id).fetch();

      db.db.prepare(`
        UPDATE posts SET score = ?, num_comments = ? WHERE id = ?
      `).run(submission.score, submission.num_comments, post.id);

      console.log(`   [${submission.score}↑ ${submission.num_comments}💬] ${post.subreddit}`);
      updated++;

      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`   ⚠️ Erreur sur post ${post.id}: ${err.message}`);
    }
  }

  console.log(`\n✅ ${updated} posts mis a jour`);
}

// ── Rapport de performance ──
function generateReport() {
  console.log("\n" + "═".repeat(60));
  console.log("   📊 RAPPORT DE PERFORMANCE KEYBIS REDDIT ENGINE");
  console.log("═".repeat(60));

  // 1. Stats globales
  const global = db.db.prepare(`
    SELECT
      COUNT(*) as total_posts,
      SUM(score) as total_score,
      SUM(num_comments) as total_comments,
      AVG(score) as avg_score,
      AVG(num_comments) as avg_comments,
      SUM(mentions_keybis) as total_mentions
    FROM posts WHERE status = 'published'
  `).get();

  console.log(`\n📈 Stats globales:`);
  console.log(`   Posts publies: ${global.total_posts}`);
  console.log(`   Score total: ${global.total_score || 0}`);
  console.log(`   Commentaires total: ${global.total_comments || 0}`);
  console.log(`   Score moyen: ${(global.avg_score || 0).toFixed(1)}`);
  console.log(`   Commentaires moyen: ${(global.avg_comments || 0).toFixed(1)}`);
  console.log(`   Mentions Keybis: ${global.total_mentions || 0} (${global.total_posts ? ((global.total_mentions / global.total_posts) * 100).toFixed(0) : 0}%)`);

  // 2. Performance par subreddit
  const bySub = db.db.prepare(`
    SELECT
      subreddit,
      COUNT(*) as posts,
      AVG(score) as avg_score,
      AVG(num_comments) as avg_comments,
      MAX(score) as best_score
    FROM posts WHERE status = 'published'
    GROUP BY subreddit ORDER BY avg_score DESC
  `).all();

  console.log(`\n🏆 Performance par subreddit:`);
  for (const row of bySub) {
    const bar = "█".repeat(Math.min(20, Math.round(row.avg_score || 0)));
    console.log(`   ${row.subreddit.padEnd(25)} ${bar} avg:${(row.avg_score || 0).toFixed(1)} | best:${row.best_score || 0} | ${row.posts} posts`);
  }

  // 3. Performance par format
  const byFormat = db.db.prepare(`
    SELECT
      format_type,
      COUNT(*) as posts,
      AVG(score) as avg_score,
      AVG(num_comments) as avg_comments
    FROM posts WHERE status = 'published'
    GROUP BY format_type ORDER BY avg_score DESC
  `).all();

  console.log(`\n🎯 Performance par format:`);
  for (const row of byFormat) {
    console.log(`   ${row.format_type.padEnd(25)} avg_score:${(row.avg_score || 0).toFixed(1)} | avg_comments:${(row.avg_comments || 0).toFixed(1)} | ${row.posts} posts`);
  }

  // 4. Meilleurs posts
  const topPosts = db.db.prepare(`
    SELECT title, subreddit, score, num_comments, format_type, mentions_keybis
    FROM posts WHERE status = 'published'
    ORDER BY score DESC LIMIT 5
  `).all();

  if (topPosts.length > 0) {
    console.log(`\n⭐ Top 5 posts:`);
    for (const [i, p] of topPosts.entries()) {
      console.log(`   ${i + 1}. [${p.score}↑ ${p.num_comments}💬] ${p.title.slice(0, 60)}...`);
      console.log(`      └─ ${p.subreddit} | ${p.format_type} | keybis: ${p.mentions_keybis ? "oui" : "non"}`);
    }
  }

  // 5. Recommandations automatiques
  console.log(`\n💡 Recommandations:`);

  if (bySub.length >= 2) {
    const bestSub = bySub[0];
    const worstSub = bySub[bySub.length - 1];
    console.log(`   → Augmenter la frequence sur ${bestSub.subreddit} (meilleur avg: ${(bestSub.avg_score || 0).toFixed(1)})`);
    if ((worstSub.avg_score || 0) < 2 && worstSub.posts > 3) {
      console.log(`   → Reduire/arreter sur ${worstSub.subreddit} (avg: ${(worstSub.avg_score || 0).toFixed(1)})`);
    }
  }

  if (byFormat.length >= 2) {
    const bestFormat = byFormat[0];
    console.log(`   → Format le plus performant: "${bestFormat.format_type}" — en prioriser l'usage`);
  }

  const keybisRatio = db.getRecentKeybisRatio(7);
  if (keybisRatio > 0.3) {
    console.log(`   → ⚠️ Ratio mentions Keybis trop eleve (${(keybisRatio * 100).toFixed(0)}%). Reduire a <20%.`);
  } else if (keybisRatio < 0.1 && global.total_posts > 10) {
    console.log(`   → Ratio mentions Keybis faible (${(keybisRatio * 100).toFixed(0)}%). Possible d'augmenter legerement.`);
  }

  console.log("\n" + "═".repeat(60));
}

// ── CLI ──
async function main() {
  if (process.argv.includes("--update")) {
    await updateScores();
  }
  generateReport();
}

if (process.argv[1]?.endsWith("analyzer.js")) {
  main().catch(console.error);
}
