/**
 * scraper.js — Analyse Reddit pour trouver des opportunites de contenu.
 *
 * Scrape les posts populaires et nouveaux dans les subs cibles,
 * identifie les questions frequentes, les tendances, et les threads
 * ou une reponse experte serait pertinente.
 *
 * Usage:
 *   node src/scraper.js                    # scan complet
 *   node src/scraper.js --sub=r/vosfinances  # scan un seul sub
 *   node src/scraper.js --opportunities    # affiche les opportunites
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import * as reddit from "./reddit-client.js";
import * as db from "./database.js";

const topicsData = JSON.parse(fs.readFileSync(path.join(config.paths.data, "topics.json"), "utf8"));
const subredditsData = JSON.parse(fs.readFileSync(path.join(config.paths.data, "subreddits.json"), "utf8"));

// ── Mots-cles pour detecter les opportunites ──
const TRIGGER_KEYWORDS = topicsData.categories.comment_replies?.trigger_keywords || [];

const QUESTION_PATTERNS = [
  /comment\s+(faire|creer|fermer|modifier|changer)/i,
  /quel\s+(statut|forme|type)/i,
  /combien\s+(coute|ca\s+coute|faut)/i,
  /est[\s-]ce\s+que/i,
  /besoin\s+d['e]\s*(aide|conseil)/i,
  /quelqu'?un\s+(sait|connait|a\s+deja)/i,
  /how\s+(to|do|much|long)/i,
  /should\s+I/i,
  /any\s+(advice|tips|experience)/i,
  /\?$/,
];

// ── Analyser un subreddit ──
async function scanSubreddit(subName) {
  console.log(`\n🔍 Scan de ${subName}...`);

  const [hotPosts, newPosts] = await Promise.all([
    reddit.getHotPosts(subName, 25),
    reddit.getNewPosts(subName, 15),
  ]);

  const allPosts = [...hotPosts, ...newPosts];
  const uniquePosts = [...new Map(allPosts.map(p => [p.id, p])).values()];

  let opportunities = 0;

  for (const post of uniquePosts) {
    const text = `${post.title} ${post.selftext || ""}`.toLowerCase();

    // Detecter si c'est une opportunite de reponse
    const matchedKeywords = TRIGGER_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()));
    const isQuestion = QUESTION_PATTERNS.some(pat => pat.test(post.title));
    const isLowCompetition = post.numComments < 10;

    let opportunityType = null;
    if (matchedKeywords.length > 0 && isQuestion && isLowCompetition) {
      opportunityType = "high_value_question";
      opportunities++;
    } else if (matchedKeywords.length >= 2) {
      opportunityType = "relevant_discussion";
      opportunities++;
    } else if (isQuestion && matchedKeywords.length > 0) {
      opportunityType = "question_to_answer";
      opportunities++;
    }

    db.saveScrapedThread({
      subreddit: subName,
      redditId: post.id,
      title: post.title,
      score: post.score,
      numComments: post.numComments,
      url: post.url,
      isOpportunity: opportunityType ? 1 : 0,
      opportunityType,
    });
  }

  console.log(`   ${uniquePosts.length} posts analyses, ${opportunities} opportunites trouvees`);
  return { total: uniquePosts.length, opportunities };
}

// ── Analyser les tendances ──
function analyzeTrends() {
  const opps = db.getOpportunities(50);

  // Compter les themes recurrents
  const themeCounts = {};
  for (const opp of opps) {
    const text = opp.title.toLowerCase();
    for (const kw of TRIGGER_KEYWORDS) {
      if (text.includes(kw.toLowerCase())) {
        themeCounts[kw] = (themeCounts[kw] || 0) + 1;
      }
    }
  }

  // Trier par frequence
  const trending = Object.entries(themeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);

  return {
    totalOpportunities: opps.length,
    trendingTopics: trending,
    topOpportunities: opps.slice(0, 10),
  };
}

// ── Generer des idees de contenu basees sur les tendances ──
export function generateContentIdeas(trends) {
  const ideas = [];

  for (const [keyword, count] of trends.trendingTopics) {
    ideas.push({
      keyword,
      frequency: count,
      suggestedAngles: [
        `Guide pratique: "${keyword}" explique simplement`,
        `Retour d'experience: mon parcours avec "${keyword}"`,
        `Les erreurs a eviter quand on parle de "${keyword}"`,
      ],
    });
  }

  return ideas;
}

// ── Trouver les posts ou repondre ──
export async function findReplyOpportunities(subreddit) {
  const newPosts = await reddit.getNewPosts(subreddit, 20);

  return newPosts.filter(post => {
    const text = `${post.title} ${post.selftext || ""}`.toLowerCase();
    const hasKeyword = TRIGGER_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
    const isQuestion = QUESTION_PATTERNS.some(pat => pat.test(post.title));
    const isRecent = (Date.now() / 1000 - post.createdUtc) < 3600 * 6; // < 6h
    const lowComments = post.numComments < 5;

    return hasKeyword && isQuestion && isRecent && lowComments;
  });
}

// ── CLI ──
async function main() {
  const args = process.argv.slice(2);
  const isOpportunitiesOnly = args.includes("--opportunities");
  const subArg = args.find(a => a.startsWith("--sub="))?.split("=")[1];

  if (isOpportunitiesOnly) {
    const trends = analyzeTrends();
    console.log("\n📊 RAPPORT D'OPPORTUNITES");
    console.log("═".repeat(50));
    console.log(`Total opportunites detectees: ${trends.totalOpportunities}`);

    console.log("\n🔥 Sujets tendance:");
    for (const [kw, count] of trends.trendingTopics) {
      console.log(`   ${count}x — ${kw}`);
    }

    console.log("\n🎯 Top opportunites:");
    for (const opp of trends.topOpportunities) {
      console.log(`   [${opp.score}↑] ${opp.title}`);
      console.log(`   └─ ${opp.url}`);
    }

    const ideas = generateContentIdeas(trends);
    console.log("\n💡 Idees de contenu suggerees:");
    for (const idea of ideas.slice(0, 5)) {
      console.log(`\n   "${idea.keyword}" (${idea.frequency} mentions)`);
      for (const angle of idea.suggestedAngles) {
        console.log(`   → ${angle}`);
      }
    }
    return;
  }

  // Scan complet ou cible
  const subsToScan = subArg
    ? [subArg]
    : subredditsData.subreddits.map(s => s.name);

  let totalOpps = 0;
  for (const sub of subsToScan) {
    try {
      const result = await scanSubreddit(sub);
      totalOpps += result.opportunities;
      // Delai entre chaque sub pour ne pas spam l'API
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 5000));
    } catch (err) {
      console.error(`   ⚠️ Erreur sur ${sub}: ${err.message}`);
    }
  }

  console.log(`\n✅ Scan termine. ${totalOpps} opportunites trouvees au total.`);

  // Afficher le rapport
  const trends = analyzeTrends();
  if (trends.trendingTopics.length > 0) {
    console.log("\n🔥 Sujets les plus demandes:");
    for (const [kw, count] of trends.trendingTopics.slice(0, 5)) {
      console.log(`   ${count}x — ${kw}`);
    }
  }
}

if (process.argv[1]?.endsWith("scraper.js")) {
  main().catch(console.error);
}
