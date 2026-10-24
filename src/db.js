// Storage backed by AsyncStorage (no native build-time download, unlike
// expo-sqlite). Data is small: watched chats, keyword rules, match history.
// Function names + returned row shapes match the original SQLite version so
// the screens are unchanged.

import AsyncStorage from "@react-native-async-storage/async-storage";

const K = { chats: "chats", rules: "rules", history: "history", settings: "settings" };
const HISTORY_CAP = 500;

async function readArr(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
async function writeArr(key, arr) {
  await AsyncStorage.setItem(key, JSON.stringify(arr));
}

// ---- settings ----
export async function getSetting(key, def = null) {
  try {
    const raw = await AsyncStorage.getItem(K.settings);
    const obj = raw ? JSON.parse(raw) : {};
    return key in obj ? obj[key] : def;
  } catch {
    return def;
  }
}
export async function setSetting(key, value) {
  const raw = await AsyncStorage.getItem(K.settings);
  const obj = raw ? JSON.parse(raw) : {};
  obj[key] = value;
  await AsyncStorage.setItem(K.settings, JSON.stringify(obj));
}

// ---- chats ---- (rows: { chat_id, title, username, watched })
export async function upsertChat(c) {
  const chats = await readArr(K.chats);
  const id = String(c.chatId);
  const i = chats.findIndex((x) => x.chat_id === id);
  const existing = i >= 0 ? chats[i] : null;
  const row = {
    chat_id: id,
    title: c.title,
    username: c.username || null,
    // preserve a prior watched choice on refresh
    watched: existing ? existing.watched : c.watched ? 1 : 0,
  };
  if (i >= 0) chats[i] = row;
  else chats.push(row);
  await writeArr(K.chats, chats);
}
export async function setWatched(chatId, watched) {
  const chats = await readArr(K.chats);
  const i = chats.findIndex((x) => x.chat_id === String(chatId));
  if (i >= 0) {
    chats[i].watched = watched ? 1 : 0;
    await writeArr(K.chats, chats);
  }
}
export async function listChats() {
  const chats = await readArr(K.chats);
  return chats.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
}
export async function watchedChatIds() {
  const chats = await readArr(K.chats);
  return chats.filter((c) => c.watched).map((c) => c.chat_id);
}

// ---- rules ---- (matcher dicts with id, name, enabled, config fields)
export async function listRules() {
  return readArr(K.rules);
}
export async function saveRule(rule) {
  const rules = await readArr(K.rules);
  if (rule.id) {
    const i = rules.findIndex((r) => r.id === rule.id);
    if (i >= 0) rules[i] = rule;
    else rules.push(rule);
  } else {
    const maxId = rules.reduce((m, r) => Math.max(m, r.id || 0), 0);
    rule.id = maxId + 1;
    rules.push(rule);
  }
  await writeArr(K.rules, rules);
  return rule.id;
}
export async function deleteRule(id) {
  const rules = await readArr(K.rules);
  await writeArr(K.rules, rules.filter((r) => r.id !== id));
}

// ---- history ---- (rows: { id, rule_name, chat_id, chat_title, msg_id,
//                            sender, text, link, ts })
export async function addHistory(h) {
  const hist = await readArr(K.history);
  const maxId = hist.reduce((m, x) => Math.max(m, x.id || 0), 0);
  hist.unshift({
    id: maxId + 1,
    rule_name: h.ruleName,
    chat_id: String(h.chatId),
    chat_title: h.chatTitle,
    msg_id: h.msgId,
    sender: h.sender || null,
    text: h.text,
    link: h.link,
    ts: h.ts || Date.now(),
  });
  await writeArr(K.history, hist.slice(0, HISTORY_CAP));
}
export async function searchHistory(query = null, limit = 300) {
  let hist = await readArr(K.history);
  if (query) {
    const q = query.toLowerCase();
    hist = hist.filter((h) => (h.text || "").toLowerCase().includes(q));
  }
  return hist.slice(0, limit);
}
