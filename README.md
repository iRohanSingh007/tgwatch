# TgWatch (React Native / Expo)

Monitor your Telegram channels for keywords and get a tappable notification
that opens the actual message. Client API (GramJS) — users log in with their
own phone number, so it watches any public *or* private chat they're in.
Everything runs on-device. Built to be published publicly.

> **Status:** v0.1 ships the full UI + keyword engine + storage and proves the
> EAS cloud-build pipeline. Telegram login + live monitoring (GramJS) land in
> v0.2 once the build is green.

## Stack
- **React Native + Expo** — polished Material 3 UI (react-native-paper)
- **GramJS** *(v0.2)* — Telegram Client API (MTProto)
- **expo-sqlite** — rules + match history on-device
- **expo-notifications** *(v0.2)* — tappable alerts → open the message
- **EAS Build** — managed cloud APK builds (no local Android SDK)

## Layout
```
App.js                 bottom-nav shell (Rules / History / Chats)
src/matcher.js         keyword engine (AND/OR/NOT, regex, whole-word, case)
src/db.js              expo-sqlite persistence
src/links.js           tg deep-link builder
src/theme.js           Material 3 dark theme
src/screens/           RulesScreen, RuleEditor, HistoryScreen, ChatsScreen
legacy-python/         old Kivy/buildozer attempt (archived)
```

## Build the APK (cloud via EAS)
One-time setup:
1. Create a free Expo account at https://expo.dev.
2. Create an access token: https://expo.dev/settings/access-tokens.
3. In the GitHub repo → **Settings → Secrets and variables → Actions → New
   repository secret**: name `EXPO_TOKEN`, value = the token.

Then: push to `main` (or run the **EAS Build APK** workflow). It builds on
EAS and the APK download link appears in the Actions log and on your
https://expo.dev dashboard. Install with `adb install -r <file>.apk`.
