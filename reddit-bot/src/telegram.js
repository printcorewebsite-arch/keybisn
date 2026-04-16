/**
 * telegram.js — Envoi des posts generes sur Telegram.
 *
 * Envoie les posts Reddit generes sur un chat Telegram pour
 * que l'utilisateur puisse les copier-coller manuellement sur Reddit.
 *
 * Usage:
 *   node src/telegram.js              # genere et envoie 10 posts
 *   node src/telegram.js --count=5    # genere et envoie 5 posts
 *   node src/telegram.js --test       # envoie un message test
 */
import { config } from "./config.js";
import { generatePost } from "./content-generator.js";

const TELEGRAM_API = `https://api.telegram.org/bot${config.telegram.botToken}`;

// ── Envoyer un message Telegram ──
async function sendMessage(chatId, text, options = {}) {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...options,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    console.error("❌ Erreur Telegram:", data.description);
    return false;
  }
  return true;
}

// ── Formater un post pour Telegram ──
function formatPostForTelegram(post, index, total) {
  const keybisTag = post.mentionsKeybis ? "🟡 Mention Keybis" : "⚪ Sans mention";

  return `━━━━━━━━━━━━━━━━━━━━
📝 <b>POST ${index}/${total}</b>
━━━━━━━━━━━━━━━━━━━━

📍 <b>Subreddit :</b> ${post.subreddit}
🏷 <b>Format :</b> ${post.formatType}
${keybisTag}

━━ <b>TITRE</b> ━━━━━━━━━━━━━

<b>${escapeHtml(post.title)}</b>

━━ <b>CONTENU</b> ━━━━━━━━━━━━

${escapeHtml(post.body)}

━━━━━━━━━━━━━━━━━━━━
💡 <i>Copie le titre et le contenu, puis poste sur ${post.subreddit}</i>`;
}

// ── Escape HTML pour Telegram ──
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Generer et envoyer les posts du jour ──
export async function sendDailyPosts(count = 10) {
  const chatId = config.telegram.chatId;

  if (!config.telegram.botToken || !chatId) {
    console.error("❌ TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID requis dans .env");
    return;
  }

  // Message d'intro
  const now = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  await sendMessage(chatId,
    `🤖 <b>KEYBIS REDDIT ENGINE</b>\n\n📅 ${now}\n📊 ${count} posts generes pour aujourd'hui\n\n⬇️ <i>Posts a venir...</i>`
  );

  const posts = [];
  let sent = 0;

  // Exactement 3 posts sur 10 mentionnent Keybis (positions aleatoires)
  const keybisSlots = new Set();
  while (keybisSlots.size < Math.round(count * 0.3)) {
    keybisSlots.add(Math.floor(Math.random() * count));
  }

  for (let i = 0; i < count; i++) {
    console.log(`\n📝 Generation du post ${i + 1}/${count}...`);
    const forceKeybis = keybisSlots.has(i);

    try {
      const post = await generatePost({ forceKeybis });

      if (!post || !post.body) {
        console.log(`⚠️ Post ${i + 1} : pas de contenu genere (sujets epuises ?)`);
        await sendMessage(chatId,
          `⚠️ <b>Post ${i + 1}/${count}</b> : Impossible de generer (sujets epuises). Ajoutez de nouveaux sujets dans topics.json.`
        );
        continue;
      }

      posts.push(post);

      // Envoyer sur Telegram
      const message = formatPostForTelegram(post, i + 1, count);

      // Telegram a une limite de 4096 chars par message
      if (message.length > 4096) {
        // Decouper en 2 messages
        const titleMsg = `━━━━━━━━━━━━━━━━━━━━\n📝 <b>POST ${i + 1}/${count}</b>\n━━━━━━━━━━━━━━━━━━━━\n\n📍 <b>Subreddit :</b> ${post.subreddit}\n🏷 <b>Format :</b> ${post.formatType}\n${post.mentionsKeybis ? "🟡 Mention Keybis" : "⚪ Sans mention"}\n\n━━ <b>TITRE</b> ━━━━━━━━━━━━━\n\n<b>${escapeHtml(post.title)}</b>`;
        const bodyMsg = `━━ <b>CONTENU (suite)</b> ━━━━━\n\n${escapeHtml(post.body)}\n\n━━━━━━━━━━━━━━━━━━━━\n💡 <i>Copie le titre et le contenu, puis poste sur ${post.subreddit}</i>`;

        await sendMessage(chatId, titleMsg);
        await new Promise(r => setTimeout(r, 1000));
        await sendMessage(chatId, bodyMsg);
      } else {
        await sendMessage(chatId, message);
      }

      sent++;
      console.log(`✅ Post ${i + 1} envoye sur Telegram`);

      // Delai entre chaque generation (pas surcharger l'API)
      if (i < count - 1) {
        const delay = 3000 + Math.random() * 5000;
        console.log(`⏳ Attente ${(delay / 1000).toFixed(0)}s...`);
        await new Promise(r => setTimeout(r, delay));
      }

    } catch (err) {
      console.error(`❌ Erreur post ${i + 1}:`, err.message);
      await sendMessage(chatId,
        `❌ <b>Post ${i + 1}/${count}</b> : Erreur de generation\n<code>${escapeHtml(err.message.slice(0, 200))}</code>`
      );
    }
  }

  // Message de fin
  await sendMessage(chatId,
    `\n✅ <b>Generation terminee !</b>\n\n📊 ${sent}/${count} posts envoyes\n📝 Copiez-collez chaque post sur le subreddit indique.\n\n⚠️ <b>Rappels :</b>\n• Attendez 2h+ entre chaque publication\n• Ne postez pas tout d'un coup\n• Lisez le post avant de le publier\n• Adaptez si necessaire`
  );

  console.log(`\n✅ ${sent}/${count} posts envoyes sur Telegram`);
  return posts;
}

// ── CLI ──
async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v || true];
    })
  );

  if (args.test) {
    const chatId = config.telegram.chatId;
    if (!chatId) {
      console.error("❌ TELEGRAM_CHAT_ID manquant dans .env");
      return;
    }
    const ok = await sendMessage(chatId, "✅ <b>Test Keybis Reddit Engine</b>\n\nLa connexion Telegram fonctionne !");
    console.log(ok ? "✅ Message test envoye !" : "❌ Echec de l'envoi");
    return;
  }

  const count = Number(args.count) || 10;
  await sendDailyPosts(count);
}

if (process.argv[1]?.endsWith("telegram.js")) {
  main().catch(console.error);
}
