/**
 * reddit-client.js — Wrapper Reddit API via snoowrap.
 *
 * Gere la connexion, la publication, et les reponses aux commentaires
 * avec des delais humains et une gestion des rate limits.
 */
import Snoowrap from "snoowrap";
import { config } from "./config.js";

let client = null;

// ── Connexion ──
export function getClient() {
  if (client) return client;

  client = new Snoowrap({
    userAgent:    config.reddit.userAgent,
    clientId:     config.reddit.clientId,
    clientSecret: config.reddit.clientSecret,
    username:     config.reddit.username,
    password:     config.reddit.password,
  });

  // Rate limiting doux — simule un comportement humain
  client.config({
    requestDelay: 2000,              // 2s entre chaque requete API
    continueAfterRatelimitError: true,
    retryOnServerError: 3,
    maxRetryAttempts: 3,
    warnings: false,
  });

  return client;
}

// ── Publier un post ──
export async function submitPost({ subreddit, title, body, flair }) {
  const reddit = getClient();
  const subName = subreddit.replace("r/", "");

  console.log(`📤 Publication sur ${subreddit}...`);

  if (config.publishing.dryRun) {
    console.log("🔸 DRY RUN — post non publie");
    return { id: "dry_run_" + Date.now(), url: "#dry-run" };
  }

  try {
    const submission = await reddit.getSubreddit(subName).submitSelfpost({
      title,
      text: body,
      ...(flair ? { flairId: flair } : {}),
    });

    console.log(`✅ Publie: https://reddit.com${submission.permalink}`);
    return {
      id: submission.id,
      url: `https://reddit.com${submission.permalink}`,
      permalink: submission.permalink,
    };
  } catch (err) {
    console.error(`❌ Erreur publication:`, err.message);

    // Detecter les erreurs courantes
    if (err.message.includes("RATELIMIT")) {
      const waitMatch = err.message.match(/(\d+) minute/);
      const waitMin = waitMatch ? parseInt(waitMatch[1]) : 10;
      console.log(`⏳ Rate limit. Attente ${waitMin} minutes...`);
      return { error: "ratelimit", waitMinutes: waitMin };
    }

    if (err.message.includes("SUBREDDIT_NOTALLOWED")) {
      console.log(`🚫 Pas autorise a poster sur ${subreddit}`);
      return { error: "not_allowed" };
    }

    throw err;
  }
}

// ── Repondre a un commentaire ou post ──
export async function submitComment(parentId, body) {
  const reddit = getClient();

  console.log(`💬 Reponse au thread ${parentId}...`);

  if (config.publishing.dryRun) {
    console.log("🔸 DRY RUN — commentaire non publie");
    return { id: "dry_run_comment_" + Date.now() };
  }

  try {
    // Delai humain aleatoire (5-30 secondes)
    const delay = 5000 + Math.random() * 25000;
    await sleep(delay);

    const comment = await reddit.getSubmission(parentId).reply(body);
    console.log(`✅ Commentaire publie`);
    return { id: comment.id };
  } catch (err) {
    console.error(`❌ Erreur commentaire:`, err.message);
    throw err;
  }
}

// ── Recuperer les posts recents d'un subreddit ──
export async function getHotPosts(subreddit, limit = 25) {
  const reddit = getClient();
  const subName = subreddit.replace("r/", "");

  const posts = await reddit.getSubreddit(subName).getHot({ limit });
  return posts.map(p => ({
    id: p.id,
    title: p.title,
    selftext: p.selftext?.slice(0, 500),
    score: p.score,
    numComments: p.num_comments,
    url: `https://reddit.com${p.permalink}`,
    createdUtc: p.created_utc,
    flair: p.link_flair_text,
  }));
}

// ── Recuperer les nouveaux posts (pour comment strategy) ──
export async function getNewPosts(subreddit, limit = 15) {
  const reddit = getClient();
  const subName = subreddit.replace("r/", "");

  const posts = await reddit.getSubreddit(subName).getNew({ limit });
  return posts.map(p => ({
    id: p.id,
    title: p.title,
    selftext: p.selftext?.slice(0, 500),
    score: p.score,
    numComments: p.num_comments,
    url: `https://reddit.com${p.permalink}`,
    createdUtc: p.created_utc,
  }));
}

// ── Rechercher des posts par mots-cles ──
export async function searchPosts(query, options = {}) {
  const reddit = getClient();
  const results = await reddit.search({
    query,
    subreddit: options.subreddit?.replace("r/", ""),
    time: options.time || "week",
    sort: options.sort || "relevance",
    limit: options.limit || 20,
  });

  return results.map(p => ({
    id: p.id,
    title: p.title,
    selftext: p.selftext?.slice(0, 300),
    score: p.score,
    numComments: p.num_comments,
    subreddit: p.subreddit_name_prefixed,
    url: `https://reddit.com${p.permalink}`,
    createdUtc: p.created_utc,
  }));
}

// ── Verifier le karma et l'etat du compte ──
export async function checkAccountHealth() {
  const reddit = getClient();
  const me = await reddit.getMe();

  return {
    username: me.name,
    karma: me.link_karma + me.comment_karma,
    linkKarma: me.link_karma,
    commentKarma: me.comment_karma,
    accountAge: Math.floor((Date.now() / 1000 - me.created_utc) / 86400),
    isSuspended: me.is_suspended || false,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
