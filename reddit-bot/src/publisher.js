/**
 * publisher.js — Moteur de publication avec securite anti-ban.
 *
 * Gere la publication des posts generes avec :
 * - Verification des quotas journaliers
 * - Delais humains entre posts
 * - Rotation des heures de publication
 * - Validation pre-publication
 * - Logging complet
 *
 * Usage:
 *   node src/publisher.js                  # publie le prochain post en queue
 *   node src/publisher.js --generate-and-publish  # genere + publie
 *   node src/publisher.js --queue-status   # affiche la queue
 */
import { config } from "./config.js";
import * as db from "./database.js";
import * as reddit from "./reddit-client.js";
import { generatePost } from "./content-generator.js";

// ── Verifications pre-publication ──
function preflightChecks() {
  const errors = [];

  // Quota journalier
  const todayCount = db.getPostsToday();
  if (todayCount >= config.publishing.maxPostsPerDay) {
    errors.push(`Quota atteint: ${todayCount}/${config.publishing.maxPostsPerDay} posts aujourd'hui`);
  }

  // Ratio mentions Keybis
  const ratio = db.getRecentKeybisRatio(7);
  if (ratio > config.publishing.keybisMentionRatio * 1.5) {
    errors.push(`Ratio mentions Keybis trop eleve: ${(ratio * 100).toFixed(0)}% (max: ${config.publishing.keybisMentionRatio * 100}%)`);
  }

  return errors;
}

// ── Validation du contenu ──
function validateContent(post) {
  const warnings = [];

  // Verifier la longueur du titre
  if (post.title.length > 300) {
    warnings.push("Titre trop long (>300 chars)");
  }
  if (post.title.length < 20) {
    warnings.push("Titre trop court (<20 chars)");
  }

  // Verifier le corps
  if (post.body.length < 200) {
    warnings.push("Corps trop court (<200 chars) — risque de low effort");
  }
  if (post.body.length > 5000) {
    warnings.push("Corps tres long (>5000 chars) — risque de TL;DR");
  }

  // Detecter du contenu trop promotionnel
  const promoPatterns = [
    /keybis\.fr/i,
    /https?:\/\//,
    /cliquez/i,
    /click here/i,
    /offre\s+(speciale|exceptionnelle|limitee)/i,
    /special\s+offer/i,
    /promo\s*code/i,
    /code\s*promo/i,
    /\bpub\b/i,
  ];

  for (const pat of promoPatterns) {
    if (pat.test(post.body)) {
      warnings.push(`⚠️ Contenu potentiellement promotionnel detecte: ${pat.source}`);
    }
  }

  // Detecter les patterns de bot
  const botPatterns = [
    /en\s+conclusion/i,
    /n'hesitez\s+pas/i,
    /game[\s-]changer/i,
    /incontournable/i,
    /\{.*\}/,  // variables non-remplacees
    /\[.*\]/,  // placeholders
  ];

  for (const pat of botPatterns) {
    if (pat.test(post.body)) {
      warnings.push(`🤖 Pattern robotique detecte: ${pat.source}`);
    }
  }

  return warnings;
}

// ── Calculer le delai optimal ──
function getHumanDelay() {
  // Delai de base entre 2-4 heures
  const baseMin = config.publishing.minDelayMinutes;
  // Ajouter une variation aleatoire de ±30 minutes
  const variation = (Math.random() - 0.5) * 60;
  return Math.max(60, baseMin + variation) * 60 * 1000; // en ms
}

// ── Verifier si c'est un bon moment pour publier ──
function isGoodPublishTime() {
  const now = new Date();
  const hour = now.getHours(); // Heure locale

  return config.publishWindows.some(w => hour >= w.start && hour < w.end);
}

// ── Publier un post ──
export async function publishNext() {
  console.log("\n🚀 Demarrage de la publication...\n");

  // 1. Preflight checks
  const errors = preflightChecks();
  if (errors.length > 0) {
    console.log("❌ Publication bloquee:");
    errors.forEach(e => console.log(`   • ${e}`));
    return { success: false, errors };
  }

  // 2. Verifier le timing
  if (!isGoodPublishTime()) {
    console.log("⏰ Pas un bon moment pour publier. Fenetres optimales:");
    config.publishWindows.forEach(w => console.log(`   ${w.start}h-${w.end}h`));
    return { success: false, reason: "bad_timing" };
  }

  // 3. Verifier la sante du compte
  try {
    const health = await reddit.checkAccountHealth();
    console.log(`👤 Compte: ${health.username} | Karma: ${health.karma} | Age: ${health.accountAge}j`);

    if (health.karma < 10) {
      console.log("⚠️ Karma trop faible. Priorisez les commentaires utiles pour gagner du karma.");
    }
    if (health.accountAge < 7) {
      console.log("⚠️ Compte trop recent. Attendez quelques jours et participez aux discussions.");
      return { success: false, reason: "account_too_new" };
    }
  } catch (err) {
    console.error("⚠️ Impossible de verifier le compte:", err.message);
  }

  // 4. Generer ou recuperer un post
  let post;
  const queued = db.getNextInQueue();
  if (queued) {
    post = queued;
    console.log(`📋 Post depuis la queue: "${post.title}"`);
  } else {
    console.log("📝 Aucun post en queue, generation d'un nouveau...");
    post = await generatePost();
    if (!post) return { success: false, reason: "no_content" };
  }

  // 5. Valider le contenu
  const warnings = validateContent(post);
  if (warnings.length > 0) {
    console.log("\n⚠️ Avertissements sur le contenu:");
    warnings.forEach(w => console.log(`   ${w}`));

    const criticals = warnings.filter(w => w.startsWith("⚠️"));
    if (criticals.length > 0) {
      console.log("\n❌ Contenu bloque (promotionnel detecte). Regenerez le post.");
      return { success: false, reason: "content_validation", warnings };
    }
  }

  // 6. Publier
  console.log(`\n📤 Publication: "${post.title}" sur ${post.subreddit}`);

  const result = await reddit.submitPost({
    subreddit: post.subreddit,
    title: post.title,
    body: post.body,
    flair: post.flair,
  });

  if (result.error) {
    console.log(`\n❌ Erreur: ${result.error}`);
    return { success: false, ...result };
  }

  // 7. Mettre a jour la base
  if (post.id) {
    db.markPublished(post.id, result.id);
  }

  db.updateDailyStats({
    postsSent: 1,
    commentsSent: 0,
    totalScore: 0,
    keybisMentions: post.mentionsKeybis ? 1 : 0,
  });

  console.log(`\n✅ Publie avec succes!`);
  console.log(`   URL: ${result.url}`);

  return { success: true, post, result };
}

// ── Publier un commentaire en reponse ──
export async function publishReply(threadId, subreddit, question) {
  const prompt = `Tu es un expert en droit des societes francais sur Reddit.
Quelqu'un a poste cette question sur ${subreddit}:

"${question}"

Redige une reponse utile et concise (150-300 mots):
- Reponds directement a la question
- Donne des infos concretes et precises
- Ton naturel, comme un vrai redditeur
- NE mentionne AUCUN service ni AUCUNE marque
- Termine par une question pour engager la conversation

Reponds uniquement avec le texte du commentaire, sans JSON.`;

  // TODO: appeler le LLM pour generer la reponse
  console.log(`💬 Reponse a generer pour ${threadId} sur ${subreddit}`);
  return { generated: true, prompt };
}

// ── CLI ──
if (process.argv[1]?.endsWith("publisher.js")) {
  const args = process.argv.slice(2);

  if (args.includes("--queue-status")) {
    const today = db.getPostsToday();
    const ratio = db.getRecentKeybisRatio(7);
    console.log("\n📊 Statut de publication");
    console.log("═".repeat(40));
    console.log(`Posts aujourd'hui: ${today}/${config.publishing.maxPostsPerDay}`);
    console.log(`Ratio Keybis (7j): ${(ratio * 100).toFixed(0)}% (max: ${(config.publishing.keybisMentionRatio * 100).toFixed(0)}%)`);
    console.log(`Bon moment: ${isGoodPublishTime() ? "✅ Oui" : "❌ Non"}`);
    console.log(`Mode: ${config.publishing.dryRun ? "DRY RUN 🔸" : "LIVE 🟢"}`);
  } else {
    publishNext().catch(console.error);
  }
}
