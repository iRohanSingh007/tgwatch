// Build deep links that open the actual Telegram message.

function internalId(chatId) {
  const s = String(chatId);
  if (s.startsWith("-100")) return s.slice(4);
  return s.replace(/^-/, "");
}

export function messageLink(chatId, msgId, username) {
  if (username) return `https://t.me/${username}/${msgId}`;
  return `https://t.me/c/${internalId(chatId)}/${msgId}`;
}
