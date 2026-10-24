// Telegram Client API (MTProto) via GramJS.
// Transport is WebSocket (useWSS) because React Native has no raw TCP.

import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { computeCheck } from "telegram/Password";
import { PromisedWebSockets } from "telegram/extensions";
import * as SecureStore from "expo-secure-store";

import { matchMessage } from "./matcher";
import { messageLink } from "./links";

export const API_ID = 3477714;
export const API_HASH = "1264d2d7d397c4635147ee25ab5808d1";

const SESSION_KEY = "tg_session";

let client = null;
let phoneCodeHash = null;
let monitoring = false;

async function loadSessionString() {
  try {
    return (await SecureStore.getItemAsync(SESSION_KEY)) || "";
  } catch {
    return "";
  }
}

async function saveSessionString(s) {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, s);
  } catch {}
}

export async function getClient() {
  if (client) return client;
  const sessionStr = await loadSessionString();
  const session = new StringSession(sessionStr);
  client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
    useWSS: true,
    // Force the WebSocket socket class: RN has no `document`, so GramJS's
    // isBrowser check is false and it would otherwise use raw TCP (net),
    // which React Native can't do -> connect() hangs forever.
    networkSocket: PromisedWebSockets,
    // Provide these explicitly: GramJS otherwise derives them via os.*(),
    // and the os-browserify shim returns undefined -> .toString() crash.
    deviceModel: "TgWatch",
    systemVersion: "Android",
    appVersion: "0.2.0",
    langCode: "en",
    systemLangCode: "en",
  });
  try {
    await client.connect();
  } catch (e) {
    console.log("TGCONNERR", e?.message, "\n", e?.stack);
    throw e;
  }
  return client;
}

export async function isAuthorized() {
  const c = await getClient();
  return c.isUserAuthorized();
}

export async function sendCode(phone) {
  const c = await getClient();
  const res = await c.sendCode({ apiId: API_ID, apiHash: API_HASH }, phone);
  phoneCodeHash = res.phoneCodeHash;
  return res;
}

// Returns "ok" | "password"
export async function signInCode(phone, code) {
  const c = await getClient();
  try {
    await c.invoke(
      new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code })
    );
    await saveSessionString(c.session.save());
    return "ok";
  } catch (e) {
    if (String(e?.errorMessage || e?.message).includes("SESSION_PASSWORD_NEEDED")) {
      return "password";
    }
    throw e;
  }
}

export async function signInPassword(password) {
  const c = await getClient();
  const pwd = await c.invoke(new Api.account.GetPassword());
  const check = await computeCheck(pwd, password);
  await c.invoke(new Api.auth.CheckPassword({ password: check }));
  await saveSessionString(c.session.save());
  return "ok";
}

export async function logout() {
  try {
    const c = await getClient();
    await c.invoke(new Api.auth.LogOut());
  } catch {}
  await saveSessionString("");
  client = null;
}

// Returns [{ chatId, title, username, isChannel }]
export async function listDialogs() {
  const c = await getClient();
  const out = [];
  const dialogs = await c.getDialogs({ limit: 200 });
  for (const d of dialogs) {
    const ent = d.entity;
    const cls = ent?.className;
    if (cls === "Channel" || cls === "Chat") {
      out.push({
        chatId: d.id?.toString?.() ?? String(d.id),
        title: d.title || ent?.title || "(no title)",
        username: ent?.username || null,
        isChannel: cls === "Channel",
      });
    }
  }
  return out;
}

// watchedIds: Set<string>; rules: matcher dicts; onMatch(hit)
export async function startMonitoring({ watchedIds, rules, onMatch }) {
  const c = await getClient();
  if (monitoring) return;
  monitoring = true;

  c.addEventHandler(async (event) => {
    try {
      const msg = event.message;
      if (!msg) return;
      const cid = event.chatId?.toString?.() ?? String(event.chatId);
      if (watchedIds.size && !watchedIds.has(cid)) return;

      const text = msg.message || "";
      let title = cid;
      let username = null;
      let sender = null;
      try {
        const chat = await event.getChat();
        title = chat?.title || chat?.username || cid;
        username = chat?.username || null;
      } catch {}
      try {
        const s = await event.getSender();
        sender = s?.username || s?.firstName || null;
      } catch {}

      for (const rule of rules) {
        if (matchMessage(text, rule)) {
          onMatch({
            ruleName: rule.name,
            chatId: cid,
            chatTitle: title,
            msgId: msg.id,
            sender,
            text,
            link: messageLink(cid, msg.id, username),
            ts: Date.now(),
          });
          break;
        }
      }
    } catch {}
  }, new NewMessage({}));
}

export function isMonitoring() {
  return monitoring;
}
