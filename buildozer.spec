[app]
title = TgWatch
package.name = tgwatch
package.domain = app.seedha
source.dir = .
source.include_exts = py,png,jpg,kv,atlas
version = 0.1

# Pure-python deps are resolved by python-for-android via pip.
# telethon pulls pyaes + rsa (both pure python, fine on-device).
requirements = python3,kivy==2.3.0,kivymd==1.2.0,pillow,pyjnius,telethon,pyaes,rsa,android

orientation = portrait
fullscreen = 0

# Android 9+ (API 28). Target a modern API for Play/compat.
android.api = 34
android.minapi = 28
android.archs = arm64-v8a, armeabi-v7a
android.allow_backup = True

android.permissions = INTERNET, WAKE_LOCK, FOREGROUND_SERVICE, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, REQUEST_IGNORE_BATTERY_OPTIMIZATIONS

# Keep the Telethon session + sqlite db in app-private storage.
android.logcat_filters = *:S python:D

[buildozer]
log_level = 2
warn_on_root = 0
