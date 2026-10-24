"""Telethon (MTProto Client API) engine running in a dedicated thread.

Kivy owns the main thread; Telethon needs its own asyncio loop, so we run
the loop in a background thread and expose thread-safe `call()` helpers that
schedule coroutines onto it and block for the result.

UI code never imports telethon directly — it talks to this wrapper and
receives results via plain callbacks (which the UI marshals back onto the
Kivy thread with Clock.schedule_once).
"""

import asyncio
import threading

from telethon import TelegramClient, events
from telethon.errors import SessionPasswordNeededError
from telethon.tl.types import Channel, Chat

from tg.links import message_link


class TgEngine:
    def __init__(self, session_path, api_id, api_hash):
        self.session_path = session_path
        self.api_id = int(api_id)
        self.api_hash = api_hash
        self.client = None
        self.loop = asyncio.new_event_loop()
        self._phone = None
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        # Set by the app before monitoring starts:
        self.watched_ids = set()          # chat ids to watch
        self.rules = []                   # matcher-ready rule dicts
        self.on_match = None              # callback(dict) on a keyword hit

    # ---------- loop plumbing ----------
    def _run_loop(self):
        asyncio.set_event_loop(self.loop)
        self.loop.run_forever()

    def call(self, coro, timeout=60):
        """Run a coroutine on the engine loop from any thread; block for result."""
        fut = asyncio.run_coroutine_threadsafe(coro, self.loop)
        return fut.result(timeout)

    # ---------- connection / auth ----------
    async def _connect(self):
        if self.client is None:
            self.client = TelegramClient(self.session_path, self.api_id, self.api_hash)
        if not self.client.is_connected():
            await self.client.connect()

    def is_authorized(self):
        async def _c():
            await self._connect()
            return await self.client.is_user_authorized()
        return self.call(_c())

    def send_code(self, phone):
        self._phone = phone
        async def _c():
            await self._connect()
            await self.client.send_code_request(phone)
        return self.call(_c())

    def sign_in_code(self, code):
        """Returns 'ok' or 'password' (2FA required) or raises."""
        async def _c():
            try:
                await self.client.sign_in(self._phone, code=code)
                return "ok"
            except SessionPasswordNeededError:
                return "password"
        return self.call(_c())

    def sign_in_password(self, password):
        async def _c():
            await self.client.sign_in(password=password)
            return "ok"
        return self.call(_c())

    def logout(self):
        async def _c():
            if self.client:
                await self.client.log_out()
        return self.call(_c())

    # ---------- dialogs (chat picker) ----------
    def list_dialogs(self):
        """Return channels + groups the user is in, as plain dicts."""
        async def _c():
            await self._connect()
            out = []
            async for d in self.client.iter_dialogs():
                ent = d.entity
                if isinstance(ent, (Channel, Chat)):
                    out.append({
                        "chat_id": d.id,
                        "title": d.name or "(no title)",
                        "username": getattr(ent, "username", None),
                        "is_channel": isinstance(ent, Channel),
                    })
            return out
        return self.call(_c(), timeout=120)

    # ---------- live monitoring ----------
    def start_monitoring(self):
        """Register the new-message handler and keep running in the background."""
        async def _c():
            await self._connect()

            @self.client.on(events.NewMessage())
            async def handler(event):
                cid = event.chat_id
                if self.watched_ids and cid not in self.watched_ids:
                    return
                text = event.message.message or ""
                try:
                    chat = await event.get_chat()
                    title = getattr(chat, "title", None) or getattr(chat, "username", "") or str(cid)
                    username = getattr(chat, "username", None)
                except Exception:
                    title, username = str(cid), None
                sender = None
                try:
                    s = await event.get_sender()
                    sender = getattr(s, "username", None) or getattr(s, "first_name", None)
                except Exception:
                    pass

                from core.matcher import match_message
                for rule in self.rules:
                    if match_message(text, rule):
                        link = message_link(cid, event.message.id, username)
                        hit = {
                            "rule_id": rule.get("id"),
                            "rule_name": rule.get("name"),
                            "chat_id": cid,
                            "chat_title": title,
                            "msg_id": event.message.id,
                            "sender": sender,
                            "text": text,
                            "link": link,
                        }
                        if self.on_match:
                            self.on_match(hit)
                        break  # one notification per message
            return True
        return self.call(_c())
