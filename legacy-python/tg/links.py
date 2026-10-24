"""Build deep links that open the actual Telegram message on the phone."""


def _internal_id(chat_id):
    """Strip the -100 supergroup/channel prefix to get Telegram's raw id."""
    s = str(chat_id)
    if s.startswith("-100"):
        return s[4:]
    return s.lstrip("-")


def message_link(chat_id, msg_id, username=None):
    """Return the best deep link for a message.

    Public chats (have a username) -> https://t.me/<username>/<msg_id>
    Private channels/supergroups   -> https://t.me/c/<internal>/<msg_id>

    Both open directly in the Telegram app when it is installed; the /c/
    form only works if the logged-in account is a member (which it is,
    since we only watch the user's own chats).
    """
    if username:
        return f"https://t.me/{username}/{msg_id}"
    return f"https://t.me/c/{_internal_id(chat_id)}/{msg_id}"
