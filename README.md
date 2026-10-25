# TgWatch

Monitor your Telegram channels and groups for keywords, and get an instant,
tappable notification that opens the exact message. Everything runs on your
phone — you log in with your own Telegram account, and nothing is sent to any
server.

Built on **TDLib**, Telegram's official native library, so it uses the real
Telegram Client API (MTProto) — the same engine as the official apps.

## 📥 Download

Get the latest signed APK from the
**[Releases page](https://github.com/iRohanSingh007/tgwatch/releases/latest)**.

- Android 9+ (arm64)
- Enable **Install unknown apps** for your browser/file manager, then open the APK.

## Features

- **In-app login** with your phone number (code + two-step password supported)
- **Pick which chats to watch** — searchable list with a reload button
- **Keyword rules** with:
  - include terms, **AND / OR** logic, and **exclude** terms (NOT)
  - **whole-word** and **case-sensitive** toggles
  - **regex** mode for power users
  - a built-in **Test** box to try a rule against sample text
- **Live notifications** — tap to jump straight to the message in Telegram
- **Match history** — searchable, tap any entry to open it
- **Background monitoring** — a foreground service keeps watching when the app
  is closed, and resumes after reboot

> On Realme / ColorOS / Xiaomi and similar, allow TgWatch to run in the
> background (the app shows a one-tap prompt) or the OS may stop it.

## How to use

1. Install and open the app, log in with your phone number.
2. **Chats** tab → toggle on the channels/groups to watch.
3. **Rules** tab → **+** → add keywords, test, and save.
4. Leave it running. Matches arrive as notifications and in **History**.

## Build from source

Builds run in GitHub Actions (standard Gradle); no local Android SDK needed.

- Push to `main` → builds a release APK as a workflow artifact.
- Push a tag `vX.Y.Z` → builds, signs, and publishes a GitHub Release.

The native TDLib library (`libtdjson.so`, v1.8.65) is fetched during CI from
[up9cloud/android-libtdjson](https://github.com/up9cloud/android-libtdjson).
Release signing uses a keystore stored in repo secrets.

```
app/src/main/java/app/seedha/tgwatch/
  Td.kt            TDLib JSON-client wrapper (auth, chats, updates)
  Matcher.kt       keyword matching engine
  Store.kt         on-device persistence (rules, chats, history)
  Monitor.kt       message -> match -> notify + history
  MonitorService.kt  foreground service (background monitoring)
  Notifier.kt      notifications (tap opens the message)
  MainActivity.kt  Jetpack Compose UI
```

## Privacy

TgWatch talks directly to Telegram from your device. Your session, rules, and
match history stay in the app's private storage. There is no backend.

## Tech

Kotlin · Jetpack Compose (Material 3) · TDLib 1.8.65 · GitHub Actions
