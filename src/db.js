// SQLite persistence via expo-sqlite (async API, SDK 51).
// Rules store list/bool fields as a JSON config column consumed by matcher.js.

import * as SQLite from "expo-sqlite";

let _db = null;

export async function getDb() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("tgwatch.db");
  await _db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS chats (
      chat_id TEXT PRIMARY KEY,
      title TEXT,
      username TEXT,
      watched INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      config TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_name TEXT, chat_id TEXT, chat_title TEXT,
      msg_id INTEGER, sender TEXT, text TEXT, link TEXT, ts INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_history_ts ON history(ts DESC);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  `);
  return _db;
}

// ---- settings ----
export async function getSetting(key, def = null) {
  const db = await getDb();
  const row = await db.getFirstAsync("SELECT value FROM settings WHERE key=?", [key]);
  return row ? row.value : def;
}
export async function setSetting(key, value) {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [key, String(value)]
  );
}

// ---- chats ----
export async function upsertChat(c) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO chats(chat_id,title,username,watched) VALUES(?,?,?,?)
     ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title, username=excluded.username`,
    [String(c.chatId), c.title, c.username || null, c.watched ? 1 : 0]
  );
}
export async function setWatched(chatId, watched) {
  const db = await getDb();
  await db.runAsync("UPDATE chats SET watched=? WHERE chat_id=?", [watched ? 1 : 0, String(chatId)]);
}
export async function listChats() {
  const db = await getDb();
  return db.getAllAsync("SELECT * FROM chats ORDER BY title");
}
export async function watchedChatIds() {
  const db = await getDb();
  const rows = await db.getAllAsync("SELECT chat_id FROM chats WHERE watched=1");
  return rows.map((r) => r.chat_id);
}

// ---- rules ----
export async function listRules() {
  const db = await getDb();
  const rows = await db.getAllAsync("SELECT * FROM rules ORDER BY id");
  return rows.map((r) => ({ ...JSON.parse(r.config), id: r.id, name: r.name, enabled: !!r.enabled }));
}
export async function saveRule(rule) {
  const db = await getDb();
  const cfg = JSON.stringify(rule);
  if (rule.id) {
    await db.runAsync("UPDATE rules SET name=?, enabled=?, config=? WHERE id=?", [
      rule.name, rule.enabled ? 1 : 0, cfg, rule.id,
    ]);
    return rule.id;
  }
  const res = await db.runAsync("INSERT INTO rules(name,enabled,config) VALUES(?,?,?)", [
    rule.name, rule.enabled ? 1 : 0, cfg,
  ]);
  return res.lastInsertRowId;
}
export async function deleteRule(id) {
  const db = await getDb();
  await db.runAsync("DELETE FROM rules WHERE id=?", [id]);
}

// ---- history ----
export async function addHistory(h) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO history(rule_name,chat_id,chat_title,msg_id,sender,text,link,ts)
     VALUES(?,?,?,?,?,?,?,?)`,
    [h.ruleName, String(h.chatId), h.chatTitle, h.msgId, h.sender || null, h.text, h.link, h.ts || Date.now()]
  );
}
export async function searchHistory(query = null, limit = 300) {
  const db = await getDb();
  if (query) {
    return db.getAllAsync("SELECT * FROM history WHERE text LIKE ? ORDER BY ts DESC LIMIT ?", [`%${query}%`, limit]);
  }
  return db.getAllAsync("SELECT * FROM history ORDER BY ts DESC LIMIT ?", [limit]);
}
