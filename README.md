# TgWatch

Monitor your Telegram channels/groups for keywords and get a tappable
notification that opens the actual message. Uses the Telegram **Client API**
(Telethon) — you log in with your own phone number, so it can watch any
public *or* private chat you are a member of. Everything stays on-device.

## Features (v1)
- In-app login (phone + code + 2FA) via Client API
- Pick which chats to watch
- Keyword rules: **AND / OR / NOT (exclude)**, whole-word, case-sensitive, **regex**, caption matching
- Native notifications → tap opens the real Telegram message
- Match history with search + tap-to-open
- "Test rule" panel — paste sample text, see if it matches

## Project layout
```
main.py            Kivy/KivyMD UI + app wiring
core/matcher.py    keyword rule engine (pure, unit-tested)
core/db.py         SQLite: chats, rules, history, settings
core/notifier.py   Android notification + tg:// tap action
tg/client.py       Telethon engine (background thread)
tg/links.py        message deep-link builder
buildozer.spec     Android build config
.github/workflows/build.yml   cloud APK build
```

## Build the APK (cloud — no local Android SDK)
1. Create a GitHub repo and push this folder.
2. GitHub **Actions** runs automatically and builds a debug APK.
3. Open the run → **Artifacts** → download `tgwatch-apk`.
4. Install it: `adb install -r app-debug.apk`

## First run
1. Get `api_id` / `api_hash` from https://my.telegram.org → enter in Setup.
2. Log in with your phone number.
3. Refresh chats, tick the ones to watch.
4. Add keyword rules (tap the + in the toolbar).
5. Leave it running — matches arrive as notifications and in History.

## Notes / known limits
- Monitoring runs in-app with a wake-lock. On aggressive OEMs (Realme/MIUI),
  disable battery optimization for TgWatch so it keeps receiving messages.
- A dedicated foreground service for rock-solid 24/7 background is a planned
  v2 enhancement.
