import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

export const config = {
  // ── Reddit API ──
  reddit: {
    clientId:     process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username:     process.env.REDDIT_USERNAME,
    password:     process.env.REDDIT_PASSWORD,
    userAgent:    process.env.REDDIT_USER_AGENT || "keybis-content/1.0",
  },

  // ── LLM (generation contenu) ──
  llm: {
    apiKey:  process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
    model:   process.env.LLM_MODEL || "gpt-4o-mini",
    provider: process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai",
  },

  // ── Publication ──
  publishing: {
    maxPostsPerDay:        Number(process.env.MAX_POSTS_PER_DAY || 3),
    minDelayMinutes:       Number(process.env.MIN_DELAY_BETWEEN_POSTS_MINUTES || 120),
    keybisMentionRatio:    Number(process.env.KEYBIS_MENTION_RATIO || 0.3),
    dryRun:                process.env.DRY_RUN !== "false",
    commentReplyEnabled:   process.env.COMMENT_REPLY_ENABLED === "true",
  },

  // ── Telegram ──
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId:   process.env.TELEGRAM_CHAT_ID,
  },

  // ── Chemins ──
  paths: {
    root,
    data: path.join(root, "data"),
    db:   path.join(root, "data", "keybis-reddit.db"),
    templates: path.join(root, "templates"),
  },

  // ── Horaires de publication (heures FR) ──
  publishWindows: [
    { start: 8,  end: 9,  weight: 0.15 },  // matin tot
    { start: 12, end: 13, weight: 0.25 },  // pause dejeuner
    { start: 14, end: 15, weight: 0.15 },  // debut aprem
    { start: 18, end: 19, weight: 0.25 },  // fin de journee
    { start: 21, end: 22, weight: 0.20 },  // soiree
  ],
};
