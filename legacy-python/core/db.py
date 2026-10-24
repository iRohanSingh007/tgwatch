"""SQLite persistence: watched chats, keyword rules, match history, settings.

Rules store their list/bool fields as JSON in a single `config` column so the
matcher can consume a rule dict directly (see core/matcher.py).
"""

import json
import os
import sqlite3
import time


def _conn(path):
    c = sqlite3.connect(path)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    return c


SCHEMA = """
CREATE TABLE IF NOT EXISTS chats (
    chat_id   INTEGER PRIMARY KEY,
    title     TEXT,
    username  TEXT,          -- for public t.me links; NULL if private
    watched   INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rules (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    enabled   INTEGER DEFAULT 1,
    config    TEXT NOT NULL      -- JSON: matcher fields + notif settings
);

CREATE TABLE IF NOT EXISTS history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id    INTEGER,
    rule_name  TEXT,
    chat_id    INTEGER,
    chat_title TEXT,
    msg_id     INTEGER,
    sender     TEXT,
    text       TEXT,
    link       TEXT,          -- tg:// or https://t.me/... deep link
    ts         INTEGER        -- unix seconds
);
CREATE INDEX IF NOT EXISTS idx_history_ts ON history(ts DESC);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);
"""


class DB:
    def __init__(self, path):
        self.path = path
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with _conn(path) as c:
            c.executescript(SCHEMA)

    # ---- settings (api_id/hash, flags) ----
    def get_setting(self, key, default=None):
        with _conn(self.path) as c:
            row = c.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
            return row["value"] if row else default

    def set_setting(self, key, value):
        with _conn(self.path) as c:
            c.execute(
                "INSERT INTO settings(key,value) VALUES(?,?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, str(value)),
            )

    # ---- chats ----
    def upsert_chat(self, chat_id, title, username=None, watched=True):
        with _conn(self.path) as c:
            c.execute(
                "INSERT INTO chats(chat_id,title,username,watched) VALUES(?,?,?,?) "
                "ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title, "
                "username=excluded.username, watched=excluded.watched",
                (chat_id, title, username, int(watched)),
            )

    def set_watched(self, chat_id, watched):
        with _conn(self.path) as c:
            c.execute("UPDATE chats SET watched=? WHERE chat_id=?", (int(watched), chat_id))

    def watched_chat_ids(self):
        with _conn(self.path) as c:
            return [r["chat_id"] for r in c.execute("SELECT chat_id FROM chats WHERE watched=1")]

    def list_chats(self):
        with _conn(self.path) as c:
            return [dict(r) for r in c.execute("SELECT * FROM chats ORDER BY title")]

    # ---- rules ----
    def add_rule(self, name, config):
        with _conn(self.path) as c:
            cur = c.execute(
                "INSERT INTO rules(name,enabled,config) VALUES(?,?,?)",
                (name, int(config.get("enabled", True)), json.dumps(config)),
            )
            return cur.lastrowid

    def update_rule(self, rule_id, name, config):
        with _conn(self.path) as c:
            c.execute(
                "UPDATE rules SET name=?, enabled=?, config=? WHERE id=?",
                (name, int(config.get("enabled", True)), json.dumps(config), rule_id),
            )

    def delete_rule(self, rule_id):
        with _conn(self.path) as c:
            c.execute("DELETE FROM rules WHERE id=?", (rule_id,))

    def list_rules(self):
        """Return rules as matcher-ready dicts with id+name injected."""
        with _conn(self.path) as c:
            out = []
            for r in c.execute("SELECT * FROM rules ORDER BY id"):
                cfg = json.loads(r["config"])
                cfg["id"] = r["id"]
                cfg["name"] = r["name"]
                cfg["enabled"] = bool(r["enabled"])
                out.append(cfg)
            return out

    # ---- history ----
    def add_history(self, **kw):
        kw.setdefault("ts", int(time.time()))
        cols = ("rule_id", "rule_name", "chat_id", "chat_title",
                "msg_id", "sender", "text", "link", "ts")
        with _conn(self.path) as c:
            c.execute(
                f"INSERT INTO history({','.join(cols)}) VALUES({','.join('?'*len(cols))})",
                tuple(kw.get(k) for k in cols),
            )

    def search_history(self, query=None, chat_id=None, limit=200):
        sql = "SELECT * FROM history WHERE 1=1"
        args = []
        if query:
            sql += " AND text LIKE ?"
            args.append(f"%{query}%")
        if chat_id:
            sql += " AND chat_id=?"
            args.append(chat_id)
        sql += " ORDER BY ts DESC LIMIT ?"
        args.append(limit)
        with _conn(self.path) as c:
            return [dict(r) for r in c.execute(sql, args)]
