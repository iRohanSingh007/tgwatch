"""Android notifications with a tap-action that opens the Telegram message.

On Android we go through pyjnius to build a real Notification whose content
intent is an ACTION_VIEW on the tg deep link -> tapping opens the message in
the Telegram app. Off Android (desktop dev), we just print, so the rest of
the app is testable without a device.
"""

try:
    from jnius import autoclass, cast
    ANDROID = True
except Exception:
    ANDROID = False


_CHANNEL_ID = "tgwatch_matches"
_next_id = 1000


def _ensure_channel(context, NotificationManager, importance):
    Build = autoclass("android.os.Build$VERSION")
    if Build.SDK_INT >= 26:
        NotificationChannel = autoclass("android.app.NotificationChannel")
        chan = NotificationChannel(_CHANNEL_ID, "Keyword matches", importance)
        mgr = cast(NotificationManager,
                   context.getSystemService(autoclass("android.content.Context").NOTIFICATION_SERVICE))
        mgr.createNotificationChannel(chan)
        return mgr
    return cast(NotificationManager,
                context.getSystemService(autoclass("android.content.Context").NOTIFICATION_SERVICE))


def notify(title, body, link, priority="default"):
    """Post a notification. `link` opens in Telegram when tapped."""
    global _next_id
    if not ANDROID:
        print(f"[NOTIFY] {title}: {body}  -> {link}")
        return

    PythonActivity = autoclass("org.kivy.android.PythonActivity")
    context = PythonActivity.mActivity
    NotificationManager = autoclass("android.app.NotificationManager")
    NotificationBuilder = autoclass("android.app.Notification$Builder")
    Intent = autoclass("android.content.Intent")
    Uri = autoclass("android.net.Uri")
    PendingIntent = autoclass("android.app.PendingIntent")
    Build = autoclass("android.os.Build$VERSION")

    imp_map = {"high": 4, "default": 3, "low": 2}
    importance = imp_map.get(priority, 3)
    mgr = _ensure_channel(context, NotificationManager, importance)

    # Tap -> open the Telegram deep link.
    intent = Intent(Intent.ACTION_VIEW, Uri.parse(link))
    flags = 0x08000000  # FLAG_ACTIVITY_NEW_TASK
    intent.setFlags(flags)
    pi_flags = 0x04000000 | 0x20000000  # CANCEL_CURRENT | IMMUTABLE
    pending = PendingIntent.getActivity(context, _next_id, intent, pi_flags)

    if Build.SDK_INT >= 26:
        builder = NotificationBuilder(context, _CHANNEL_ID)
    else:
        builder = NotificationBuilder(context)
        builder.setPriority(1 if priority == "high" else 0)

    icon = context.getApplicationInfo().icon
    builder.setContentTitle(title)
    builder.setContentText(body)
    builder.setSmallIcon(icon)
    builder.setAutoCancel(True)
    builder.setContentIntent(pending)

    mgr.notify(_next_id, builder.build())
    _next_id += 1
