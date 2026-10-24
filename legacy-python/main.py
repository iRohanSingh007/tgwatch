"""TgWatch — monitor Telegram channels for keywords and get tappable alerts.

Client API (Telethon) + KivyMD UI. The Telethon engine runs in a background
thread (tg/client.py); matches arrive via a callback that we marshal onto the
Kivy thread with Clock.schedule_once, persist to history, and raise a
notification whose tap opens the real message (core/notifier.py).
"""

import json
import os

from kivy.clock import Clock
from kivy.metrics import dp
from kivymd.app import MDApp
from kivymd.uix.boxlayout import MDBoxLayout
from kivymd.uix.button import MDRaisedButton, MDFlatButton
from kivymd.uix.dialog import MDDialog
from kivymd.uix.label import MDLabel
from kivymd.uix.list import OneLineAvatarIconListItem, IRightBodyTouch, TwoLineListItem
from kivymd.uix.screen import MDScreen
from kivymd.uix.screenmanager import MDScreenManager
from kivymd.uix.selectioncontrol import MDCheckbox
from kivymd.uix.textfield import MDTextField
from kivymd.uix.scrollview import MDScrollView
from kivymd.uix.toolbar import MDTopAppBar

from core.db import DB
from core.matcher import match_message

APP_DIR = os.path.join(os.path.expanduser("~"), ".tgwatch")
DB_PATH = os.path.join(APP_DIR, "tgwatch.db")
SESSION_PATH = os.path.join(APP_DIR, "session")


def open_link(link):
    """Open a Telegram deep link from the history list."""
    try:
        from jnius import autoclass
        Intent = autoclass("android.content.Intent")
        Uri = autoclass("android.net.Uri")
        PythonActivity = autoclass("org.kivy.android.PythonActivity")
        intent = Intent(Intent.ACTION_VIEW, Uri.parse(link))
        intent.setFlags(0x10000000)
        PythonActivity.mActivity.startActivity(intent)
    except Exception:
        import webbrowser
        webbrowser.open(link)


# ---------------------------------------------------------------- screens
class SetupScreen(MDScreen):
    """One-time entry of api_id / api_hash from my.telegram.org."""
    def __init__(self, app, **kw):
        super().__init__(name="setup", **kw)
        self.app = app
        box = MDBoxLayout(orientation="vertical", padding=dp(24), spacing=dp(16))
        box.add_widget(MDLabel(text="Telegram API credentials",
                               font_style="H5", adaptive_height=True))
        box.add_widget(MDLabel(text="From https://my.telegram.org",
                               theme_text_color="Secondary", adaptive_height=True))
        self.api_id = MDTextField(hint_text="api_id", input_filter="int")
        self.api_hash = MDTextField(hint_text="api_hash")
        box.add_widget(self.api_id)
        box.add_widget(self.api_hash)
        box.add_widget(MDRaisedButton(text="Save & continue",
                                      on_release=self.save))
        self.add_widget(box)

    def save(self, *_):
        if not self.api_id.text or not self.api_hash.text:
            return
        self.app.db.set_setting("api_id", self.api_id.text)
        self.app.db.set_setting("api_hash", self.api_hash.text)
        self.app.build_engine()
        self.app.goto_login()


class LoginScreen(MDScreen):
    """Phone -> code -> (optional) 2FA password."""
    def __init__(self, app, **kw):
        super().__init__(name="login", **kw)
        self.app = app
        self.box = MDBoxLayout(orientation="vertical", padding=dp(24), spacing=dp(16))
        self.add_widget(self.box)
        self.show_phone()

    def _clear(self):
        self.box.clear_widgets()

    def show_phone(self):
        self._clear()
        self.box.add_widget(MDLabel(text="Log in to Telegram",
                                    font_style="H5", adaptive_height=True))
        self.phone = MDTextField(hint_text="+countrycode phone number")
        self.box.add_widget(self.phone)
        self.box.add_widget(MDRaisedButton(text="Send code", on_release=self.send_code))

    def send_code(self, *_):
        phone = self.phone.text.strip()
        if not phone:
            return
        def work():
            self.app.engine.send_code(phone)
            Clock.schedule_once(lambda *_: self.show_code())
        self.app.run_bg(work, "Sending code…")

    def show_code(self):
        self._clear()
        self.box.add_widget(MDLabel(text="Enter the code Telegram sent",
                                    font_style="H6", adaptive_height=True))
        self.code = MDTextField(hint_text="code", input_filter="int")
        self.box.add_widget(self.code)
        self.box.add_widget(MDRaisedButton(text="Verify", on_release=self.verify_code))

    def verify_code(self, *_):
        code = self.code.text.strip()
        def work():
            res = self.app.engine.sign_in_code(code)
            if res == "password":
                Clock.schedule_once(lambda *_: self.show_password())
            else:
                Clock.schedule_once(lambda *_: self.app.goto_main())
        self.app.run_bg(work, "Signing in…")

    def show_password(self):
        self._clear()
        self.box.add_widget(MDLabel(text="Two-step password",
                                    font_style="H6", adaptive_height=True))
        self.pw = MDTextField(hint_text="password", password=True)
        self.box.add_widget(self.pw)
        self.box.add_widget(MDRaisedButton(text="Unlock", on_release=self.verify_pw))

    def verify_pw(self, *_):
        pw = self.pw.text
        def work():
            self.app.engine.sign_in_password(pw)
            Clock.schedule_once(lambda *_: self.app.goto_main())
        self.app.run_bg(work, "Verifying…")


class _RightCheck(IRightBodyTouch, MDCheckbox):
    pass


class MainScreen(MDScreen):
    """Tabbed home: Chats / Rules / History."""
    def __init__(self, app, **kw):
        super().__init__(name="main", **kw)
        self.app = app
        root = MDBoxLayout(orientation="vertical")
        self.toolbar = MDTopAppBar(title="TgWatch")
        self.toolbar.right_action_items = [
            ["refresh", lambda *_: self.load_chats()],
            ["playlist-plus", lambda *_: self.app.open_rule_editor()],
        ]
        root.add_widget(self.toolbar)

        # simple tab buttons
        tabs = MDBoxLayout(size_hint_y=None, height=dp(48), spacing=dp(4), padding=dp(4))
        for name in ("Chats", "Rules", "History"):
            tabs.add_widget(MDFlatButton(text=name,
                                         on_release=lambda b, n=name: self.show_tab(n)))
        root.add_widget(tabs)

        self.scroll = MDScrollView()
        self.list_box = MDBoxLayout(orientation="vertical", adaptive_height=True,
                                    padding=dp(8), spacing=dp(4))
        self.scroll.add_widget(self.list_box)
        root.add_widget(self.scroll)
        self.add_widget(root)
        self.current = "Chats"

    def show_tab(self, name):
        self.current = name
        self.list_box.clear_widgets()
        if name == "Chats":
            self.load_chats()
        elif name == "Rules":
            self.load_rules()
        else:
            self.load_history()

    # ----- chats -----
    def load_chats(self, *_):
        self.list_box.clear_widgets()
        self.list_box.add_widget(MDLabel(text="Loading chats…",
                                         adaptive_height=True))
        def work():
            dialogs = self.app.engine.list_dialogs()
            for d in dialogs:
                self.app.db.upsert_chat(d["chat_id"], d["title"], d["username"],
                                        watched=False)
            Clock.schedule_once(lambda *_: self._render_chats())
        self.app.run_bg(work, "Fetching chats…")

    def _render_chats(self):
        self.list_box.clear_widgets()
        watched = set(self.app.db.watched_chat_ids())
        for c in self.app.db.list_chats():
            item = OneLineAvatarIconListItem(text=c["title"])
            chk = _RightCheck(active=c["chat_id"] in watched)
            chk.bind(active=lambda cb, val, cid=c["chat_id"]:
                     self.app.db.set_watched(cid, val) or self.app.refresh_engine())
            item.add_widget(chk)
            self.list_box.add_widget(item)

    # ----- rules -----
    def load_rules(self, *_):
        self.list_box.clear_widgets()
        rules = self.app.db.list_rules()
        if not rules:
            self.list_box.add_widget(MDLabel(text="No rules yet. Tap + to add.",
                                             adaptive_height=True))
        for r in rules:
            summary = r.get("mode", "simple")
            if r.get("mode") == "regex":
                summary = f"regex: {r.get('pattern','')}"
            else:
                summary = f"{r.get('logic','OR')}: {', '.join(r.get('include_terms',[]))}"
            item = TwoLineListItem(
                text=("✓ " if r.get("enabled") else "✗ ") + r["name"],
                secondary_text=summary,
                on_release=lambda b, rid=r["id"]: self.app.open_rule_editor(rid),
            )
            self.list_box.add_widget(item)

    # ----- history -----
    def load_history(self, query=None):
        self.list_box.clear_widgets()
        search = MDTextField(hint_text="search history…")
        search.bind(on_text_validate=lambda t: self.load_history(t.text))
        self.list_box.add_widget(search)
        rows = self.app.db.search_history(query=query)
        if not rows:
            self.list_box.add_widget(MDLabel(text="No matches yet.",
                                             adaptive_height=True))
        for h in rows:
            item = TwoLineListItem(
                text=f"[{h['rule_name']}] {h['chat_title']}",
                secondary_text=(h["text"] or "")[:80],
                on_release=lambda b, link=h["link"]: open_link(link),
            )
            self.list_box.add_widget(item)


class RuleEditor(MDScreen):
    """Create/edit a keyword rule, with a built-in 'Test rule' panel."""
    def __init__(self, app, **kw):
        super().__init__(name="rule_editor", **kw)
        self.app = app
        self.rule_id = None
        root = MDBoxLayout(orientation="vertical")
        tb = MDTopAppBar(title="Rule")
        tb.left_action_items = [["arrow-left", lambda *_: self.app.goto_main()]]
        tb.right_action_items = [["delete", lambda *_: self.delete()]]
        root.add_widget(tb)
        scroll = MDScrollView()
        self.box = MDBoxLayout(orientation="vertical", adaptive_height=True,
                               padding=dp(16), spacing=dp(12))
        scroll.add_widget(self.box)
        root.add_widget(scroll)
        self.add_widget(root)

    def _row(self, label, widget):
        r = MDBoxLayout(adaptive_height=True, spacing=dp(8))
        r.add_widget(MDLabel(text=label, adaptive_height=True))
        r.add_widget(widget)
        self.box.add_widget(r)

    def load(self, rule_id=None):
        self.rule_id = rule_id
        self.box.clear_widgets()
        cfg = {}
        name = ""
        if rule_id is not None:
            for r in self.app.db.list_rules():
                if r["id"] == rule_id:
                    cfg, name = r, r["name"]
                    break
        self.name = MDTextField(hint_text="Rule name", text=name)
        self.include = MDTextField(hint_text="Include terms (comma separated)",
                                   text=", ".join(cfg.get("include_terms", [])))
        self.exclude = MDTextField(hint_text="Exclude terms (NOT, comma separated)",
                                   text=", ".join(cfg.get("exclude_terms", [])))
        self.pattern = MDTextField(hint_text="Regex pattern (regex mode only)",
                                   text=cfg.get("pattern", ""))
        self.logic = MDCheckbox(active=cfg.get("logic", "OR") == "AND")
        self.whole = MDCheckbox(active=cfg.get("whole_word", False))
        self.case = MDCheckbox(active=cfg.get("case_sensitive", False))
        self.regex = MDCheckbox(active=cfg.get("mode") == "regex")
        self.enabled = MDCheckbox(active=cfg.get("enabled", True))

        self.box.add_widget(self.name)
        self.box.add_widget(self.include)
        self.box.add_widget(self.exclude)
        self.box.add_widget(self.pattern)
        self._row("Match ALL terms (AND)", self.logic)
        self._row("Whole word only", self.whole)
        self._row("Case sensitive", self.case)
        self._row("Regex mode", self.regex)
        self._row("Enabled", self.enabled)

        self.test_in = MDTextField(hint_text="Paste sample message to test…")
        self.box.add_widget(self.test_in)
        self.test_out = MDLabel(text="", adaptive_height=True)
        self.box.add_widget(self.test_out)
        self.box.add_widget(MDRaisedButton(text="Test rule", on_release=self.test))
        self.box.add_widget(MDRaisedButton(text="Save rule", on_release=self.save))

    def _config(self):
        split = lambda s: [t.strip() for t in s.split(",") if t.strip()]
        return {
            "mode": "regex" if self.regex.active else "simple",
            "include_terms": split(self.include.text),
            "exclude_terms": split(self.exclude.text),
            "pattern": self.pattern.text,
            "logic": "AND" if self.logic.active else "OR",
            "whole_word": self.whole.active,
            "case_sensitive": self.case.active,
            "match_captions": True,
            "enabled": self.enabled.active,
        }

    def test(self, *_):
        ok = match_message(self.test_in.text, self._config())
        self.test_out.text = "✅ MATCHES" if ok else "❌ no match"
        self.test_out.theme_text_color = "Custom"

    def save(self, *_):
        name = self.name.text.strip() or "rule"
        cfg = self._config()
        if self.rule_id is None:
            self.app.db.add_rule(name, cfg)
        else:
            self.app.db.update_rule(self.rule_id, name, cfg)
        self.app.refresh_engine()
        self.app.goto_main()

    def delete(self, *_):
        if self.rule_id is not None:
            self.app.db.delete_rule(self.rule_id)
            self.app.refresh_engine()
        self.app.goto_main()


class TgWatchApp(MDApp):
    def build(self):
        self.theme_cls.primary_palette = "Blue"
        os.makedirs(APP_DIR, exist_ok=True)
        self.db = DB(DB_PATH)
        self.engine = None
        self._dialog = None
        self.sm = MDScreenManager()
        self.sm.add_widget(SetupScreen(self))
        self.sm.add_widget(LoginScreen(self))
        self.sm.add_widget(MainScreen(self))
        self.sm.add_widget(RuleEditor(self))
        return self.sm

    def on_start(self):
        self._acquire_wakelock()
        if self.db.get_setting("api_id") and self.db.get_setting("api_hash"):
            self.build_engine()
            def work():
                if self.engine.is_authorized():
                    Clock.schedule_once(lambda *_: self.goto_main())
                else:
                    Clock.schedule_once(lambda *_: self.goto_login())
            self.run_bg(work, "Connecting…")
        else:
            self.sm.current = "setup"

    # ---- engine lifecycle ----
    def build_engine(self):
        from tg.client import TgEngine
        self.engine = TgEngine(SESSION_PATH,
                               self.db.get_setting("api_id"),
                               self.db.get_setting("api_hash"))
        self.engine.on_match = self._on_match

    def refresh_engine(self):
        if self.engine:
            self.engine.watched_ids = set(self.db.watched_chat_ids())
            self.engine.rules = self.db.list_rules()

    def start_monitoring(self):
        self.refresh_engine()
        def work():
            self.engine.start_monitoring()
        self.run_bg(work, "Starting monitor…")

    def _on_match(self, hit):
        # Called from engine thread -> hop to Kivy thread.
        Clock.schedule_once(lambda *_: self._handle_match(hit))

    def _handle_match(self, hit):
        self.db.add_history(**hit)
        from core.notifier import notify
        notify(f"[{hit['rule_name']}] {hit['chat_title']}",
               (hit["text"] or "")[:120], hit["link"])

    # ---- navigation ----
    def goto_login(self):
        self.sm.current = "login"

    def goto_main(self):
        self.sm.current = "main"
        self.start_monitoring()
        self.sm.get_screen("main").show_tab("Chats")

    def open_rule_editor(self, rule_id=None):
        self.sm.get_screen("rule_editor").load(rule_id)
        self.sm.current = "rule_editor"

    # ---- helpers ----
    def run_bg(self, fn, msg="Working…"):
        import threading
        def wrap():
            try:
                fn()
            except Exception as e:
                Clock.schedule_once(lambda *_: self.toast(f"Error: {e}"))
        threading.Thread(target=wrap, daemon=True).start()

    def toast(self, text):
        if self._dialog:
            self._dialog.dismiss()
        self._dialog = MDDialog(text=text,
                                buttons=[MDFlatButton(text="OK",
                                         on_release=lambda *_: self._dialog.dismiss())])
        self._dialog.open()

    def _acquire_wakelock(self):
        try:
            from jnius import autoclass
            PythonActivity = autoclass("org.kivy.android.PythonActivity")
            Context = autoclass("android.content.Context")
            pm = PythonActivity.mActivity.getSystemService(Context.POWER_SERVICE)
            self._wl = pm.newWakeLock(1, "tgwatch:monitor")  # PARTIAL_WAKE_LOCK
            self._wl.acquire()
        except Exception:
            pass


if __name__ == "__main__":
    TgWatchApp().run()
