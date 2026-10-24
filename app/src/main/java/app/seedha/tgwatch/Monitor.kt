package app.seedha.tgwatch

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Collects new Telegram messages, matches them against enabled rules for
 * watched chats, and on a hit: stores history + raises a notification.
 */
object Monitor {
    private var started = false

    fun start(context: Context, scope: CoroutineScope) {
        if (started) return
        started = true
        Notifier.ensureChannel(context)

        scope.launch {
            Td.newMessages.collect { update ->
                val message = update.optJSONObject("message") ?: return@collect
                val chatId = message.optLong("chat_id")
                if (chatId !in Store.watched.value) return@collect

                val text = Td.messageText(update)
                val rules = Store.rules.value
                for (rule in rules) {
                    if (Matcher.match(text, rule)) {
                        val title = Td.chats.value[chatId]?.title ?: chatId.toString()
                        val link = Td.messageLink(chatId, message.optLong("id"))
                        Store.addHistory(
                            HistoryItem(rule.name, title, text, link, System.currentTimeMillis())
                        )
                        Notifier.notify(context, "[${rule.name}] $title", text.take(140), link)
                        break
                    }
                }
            }
        }
    }
}
