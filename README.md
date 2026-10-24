# TgWatch (Android, native Kotlin + TDLib)

Monitor your Telegram channels for keywords and get a tappable notification
that opens the message. Uses **TDLib** (Telegram's official native library)
for the Client API — real MTProto, no JS crypto hacks. In-app login, on-device.

## 📥 Download

Grab the latest signed APK from
**[Releases](https://github.com/iRohanSingh007/tgwatch/releases/latest)**
(arm64 Android 9+), then install it (allow "install from unknown sources").

## Stack
- Kotlin + Jetpack Compose (Material 3)
- TDLib 1.8.65 via prebuilt libtdjson.so (up9cloud/android-libtdjson), fetched in CI
- GitHub Actions → standard Gradle build → APK

## Build
Push to `main` → GitHub Actions builds the APK (Actions tab → artifact `tgwatch-apk`).
`adb install -r app-debug.apk`

## Status
v0.1: TDLib loads natively + full phone/code/2FA login. Chat selection,
keyword rules, and background monitoring next.

Archived earlier attempts: `legacy-rn/` (React Native/GramJS), `legacy-python/` (Kivy).
