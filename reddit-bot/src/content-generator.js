/**
 * content-generator.js — Generateur de contenu intelligent pour Reddit.
 *
 * Utilise un LLM (GPT-4o-mini ou Claude) pour generer des posts uniques,
 * adaptes au subreddit cible, au format choisi, et au ton requis.
 *
 * Usage:
 *   node src/content-generator.js --preview          # genere un post preview
 *   node src/content-generator.js --topic=sasu-vs-eurl --sub=r/EntrepreneurFrancais
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import * as db from "./database.js";

// ── Charger les donnees de reference ──
const topicsData   = JSON.parse(fs.readFileSync(path.join(config.paths.data, "topics.json"), "utf8"));
const subredditsData = JSON.parse(fs.readFileSync(path.join(config.paths.data, "subreddits.json"), "utf8"));
const templates    = loadTemplates();

function loadTemplates() {
  const dir = config.paths.templates;
  const map = {};
  if (!fs.existsSync(dir)) return map;
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith(".txt"))) {
    map[f.replace(".txt", "")] = fs.readFileSync(path.join(dir, f), "utf8");
  }
  return map;
}

// ── Selectionner un sujet non encore utilise ──
export function pickTopic(preferredSub = null) {
  const usedTopics = db.getUsedTopics();
  const recentKeybisRatio = db.getRecentKeybisRatio(7);
  const shouldMentionKeybis = recentKeybisRatio < config.publishing.keybisMentionRatio;

  const allTopics = [];
  for (const [catKey, cat] of Object.entries(topicsData.categories)) {
    if (catKey === "comment_replies") continue;
    for (const topic of cat.topics) {
      if (usedTopics.includes(topic.id)) continue;

      let score = 0;
      // Boost si le sub prefere match
      if (preferredSub && topic.target_subs.includes(preferredSub)) score += 5;
      // Boost si on doit mentionner Keybis et le topic le permet
      if (shouldMentionKeybis && topic.keybis_mention_opportunity) score += 3;
      // Boost par format variety
      score += Math.random() * 3;

      allTopics.push({ ...topic, category: catKey, score });
    }
  }

  allTopics.sort((a, b) => b.score - a.score);
  return allTopics[0] || null;
}

// ── Choisir un subreddit pour le post ──
export function pickSubreddit(topic) {
  const subMap = new Map(subredditsData.subreddits.map(s => [s.name, s]));
  const candidates = topic.target_subs
    .map(name => subMap.get(name))
    .filter(Boolean)
    .sort((a, b) => b.relevance - a.relevance);

  // Ajouter un peu de randomisation pour eviter les patterns
  const idx = Math.random() < 0.7 ? 0 : Math.min(1, candidates.length - 1);
  return candidates[idx];
}

// ── Choisir le format du post ──
export function pickFormat() {
  const formats = topicsData.content_formats;
  const rand = Math.random();
  let cumulative = 0;
  for (const fmt of formats) {
    cumulative += fmt.weight;
    if (rand <= cumulative) return fmt;
  }
  return formats[0];
}

// ── Construire le prompt LLM ──
export function buildPrompt(topic, subreddit, format, shouldMentionKeybis) {
  const titleIdea = topic.title_ideas[Math.floor(Math.random() * topic.title_ideas.length)];

  const mentionInstruction = shouldMentionKeybis
    ? `\n\nINTEGRATION KEYBIS (mise en avant naturelle) :
- Mentionne Keybis UNE SEULE FOIS de maniere naturelle mais claire
- INCLUS le site web (keybis.fr) OU le WhatsApp (07 80 95 40 94) selon le contexte
- Style: "${topic.mention_style || "footnote"}"
  - "footnote": en fin de post, genre "PS: si vous voulez vous simplifier la vie, Keybis fait ca bien (keybis.fr) — ou contactez-les direct sur WhatsApp au 07 80 95 40 94"
  - "soft_recommendation": integre dans le texte comme une recommandation personnelle avec le lien
  - "context": mentionne comme contexte de ton experience + partage le lien/WhatsApp pour aider les autres
- Reste naturel et authentique, comme un vrai retour d'experience
- Tu peux dire "je recommande", "j'ai teste", "ca m'a bien aide"
- JAMAIS de ton publicitaire excessif ou de superlatifs vides`
    : `\n\nIMPORTANT : Ne mentionne AUCUNE marque, AUCUN service externe dans ce post. Contenu purement educatif.`;

  return `Tu es un entrepreneur francais experimente qui partage ses connaissances sur Reddit.
Tu postes sur ${subreddit.name} (${subreddit.language === "fr" ? "francophone" : "anglophone"}).

REGLES DU SUBREDDIT :
${subreddit.rules_summary}
${subreddit.self_promo_allowed === false ? "⚠️ AUCUNE auto-promotion toleree." : ""}
${subreddit.flair_required ? "Flair obligatoire. Suggestion: " + (subreddit.typical_flairs || []).join(", ") : ""}

FORMAT DEMANDE : ${format.type} — ${format.description}
TON : ${format.tone}

SUJET : ${topic.id}
INSPIRATION TITRE : "${titleIdea}"

STRUCTURE OBLIGATOIRE :
1. TITRE : Accrocheur, naturel, pas clickbait. Max 120 caracteres.
2. HOOK (2-3 lignes) : Question, constat choc, ou probleme vecu. Capte l'attention immediatement.
3. CORPS (300-800 mots) : Contenu utile, structure avec des paragraphes courts.
   - Utilise des sous-titres markdown (##) si c'est un guide
   - Chiffres concrets quand possible
   - Exemples reels ou realistes
4. CONCLUSION : Actionnable. Invite a la discussion. Pose une question ouverte.
${mentionInstruction}

CONTRAINTES ABSOLUES :
- Ecris comme un vrai humain sur Reddit, PAS comme un chatbot ou un article de blog
- Utilise "je", "mon experience", "perso"
- Imperfections bienvenues (phrases courtes, expressions familieres)
- JAMAIS de emojis excessifs (max 1-2 si pertinent)
- JAMAIS de formatage corporate (pas de "En conclusion,", pas de "N'hesitez pas a...")
- JAMAIS le mot "game-changer", "incontournable", "indispensable"
- Si en francais : tutoiement acceptable, ton decontracte
- Si en anglais : casual but informative tone

REPONDS EXACTEMENT DANS CE FORMAT JSON :
{
  "title": "...",
  "body": "...",
  "flair": "..." ou null,
  "language": "fr" ou "en"
}`;
}

// ── Appeler le LLM ──
async function callLLM(prompt) {
  if (config.llm.provider === "openai") {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: config.llm.apiKey });
    const res = await client.chat.completions.create({
      model: config.llm.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.85,
      max_tokens: 2000,
    });
    return res.choices[0].message.content;
  }

  // Fallback: Anthropic
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.llm.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content[0].text;
}

// ── Generer un post complet ──
export async function generatePost(options = {}) {
  const topic = options.topic || pickTopic(options.subreddit);
  if (!topic) {
    console.log("⚠️  Tous les sujets ont ete utilises. Ajoutez-en de nouveaux dans topics.json.");
    return null;
  }

  const subreddit = options.subredditData || pickSubreddit(topic);
  const format = options.format || pickFormat();
  const shouldMentionKeybis = options.forceKeybis !== undefined
    ? options.forceKeybis
    : (topic.keybis_mention_opportunity && db.getRecentKeybisRatio(7) < config.publishing.keybisMentionRatio);

  console.log(`\n📝 Generation en cours...`);
  console.log(`   Sujet: ${topic.id}`);
  console.log(`   Sub: ${subreddit.name}`);
  console.log(`   Format: ${format.type}`);
  console.log(`   Mention Keybis: ${shouldMentionKeybis ? "oui (subtile)" : "non"}`);

  const prompt = buildPrompt(topic, subreddit, format, shouldMentionKeybis);

  if (config.publishing.dryRun && !config.llm.apiKey) {
    console.log("\n🔸 Mode DRY RUN sans cle API. Voici le prompt qui serait envoye:\n");
    console.log(prompt.slice(0, 500) + "...\n");
    return { topic, subreddit, format, shouldMentionKeybis, prompt, dryRun: true };
  }

  const raw = await callLLM(prompt);

  // Parser le JSON de la reponse
  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("❌ Erreur de parsing LLM. Reponse brute:", raw.slice(0, 300));
    return null;
  }

  const post = {
    topicId: topic.id,
    subreddit: subreddit.name,
    title: parsed.title,
    body: parsed.body,
    formatType: format.type,
    mentionsKeybis: shouldMentionKeybis,
    flair: parsed.flair,
    status: "draft",
  };

  // Sauvegarder en base
  const result = db.savePost(post);
  post.id = result.lastInsertRowid;

  console.log(`\n✅ Post genere (ID: ${post.id})`);
  console.log(`   Titre: ${post.title}`);
  console.log(`   Longueur: ${post.body.length} caracteres`);

  return post;
}

// ── CLI ──
if (process.argv[1]?.endsWith("content-generator.js")) {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v || true];
    })
  );

  if (args.preview) {
    generatePost().then(post => {
      if (post?.body) {
        console.log("\n" + "═".repeat(60));
        console.log("TITRE:", post.title);
        console.log("═".repeat(60));
        console.log(post.body);
        console.log("═".repeat(60));
      }
    });
  }
}
