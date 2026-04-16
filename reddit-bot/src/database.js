/**
 * database.js — SQLite local pour historique des posts, sujets utilises,
 * performances et file d'attente de publication.
 */
import Database from "better-sqlite3";
import { config } from "./config.js";
import fs from "node:fs";

// Cree le dossier data s'il n'existe pas
fs.mkdirSync(config.paths.data, { recursive: true });

const db = new Database(config.paths.db);
db.pragma("journal_mode = WAL");

// ── Schema ──
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id      TEXT NOT NULL,
    subreddit     TEXT NOT NULL,
    title         TEXT NOT NULL,
    body          TEXT NOT NULL,
    format_type   TEXT NOT NULL,
    mentions_keybis INTEGER DEFAULT 0,
    reddit_post_id TEXT,
    status        TEXT DEFAULT 'draft',
    score         INTEGER DEFAULT 0,
    num_comments  INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now')),
    published_at  TEXT,
    UNIQUE(topic_id, subreddit)
  );

  CREATE TABLE IF NOT EXISTS queue (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id       INTEGER REFERENCES posts(id),
    scheduled_at  TEXT NOT NULL,
    status        TEXT DEFAULT 'pending',
    published_at  TEXT,
    error_log     TEXT
  );

  CREATE TABLE IF NOT EXISTS scraped_threads (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    subreddit     TEXT NOT NULL,
    reddit_id     TEXT UNIQUE NOT NULL,
    title         TEXT NOT NULL,
    score         INTEGER DEFAULT 0,
    num_comments  INTEGER DEFAULT 0,
    url           TEXT,
    is_opportunity INTEGER DEFAULT 0,
    opportunity_type TEXT,
    scraped_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    karma         INTEGER DEFAULT 0,
    posts_today   INTEGER DEFAULT 0,
    last_post_at  TEXT,
    status        TEXT DEFAULT 'active',
    notes         TEXT
  );

  CREATE TABLE IF NOT EXISTS daily_stats (
    date          TEXT PRIMARY KEY,
    posts_sent    INTEGER DEFAULT 0,
    comments_sent INTEGER DEFAULT 0,
    total_score   INTEGER DEFAULT 0,
    keybis_mentions INTEGER DEFAULT 0
  );
`);

// ── Fonctions d'acces ──

export function savePost(post) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO posts (topic_id, subreddit, title, body, format_type, mentions_keybis, status)
    VALUES (@topicId, @subreddit, @title, @body, @formatType, @mentionsKeybis, @status)
  `);
  return stmt.run({
    topicId: post.topicId,
    subreddit: post.subreddit,
    title: post.title,
    body: post.body,
    formatType: post.formatType,
    mentionsKeybis: post.mentionsKeybis ? 1 : 0,
    status: post.status || "draft",
  });
}

export function getPostsToday() {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM posts
    WHERE date(published_at) = date('now') AND status = 'published'
  `);
  return stmt.get().count;
}

export function getUsedTopics() {
  const stmt = db.prepare(`SELECT DISTINCT topic_id FROM posts WHERE status = 'published'`);
  return stmt.all().map(r => r.topic_id);
}

export function getRecentKeybisRatio(days = 7) {
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(mentions_keybis) as with_mention
    FROM posts
    WHERE status = 'published'
      AND published_at >= datetime('now', '-' || ? || ' days')
  `);
  const row = stmt.get(days);
  if (!row.total) return 0;
  return row.with_mention / row.total;
}

export function markPublished(postId, redditPostId) {
  const stmt = db.prepare(`
    UPDATE posts SET status = 'published', reddit_post_id = ?, published_at = datetime('now')
    WHERE id = ?
  `);
  return stmt.run(redditPostId, postId);
}

export function addToQueue(postId, scheduledAt) {
  const stmt = db.prepare(`
    INSERT INTO queue (post_id, scheduled_at) VALUES (?, ?)
  `);
  return stmt.run(postId, scheduledAt);
}

export function getNextInQueue() {
  const stmt = db.prepare(`
    SELECT q.*, p.title, p.body, p.subreddit, p.topic_id
    FROM queue q JOIN posts p ON q.post_id = p.id
    WHERE q.status = 'pending' AND q.scheduled_at <= datetime('now')
    ORDER BY q.scheduled_at ASC LIMIT 1
  `);
  return stmt.get();
}

export function saveScrapedThread(thread) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO scraped_threads (subreddit, reddit_id, title, score, num_comments, url, is_opportunity, opportunity_type)
    VALUES (@subreddit, @redditId, @title, @score, @numComments, @url, @isOpportunity, @opportunityType)
  `);
  return stmt.run(thread);
}

export function getOpportunities(limit = 20) {
  const stmt = db.prepare(`
    SELECT * FROM scraped_threads
    WHERE is_opportunity = 1
    ORDER BY score DESC LIMIT ?
  `);
  return stmt.all(limit);
}

export function updateDailyStats(stats) {
  const stmt = db.prepare(`
    INSERT INTO daily_stats (date, posts_sent, comments_sent, total_score, keybis_mentions)
    VALUES (date('now'), @postsSent, @commentsSent, @totalScore, @keybisMentions)
    ON CONFLICT(date) DO UPDATE SET
      posts_sent = posts_sent + @postsSent,
      comments_sent = comments_sent + @commentsSent,
      total_score = total_score + @totalScore,
      keybis_mentions = keybis_mentions + @keybisMentions
  `);
  return stmt.run(stats);
}

export function getPerformanceReport(days = 30) {
  const stmt = db.prepare(`
    SELECT
      p.subreddit,
      p.format_type,
      COUNT(*) as posts,
      AVG(p.score) as avg_score,
      AVG(p.num_comments) as avg_comments,
      SUM(p.mentions_keybis) as keybis_mentions
    FROM posts p
    WHERE p.status = 'published'
      AND p.published_at >= datetime('now', '-' || ? || ' days')
    GROUP BY p.subreddit, p.format_type
    ORDER BY avg_score DESC
  `);
  return stmt.all(days);
}

export { db };
